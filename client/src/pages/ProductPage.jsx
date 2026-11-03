import { useParams, Link } from "react-router-dom";
import { ShoppingCart, Package, ShieldCheck } from "lucide-react";
import { useData } from "../app/hooks.js";
import { useCart, useToast } from "../app/providers.jsx";
import Price from "../components/Price.jsx";
import { Loading, ErrorState } from "../components/EmptyState.jsx";
import { useState } from "react";
export default function ProductPage() {
  const { slug } = useParams(),
    s = useData("/products/" + slug),
    { add } = useCart();
  const [image, setImage] = useState(0);
  if (s.loading) return <Loading />;
  if (s.error) return <ErrorState error={s.error} retry={s.reload} />;
  const p = s.data;
  return (
    <main className="container page">
      <div className="breadcrumbs">
        <Link to="/">Inicio</Link>/
        <Link to={"/categorias/" + p.category.slug}>{p.category.name}</Link>/
        <span>{p.name}</span>
      </div>
      <section className="product-detail panel">
        <div className="product-gallery">
          <img
            className="detail-photo"
            src={p.images[image]?.path || "/images/placeholder.svg"}
            alt={p.images[image]?.alt || p.name}
          />
          {p.images.length > 1 && (
            <div className="thumbnails">
              {p.images.map((i, n) => (
                <button
                  key={i.id}
                  onClick={() => setImage(n)}
                  aria-label={"Ver imagen " + (n + 1)}
                >
                  <img src={i.path} alt={i.alt} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="detail-copy">
          <span className="kicker">{p.category.name} · SELECCIÓN JM</span>
          <h1>{p.name}</h1>
          <span className="sku">SKU {p.sku}</span>
          <div className="detail-price">
            {p.promotion && (
              <del>{"S/ " + (p.base_price_cents / 100).toFixed(2)}</del>
            )}
            <Price amount={p.effective_price_cents} />
          </div>
          {p.promotion && (
            <div className="promotion-note">
              <b>Promoción de demostración</b>
              <p>{p.promotion.terms}</p>
            </div>
          )}
          <p className="detail-description">{p.description}</p>
          <p className={"stock " + (!p.is_available ? "out" : "")}>
            <i />
            {p.is_available
              ? p.available_quantity + " unidades disponibles"
              : "Sin stock por el momento"}
          </p>
          <button
            className="btn wide large"
            disabled={!p.is_available}
            onClick={() => add(p)}
          >
            <ShoppingCart size={20} />
            Agregar al carrito
          </button>
          <div className="detail-footnote">
            <ShieldCheck size={19} />
            <span>
              Compra simulada, sin cobros reales.
              <br />
              Imagen genérica referencial.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
