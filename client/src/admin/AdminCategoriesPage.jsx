import { useState } from "react";
import { useData } from "../app/hooks.js";
import { api } from "./adminApi.js";
import { useToast } from "../app/providers.jsx";
import { PageTitle, DataState, Table, ActiveBadge } from "./shared.jsx";
export default function AdminCategoriesPage() {
  const s = useData("/admin/categories?pageSize=100"),
    [editing, setEditing] = useState(null),
    [error, setError] = useState(""),
    notify = useToast();
  async function save(e) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    try {
      await api("/admin/categories" + (editing ? "/" + editing.id : ""), {
        method: editing ? "PATCH" : "POST",
        body: {
          name: f.get("name"),
          slug: f.get("slug"),
          isActive: f.get("active") === "on",
          ...(editing ? { version: editing.version } : {}),
        },
      });
      notify("Categoría guardada");
      setEditing(null);
      setError("");
      form.reset();
      s.reload();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <PageTitle
        title="Categorías"
        description="Organiza los productos de tu tienda."
      />
      <form
        key={editing?.id || "new"}
        className="panel admin-form compact-form"
        onSubmit={save}
      >
        <h2>{editing ? "Editar categoría" : "Nueva categoría"}</h2>
        <div className="form-grid">
          <label>
            Nombre de categoría
            <input
              name="name"
              minLength={2}
              maxLength={80}
              required
              defaultValue={editing?.name || ""}
            />
          </label>
          <label>
            Slug de categoría
            <input
              name="slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              defaultValue={editing?.slug || ""}
            />
          </label>
        </div>
        <label className="check-label">
          <input
            name="active"
            type="checkbox"
            defaultChecked={editing ? !!editing.is_active : true}
          />
          Categoría activa
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="button-row">
          <button className="btn">Guardar categoría</button>
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
        <Table head={["Nombre", "Slug", "Estado", "Acción"]}>
          {s.data?.map((c) => (
            <tr key={c.id}>
              <td>
                <b>{c.name}</b>
              </td>
              <td>{c.slug}</td>
              <td>
                <ActiveBadge active={c.is_active} />
              </td>
              <td>
                <button className="text-button" onClick={() => setEditing(c)}>
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
