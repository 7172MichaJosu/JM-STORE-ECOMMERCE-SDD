import { NavLink, useNavigate } from "react-router-dom";
import { UserRound, MapPin, Package, LogOut } from "lucide-react";
import { useAuth } from "../app/providers.jsx";
export default function AccountNav() {
  const { user, logout } = useAuth(),
    navigate = useNavigate();
  return (
    <aside className="account-nav panel">
      <div className="avatar">{user?.name[0]}</div>
      <h2>{user?.name}</h2>
      <small>{user?.email}</small>
      <nav>
        <NavLink to="/cuenta" end>
          <UserRound size={18} />
          Mi perfil
        </NavLink>
        <NavLink to="/cuenta/direcciones">
          <MapPin size={18} />
          Mis direcciones
        </NavLink>
        <NavLink to="/cuenta/pedidos">
          <Package size={18} />
          Mis pedidos
        </NavLink>
        <button
          onClick={async () => {
            await logout();
            navigate("/");
          }}
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </nav>
    </aside>
  );
}
export function AccountLayout({ children }) {
  return (
    <main className="container page account-layout">
      <AccountNav />
      <div className="account-content">{children}</div>
    </main>
  );
}
