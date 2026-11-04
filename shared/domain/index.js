// Single source of truth: these modules are pure and contain no database/runtime setup.
export { discounted, total } from "../../server/src/lib/money.js";
export {
  fields,
  text,
  integer,
  flag,
  pagination,
  version,
} from "../../server/src/lib/validation.js";
export { AppError, fail, notFound } from "../../server/src/lib/errors.js";
export const orderStates = Object.freeze([
  "AWAITING_PAYMENT",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
]);
