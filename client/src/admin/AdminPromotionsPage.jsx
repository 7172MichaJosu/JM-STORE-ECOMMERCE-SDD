import { useState } from "react";
import { useData } from "../app/hooks.js";
import { api } from "./adminApi.js";
import { useToast } from "../app/providers.jsx";
import { PageTitle, DataState, Table, ActiveBadge } from "./shared.jsx";
import { money } from "../components/Price.jsx";
export default function AdminPromotionsPage() {
  const s = useData("/admin/promotions?pageSize=100"),
    p = useData("/admin/products?pageSize=100"),
    c = useData("/admin/categories?pageSize=100"),
    [target, setTarget] = useState("product"),
    [editing, setEditing] = useState(null),
    [error, setError] = useState(""),
    notify = useToast();
  async function save(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      body = {
        productId: target === "product" ? Number(f.get("targetId")) : null,
        categoryId: target === "category" ? Number(f.get("targetId")) : null,
        kind: target === "product" ? "FINAL_PRICE" : "PERCENT_BPS",
        value: Math.round(Number(f.get("value")) * 100),
        startsAt: new Date(f.get("start")).toISOString(),
        endsAt: new Date(f.get("end")).toISOString(),
        terms: f.get("terms"),
        isActive: f.get("active") === "on",
        ...(editing ? { version: editing.version } : {}),
      };
    try {
      await api("/admin/promotions" + (editing ? "/" + editing.id : ""), {
        method: editing ? "PATCH" : "POST",
        body,
      });
      notify("Promoción guardada");
      setEditing(null);
      setError("");
      s.reload();
    } catch (e) {
      setError(e.message);
    }
  }
  const localDate = (value) => {
    const d = new Date(value);
    return new Date(d - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  return (
    <>
      <PageTitle
        title="Promociones"
        description="Solo se muestran beneficios configurados y vigentes."
      />
      <form
        key={editing?.id || "new"}
        className="panel admin-form"
        onSubmit={save}
      >
        <h2>
          {editing
            ? "Editar promoción"
            : "Configurar promoción de demostración"}
        </h2>
        <div className="form-grid">
          <label>
            Aplicar a
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="product">Producto: precio final</option>
              <option value="category">Categoría: porcentaje</option>
            </select>
          </label>
          <label>
            Objetivo
            <select
              aria-label="Objetivo"
              name="targetId"
              defaultValue={editing?.product_id || editing?.category_id}
            >
              {(target === "product" ? p.data : c.data)?.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {target === "product" ? "Precio final (S/)" : "Descuento (%)"}
            <input
              name="value"
              type="number"
              min="0.01"
              max={target === "category" ? "99.99" : "1000000"}
              step="0.01"
              required
              defaultValue={editing ? editing.value / 100 : ""}
            />
          </label>
          <label>
            Inicio
            <input
              name="start"
              type="datetime-local"
              required
              defaultValue={localDate(editing?.starts_at || Date.now())}
            />
          </label>
          <label>
            Fin
            <input
              name="end"
              type="datetime-local"
              required
              defaultValue={localDate(
                editing?.ends_at || Date.now() + 86400000 * 7,
              )}
            />
          </label>
        </div>
        <label>
          Condiciones visibles
          <textarea
            name="terms"
            required
            maxLength={500}
            defaultValue={
              editing?.terms ||
              "Promoción de demostración, sujeta al stock disponible."
            }
          />
        </label>
        <label className="check-label">
          <input
            name="active"
            type="checkbox"
            defaultChecked={editing ? !!editing.is_active : true}
          />
          Promoción activa
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="button-row">
          <button className="btn">Guardar promoción</button>
          {editing && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
      <DataState state={s}>
        <Table head={["Objetivo", "Beneficio", "Vigencia", "Estado", "Acción"]}>
          {s.data?.map((x) => (
            <tr key={x.id}>
              <td>
                {x.product_id
                  ? p.data?.find((z) => z.id === x.product_id)?.name
                  : c.data?.find((z) => z.id === x.category_id)?.name}
              </td>
              <td>
                {x.kind === "FINAL_PRICE"
                  ? money(x.value)
                  : x.value / 100 + "%"}
              </td>
              <td>
                {new Date(x.starts_at).toLocaleDateString("es-PE")} —{" "}
                {new Date(x.ends_at).toLocaleDateString("es-PE")}
              </td>
              <td>
                <ActiveBadge active={x.is_active} />
              </td>
              <td>
                <button
                  className="text-button"
                  onClick={() => {
                    setTarget(x.product_id ? "product" : "category");
                    setEditing(x);
                  }}
                >
                  Editar
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </DataState>
    </>
  );
}
