export const address = {
  recipient: "Cliente sintético",
  phone: "999000111",
  region: "Lima",
  province: "Lima",
  district: "Lima",
  street: "Calle de prueba 123",
  reference: "",
};
export const productFixture = {
  sku: "JM-TEST-1",
  slug: "producto-prueba",
  name: "Producto de prueba",
  description: "Descripción sintética",
  price: 89900,
  quantity: 8,
};
export const fixtureEmail = () => `test-${crypto.randomUUID()}@example.test`;
export const fixturePassword = () => crypto.randomUUID();
