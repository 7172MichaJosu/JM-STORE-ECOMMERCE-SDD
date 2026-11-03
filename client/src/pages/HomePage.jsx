import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useData } from "../app/hooks.js";
import HeroCarousel from "../components/HeroCarousel.jsx";
import CategoryStrip from "../components/CategoryStrip.jsx";
import CategoryTiles from "../components/CategoryTiles.jsx";
import ProductGrid from "../components/ProductGrid.jsx";
import { Loading, ErrorState } from "../components/EmptyState.jsx";
export default function HomePage() {
  const products = useData("/products?featured=true&pageSize=5"),
    categories = useData("/categories");
  return (
    <main className="container home">
      <HeroCarousel />
      <CategoryStrip categories={categories.data || []} />
      <CategoryTiles />
      <section className="featured-section">
        <div className="section-heading">
          <div>
            <span className="kicker">SELECCIONADOS PARA TI</span>
            <h2>Tus próximos favoritos</h2>
          </div>
          <Link to="/catalogo">
            Ver todo el catálogo <ArrowRight size={17} />
          </Link>
        </div>
        {products.loading ? (
          <Loading />
        ) : products.error ? (
          <ErrorState error={products.error} retry={products.reload} />
        ) : (
          <ProductGrid products={products.data} />
        )}
      </section>
      <div className="discovery-banner">
        <div>
          <span>ELIGE, DESCUBRE, DISFRUTA</span>
          <h2>
            Un universo de posibilidades.
            <br />
            <em>Una tienda para ti.</em>
          </h2>
        </div>
        <Link className="btn yellow" to="/catalogo">
          Descubrir JM-STORE
          <ArrowRight size={18} />
        </Link>
      </div>
    </main>
  );
}
