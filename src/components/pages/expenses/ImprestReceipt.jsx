import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useReactToPrint } from "react-to-print";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import moment from "moment";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";
import { isProductTaxable } from "@/utils/taxableStatus";

function numLike(v) {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * API may return lines_json as array, JSON string, double-encoded string, or
 * object with numeric keys / { lines: [...] } (MySQL/Sequelize).
 */
function coerceLinesJson(row) {
  let raw = row?.lines_json ?? row?.linesJson;
  if (raw == null) return [];
  if (typeof raw === "string" && raw.trim() !== "") {
    try {
      raw = JSON.parse(raw);
      if (typeof raw === "string" && raw.trim() !== "") {
        try {
          raw = JSON.parse(raw);
        } catch {
          /* keep single parse */
        }
      }
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    if (raw.length === 1 && Array.isArray(raw[0])) raw = raw[0];
    return raw.filter((x) => x != null && typeof x === "object");
  }
  if (typeof raw === "object") {
    if (Array.isArray(raw.lines))
      return raw.lines.filter((x) => x != null && typeof x === "object");
    return Object.values(raw).filter((x) => x != null && typeof x === "object");
  }
  return [];
}

function coercePaymentMeta(row) {
  const raw = row?.payment_meta_json ?? row?.paymentMetaJson;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? raw : {};
}

/** `account_bank_type` is often a short numeric code (e.g. "00") — not a display name. */
function isPlausibleBankName(value) {
  const s = String(value ?? "").trim();
  if (!s) return false;
  if (/^0+$/.test(s)) return false;
  if (/^[0-9]{1,4}$/.test(s)) return false;
  return true;
}

function formatVatPolicyLabel(raw) {
  const s = String(raw || "")
    .trim()
    .replace(/_/g, " ");
  if (!s) return "";
  if (s.toLowerCase() === "all") return "All (per tax line)";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function imprestHeaderDate(row) {
  if (!row?.transaction_date) return "—";
  const d = moment(row.transaction_date).format("MMMM D, YYYY");
  const created = row.created_at || row.createdAt;
  if (created) {
    return `${d} at ${moment(created).format("hh:mm A")}`;
  }
  return d;
}

/** Pipe-separated row like sales “Bill To” — label bold, value regular. */
function buildModeOfPaymentSegments(
  row,
  meta,
  { isCash, isBankLike, bankInstitutionDisplay },
) {
  const segs = [];
  segs.push({
    label: "Mode:",
    value: String(row?.mode_of_payment || "—").toUpperCase(),
  });

  if (isCash) {
    segs.push({
      label: "Cash at hand:",
      value: meta.cash_account_description || meta.payment_account_label || "—",
    });
    const gl = meta.cash_account_head || meta.gl_payment_code;
    if (gl) segs.push({ label: "GL code:", value: String(gl) });
  } else if (isBankLike) {
    if (bankInstitutionDisplay) {
      segs.push({ label: "Bank:", value: bankInstitutionDisplay });
    }
    if (meta.bank_code || meta.bankCode) {
      segs.push({
        label: "Bank code:",
        value: String(meta.bank_code || meta.bankCode),
      });
    }
    if (meta.bank_account_name || meta.payment_account_label) {
      segs.push({
        label: "Account name:",
        value: meta.bank_account_name || meta.payment_account_label || "—",
      });
    }
    if (meta.bank_account_number || meta.bankAccountNumber) {
      segs.push({
        label: "Account no.:",
        value: meta.bank_account_number || meta.bankAccountNumber || "—",
      });
    }
    if (meta.gl_payment_code || meta.payment_head) {
      segs.push({
        label: "GL head:",
        value: meta.gl_payment_code || meta.payment_head || "—",
      });
    }
    if (row?.cheque_number) {
      segs.push({ label: "Cheque no.:", value: row.cheque_number });
    }
  } else if (meta.payment_account_label || meta.gl_payment_code) {
    segs.push({
      label: "Paid from:",
      value: meta.payment_account_label || meta.gl_payment_code || "—",
    });
  }

  if (meta.vat_policy) {
    segs.push({
      label: "VAT policy:",
      value: formatVatPolicyLabel(meta.vat_policy),
    });
  }
  return segs;
}

/**
 * Printable imprest / direct-expense receipt (DE ref).
 * Header styling aligned with expense bill PDF (blue bar + company block).
 */
export default function ImprestReceipt() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ref = searchParams.get("ref") || "";
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const company = activeBusiness || {};

  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef(null);

  const load = useCallback(() => {
    if (!activeBusiness?.id || !ref) {
      setLoading(false);
      return;
    }
    setLoading(true);
    _fetchApi(
      `/account/impress/one?facilityId=${encodeURIComponent(activeBusiness.id)}&ref=${encodeURIComponent(ref)}`,
      (res) => {
        setLoading(false);
        if (res?.success && res.data) {
          setRow(res.data);
        } else {
          toast.error(res?.message || "Could not load receipt");
          setRow(null);
        }
      },
      () => {
        setLoading(false);
        toast.error("Could not load receipt");
        setRow(null);
      },
    );
  }, [activeBusiness?.id, ref]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReactToPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Imprest-${ref || "N/A"}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 0 !important;
      }
      html {
        margin: 0 !important;
        padding: 0 !important;
      }
      body {
        width: 100% !important;
        min-height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      /* Flush to top of paper — react-to-print iframe defaults */
      body > *:first-child {
        margin-top: 0 !important;
      }
      .imprest-receipt-print {
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        box-shadow: none !important;
      }
      .imprest-receipt-print * {
        box-sizing: border-box;
      }
      .no-print { display: none !important; }
    `,
    onBeforeGetContent: () => {
      return new Promise((resolve) => {
        if (!printRef.current) {
          toast.error("Receipt is not ready to print yet.");
          resolve();
          return;
        }
        setTimeout(() => resolve(), 100);
      });
    },
    onPrintError: (error) => {
      console.error("Print failed:", error);
      toast.error("Unable to print receipt. Please try again.");
    },
  });

  const handlePrint = useCallback(() => {
    if (!printRef.current) {
      toast.error("Receipt is not ready to print yet.");
      return;
    }
    try {
      handleReactToPrint();
    } catch (e) {
      console.error("Print error:", e);
      toast.error("Unable to print receipt. Please try again.");
    }
  }, [handleReactToPrint]);

  const meta = useMemo(() => coercePaymentMeta(row), [row]);

  const modeLower = String(row?.mode_of_payment || "").toLowerCase();
  const isCash = modeLower === "cash";
  const isBankLike = modeLower === "bank" || modeLower === "cheque";

  const lines = useMemo(() => {
    const parsed = coerceLinesJson(row);
    if (parsed.length > 0) return parsed;
    const lineCount = row?.line_count ?? row?.lineCount ?? 0;
    const totalExp =
      row?.total_expense ??
      row?.totalExpense ??
      row?.total_payment ??
      row?.totalPayment;
    if (row && (numLike(lineCount) > 0 || numLike(totalExp) > 0)) {
      return [
        {
          _line_index: 1,
          _amount: numLike(totalExp),
          description: row.remark || "Expense line (detail not stored)",
          item_name: "Line total",
          quantity: 1,
          qty: 1,
          cost: numLike(totalExp),
          rate: numLike(totalExp),
          head: meta.gl_payment_code || meta.payment_head || "",
        },
      ];
    }
    return [];
  }, [row, meta.gl_payment_code, meta.payment_head]);

  
  /** Prefer stored total; if zero, sum line `_vat_amount` (older rows). */
  const displayVatAmount = useMemo(() => {
    const tv = numLike(row?.total_vat ?? row?.totalVat);
    if (tv > 0) return tv;
    return lines.reduce(
      (s, ln) => s + numLike(ln._vat_amount ?? ln._vatAmount),
      0,
    );
  }, [row, lines]);

  /** Unique tax labels from line snapshots (name + rate · Inc/Exc), for totals row */
  const receiptVatSummaryLabel = useMemo(() => {
    const labels = lines
      .map((ln) => ln._tax_detail || ln._taxDetail)
      .filter(Boolean);
    const unique = [...new Set(labels)];
    if (unique.length === 1) return unique[0];
    if (unique.length > 1) return unique.join(" · ");
    return null;
  }, [lines]);

  const vatFootnote = useMemo(() => {
    if (!row) return null;
    if (displayVatAmount > 0) return null;
    const hasTaxable = lines.some(
      (ln) =>
        isProductTaxable(ln.taxable) ||
        ln.taxable === true ||
        String(ln.taxable || "").toLowerCase() === "taxable",
    );
    if (!hasTaxable) return null;
    const pol = String(meta.vat_policy || "").toLowerCase();
    if (pol.includes("inclusive") || pol === "vat_inclusive")
      return "VAT is included in the line amounts (inclusive tax).";
    if (pol.includes("exclusive") || pol === "vat_exclusive")
      return "No VAT charged on these lines (exempt or zero rate).";
    if (pol === "all" || pol.includes("all"))
      return "VAT follows each line’s tax setup; amounts shown may include or exclude VAT per line.";
    return null;
  }, [row, meta.vat_policy, lines, displayVatAmount]);

  const bankInstitutionDisplay = useMemo(() => {
    const raw = meta.bank_institution || meta.bankInstitution || "";
    return isPlausibleBankName(raw) ? String(raw).trim() : null;
  }, [meta.bank_institution, meta.bankInstitution]);

  const modeOfPaymentSegments = useMemo(() => {
    if (!row) return [];
    return buildModeOfPaymentSegments(row, meta, {
      isCash,
      isBankLike,
      bankInstitutionDisplay,
    });
  }, [row, meta, isCash, isBankLike, bankInstitutionDisplay]);

  const preparedByName =
    meta.created_by_name ||
    meta.createdByName ||
    (row?.user_id ? `User ref: ${String(row.user_id)}` : "—");

  const preparedDate = (() => {
    if (row?.created_at || row?.createdAt) {
      return moment(row.created_at || row.createdAt).format("DD/MM/YYYY");
    }
    if (row?.transaction_date) {
      return moment(row.transaction_date).format("DD/MM/YYYY");
    }
    return "—";
  })();

  /** Light header strip + white body — used for mode, narration, footer shell */
  const sectionBar =
    "bg-sky-100 border-b border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-900 uppercase tracking-wide";
  const sectionBody = "bg-white px-2.5 py-1.5 text-xs text-gray-800 leading-snug";

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-2">
      <div className="max-w-5xl mx-auto mb-3 flex flex-wrap gap-2 items-center justify-between no-print">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(-1)}
          className="gap-1"
        >
          <X className="h-4 w-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={handlePrint}
          disabled={!row || loading}
          className="gap-1 bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)]"
        >
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>

      <div
        ref={printRef}
        className="imprest-receipt-print max-w-5xl mx-auto w-full overflow-hidden rounded-sm border border-gray-200 bg-white shadow-sm print:m-0 print:mx-0 print:w-full print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
      >
        <BusinessDocumentHeader
          business={company}
          title="Imprest Receipt"
          numberLabel={`No: ${row?.reference_display || ref || "—"}`}
          date={row ? imprestHeaderDate(row) : "—"}
          className="mb-0 rounded-none print:pt-0 [print-color-adjust:exact] [-webkit-print-color-adjust:exact]"
        />

        {/* ——— 2. Mode, lines, totals — same horizontal padding end-to-end ——— */}
        <div className="space-y-2 bg-white p-3 pb-4 md:p-4 md:pb-5 print:p-0">
          {loading && (
            <p className="text-sm text-gray-600">Loading receipt…</p>
          )}
          {!loading && !row && (
            <p className="text-sm text-red-600">Receipt not found.</p>
          )}
          {row && (
            <>
              {modeOfPaymentSegments.length > 0 && (
                <section className="overflow-hidden rounded-sm border border-blue-200">
                  <div className={sectionBar}>Mode of payment</div>
                  <div className={sectionBody}>
                    {modeOfPaymentSegments.map((seg, i) => (
                      <span key={`${seg.label}-${i}`}>
                        {i > 0 && (
                          <span className="mx-1 select-none text-gray-400">
                            |
                          </span>
                        )}
                        <span className="font-semibold text-gray-600">
                          {seg.label}
                        </span>{" "}
                        <span className="text-gray-900">{seg.value}</span>
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {row.remark && (
                <section className="overflow-hidden rounded-sm border border-blue-200">
                  <div className={sectionBar}>Narration</div>
                  <div className={sectionBody}>{row.remark}</div>
                </section>
              )}

              <div className="overflow-x-auto rounded-sm border border-slate-300">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[var(--aa-doc-header,var(--aa-navy,#1a2d5e))] text-white">
                      <th className="w-10 border-r border-[var(--aa-accent)] px-1.5 py-1.5 text-center text-xs font-semibold">
                        #
                      </th>
                      <th className="border-r border-[var(--aa-accent)] px-1.5 py-1.5 text-left text-xs font-semibold">
                        Account / description
                      </th>
                      <th className="w-24 border-r border-[var(--aa-accent)] px-1.5 py-1.5 text-center text-xs font-semibold">
                        Qty
                      </th>
                      <th className="w-28 border-r border-[var(--aa-accent)] px-1.5 py-1.5 text-right text-xs font-semibold">
                        Unit
                      </th>
                      <th className="w-32 px-1.5 py-1.5 text-right text-xs font-semibold">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {lines.map((ln, idx) => {
                      const q =
                        ln.quantity ??
                        ln.qty ??
                        (parseFloat(String(ln.quantity || "1")) || 1);
                      const unit =
                        ln.cost ??
                        ln.rate ??
                        (parseFloat(String(ln.unitCost || "0")) || 0);
                      const lineAmt =
                        ln._amount != null
                          ? Number(ln._amount)
                          : Number(q) * Number(unit);
                      const taxNote =
                        isProductTaxable(ln.taxable) || ln.taxable === true
                          ? "Taxable"
                          : ln.tax_id
                            ? `Tax ID ${ln.tax_id}`
                            : null;
                      return (
                        <tr
                          key={idx}
                          className="border-b border-gray-200 odd:bg-gray-50/50"
                        >
                          <td className="border-r border-gray-200 px-1.5 py-1.5 text-center tabular-nums align-top">
                            {ln._line_index ?? idx + 1}
                          </td>
                          <td className="border-r border-gray-200 px-1.5 py-1.5 align-top">
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                              <span className="font-medium text-gray-900">
                                {ln.item_name || ln.description || "—"}
                              </span>
                              {taxNote && (
                                <span className="inline-flex shrink-0 align-middle rounded border border-amber-200/80 bg-amber-100 px-1 py-px text-[9px] font-semibold uppercase leading-none tracking-wide text-amber-900">
                                  {taxNote}
                                </span>
                              )}
                            </div>
                            {ln.head && (
                              <div className="mt-0.5 font-mono text-xs text-gray-600">
                                GL head: {ln.head}
                              </div>
                            )}
                          </td>
                          <td className="border-r border-gray-200 px-1.5 py-1.5 text-center tabular-nums align-top">
                            {formatNumber1(q)}
                          </td>
                          <td className="border-r border-gray-200 px-1.5 py-1.5 text-right tabular-nums align-top">
                            ₦{formatNumber1(unit)}
                          </td>
                          <td className="px-1.5 py-1.5 text-right font-medium tabular-nums text-gray-900 align-top">
                            <div>₦{formatNumber1(lineAmt)}</div>
                            {numLike(ln._vat_amount ?? ln._vatAmount) > 0 && (
                              <div className="mt-0.5 text-[10px] font-normal leading-snug text-slate-600">
                                {ln._tax_detail || ln._taxDetail ? (
                                  <>
                                    <span className="block font-medium text-slate-700">
                                      {ln._tax_detail || ln._taxDetail}
                                    </span>
                                    <span className="tabular-nums">
                                      VAT ₦
                                      {formatNumber1(
                                        numLike(
                                          ln._vat_amount ?? ln._vatAmount,
                                        ),
                                      )}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    VAT ₦
                                    {formatNumber1(
                                      numLike(
                                        ln._vat_amount ?? ln._vatAmount,
                                      ),
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-b border-gray-200 bg-slate-50/80 font-semibold print:bg-white">
                      <td className="border-r border-gray-200 px-1.5 py-1.5" />
                      <td className="border-r border-gray-200 px-1.5 py-1.5" />
                      <td
                        colSpan={2}
                        className="border-r border-gray-200 px-2 py-1.5 text-right text-[11px] font-bold uppercase tracking-wide text-gray-800"
                      >
                        Subtotal:
                      </td>
                      <td className="px-1.5 py-1.5 text-right text-xs font-bold tabular-nums text-gray-900">
                        ₦
                        {formatNumber1(
                          row.total_expense ?? row.totalExpense ?? 0,
                        )}
                      </td>
                    </tr>
                    {displayVatAmount > 0 && (
                      <tr className="border-b border-gray-200 bg-slate-50/80 font-semibold print:bg-white">
                        <td className="border-r border-gray-200 px-1.5 py-1.5" />
                        <td className="border-r border-gray-200 px-1.5 py-1.5 align-top text-[10px] font-normal leading-snug text-amber-900/90">
                          {vatFootnote ? vatFootnote : null}
                        </td>
                        <td
                          colSpan={2}
                          className="border-r border-gray-200 px-2 py-1.5 text-right text-[10px] font-bold leading-snug text-gray-800"
                        >
                          {receiptVatSummaryLabel || "Tax (VAT)"}
                        </td>
                        <td className="px-1.5 py-1.5 text-right text-xs font-bold tabular-nums text-gray-900">
                          ₦{formatNumber1(displayVatAmount)}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-emerald-700/30 bg-emerald-600 text-white print:bg-emerald-700 [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
                      <td className="border-r border-white/25 px-1.5 py-1.5" />
                      <td className="border-r border-white/25 px-1.5 py-1.5" />
                      <td
                        colSpan={2}
                        className="border-r border-white/25 px-2 py-1.5 text-right text-xs font-bold uppercase tracking-wide"
                      >
                        Grand total:
                      </td>
                      <td className="px-1.5 py-1.5 text-right text-sm font-bold tabular-nums">
                        ₦
                        {formatNumber1(
                          row.total_payment ?? row.totalPayment ?? 0,
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-2 border-t border-slate-200 pt-2 print:mt-1.5 print:pt-1.5">
                <section className="overflow-hidden rounded-sm border border-blue-200">
                  <div className={sectionBar}>Prepared Details</div>
                  <div className="flex flex-col gap-3 bg-white px-2.5 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1 text-xs leading-snug text-gray-800">
                      <p>
                        <span className="font-semibold text-gray-600">
                          Prepared By:
                        </span>{" "}
                        {preparedByName}
                      </p>
                      {preparedDate ? (
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          {preparedDate}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-center sm:items-end">
                      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
                        Signature
                      </p>
                      <div className="inline-flex rounded-full border border-blue-200 bg-sky-50 px-3 py-1 shadow-sm">
                        <span className="text-center text-xs font-bold text-blue-900">
                          FOR{" "}
                          {company?.business_name ||
                            company?.name ||
                            "Business"}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 0; size: A4; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .imprest-receipt-print {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
