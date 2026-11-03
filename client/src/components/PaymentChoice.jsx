import { useState } from "react";
import { ShieldCheck } from "lucide-react";
export default function PaymentChoice({ onConfirm, busy, error }) {
  const [outcome, setOutcome] = useState("");
  return (
    <section className="payment-choice">
      <div className="demo-alert">
        <ShieldCheck size={21} />
        <div>
          <b>Pago de demostración</b>
          <p>
            No se realizará ningún cobro. Elige un resultado para probar el
            proceso.
          </p>
        </div>
      </div>
      <label
        className={
          "payment-option " + (outcome === "APPROVED" ? "selected" : "")
        }
      >
        <input
          type="radio"
          name="payment"
          value="APPROVED"
          checked={outcome === "APPROVED"}
          onChange={(e) => setOutcome(e.target.value)}
        />
        <span>
          <b>Aprobar pago simulado</b>
          <small>Confirma el pedido y actualiza el stock.</small>
        </span>
        <span>✓</span>
      </label>
      <label
        className={
          "payment-option " + (outcome === "REJECTED" ? "selected" : "")
        }
      >
        <input
          type="radio"
          name="payment"
          value="REJECTED"
          checked={outcome === "REJECTED"}
          onChange={(e) => setOutcome(e.target.value)}
        />
        <span>
          <b>Rechazar pago simulado</b>
          <small>Registra el intento y conserva el stock.</small>
        </span>
        <span>×</span>
      </label>
      {error && (
        <div className="form-error" role="alert">
          {error.message}
        </div>
      )}
      <button
        className="btn large wide"
        onClick={() => onConfirm(outcome)}
        disabled={!outcome || busy}
      >
        {busy ? "Registrando pedido…" : "Confirmar simulación"}
      </button>
    </section>
  );
}
