import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "./providers.jsx";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import EmptyState, { Loading } from "../components/EmptyState.jsx";
import HomePage from "../pages/HomePage.jsx";
import CatalogPage from "../pages/CatalogPage.jsx";
import ProductPage from "../pages/ProductPage.jsx";
import LoginPage from "../pages/LoginPage.jsx";
import ProfilePage from "../pages/ProfilePage.jsx";
import AddressesPage from "../pages/AddressesPage.jsx";
import CartPage from "../pages/CartPage.jsx";
import CheckoutPage from "../pages/CheckoutPage.jsx";
import OrderListPage from "../pages/OrderListPage.jsx";
import OrderDetailPage from "../pages/OrderDetailPage.jsx";
import AdminLayout from "../admin/AdminLayout.jsx";
import AdminSecurityPage from "../pages/admin/AdminSecurityPage.jsx";
import ConfirmEmailChangePage from "../pages/auth/ConfirmEmailChangePage.jsx";
import AdminDashboardPage from "../admin/AdminDashboardPage.jsx";
import AdminProductsPage from "../admin/AdminProductsPage.jsx";
import AdminProductFormPage from "../admin/AdminProductFormPage.jsx";
import AdminCategoriesPage from "../admin/AdminCategoriesPage.jsx";
import AdminPromotionsPage from "../admin/AdminPromotionsPage.jsx";
import AdminInventoryPage from "../admin/AdminInventoryPage.jsx";
import AdminCustomersPage from "../admin/AdminCustomersPage.jsx";
import AdminOrdersPage from "../admin/AdminOrdersPage.jsx";
import AdminOrderDetailPage from "../admin/AdminOrderDetailPage.jsx";
function Guard({ role }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user)
    return (
      <Navigate
        to={role === "ADMIN" ? "/admin/ingresar" : "/ingresar"}
        replace
      />
    );
  if (user.role !== role)
    return (
      <EmptyState
        title="Acceso restringido"
        text="Tu cuenta no tiene permisos para esta sección."
      />
    );
  return <Outlet />;
}
export default function AppRouter() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <Header />
      <div id="contenido" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalogo" element={<CatalogPage />} />
          <Route path="/categorias/:slug" element={<CatalogPage />} />
          <Route path="/productos/:slug" element={<ProductPage />} />
          <Route path="/ingresar" element={<LoginPage />} />
          <Route path="/registro" element={<LoginPage register />} />
          <Route path="/admin/ingresar" element={<LoginPage admin />} />
          <Route path="/admin/mi-cuenta/seguridad/confirmar-correo" element={<ConfirmEmailChangePage />} />
          <Route path="/carrito" element={<CartPage />} />
          <Route element={<Guard role="CUSTOMER" />}>
            <Route path="/cuenta" element={<ProfilePage />} />
            <Route path="/cuenta/direcciones" element={<AddressesPage />} />
            <Route path="/cuenta/pedidos" element={<OrderListPage />} />
            <Route
              path="/cuenta/pedidos/:publicId"
              element={<OrderDetailPage />}
            />
            <Route path="/checkout" element={<CheckoutPage />} />
          </Route>
          <Route element={<Guard role="ADMIN" />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="mi-cuenta/seguridad" element={<AdminSecurityPage />} />
              <Route index element={<AdminDashboardPage />} />
              <Route path="productos" element={<AdminProductsPage />} />
              <Route
                path="productos/nuevo"
                element={<AdminProductFormPage />}
              />
              <Route path="productos/:id" element={<AdminProductFormPage />} />
              <Route path="categorias" element={<AdminCategoriesPage />} />
              <Route path="promociones" element={<AdminPromotionsPage />} />
              <Route path="inventario" element={<AdminInventoryPage />} />
              <Route path="clientes" element={<AdminCustomersPage />} />
              <Route path="pedidos" element={<AdminOrdersPage />} />
              <Route
                path="pedidos/:publicId"
                element={<AdminOrderDetailPage />}
              />
            </Route>
          </Route>
          <Route
            path="*"
            element={
              <EmptyState
                title="Esta página no está disponible"
                text="Regresa al catálogo y encuentra algo que te guste."
              />
            }
          />
        </Routes>
      </div>
      <Footer />
    </>
  );
}
