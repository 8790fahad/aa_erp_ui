import { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const AccountingReports = () => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const { canViewReportEntry } = useReportPermissions();
  const navigate = useNavigate();
  const facilityId = activeBusiness?.id || user?.facilityId || "";

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [asOfDate, setAsOfDate] = useState("");
  const [savedReportRows, setSavedReportRows] = useState([]);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle>Facility required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Select a business / facility to use accounting reports.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Accounting Reports</h1>
        <p className="text-gray-600 mt-1 max-w-3xl">
          Generate financial and tax compliance reports. Open a report to set
          dates on that screen. Linked reports use sensible defaults (e.g. year
          to date) when none were chosen.
        </p>
      </div>

      {/* Up to 13 sections — Custom appears only when accounting_custom_reports has rows */}
      <div className="space-y-6">
        {reportSections.map((section) => (
          <ReportHubSection
            key={section.id}
            section={section}
            onNavigate={(item) =>
              item.path && go(item.path, item.dateMode || "range")
            }
          />
        ))}
      </div>
    </div>
  );
};

export default AccountingReports;
