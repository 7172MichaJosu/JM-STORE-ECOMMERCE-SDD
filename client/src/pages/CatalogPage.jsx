import { Link, useSearchParams, useParams } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { useData } from "../app/hooks.js";
import ProductGrid from "../components/ProductGrid.jsx";
import EmptyState, { Loading, ErrorState } from "../components/EmptyState.jsx";
export default function CatalogPage() {
  const [params, setParams] = useSearchParams(),
    { slug } = useParams();
  const query = new URLSearchParams(params);
  if (slug) query.set("category", slug);
  query.set("pageSize", "20");
  const products = useData("/products?" + query),
    cats = useData("/categories");
  function change(key, value) {
    const p = new URLSearchParams(params);
    value ? p.set(key, value) : p.delete(key);
    p.delete("page");
    setParams(p);
  }
  const selected = slug || params.get("category") || "";
  return (
    <main className="container page">
      <div className="breadcrumbs">
        <Link to="/">Inicio</Link>
        <span>/</span>
        <span>Catálogo</span>
      </div>
      <div className="page-heading">
        <div>
          <span className="kicker">DESCUBRE JM-STORE</span>
          <h1>
            {cats.data?.find((c) => c.slug === selected)?.name ||
              "Todo lo que estás buscando"}
          </h1>
          <p>
            {products.meta?.total ?? 0} productos
            {params.get("q") ? " para “" + params.get("q") + "”" : ""}
          </p>
        </div>
        <label className="sort">
          Ordenar por
          <select
            value={params.get("sort") || "relevance"}
            onChange={(e) => change("sort", e.target.value)}
          >
            <option value="relevance">Nuestra selección</option>
            <option value="price_asc">Menor precio</option>
            <option value="price_desc">Mayor precio</option>
            <option value="name">Nombre</option>
          </select>
        </label>
      </div>
      <div className="catalog-layout">
        <aside className="filters">
          <h2>
            <SlidersHorizontal size={18} /> Filtros
          </h2>
          <label>
            Categoría
            <select
              value={selected}
              onChange={(e) => {
                if (slug)
                  location.assign("/catalogo?category=" + e.target.value);
                else change("category", e.target.value);
              }}
            >
              <option value="">Todas las categorías</option>
              {cats.data?.map((c) => (
                <option value={c.slug} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Precio mínimo (S/)
            <input
              type="number"
              min="0"
              placeholder="0"
              value={
                params.has("minPriceCents")
                  ? Number(params.get("minPriceCents")) / 100
                  : ""
              }
              onChange={(e) =>
                change(
                  "minPriceCents",
                  e.target.value
                    ? String(Math.round(+e.target.value * 100))
                    : "",
                )
              }
            />
          </label>
          <label>
            Precio máximo (S/)
            <input
              type="number"
              min="0"
              placeholder="Sin límite"
              value={
                params.has("maxPriceCents")
                  ? Number(params.get("maxPriceCents")) / 100
                  : ""
              }
              onChange={(e) =>
                change(
                  "maxPriceCents",
                  e.target.value
                    ? String(Math.round(+e.target.value * 100))
                    : "",
                )
              }
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={params.get("inStock") === "true"}
              onChange={(e) =>
                change("inStock", e.target.checked ? "true" : "")
              }
            />{" "}
            Solo disponibles
          </label>
          <Link className="text-link" to="/catalogo">
            Limpiar filtros
          </Link>
          <div className="filter-note">
            <b>Elige con tranquilidad.</b>
            <p>
              Todos los precios se muestran en soles. Esta tienda utiliza pagos
              de demostración.
            </p>
          </div>
        </aside>
        <div className="catalog-results">
          {products.loading ? (
            <Loading />
          ) : products.error ? (
            <ErrorState error={products.error} retry={products.reload} />
          ) : products.data?.length ? (
            <>
              <ProductGrid products={products.data} />
              {products.meta.total > 20 && (
                <div className="pagination">
                  <button
                    disabled={products.meta.page === 1}
                    onClick={() => {
                      const p = new URLSearchParams(params);
                      p.set("page", products.meta.page - 1);
                      setParams(p);
                    }}
                  >
                    Anterior
                  </button>
                  <span>Página {products.meta.page}</span>
                  <button
                    disabled={products.meta.page * 20 >= products.meta.total}
                    onClick={() => {
                      const p = new URLSearchParams(params);
                      p.set("page", products.meta.page + 1);
                      setParams(p);
                    }}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </main>
  );
}
