import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { X, ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "../app/providers.jsx";
import Price from "./Price.jsx";
export default function MiniCart({ onClose, returnFocus }) {
  const { cart } = useCart(),
    box = useRef();
  useEffect(() => {
    const element = box.current;
    element.querySelector("button")?.focus();
    const handle = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const all = element.querySelectorAll("button,a[href]");
        const first = all[0],
          last = all[all.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    element.addEventListener("keydown", handle);
    return () => {
      element.removeEventListener("keydown", handle);
      returnFocus.current?.focus();
    };
  }, []);
  return (
    <>
      <button
        className="mini-backdrop"
        onClick={onClose}
        aria-label="Cerrar carrito"
        tabIndex={-1}
      />
      <aside
        ref={box}
        className="mini-cart"
        role="dialog"
        aria-modal="true"
        aria-label="Mi carrito"
      >
        <div className="mini-title">
          <h2>
            Mi carrito <span>({cart?.items.length || 0})</span>
          </h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar panel del carrito"
          >
            <X size={19} />
          </button>
        </div>
        {cart?.items.length ? (
          <>
            {cart.items.map((i) => (
              <div className="mini-line" key={i.product_id}>
                <img src={i.image || "/images/placeholder.svg"} alt="" />
                <div>
                  <b>{i.name}</b>
                  <small>{i.quantity} unidad(es)</small>
                  <Price amount={i.line_total_cents} />
                </div>
              </div>
            ))}
            <div className="mini-total">
              <b>Subtotal</b>
              <Price amount={cart.total_cents} />
            </div>
            <Link className="btn wide" to="/carrito" onClick={onClose}>
              Ver mi carrito
              <ArrowRight size={17} />
            </Link>
          </>
        ) : (
          <div className="mini-empty">
            <ShoppingBag size={34} />
            <p>Tu próximo favorito te espera.</p>
            <Link to="/catalogo" onClick={onClose}>
              Explorar productos
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
