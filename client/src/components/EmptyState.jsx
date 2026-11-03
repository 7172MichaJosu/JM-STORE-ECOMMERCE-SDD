import { PackageSearch } from "lucide-react";
import { Link } from "react-router-dom";
export default function EmptyState({
  title = "No encontramos productos",
  text = "Prueba otra búsqueda o descubre nuestras categorías.",
  action = true,
}) {
  return (
    <div className="empty-state">
      <PackageSearch size={46} />
      <h2>{title}</h2>
      <p>{text}</p>
      {action && (
        <Link className="btn" to="/catalogo">
          Explorar catálogo
        </Link>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span /> Cargando JM-STORE…
    </div>
  );
}
export function ErrorState({ error, retry }) {
  return (
    <div className="error-state" role="alert">
      <strong>No pudimos cargar los datos</strong>
      <p>{error?.message}</p>
      {retry && (
        <button className="btn secondary" onClick={retry}>
          Volver a intentar
        </button>
      )}
    </div>
  );
}
