import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Save, ImagePlus } from "lucide-react";
import { useData } from "../app/hooks.js";
import { useToast } from "../app/providers.jsx";
import { api } from "./adminApi.js";
import { PageTitle } from "./shared.jsx";
import { Loading } from "../components/EmptyState.jsx";
const initial = {
  name: "",
  sku: "",
  slug: "",
  description: "",
  basePrice: "",
  categoryId: "1",
  initialStock: "0",
  isActive: true,
  isFeatured: false,
};
export default function AdminProductFormPage() {
  const { id } = useParams(),
    s = useData(id ? "/admin/products?pageSize=100" : null),
    cats = useData("/admin/categories?pageSize=100"),
    library = useData("/admin/image-library"),
    [form, setForm] = useState(initial),
    [images, setImages] = useState([]),
    [version, setVersion] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    notify = useToast();
  useEffect(() => {
    const p = s.data?.find((x) => x.id === Number(id));
    if (p) {
      setForm({
        name: p.name,
        sku: p.sku,
        slug: p.slug,
        description: p.description,
        basePrice: (p.base_price_cents / 100).toFixed(2),
        categoryId: String(p.category_id),
        initialStock: String(p.quantity),
        isActive: !!p.is_active,
        isFeatured: !!p.is_featured,
      });
      setImages(
        p.images.map((i) => ({
          path: i.path,
          alt: i.alt,
          position: i.position,
        })),
      );
      setVersion(p.version);
    }
  }, [s.data, id]);
  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        name: form.name,
        sku: form.sku,
        slug: form.slug,
        description: form.description,
        categoryId: Number(form.categoryId),
        basePriceCents: Math.round(Number(form.basePrice) * 100),
        isActive: form.isActive,
        isFeatured: form.isFeatured,
      };
      if (id) {
        const p = await api("/admin/products/" + id, {
          method: "PATCH",
          body: { ...body, version },
        });
        const result = await api("/admin/products/" + id + "/images", {
          method: "PUT",
          body: {
            version: p.version,
            images: images.map((x, i) => ({ ...x, position: i })),
          },
        });
        setVersion(result.version);
      } else {
        await api("/admin/products", {
          method: "POST",
          body: {
            ...body,
            initialStock: Number(form.initialStock),
            images: images.map((x, i) => ({ ...x, position: i })),
          },
        });
        setForm(initial);
        setImages([]);
      }
      notify("Producto guardado");
    } catch (e) {
      setError(
        e.message + (e.fields ? " " + Object.values(e.fields).join(" ") : ""),
      );
    } finally {
      setBusy(false);
    }
  }
  if (id && s.loading) return <Loading />;
  return (
    <>
      <Link className="text-link" to="/admin/productos">
        ← Volver a productos
      </Link>
      <PageTitle
        title={id ? "Editar producto" : "Nuevo producto"}
        description="La información se publica en tu tienda según su estado."
      />
      <form className="panel admin-form" onSubmit={save}>
        <h2>Información del producto</h2>
        <div className="form-grid">
          <label>
            Nombre del producto
            <input
              required
              minLength={2}
              maxLength={120}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </label>
          <label>
            Categoría
            <select
              aria-label="Categoría"
              value={form.categoryId}
              onChange={(e) => update("categoryId", e.target.value)}
            >
              {cats.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.is_active ? "" : " (inactiva)"}
                </option>
              ))}
            </select>
          </label>
          <label>
            SKU
            <input
              required
              maxLength={64}
              value={form.sku}
              onChange={(e) => update("sku", e.target.value)}
            />
          </label>
          <label>
            Slug
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={form.slug}
              onChange={(e) => update("slug", e.target.value)}
              placeholder="producto-generico"
            />
          </label>
        </div>
        <label>
          Descripción
          <textarea
            required
            maxLength={4000}
            rows={4}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Precio (S/)
            <input
              type="number"
              min="0.01"
              max="1000000"
              step="0.01"
              required
              value={form.basePrice}
              onChange={(e) => update("basePrice", e.target.value)}
            />
          </label>
          {!id && (
            <label>
              Stock inicial
              <input
                required
                type="number"
                min="0"
                max="1000000"
                value={form.initialStock}
                onChange={(e) => update("initialStock", e.target.value)}
              />
            </label>
          )}
        </div>
        {id && (
          <Link className="text-link" to="/admin/inventario">
            Ajustar stock con motivo e historial →
          </Link>
        )}
        <div className="button-row">
          <label className="check-label">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => update("isActive", e.target.checked)}
            />
            Publicar producto
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => update("isFeatured", e.target.checked)}
            />
            Producto destacado
          </label>
        </div>
        <h2>
          <ImagePlus size={20} />
          Imágenes de biblioteca <small>({images.length}/4)</small>
        </h2>
        <p className="muted">
          Selecciona fotografías referenciales autorizadas. Puedes quitar,
          ordenar y editar su texto alternativo.
        </p>
        <div className="image-library">
          {library.data?.map((i) => (
            <button
              type="button"
              key={i.path}
              className={
                images.some((x) => x.path === i.path) ? "selected" : ""
              }
              aria-label={"Seleccionar " + i.alt}
              aria-pressed={images.some((x) => x.path === i.path)}
              onClick={() =>
                setImages((old) =>
                  old.some((x) => x.path === i.path)
                    ? old.filter((x) => x.path !== i.path)
                    : old.length < 4
                      ? [
                          ...old,
                          { path: i.path, alt: i.alt, position: old.length },
                        ]
                      : old,
                )
              }
            >
              <img src={i.path} alt={i.alt} />
            </button>
          ))}
        </div>
        {images.map((i, index) => (
          <div className="image-edit-row" key={i.path}>
            <label>
              Texto alternativo {index + 1}
              <input
                required
                value={i.alt}
                onChange={(e) =>
                  setImages((old) =>
                    old.map((x, n) =>
                      n === index ? { ...x, alt: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              className="btn secondary"
              disabled={index === 0}
              onClick={() =>
                setImages((old) => {
                  const copy = [...old];
                  [copy[index - 1], copy[index]] = [
                    copy[index],
                    copy[index - 1],
                  ];
                  return copy;
                })
              }
            >
              Subir posición
            </button>
          </div>
        ))}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button className="btn large" disabled={busy}>
          <Save size={18} />
          {busy ? "Guardando…" : "Guardar producto"}
        </button>
      </form>
    </>
  );
}
