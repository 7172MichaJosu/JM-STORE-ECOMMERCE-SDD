import { useState } from "react";
import { useData } from "../app/hooks.js";
import { api } from "./adminApi.js";
import { useToast } from "../app/providers.jsx";
import { PageTitle, DataState, Table, ActiveBadge } from "./shared.jsx";
export default function AdminCustomersPage() {
  const [q, setQ] = useState(""),
    s = useData("/admin/customers?pageSize=100&q=" + encodeURIComponent(q)),
    [editing, setEditing] = useState(null),
    [error, setError] = useState(""),
    notify = useToast();
  const detail = useData(editing ? "/admin/customers/" + editing.id : null);
  async function save(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api("/admin/customers/" + editing.id, {
        method: "PATCH",
        body: {
          version: editing.version,
          name: f.get("name"),
          phone: f.get("phone"),
          isActive: f.get("active") === "on",
        },
      });
      notify("Cliente actualizado");
      setEditing(null);
      s.reload();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <PageTitle
        title="Clientes"
        description="Consulta cuentas y gestiona sus datos básicos sin exponer credenciales."
      />
      <div className="toolbar">
        <input
          aria-label="Buscar clientes"
          placeholder="Buscar por nombre o correo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {editing && (
        <form
          key={editing.id}
          className="panel admin-form compact-form"
          onSubmit={save}
        >
          <h2>Editar cliente</h2>
          <p className="muted">{editing.email}</p>
          <div className="form-grid">
            <label>
              Nombre del cliente
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                defaultValue={editing.name}
              />
            </label>
            <label>
              Teléfono del cliente
              <input
                name="phone"
                minLength={7}
                maxLength={20}
                defaultValue={editing.phone || ""}
              />
            </label>
          </div>
          <label className="check-label">
            <input
              name="active"
              type="checkbox"
              defaultChecked={!!editing.is_active}
            />
            Cuenta activa
          </label>
          <small>
            Desactivar revoca todas sus sesiones. Su historial se conserva.
          </small>
          {error && <p className="form-error">{error}</p>}
          <div className="button-row">
            <button className="btn">Guardar cliente</button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </button>
          </div>
          <p>{detail.data?.orders?.length || 0} pedidos registrados</p>
        </form>
      )}
      <DataState state={s}>
        <Table head={["Cliente", "Correo", "Teléfono", "Estado", "Acción"]}>
          {s.data?.length ? (
            s.data.map((u) => (
              <tr key={u.id}>
                <td>
                  <b>{u.name}</b>
                </td>
                <td>{u.email}</td>
                <td>{u.phone || "—"}</td>
                <td>
                  <ActiveBadge active={u.is_active} />
                </td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => {
                      setEditing(u);
                      setError("");
                    }}
                  >
                    Ver / Editar
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5}>Todavía no hay clientes.</td>
            </tr>
          )}
        </Table>
      </DataState>
    </>
  );
}
