import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { getMergedSidebarForBusiness } from "@/components/sidebars/sidebarModules";
import { cn } from "@/lib/utils";
import {
  canAccessDashboard,
  canAccessPrivileges,
  getUserFunctionalities,
  privilegeKeysForItem,
} from "@/lib/access";

const CAT_META = {
  inventory: {
    label: "Inventory",
    dot: "var(--cat-inventory)",
    tint: "var(--cat-inventory-t)",
  },
  purchase: {
    label: "Purchase",
    dot: "var(--cat-purchase)",
    tint: "var(--cat-purchase-t)",
  },
  sales: {
    label: "Sales",
    dot: "var(--cat-sales)",
    tint: "var(--cat-sales-t)",
  },
  accounts: {
    label: "Accounting",
    dot: "var(--cat-accounts)",
    tint: "var(--cat-accounts-t)",
  },
  reports: {
    label: "Reports",
    dot: "var(--cat-reports)",
    tint: "var(--cat-reports-t)",
  },
  assets: {
    label: "Assets",
    dot: "var(--cat-purchase)",
    tint: "var(--cat-purchase-t)",
  },
  payroll: {
    label: "Payroll",
    dot: "var(--cat-payroll)",
    tint: "var(--cat-payroll-t)",
  },
  admin: {
    label: "Admin",
    dot: "var(--cat-admin)",
    tint: "var(--cat-admin-t)",
  },
  other: {
    label: "More",
    dot: "var(--cat-other)",
    tint: "var(--cat-other-t)",
  },
};

const MODULE_TO_CAT = {
  Inventory: "inventory",
  Purchase: "purchase",
  Sales: "sales",
  Account: "accounts",
  Reports: "reports",
  Payroll: "payroll",
  Admin: "admin",
  "Asset Register": "assets",
  Dashboard: "other",
};

const CAT_ORDER = [
  "inventory",
  "purchase",
  "sales",
  "accounts",
  "reports",
  "assets",
  "payroll",
  "admin",
  "other",
];

function collectGroupedActions(modules, functionalities, user, activeBusiness) {
  const groups = [];
  const seen = new Set();

  for (const mod of modules || []) {
    const catKey = MODULE_TO_CAT[mod.title] || "other";
    const items = [];
    for (const item of mod.items || []) {
      if (!item?.url || item.url === "#") continue;
      if (!canAccessPrivileges(privilegeKeysForItem(item), functionalities)) {
        continue;
      }
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      items.push({
        title: item.title,
        url: item.url,
        icon: mod.icon,
      });
    }
    if ((!mod.items || mod.items.length === 0) && mod.url && mod.url !== "#") {
      const allowed =
        mod.title === "Dashboard"
          ? canAccessDashboard(user, activeBusiness)
          : canAccessPrivileges(privilegeKeysForItem(mod), functionalities);
      if (allowed && !seen.has(mod.url)) {
        seen.add(mod.url);
        items.push({ title: mod.title, url: mod.url, icon: mod.icon });
      }
    }
    if (!items.length) continue;
    const existing = groups.find((g) => g.key === catKey);
    if (existing) {
      existing.items.push(...items);
    } else {
      groups.push({
        key: catKey,
        ...(CAT_META[catKey] || CAT_META.other),
        items,
      });
    }
  }

  return groups.sort(
    (a, b) =>
      CAT_ORDER.indexOf(a.key) - CAT_ORDER.indexOf(b.key),
  );
}

