import { Link, NavLink } from "react-router-dom";
import {
  ShoppingBag,
  ShoppingCart,
  UserRound,
  Sun,
  Moon,
  ChevronDown,
  MapPin,
  Grid2X2,
  Sparkles,
} from "lucide-react";
import { useState, useRef } from "react";
import SearchBar from "./SearchBar.jsx";
import MiniCart from "./MiniCart.jsx";
import { useAuth, useCart } from "../app/providers.jsx";
import { useTheme } from "../app/ThemeProvider.jsx";
export default function Header() {
  const { user } = useAuth(),
    { cart } = useCart(),
    { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false),
    cartButton = useRef();
  const count = cart?.items.reduce((n, i) => n + i.quantity, 0) || 0;
  return (
    <>
      <div className="announcement">
        <span>Una selección para tu día a día.</span>
        <b>DEMO DE COMERCIO ELECTRÓNICO</b>
      </div>
      <header className="header">
        <div className="header-main container">
          <Link to="/" className="brand" aria-label="JM-STORE inicio">
            <span className="brand-bag">
              <ShoppingBag size={31} />
            </span>
            <div>
              JM-STORE<span>ENCUENTRA TU PRÓXIMO FAVORITO</span>
            </div>
          </Link>
          <SearchBar />
          <div className="header-actions">
            <button
              className="icon-button theme-toggle"
              onClick={toggle}
              aria-label="Cambiar tema"
            >
              {theme === "dark" ? <Sun size={22} /> : <Moon size={21} />}
            </button>
            <Link
              className="account-link"
              aria-label={user ? "Mi cuenta" : "Ingresar a mi cuenta"}
              to={
                user
                  ? user.role === "ADMIN"
                    ? "/admin"
                    : "/cuenta"
                  : "/ingresar"
              }
            >
              <UserRound size={27} />
              <span>
                <small>
                  {user
                    ? "Hola, " + user.name.split(" ")[0]
                    : "Hola, bienvenido"}
                </small>
                <b>
                  {user ? "Mi cuenta" : "Ingresar"}
                  <ChevronDown size={12} />
                </b>
              </span>
            </Link>
            <button
              className="cart-button"
              onClick={() => setOpen((v) => !v)}
              ref={cartButton}
              aria-label="Abrir carrito"
              aria-expanded={open}
            >
              <ShoppingCart size={29} />
              {count > 0 && <span>{count}</span>}
            </button>
          </div>
        </div>
        <div className="header-nav container">
          <span className="location">
            <MapPin size={17} />
            <span>
              Tu tienda en <b>Perú</b>
            </span>
          </span>
          <nav aria-label="Navegación principal">
            <NavLink to="/catalogo">
              <Grid2X2 size={16} /> Categorías
            </NavLink>
            <NavLink to="/catalogo?featured=true">
              <Sparkles size={15} /> Destacados
            </NavLink>
            <NavLink to="/categorias/tecnologia">Tecnología</NavLink>
            <NavLink to="/categorias/hogar">Hogar</NavLink>
            <NavLink to="/categorias/accesorios">Accesorios</NavLink>
          </nav>
          <span className="nav-message">
            Todo comienza con una buena elección <span>↗</span>
          </span>
        </div>
        {open && (
          <MiniCart onClose={() => setOpen(false)} returnFocus={cartButton} />
        )}
      </header>
    </>
  );
}
