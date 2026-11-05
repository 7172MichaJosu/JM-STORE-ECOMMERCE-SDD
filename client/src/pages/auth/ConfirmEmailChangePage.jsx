import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api.js";
import { useAuth, useToast } from "../../app/providers.jsx";
import EmptyState from "../../components/EmptyState.jsx";

export default function ConfirmAdminEmailChangePage() {
  const [action] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    let operationId = params.get("operation");
    if (!operationId && params.get("continueUrl")) {
      try {
        const continuation = new URL(params.get("continueUrl"), window.location.origin);
        if (continuation.origin === window.location.origin) operationId = continuation.searchParams.get("operation");
      } catch { /* invalid links are rejected below */ }
    }
    return { operationId, oobCode: params.get("oobCode") };
  });
  const { operationId, oobCode } = action;
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const { clearAuth, refreshSession } = useAuth();
  const notify = useToast(), navigate = useNavigate();
  useEffect(() => { window.history.replaceState(null, "", window.location.pathname); }, []);
  if (!operationId || !oobCode) return <EmptyState title="Enlace no válido" text="Abre el enlace de verificación completo recibido en tu nuevo correo." />;
  async function confirm() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await api("/auth/email-change/confirm", { method: "POST", body: { operationId, oobCode } });
      clearAuth();
      await refreshSession().catch(() => {});
      notify(`El correo ${result.email} fue actualizado. Inicia sesión nuevamente.`);
      navigate("/admin/ingresar", { replace: true });
    } catch (e) { setError(e.message || "No se pudo confirmar el cambio."); }
    finally { setBusy(false); }
  }
  return <section className="page-shell panel form-panel">
    <span className="kicker">MI CUENTA · SEGURIDAD</span>
    <h1>Confirmar nuevo correo</h1>
    <p>El enlace se verificará antes de aplicar el cambio. Por seguridad, se cerrarán todas las sesiones y tendrás que iniciar sesión con el nuevo correo.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="btn" disabled={busy} onClick={confirm}>{busy ? "Verificando…" : "Confirmar cambio de correo"}</button>
  </section>;
}
