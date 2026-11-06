// One confirmed snapshot and an ordered intent queue. No credentials or cart data
// are stored outside the server session. Unknown write outcomes are reconciled,
// never replayed automatically.
export function createCartController({ load, write }) {
  let base = null, queue = [], generation = 0, pump = null, loading = null;
  let error = null, needsSync = false;
  const listeners = new Set(), controllers = new Set();
  const empty = () => ({ items: [], issues: [], total_cents: 0, subtotal_cents: 0, currency: "PEN" });
  const changed = () => Object.assign(new Error("La sesión ha cambiado."), { code: "SESSION_CHANGED", silent: true });
  function project(intents = queue) {
    const result = { ...(base || empty()), items: (base?.items || []).map(i => ({ ...i })) };
    for (const intent of intents) {
      const index = result.items.findIndex(i => i.product_id === intent.id);
      const previous = index < 0 ? intent.item : result.items[index];
      const quantity = intent.kind === "delta" ? (index < 0 ? 0 : previous.quantity) + intent.value : intent.value;
      if (index >= 0) result.items.splice(index, 1);
      if (quantity > 0 && previous) result.items.splice(index < 0 ? result.items.length : index, 0, { ...previous, quantity, line_total_cents: previous.unit_price_cents * quantity });
    }
    result.subtotal_cents = result.total_cents = result.items.reduce((n, i) => n + i.line_total_cents, 0);
    result.issues = result.items.filter(i => i.issue).map(i => ({ product_id: i.product_id, code: i.issue }));
    return result;
  }
  let snapshot = { cart: null, pending: false, error: null, needsSync: false };
  function publish() {
    snapshot = { cart: base || queue.length ? project() : null, pending: !!pump || queue.length > 0, error, needsSync };
    for (const listener of listeners) listener();
  }
  async function read(clearError = false) {
    if (loading) return loading;
    const epoch = generation, controller = new AbortController(); controllers.add(controller);
    const promise = (async () => {
      try {
        const cart = await load({ signal: controller.signal });
        if (epoch !== generation) throw changed();
        base = cart; needsSync = false; if (clearError) error = null; publish(); return cart;
      } catch (failure) {
        if (epoch === generation) { error = failure; needsSync = true; publish(); }
        throw failure;
      } finally { controllers.delete(controller); if (epoch === generation) loading = null; }
    })();
    loading = promise;
    return promise;
  }
  function start() {
    if (pump || !queue.length) return;
    const epoch = generation;
    pump = Promise.resolve().then(async () => {
      try {
        if (!base || needsSync) await read();
        while (queue.length && epoch === generation) {
          const head = queue[0];
          const group = [];
          for (const item of queue) { if (item.id !== head.id) break; group.push(item); }
          const target = project(group).items.find(i => i.product_id === head.id)?.quantity || 0;
          const current = base.items.find(i => i.product_id === head.id)?.quantity || 0;
          const controller = new AbortController(); controllers.add(controller);
          try {
            const result = target === current ? base : await write(head.id, target, base.version, { signal: controller.signal });
            if (epoch !== generation) return;
            base = result; queue.splice(0, group.length); publish();
            for (const intent of group) intent.resolve(result);
          } catch (failure) {
            if (epoch !== generation) return;
            if (failure.status === 409 && failure.code === "VERSION_CONFLICT" && !head.retried) {
              head.retried = true; await read(); continue;
            }
            throw failure;
          } finally { controllers.delete(controller); }
        }
      } catch (failure) {
        if (epoch !== generation) return;
        error = failure; needsSync = true;
        const rejected = queue.splice(0); publish();
        for (const intent of rejected) intent.reject(failure);
        if (failure.status !== 401 && failure.status !== 403) {
          try { await read(); } catch { /* Keep confirmed data and block checkout. */ }
        }
      } finally {
        if (epoch === generation) { pump = null; publish(); if (queue.length) start(); }
      }
    });
    publish();
  }
  function enqueue(id, kind, value, product) {
    const cart = project(), previous = cart.items.find(i => i.product_id === id);
    const quantity = kind === "delta" ? (previous?.quantity || 0) + value : value;
    const stock = Math.min(previous?.available_quantity ?? Infinity, product?.available_quantity ?? Infinity);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99 || quantity > stock || (product && product.is_available === false)) {
      return Promise.reject(Object.assign(new Error("Revisa la cantidad y el stock disponible."), { code: "OUT_OF_STOCK" }));
    }
    if (!previous && quantity > 0 && cart.items.length >= 100) return Promise.reject(Object.assign(new Error("El carrito admite hasta 100 productos."), { code: "CART_LIMIT" }));
    if (!previous && !product && quantity) return Promise.reject(new Error("Actualiza el carrito antes de cambiar este producto."));
    const item = product ? { product_id: id, sku: product.sku, name: product.name, image: product.images?.[0]?.path, unit_price_cents: product.effective_price_cents, available_quantity: product.available_quantity, available: product.is_available, issue: null } : previous;
    error = null;
    const promise = new Promise((resolve, reject) => queue.push({ id, kind, value, item, resolve, reject }));
    publish(); start(); return promise;
  }
  async function drain() { while (pump || loading || queue.length) { if (!pump && queue.length) start(); await (pump || loading); } }
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    add: product => enqueue(product.id, "delta", 1, product),
    adjust: (id, delta) => enqueue(id, "delta", delta),
    quantity: (id, value) => enqueue(id, "set", value),
    async flush() { await drain(); if (error) throw error; if (needsSync) throw new Error("Sincroniza el carrito antes de continuar."); return base; },
    async refresh() { await drain(); return read(true); },
    reset() {
      generation++; for (const controller of controllers) controller.abort(); controllers.clear();
      for (const intent of queue) intent.reject(changed());
      queue = []; base = null; pump = null; loading = null; error = null; needsSync = false; publish();
    },
  };
}
