import { NavLink, useLocation } from "react-router-dom";

const TABS = [
  {
    id: "create",
    label: "Create",
    to: "/app/account/initiate-memo",
    match: (pathname, search) =>
      pathname.startsWith("/app/account/initiate-memo") &&
      !new URLSearchParams(search).get("tab"),
  },
  {
    id: "approve",
    label: "Approve",
    to: "/app/account/administrative-review",
    match: (pathname) =>
      pathname.startsWith("/app/account/administrative-review") ||
      pathname.startsWith("/app/account/approval"),
  },
  {
    id: "history",
    label: "History",
    to: "/app/account/initiate-memo?tab=history",
    match: (pathname, search) =>
      pathname.startsWith("/app/account/initiate-memo") &&
      new URLSearchParams(search).get("tab") === "history",
  },
];

/** Kept for imports; single-approval flow no longer shows Internal Audit / Admin stages. */
export function MemoApproveStageNav() {
  return null;
}

export default function MemoNav() {
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
                ? "border-[var(--aa-navy,#0f2744)] text-[var(--aa-navy,#0f2744)]"
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
