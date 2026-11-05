import { describe, expect, it } from "vitest";
import { apiRoutes } from "../../src/api.js";

describe("Firebase email action route wiring", () => {
  it("mounts the explicit POST confirmation under /auth/email-change for Firebase auth mode", () => {
    const api = apiRoutes();
    const mounted = api.stack.find((layer) => layer.matchers?.some((match) => match("/auth/email-change/confirm")?.path === "/auth/email-change"));
    expect(mounted).toBeTruthy();
    const endpoint = mounted.handle.stack.find((layer) => layer.route?.path === "/confirm");
    expect(endpoint?.route?.methods?.post).toBe(true);
    expect(endpoint?.route?.methods?.get).toBeUndefined();
  });
});
