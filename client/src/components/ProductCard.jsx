import { Link } from "react-router-dom";
import { ShoppingCart, ArrowUpRight } from "lucide-react";
import Price from "./Price.jsx";
import { useCart } from "../app/providers.jsx";
export default function ProductCard({ product: p }) {
  const { add } = useCart();
  const discount =
    p.effective_price_cents < p.base_price_cents
      ? Math.floor((1 - p.effective_price_cents / p.base_price_cents) * 100)
      : 0;
  return (
    <article className="product-card">
      <Link className="product-photo" to={"/productos/" + p.slug}>
        {discount > 0 ? (
          <span className="discount">−{discount}% · Demo</span>
        ) : (
          <span className="category-tag">{p.category.name}</span>
        )}
        <img
          src={p.images[0]?.path || "/images/placeholder.svg"}
          alt={p.images[0]?.alt || p.name}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/images/placeholder.svg";
          }}
        />
        <span className="photo-detail">
          <ArrowUpRight size={18} />
        </span>
      </Link>
      <div className="product-info">
        <Link to={"/productos/" + p.slug}>
          <h3>{p.name}</h3>
        </Link>
        <span className="product-caption">Selección JM · Imagen referencial</span>
        <div className="price-space">
          {discount > 0 && (
            <del>{"S/ " + (p.base_price_cents / 100).toFixed(2)}</del>
          )}
          <Price amount={p.effective_price_cents} />
        </div>
        <div className="product-actions">
          <span className={"stock " + (!p.is_available ? "out" : "")}>
            <i />
            {p.is_available ? "Disponible" : "Agotado"}
          </span>
          <button
            className="btn"
            disabled={!p.is_available}
            onClick={() => add(p)}
          >
            <ShoppingCart size={16} /> Agregar
          </button>
        </div>
      </div>
    </article>
  );
}
