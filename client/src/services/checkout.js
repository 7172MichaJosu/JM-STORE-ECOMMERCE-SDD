import { api } from "./api.js";
const intentions = new Map();
export function confirmPayment(quote, outcome, orderId) {
  const operation = (orderId || "new") + ":" + quote.quoteToken + ":" + outcome;
  let key = intentions.get(operation);
  if (!key) {
    key = crypto.randomUUID();
    intentions.set(operation, key);
  }
  return api(orderId ? `/orders/${orderId}/simulated-payments` : "/orders", {
    method: "POST",
    body: { quoteToken: quote.quoteToken, simulationOutcome: outcome },
    headers: { "Idempotency-Key": key },
  });
}
