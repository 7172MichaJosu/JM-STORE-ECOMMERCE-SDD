import { Check } from "lucide-react";
export const statusLabels = {
  AWAITING_PAYMENT: "Pendiente de pago",
  CONFIRMED: "Confirmado",
  PREPARING: "Preparando",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
};
export default function OrderTimeline({ history = [] }) {
  return (
    <ol className="order-timeline">
      {history.map((h, i) => (
        <li key={i}>
          <span>
            <Check size={14} />
          </span>
          <div>
            <b>{statusLabels[h.toStatus]}</b>
            <small>
              {new Date(h.createdAt).toLocaleString("es-PE", {
                timeZone: "America/Lima",
              })}
            </small>
          </div>
        </li>
      ))}
    </ol>
  );
}
