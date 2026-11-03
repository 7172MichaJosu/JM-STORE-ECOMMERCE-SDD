import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Layers3,
  Tags,
  Boxes,
  Users,
  ClipboardList,
  ArrowUpRight,
  LogOut,
} from "lucide-react";
import { useAuth } from "../app/providers.jsx";
export default function AdminLayout() {
  const { logout } = useAuth(),
    navigate = useNavigate();
  const nav = [
    ["", "Vista general", LayoutDashboard],
    ["productos", "Productos", Package],
    ["categorias", "Categorías", Layers3],
    ["promociones", "Promociones", Tags],
    ["inventario", "Inventario", Boxes],
    ["clientes", "Clientes", Users],
    ["pedidos", "Pedidos", ClipboardList],
  ];
  return (
    <main className="container admin-layout">
      <aside className="admin-sidebar panel">
        <div className="admin-brand">
          <span>JM</span>
          <div>
            <b>Panel de control</b>
            <small>ADMINISTRACIÓN</small>
          </div>
        </div>
        <nav>
          {nav.map(([path, label, Icon]) => (
            <NavLink
              end={!path}
              key={path}
              to={"/admin" + (path ? "/" + path : "")}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link to="/">
            Ver mi tienda
            <ArrowUpRight size={17} />
          </Link>
          <button
            onClick={async () => {
              await logout();
              navigate("/admin/ingresar");
            }}
          >
            <LogOut size={17} />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <div className="admin-topline">
          <span>JM-STORE / ADMINISTRACIÓN</span>
          <span>
            <i />
            Modo demostración
          </span>
        </div>
        <Outlet />
      </div>
    </main>
  );
}
