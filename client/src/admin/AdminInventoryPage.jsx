import { useState } from "react";
import { useData } from "../app/hooks.js";
import { api } from "./adminApi.js";
import { useToast } from "../app/providers.jsx";
import { PageTitle, DataState, Table } from "./shared.jsx";
export default function AdminInventoryPage() {
  const s = useData("/admin/inventory?pageSize=100"),
    [selected, setSelected] = useState(null),
    [error, setError] = useState(""),
    notify = useToast();
  const history = useData(
    selected
      ? "/admin/inventory/" + selected.product_id + "/movements?pageSize=100"
      : null,
  );
  async function adjust(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api("/admin/inventory/" + selected.product_id + "/adjustments", {
        method: "POST",
        body: {
          expectedVersion: selected.version,
          newQuantity: Number(f.get("quantity")),
          reason: f.get("reason"),
        },
      });
      notify("Inventario actualizado");
      setSelected(null);
      setError("");
      s.reload();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <PageTitle
        title="Inventario"
        description="Controla existencias con ajustes trazables y versiones."
      />
      {selected && (
        <form
          key={selected.product_id}
          className="panel admin-form compact-form"
          onSubmit={adjust}
        >
          <h2>Ajustar: {selected.name}</h2>
          <div className="form-grid">
            <label>
              Nueva cantidad
              <input
                name="quantity"
                type="number"
                min="0"
                max="1000000"
                required
                defaultValue={selected.quantity}
              />
            </label>
            <label>
              Motivo del ajuste
              <input name="reason" required minLength={3} maxLength={200} />
            </label>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="button-row">
            <button className="btn">Guardar ajuste</button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setSelected(null)}
            >
              Cerrar
            </button>
          </div>
          <h3>Movimientos recientes</h3>
          {history.data?.map((h) => (
            <div className="payment-history" key={h.id}>
              <span>
                {h.kind} · {h.reason}
              </span>
              <b>
                {h.delta > 0 ? "+" : ""}
                {h.delta} → {h.quantity_after}
              </b>
            </div>
          ))}
        </form>
      )}
      <DataState state={s}>
        <Table head={["Producto", "SKU", "Existencias", "Versión", "Acción"]}>
          {s.data?.map((i) => (
            <tr key={i.product_id}>
              <td>
                <b>{i.name}</b>
              </td>
              <td>{i.sku}</td>
              <td>
                <span
                  className={
                    "badge " +
                    (i.quantity > 5 ? "green" : i.quantity ? "orange" : "gray")
                  }
                >
                  {i.quantity} unidades
                </span>
              </td>
              <td>{i.version}</td>
              <td>
                <button
                  className="text-button"
                  onClick={() => {
                    setSelected(i);
                    setError("");
                  }}
                >
                  Ajustar / Historial
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </DataState>
    </>
  );
}
