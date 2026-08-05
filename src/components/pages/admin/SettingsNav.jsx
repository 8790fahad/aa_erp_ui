import { useMemo } from "react";
import {
  Search,
  BookOpen,
  Package,
  Tag,
  Landmark,
  Building2,
  ShoppingBag,
  ClipboardEdit,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { SETTINGS_CATEGORIES } from "./settingsTabs";

const CATEGORY_ICONS = {
  accounts: BookOpen,
  inventory: Package,
  pricing: Tag,
  banking: Landmark,
  organization: Building2,
  store: ShoppingBag,
  corrections: ClipboardEdit,
};

const CATEGORY_COLORS = {
  accounts: "text-indigo-500",
  inventory: "text-emerald-500",
  pricing: "text-orange-500",
  banking: "text-blue-500",
  organization: "text-purple-500",
  store: "text-pink-500",
  corrections: "text-rose-500",
};

const CATEGORY_BG = {
  accounts: "bg-indigo-50",
  inventory: "bg-emerald-50",
  pricing: "bg-orange-50",
  banking: "bg-blue-50",
  organization: "bg-purple-50",
  store: "bg-pink-50",
  corrections: "bg-rose-50",
};

export default function SettingsNav({
  visibleTabs,
  activeTab,
  onSelect,
  search,
  onSearchChange,
}) {
  const grouped = useMemo(() => {
    const needle = (search || "").trim().toLowerCase();
    const filtered = needle
      ? visibleTabs.filter(
          (tab) =>
            tab.label.toLowerCase().includes(needle) ||
            tab.value.toLowerCase().includes(needle)
        )
      : visibleTabs;

    const byCategory = new Map();
    filtered.forEach((tab) => {
      const cat = tab.category || "other";
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(tab);
    });

    return SETTINGS_CATEGORIES.map((cat) => ({
      ...cat,
      tabs: byCategory.get(cat.id) || [],
    })).filter((cat) => cat.tabs.length > 0);
  }, [visibleTabs, search]);

  return (
    <aside
      className="flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm
                 lg:sticky lg:top-4 lg:self-start lg:h-[calc(100vh-6rem)] lg:max-h-[calc(100vh-6rem)] overflow-hidden"
    >
      {/* header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-[#4267B2] flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-white">
              <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-slate-800 leading-tight">
              Settings
            </p>
            <p className="text-[11px] text-slate-400 leading-tight">
              {visibleTabs.length} sections
            </p>
          </div>
        </div>

        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search settings…"
            className="h-8 pl-8 text-xs bg-slate-50 border-slate-200 rounded-lg
                       placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-300"
          />
        </div>
      </div>

      {/* nav list — native scroll so long sections stay reachable */}
      <nav
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-1 max-h-[min(54vh,calc(100vh-12rem))] lg:max-h-none"
        aria-label="Settings sections"
      >
          {grouped.length === 0 ? (
            <p className="px-2 py-6 text-xs text-center text-slate-500">
              No settings match your search.
            </p>
          ) : (
            grouped.map((group, gi) => {
              const Icon = CATEGORY_ICONS[group.id] || BookOpen;
              const iconColor = CATEGORY_COLORS[group.id] || "text-slate-500";
              const iconBg = CATEGORY_BG[group.id] || "bg-slate-50";

              return (
                <div key={group.id} className={gi > 0 ? "pt-1" : ""}>
                  {/* category header */}
                  <div className="flex items-center gap-1.5 px-2 pt-1 pb-1.5">
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${iconBg}`}
                    >
                      <Icon className={`w-3 h-3 ${iconColor}`} />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {group.label}
                    </span>
                  </div>

                  {/* tab buttons */}
                  <ul className="space-y-0.5 pl-1">
                    {group.tabs.map((tab) => {
                      const isActive = tab.value === activeTab;
                      return (
                        <li key={tab.value}>
                          <button
                            type="button"
                            onClick={() => onSelect(tab.value)}
                            className={`group w-full flex items-center justify-between rounded-lg px-3 py-1.5
                                        text-left text-[13px] transition-all duration-150 ${
                              isActive
                                ? "bg-[#4267B2] text-white font-medium shadow-sm"
                                : "text-slate-600 hover:bg-[#4267B2]/10 hover:text-[#4267B2]"
                            }`}
                          >
                            <span className="leading-snug">{tab.label}</span>
                            {isActive && (
                              <ChevronRight className="h-3 w-3 opacity-70 flex-shrink-0" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {gi < grouped.length - 1 && (
                    <div className="mt-2 border-b border-slate-100" />
                  )}
                </div>
              );
            })
          )}
      </nav>
    </aside>
  );
}

export function SettingsContentHeader({ activeLabel, categoryLabel, categoryId }) {
  const Icon = CATEGORY_ICONS[categoryId] || null;
  const iconColor = CATEGORY_COLORS[categoryId] || "text-slate-500";
  const iconBg = CATEGORY_BG[categoryId] || "bg-slate-50";

  return (
    <div className="mb-4 flex items-center gap-3 px-1">
      {Icon && (
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      )}
      <div>
        {categoryLabel && (
          <p className="text-[11px] text-slate-400 uppercase tracking-wide font-medium leading-tight mb-0.5">
            {categoryLabel}
          </p>
        )}
        <h3 className="text-[17px] font-semibold text-slate-800 leading-tight">
          {activeLabel}
        </h3>
      </div>
    </div>
  );
}
