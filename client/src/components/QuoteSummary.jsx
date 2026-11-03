import Price from "./Price.jsx";
export default function QuoteSummary({ quote }) {
  return (
    <div className="quote-summary">
      <h2>Revisa tu pedido</h2>
      {quote.items.map((i) => (
        <div className="quote-line" key={i.product_id}>
          <span>
            {i.name}
            <small>
              {i.quantity} unidad(es) × <Price amount={i.unit_price_cents} />
            </small>
          </span>
          <Price amount={i.line_total_cents} />
        </div>
      ))}
      <div className="summary-total">
        <b>Total</b>
        <Price amount={quote.total_cents} />
      </div>
      <p className="muted">
        Resumen válido por 5 minutos. Los precios y el stock se vuelven a
        comprobar al confirmar.
      </p>
    </div>
  );
}
