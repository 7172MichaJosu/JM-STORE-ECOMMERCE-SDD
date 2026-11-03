import { useState } from "react";
import { useAuth, useToast } from "../app/providers.jsx";
import { api } from "../services/api.js";
import { AccountLayout } from "../components/AccountNav.jsx";
export default function ProfilePage() {
  const { user, setUser } = useAuth(),
    notify = useToast(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await api("/me", {
        method: "PATCH",
        body: Object.fromEntries(new FormData(e.currentTarget)),
      });
      setUser(u);
      notify("Perfil actualizado");
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AccountLayout>
      <span className="kicker">TU ESPACIO JM</span>
      <h1>Mi perfil</h1>
      <p className="muted">
        Mantén tus datos al día para tus próximas compras.
      </p>
      <form className="panel form-panel" onSubmit={save}>
        <h2>Información personal</h2>
        <label>
          Nombre completo
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={user.name}
          />
        </label>
        <label>
          Correo electrónico
          <input type="email" value={user.email} readOnly />
        </label>
        <label>
          Teléfono
          <input
            name="phone"
            minLength={7}
            maxLength={20}
            defaultValue={user.phone || ""}
          />
        </label>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button className="btn" disabled={busy}>
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </AccountLayout>
  );
}
