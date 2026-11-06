import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { useData } from "../app/hooks.js";
import { api } from "../services/api.js";
import { confirmPayment } from "../services/checkout.js";
import { useCart } from "../app/providers.jsx";
import QuoteSummary from "../components/QuoteSummary.jsx";
import PaymentChoice from "../components/PaymentChoice.jsx";
import { Loading, ErrorState } from "../components/EmptyState.jsx";
export default function CheckoutPage() {
  const addresses = useData("/me/addresses"),
    { cart, refreshCart, flushCart, pending, error: cartError, needsSync } = useCart(),
    navigate = useNavigate(),
    [id, setId] = useState(""),
    [quote, setQuote] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  useEffect(() => { setQuote(null); }, [cart?.version, pending]);
  useEffect(() => {
    if (addresses.data?.length) setId(String(addresses.data[0].id));
  }, [addresses.data]);
  async function review() {
    setBusy(true);
    setError(null);
    try {
      const current = await refreshCart();
      setQuote(
        await api("/checkout/quote", {
          method: "POST",
          body: { addressId: Number(id), cartVersion: current.version },
        }),
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function confirm(outcome) {
    setBusy(true);
    setError(null);
    try {
      await flushCart();
      const order = await confirmPayment(quote, outcome);
      await refreshCart();
      navigate("/cuenta/pedidos/" + order.publicId);
    } catch (e) {
      setError(e);
      if (e.status === 409) setQuote(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="container page narrow-page">
      <div className="checkout-steps">
        <span className="done">1 Carrito</span>
        <i />
        <span className="active">2 Confirmación</span>
        <i />
        <span>3 Pedido</span>
      </div>
      <span className="kicker">TODO LISTO PARA TU PRÓXIMO FAVORITO</span>
      <h1>Finaliza tu compra</h1>
      <div className="panel checkout-panel">
        <h2>
          <MapPin size={21} />
          Dirección del pedido
        </h2>
        {addresses.loading ? (
          <Loading />
        ) : addresses.error ? (
          <ErrorState error={addresses.error} retry={addresses.reload} />
        ) : addresses.data.length ? (
          <>
            <label>
              Selecciona tu dirección
              <select
                value={id}
                onChange={(e) => {
                  setId(e.target.value);
                  setQuote(null);
                }}
              >
                {addresses.data.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.recipient} · {a.street}, {a.district}
                  </option>
                ))}
              </select>
            </label>
            <Link className="text-link" to="/cuenta/direcciones">
              Administrar mis direcciones
            </Link>
            {!quote && (
              <button
                className="btn wide large"
                disabled={!id || busy || pending || cartError || needsSync}
                onClick={review}
              >
                {busy ? "Revisando…" : "Revisar mi pedido"}
              </button>
            )}
          </>
        ) : (
          <p>
            Agrega una dirección antes de continuar.{" "}
            <Link to="/cuenta/direcciones">Agregar dirección</Link>
          </p>
        )}
        {quote ? (
          <>
            <QuoteSummary quote={quote} />
            <PaymentChoice onConfirm={confirm} busy={busy || pending || !!cartError || needsSync} error={error} />
          </>
        ) : (
          error && (
            <div className="form-error" role="alert">
              {error.message}
            </div>
          )
        )}
      </div>
    </main>
  );
}
