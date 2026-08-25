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
  Shield,
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
  security: Shield,
};

/**
 * Top category pills + horizontal sub-tabs for Settings.
 */
export default function SettingsNav({
  visibleTabs,
  activeTab,
  onSelect,
  search,
  onSearchChange,
}) {
  const needle = (search || "").trim().toLowerCase();

  const filteredTabs = useMemo(() => {
    if (!needle) return visibleTabs;
    return visibleTabs.filter(
      (tab) =>
        tab.label.toLowerCase().includes(needle) ||
        tab.value.toLowerCase().includes(needle),
    );
  }, [visibleTabs, needle]);

  const grouped = useMemo(() => {
    const byCategory = new Map();
    filteredTabs.forEach((tab) => {
      const cat = tab.category || "other";
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(tab);
    });

    return SETTINGS_CATEGORIES.map((cat) => ({
      ...cat,
      tabs: byCategory.get(cat.id) || [],
    })).filter((cat) => cat.tabs.length > 0);
  }, [filteredTabs]);

  const activeCategoryId =
    visibleTabs.find((t) => t.value === activeTab)?.category ||
    grouped[0]?.id ||
    "";

  const activeGroup =
    grouped.find((g) => g.id === activeCategoryId) || grouped[0] || null;

  const handleCategorySelect = (categoryId) => {
    const group = grouped.find((g) => g.id === categoryId);
    if (!group?.tabs?.length) return;
    const stillInCategory = group.tabs.some((t) => t.value === activeTab);
    if (!stillInCategory) {
      onSelect(group.tabs[0].value);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search settings…"
            className="h-9 border-slate-200 bg-white pl-8 text-sm placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[var(--aa-accent)]"
          />
        </div>
        <p className="hidden text-xs text-slate-400 sm:block">
          {visibleTabs.length} sections
        </p>
      </div>

      {/* Category pills */}
      <div
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin"
        role="tablist"
        aria-label="Settings categories"
      >
        {grouped.length === 0 ? (
          <p className="px-1 py-2 text-xs text-slate-500">
            No settings match your search.
          </p>
        ) : (
          grouped.map((group) => {
            const Icon = CATEGORY_ICONS[group.id] || BookOpen;
            const isActive = group.id === activeCategoryId;
            return (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleCategorySelect(group.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-[var(--aa-navy)] text-white shadow-sm"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-[var(--aa-sidebar-active)] hover:text-[var(--aa-navy)]"
                }`}
              >
                <Icon className="h-3.5 w-3.5 opacity-90" />
                {group.label}
              </button>
            );
          })
        )}
      </div>

      {/* Sub-tabs for active category */}
      {activeGroup && activeGroup.tabs.length > 0 && (
        <div
          className="-mx-1 flex gap-0 overflow-x-auto border-b border-slate-200 px-1"
          role="tablist"
          aria-label={`${activeGroup.label} settings`}
        >
          {activeGroup.tabs.map((tab) => {
            const isActive = tab.value === activeTab;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelect(tab.value)}
                className={`-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-[var(--aa-navy)] text-[var(--aa-navy)]"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-[var(--aa-navy)]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SettingsContentHeader({
  activeLabel,
  categoryLabel,
  categoryId,
}) {
  const Icon = CATEGORY_ICONS[categoryId] || BookOpen;

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--aa-navy)] text-white">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        {categoryLabel && (
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 leading-tight">
            {categoryLabel}
          </p>
        )}
        <h3 className="truncate text-base font-semibold text-slate-900 leading-tight sm:text-lg">
          {activeLabel}
        </h3>
      </div>
    </div>
  );
}
