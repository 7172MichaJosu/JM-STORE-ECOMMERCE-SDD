import { Router } from "express";
import { customerOnly } from "../../middleware/auth.js";
import { fields, integer, version } from "../../lib/validation.js";
import { quote, pay } from "./checkout.service.js";
import { getCart } from "../cart/cart.service.js";
import { fail } from "../../lib/errors.js";
import { checkoutLimit } from "../../middleware/rate-limit.js";
export function checkoutRoutes(db, config) {
  const r = Router();
  r.use(["/checkout", "/orders"], customerOnly);
  if (!config.testing) r.use(["/checkout", "/orders"], checkoutLimit());
  r.post("/checkout/quote", (req, res) => {
    fields(req.body, ["addressId", "cartVersion"]);
    integer(req.body.addressId, "addressId", 1);
    version(req.body.cartVersion, getCart(db, req).version);
    res.json({ data: quote(db, req, config, "CART", req.body.addressId) });
  });
  r.post("/orders/:id/payment-quote", (req, res) => {
    fields(req.body, []);
    res.json({ data: quote(db, req, config, "ORDER", null, req.params.id) });
  });
  for (const route of ["/orders", "/orders/:id/simulated-payments"])
    r.post(route, (req, res) => {
      fields(req.body, ["quoteToken", "simulationOutcome"]);
      if (
        typeof req.body.quoteToken !== "string" ||
        !["APPROVED", "REJECTED"].includes(req.body.simulationOutcome)
      )
        fail(422, "VALIDATION", "Elige aprobar o rechazar el pago simulado.");
      res.status(201).json({ data: pay(db, req, config, req.params.id) });
    });
  return r;
}
