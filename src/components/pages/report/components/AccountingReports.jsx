import { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { _fetchApi } from "@/redux/actions/api";
import { ACCOUNTING_REPORT_SECTIONS } from "../utils/accountingReportCatalog";
import {
  SUMMARY_PRESENTATION,
  SUMMARY_PRESENTATION_LABELS,
  normalizeSummaryPresentation,
} from "./AccountLedgerReportView";
import ReportHubSection, {
  filterReportItemsByPermission,
} from "./ReportHubSection";
import { useReportPermissions } from "../hooks/useReportPermissions";
import {
  Landmark,
  Users,
  Truck,
  Building2,
  Package,
  Factory,
  LayoutTemplate,
} from "lucide-react";

/** @typedef {{ title: string; description: string; path?: string; dateMode?: 'range' | 'asOf'; external?: boolean; permission?: string }} ReportItem */

/** @typedef {{ id: string; title: string; subtitle: string; icon: typeof Landmark; items: ReportItem[] }} ReportSectionDef */

const SECTION_ICON_BY_ID = {
  core: Landmark,
  receivables: Users,
  payables: Truck,
  bank: Building2,
  inventory: Package,
  production: Factory,
  custom: LayoutTemplate,
};

function itemMatchesQuery(item, needle) {
  if (!needle) return true;
  const hay = `${item.title || ""} ${item.description || ""}`.toLowerCase();
  if (hay.includes(needle)) return true;
  if (Array.isArray(item.children)) {
    return item.children.some((child) => itemMatchesQuery(child, needle));
  }
  return false;
}

function filterItemsByQuery(items, needle) {
  if (!needle) return items || [];
  return (items || []).reduce((acc, item) => {
    if (Array.isArray(item.children) && item.children.length > 0) {
      const children = item.children.filter((child) =>
        itemMatchesQuery(child, needle),
      );
      const selfMatch = itemMatchesQuery(
        { ...item, children: undefined },
        needle,
      );
      if (!selfMatch && children.length === 0) return acc;
      acc.push({
        ...item,
        children: selfMatch ? item.children : children,
      });
      return acc;
    }
    if (itemMatchesQuery(item, needle)) acc.push(item);
    return acc;
  }, []);
}

const AccountingReports = () => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const { canViewReportEntry } = useReportPermissions();
  const navigate = useNavigate();
  const facilityId = activeBusiness?.id || user?.facilityId || "";

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [asOfDate, setAsOfDate] = useState("");
  const [savedReportRows, setSavedReportRows] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const currentYear = new Date().getFullYear();
    setFromDate(`${currentYear}-01-01`);
    setToDate(today);
    setAsOfDate(today);
  }, []);

  useEffect(() => {
    if (!facilityId) return;
    _fetchApi(
      `/account/saved-reports/${facilityId}`,
      (res) => {
        if (res.success && Array.isArray(res.results)) {
          setSavedReportRows(res.results);
        }
      },
      () => {},
    );
  }, [facilityId]);

  const reportSections = useMemo(() => {
    const customItems = savedReportRows.map((row) => {
      const codes = Array.isArray(row.account_codes)
        ? row.account_codes
        : [];
      const params = new URLSearchParams();
      params.set("accounts", codes.join(","));
      if (row.report_name) params.set("name", row.report_name);
      if (row.report_type === "summary") {
        params.set("reportType", "summary");
        const presentation =
          normalizeSummaryPresentation(row.summary_presentation) ||
          (row.only_children
            ? SUMMARY_PRESENTATION.BREAKDOWN
            : SUMMARY_PRESENTATION.HEAD);
        params.set("presentation", presentation);
        if (presentation !== SUMMARY_PRESENTATION.HEAD) {
          params.set("onlyChildren", "1");
        }
      } else if (row.only_children) {
        params.set("onlyChildren", "1");
      }
      const presentationLabel =
        row.report_type === "summary"
          ? SUMMARY_PRESENTATION_LABELS[
              normalizeSummaryPresentation(row.summary_presentation) ||
                (row.only_children
                  ? SUMMARY_PRESENTATION.BREAKDOWN
                  : SUMMARY_PRESENTATION.HEAD)
            ]
          : row.only_children
            ? "Only children"
            : null;
      const opts = [
        presentationLabel,
        row.report_type === "summary" ? "Summary" : "Full",
        codes.length ? `${codes.length} account(s)` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        title: row.report_name || "Saved report",
        description: opts || "Saved ledger setup",
        path: `/app/reports/accounting-reports/custom-reports?${params.toString()}`,
        dateMode: "range",
        external: false,
      };
    });
    const sections = ACCOUNTING_REPORT_SECTIONS.map((section) => ({
      ...section,
      icon: SECTION_ICON_BY_ID[section.id] || Landmark,
    }));
    /** Section lists rows from SavedReport (table saved_reports). */
    if (customItems.length > 0) {
      sections.push({
        id: "custom",
        title: "9. Custom Reports (Saved)",
        subtitle: "Saved report runs from saved_reports table",
        icon: LayoutTemplate,
        items: customItems,
      });
    }
    return sections
      .map((section) => ({
        ...section,
        items: filterReportItemsByPermission(section.items, canViewReportEntry),
      }))
      .filter((section) => (section.items || []).length > 0);
  }, [savedReportRows, canViewReportEntry]);

  const filteredSections = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return reportSections;
    return reportSections
      .map((section) => ({
        ...section,
        items: filterItemsByQuery(section.items, needle),
      }))
      .filter((section) => (section.items || []).length > 0);
  }, [reportSections, search]);

  const navState = (mode) => {
    if (mode === "range") return { fromDate, toDate };
    if (mode === "asOf") return { asOfDate };
    return { fromDate, toDate, asOfDate };
  };

  const go = (path, mode) => {
    navigate(path, { state: navState(mode) });
  };

  if (!facilityId) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-[var(--aa-navy,#1a2d5e)]">
          Facility required
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Select a business / facility to use accounting reports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="rounded-xl border border-slate-200/80 bg-gradient-to-br from-[var(--aa-sidebar-active,#e8f1fc)]/70 via-white to-white px-5 py-5 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--aa-navy,#1a2d5e)]">
          Accounting Reports
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Open a report to set dates on that screen. Linked reports use sensible
          defaults (e.g. year to date) when none were chosen.
        </p>

        <div className="relative mt-4 max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a report…"
            className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-[var(--aa-accent,#2c7be5)] focus:ring-1 focus:ring-[var(--aa-accent,#2c7be5)]"
            aria-label="Find a report"
          />
        </div>
      </div>

      {filteredSections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">No reports match</p>
          <p className="mt-1 text-xs text-slate-500">
            Try another search term, or clear the filter.
          </p>
          {search.trim() ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-3 text-sm font-medium text-[var(--aa-accent,#2c7be5)] hover:underline"
            >
              Clear search
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          {filteredSections.map((section) => (
            <ReportHubSection
              key={section.id}
              section={section}
              onNavigate={(item) =>
                item.path && go(item.path, item.dateMode || "range")
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AccountingReports;
