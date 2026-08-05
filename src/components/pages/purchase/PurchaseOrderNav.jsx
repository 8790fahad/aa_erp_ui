import { NavLink, useLocation } from "react-router-dom";

const TABS = [
  {
    id: "create",
    label: "Create",
    to: "/app/purchase/purchase-requisition",
    match: (pathname, search) =>
      pathname.startsWith("/app/purchase/purchase-requisition") &&
      !new URLSearchParams(search).get("tab"),
  },
  {
    id: "approve",
    label: "Approve",
    to: "/app/purchase/requisition-approval",
    match: (pathname) =>
      pathname.startsWith("/app/purchase/requisition-approval"),
  },
  {
    id: "history",
    label: "History",
    to: "/app/purchase/purchase-requisition?tab=history",
    match: (pathname, search) =>
      pathname.startsWith("/app/purchase/purchase-requisition") &&
      new URLSearchParams(search).get("tab") === "history",
  },
];

export default function PurchaseOrderNav() {
  const { pathname, search } = useLocation();

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-4">
      {TABS.map((tab) => {
        const active = tab.match(pathname, search);
        return (
          <NavLink
            key={tab.id}
            to={tab.to}
            end={tab.id === "create"}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-[var(--aa-accent)] text-[var(--aa-accent)]"
                : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
