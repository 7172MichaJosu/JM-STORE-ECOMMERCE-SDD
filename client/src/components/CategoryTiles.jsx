import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
const tiles = [
  ["Tecnología", "tecnologia", "Conecta con lo que te gusta", "laptop"],
  ["Hogar", "hogar", "Haz tu espacio más tuyo", "chair"],
  ["Accesorios", "accesorios", "Los detalles hacen la diferencia", "backpack"],
];
export default function CategoryTiles() {
  return (
    <section className="category-tiles" aria-label="Descubre por categoría">
      {tiles.map(([name, slug, caption, image], i) => (
        <Link
          to={"/categorias/" + slug}
          className={"category-tile tile" + i}
          key={slug}
        >
          <div>
            <small>ENCUENTRA TU ESTILO</small>
            <h3>{name}</h3>
            <p>{caption}</p>
            <span>
              Explorar <ArrowRight size={15} />
            </span>
          </div>
          <img
            src={"/images/demo/" + image + ".jpg"}
            alt={"Selección de " + name}
            loading="lazy"
          />
        </Link>
      ))}
    </section>
  );
}
