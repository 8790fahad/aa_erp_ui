import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      className={`w-full text-left flex items-start gap-3 transition-colors group ${
        nested ? "px-4 py-3" : "px-4 py-3.5"
      } ${clickable ? "hover:bg-slate-50/80 cursor-pointer" : "cursor-default bg-slate-50/40"}`}
      onClick={() => clickable && onNavigate(item)}
    >
      <ChevronRight
        className={`h-5 w-5 shrink-0 mt-0.5 ${
          nested
            ? "text-slate-300 group-hover:text-blue-600"
            : "text-slate-400 group-hover:text-blue-600"
        }`}
      />
      <div className="flex-1 min-w-0">
        <div
          className={`${
            nested
              ? "text-sm font-medium text-slate-800 group-hover:text-blue-900"
              : "font-medium text-slate-900 group-hover:text-blue-900"
          }`}
        >
          {item.title}
        </div>
        {item.description && (
          <div className="text-sm text-slate-600 mt-0.5">{item.description}</div>
        )}
        {item.path && (
          <div className="text-xs text-slate-400 mt-1 font-mono truncate">
            {item.path}
          </div>
        )}
      </div>
    </button>
  );
}

export default function ReportHubSection({ section, onNavigate }) {
  const { canViewReportEntry } = useReportPermissions();
  const Icon = section.icon;

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="bg-slate-50 border-b py-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-white border p-2 shadow-sm">
            {Icon && <Icon className="h-6 w-6 text-blue-800" />}
          </div>
          <div>
            <CardTitle className="text-lg text-slate-900">{section.title}</CardTitle>
            {section.subtitle && (
              <p className="text-sm text-slate-600 mt-0.5">{section.subtitle}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-slate-100">
          {section.items.map((item, itemIdx) => {
            const hasChildren =
              Array.isArray(item.children) && item.children.length > 0;

            if (hasChildren) {
              const visibleChildren = item.children.filter((child) =>
                canViewReportEntry(child),
              );
              const showGroup = canViewReportEntry(item) || visibleChildren.length > 0;
              if (!showGroup) return null;

              return (
                <li key={`${section.id}-group-${itemIdx}`}>
                  <ReportRow
                    item={item}
                    onNavigate={onNavigate}
                    visible={canViewReportEntry(item)}
                  />
                  {visibleChildren.length > 0 && (
                    <ul className="border-t border-slate-100 bg-white">
                      {visibleChildren.map((child, childIdx) => (
                        <li
                          key={`${section.id}-${itemIdx}-${childIdx}-${child.title}`}
                          className="border-t border-slate-50 first:border-t-0"
                        >
                          <div className="ml-4 border-l border-slate-200">
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
                  )}
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
      </CardContent>
    </Card>
  );
}

// re-export for pages that pre-filter sections
export { getReportPermissionKey };
