import { NavLink } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../../app/providers.jsx";

export default function AccountNav() {
  const { capabilities } = useAuth();
  if (!capabilities.adminSecurity) return null;
  return <NavLink to="/admin/mi-cuenta/seguridad"><ShieldCheck size={19} />Mi cuenta → Seguridad</NavLink>;
}
