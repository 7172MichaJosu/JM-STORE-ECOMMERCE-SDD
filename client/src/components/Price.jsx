export const money = (n) =>
  "S/ " +
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((n || 0) / 100);
export default function Price({ amount, className = "" }) {
  return <span className={"price " + className}>{money(amount)}</span>;
}
