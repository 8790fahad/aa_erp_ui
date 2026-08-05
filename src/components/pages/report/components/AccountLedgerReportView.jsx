/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  X,
  Printer,
  Download,
  Save,
  BookOpen,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";
import { _fetchApi, _postApi, _deleteApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import ExcelJS from "exceljs";
import { useReactToPrint } from "react-to-print";
import moment from "moment";

/** Canonical path for account ledger opened from Custom Reports (with query string). */
export const CUSTOM_REPORTS_LEDGER_PATH =
  "/app/reports/accounting-reports/custom-reports";

/** Summary schedule row layout: head total | child lines | debit/credit/balance columns */
export const SUMMARY_PRESENTATION = {
  HEAD: "head",
  BREAKDOWN: "breakdown",
  DETAIL: "detail",
};

export const SUMMARY_PRESENTATION_LABELS = {
  [SUMMARY_PRESENTATION.HEAD]: "Head only",
  [SUMMARY_PRESENTATION.BREAKDOWN]: "Break down",
};

/** Legacy saved URLs used `detail` (debit/credit/balance columns); map to break down. */
export const normalizeSummaryPresentation = (value) => {
  if (value === SUMMARY_PRESENTATION.DETAIL || value === "detail") {
    return SUMMARY_PRESENTATION.BREAKDOWN;
  }
  if (
    value === SUMMARY_PRESENTATION.HEAD ||
    value === SUMMARY_PRESENTATION.BREAKDOWN
  ) {
    return value;
  }
  return null;
};

export const SUMMARY_BALANCE_SIDE = {
  ALL: "all",
  DR: "dr",
  CR: "cr",
};

const resolveBreakdownBalanceSide = (value) => {
  if (value === SUMMARY_BALANCE_SIDE.DR || value === SUMMARY_BALANCE_SIDE.CR) {
    return value;
  }
  return SUMMARY_BALANCE_SIDE.ALL;
};

const getSummaryBalanceSide = (row) => {
  const net =
    parseFloat(row.total_debit || 0) - parseFloat(row.total_credit || 0);
  return net >= 0 ? "DR" : "CR";
};

const filterSummaryRowsByBalanceSide = (rows, side) => {
  if (!side || side === SUMMARY_BALANCE_SIDE.ALL) return rows || [];
  const want = side === SUMMARY_BALANCE_SIDE.DR ? "DR" : "CR";
  return (rows || []).filter(
    (row) => getSummaryBalanceSide(row) === want,
  );
};

const resolveSavedSummaryPresentation = (report) => {
  const explicit = normalizeSummaryPresentation(report?.summary_presentation);
  if (explicit) return explicit;
  if (report?.report_type !== "summary") return null;
  return report.only_children
    ? SUMMARY_PRESENTATION.BREAKDOWN
    : SUMMARY_PRESENTATION.HEAD;
};

const buildAccountMetaByCode = (fetchedAccounts = []) =>
  new Map(
    fetchedAccounts.map((a) => [
      String(a.code),
      { ...a, code: String(a.code), parent_code: a.parent_code || null },
    ]),
  );

const isUnderAncestor = (code, ancestorCode, metaByCode) => {
  let current = String(code);
  const target = String(ancestorCode);
  if (current === target) return true;
  const visited = new Set();
  while (current && !visited.has(current)) {
    visited.add(current);
    const parent = metaByCode.get(current)?.parent_code;
    if (!parent) return false;
    current = String(parent);
    if (current === target) return true;
  }
  return false;
};

const parentHasDescendantsInData = (parentCode, reportData, metaByCode) =>
  (reportData || []).some((row) =>
    isUnderAncestor(String(row.account_code), parentCode, metaByCode) &&
    String(row.account_code) !== String(parentCode),
  );

const aggregateSummaryRows = (rows) =>
  (rows || []).reduce(
    (acc, row) => ({
      total_debit: acc.total_debit + parseFloat(row.total_debit || 0),
      total_credit: acc.total_credit + parseFloat(row.total_credit || 0),
      opening_balance:
        acc.opening_balance + parseFloat(row.opening_balance || 0),
      closing_balance:
        acc.closing_balance + parseFloat(row.closing_balance || 0),
    }),
    { total_debit: 0, total_credit: 0, opening_balance: 0, closing_balance: 0 },
  );

const applySummaryPresentation = (
  reportData,
  reportMeta,
  selectedCodes,
  presentation,
) => {
  if (!reportData?.length) return [];
  const metaByCode = buildAccountMetaByCode(reportMeta?.fetched_accounts || []);
  const byCode = new Map(
    reportData.map((row) => [String(row.account_code), row]),
  );
  const roots = (selectedCodes || []).map(String).filter(Boolean);
  if (!roots.length) return reportData;

  if (presentation === SUMMARY_PRESENTATION.HEAD) {
    return roots.map((rootCode) => {
      const meta = metaByCode.get(rootCode);
      const self = byCode.get(rootCode);
      const rowsToSum = reportData.filter((row) =>
        isUnderAncestor(String(row.account_code), rootCode, metaByCode),
      );
      const agg = aggregateSummaryRows(rowsToSum);
      return {
        account_code: rootCode,
        description: meta?.description || self?.description || rootCode,
        account_nature: self?.account_nature || null,
        ...agg,
      };
    });
  }

  const headerParents = new Set(
    roots.filter((root) =>
      parentHasDescendantsInData(root, reportData, metaByCode),
    ),
  );

  return reportData.filter((row) => {
    const code = String(row.account_code);
    if (headerParents.has(code)) return false;
    return roots.some((root) =>
      isUnderAncestor(code, root, metaByCode),
    );
  });
};

const resolveInitialSummaryPresentation = (explicit, onlyChildren) => {
  const normalized = normalizeSummaryPresentation(explicit);
  if (normalized) return normalized;
  return onlyChildren
    ? SUMMARY_PRESENTATION.BREAKDOWN
    : SUMMARY_PRESENTATION.HEAD;
};

const hasNonZeroSummaryBalance = (row) => {
  const net =
    parseFloat(row.total_debit || 0) - parseFloat(row.total_credit || 0);
  return Math.abs(net) >= 0.005;
};

const filterNonZeroSummaryRows = (rows) =>
  (rows || []).filter(hasNonZeroSummaryBalance);

/**
 * Account ledger report UI: fetches `/account/account-ledger-report`, print/PDF, Excel.
 * Used on the standalone account-ledger route and embedded on Custom Reports.
 *
 * @param {object} props
 * @param {string[]} props.accountCodes
 * @param {string} props.initialFrom
 * @param {string} props.initialTo
 * @param {string} [props.initialName]
 * @param {boolean} [props.initialOnlyChildren=false]
 * @param {'head'|'breakdown'|'detail'} [props.initialSummaryPresentation]
 * @param {'all'|'dr'|'cr'} [props.initialBreakdownBalanceSide='all']
 * @param {'summary'|'full'} [props.initialReportType='full']
 * @param {'full'|'embedded'} [props.variant='full'] — `embedded` hides saved-report features
 * @param {(p: { from: string; to: string; name: string; presentation?: string }) => void} [props.onSyncSearchParams]
 * @param {() => void} [props.onClose] — embedded toolbar close (e.g. clear query)
 */
export default function AccountLedgerReportView({
  accountCodes: selectedCodes,
  initialFrom,
  initialTo,
  initialName = "",
  initialOnlyChildren = false,
  initialSummaryPresentation,
  initialBreakdownBalanceSide = SUMMARY_BALANCE_SIDE.ALL,
  initialReportType = "full",
  variant = "full",
  onSyncSearchParams,
}) {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const printRef = useRef(null);

  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [asAtDate, setAsAtDate] = useState(initialTo || initialFrom);
  const [reportName, setReportName] = useState(initialName);
  const [reportData, setReportData] = useState(null);
  const [reportMeta, setReportMeta] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [saveReportConfirmOpen, setSaveReportConfirmOpen] = useState(false);
  const [onlyChildren, setOnlyChildren] = useState(initialOnlyChildren);
  const [summaryPresentation, setSummaryPresentation] = useState(() =>
    resolveInitialSummaryPresentation(
      initialSummaryPresentation,
      initialOnlyChildren,
    ),
  );
  const [breakdownBalanceSide, setBreakdownBalanceSide] = useState(() =>
    resolveBreakdownBalanceSide(initialBreakdownBalanceSide),
  );
  const [reportType, setReportType] = useState(
    initialReportType === "summary" ? "summary" : "full",
  );
  const [saveFormName, setSaveFormName] = useState("");

  const [savedReports, setSavedReports] = useState([]);
  const [savedReportsOpen, setSavedReportsOpen] = useState(false);
  const [codesFetchedOpen, setCodesFetchedOpen] = useState(false);

  const facilityId = activeBusiness?.id;
  const isSummaryReport =
    reportMeta?.report_type === "summary" || reportType === "summary";

  const fetchSavedReports = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/account/saved-reports/${facilityId}`,
      (res) => {
        if (res.success) setSavedReports(res.results || []);
      },
      () => {},
    );
  }, [facilityId]);

  useEffect(() => {
    if (variant === "full") fetchSavedReports();
  }, [fetchSavedReports, variant]);

  useEffect(() => {
    setCodesFetchedOpen(false);
  }, [reportMeta?.fetched_codes?.join(",")]);

  useEffect(() => {
    const presentation = resolveInitialSummaryPresentation(
      initialSummaryPresentation,
      initialOnlyChildren,
    );
    setFromDate(initialFrom);
    setToDate(initialTo);
    setAsAtDate(initialTo || initialFrom);
    setReportName(initialName || "");
    setOnlyChildren(Boolean(initialOnlyChildren));
    setSummaryPresentation(presentation);
    setBreakdownBalanceSide(
      resolveBreakdownBalanceSide(initialBreakdownBalanceSide),
    );
    setReportType(initialReportType === "summary" ? "summary" : "full");
    if (
      variant === "embedded" &&
      onSyncSearchParams &&
      initialSummaryPresentation &&
      normalizeSummaryPresentation(initialSummaryPresentation) !==
        initialSummaryPresentation
    ) {
      onSyncSearchParams({
        from: initialFrom,
        to: initialTo,
        name: initialName || "",
        reportType: initialReportType === "summary" ? "summary" : "full",
        presentation,
        ...(presentation === SUMMARY_PRESENTATION.BREAKDOWN
          ? {
              balanceSide: resolveBreakdownBalanceSide(
                initialBreakdownBalanceSide,
              ),
            }
          : {}),
      });
    }
  }, [
    initialFrom,
    initialTo,
    initialName,
    initialOnlyChildren,
    initialSummaryPresentation,
    initialBreakdownBalanceSide,
    initialReportType,
    selectedCodes.join(","),
    variant,
    onSyncSearchParams,
  ]);

  /**
   * @param {{ from?: string; to?: string }} [opts] — from URL-driven effect use initialFrom/initialTo; from Run button use form state
   */
  const resolveSummaryDateRange = (at) => {
    const m = moment(at);
    return {
      from: m.clone().startOf("year").format("YYYY-MM-DD"),
      to: m.format("YYYY-MM-DD"),
    };
  };

  const generateReport = (opts) => {
    const name = opts?.name ?? reportName;
    const runPresentation =
      opts?.summaryPresentation ?? summaryPresentation;
    const runOnlyChildren =
      opts?.onlyChildren ??
      (runPresentation === SUMMARY_PRESENTATION.HEAD ? false : true);
    const runReportType = opts?.reportType ?? reportType;
    const isSummaryRun = runReportType === "summary";

    let from;
    let to;
    if (isSummaryRun) {
      const at = opts?.asAt ?? asAtDate;
      if (!at) {
        toast.error("Please set the as at date");
        return;
      }
      ({ from, to } = resolveSummaryDateRange(at));
    } else {
      from = opts?.from ?? fromDate;
      to = opts?.to ?? toDate;
    }

    if (selectedCodes.length === 0) {
      toast.error("No accounts selected");
      return;
    }
    if (!from || !to) {
      toast.error(
        isSummaryRun ? "Please set the as at date" : "Please set date range",
      );
      return;
    }

    setReportLoading(true);
    _postApi(
      "/account/account-ledger-report",
      {
        facilityId,
        fromDate: from,
        toDate: to,
        accountCodes: selectedCodes,
        onlyChildren: runOnlyChildren,
        reportType: runReportType,
      },
      (res) => {
        setReportLoading(false);
        if (res.success) {
          setReportData(res.results);
          setReportMeta(res.meta || null);
          if (variant === "embedded" && onSyncSearchParams) {
            onSyncSearchParams({
              from,
              to,
              name: name || "",
              reportType: runReportType,
              ...(runReportType === "summary"
                ? { presentation: runPresentation }
                : {}),
            });
          }
          toast.success("Report generated");
        } else {
          toast.error(res.message || "Failed to generate report");
        }
      },
      (err) => {
        setReportLoading(false);
        toast.error(err.message || "Error generating report");
      },
    );
  };

  useEffect(() => {
    if (selectedCodes.length === 0 || !facilityId) return;
    const isInitialSummary = initialReportType === "summary";
    generateReport({
      from: initialFrom,
      to: initialTo,
      asAt: initialTo || initialFrom,
      onlyChildren: initialOnlyChildren,
      reportType: isInitialSummary ? "summary" : "full",
    });
  }, [
    facilityId,
    selectedCodes.join(","),
    initialFrom,
    initialTo,
    initialOnlyChildren,
    initialReportType,
  ]);

  const openSaveModal = () => {
    setSaveFormName(reportName || "");
    setSaveReportConfirmOpen(true);
  };

  const saveReport = () => {
    const nameToSave = String(saveFormName ?? reportName ?? "").trim();
    if (!nameToSave) {
      toast.error("Please enter a report name");
      return;
    }
    setSavingReport(true);
    _postApi(
      "/account/save-report",
      {
        report_name: nameToSave,
        account_codes: selectedCodes,
        only_children: onlyChildren,
        report_type: reportType,
        summary_presentation:
          reportType === "summary" ? summaryPresentation : null,
        facility_id: facilityId,
        created_by: user?.id,
      },
      (res) => {
        setSavingReport(false);
        if (res.success) {
          setReportName(nameToSave);
          if (variant === "embedded" && onSyncSearchParams) {
            onSyncSearchParams({
              from: fromDate,
              to: toDate,
              name: nameToSave,
              reportType,
              ...(reportType === "summary"
                ? {
                    presentation: summaryPresentation,
                    ...(summaryPresentation === SUMMARY_PRESENTATION.BREAKDOWN
                      ? { balanceSide: breakdownBalanceSide }
                      : {}),
                  }
                : {}),
            });
          }
          toast.success("Report saved successfully");
          fetchSavedReports();
          setSaveReportConfirmOpen(false);
        } else {
          toast.error("Failed to save report");
        }
      },
      (err) => {
        setSavingReport(false);
        toast.error(err.message || "Error saving report");
      },
    );
  };

  const deleteSavedReport = (id) => {
    if (!window.confirm("Delete this saved report?")) return;
    _deleteApi(
      `/account/saved-report/${id}/${facilityId}`,
      {},
      (res) => {
        if (res.success) {
          toast.success("Deleted");
          fetchSavedReports();
        }
      },
      () => toast.error("Delete failed"),
    );
  };

  const loadSavedReport = (report) => {
    const codes = report.account_codes || [];
    const name = report.report_name;
    const presentation = resolveSavedSummaryPresentation(report);
    setReportData(null);
    setReportMeta(null);
    setSavedReportsOpen(false);
    const params = new URLSearchParams();
    params.set("accounts", codes.join(","));
    params.set("name", name);
    if (report.report_type === "summary") {
      params.set("reportType", "summary");
      if (presentation) params.set("presentation", presentation);
      if (presentation !== SUMMARY_PRESENTATION.HEAD) {
        params.set("onlyChildren", "1");
      }
    } else if (report.only_children) {
      params.set("onlyChildren", "1");
    }
    navigate(`${CUSTOM_REPORTS_LEDGER_PATH}?${params.toString()}`, {
      replace: true,
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (amount) => formatNumber1(amount);

  const netDrCr = (debit, credit) => {
    const dr = parseFloat(debit || 0);
    const cr = parseFloat(credit || 0);
    const net = dr - cr;
    if (net >= 0) return { amount: net, side: "DR" };
    return { amount: Math.abs(net), side: "CR" };
  };

  const formatDrCrAmount = (debit, credit) => {
    const { amount, side } = netDrCr(debit, credit);
    return `${formatCurrency(amount)}${side.toLowerCase()}`;
  };

  const renderDrCrAmount = (debit, credit) => {
    const { amount, side } = netDrCr(debit, credit);
    return (
      <>
        {formatCurrency(amount)}
        <span className="ml-0.5 text-[10px] font-normal lowercase leading-none">
          {side.toLowerCase()}
        </span>
      </>
    );
  };

  const summaryAsAtLabel = moment(asAtDate)
    .format("DD MMMM YYYY")
    .toUpperCase();

  const primaryRequestedAccount = reportMeta?.requested_accounts?.[0];

  const displayReportData = React.useMemo(() => {
    if (!reportData?.length) return [];
    if (!isSummaryReport) return reportData;
    let rows = filterNonZeroSummaryRows(
      applySummaryPresentation(
        reportData,
        reportMeta,
        selectedCodes,
        summaryPresentation,
      ),
    );
    if (summaryPresentation === SUMMARY_PRESENTATION.BREAKDOWN) {
      rows = filterSummaryRowsByBalanceSide(rows, breakdownBalanceSide);
    }
    return rows;
  }, [
    reportData,
    reportMeta,
    selectedCodes,
    summaryPresentation,
    breakdownBalanceSide,
    isSummaryReport,
  ]);

  const summaryScheduleTitle = React.useMemo(() => {
    const headLabel =
      primaryRequestedAccount?.description ||
      reportName ||
      primaryRequestedAccount?.code ||
      "SCHEDULE";
    if (summaryPresentation === SUMMARY_PRESENTATION.HEAD) {
      return `${String(headLabel).toUpperCase()} AS AT ${summaryAsAtLabel}`;
    }
    return `${(reportName || headLabel || "SCHEDULE").toUpperCase()} AS AT ${summaryAsAtLabel}`;
  }, [
    primaryRequestedAccount,
    reportName,
    summaryAsAtLabel,
    summaryPresentation,
  ]);

  const summaryTotals = React.useMemo(() => {
    if (!displayReportData?.length) return { totalDebit: 0, totalCredit: 0 };
    return displayReportData.reduce(
      (acc, row) => ({
        totalDebit: acc.totalDebit + parseFloat(row.total_debit || 0),
        totalCredit: acc.totalCredit + parseFloat(row.total_credit || 0),
      }),
      { totalDebit: 0, totalCredit: 0 },
    );
  }, [displayReportData]);

  const syncEmbeddedSearchParams = useCallback(
    (extra = {}) => {
      if (variant !== "embedded" || !onSyncSearchParams) return;
      const syncReportType = extra.reportType ?? reportType;
      onSyncSearchParams({
        from: fromDate,
        to: isSummaryReport ? asAtDate : toDate,
        name: reportName || "",
        reportType: syncReportType,
        ...(syncReportType === "summary"
          ? {
              presentation:
                extra.presentation ?? summaryPresentation,
              ...( (extra.presentation ?? summaryPresentation) ===
              SUMMARY_PRESENTATION.BREAKDOWN
                ? {
                    balanceSide:
                      extra.balanceSide ?? breakdownBalanceSide,
                  }
                : {}),
            }
          : {}),
        ...extra,
      });
    },
    [
      variant,
      onSyncSearchParams,
      fromDate,
      toDate,
      asAtDate,
      reportName,
      reportType,
      isSummaryReport,
      summaryPresentation,
      breakdownBalanceSide,
    ],
  );

  const handleSummaryPresentationChange = (next) => {
    setSummaryPresentation(next);
    setOnlyChildren(next !== SUMMARY_PRESENTATION.HEAD);
    if (next !== SUMMARY_PRESENTATION.BREAKDOWN) {
      setBreakdownBalanceSide(SUMMARY_BALANCE_SIDE.ALL);
    }
    syncEmbeddedSearchParams({
      reportType: "summary",
      presentation: next,
      ...(next === SUMMARY_PRESENTATION.BREAKDOWN
        ? { balanceSide: breakdownBalanceSide }
        : { balanceSide: SUMMARY_BALANCE_SIDE.ALL }),
    });
  };

  const handleBreakdownBalanceSideChange = (next) => {
    setBreakdownBalanceSide(next);
    syncEmbeddedSearchParams({
      reportType: "summary",
      presentation: SUMMARY_PRESENTATION.BREAKDOWN,
      balanceSide: next,
    });
  };

  const handleReactToPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${reportName || "Account-Ledger"}-${formatDate(fromDate)}-to-${formatDate(toDate)}`,
    pageStyle: `
      @page { size: A4 landscape; margin: 0 !important; }
      html, body {
        width: 297mm; min-height: 210mm;
        margin: 0 !important; padding: 0 !important;
        background: #fff !important;
        print-color-adjust: exact; -webkit-print-color-adjust: exact;
      }
      .print-content {
        width: 297mm !important; min-height: 210mm;
        margin: 0 auto !important; padding: 0 !important;
        box-shadow: none !important; border: none !important;
        background: #fff !important;
      }
      .no-print { display: none !important; }
    `,
    onBeforeGetContent: () =>
      new Promise((resolve) => {
        if (!printRef.current) {
          toast.error("Report content is not ready to print yet.");
          resolve();
          return;
        }
        setTimeout(resolve, 100);
      }),
    onPrintError: (error) => {
      console.error("Print failed:", error);
      toast.error("Unable to print report. Please try again.");
    },
  });

  const handlePrint = useCallback(() => {
    if (!printRef.current) {
      toast.error("Report content is not ready to print yet.");
      return;
    }
    try {
      handleReactToPrint();
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Unable to print report. Please try again.");
    }
  }, [handleReactToPrint]);

  const handleExportExcel = async () => {
    if (!displayReportData?.length) {
      toast.error("Generate a report first");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(
      isSummaryReport ? "Summary" : "Account Ledger",
    );

    const border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };

    let row = 1;
    const summaryColCount = 4;

    const title = worksheet.getCell(row, 1);
    title.value =
      activeBusiness?.business_name || activeBusiness?.name || "Business";
    title.style = {
      font: { bold: true, size: 14 },
      alignment: { horizontal: "center" },
    };
    worksheet.mergeCells(
      row,
      1,
      row,
      isSummaryReport ? summaryColCount : 7,
    );
    row++;

    if (activeBusiness?.rc || activeBusiness?.registration_number) {
      const rc = worksheet.getCell(row, 1);
      rc.value = `RC. ${activeBusiness?.rc || activeBusiness?.registration_number}`;
      rc.style = {
        font: { size: 11 },
        alignment: { horizontal: "center" },
      };
      worksheet.mergeCells(
        row,
        1,
        row,
        isSummaryReport ? summaryColCount : 7,
      );
      row++;
    }

    const sub = worksheet.getCell(row, 1);
    sub.value = isSummaryReport
      ? summaryScheduleTitle
      : `${reportName || "Account Ledger Report"}: ${formatDate(fromDate)} to ${formatDate(toDate)}`;
    sub.style = {
      font: { size: 11 },
      alignment: { horizontal: "center" },
    };
    worksheet.mergeCells(
      row,
      1,
      row,
      isSummaryReport ? summaryColCount : 7,
    );
    row++;

    const genDate = worksheet.getCell(row, 1);
    genDate.value = `Date: ${moment().format("dddd, DD MMMM YYYY hh:mm A [GMT]Z")}`;
    genDate.style = {
      font: { size: 10 },
      alignment: { horizontal: "center" },
    };
    worksheet.mergeCells(
      row,
      1,
      row,
      isSummaryReport ? summaryColCount : 7,
    );
    row += 2;

    if (isSummaryReport) {
      worksheet.columns = [
        { width: 8 },
        { width: 14 },
        { width: 40 },
        { width: 14 },
      ];

      const summaryHeaders = [
        "S/N",
        "Account code",
        "Code description",
        "Balance",
      ];

      const hdrRow = worksheet.getRow(row);
      summaryHeaders.forEach((h, i) => {
        const cell = hdrRow.getCell(i + 1);
        cell.value = h;
        cell.style = {
          font: { bold: true, color: { argb: "FFFFFFFF" } },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF4B5563" },
          },
          alignment: { horizontal: i >= 3 ? "right" : "left" },
          border,
        };
      });
      row++;

      displayReportData.forEach((account, idx) => {
        const { amount, side } = netDrCr(
          account.total_debit,
          account.total_credit,
        );
        const dataRow = worksheet.getRow(row);
        dataRow.getCell(1).value = idx + 1;
        dataRow.getCell(1).style = { border };
        dataRow.getCell(2).value = account.account_code;
        dataRow.getCell(2).style = { border };
        dataRow.getCell(3).value =
          account.description || account.account_code;
        dataRow.getCell(3).style = { border };
        dataRow.getCell(4).value = `${amount}${side.toLowerCase()}`;
        dataRow.getCell(4).style = {
          numFmt: "#,##0.00",
          alignment: { horizontal: "right" },
          font: { bold: true },
          border,
        };
        row++;
      });

      const totalRow = worksheet.getRow(row);
      totalRow.getCell(1).value = "";
      totalRow.getCell(2).value = "";
      totalRow.getCell(3).value = "Total";
      totalRow.getCell(3).style = { font: { bold: true }, border };
      const { amount: totalAmt, side: totalSide } = netDrCr(
        summaryTotals.totalDebit,
        summaryTotals.totalCredit,
      );
      totalRow.getCell(4).value = `${totalAmt}${totalSide.toLowerCase()}`;
      totalRow.getCell(4).style = {
        alignment: { horizontal: "right" },
        font: { bold: true },
        border,
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportName || "Summary-Report"}-${formatDate(asAtDate || toDate)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
      return;
    }

    worksheet.columns = [
      { width: 14 },
      { width: 12 },
      { width: 14 },
      { width: 40 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
    ];

    const hdrRow = worksheet.getRow(row);
    [
      "Account",
      "Date",
      "Ref.",
      "Memo/Description",
      "Debit",
      "Credit",
      "Balance",
    ].forEach((h, i) => {
      const cell = hdrRow.getCell(i + 1);
      cell.value = h;
      cell.style = {
        font: { bold: true, color: { argb: "FFFFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4B5563" },
        },
        alignment: { horizontal: i >= 4 ? "right" : "left" },
        border,
      };
    });
    row++;

    for (const account of reportData) {
      const acctStr = `${account.account_code} — ${account.description}`;

      const begRow = worksheet.getRow(row);
      begRow.getCell(1).value = acctStr;
      begRow.getCell(1).style = { font: { size: 10 }, border };
      begRow.getCell(2).value = "";
      begRow.getCell(2).style = { border };
      begRow.getCell(3).value = "";
      begRow.getCell(3).style = { border };
      begRow.getCell(4).value = "Beginning Balance";
      begRow.getCell(4).style = { font: { bold: true }, border };
      begRow.getCell(5).value = "";
      begRow.getCell(5).style = { border };
      begRow.getCell(6).value = "";
      begRow.getCell(6).style = { border };
      begRow.getCell(7).value = account.opening_balance || 0;
      begRow.getCell(7).style = {
        font: { bold: true },
        numFmt: "#,##0.00",
        alignment: { horizontal: "right" },
        border,
      };
      row++;

      if (account.transactions.length === 0) {
        const emptyRow = worksheet.getRow(row);
        emptyRow.getCell(1).value = account.account_code;
        emptyRow.getCell(1).style = { border };
        emptyRow.getCell(2).value = "No transactions in this period";
        emptyRow.getCell(2).style = {
          border,
          alignment: { horizontal: "center" },
        };
        worksheet.mergeCells(row, 2, row, 6);
        emptyRow.getCell(7).value = "";
        emptyRow.getCell(7).style = { border };
        row++;
        continue;
      }

      for (const txn of account.transactions) {
        const dr = worksheet.getRow(row);
        dr.getCell(1).value = acctStr;
        dr.getCell(1).style = { font: { size: 10 }, border };
        dr.getCell(2).value = moment(txn.transaction_date).format("DD/MM/YYYY");
        dr.getCell(2).style = { border };
        dr.getCell(3).value = txn.reference_number || "";
        dr.getCell(3).style = { border };
        dr.getCell(4).value =
          txn.transaction_description || txn.purpose_of_payment || "";
        dr.getCell(4).style = { border };
        dr.getCell(5).value =
          parseFloat(txn.dr || 0) > 0 ? parseFloat(txn.dr) : "";
        dr.getCell(5).style = {
          numFmt: "#,##0.00",
          alignment: { horizontal: "right" },
          border,
        };
        dr.getCell(6).value =
          parseFloat(txn.cr || 0) > 0 ? parseFloat(txn.cr) : "";
        dr.getCell(6).style = {
          numFmt: "#,##0.00",
          alignment: { horizontal: "right" },
          border,
        };
        dr.getCell(7).value = txn.running_balance;
        dr.getCell(7).style = {
          numFmt: "#,##0.00",
          alignment: { horizontal: "right" },
          font: { bold: true },
          border,
        };
        row++;
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportName || "Account-Ledger"}-${formatDate(fromDate)}-to-${formatDate(toDate)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel downloaded");
  };

  const hasData = displayReportData && displayReportData.length > 0;

  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-content { padding: 0px; box-shadow: none; }
          @page { margin: 0mm; size: A4 landscape; }
          html, body {
            width: 297mm; min-height: 210mm;
            margin: 0 !important; padding: 0 !important;
            background: #fff !important;
            print-color-adjust: exact; -webkit-print-color-adjust: exact;
          }
          .print-content {
            width: 297mm !important; min-height: 210mm;
            margin: 0 auto !important; padding: 0 !important;
            box-shadow: none !important; border: none !important;
            background: #fff !important; position: relative;
          }
          .print-content table {
            border-collapse: collapse; width: 100%; font-size: 10pt;
          }
          .print-content th, .print-content td {
            border: 1px solid #000; padding: 4px;
          }
          .print-content .bg-gray-50,
          .print-content .bg-gray-100,
          .print-content .bg-gray-200 {
            background-color: #f0f0f0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 p-1">
        <div className="max-w-7xl mx-auto">
          {/* Top Toolbar */}
          <div className="bg-gray-100 rounded-lg no-print">
            <div className="flex min-w-0 flex-nowrap items-center gap-2 py-2 pl-1 pr-1 sm:gap-3 sm:pr-2 overflow-x-auto">
              <div className="flex shrink-0 flex-nowrap items-center gap-2 sm:gap-3">
                {reportType === "summary" ? (
                  <>
                    <span className="shrink-0 text-sm font-medium text-gray-700">
                      As at
                    </span>
                    <input
                      type="date"
                      value={asAtDate}
                      onChange={(e) => setAsAtDate(e.target.value)}
                      className="w-[9.5rem] shrink-0 px-2 py-2 text-sm border border-gray-300 rounded bg-white sm:w-auto sm:px-4"
                    />
                  </>
                ) : (
                  <>
                    <select
                      className="min-w-[8.5rem] px-3 py-2 text-sm border border-gray-300 rounded bg-white text-gray-700 sm:min-w-0 sm:px-4"
                      defaultValue="custom"
                      onChange={(e) => {
                        const today = new Date();
                        const value = e.target.value;
                        if (value === "month") {
                          const firstDay = new Date(
                            today.getFullYear(),
                            today.getMonth(),
                            1,
                          );
                          setFromDate(firstDay.toISOString().split("T")[0]);
                          setToDate(today.toISOString().split("T")[0]);
                        } else if (value === "year") {
                          const firstDay = new Date(today.getFullYear(), 0, 1);
                          const lastDay = new Date(today.getFullYear(), 11, 31);
                          setFromDate(firstDay.toISOString().split("T")[0]);
                          setToDate(lastDay.toISOString().split("T")[0]);
                        } else if (value === "lastMonth") {
                          const lastMonth = new Date(
                            today.getFullYear(),
                            today.getMonth() - 1,
                            1,
                          );
                          const lastDay = new Date(
                            today.getFullYear(),
                            today.getMonth(),
                            0,
                          );
                          setFromDate(lastMonth.toISOString().split("T")[0]);
                          setToDate(lastDay.toISOString().split("T")[0]);
                        }
                      }}
                    >
                      <option value="month">This Month-to-date</option>
                      <option value="year">This Year</option>
                      <option value="lastMonth">Last Month</option>
                      <option value="custom">Custom</option>
                    </select>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-[9.5rem] shrink-0 px-2 py-2 text-sm border border-gray-300 rounded bg-white sm:w-auto sm:px-4"
                    />
                    <span className="shrink-0 text-sm text-gray-600">to</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-[9.5rem] shrink-0 px-2 py-2 text-sm border border-gray-300 rounded bg-white sm:w-auto sm:px-4"
                    />
                  </>
                )}
                {reportType !== "summary" && (
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded border border-gray-300 bg-white px-2 py-2 text-xs text-gray-700 sm:px-3">
                    <Checkbox
                      checked={onlyChildren}
                      onCheckedChange={(v) => setOnlyChildren(Boolean(v))}
                    />
                    Only children
                  </label>
                )}
                {reportType === "summary" && (
                  <fieldset className="flex shrink-0 flex-wrap items-center gap-2 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700">
                    <legend className="sr-only">Summary presentation</legend>
                    <span className="font-medium whitespace-nowrap">
                      Show:
                    </span>
                    <RadioGroup
                      value={summaryPresentation}
                      onValueChange={handleSummaryPresentationChange}
                      className="flex flex-wrap items-center gap-3"
                    >
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <RadioGroupItem value={SUMMARY_PRESENTATION.HEAD} />
                        Head only
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <RadioGroupItem
                          value={SUMMARY_PRESENTATION.BREAKDOWN}
                        />
                        Break down
                      </label>
                    </RadioGroup>
                  </fieldset>
                )}
                {reportType === "summary" &&
                  summaryPresentation === SUMMARY_PRESENTATION.BREAKDOWN && (
                    <fieldset className="flex shrink-0 flex-wrap items-center gap-2 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700">
                      <legend className="sr-only">Break down balance filter</legend>
                      <span className="font-medium whitespace-nowrap">
                        Balance:
                      </span>
                      <RadioGroup
                        value={breakdownBalanceSide}
                        onValueChange={handleBreakdownBalanceSideChange}
                        className="flex flex-wrap items-center gap-3"
                      >
                        <label className="flex cursor-pointer items-center gap-1.5">
                          <RadioGroupItem value={SUMMARY_BALANCE_SIDE.ALL} />
                          All
                        </label>
                        <label className="flex cursor-pointer items-center gap-1.5">
                          <RadioGroupItem value={SUMMARY_BALANCE_SIDE.DR} />
                          DR
                        </label>
                        <label className="flex cursor-pointer items-center gap-1.5">
                          <RadioGroupItem value={SUMMARY_BALANCE_SIDE.CR} />
                          CR
                        </label>
                      </RadioGroup>
                    </fieldset>
                  )}
                <select
                  value={reportType}
                  onChange={(e) => {
                    const next =
                      e.target.value === "summary" ? "summary" : "full";
                    if (next === "summary") {
                      setAsAtDate(
                        toDate || asAtDate || moment().format("YYYY-MM-DD"),
                      );
                    }
                    setReportType(next);
                    syncEmbeddedSearchParams({ reportType: next });
                  }}
                  className="shrink-0 rounded border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 sm:px-3"
                  title="Report type"
                >
                  <option value="full">Full</option>
                  <option value="summary">Summary</option>
                </select>
                <button
                  type="button"
                  className="shrink-0 whitespace-nowrap px-3 py-2 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 sm:px-4"
                  onClick={() => generateReport()}
                  disabled={reportLoading}
                >
                  {reportLoading ? (
                    <>
                      <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Run report"
                  )}
                </button>
                <Input
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="Report name"
                  className="h-9 w-48 shrink-0 bg-white"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={openSaveModal}
                  disabled={savingReport}
                  className="h-9 w-9 shrink-0"
                  title="Save report"
                >
                  {savingReport ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2 sm:gap-3">
                {!reportLoading && hasData && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex shrink-0 items-center gap-2 rounded border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:px-3"
                      >
                        <Printer className="h-4 w-4" />
                        <Download className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={handlePrint}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Printer className="h-4 w-4" />
                        Print / PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Download className="h-4 w-4" />
                        Download Excel
                      </DropdownMenuItem>
                      {variant === "full" && (
                        <>
                          <DropdownMenuItem
                            onClick={() => setSavedReportsOpen(true)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <BookOpen className="h-4 w-4" />
                            Saved Reports
                            {savedReports.length > 0 && (
                              <Badge
                                variant="secondary"
                                className="ml-1 text-xs"
                              >
                                {savedReports.length}
                              </Badge>
                            )}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <button
                  type="button"
                  onClick={() => {
                    navigate(-1);
                  }}
                  className="flex shrink-0 items-center gap-2 rounded border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-gray-50 sm:px-3"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {reportLoading && (
            <div className="space-y-4 mt-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg shadow-sm overflow-hidden"
                >
                  <div className="flex items-center justify-between p-4 border-b bg-blue-50">
                    <div className="flex items-center gap-4 flex-1">
                      <Skeleton className="h-5 w-5 rounded" />
                      <div className="flex-1">
                        <Skeleton className="h-6 w-48 mb-2" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-6 w-24 mb-2" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {[1, 2].map((j) => (
                      <div key={j}>
                        <div className="flex items-center justify-between p-4 pl-12">
                          <div className="flex items-center gap-4 flex-1">
                            <Skeleton className="h-4 w-4 rounded" />
                            <div className="flex-1">
                              <Skeleton className="h-5 w-56 mb-2" />
                              <Skeleton className="h-4 w-28" />
                            </div>
                          </div>
                          <div className="text-right">
                            <Skeleton className="h-5 w-20" />
                          </div>
                        </div>
                        <div className="pl-16 pr-4 pb-4">
                          <div className="space-y-2">
                            <div className="grid grid-cols-7 gap-4 pb-2 border-b">
                              {[1, 2, 3, 4, 5, 6, 7].map((k) => (
                                <Skeleton key={k} className="h-4 w-16" />
                              ))}
                            </div>
                            {[1, 2, 3].map((k) => (
                              <div
                                key={k}
                                className="grid grid-cols-7 gap-4 py-2 border-b"
                              >
                                {[1, 2, 3, 4, 5, 6, 7].map((l) => (
                                  <Skeleton key={l} className="h-4 w-16" />
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ledger table */}
          {!reportLoading && hasData && (
            <div ref={printRef} className="print-content space-y-4">
              <div className="space-y-0">
                {/* Business Header */}
                <div>
                  <BusinessDocumentHeader
                    business={activeBusiness}
                    title={
                      isSummaryReport
                        ? summaryScheduleTitle
                        : reportName || "ACCOUNT LEDGER"
                    }
                    numberLabel={
                      isSummaryReport
                        ? `As at: ${formatDate(asAtDate)}`
                        : `Period: ${formatDate(fromDate)} - ${formatDate(toDate)}`
                    }
                    date={new Date()}
                    dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
                    className="mb-0"
                  />
                </div>

                {reportMeta?.fetched_codes?.length > 0 && (
                  <Collapsible
                    open={codesFetchedOpen}
                    onOpenChange={setCodesFetchedOpen}
                    className="m-1 border-l-4 border-r-4 border-l-blue-900 border-r-blue-900 bg-blue-50 text-sm leading-tight text-slate-800"
                  >
                    <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-blue-100/60">
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-blue-950 transition-transform duration-200 ${
                          codesFetchedOpen ? "" : "-rotate-90"
                        }`}
                      />
                      <span className="font-semibold text-blue-950">
                        Codes fetched ({reportMeta.fetched_codes.length})
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pb-2">
                      <p className="m-0 break-all">
                        {reportMeta.fetched_codes.join(", ")}
                      </p>
                      {reportMeta.includes_child_codes && (
                        <p className="m-0 mt-1 text-xs text-slate-600">
                          Child account codes under the selected code(s) are
                          included automatically.
                        </p>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Data Table */}
                <div className="bg-white border-2 border-gray-300 overflow-hidden">
                  {isSummaryReport ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead className="bg-gray-600 border-b-2 border-gray-700">
                          <tr>
                            <th className="px-2 py-3 text-left text-xs font-bold text-white uppercase border-r border-gray-500 w-14 whitespace-nowrap">
                              S/N
                            </th>
                            <th className="px-2 py-3 text-left text-xs font-bold text-white uppercase border-r border-gray-500 whitespace-nowrap">
                              Account code
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase border-r border-gray-500">
                              Code description
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase bg-gray-700 whitespace-nowrap">
                              Balance
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayReportData.map((account, idx) => {
                            const { side } = netDrCr(
                              account.total_debit,
                              account.total_credit,
                            );
                            return (
                              <tr
                                key={account.account_code}
                                className="bg-white border-b border-gray-200 hover:bg-gray-50"
                              >
                                <td className="px-2 py-1 text-xs text-gray-800 border-r border-gray-200 align-top tabular-nums">
                                  {idx + 1}
                                </td>
                                <td className="px-2 py-1 text-xs font-medium text-gray-800 border-r border-gray-200 align-top tabular-nums">
                                  {account.account_code}
                                </td>
                                <td className="px-2 py-1 text-sm text-gray-900 border-r border-gray-200 align-top">
                                  {account.description || account.account_code}
                                </td>
                                <td
                                  className={`px-2 py-1 text-sm text-right font-medium tabular-nums whitespace-nowrap bg-gray-50 ${
                                    side === "DR"
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {renderDrCrAmount(
                                    account.total_debit,
                                    account.total_credit,
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-gray-100 border-t-2 border-gray-700">
                            <td
                              colSpan={3}
                              className="px-2 py-2 text-sm font-bold text-gray-900 uppercase border-r border-gray-300 text-right"
                            >
                              Total
                            </td>
                            <td
                              className={`px-2 py-2 text-sm text-right font-bold tabular-nums whitespace-nowrap bg-gray-200 ${
                                netDrCr(
                                  summaryTotals.totalDebit,
                                  summaryTotals.totalCredit,
                                ).side === "DR"
                                  ? "text-green-700"
                                  : "text-red-700"
                              }`}
                            >
                              {renderDrCrAmount(
                                summaryTotals.totalDebit,
                                summaryTotals.totalCredit,
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead className="bg-gray-600 border-b-2 border-gray-700">
                          <tr>
                            <th className="px-2 py-3 text-left text-xs font-bold text-white uppercase border-r border-gray-500 whitespace-nowrap">
                              Account
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase border-r border-gray-500">
                              Date
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase border-r border-gray-500">
                              Ref.
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase border-r border-gray-500">
                              Memo/Description
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase border-r border-gray-500">
                              Debit
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase border-r border-gray-500">
                              Credit
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase bg-gray-700">
                              Balance
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.map((account) => {
                            const acctLabel = `${account.account_code} — ${account.description}`;
                            return (
                              <React.Fragment key={account.account_code}>
                                <tr className="bg-white border-b border-gray-200 hover:bg-gray-50">
                                  <td
                                    className="px-2 py-1 text-xs text-gray-800 border-r border-gray-200 align-top max-w-[10rem] sm:max-w-none"
                                    title={acctLabel}
                                  >
                                    <span className="font-medium">
                                      {account.account_code}
                                    </span>
                                    <span className="hidden sm:inline text-gray-600">
                                      {" "}
                                      — {account.description}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 text-sm text-gray-600 border-r border-gray-200" />
                                  <td className="px-2 py-1 text-sm text-gray-600 border-r border-gray-200" />
                                  <td className="px-2 py-1 text-sm text-gray-900 font-medium border-r border-gray-200">
                                    Beginning Balance
                                  </td>
                                  <td className="px-2 py-1 text-sm text-right text-gray-600 border-r border-gray-200" />
                                  <td className="px-2 py-1 text-sm text-right text-gray-600 border-r border-gray-200" />
                                  <td
                                    className={`px-2 py-1 text-sm text-right font-medium bg-gray-50 ${
                                      (account.opening_balance || 0) >= 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {formatCurrency(
                                      account.opening_balance || 0,
                                    )}
                                  </td>
                                </tr>

                                {account.transactions.length === 0 ? (
                                  <tr className="bg-white border-b border-gray-200">
                                    <td className="px-2 py-1 text-xs text-gray-500 border-r border-gray-200">
                                      {account.account_code}
                                    </td>
                                    <td
                                      colSpan={5}
                                      className="text-center text-gray-400 py-3 border-r border-gray-200 text-sm"
                                    >
                                      No transactions in this period
                                    </td>
                                    <td className="border-r border-gray-200" />
                                  </tr>
                                ) : (
                                  account.transactions.map((txn, idx) => {
                                    const balance = txn.running_balance || 0;
                                    return (
                                      <tr
                                        key={`${account.account_code}-${idx}`}
                                        className="bg-white border-b border-gray-200 hover:bg-gray-50"
                                      >
                                        <td
                                          className="px-2 py-1 text-xs text-gray-800 border-r border-gray-200 align-top"
                                          title={acctLabel}
                                        >
                                          <span className="font-medium">
                                            {account.account_code}
                                          </span>
                                          <span className="hidden sm:inline text-gray-600">
                                            {" "}
                                            — {account.description}
                                          </span>
                                        </td>
                                        <td className="px-2 py-1 text-sm text-gray-900 border-r border-gray-200">
                                          {formatDate(txn.transaction_date)}
                                        </td>
                                        <td className="px-2 py-1 text-sm text-gray-600 font-medium border-r border-gray-200">
                                          {txn.reference_number || ""}
                                        </td>
                                        <td className="px-2 py-1 text-sm text-gray-900 border-r border-gray-200">
                                          {txn.transaction_description ||
                                            txn.purpose_of_payment ||
                                            ""}
                                        </td>
                                        <td className="px-2 py-1 text-sm text-right text-gray-900 border-r border-gray-200">
                                          {parseFloat(txn.dr || 0) > 0
                                            ? formatCurrency(txn.dr)
                                            : ""}
                                        </td>
                                        <td className="px-2 py-1 text-sm text-right text-gray-900 border-r border-gray-200">
                                          {parseFloat(txn.cr || 0) > 0
                                            ? formatCurrency(txn.cr)
                                            : ""}
                                        </td>
                                        <td
                                          className={`px-2 py-1 text-sm text-right font-medium bg-gray-50 ${
                                            balance >= 0
                                              ? "text-green-600"
                                              : "text-red-600"
                                          }`}
                                        >
                                          {formatCurrency(balance)}
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!isSummaryReport && (
                    <div className="bg-white rounded-lg shadow-sm p-6 mt-2 no-print">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        Report Summary
                      </h3>
                      <p className="text-sm text-gray-600 mb-6">
                        Period: {formatDate(fromDate)} to {formatDate(toDate)}
                      </p>
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <p className="text-sm text-gray-600 mb-2">
                            Total Debits
                          </p>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatCurrency(
                              reportData.reduce(
                                (s, a) => s + (a.total_debit || 0),
                                0,
                              ),
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-2">
                            Total Credits
                          </p>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatCurrency(
                              reportData.reduce(
                                (s, a) => s + (a.total_credit || 0),
                                0,
                              ),
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-2">
                            Total Transactions
                          </p>
                          <p className="text-2xl font-bold text-gray-900">
                            {reportData.reduce(
                              (s, a) => s + (a.transactions?.length || 0),
                              0,
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!reportLoading && reportData && displayReportData.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center mt-4">
              <p className="text-gray-600">
                No transactions found for the selected accounts and period.
              </p>
            </div>
          )}

          {/* Initial State */}
          {!reportLoading && !reportData && (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center mt-4">
              <p className="text-gray-600">
                Select accounts from the Chart of Accounts page and configure
                the report to get started.
              </p>
            </div>
          )}
        </div>
      </div>

      {variant === "full" && (
        <Dialog open={savedReportsOpen} onOpenChange={setSavedReportsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Saved Reports
              </DialogTitle>
              <DialogDescription>
                Load a previously saved report configuration
              </DialogDescription>
            </DialogHeader>

            {savedReports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No saved reports yet. Generate a report and save it.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {savedReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => loadSavedReport(report)}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{report.report_name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          {(report.account_codes || []).length} account(s)
                        </Badge>
                        {report.report_type === "summary" &&
                        resolveSavedSummaryPresentation(report) ? (
                          <Badge variant="secondary" className="text-xs">
                            {
                              SUMMARY_PRESENTATION_LABELS[
                                resolveSavedSummaryPresentation(report)
                              ]
                            }
                          </Badge>
                        ) : report.only_children ? (
                          <Badge variant="secondary" className="text-xs">
                            Only children
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="text-xs capitalize">
                          {report.report_type === "summary"
                            ? "Summary"
                            : "Full"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Created {moment(report.created_at).fromNow()}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSavedReport(report.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={saveReportConfirmOpen}
        onOpenChange={setSaveReportConfirmOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              Save Report Setup
            </DialogTitle>
            <DialogDescription>
              Save account selection and options. Dates are chosen when you run
              the report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <Label htmlFor="save-report-name">Report name</Label>
              <Input
                id="save-report-name"
                value={saveFormName}
                onChange={(e) => setSaveFormName(e.target.value)}
                placeholder="Enter report name"
              />
            </div>

            {reportType === "summary" ? (
              <div className="space-y-2">
                <Label>Summary presentation</Label>
                <RadioGroup
                  value={summaryPresentation}
                  onValueChange={handleSummaryPresentationChange}
                  className="flex flex-col gap-2"
                >
                  <label className="flex cursor-pointer items-center gap-2">
                    <RadioGroupItem value={SUMMARY_PRESENTATION.HEAD} />
                    <span>Head only — parent total (e.g. CYLINDER DEBTORS)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <RadioGroupItem value={SUMMARY_PRESENTATION.BREAKDOWN} />
                    <span>Break down — child account balances only</span>
                  </label>
                </RadioGroup>
                {summaryPresentation === SUMMARY_PRESENTATION.BREAKDOWN && (
                  <div className="space-y-2 pt-1">
                    <Label>Balance filter</Label>
                    <RadioGroup
                      value={breakdownBalanceSide}
                      onValueChange={handleBreakdownBalanceSideChange}
                      className="flex flex-wrap gap-4"
                    >
                      <label className="flex cursor-pointer items-center gap-2">
                        <RadioGroupItem value={SUMMARY_BALANCE_SIDE.ALL} />
                        <span>All balances</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2">
                        <RadioGroupItem value={SUMMARY_BALANCE_SIDE.DR} />
                        <span>Debit (DR) only</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2">
                        <RadioGroupItem value={SUMMARY_BALANCE_SIDE.CR} />
                        <span>Credit (CR) only</span>
                      </label>
                    </RadioGroup>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <Checkbox
                  id="save-only-children"
                  checked={onlyChildren}
                  onCheckedChange={(v) => setOnlyChildren(Boolean(v))}
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="save-only-children" className="cursor-pointer">
                    Only children
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Fetch child account codes only; parent codes with children
                    are excluded.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Report type</Label>
              <RadioGroup
                value={reportType}
                onValueChange={(v) =>
                  setReportType(v === "summary" ? "summary" : "full")
                }
                className="flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="summary" id="save-type-summary" />
                  <Label
                    htmlFor="save-type-summary"
                    className="cursor-pointer font-normal"
                  >
                    Summary — net balance (sum debits − sum credits) per code
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="full" id="save-type-full" />
                  <Label
                    htmlFor="save-type-full"
                    className="cursor-pointer font-normal"
                  >
                    Full — all transaction lines for the period
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <p className="rounded border border-blue-200 bg-blue-50 px-2 py-2 text-xs text-blue-800">
              By default, ledger fetch includes selected account code(s) and all
              child codes in the chart of accounts. Enable only children to skip
              parent codes that have sub-accounts.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setSaveReportConfirmOpen(false)}
                disabled={savingReport}
              >
                Cancel
              </Button>
              <Button onClick={saveReport} disabled={savingReport}>
                {savingReport ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
