import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { PackageCheck, ShieldCheck } from "lucide-react";
import { useData } from "../app/hooks.js";
import { useCart } from "../app/providers.jsx";
import { api } from "../services/api.js";
import { confirmPayment } from "../services/checkout.js";
import { AccountLayout } from "../components/AccountNav.jsx";
import { Loading, ErrorState } from "../components/EmptyState.jsx";
import Price from "../components/Price.jsx";
import OrderTimeline, { statusLabels } from "../components/OrderTimeline.jsx";
import QuoteSummary from "../components/QuoteSummary.jsx";
import PaymentChoice from "../components/PaymentChoice.jsx";
export default function OrderDetailPage() {
  const { publicId } = useParams(),
    s = useData("/orders/" + publicId),
    { refreshCart } = useCart(),
    [quote, setQuote] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  async function retry() {
    setBusy(true);
    setError(null);
    try {
      setQuote(
        await api("/orders/" + publicId + "/payment-quote", {
          method: "POST",
          body: {},
        }),
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function confirm(outcome) {
    setBusy(true);
    setError(null);
    try {
      await confirmPayment(quote, outcome, publicId);
      setQuote(null);
      s.reload();
      await refreshCart();
    } catch (e) {
      setError(e);
      if (e.status === 409) setQuote(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AccountLayout>
      <Link className="text-link" to="/cuenta/pedidos">
        ← Volver a mis pedidos
      </Link>
      {s.loading ? (
        <Loading />
      ) : s.error ? (
        <ErrorState error={s.error} retry={s.reload} />
      ) : (
        <>
          <div className="order-result">
            <PackageCheck size={36} />
            <div>
              <span className="kicker">TU PEDIDO ESTÁ REGISTRADO</span>
              <h1>Pedido #{publicId.slice(0, 8).toUpperCase()}</h1>
              <span
                className={
                  "badge " +
                  (s.data.paymentStatus === "APPROVED" ? "green" : "orange")
                }
              >
                {statusLabels[s.data.status]}
              </span>
            </div>
          </div>
          <section className="panel order-detail">
            <h2>
              {s.data.paymentStatus === "APPROVED"
                ? "Pago simulado aprobado"
                : "Pago simulado rechazado"}
            </h2>
            <p className="muted">
              Demostración: no se realizó ningún cobro real.
            </p>
            {s.data.items.map((i) => (
              <div className="quote-line" key={i.product_id}>
                <span>
                  <b>{i.name}</b>
                  <small>{i.quantity} unidad(es)</small>
                </span>
                <Price amount={i.line_total_cents} />
              </div>
            ))}
            <div className="summary-total">
              <b>Total del pedido</b>
              <Price amount={s.data.total_cents} />
            </div>
            <h3>Dirección registrada</h3>
            <p>
              {s.data.deliveryAddress.recipient}
              <br />
              {s.data.deliveryAddress.street}, {s.data.deliveryAddress.district}
              <br />
              {s.data.deliveryAddress.phone}
            </p>
            <h3>Seguimiento del pedido</h3>
            <OrderTimeline history={s.data.history} />
            <h3>Intentos de pago simulado</h3>
            {s.data.payments.map((p, i) => (
              <div className="payment-history" key={p.id}>
                <span>
                  Intento {i + 1} ·{" "}
                  {new Date(p.createdAt).toLocaleString("es-PE")}
                </span>
                <b>{p.outcome === "APPROVED" ? "Aprobado" : "Rechazado"}</b>
              </div>
            ))}
            {s.data.paymentStatus === "REJECTED" && !quote && (
              <button className="btn wide" disabled={busy} onClick={retry}>
                Reintentar pago simulado
              </button>
            )}
            {quote && (
              <>
                <QuoteSummary quote={quote} />
                <PaymentChoice onConfirm={confirm} busy={busy} error={error} />
              </>
            )}
            {error && !quote && (
              <div className="form-error" role="alert">
                {error.message}
                <p>
                  <Link to="/carrito">Revisar mi carrito</Link>
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </AccountLayout>
  );
}
