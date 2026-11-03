import { Link } from "react-router-dom";
import { ShieldCheck, WalletCards, Package, Settings } from "lucide-react";
export default function Footer() {
  return (
    <footer className="footer container">
      <div className="trust-strip">
        <span>
          <WalletCards />
          <div>
            <b>Pago de demostración</b>
            <small>Sin cobros reales</small>
          </div>
        </span>
        <span>
          <ShieldCheck />
          <div>
            <b>Acceso protegido</b>
            <small>Tus datos en tu cuenta</small>
          </div>
        </span>
        <span>
          <Package />
          <div>
            <b>Consulta tus pedidos</b>
            <small>Historial y estados visibles</small>
          </div>
        </span>
        <Link to="/admin/ingresar">
          <Settings />
          <b>Acceso administrador</b>
          <span>↗</span>
        </Link>
      </div>
      <div className="footer-bottom">
        <b>
          JM-STORE<span> · Hecho para tu día a día.</span>
        </b>
        <span>Proyecto de examen · Imágenes referenciales · Moneda S/</span>
      </div>
    </footer>
  );
}
