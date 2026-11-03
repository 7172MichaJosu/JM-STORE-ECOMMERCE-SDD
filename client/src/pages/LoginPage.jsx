import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth } from "../app/providers.jsx";
export default function LoginPage({ register = false, admin = false }) {
  const { authenticate } = useAuth(),
    navigate = useNavigate();
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      const user = await authenticate(
        register ? "/auth/register" : "/auth/login",
        Object.fromEntries(f),
      );
      if (admin && user.role !== "ADMIN") {
        setError(new Error("Esta cuenta no tiene acceso administrativo."));
        return;
      }
      navigate(user.role === "ADMIN" ? "/admin" : "/cuenta");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="container auth-page">
      <section className="auth-story">
        <span className="eyebrow">BIENVENIDO A TU UNIVERSO JM</span>
        <h1>
          Todo empieza
          <br />
          con una <em>buena elección.</em>
        </h1>
        <p>Una cuenta, tus favoritos y todos tus pedidos en un solo lugar.</p>
        <div className="auth-symbol">
          <ShoppingBag size={95} />
          <span>JM</span>
        </div>
        <small>Demostración académica · Sin pagos reales</small>
      </section>
      <section className="auth-form panel">
        <span className="kicker">
          {admin
            ? "ADMINISTRACIÓN"
            : register
              ? "ÚNETE A JM-STORE"
              : "QUÉ BUENO VERTE"}
        </span>
        <h1>
          {admin
            ? "Tu panel de control"
            : register
              ? "Crea tu cuenta"
              : "¡Hola de nuevo!"}
        </h1>
        <p>
          {admin
            ? "Accede con tu cuenta administrativa provisionada."
            : register
              ? "Comienza a explorar con tu propia cuenta."
              : "Ingresa para seguir descubriendo."}
        </p>
        <form onSubmit={submit}>
          {register && (
            <label>
              Nombre completo
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
              />
            </label>
          )}
          <label>
            Correo electrónico
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
            />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete={register ? "new-password" : "current-password"}
            />
          </label>
          <small>Usa entre 12 y 128 caracteres.</small>
          {error && (
            <div className="form-error" role="alert">
              {error.message}
              {error.fields && (
                <ul>
                  {Object.entries(error.fields).map(([key, value]) => (
                    <li key={key}>{value}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button className="btn wide large" disabled={busy}>
            {busy
              ? "Procesando…"
              : admin
                ? "Ingresar al panel"
                : register
                  ? "Crear mi cuenta"
                  : "Ingresar a mi cuenta"}
            <ArrowRight size={18} />
          </button>
        </form>
        {!admin && (
          <p className="auth-switch">
            {register ? "¿Ya tienes una cuenta?" : "¿Primera vez por aquí?"}{" "}
            <Link to={register ? "/ingresar" : "/registro"}>
              {register ? "Iniciar sesión" : "Regístrate"}
            </Link>
          </p>
        )}
        <div className="auth-secure">
          <ShieldCheck size={17} />
          Acceso privado y protegido
        </div>
        {admin && (
          <Link className="text-link" to="/">
            Volver a la tienda
          </Link>
        )}
      </section>
    </main>
  );
}
