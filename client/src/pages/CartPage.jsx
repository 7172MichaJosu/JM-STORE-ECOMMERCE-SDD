import { Link } from "react-router-dom";
import {
  ShoppingCart,
  ArrowRight,
  Trash2,
  Minus,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useCart, useAuth } from "../app/providers.jsx";
import Price from "../components/Price.jsx";
import EmptyState, { Loading } from "../components/EmptyState.jsx";
export default function CartPage() {
  const { cart, quantity, adjust, pending, error, needsSync, refreshCart } = useCart(),
    { user } = useAuth();
  const change = (id, delta) => adjust(id, delta).catch(() => {});
  if (!cart) return error ? <main className="container page">
    <div className="cart-sync-error form-error" role="alert">
      <p>No se pudo cargar el carrito.</p>
      <button className="btn" onClick={() => refreshCart().catch(() => {})}>Reintentar sincronización</button>
    </div>
  </main> : <Loading />;
  return (
    <main className="container page">
      <div className="breadcrumbs">
        <Link to="/">Inicio</Link>/<span>Mi carrito</span>
      </div>
      <div className="page-heading">
        <div>
          <span className="kicker">UN PASO MÁS CERCA</span>
          <h1>
            Mi carrito <span className="count-pill">{cart.items.length}</span>
          </h1>
        </div>
        <Link className="text-link" to="/catalogo">
          Seguir descubriendo →
        </Link>
      </div>
      {pending && <p role="status">Guardando carrito…</p>}
      {(error || needsSync) && <div className="cart-sync-error form-error" role="alert">
        <p>No se pudo confirmar el cambio. Revisa el carrito antes de continuar.</p>
        <button className="btn" onClick={() => refreshCart().catch(() => {})}>Reintentar sincronización</button>
      </div>}
      {cart.items.length ? (
        <div className="checkout-layout">
          <section className="cart-lines panel">
            {cart.items.map((i) => (
              <article className="cart-line" key={i.product_id}>
                <img src={i.image || "/images/placeholder.svg"} alt={i.name} />
                <div className="cart-line-copy">
                  <h2>{i.name}</h2>
                  <small>
                    Precio unitario <Price amount={i.unit_price_cents} />
                  </small>
                  {i.issue && (
                    <span className="form-error">
                      Revisa la disponibilidad de este artículo.
                    </span>
                  )}
                  <button
                    className="remove-link"
                    onClick={() => quantity(i.product_id, 0).catch(() => {})}
                  >
                    <Trash2 size={14} />
                    Quitar
                  </button>
                </div>
                <div className="quantity">
                  <button
                    aria-label={"Reducir cantidad de " + i.name}
                    onClick={() => change(i.product_id, -1)}
                  >
                    <Minus size={14} />
                  </button>
                  <span>{i.quantity}</span>
                  <button
                    aria-label={"Aumentar cantidad de " + i.name}
                    disabled={i.quantity >= 99 || i.quantity >= i.available_quantity}
                    onClick={() => change(i.product_id, 1)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <Price amount={i.line_total_cents} />
              </article>
            ))}
          </section>
          <aside className="order-summary panel">
            <h2>Resumen de compra</h2>
            <div>
              <span>
                Productos ({cart.items.reduce((n, i) => n + i.quantity, 0)})
              </span>
              <Price amount={cart.subtotal_cents} />
            </div>
            <div className="summary-total">
              <b>Total</b>
              <Price amount={cart.total_cents} />
            </div>
            <p className="muted">
              Entrega y pago: demostración. No se realiza ningún cobro.
            </p>
            {cart.issues.length ? (
              <span role="alert" className="form-error">
                Corrige los artículos sin disponibilidad.
              </span>
            ) : pending || error || needsSync ? (
              <button className="btn wide" disabled>Continuar compra</button>
            ) : (
              <Link className="btn wide" to={user ? "/checkout" : "/ingresar"}>
                Continuar compra
                <ArrowRight size={17} />
              </Link>
            )}
            <span className="secure-note">
              <ShieldCheck size={16} />
              Revisa tu pedido antes de confirmar
            </span>
          </aside>
        </div>
      ) : (
        <EmptyState
          title="Tu carrito está esperando"
          text="Agrega algo que te guste y comienza tu próxima compra."
        />
      )}
    </main>
  );
}