function greetingForNow(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDateTag(date = new Date()) {
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${days[date.getDay()]} · ${String(date.getDate()).padStart(2, "0")} ${months[date.getMonth()]} ${date.getFullYear()} · ${hh}:${mm}`;
}

export default function Home() {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const functionalities = useMemo(
    () => getUserFunctionalities(user, activeBusiness),
    [user, activeBusiness],
  );

  const displayName =
    (user?.firstname && user?.lastname
      ? `${user.firstname} ${user.lastname}`
      : null) ||
    user?.name ||
    user?.email ||
    "User";
  const firstName = String(displayName).split(/\s+/)[0] || displayName;
  const businessName =
    activeBusiness?.business_name ||
    activeBusiness?.businessName ||
    user?.busName ||
    "";

  const linkGroups = useMemo(() => {
    const modules = getMergedSidebarForBusiness(activeBusiness?.business_type)
      .map((module) => {
        if (!module.items?.length) return module;
        return {
          ...module,
          items: module.items.filter((item) => {
            const flag = item.requiresBusinessFlag;
            if (!flag) return true;
            if (flag === "enable_material_requisition") {
              return activeBusiness?.[flag] !== false;
            }
            return !!activeBusiness?.[flag];
          }),
        };
      })
      .filter((module) => !module.items || module.items.length > 0);
    return collectGroupedActions(modules, functionalities, user, activeBusiness);
  }, [activeBusiness, functionalities, user]);

  const chips = useMemo(() => {
    return [
      { key: "all", label: "All", dot: undefined },
      ...linkGroups.map((g) => ({
        key: g.key,
        label: g.label,
        dot: g.dot,
      })),
    ];
  }, [linkGroups]);

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return linkGroups
      .filter((g) => filter === "all" || g.key === filter)
      .map((g) => ({
        ...g,
        items: g.items.filter((item) =>
          !q ? true : String(item.title).toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [linkGroups, filter, query]);

  const totalShown = visibleGroups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="dash-home">
      <div className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-8 sm:py-9">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[var(--dash-primary-dark,#145f47)]">
              Welcome back
            </div>
            <h1 className="font-dash-display text-[28px] font-semibold tracking-[-0.01em] text-[var(--dash-ink,#101B33)] sm:text-[30px]">
              {greetingForNow()}, {firstName}
            </h1>
            <p className="mt-1.5 text-[13.5px] text-[var(--dash-ink-soft,#4B5567)]">
              {businessName
                ? `${businessName} — jump to any page you can use.`
                : "Jump to any page you can use."}
            </p>
          </div>
          <div className="font-dash-mono text-[12.5px] text-[var(--dash-ink-faint,#8992A3)]">
            {formatDateTag()}
          </div>
        </div>

        <div className="ledger-rule" />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-dash-display text-lg font-semibold text-[var(--dash-ink,#101B33)]">
              Quick actions
            </div>
            <div className="mt-0.5 text-[12.5px] text-[var(--dash-ink-faint,#8992A3)]">
              Jump to any page, grouped by where it lives in the business.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={cn("dash-chip", filter === chip.key && "active")}
                style={chip.dot ? { ["--dot"]: chip.dot } : undefined}
                onClick={() => setFilter(chip.key)}
              >
                <span className="swatch" />
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mb-6 max-w-md">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages…"
            className="h-10 w-full rounded-[9px] border border-[var(--dash-line,#E1E1D8)] bg-white px-3 text-[13.5px] text-[var(--dash-ink)] outline-none placeholder:text-[var(--dash-ink-faint)] focus:outline focus:outline-2 focus:outline-[var(--dash-primary)] focus:outline-offset-[-1px]"
            aria-label="Search quick actions"
          />
        </div>

        {totalShown === 0 ? (
          <div className="px-5 py-14 text-center text-[13.5px] text-[var(--dash-ink-faint)]">
            No pages match your search. Try a different word.
          </div>
        ) : (
          <div className="space-y-[30px]">
            {visibleGroups.map((group) => (
              <section key={group.key}>
                <div className="mb-3 flex items-center gap-2.5">
                  <span
                    className="size-[9px] shrink-0 rounded-[2.5px]"
                    style={{ background: group.dot }}
                  />
                  <span className="font-dash-display text-[13.5px] font-semibold text-[var(--dash-ink)]">
                    {group.label}
                  </span>
                  <span className="font-dash-mono rounded-full bg-[var(--dash-paper)] px-1.5 py-px text-[11.5px] text-[var(--dash-ink-faint)]">
                    {group.items.length}
                  </span>
                  <span className="h-px flex-1 bg-[var(--dash-line)]" />
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.url}
                        type="button"
                        className="dash-action-card"
                        style={{
                          ["--dot"]: group.dot,
                          ["--tint"]: group.tint,
                        }}
                        onClick={() => navigate(item.url)}
                      >
                        <span className="dash-action-icon">
                          {Icon ? <Icon className="size-4" /> : null}
                        </span>
                        <span className="text-[13.5px] font-medium leading-snug text-[var(--dash-ink)]">
                          {item.title}
                        </span>
                        <span className="dash-action-arrow">
                          <ArrowUpRight className="size-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
