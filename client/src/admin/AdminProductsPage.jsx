import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil } from "lucide-react";
import { useData } from "../app/hooks.js";
import { useToast } from "../app/providers.jsx";
import { api } from "./adminApi.js";
import Price from "../components/Price.jsx";
import { DataState, PageTitle, Table, ActiveBadge } from "./shared.jsx";
export default function AdminProductsPage() {
  const [q, setQ] = useState(""),
    s = useData("/admin/products?pageSize=100&q=" + encodeURIComponent(q)),
    notify = useToast();
  return (
    <>
      <PageTitle
        title="Productos"
        description="Gestiona tu catálogo, precios e imágenes."
      >
        <Link className="btn" to="/admin/productos/nuevo">
          <Plus size={18} />
          Nuevo producto
        </Link>
      </PageTitle>
      <div className="toolbar">
        <input
          aria-label="Buscar productos del panel"
          placeholder="Buscar por nombre o SKU…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span>{s.meta?.total || 0} productos</span>
      </div>
      <DataState state={s}>
        <Table
          head={[
            "Producto",
            "Categoría",
            "Precio",
            "Stock",
            "Estado",
            "Acciones",
          ]}
        >
          {s.data?.map((p) => (
            <tr key={p.id}>
              <td>
                <div className="table-product">
                  <img
                    src={p.images[0]?.path || "/images/placeholder.svg"}
                    alt=""
                  />
                  <div>
                    <b>{p.name}</b>
                    <small>{p.sku}</small>
                  </div>
                </div>
              </td>
              <td>{p.category.name}</td>
              <td>
                <Price amount={p.effective_price_cents} />
              </td>
              <td>{p.available_quantity}</td>
              <td>
                <ActiveBadge active={p.is_active} />
              </td>
              <td>
                <div className="table-actions">
                  <Link
                    className="icon-button"
                    to={"/admin/productos/" + p.id}
                    aria-label={"Editar " + p.name}
                  >
                    <Pencil size={17} />
                  </Link>
                  <button
                    className="text-button"
                    onClick={async () => {
                      try {
                        await api("/admin/products/" + p.id, {
                          method: "PATCH",
                          body: { version: p.version, isActive: !p.is_active },
                        });
                        s.reload();
                        notify("Estado actualizado");
                      } catch (e) {
                        notify(e.message, "error");
                      }
                    }}
                  >
                    {p.is_active ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </DataState>
    </>
  );
}
