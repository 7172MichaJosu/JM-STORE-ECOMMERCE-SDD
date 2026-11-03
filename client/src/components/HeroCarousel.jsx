import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
const slides = [
  {
    pill: "DESCUBRE EL UNIVERSO JM",
    first: "Lo que te gusta.",
    second: "Más cerca de ti.",
    text: "Tecnología, hogar y mucho más. Encuentra tu próximo favorito en un solo lugar.",
    to: "/catalogo",
    tag: "Tu próxima gran idea empieza aquí.",
    image: "laptop",
    secondImage: "headphones",
    label: "Explorar la colección",
  },
  {
    pill: "DALE VIDA A TU ESPACIO",
    first: "Tu casa.",
    second: "Tu mejor lugar.",
    text: "Pequeños detalles que transforman el día a día. Descubre nuestra selección para el hogar.",
    to: "/categorias/hogar",
    tag: "Haz espacio para lo que te inspira.",
    image: "chair",
    secondImage: "lamp",
    label: "Descubrir hogar",
  },
  {
    pill: "HECHO PARA TU RITMO",
    first: "Todos tus planes.",
    second: "Un nuevo estilo.",
    text: "Encuentra objetos que acompañen tus momentos. Una selección con personalidad propia.",
    to: "/categorias/accesorios",
    tag: "Lleva contigo lo que importa.",
    image: "backpack",
    secondImage: "sunglasses",
    label: "Ver accesorios",
  },
];
export default function HeroCarousel() {
  const [index, setIndex] = useState(0),
    s = slides[index];
  return (
    <section
      className="hero"
      aria-roledescription="carrusel"
      aria-label="Colecciones JM-STORE"
    >
      <div className="hero-pattern" />
      <div className="hero-copy">
        <span className="eyebrow">
          <Sparkles size={14} />
          {s.pill}
        </span>
        <h1>
          {s.first}
          <br />
          <em>{s.second}</em>
        </h1>
        <p>{s.text}</p>
        <Link to={s.to} className="btn yellow">
          {s.label}
          <ArrowRight size={19} />
        </Link>
        <span className="hero-note">
          Tienda de demostración · Precios en soles
        </span>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="hero-orbit" />
        <div className="floating-label">
          <i /> {s.tag}
        </div>
        <div className="hero-main-photo">
          <img src={"/images/demo/" + s.image + ".jpg"} alt="" />
          <span>
            JM
            <br />
            <b>SELECT</b>
          </span>
        </div>
        <div className="hero-secondary-photo">
          <img src={"/images/demo/" + s.secondImage + ".jpg"} alt="" />
        </div>
        <div className="hero-round">
          <ArrowUpRight size={34} />
        </div>
        <div className="hero-stamp">
          JM<span>STORE</span>
        </div>
      </div>
      <div className="hero-controls">
        <button
          onClick={() => setIndex((index + 2) % 3)}
          aria-label="Colección anterior"
        >
          <ChevronLeft size={17} />
        </button>
        <div>
          {slides.map((_, i) => (
            <button
              key={i}
              className={index === i ? "active" : ""}
              onClick={() => setIndex(i)}
              aria-label={"Ver colección " + (i + 1)}
              aria-pressed={index === i}
            />
          ))}
        </div>
        <button
          onClick={() => setIndex((index + 1) % 3)}
          aria-label="Siguiente colección"
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </section>
  );
}
