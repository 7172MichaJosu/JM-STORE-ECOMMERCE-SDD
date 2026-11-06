import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from "react";
import { api, bootstrap } from "../services/api.js";
import { createCartController } from "../services/cart-controller.js";
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
    [toast, setToast] = useState(null);
  const [controller] = useState(() => createCartController({
    load: ({ signal }) => api("/cart", { signal }),
    write: (id, n, version, { signal }) => api("/cart/items/" + id, {
      method: n ? "PUT" : "DELETE", signal,
      body: n ? { quantity: n, cartVersion: version } : { cartVersion: version },
    }),
  }));
  const cartState = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [sessionEpoch, setSessionEpoch] = useState(0);
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
  const report = useCallback(e => {
    if (!e.silent && !e.reported) { e.reported = true; notify(e.message, "error"); }
  }, [notify]);
  const refreshCart = useCallback(() => controller.refresh(), [controller]);
  useEffect(() => {
    controller.reset();
    if (!loading && user?.role !== "ADMIN") refreshCart().catch(report);
  }, [user?.id, user?.role, loading, sessionEpoch, controller, refreshCart, report]);
  async function authenticate(path, body) {
    await controller.flush();
    const s = await api(path, { method: "POST", body });
    controller.reset(); setSessionEpoch(n => n + 1);
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
    controller.reset();
    await api("/auth/logout", { method: "POST", body: {} });
    setUser(null);
    setCapabilities({ adminSecurity: false, emailVerification: false });
    await bootstrap(true);
    setSessionEpoch(n => n + 1);
    notify("Sesión cerrada");
  }
  async function quantity(productId, n) {
    try { return await controller.quantity(productId, n); }
    catch (e) { report(e); throw e; }
  }
  async function adjust(productId, delta) {
    try { return await controller.adjust(productId, delta); }
    catch (e) { report(e); throw e; }
  }
  function clearAuth() {
    setUser(null);
    controller.reset();
    setCapabilities({ adminSecurity: false, emailVerification: false });
  }
  async function refreshSession() {
    const s = await bootstrap(true);
    controller.reset(); setSessionEpoch(n => n + 1);
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
      await controller.add(p);
      notify("Producto agregado a tu carrito");
    } catch (e) {
      report(e);
    }
  }
  return (
    <Toast.Provider value={notify}>
      <Auth.Provider value={{ user, loading, authenticate, logout, setUser, capabilities, clearAuth, refreshSession }}>
        <Cart.Provider value={{ ...cartState, refreshCart, quantity, adjust, add, flushCart: controller.flush }}>
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
