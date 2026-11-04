import { SELF } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { fixtureEmail, fixturePassword, address } from "./commerce.js";
export function client() {
  let cookie = "",
    csrf = "";
  return {
    async request(method, path, body, key) {
      const headers = { cookie, origin: env.APP_ORIGIN };
      if (body !== undefined) {
        headers["content-type"] = "application/json";
        headers["X-CSRF-Token"] = csrf;
      }
      if (key) headers["Idempotency-Key"] = key;
      const response = await SELF.fetch(env.APP_ORIGIN + "/api" + path, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const next = response.headers.get("set-cookie");
      if (next) cookie = next.split(";")[0];
      const data = response.status === 204 ? null : await response.json();
      if (data?.data?.csrfToken) csrf = data.data.csrfToken;
      return { status: response.status, ...data, headers: response.headers };
    },
    async register() {
      await this.request("GET", "/auth/session");
      const credentials = {
        name: "Cliente sintético",
        email: fixtureEmail(),
        password: fixturePassword(),
      };
      const r = await this.request("POST", "/auth/register", credentials);
      if (r.status !== 201) throw Error(JSON.stringify(r));
      return credentials;
    },
    async prepare() {
      await this.register();
      const a = (await this.request("POST", "/me/addresses", address)).data;
      let cart = (await this.request("GET", "/cart")).data;
      cart = (
        await this.request("PUT", "/cart/items/1", {
          quantity: 1,
          cartVersion: cart.version,
        })
      ).data;
      const quote = (
        await this.request("POST", "/checkout/quote", {
          addressId: a.id,
          cartVersion: cart.version,
        })
      ).data;
      return { address: a, cart, quote };
    },
  };
}
