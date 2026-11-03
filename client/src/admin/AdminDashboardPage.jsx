import { Link } from "react-router-dom";
import {
  Package,
  Users,
  ClipboardList,
  Boxes,
  ArrowUpRight,
} from "lucide-react";
import { useData } from "../app/hooks.js";
import Price from "../components/Price.jsx";
import { DataState, PageTitle, Table } from "./shared.jsx";
import { statusLabels } from "../components/OrderTimeline.jsx";
export default function AdminDashboardPage() {
  const s = useData("/admin/summary"),
    o = useData("/admin/orders?pageSize=5");
  return (
    <>
      <PageTitle
        title="Vista general"
        description="Lo que está pasando en tu tienda, en un solo lugar."
      />
      <DataState state={s}>
        {s.data && (
          <>
            <div className="stats-grid">
              {[
                ["Productos activos", s.data.products, Package],
                ["Clientes", s.data.customers, Users],
                ["Pedidos registrados", s.data.orders, ClipboardList],
                ["Stock bajo (≤5)", s.data.lowStock, Boxes],
              ].map(([name, n, Icon]) => (
                <article className="stat-card panel" key={name}>
                  <span>
                    <Icon size={22} />
                  </span>
                  <small>{name}</small>
                  <b>{n}</b>
                  <Link to="/admin/productos" aria-label={"Revisar " + name}>
                    <ArrowUpRight size={18} />
                  </Link>
                </article>
              ))}
            </div>
            <div className="admin-banner">
              <div>
                <span>OPERACIÓN DE DEMOSTRACIÓN</span>
                <h2>Tu tienda, bajo control.</h2>
                <p>Importe de pedidos con pago simulado aprobado</p>
                <Price amount={s.data.confirmedTotal} />
              </div>
              <Link className="btn yellow" to="/admin/pedidos">
                Gestionar pedidos
                <ArrowUpRight size={18} />
              </Link>
            </div>
          </>
        )}
      </DataState>
      <div className="section-heading">
        <h2>Pedidos recientes</h2>
        <Link to="/admin/pedidos">Ver todos →</Link>
      </div>
      <DataState state={o}>
        <Table head={["Pedido", "Cliente", "Estado", "Total", "Detalle"]}>
          {o.data?.length ? (
            o.data.map((x) => (
              <tr key={x.publicId}>
                <td>#{x.publicId.slice(0, 8)}</td>
                <td>{x.customer.name}</td>
                <td>
                  <span className="badge blue">{statusLabels[x.status]}</span>
                </td>
                <td>
                  <Price amount={x.total_cents} />
                </td>
                <td>
                  <Link to={"/admin/pedidos/" + x.publicId}>Abrir →</Link>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5}>Todavía no hay pedidos registrados.</td>
            </tr>
          )}
        </Table>
      </DataState>
    </>
  );
}
