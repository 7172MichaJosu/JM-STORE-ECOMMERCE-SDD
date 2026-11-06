import { describe, it, expect, vi } from "vitest";
import { sessionMiddleware } from "../../src/security/sessions.js";

const now = Date.now();
const session = (overrides = {}) => ({
  id: 1, user_id: null, auth_version: 0, namespace: "synthetic",
  expires_at: new Date(now + 3600_000).toISOString(),
  last_seen_at: new Date(now - 60_000).toISOString(), ...overrides,
});
function fixture(saved, user = null) {
  const db = {
    first: vi.fn(async sql => sql.includes("FROM sessions") ? saved : user),
    run: vi.fn(async () => ({ meta: { changes: 1 } })),
    stmt: vi.fn((...args) => args), batch: vi.fn(async () => []),
  };
  const req = { db, config: { origin: "https://example.test", namespace: "synthetic" }, headers: { cookie: "__Host-jm-sdd.sid=synthetic-cookie" } };
  return { db, req, next: vi.fn() };
}
const touches = db => db.run.mock.calls.filter(([sql]) => sql.startsWith("UPDATE sessions SET last_seen_at"));

describe("Session activity without redundant guest writes", () => {
  it("reads a guest without renewing unused last_seen_at, retaining absolute expiry", async () => {
    const saved = session({ last_seen_at: "2000-01-01T00:00:00.000Z" });
    const f = fixture(saved); await sessionMiddleware(f.req, {}, f.next);
    expect(f.req.session).toBe(saved); expect(f.req.user).toBeNull();
    expect(touches(f.db)).toHaveLength(0); expect(f.db.first).toHaveBeenCalledTimes(1);
    expect(f.next).toHaveBeenCalledOnce();
  });
  it("touches every valid authenticated session and preserves its user", async () => {
    const f = fixture(session({ user_id: 9 }), { id: 9, is_active: 1, auth_version: 0, role: "CUSTOMER", password_hash: "synthetic" });
    await sessionMiddleware(f.req, {}, f.next);
    expect(touches(f.db)).toHaveLength(1); expect(f.req.user.id).toBe(9);
    expect(f.req.user).not.toHaveProperty("password_hash");
  });
  it.each([
    ["expired guest", session({ expires_at: "2000-01-01T00:00:00.000Z" }), null],
    ["idle user", session({ user_id: 9, last_seen_at: "2000-01-01T00:00:00.000Z" }), null],
    ["revoked user", session({ user_id: 9 }), { id: 9, is_active: 1, auth_version: 1 }],
    ["inactive user", session({ user_id: 9 }), { id: 9, is_active: 0, auth_version: 0 }],
  ])("rejects %s before renewing activity", async (_label, saved, user) => {
    const f = fixture(saved, user); await sessionMiddleware(f.req, {}, f.next);
    expect(f.req.session).toBeNull(); expect(f.req.user).toBeNull();
    expect(f.db.run).toHaveBeenCalledWith("DELETE FROM sessions WHERE id=?", 1);
    expect(touches(f.db)).toHaveLength(0);
  });
});
