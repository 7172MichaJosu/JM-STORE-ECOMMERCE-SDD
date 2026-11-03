import { Link } from "react-router-dom";
import { Package, ArrowRight } from "lucide-react";
import { useData } from "../app/hooks.js";
import { AccountLayout } from "../components/AccountNav.jsx";
import EmptyState, { Loading, ErrorState } from "../components/EmptyState.jsx";
import Price from "../components/Price.jsx";
import { statusLabels } from "../components/OrderTimeline.jsx";
export default function OrderListPage() {
  const s = useData("/orders?pageSize=100");
  return (
    <AccountLayout>
      <span className="kicker">CADA PEDIDO, A TU ALCANCE</span>
      <h1>Mis pedidos</h1>
      {s.loading ? (
        <Loading />
      ) : s.error ? (
        <ErrorState error={s.error} retry={s.reload} />
      ) : s.data.length ? (
        s.data.map((o) => (
          <article key={o.publicId} className="order-card panel">
            <Package />
            <div>
              <small>{new Date(o.createdAt).toLocaleDateString("es-PE")}</small>
              <h2>Pedido #{o.publicId.slice(0, 8).toUpperCase()}</h2>
              <p>{o.items.map((i) => i.name).join(", ")}</p>
              <span
                className={
                  "badge " +
                  (o.paymentStatus === "APPROVED" ? "green" : "orange")
                }
              >
                {statusLabels[o.status]}
              </span>
            </div>
            <div>
              <Price amount={o.total_cents} />
              <Link className="text-link" to={"/cuenta/pedidos/" + o.publicId}>
                Ver detalle
                <ArrowRight size={16} />
              </Link>
            </div>
          </article>
        ))
      ) : (
        <EmptyState
          title="Tu historia empieza aquí"
          text="Aún no tienes pedidos. Descubre tu próximo favorito."
        />
      )}
    </AccountLayout>
  );
}
