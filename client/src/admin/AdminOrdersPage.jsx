import { useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../app/hooks.js";
import Price from "../components/Price.jsx";
import { statusLabels } from "../components/OrderTimeline.jsx";
import { PageTitle, DataState, Table } from "./shared.jsx";
export default function AdminOrdersPage() {
  const [status, setStatus] = useState(""),
    [payment, setPayment] = useState(""),
    s = useData(
      "/admin/orders?pageSize=100" +
        (status ? "&status=" + status : "") +
        (payment ? "&paymentStatus=" + payment : ""),
    );
  return (
    <>
      <PageTitle
        title="Pedidos"
        description="Un historial completo, desde el pago simulado hasta la entrega."
      />
      <div className="toolbar">
        <label>
          Estado del pedido
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(statusLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pago simulado
          <select value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="">Todos los resultados</option>
            <option value="APPROVED">Aprobado</option>
            <option value="REJECTED">Rechazado</option>
          </select>
        </label>
      </div>
      <DataState state={s}>
        <Table
          head={[
            "Pedido",
            "Cliente",
            "Fecha",
            "Estado",
            "Pago simulado",
            "Total",
            "Acción",
          ]}
        >
          {s.data?.length ? (
            s.data.map((o) => (
              <tr key={o.publicId}>
                <td>#{o.publicId.slice(0, 8)}</td>
                <td>{o.customer.name}</td>
                <td>{new Date(o.createdAt).toLocaleDateString("es-PE")}</td>
                <td>
                  <span className="badge blue">{statusLabels[o.status]}</span>
                </td>
                <td>
                  <span
                    className={
                      "badge " +
                      (o.paymentStatus === "APPROVED" ? "green" : "orange")
                    }
                  >
                    {o.paymentStatus === "APPROVED" ? "Aprobado" : "Rechazado"}
                  </span>
                </td>
                <td>
                  <Price amount={o.total_cents} />
                </td>
                <td>
                  <Link to={"/admin/pedidos/" + o.publicId}>Abrir →</Link>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7}>No hay pedidos para estos filtros.</td>
            </tr>
          )}
        </Table>
      </DataState>
    </>
  );
}
