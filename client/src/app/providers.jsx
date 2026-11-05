import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { api, bootstrap } from "../services/api.js";
const Auth = createContext(),
  Cart = createContext(),
  Toast = createContext();
export const useAuth = () => useContext(Auth),
  useCart = () => useContext(Cart),
  useToast = () => useContext(Toast);
export function Providers({ children }) {
  const [user, setUser] = useState(null),
    [capabilities, setCapabilities] = useState({ adminSecurity: false, emailVerification: false }),
    [loading, setLoading] = useState(true),
    [cart, setCart] = useState(null),
    [toast, setToast] = useState(null);
  const notify = useCallback(
    (message, type = "success") => setToast({ message, type, id: Date.now() }),
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    bootstrap()
      .then((s) => { setUser(s.user); setCapabilities({ adminSecurity: s.capabilities?.adminSecurity === true, emailVerification: s.capabilities?.emailVerification === true, emailChangeReady: s.capabilities?.emailChangeReady !== false }); })
      .catch((e) => notify(e.message, "error"))
      .finally(() => setLoading(false));
  }, []);
  const refreshCart = useCallback(async () => {
    try {
      const c = await api("/cart");
      setCart(c);
      return c;
    } catch (e) {
      if (e.status !== 403) notify(e.message, "error");
      setCart(null);
    }
  }, [notify]);
  useEffect(() => {
    if (!loading && user?.role !== "ADMIN") refreshCart();
    else setCart(null);
  }, [user, loading, refreshCart]);
  async function authenticate(path, body) {
    const s = await api(path, { method: "POST", body });
    setUser(s.user);
    setCapabilities({ adminSecurity: s.capabilities?.adminSecurity === true, emailVerification: s.capabilities?.emailVerification === true, emailChangeReady: s.capabilities?.emailChangeReady !== false });
    notify(
      s.user.role === "ADMIN"
        ? "Bienvenido al panel JM-STORE"
        : s.cartNotice || "Bienvenido a JM-STORE",
    );
    return s.user;
  }
  async function logout() {
    await api("/auth/logout", { method: "POST", body: {} });
    setUser(null);
    setCapabilities({ adminSecurity: false, emailVerification: false });
    await bootstrap(true);
    notify("Sesión cerrada");
  }
  async function quantity(productId, n) {
    const current = await api("/cart");
    const c = await api("/cart/items/" + productId, {
      method: n ? "PUT" : "DELETE",
      body: n
        ? { quantity: n, cartVersion: current.version }
        : { cartVersion: current.version },
    });
    setCart(c);
    return c;
  }
  function clearAuth() {
    setUser(null);
    setCart(null);
    setCapabilities({ adminSecurity: false, emailVerification: false });
  }
  async function refreshSession() {
    const s = await bootstrap(true);
    setUser(s.user);
    setCapabilities({ adminSecurity: s.capabilities?.adminSecurity === true, emailVerification: s.capabilities?.emailVerification === true, emailChangeReady: s.capabilities?.emailChangeReady !== false });
    return s;
  }
  async function add(p) {
    if (user?.role === "ADMIN") {
      notify("Usa una cuenta de cliente para comprar.", "error");
      return;
    }
    try {
      const current = await api("/cart");
      await quantity(
        p.id,
        (current.items.find((x) => x.product_id === p.id)?.quantity || 0) + 1,
      );
      notify("Producto agregado a tu carrito");
    } catch (e) {
      notify(e.message, "error");
    }
  }
  return (
    <Toast.Provider value={notify}>
      <Auth.Provider value={{ user, loading, authenticate, logout, setUser, capabilities, clearAuth, refreshSession }}>
        <Cart.Provider value={{ cart, refreshCart, quantity, add }}>
          {children}
          <div className="toast-region" aria-live="polite">
            {toast && (
              <div className={"toast " + toast.type} role="status">
                {toast.type === "error" ? "!" : "✓"} {toast.message}
                <button
                  onClick={() => setToast(null)}
                  aria-label="Cerrar aviso"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </Cart.Provider>
      </Auth.Provider>
    </Toast.Provider>
  );
}
