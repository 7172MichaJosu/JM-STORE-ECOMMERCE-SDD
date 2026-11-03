import { Loading, ErrorState } from "../components/EmptyState.jsx";
export function DataState({ state, children }) {
  if (state.loading) return <Loading />;
  if (state.error)
    return <ErrorState error={state.error} retry={state.reload} />;
  return children;
}
export function Table({ head, children, label = "Datos administrativos" }) {
  return (
    <div
      className="table-wrap panel"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th scope="col" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function PageTitle({ title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export const ActiveBadge = ({ active }) => (
  <span className={"badge " + (active ? "green" : "gray")}>
    {active ? "Activo" : "Inactivo"}
  </span>
);
