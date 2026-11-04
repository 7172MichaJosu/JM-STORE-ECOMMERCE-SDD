import { Router } from "express";
import {
  fields,
  integer,
  version,
  pagination,
  fail,
} from "../../shared/domain/index.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { customerOnly, adminOnly } from "./security/sessions.js";
import { limit } from "./security/rate-limit.js";
import * as catalog from "./repositories/catalog.js";
import * as customers from "./repositories/customers.js";
import * as carts from "./repositories/cart.js";
import * as checkout from "./repositories/checkout.js";
import * as orders from "./repositories/orders.js";
export function apiRoutes() {
  const r = Router();
  r.use("/auth", authRoutes());
  r.get("/categories", async (req, res) =>
    res.json(await catalog.categories(req.db, req.query)),
  );
  r.get("/products", async (req, res) =>
    res.json(await catalog.list(req.db, req.query)),
  );
  r.get("/products/:slug", async (req, res) =>
    res.json({ data: await catalog.product(req.db, req.params.slug) }),
  );
  r.use("/me", customerOnly);
  r.get("/me", (req, res) => res.json({ data: req.user }));
  r.patch("/me", async (req, res) =>
    res.json({ data: await customers.profile(req) }),
  );
  r.get("/me/addresses", async (req, res) => {
    const { page, pageSize } = pagination(req.query),
      rows = await customers.addresses(req);
    res.json({
      data: rows.slice((page - 1) * pageSize, page * pageSize),
      meta: { page, pageSize, total: rows.length },
    });
  });
  r.post("/me/addresses", async (req, res) =>
    res.status(201).json({ data: await customers.createAddress(req) }),
  );
  r.patch("/me/addresses/:id", async (req, res) =>
    res.json({ data: await customers.changeAddress(req) }),
  );
  r.delete("/me/addresses/:id", async (req, res) => {
    await customers.changeAddress(req, true);
    res.status(204).end();
  });
  r.get("/cart", async (req, res) =>
    res.json({ data: await carts.summary(req.db, await carts.get(req)) }),
  );
  r.put("/cart/items/:id", async (req, res) =>
    res.json({ data: await carts.change(req) }),
  );
  r.delete("/cart/items/:id", async (req, res) =>
    res.json({ data: await carts.change(req, true) }),
  );
  r.use(["/checkout", "/orders"], customerOnly);
  r.post("/checkout/quote", async (req, res) => {
    fields(req.body, ["addressId", "cartVersion"]);
    integer(req.body.addressId, "addressId", 1);
    version(req.body.cartVersion, (await carts.get(req)).version);
    res.json({ data: await checkout.quote(req, "CART", req.body.addressId) });
  });
  r.post("/orders/:id/payment-quote", async (req, res) => {
    fields(req.body, []);
    res.json({ data: await checkout.quote(req, "ORDER", null, req.params.id) });
  });
  for (const route of ["/orders", "/orders/:id/simulated-payments"])
    r.post(route, limit("checkout", 20, 60), async (req, res) => {
      fields(req.body, ["quoteToken", "simulationOutcome"]);
      if (
        typeof req.body.quoteToken !== "string" ||
        !["APPROVED", "REJECTED"].includes(req.body.simulationOutcome)
      )
        fail(422, "VALIDATION", "Elige aprobar o rechazar el pago simulado.");
      res.status(201).json({ data: await checkout.pay(req, req.params.id) });
    });
  r.get("/orders", async (req, res) => res.json(await orders.list(req)));
  r.get("/orders/:id", async (req, res) =>
    res.json({ data: await orders.view(req.db, req.params.id, req.user.id) }),
  );
  r.use("/admin", adminOnly, (req, res) =>
    res
      .status(503)
      .json({
        error: {
          code: "ADMIN_ADAPTATION_PENDING",
          message:
            "Administración cloud pendiente de su fase de implementación.",
          requestId: req.requestId,
        },
      }),
  );
  return r;
}
