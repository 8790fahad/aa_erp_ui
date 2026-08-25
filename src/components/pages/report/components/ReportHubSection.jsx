import { Eye } from "lucide-react";
import { getReportPermissionKey } from "../utils/accountingReportCatalog";
import { useReportPermissions } from "../hooks/useReportPermissions";

/** Filter items using merged functionalities (GoodsTransfer-style). */
export function filterReportItemsByPermission(items, canViewReportEntry) {
  return (items || []).reduce((acc, item) => {
    if (Array.isArray(item.children) && item.children.length > 0) {
      const visibleChildren = item.children.filter((child) =>
        canViewReportEntry(child),
      );
      const canSeeGroup = canViewReportEntry(item);
      if (!canSeeGroup && visibleChildren.length === 0) return acc;
      acc.push({ ...item, children: visibleChildren });
      return acc;
    }
    if (!canViewReportEntry(item)) return acc;
    acc.push(item);
    return acc;
  }, []);
}

function ReportRow({ item, onNavigate, nested = false, visible = true }) {
  if (!visible) return null;

  const clickable = Boolean(item.path);
  return (
    <button
      type="button"
      disabled={!clickable}
      className={`group flex w-full items-start gap-3 text-left transition-colors ${
        nested ? "px-4 py-2.5 pl-6" : "px-4 py-3"
      } ${
        clickable
          ? "cursor-pointer hover:bg-[var(--aa-sidebar-active,#e8f1fc)]"
          : "cursor-default bg-slate-50/50"
      }`}
      onClick={() => clickable && onNavigate(item)}
    >
      <div className="min-w-0 flex-1">
        <div
          className={`${
            nested
              ? "text-sm font-medium text-slate-800"
              : "text-sm font-semibold text-slate-900"
          } group-hover:text-[var(--aa-navy,#1a2d5e)]`}
        >
          {item.title}
        </div>
        {item.description ? (
          <p className="mt-0.5 text-[13px] leading-snug text-slate-500 line-clamp-2">
            {item.description}
          </p>
        ) : null}
      </div>
      {clickable ? (
        <Eye
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-[var(--aa-accent,#2c7be5)]"
          aria-hidden
        />
      ) : null}
    </button>
  );
}

export default function ReportHubSection({ section, onNavigate }) {
  const { canViewReportEntry } = useReportPermissions();
  const Icon = section.icon;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white">
      <header className="flex items-start gap-3 border-b border-slate-100 border-l-4 border-l-[var(--aa-navy,#1a2d5e)] bg-[var(--aa-sidebar-bg,#f3f4f7)]/80 px-4 py-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--aa-navy,#1a2d5e)]/10 text-[var(--aa-navy,#1a2d5e)]">
          {Icon ? <Icon className="h-[18px] w-[18px]" /> : null}
        </div>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-base font-semibold leading-tight text-[var(--aa-navy,#1a2d5e)]">
            {section.title}
          </h2>
          {section.subtitle ? (
            <p className="mt-0.5 text-xs text-slate-500">{section.subtitle}</p>
          ) : null}
        </div>
      </header>

      <ul className="divide-y divide-slate-100">
        {section.items.map((item, itemIdx) => {
          const hasChildren =
            Array.isArray(item.children) && item.children.length > 0;

          if (hasChildren) {
            const visibleChildren = item.children.filter((child) =>
              canViewReportEntry(child),
            );
            const showGroup =
              canViewReportEntry(item) || visibleChildren.length > 0;
            if (!showGroup) return null;

            return (
              <li key={`${section.id}-group-${itemIdx}`}>
                <ReportRow
                  item={item}
                  onNavigate={onNavigate}
                  visible={canViewReportEntry(item)}
                />
                {visibleChildren.length > 0 ? (
                  <ul className="border-t border-slate-100 bg-white">
                    {visibleChildren.map((child, childIdx) => (
                      <li
                        key={`${section.id}-${itemIdx}-${childIdx}-${child.title}`}
                        className="border-t border-slate-50 first:border-t-0"
                      >
                        <div className="ml-3 border-l-2 border-[var(--aa-navy,#1a2d5e)]/15">
                          <ReportRow
                            item={child}
                            onNavigate={onNavigate}
                            nested
                            visible
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          }

          if (!canViewReportEntry(item)) return null;

          return (
            <li key={`${section.id}-${itemIdx}-${item.title}`}>
              <ReportRow item={item} onNavigate={onNavigate} visible />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// re-export for pages that pre-filter sections
export { getReportPermissionKey };
