import { useSelector } from "react-redux";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/app/crm", end: true, label: "Dashboard" },
  { to: "/app/crm/customers", label: "Customers" },
  { to: "/app/crm/activities", label: "Activities" },
  { to: "/app/crm/followups", label: "Follow-ups" },
  { to: "/app/crm/segments", label: "Segments" },
  { to: "/app/crm/sms", label: "Outreach" },
  { to: "/app/crm/templates", label: "Templates" },
  { to: "/app/crm/settings", label: "Settings" },
];

export function useCrmFacilityId() {
  const activeBusiness = useSelector(
    (s) => s.auth?.activeBusiness || s.auth?.user?.activeBusiness,
  );
  return activeBusiness?.id;
}

export function formatNaira(n) {
  return `₦${Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export const CRM_STATUSES = [
  "New",
  "Active",
  "Regular",
  "VIP",
  "Dormant",
  "Inactive",
  "Lost",
];

export function statusBadgeClass(status) {
  const map = {
    New: "bg-sky-50 text-sky-800 border-sky-200",
    Active: "bg-emerald-50 text-emerald-800 border-emerald-200",
    Regular: "bg-blue-50 text-blue-800 border-blue-200",
    VIP: "bg-amber-50 text-amber-900 border-amber-200",
    Dormant: "bg-orange-50 text-orange-800 border-orange-200",
    Inactive: "bg-slate-100 text-slate-700 border-slate-200",
    Lost: "bg-rose-50 text-rose-800 border-rose-200",
  };
  return map[status] || "bg-slate-50 text-slate-700 border-slate-200";
}

export default function CrmLayout() {
  const location = useLocation();
  const is360 = /\/crm\/customers\/[^/]+$/.test(location.pathname);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef2f9] via-white to-white">
      <div className="border-b border-[#1a2d5e]/10 bg-white/80 backdrop-blur-sm">
        <div className="px-4 pt-5 pb-3 md:px-6">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--aa-navy)]">
              Customer Retention
            </p>
            <h1 className="text-2xl font-semibold text-[#1a2d5e]">CRM</h1>
            <p className="text-sm text-slate-500">
              Track customers, follow-ups, segments, and outreach from your
              existing sales history.
            </p>
          </div>
          {!is360 && (
            <nav className="mt-4 flex gap-1 overflow-x-auto pb-1">
              {TABS.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    cn(
                      "whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-[#1a2d5e] text-white"
                        : "text-slate-600 hover:bg-[#1a2d5e]/8 hover:text-[#1a2d5e]",
                    )
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>
      </div>
      <div className="px-4 py-5 md:px-6">
        <Outlet />
      </div>
    </div>
  );
}
