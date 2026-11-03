import { Link } from "react-router-dom";
import {
  Monitor,
  Armchair,
  Watch,
  Sparkles,
  Dumbbell,
  Grid2X2,
} from "lucide-react";
const icons = [Monitor, Armchair, Watch, Sparkles, Dumbbell];
export default function CategoryStrip({ categories = [] }) {
  return (
    <section className="category-strip" aria-label="Explorar categorías">
      <Link className="category-shortcut all" to="/catalogo">
        <span>
          <Grid2X2 />
        </span>
        <b>Todo el catálogo</b>
      </Link>
      {categories.map((c, i) => {
        const Icon = icons[i % icons.length];
        return (
          <Link
            className={"category-shortcut c" + i}
            key={c.id}
            to={"/categorias/" + c.slug}
          >
            <span>
              <Icon size={28} />
            </span>
            <b>{c.name}</b>
          </Link>
        );
      })}
    </section>
  );
}
