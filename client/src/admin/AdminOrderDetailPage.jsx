import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useData } from "../app/hooks.js";
import { api } from "./adminApi.js";
import { useToast } from "../app/providers.jsx";
import Price from "../components/Price.jsx";
import OrderTimeline, { statusLabels } from "../components/OrderTimeline.jsx";
import { DataState, PageTitle, Table } from "./shared.jsx";
export default function AdminOrderDetailPage() {
  const { publicId } = useParams(),
    s = useData("/admin/orders/" + publicId),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    notify = useToast();
  async function advance() {
    setBusy(true);
    try {
      await api("/admin/orders/" + publicId + "/status", {
        method: "PATCH",
        body: {
          expectedVersion: s.data.version,
          status: {
            CONFIRMED: "PREPARING",
            PREPARING: "SHIPPED",
            SHIPPED: "DELIVERED",
          }[s.data.status],
        },
      });
      notify("Estado del pedido actualizado");
      s.reload();
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="text-link" to="/admin/pedidos">
        ← Volver a pedidos
      </Link>
      <DataState state={s}>
        {s.data && (
          <>
            <PageTitle
              title={"Pedido #" + publicId.slice(0, 8).toUpperCase()}
              description={s.data.customer.name + " · " + s.data.customer.email}
            />
            <div className="admin-order-layout">
              <section className="panel form-panel">
                <span className="badge blue">
                  {statusLabels[s.data.status]}
                </span>
                <h2>
                  {s.data.paymentStatus === "APPROVED"
                    ? "Pago simulado aprobado"
                    : "Pago simulado rechazado"}
                </h2>
                <p className="muted">
                  Sin cobros reales. Los cambios de estado son manuales.
                </p>
                {s.data.items.map((i) => (
                  <div className="quote-line" key={i.product_id}>
                    <span>
                      {i.quantity} × {i.name}
                    </span>
                    <Price amount={i.line_total_cents} />
                  </div>
                ))}
                <div className="summary-total">
                  <b>Total</b>
                  <Price amount={s.data.total_cents} />
                </div>
                <h3>Dirección registrada</h3>
                <p>
                  {s.data.deliveryAddress.recipient}
                  <br />
                  {s.data.deliveryAddress.street},{" "}
                  {s.data.deliveryAddress.district}
                  <br />
                  {s.data.deliveryAddress.phone}
                </p>
                <h3>Intentos de pago</h3>
                {s.data.payments.map((p) => (
                  <div key={p.id} className="payment-history">
                    <span>{new Date(p.createdAt).toLocaleString("es-PE")}</span>
                    <b>{p.outcome === "APPROVED" ? "Aprobado" : "Rechazado"}</b>
                  </div>
                ))}
              </section>
              <section className="panel form-panel">
                <h2>Seguimiento</h2>
                <OrderTimeline history={s.data.history} />
                {["CONFIRMED", "PREPARING", "SHIPPED"].includes(
                  s.data.status,
                ) && (
                  <button
                    className="btn wide"
                    disabled={busy}
                    onClick={advance}
                  >
                    {busy
                      ? "Actualizando…"
                      : "Marcar " +
                        statusLabels[
                          {
                            CONFIRMED: "PREPARING",
                            PREPARING: "SHIPPED",
                            SHIPPED: "DELIVERED",
                          }[s.data.status]
                        ]}
                  </button>
                )}
                {s.data.status === "AWAITING_PAYMENT" && (
                  <p className="muted">
                    Solo el titular puede reintentar el pago simulado.
                  </p>
                )}
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
              </section>
            </div>
          </>
        )}
      </DataState>
    </>
  );
}
