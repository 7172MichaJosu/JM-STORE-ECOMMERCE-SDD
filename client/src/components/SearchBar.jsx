import { Search } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
export default function SearchBar() {
  const location = useLocation(),
    navigate = useNavigate();
  const [term, setTerm] = useState("");
  useEffect(
    () => setTerm(new URLSearchParams(location.search).get("q") || ""),
    [location.search],
  );
  return (
    <form
      className="searchbar"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        navigate("/catalogo?q=" + encodeURIComponent(term.trim()));
      }}
    >
      <input
        aria-label="Buscar productos"
        type="search"
        placeholder="Buscar productos, categorías y más…"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        maxLength={100}
      />
      <button aria-label="Buscar" type="submit">
        <Search size={22} />
      </button>
    </form>
  );
}
