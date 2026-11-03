import { useState } from "react";
import { MapPin, Pencil, Trash2 } from "lucide-react";
import { useData } from "../app/hooks.js";
import { useToast } from "../app/providers.jsx";
import { api } from "../services/api.js";
import { AccountLayout } from "../components/AccountNav.jsx";
import { Loading, ErrorState } from "../components/EmptyState.jsx";
export default function AddressesPage() {
  const s = useData("/me/addresses"),
    notify = useToast(),
    [editing, setEditing] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    try {
      const body = Object.fromEntries(new FormData(form));
      await api("/me/addresses" + (editing ? "/" + editing.id : ""), {
        method: editing ? "PATCH" : "POST",
        body: { ...body, ...(editing ? { version: editing.version } : {}) },
      });
      notify("Dirección guardada");
      setEditing(null);
      form.reset();
      setError("");
      s.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AccountLayout>
      <span className="kicker">AQUÍ COMIENZA TU PEDIDO</span>
      <h1>Mis direcciones</h1>
      {s.loading ? (
        <Loading />
      ) : s.error ? (
        <ErrorState error={s.error} retry={s.reload} />
      ) : (
        <div className="address-list">
          {s.data.map((a) => (
            <article className="address-card panel" key={a.id}>
              <MapPin />
              <div>
                <b>{a.recipient}</b>
                <p>
                  {a.street}, {a.district}
                </p>
                <small>
                  {a.province}, {a.region} · {a.phone}
                </small>
              </div>
              <button
                className="icon-button"
                aria-label="Editar dirección"
                onClick={() => setEditing(a)}
              >
                <Pencil size={17} />
              </button>
              <button
                className="icon-button danger-text"
                aria-label="Quitar dirección"
                onClick={async () => {
                  try {
                    await api("/me/addresses/" + a.id, {
                      method: "DELETE",
                      body: { version: a.version },
                    });
                    s.reload();
                  } catch (e) {
                    notify(e.message, "error");
                  }
                }}
              >
                <Trash2 size={17} />
              </button>
            </article>
          ))}
        </div>
      )}
      <form
        key={editing?.id || "new"}
        className="panel form-panel"
        onSubmit={submit}
      >
        <h2>{editing ? "Editar dirección" : "Nueva dirección"}</h2>
        <div className="form-grid">
          {[
            ["recipient", "Destinatario", 2, 100],
            ["phone", "Teléfono", 7, 20],
            ["region", "Departamento", 2, 100],
            ["province", "Provincia", 2, 100],
            ["district", "Distrito", 2, 100],
            ["street", "Dirección", 5, 200],
          ].map(([key, label, min, max]) => (
            <label key={key}>
              {label}
              <input
                name={key}
                required
                minLength={min}
                maxLength={max}
                defaultValue={editing?.[key] || ""}
              />
            </label>
          ))}
        </div>
        <label>
          Referencia (opcional)
          <input
            name="reference"
            maxLength={200}
            defaultValue={editing?.reference || ""}
          />
        </label>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="button-row">
          <button className="btn" disabled={busy}>
            {busy ? "Guardando…" : "Guardar dirección"}
          </button>
          {editing && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => setEditing(null)}
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>
    </AccountLayout>
  );
}
