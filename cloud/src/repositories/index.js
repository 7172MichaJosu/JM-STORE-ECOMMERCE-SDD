export const repositoryMethods = Object.freeze({
  catalog: ["categories", "list", "product"],
  identity: ["safeUser", "session", "createSession"],
  customers: ["profile", "addresses"],
  cart: ["get", "summary", "set", "remove"],
  checkout: ["quote", "pay"],
  orders: ["find", "view", "list"],
  admin: ["products", "categories", "inventory", "customers", "orders"],
});
export function assertRepository(name, repo) {
  for (const method of repositoryMethods[name] || [])
    if (typeof repo[method] !== "function")
      throw Error("Repositorio incompleto: " + name + "." + method);
  return repo;
}
