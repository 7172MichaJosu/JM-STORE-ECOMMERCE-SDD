import { fields, text } from "../lib/validation.js";
import { fail } from "../lib/errors.js";
export function queryValidation(req, res, next) {
  if (req.method !== "GET") return next();
  let allowed = [];
  const p = req.path;
  if (p === "/products")
    allowed = [
      "q",
      "category",
      "minPriceCents",
      "maxPriceCents",
      "inStock",
      "featured",
      "page",
      "pageSize",
      "sort",
    ];
  else if (
    [
      "/categories",
      "/me/addresses",
      "/orders",
      "/admin/categories",
      "/admin/promotions",
    ].includes(p) ||
    /^\/admin\/inventory\/\d+\/movements$/.test(p)
  )
    allowed = ["page", "pageSize"];
  else if (p === "/admin/products")
    allowed = ["q", "status", "category", "page", "pageSize"];
  else if (p === "/admin/customers")
    allowed = ["q", "status", "page", "pageSize"];
  else if (p === "/admin/inventory") allowed = ["q", "page", "pageSize"];
  else if (p === "/admin/orders")
    allowed = ["status", "paymentStatus", "page", "pageSize"];
  fields(req.query, allowed);
  if (req.query.q) text(req.query.q, "q", 0, 100);
  if (
    ["/admin/products", "/admin/customers"].includes(p) &&
    req.query.status &&
    !["active", "inactive"].includes(req.query.status)
  )
    fail(422, "VALIDATION", "Filtro de estado no válido.");
  if (
    p === "/admin/orders" &&
    ((req.query.status &&
      ![
        "AWAITING_PAYMENT",
        "CONFIRMED",
        "PREPARING",
        "SHIPPED",
        "DELIVERED",
      ].includes(req.query.status)) ||
      (req.query.paymentStatus &&
        !["APPROVED", "REJECTED"].includes(req.query.paymentStatus)))
  )
    fail(422, "VALIDATION", "Filtro de pedido no válido.");
  next();
}
