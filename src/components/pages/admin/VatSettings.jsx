import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import moment from "moment";
import { ChevronDown, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import PayableSettings from "./PayableSettings";

const MONTH_OPTIONS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((label, i) => ({ value: i + 1, label }));

function vatPeriodStorageKey(facilityId) {
  return `aa_vat_output_period_${facilityId || "default"}`;
}

function vatHistoryStorageKey(facilityId) {
  return `aa_vat_output_history_${facilityId || "default"}`;
}

function monthHistoryKey(year, month) {
  return `${Number(year)}-${String(month).padStart(2, "0")}`;
}

function monthBounds(year, month) {
  const m = moment({ year, month: month - 1, day: 1 });
  return {
    fromDate: m.clone().startOf("month").format("YYYY-MM-DD"),
    toDate: m.clone().endOf("month").format("YYYY-MM-DD"),
  };
}

function readSavedVatPeriod(facilityId) {
  try {
    const raw = localStorage.getItem(vatPeriodStorageKey(facilityId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const year = Number(parsed.year);
    const month = Number(parsed.month);
    if (!Number.isInteger(year) || year < 1990 || year > 2100) return null;
    if (!Number.isInteger(month) || month < 1 || month > 12) return null;
    return {
      year,
      month,
      divisor:
        parsed.divisor != null && String(parsed.divisor).trim() !== ""
          ? String(parsed.divisor)
          : "",
    };
  } catch {
    return null;
  }
}

function normalizeHistoryEntry(raw, fallbackYear, fallbackMonth) {
  if (!raw || typeof raw !== "object") return null;
  const year = Number(raw.year ?? fallbackYear);
  const month = Number(raw.month ?? fallbackMonth);
  if (!Number.isInteger(year) || year < 1990 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  const selectedCodes = Array.isArray(raw.selectedCodes)
    ? raw.selectedCodes.map((c) => String(c || "").trim()).filter(Boolean)
    : [];
  return {
    year,
    month,
    divisor:
      raw.divisor != null && String(raw.divisor).trim() !== ""
        ? String(raw.divisor)
        : "",
    savedAt: raw.savedAt || null,
    generatedAt: raw.generatedAt || null,
    previewedAt: raw.previewedAt || null,
    invoiceCount: Number(raw.invoiceCount || 0) || 0,
    selectedCount: Number(raw.selectedCount || selectedCodes.length) || 0,
    selectedCodes,
    outputVat: Number(raw.outputVat || 0) || 0,
  };
}

function readVatHistory(facilityId) {
  const map = {};
  try {
    const raw = localStorage.getItem(vatHistoryStorageKey(facilityId));
    if (raw) {
      const parsed = JSON.parse(raw);
      const rows = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object"
          ? Object.values(parsed)
          : [];
      for (const row of rows) {
        const entry = normalizeHistoryEntry(row);
        if (!entry?.savedAt) continue;
        map[monthHistoryKey(entry.year, entry.month)] = entry;
      }
    }
  } catch {
    /* ignore broken history */
  }
  const current = readSavedVatPeriod(facilityId);
  if (
    current?.divisor &&
    current.savedAt &&
    !map[monthHistoryKey(current.year, current.month)]
  ) {
    map[monthHistoryKey(current.year, current.month)] = {
      ...current,
      generatedAt: null,
      previewedAt: null,
      invoiceCount: 0,
      selectedCount: 0,
      selectedCodes: [],
      outputVat: 0,
    };
  }
  return map;
}

function historyMapFromApiRows(rows) {
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const entry = normalizeHistoryEntry({
      year: row.year,
      month: row.month,
      divisor: row.divisor,
      savedAt: row.created_at || row.savedAt || new Date().toISOString(),
      generatedAt: row.generated_at || row.generatedAt || null,
      previewedAt: row.previewed_at || row.previewedAt || null,
      invoiceCount: row.invoice_count ?? row.invoiceCount,
      selectedCount: row.selected_count ?? row.selectedCount,
      selectedCodes: row.selected_codes || row.selectedCodes,
      outputVat: row.output_vat ?? row.outputVat,
    });
    if (!entry) return;
    map[monthHistoryKey(entry.year, entry.month)] = entry;
  });
  return map;
}

function monthLabel(year, month) {
  return moment({ year, month: month - 1 }).format("MMMM YYYY");
}

function writeVatHistory(facilityId, map) {
  if (!facilityId) return;
  localStorage.setItem(
    vatHistoryStorageKey(facilityId),
    JSON.stringify(Object.values(map).filter((row) => row?.savedAt)),
  );
}

function MonthYearSelects({ year, month, yearOptions, onYear, onMonth, labelClass }) {
  return (
    <>
      <div>
        <label className={labelClass}>Month</label>
        <select
          value={month}
          onChange={(e) => onMonth(Number(e.target.value))}
          className="border rounded px-2 py-2 text-sm bg-white min-w-[10rem]"
        >
          {MONTH_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Year</label>
        <select
          value={year}
          onChange={(e) => onYear(Number(e.target.value))}
          className="border rounded px-2 py-2 text-sm bg-white min-w-[6.5rem]"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

export default function VatSettings() {
  const navigate = useNavigate();
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const vatAccountCode = String(activeBusiness?.vat_account_code || "").trim();
  const [periodYear, setPeriodYear] = useState(() => {
    const saved = readSavedVatPeriod(activeBusiness?.id);
    return saved?.year || moment().year();
  });
  const [periodMonth, setPeriodMonth] = useState(() => {
    const saved = readSavedVatPeriod(activeBusiness?.id);
    return saved?.month || moment().month() + 1;
  });
  const [periodLoaded, setPeriodLoaded] = useState(() =>
    Boolean(activeBusiness?.id),
  );
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [accountName, setAccountName] = useState("");
  const [testInvoiceRef, setTestInvoiceRef] = useState("");
  const [testDivisor, setTestDivisor] = useState(() => {
    const saved = readSavedVatPeriod(activeBusiness?.id);
    return saved?.divisor || "";
  });
  const [monthInvoices, setMonthInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [selectedInvoiceCodes, setSelectedInvoiceCodes] = useState([]);
  const [testHistory, setTestHistory] = useState(() =>
    readVatHistory(activeBusiness?.id),
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);

  const { fromDate, toDate } = useMemo(
    () => monthBounds(periodYear, periodMonth),
    [periodYear, periodMonth],
  );

  const yearOptions = useMemo(() => {
    const current = moment().year();
    const years = [];
    for (let y = current + 1; y >= current - 12; y -= 1) years.push(y);
    if (!years.includes(periodYear)) years.push(periodYear);
    return [...new Set(years)].sort((a, b) => b - a);
  }, [periodYear]);

  const divisorNum = Number(String(testDivisor || "").replace(/,/g, ""));
  const hasDivisor = Number.isFinite(divisorNum) && divisorNum > 1;

  const fetchMonthInvoices = useCallback(() => {
    if (!activeBusiness?.id) {
      setMonthInvoices([]);
      return;
    }
    setInvoicesLoading(true);
    const collected = [];
    const loadPage = (page) => {
      const params = new URLSearchParams({
        facilityId: String(activeBusiness.id),
        type: "sales",
        page: String(page),
        pageSize: "100",
        fromDate,
        toDate,
      });
      _fetchApi(
        `/api/v1/transactions/get-all-transactions-data?${params.toString()}`,
        (res) => {
          const rows = (res?.results || res?.data || []).filter((inv) =>
            /^INV-\d+$/i.test(String(inv.invoice_ref || "").trim()),
          );
          collected.push(...rows);
          const total = Number(res?.totalCount || collected.length);
          if (rows.length === 100 && collected.length < total && page < 30) {
            loadPage(page + 1);
            return;
          }
          setInvoicesLoading(false);
          setMonthInvoices(collected);
          setSelectedInvoiceCodes((prev) => {
            const keep = new Set(
              collected.map((inv) => String(inv.invoice_ref || "").trim()),
            );
            return prev.filter((code) => keep.has(code));
          });
        },
        () => {
          setInvoicesLoading(false);
          setMonthInvoices(collected);
        },
      );
    };
    loadPage(1);
  }, [activeBusiness?.id, fromDate, toDate]);

  useEffect(() => {
    if (!periodLoaded) return;
    fetchMonthInvoices();
  }, [fetchMonthInvoices, periodLoaded]);

  const visibleMonthInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    if (!q) return monthInvoices;
    return monthInvoices.filter((inv) =>
      [
        inv.invoice_ref,
        inv.customerName,
        inv.ref_number,
        inv.description,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [monthInvoices, invoiceSearch]);

  const visibleCodes = useMemo(
    () =>
      visibleMonthInvoices
        .map((inv) => String(inv.invoice_ref || "").trim())
        .filter(Boolean),
    [visibleMonthInvoices],
  );

  const allVisibleSelected =
    visibleCodes.length > 0 &&
    visibleCodes.every((code) => selectedInvoiceCodes.includes(code));
  const someVisibleSelected =
    visibleCodes.some((code) => selectedInvoiceCodes.includes(code)) &&
    !allVisibleSelected;

  const toggleInvoiceSelected = (code) => {
    const next = String(code || "").trim();
    if (!next) return;
    setSelectedInvoiceCodes((prev) =>
      prev.includes(next) ? prev.filter((c) => c !== next) : [...prev, next],
    );
    setTestInvoiceRef(next);
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visible = new Set(visibleCodes);
      setSelectedInvoiceCodes((prev) => prev.filter((c) => !visible.has(c)));
      return;
    }
    setSelectedInvoiceCodes((prev) => [
      ...new Set([...prev, ...visibleCodes]),
    ]);
  };

  const openQuarterTestCopy = (invoiceRefs) => {
    const codes = (
      Array.isArray(invoiceRefs)
        ? invoiceRefs
        : invoiceRefs
          ? [invoiceRefs]
          : selectedInvoiceCodes.length
            ? selectedInvoiceCodes
            : testInvoiceRef
              ? [testInvoiceRef]
              : []
    )
      .map((code) => String(code || "").trim())
      .filter(Boolean);
    const uniqueCodes = [...new Set(codes)];
    if (!uniqueCodes.length) {
      toast.error("Select one or more sales invoices from the list");
      return;
    }
    const divisor = Number(String(testDivisor || "").replace(/,/g, ""));
    if (!Number.isFinite(divisor) || divisor <= 1) {
      toast.error("Type the divide number, greater than 1. Example: 2, 3, or 4");
      return;
    }
    const params = new URLSearchParams({
      doc: "invoice",
      vat_test_divisor: String(divisor),
    });
    if (uniqueCodes.length === 1) {
      params.set("sale_code", uniqueCodes[0]);
    } else {
      params.set("sale_codes", uniqueCodes.join(","));
    }
    persistPeriod(false);
    upsertMonthHistory({ previewedAt: new Date().toISOString() });
    navigate(`/app/sales/invoice-preview?${params.toString()}`);
  };

  const persistPeriod = useCallback(
    (showToast = false) => {
      if (!activeBusiness?.id) return;
      localStorage.setItem(
        vatPeriodStorageKey(activeBusiness.id),
        JSON.stringify({
          year: periodYear,
          month: periodMonth,
          divisor: testDivisor,
        }),
      );
      if (showToast) {
        toast.success(
          `Saved ${moment({ year: periodYear, month: periodMonth - 1 }).format("MMMM YYYY")}`,
        );
      }
    },
    [activeBusiness?.id, periodYear, periodMonth, testDivisor],
  );

  const upsertMonthHistory = useCallback(
    (extra = {}) => {
      if (!activeBusiness?.id) return;
      const key = monthHistoryKey(periodYear, periodMonth);
      const prev = testHistory[key];
      if (!prev?.savedAt) return;
      const entry = {
        ...prev,
        generatedAt: extra.generatedAt || prev.generatedAt || null,
        previewedAt: extra.previewedAt || prev.previewedAt || null,
      };
      const next = { ...testHistory, [key]: entry };
      setTestHistory(next);
      writeVatHistory(activeBusiness.id, next);
    },
    [activeBusiness?.id, periodYear, periodMonth, testHistory],
  );

  const loadSavedHistory = useCallback(() => {
    if (!activeBusiness?.id) {
      setTestHistory({});
      return;
    }
    _fetchApi(
      `/account/vat-output-test-history?facilityId=${encodeURIComponent(
        activeBusiness.id,
      )}`,
      (res) => {
        if (!res?.success) {
          setTestHistory(readVatHistory(activeBusiness.id));
          return;
        }
        const map = {
          ...readVatHistory(activeBusiness.id),
          ...historyMapFromApiRows(res.results),
        };
        setTestHistory(map);
        writeVatHistory(activeBusiness.id, map);
      },
      () => {
        setTestHistory(readVatHistory(activeBusiness.id));
      },
    );
  }, [activeBusiness?.id]);

  const saveTestCopyHistory = () => {
    if (!activeBusiness?.id) return;
    if (!hasDivisor) {
      toast.error("Type the divide number, greater than 1. Example: 2, 3, or 4");
      return;
    }
    const key = monthHistoryKey(periodYear, periodMonth);
    if (testHistory[key]?.savedAt) {
      toast.error(`${monthLabel(periodYear, periodMonth)} is already saved for this facility`);
      return;
    }
    setSavingHistory(true);
    _postApi(
      "/account/vat-output-test-history",
      {
        facilityId: activeBusiness.id,
        year: periodYear,
        month: periodMonth,
        divisor: String(divisorNum),
        outputVat: Number(summary?.outputVat || 0),
        invoiceCount: monthInvoices.length,
        selectedCount: selectedInvoiceCodes.length,
        selectedCodes: [...selectedInvoiceCodes],
        created_by: user?.id || user?.user_id || "",
      },
      (res) => {
        setSavingHistory(false);
        const entry = historyMapFromApiRows([res?.results || res]);
        const saved = entry[key];
        if (!saved) {
          toast.error("Saved, but history could not be refreshed");
          loadSavedHistory();
          return;
        }
        const next = { ...testHistory, [key]: saved };
        setTestHistory(next);
        writeVatHistory(activeBusiness.id, next);
        persistPeriod(false);
        setHistoryOpen(true);
        toast.success(`Saved ${monthLabel(periodYear, periodMonth)}`);
      },
      (err) => {
        setSavingHistory(false);
        const alreadySaved = String(err?.message || "")
          .toLowerCase()
          .includes("already saved");
        if (alreadySaved) {
          toast.error(
            err.message ||
              `${monthLabel(periodYear, periodMonth)} is already saved for this facility`,
          );
          loadSavedHistory();
          return;
        }
        const localKey = monthHistoryKey(periodYear, periodMonth);
        if (testHistory[localKey]?.savedAt) {
          toast.error(
            `${monthLabel(periodYear, periodMonth)} is already saved for this facility`,
          );
          return;
        }
        const entry = {
          year: periodYear,
          month: periodMonth,
          divisor: String(divisorNum),
          savedAt: new Date().toISOString(),
          generatedAt: null,
          previewedAt: null,
          invoiceCount: monthInvoices.length,
          selectedCount: selectedInvoiceCodes.length,
          selectedCodes: [...selectedInvoiceCodes],
          outputVat: Number(summary?.outputVat || 0),
        };
        const next = { ...testHistory, [localKey]: entry };
        setTestHistory(next);
        writeVatHistory(activeBusiness.id, next);
        persistPeriod(false);
        setHistoryOpen(true);
        toast.success(`Saved ${monthLabel(periodYear, periodMonth)}`);
      },
    );
  };

  const openHistoryMonth = (entry) => {
    if (!entry) return;
    setPeriodYear(entry.year);
    setPeriodMonth(entry.month);
    setTestDivisor(entry.divisor || "");
    setSelectedInvoiceCodes(entry.selectedCodes || []);
    toast.message(`Opened ${monthLabel(entry.year, entry.month)}`);
  };

  const savedHistoryRows = useMemo(
    () =>
      Object.values(testHistory)
        .filter((row) => row?.savedAt)
        .sort((a, b) =>
          a.year !== b.year ? b.year - a.year : b.month - a.month,
        )
        .map((saved) => ({
          month: saved.month,
          year: saved.year,
          label: monthLabel(saved.year, saved.month),
          saved,
        })),
    [testHistory],
  );
  const savedHistoryCount = savedHistoryRows.length;
  const currentPeriodSaved = Boolean(
    testHistory[monthHistoryKey(periodYear, periodMonth)]?.savedAt,
  );

  const openDividedVatReport = () => {
    if (!hasDivisor) {
      toast.error("Type the divide number, greater than 1. Example: 2, 3, or 4");
      return;
    }
    persistPeriod(false);
    upsertMonthHistory({ generatedAt: new Date().toISOString() });
    const params = new URLSearchParams({
      fromDate,
      toDate,
      vat_divisor: String(divisorNum),
    });
    navigate(`/app/sales/vat-report?${params.toString()}`);
  };

  const runFetch = useCallback(() => {
    if (!activeBusiness?.id || !vatAccountCode) {
      setSummary(null);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({
      facilityId: String(activeBusiness.id),
      head: vatAccountCode,
      fromDate,
      toDate,
    });
    _fetchApi(
      `/account/vat-head-position?${params.toString()}`,
      (res) => {
        setLoading(false);
        if (!res?.success) {
          setSummary(null);
          toast.error(res?.message || "Unable to load VAT Recoverable totals");
          return;
        }
        setAccountName(res.description || "VAT Recoverable");
        setSummary({
          inputVat: Number(res.input_vat || 0),
          outputVat: Number(res.output_vat || 0),
          net: Number(res.net || 0),
          amountToPay: Number(res.amount_to_pay || 0),
          recoverable: Number(res.recoverable || 0),
        });
      },
      (err) => {
        console.error(err);
        setLoading(false);
        setSummary(null);
        toast.error("Unable to load VAT Recoverable totals");
      },
    );
  }, [activeBusiness?.id, vatAccountCode, fromDate, toDate]);

  useEffect(() => {
    if (!activeBusiness?.id) {
      setPeriodLoaded(false);
      return;
    }
    const saved = readSavedVatPeriod(activeBusiness.id);
    if (saved) {
      setPeriodYear(saved.year);
      setPeriodMonth(saved.month);
      if (saved.divisor) setTestDivisor(saved.divisor);
    }
    loadSavedHistory();
    setPeriodLoaded(true);
  }, [activeBusiness?.id, loadSavedHistory]);

  useEffect(() => {
    if (!periodLoaded) return;
    runFetch();
  }, [runFetch, periodLoaded]);

  useEffect(() => {
    if (!periodLoaded || !activeBusiness?.id) return;
    persistPeriod(false);
  }, [periodLoaded, persistPeriod, activeBusiness?.id]);

  const periodLabel = useMemo(
    () => moment({ year: periodYear, month: periodMonth - 1 }).format("MMMM YYYY"),
    [periodYear, periodMonth],
  );

  const dividedOutputVat = hasDivisor
    ? (summary?.outputVat || 0) / divisorNum
    : summary?.outputVat || 0;
  const inputVatTotal = summary?.inputVat || 0;
  const outputVatTotal = summary?.outputVat || 0;
  const vatDifference = Math.abs(outputVatTotal - inputVatTotal);
  const vatIsPayable = outputVatTotal - inputVatTotal > 0.005;
  const vatIsCredit = inputVatTotal - outputVatTotal > 0.005;

  const fieldLabel = "text-xs text-gray-600 block mb-1";
  const testFieldLabel = "text-xs font-semibold text-gray-700 block mb-1";

  return (
    <div className="space-y-4">
      <PayableSettings
        title="VAT Recoverable"
        code={vatAccountCode}
        description="Select the VAT Recoverable GL head. Totals below are taken only from that head."
        icon="🧾"
      />

      <Card className="mb-0 overflow-hidden rounded-xl border border-slate-200 shadow-none">
        <div
          className="border-0 px-5 py-3.5 text-white"
          style={{ background: "var(--aa-navy)" }}
        >
          <h5 className="mb-0 fw-bold">VAT position</h5>
          <small className="opacity-75">
            Debits and credits on the selected VAT Recoverable head only
          </small>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <MonthYearSelects
              year={periodYear}
              month={periodMonth}
              yearOptions={yearOptions}
              onYear={setPeriodYear}
              onMonth={setPeriodMonth}
              labelClass={fieldLabel}
            />
            <Button
              type="button"
              onClick={() => persistPeriod(true)}
              disabled={!activeBusiness?.id}
              variant="outline"
              className="border-slate-300"
            >
              Save period
            </Button>
            <Button
              type="button"
              onClick={() => {
                persistPeriod(false);
                runFetch();
                fetchMonthInvoices();
              }}
              disabled={loading || invoicesLoading || !vatAccountCode}
              className="bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading
                </>
              ) : (
                "Refresh"
              )}
            </Button>
          </div>

          {!vatAccountCode ? (
            <p className="text-sm text-slate-500 mb-0">
              Select a VAT Recoverable account above to see Input VAT, Output
              VAT, and whether the position is credit or payable.
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-0">
                Head {vatAccountCode}
                {accountName ? ` · ${accountName}` : ""} · {periodLabel}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-sky-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 mb-1">
                    Total Input VAT
                  </p>
                  <p className="text-xl font-bold tabular-nums text-sky-900 mb-0">
                    ₦{formatNumber1(summary?.inputVat || 0)}
                  </p>
                  <p className="text-xs text-sky-700/80 mt-1 mb-0">
                    Debits on this head (purchases / bills)
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-1">
                    Total Output VAT
                  </p>
                  <p
                    className={`tabular-nums text-emerald-900 mb-0 ${
                      hasDivisor ? "text-sm font-semibold" : "text-xl font-bold"
                    }`}
                  >
                    ₦{formatNumber1(summary?.outputVat || 0)}
                  </p>
                  {hasDivisor ? (
                    <>
                      <p className="text-xs text-emerald-800 mt-1 mb-0">
                        ÷ {divisorNum}
                      </p>
                      <p className="text-xl font-bold tabular-nums text-emerald-900 mb-0">
                        ₦{formatNumber1(dividedOutputVat)}
                      </p>
                      <p className="text-xs text-emerald-700/80 mt-1 mb-0">
                        Divided Total Output VAT
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-emerald-700/80 mt-1 mb-0">
                      Credits on this head (sales invoices)
                    </p>
                  )}
                </div>
                <div
                  className={`rounded-lg border p-4 ${
                    vatIsCredit
                      ? "border-teal-200 bg-teal-50"
                      : vatIsPayable
                        ? "border-amber-200 bg-amber-50"
                        : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                      vatIsCredit
                        ? "text-teal-800"
                        : vatIsPayable
                          ? "text-amber-800"
                          : "text-slate-600"
                    }`}
                  >
                    VAT Recoverable
                  </p>
                  <p
                    className={`text-xl font-bold tabular-nums mb-0 ${
                      vatIsCredit
                        ? "text-teal-900"
                        : vatIsPayable
                          ? "text-amber-900"
                          : "text-slate-800"
                    }`}
                  >
                    ₦{formatNumber1(vatDifference)}
                  </p>
                  <p
                    className={`text-xs mt-1 mb-0 ${
                      vatIsCredit
                        ? "text-teal-800/80"
                        : vatIsPayable
                          ? "text-amber-800/80"
                          : "text-slate-500"
                    }`}
                  >
                    {vatIsPayable
                      ? "Output VAT is higher than Input VAT — payable"
                      : vatIsCredit
                        ? "Input VAT is higher than Output VAT — credit"
                        : "Output VAT and Input VAT are equal"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  to="/app/purchase/input-vat"
                  className="text-sm font-medium"
                  style={{ color: "var(--aa-accent)" }}
                >
                  Open Input VAT report
                </Link>
                <Link
                  to={`/app/sales/vat-report?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`}
                  className="text-sm font-medium"
                  style={{ color: "var(--aa-accent)" }}
                >
                  Open Output VAT (sales)
                </Link>
              </div>
              <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/60 p-4">
                <p className="text-sm font-semibold text-emerald-900 mb-1">
                  VAT output
                </p>
                <p className="text-xs text-emerald-800/80 mb-3">
                  Choose month and year, type the number to divide Total Output
                  VAT by (2 = half, 3 = one third, 4 = one quarter), then
                  generate the Output VAT report or preview invoice copies.
                  This does not post anything to the General Ledger, stock,
                  customer account, or official VAT return.
                </p>
                <div className="flex flex-wrap items-end gap-3 mb-3">
                  <MonthYearSelects
                    year={periodYear}
                    month={periodMonth}
                    yearOptions={yearOptions}
                    onYear={setPeriodYear}
                    onMonth={setPeriodMonth}
                    labelClass={testFieldLabel}
                  />
                  <Button
                    type="button"
                    onClick={saveTestCopyHistory}
                    disabled={
                      !activeBusiness?.id || savingHistory || currentPeriodSaved
                    }
                    variant="outline"
                    className="border-emerald-300 text-emerald-900"
                  >
                    {savingHistory
                      ? "Saving"
                      : currentPeriodSaved
                        ? "Saved"
                        : "Save"}
                  </Button>
                  <div>
                    <label className={testFieldLabel}>
                      Divide Total Output VAT by
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={testDivisor}
                      onChange={(e) =>
                        setTestDivisor(e.target.value.replace(/[^\d.]/g, ""))
                      }
                      placeholder="Type a number e.g. 4"
                      className="border-2 border-emerald-400 rounded px-3 py-2 text-sm bg-white w-40"
                    />
                  </div>
                  <div className="min-w-[14rem] flex-1">
                    <label className="text-xs text-gray-600 block mb-1">
                      Search invoices
                    </label>
                    <input
                      type="text"
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                      placeholder="Invoice or customer"
                      className="border rounded px-3 py-2 text-sm bg-white w-full"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={openDividedVatReport}
                    disabled={invoicesLoading}
                    className="bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white"
                  >
                    {hasDivisor
                      ? `Generate report 1/${testDivisor}`
                      : "Generate report"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => openQuarterTestCopy(selectedInvoiceCodes)}
                    disabled={invoicesLoading}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white"
                  >
                    {hasDivisor
                      ? `Preview selected 1/${testDivisor}`
                      : "Preview selected"}
                    {selectedInvoiceCodes.length
                      ? ` (${selectedInvoiceCodes.length})`
                      : ""}
                  </Button>
                </div>
                <Collapsible
                  open={historyOpen}
                  onOpenChange={setHistoryOpen}
                  className="mb-3 rounded-md border border-emerald-200 bg-white"
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left hover:bg-emerald-50/80"
                      aria-expanded={historyOpen}
                    >
                      <span className="mb-0 flex items-center gap-2 text-sm font-semibold text-emerald-900">
                        <History className="h-4 w-4" />
                        History
                        <span className="font-normal text-xs text-emerald-800/80">
                          {savedHistoryCount
                            ? `${savedHistoryCount} saved`
                            : "None saved yet"}
                        </span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-emerald-800 transition-transform ${
                          historyOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <p className="mb-0 border-t border-emerald-100 px-3 py-1.5 text-xs text-emerald-800/80">
                      Only saved months are listed. Each year and month can be
                      saved once per facility.
                    </p>
                    <div className="max-h-64 overflow-y-auto border-t border-emerald-100">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-emerald-50 text-left text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                        <tr>
                          <th className="px-3 py-2">Month</th>
                          <th className="px-3 py-2">Divide by</th>
                          <th className="px-3 py-2 text-right">
                            Divided Output VAT
                          </th>
                          <th className="px-3 py-2">Saved</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {savedHistoryRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-3 py-6 text-center text-sm text-slate-500"
                            >
                              No saved months yet
                            </td>
                          </tr>
                        ) : (
                          savedHistoryRows.map((row) => {
                          const saved = row.saved;
                          const isCurrent =
                            row.month === periodMonth &&
                            row.year === periodYear;
                          const rowDivisor = Number(
                            String(saved?.divisor || "").replace(/,/g, ""),
                          );
                          const hasRowDivisor =
                            Number.isFinite(rowDivisor) && rowDivisor > 1;
                          const divided =
                            hasRowDivisor && saved
                              ? Number(saved.outputVat || 0) / rowDivisor
                              : null;
                          return (
                            <tr
                              key={`${row.year}-${row.month}`}
                              className={
                                isCurrent
                                  ? "bg-emerald-50"
                                  : "hover:bg-slate-50"
                              }
                            >
                              <td className="px-3 py-2 font-medium text-slate-800">
                                {row.label}
                              </td>
                              <td className="px-3 py-2 tabular-nums text-slate-800">
                                {saved?.divisor ? `1/${saved.divisor}` : "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                                {divided != null
                                  ? `₦${formatNumber1(divided)}`
                                  : "—"}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                                {saved?.savedAt
                                  ? moment(saved.savedAt).format("DD MMM YYYY")
                                  : "Saved"}
                                {saved?.generatedAt ? (
                                  <span className="ml-1 text-[11px] text-emerald-700">
                                    · report
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => openHistoryMonth(saved)}
                                  className="rounded-md border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
                                >
                                  {isCurrent ? "Current" : "Open"}
                                </button>
                              </td>
                            </tr>
                          );
                          })
                        )}
                      </tbody>
                    </table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                <div className="max-h-80 overflow-y-auto rounded-md border border-emerald-200 bg-white">
                  {invoicesLoading ? (
                    <p className="px-3 py-6 text-center text-sm text-slate-500">
                      Loading invoices for {periodLabel}…
                    </p>
                  ) : visibleMonthInvoices.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-slate-500">
                      No sales invoices in this date range.
                    </p>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-emerald-50 text-left text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                        <tr>
                          <th className="px-3 py-2 w-10">
                            <input
                              type="checkbox"
                              checked={allVisibleSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = someVisibleSelected;
                              }}
                              onChange={toggleSelectAllVisible}
                              aria-label="Select all invoices in this list"
                            />
                          </th>
                          <th className="px-3 py-2">Invoice</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Customer</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visibleMonthInvoices.map((inv) => {
                          const code = String(inv.invoice_ref || "").trim();
                          const selected = selectedInvoiceCodes.includes(code);
                          return (
                            <tr
                              key={inv.invoice_id || code}
                              className={`cursor-pointer ${
                                selected ? "bg-emerald-50" : "hover:bg-slate-50"
                              }`}
                              onClick={() => toggleInvoiceSelected(code)}
                            >
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleInvoiceSelected(code)}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`Select ${code}`}
                                />
                              </td>
                              <td className="px-3 py-2 font-mono text-xs font-semibold text-[var(--aa-navy)]">
                                {code}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                                {inv.transaction_date || inv.invoice_date
                                  ? moment(
                                      inv.transaction_date || inv.invoice_date,
                                    ).format("DD MMM YYYY")
                                  : "—"}
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-slate-800">
                                  {inv.customerName || "—"}
                                </div>
                                {inv.ref_number ? (
                                  <div className="font-mono text-[11px] text-slate-400">
                                    {inv.ref_number}
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                                ₦{formatNumber1(inv.amount || 0)}
                                {hasDivisor ? (
                                  <div className="text-[11px] font-medium text-emerald-700">
                                    ÷ {divisorNum} → ₦
                                    {formatNumber1((inv.amount || 0) / divisorNum)}
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTestInvoiceRef(code);
                                    openQuarterTestCopy([code]);
                                  }}
                                  className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
                                >
                                  {hasDivisor
                                    ? `Preview 1/${testDivisor}`
                                    : "Preview"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                <p className="mt-2 mb-0 text-[11px] text-emerald-800/70">
                  {invoicesLoading
                    ? "Loading…"
                    : `${visibleMonthInvoices.length} invoice${
                        visibleMonthInvoices.length === 1 ? "" : "s"
                      } in ${periodLabel}${
                        selectedInvoiceCodes.length
                          ? ` · ${selectedInvoiceCodes.length} selected`
                          : ""
                      }`}
                </p>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
