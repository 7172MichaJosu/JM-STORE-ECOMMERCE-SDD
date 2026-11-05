import { describe, expect, it, vi } from "vitest";
import { apiRoutes } from "../../src/api.js";
import { responseContext } from "../../src/http/router.js";

describe("Firebase email action route wiring", () => {
  it("accepts explicit POST confirmation but never applies an action through GET", async () => {
    const req = { path: "/auth/email-change/confirm", method: "POST", params: {}, body: {}, get: () => null,
      socket: { remoteAddress: "local" }, config: { environment: "local", firebase: {}, rateSecret: "synthetic-rate-key" }, db: { first: vi.fn(async () => ({ count: 1 })) } };
    await expect(apiRoutes()(req, responseContext())).rejects.toMatchObject({ code: "VALIDATION" });
    req.method = "GET"; req.db.first.mockClear(); const done = vi.fn();
    await apiRoutes()(req, responseContext(), done);
    expect(done).toHaveBeenCalledOnce(); expect(req.db.first).not.toHaveBeenCalled();
  });
});
