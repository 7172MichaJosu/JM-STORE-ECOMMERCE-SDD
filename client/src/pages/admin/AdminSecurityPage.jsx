import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api.js";
import { useAuth, useToast } from "../../app/providers.jsx";
import EmptyState, { Loading } from "../../components/EmptyState.jsx";
import "../../styles/admin-security.css";

function PasswordField({ name, label, autoComplete, required = false, error }) {
  const [visible, setVisible] = useState(false);
  return <div><label htmlFor={name}>{label}</label><div className="security-password">
    <input id={name} name={name} type={visible ? "text" : "password"} required={required} minLength={12} maxLength={128} autoComplete={autoComplete} aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} />
    <button type="button" className="btn secondary" aria-pressed={visible} aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`} onClick={() => setVisible(!visible)}>{visible ? "Ocultar" : "Mostrar"}</button>
  </div>{error && <small id={`${name}-error`} className="form-error">{error}</small>}</div>;
}

export default function AdminSecurityPage() {
  const { capabilities, setUser, clearAuth, refreshSession } = useAuth();
  const notify = useToast(), navigate = useNavigate();
  const [record, setRecord] = useState(null), [pending, setPending] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const errorRef = useRef(null), submitting = useRef(false), cancelPasswordRef = useRef(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  async function load() {
    setError("");
    try {
      setRecord(await api("/admin/me/security"));
      setPending(await api("/admin/me/security/email-change").catch(() => null));
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { if (capabilities.adminSecurity) load(); }, [capabilities.adminSecurity]);
  if (!capabilities.adminSecurity) return <EmptyState title="Esta página no está disponible" text="Este entorno no ofrece cambios de seguridad desde el panel." />;
  async function save(event) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget, values = { email: "", ...Object.fromEntries(new FormData(form)) };
    if (values.newPassword && values.newPassword !== values.confirmNewPassword) { setFieldErrors({ confirmNewPassword: "Las contraseñas deben coincidir." }); setError("La nueva contraseña y la confirmación deben coincidir."); return; }
    if (values.email.trim() && values.newPassword) { setError("Cambia el correo y la contraseña en operaciones separadas."); return; }
    if (!values.email.trim() && !values.newPassword) { setError("Introduce un nuevo correo o contraseña."); return; }
    const body = { currentPassword: values.currentPassword, version: record.version };
    if (values.email.trim()) body.email = values.email;
    if (values.newPassword) { body.newPassword = values.newPassword; body.confirmNewPassword = values.confirmNewPassword; }
    submitting.current = true; setBusy(true); setError(""); setFieldErrors({});
    try {
      const result = await api("/admin/me/security", { method: "PATCH", body });
      form.reset();
      if (result.requiresLogin) {
        clearAuth(); await refreshSession().catch(() => {});
        notify("Contraseña actualizada. Inicia sesión nuevamente.");
        navigate("/admin/ingresar", { replace: true });
      } else if (result.requiresVerification) {
        setPending({ operationId: result.operationId, pendingEmail: result.pendingEmail, status: "PENDING", expiresAt: result.expiresAt });
        notify(result.message);
      } else {
        setUser(result.user);
        setRecord({ id: result.user.id, email: result.user.email, version: result.user.version });
        notify("Correo actualizado.");
      }
    } catch (e) {
      form.reset(); setFieldErrors(e.fields || {});
      if (e.code === "NETWORK") {
        try {
          const session = await refreshSession();
          if (!session.user) {
            clearAuth(); notify("La conexión se interrumpió. Inicia sesión con las credenciales elegidas y verifica el resultado.", "error");
            navigate("/admin/ingresar", { replace: true });
          } else { await load(); setError("La conexión se interrumpió. Revisa el estado del cambio antes de reintentar."); }
        } catch { setError("No se pudo verificar el resultado. Inicia sesión nuevamente antes de reintentar."); }
      } else if (e.status === 401) {
        clearAuth(); await refreshSession().catch(() => {});
        notify("Tu sesión terminó. Inicia sesión nuevamente.", "error"); navigate("/admin/ingresar", { replace: true });
      } else { if (e.status === 409) await load(); setError(e.message); }
    } finally { submitting.current = false; setBusy(false); }
  }
  async function cancelPending() {
    if (!pending?.operationId || busy) return;
    setBusy(true); setError("");
    try {
      await api("/admin/me/security/email-change", { method: "DELETE", body: { operationId: pending.operationId, currentPassword: cancelPasswordRef.current?.value || "" } });
      setPending(null); if (cancelPasswordRef.current) cancelPasswordRef.current.value = "";
      notify("La solicitud de cambio de correo fue cancelada.");
    } catch (e) { setFieldErrors(e.fields || {}); setError(e.message); }
    finally { setBusy(false); }
  }
  return <section className="admin-security">
    <span className="kicker">MI CUENTA</span><h1>Seguridad de mi cuenta</h1>
    <p className="muted">Confirma tu contraseña actual. Cambia el correo y la contraseña en operaciones separadas. {capabilities.emailVerification ? "El correo nuevo se aplica solo después de verificar el enlace." : "El correo se actualizará después de confirmar la contraseña actual."} Cada cambio cerrará todas tus sesiones.</p>
    {pending && <div className="notice" role="status"><p>Verificacion pendiente para {pending.pendingEmail}. El correo actual sigue vigente hasta confirmar el enlace.</p>{pending.operationId && <><label htmlFor="cancelCurrentPassword">Contrasena actual para cancelar</label><input id="cancelCurrentPassword" ref={cancelPasswordRef} type="password" minLength={12} maxLength={128} autoComplete="current-password" aria-invalid={!!fieldErrors.currentPassword} /><button className="btn secondary" type="button" disabled={busy} onClick={cancelPending}>Cancelar solicitud</button></>}</div>}
    <div className="form-error" id="security-error" role="alert" tabIndex={-1} ref={errorRef} hidden={!error}>{error}</div>
    {!record ? error ? <button className="btn" onClick={load}>Reintentar carga</button> : <Loading /> :
    <form className="panel form-panel" onSubmit={save}>
      <label>Correo actual<input value={record.email} readOnly /></label>
      <fieldset disabled={busy}>
        <label>Nuevo correo electrónico<input name="email" type="email" maxLength={254} autoComplete="off" disabled={capabilities.emailChangeReady === false} aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? "email-error" : undefined} /></label>
        {capabilities.emailChangeReady === false && <p className="notice">El cambio de correo estará disponible cuando termine la configuración de verificación. Puedes actualizar tu contraseña.</p>}
        {fieldErrors.email && <small className="form-error" id="email-error">{fieldErrors.email}</small>}
        <PasswordField name="currentPassword" label="Contraseña actual" autoComplete="current-password" required error={fieldErrors.currentPassword} />
        <PasswordField name="newPassword" label="Nueva contraseña" autoComplete="new-password" error={fieldErrors.newPassword} />
        <PasswordField name="confirmNewPassword" label="Confirmar nueva contraseña" autoComplete="new-password" error={fieldErrors.confirmNewPassword} />
        <p className="muted">La contraseña nueva debe tener entre 12 y 128 caracteres. Deja estos campos vacíos si solo cambias tu correo.</p>
        <button className="btn" type="submit">{busy ? "Guardando…" : "Guardar cambios"}</button>
      </fieldset>
    </form>}
  </section>;
}
