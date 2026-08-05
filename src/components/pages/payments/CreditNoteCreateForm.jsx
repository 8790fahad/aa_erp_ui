import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import moment from "moment";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { Typeahead } from "react-bootstrap-typeahead";
import "react-bootstrap-typeahead/css/Typeahead.css";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import {
  formatNumberWithCommas,
  parseNumberFromFormatted,
} from "@/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Zoho Books–style create form.
 * Party first (Customer / Vendor) → date / subject → line items → Save as Open.
 * Invoice is optional (can apply credit later).
 */
export default function CreditNoteCreateForm({
  embedded = false,
  onCancel,
  onCreated,
  forcedParty,
} = {}) {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [searchParams] = useSearchParams();
  const partyParam = String(
    forcedParty || searchParams.get("party") || "",
  ).toLowerCase();
  const isVendor =
    partyParam === "vendor" || partyParam === "supplier";
  const type = isVendor ? "supplier" : "customer";
  const labels = isVendor
    ? {
        title: "New Vendor Credit",
        party: "Vendor Name",
        partyPlaceholder: "Select a vendor",
        number: "Credit Note#",
        date: "Vendor Credit Date",
        balanceAccount: "Accounts Payable",
        save: "Save as Open",
      }
    : {
        title: "New Credit Note",
        party: "Customer Name",
        partyPlaceholder: "Select a customer",
        number: "Credit Note#",
        date: "Credit Note Date",
        balanceAccount: "Accounts Receivable",
        save: "Save as Open",
      };

  const facilityId = activeBusiness?.id;
  const userId = user?.id || user?.email;

  const [loading, setLoading] = useState(false);
  const [loadingNumber, setLoadingNumber] = useState(false);
  const [creditNoteNumber, setCreditNoteNumber] = useState("");
  const [parties, setParties] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedParty, setSelectedParty] = useState([]);
  const [date, setDate] = useState(moment().format("YYYY-MM-DD"));
  const [subject, setSubject] = useState("");
  const [reference, setReference] = useState("");
  const [outcome, setOutcome] = useState("credits"); // credits | refund
  const [refundMode, setRefundMode] = useState("bank"); // cash | bank
  const [refundBankAccount, setRefundBankAccount] = useState(null);
  const [refundCashHead, setRefundCashHead] = useState(null);
  const [bankList, setBankList] = useState([]);
  const [cashHeads, setCashHeads] = useState([]);
  const [lineItems, setLineItems] = useState([emptyLine()]);

  const numberQueryType = isVendor
    ? "credit_note_supplier"
    : "credit_note_customer";
  const numberPrefix = isVendor ? "CN-S" : "CN-C";

  const reserveNoteNumber = useCallback(() => {
    if (!facilityId) return;
    setLoadingNumber(true);
    _fetchApi(
      `/get-and-update/${numberQueryType}/${facilityId}`,
      (resp) => {
        setLoadingNumber(false);
        if (resp?.success && resp.results != null) {
          const seq = String(resp.results).padStart(4, "0");
          setCreditNoteNumber(
            `${numberPrefix}-${moment().format("YY")}-${seq}`,
          );
        } else {
          toast.error("Failed to generate credit note number");
          setCreditNoteNumber("");
        }
      },
      () => {
        setLoadingNumber(false);
        toast.error("Failed to generate credit note number");
        setCreditNoteNumber("");
      },
    );
  }, [facilityId, numberQueryType, numberPrefix]);

  useEffect(() => {
    reserveNoteNumber();
  }, [reserveNoteNumber]);

  const partyOptions = useMemo(
    () =>
      parties.map((p) => ({
        id: p.id,
        label: p.label,
        ...p,
      })),
    [parties],
  );

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        id: a.code,
        label: `${a.code} — ${a.name}`,
        code: a.code,
        name: a.name,
      })),
    [accounts],
  );

  const loadParties = useCallback(() => {
    if (!facilityId) return;
    if (isVendor) {
      _fetchApi(
        `/api/suppliers?facilityId=${facilityId}&limit=1000`,
        (resp) => {
          const raw =
            resp?.results ||
            resp?.data?.results ||
            resp?.data?.suppliers ||
            resp?.data ||
            resp?.suppliers ||
            [];
          const list = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.rows)
              ? raw.rows
              : [];
          setParties(
            list.map((s) => ({
              id: s.supplier_number || s.supplierNo,
              label:
                s.supplier_name ||
                s.company_name ||
                s.supplier_number ||
                "Supplier",
            })),
          );
        },
        () => setParties([]),
      );
    } else {
      _fetchApi(
        `/api/v1/get-customers-list/${facilityId}`,
        (resp) => {
          const list = resp?.results || resp?.data || resp?.customers || [];
          setParties(
            (Array.isArray(list) ? list : []).map((c) => ({
              id: c.customerNo || c.customer_no,
              label:
                c.fullname ||
                c.company_name ||
                c.store_name ||
                c.customerNo ||
                "Customer",
            })),
          );
        },
        () => setParties([]),
      );
    }
  }, [facilityId, isVendor]);

  const loadAccounts = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/account/account-categories?facilityId=${facilityId}`,
      (response) => {
        if (response.success && response.flat) {
          setAccounts(
            response.flat
              .map((item) => ({
                code: item.code || item.head,
                name: item.description || item.code || item.head,
              }))
              .filter((a) => a.code && String(a.code) !== "0"),
          );
        }
      },
      () => setAccounts([]),
    );
  }, [facilityId]);

  const loadProducts = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/api/products?facilityId=${facilityId}`,
      (resp) => {
        const list = resp?.results || resp?.data || [];
        setProducts(Array.isArray(list) ? list : []);
      },
      () => setProducts([]),
    );
  }, [facilityId]);

  useEffect(() => {
    loadParties();
    loadAccounts();
    loadProducts();
  }, [loadParties, loadAccounts, loadProducts]);

  useEffect(() => {
    if (!facilityId || outcome !== "refund") return;
    if (refundMode === "bank") {
      _fetchApi(
        `/api/get/bank-accounts?facilityId=${facilityId}`,
        (data) => {
          const list = data?.results || data?.data || [];
          setBankList(Array.isArray(list) ? list : []);
          if (!refundBankAccount && Array.isArray(list) && list[0]) {
            setRefundBankAccount(list[0]);
          }
        },
        () => setBankList([]),
      );
    } else {
      _postApi(
        `/inventory/product-list?query_type=cash`,
        { facilityId },
        (resp) => {
          const list = resp?.results || [];
          setCashHeads(Array.isArray(list) ? list : []);
          if (!refundCashHead && Array.isArray(list) && list[0]) {
            setRefundCashHead(list[0]);
          }
        },
        () => setCashHeads([]),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload when mode/outcome changes
  }, [facilityId, outcome, refundMode]);

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce(
      (s, row) => s + (Number(row.amount) || 0),
      0,
    );
    return {
      subtotal,
      total: subtotal,
    };
  }, [lineItems]);

  const updateLine = (idx, patch) => {
    setLineItems((rows) =>
      rows.map((r, i) => {
        if (i !== idx) return r;
        const next = { ...r, ...patch };
        const qty = parseFloat(parseNumberFromFormatted(String(next.quantity ?? "0"))) || 0;
        const rate = parseFloat(parseNumberFromFormatted(String(next.rate ?? "0"))) || 0;
        next.amount = Number((qty * rate).toFixed(2));
        return next;
      }),
    );
  };

  const addLine = () => setLineItems((rows) => [...rows, emptyLine()]);
  const removeLine = (idx) =>
    setLineItems((rows) =>
      rows.length <= 1 ? rows : rows.filter((_, i) => i !== idx),
    );

  const pickProduct = (idx, product) => {
    if (!product) {
      updateLine(idx, { product: null, description: "", account: null });
      return;
    }
    const accCode =
      product.revenue_account ||
      product.cogs_head ||
      product.inventory_account ||
      "";
    const acc = accounts.find((a) => String(a.code) === String(accCode));
    updateLine(idx, {
      product,
      description: product.name || "",
      rate: String(product.selling_price ?? product.cost_price ?? "0"),
      quantity: "1",
      account: acc
        ? { code: acc.code, description: acc.name, head: acc.code }
        : accCode
          ? { code: accCode, description: accCode, head: accCode }
          : null,
      lineKind: product.item_type === "service" ? "service" : "product",
    });
  };

  const handleClose = () => {
    if (typeof onCancel === "function") onCancel();
  };

  const handleSaveOpen = () => {
    if (loading) return;
    const party = selectedParty[0];
    if (!party?.id) {
      toast.error(`Select a ${isVendor ? "vendor" : "customer"}`);
      return;
    }
    if (!creditNoteNumber) {
      toast.error("Credit note number is missing — regenerate and try again");
      return;
    }
    if (!date) {
      toast.error("Date is required");
      return;
    }
    const validLines = lineItems.filter(
      (l) =>
        (l.description || "").trim() &&
        l.account?.code &&
        (Number(l.amount) || 0) > 0,
    );
    if (!validLines.length) {
      toast.error("Add at least one line with item/description, account, qty and rate");
      return;
    }
    if (totals.total <= 0) {
      toast.error("Total must be greater than 0");
      return;
    }

    setLoading(true);
    const reason =
      subject.trim() ||
      (isVendor
        ? "Vendor credit — returns, adjustments, or rebate"
        : "Credit note — returns, refunds, or invoice corrections");

    const payload = {
      facilityId,
      userId,
      type,
      creditNoteNumber,
      customerId: type === "customer" ? party.id : null,
      supplierId: type === "supplier" ? party.id : null,
      date,
      reference: reference.trim() || null,
      reason,
      reasonCategory: "DISCOUNT",
      paymentAdjustmentMethod:
        outcome === "refund" ? "refund_bank" : "offset_outstanding",
      discount: { type: "fixed", scope: "document", value: totals.total },
      lineItems: validLines.map((item) => ({
        account: item.account,
        description: item.description.trim(),
        quantity:
          parseFloat(parseNumberFromFormatted(String(item.quantity ?? "1"))) ||
          1,
        rate:
          parseFloat(parseNumberFromFormatted(String(item.rate ?? "0"))) || 0,
        amount: Number(item.amount) || 0,
        lineKind: item.lineKind || "service",
      })),
      subtotal: totals.subtotal,
      vatAmount: 0,
      totalAmount: totals.total,
      vatRate: 0,
    };

    if (outcome === "refund") {
      payload.refundModeOfPayment = refundMode;
      if (refundMode === "bank") {
        if (!refundBankAccount?.id && !refundBankAccount?.head) {
          toast.error("Select a bank account for the refund");
          return;
        }
        payload.refundBankAccountId = refundBankAccount.id;
        payload.refundBankAccountName =
          refundBankAccount.account_name ||
          refundBankAccount.bank_name ||
          refundBankAccount.head;
        payload.refundBankAccount = refundBankAccount;
      } else {
        const head =
          refundCashHead?.head ||
          refundCashHead?.code ||
          refundCashHead?.account_head;
        if (!head) {
          toast.error("Select a cash account for the refund");
          return;
        }
        payload.refundAccountHead = {
          head,
          description:
            refundCashHead.description ||
            refundCashHead.name ||
            refundCashHead.head,
        };
      }
    }

    _postApi(
      "/api/credit-notes",
      payload,
      (response) => {
        setLoading(false);
        if (response.success) {
          const cnNo = response.data?.creditNoteNumber;
          const closed = response.data?.status === "closed";
          toast.success(
            outcome === "refund"
              ? `${isVendor ? "Vendor credit" : "Credit note"} ${cnNo} refunded${closed ? " and closed" : ""}`
              : `${isVendor ? "Vendor credit" : "Credit note"} ${cnNo} saved as open credits`,
          );
          if (typeof onCreated === "function") onCreated(cnNo);
        } else {
          toast.error(
            response.message ||
              `Failed to create ${isVendor ? "vendor credit" : "credit note"}`,
          );
        }
      },
      (error) => {
        setLoading(false);
        toast.error(
          error?.message ||
            `Failed to create ${isVendor ? "vendor credit" : "credit note"}`,
        );
      },
    );
  };

  return (
    <div
      className={
        embedded
          ? "rounded-lg border border-slate-200 bg-white"
          : "mx-auto max-w-5xl rounded-lg border border-slate-200 bg-white shadow-sm"
      }
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-xl font-semibold text-slate-900">{labels.title}</h2>
        <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-5 px-5 py-5">
        {/* Header fields — Zoho layout */}
        <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start">
          <Label className="pt-2 text-sm text-slate-600">
            {labels.party} <span className="text-red-500">*</span>
          </Label>
          <Typeahead
            id="cn-party"
            labelKey="label"
            options={partyOptions}
            selected={selectedParty}
            onChange={setSelectedParty}
            placeholder={labels.partyPlaceholder}
            clearButton
          />

          <Label className="pt-2 text-sm text-slate-600">
            {labels.number} <span className="text-red-500">*</span>
          </Label>
          <div className="flex max-w-md flex-col gap-1">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={
                  loadingNumber
                    ? "Generating…"
                    : creditNoteNumber || "—"
                }
                className="bg-slate-50 font-mono font-semibold text-slate-900"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                title="Regenerate from number generator"
                disabled={loadingNumber}
                onClick={reserveNoteNumber}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loadingNumber ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">
              From number generator ({numberQueryType})
            </p>
          </div>

          <Label className="pt-2 text-sm text-slate-600">Reference</Label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Optional invoice / order number"
          />

          <Label className="pt-2 text-sm text-slate-600">
            {labels.date} <span className="text-red-500">*</span>
          </Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="max-w-xs"
          />

          <Label className="pt-2 text-sm text-slate-600">Subject</Label>
          <Textarea
            value={subject}
            onChange={(e) => setSubject(e.target.value.slice(0, 250))}
            placeholder="Enter a subject within 250 characters"
            rows={2}
            className="resize-none"
          />

          <Label className="pt-2 text-sm text-slate-600">
            {labels.balanceAccount}
          </Label>
          <Input
            disabled
            value={labels.balanceAccount}
            className="max-w-md bg-slate-50 text-slate-600"
          />
        </div>

        {/* Outcome — Zoho lifecycle: Refund vs Credits */}
        <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            After save
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOutcome("credits")}
              className={`rounded-md border px-3 py-2 text-left text-sm ${
                outcome === "credits"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <div className="font-medium">Credits</div>
              <div
                className={`text-[11px] ${
                  outcome === "credits" ? "text-slate-300" : "text-slate-500"
                }`}
              >
                Keep open → apply to future{" "}
                {isVendor ? "bills" : "invoices"}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setOutcome("refund")}
              className={`rounded-md border px-3 py-2 text-left text-sm ${
                outcome === "refund"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <div className="font-medium">Refund</div>
              <div
                className={`text-[11px] ${
                  outcome === "refund" ? "text-slate-300" : "text-slate-500"
                }`}
              >
                Pay out now via cash / bank (closes note)
              </div>
            </button>
          </div>

          {outcome === "refund" && (
            <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-slate-600">Mode</Label>
                <select
                  className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                  value={refundMode}
                  onChange={(e) => setRefundMode(e.target.value)}
                >
                  <option value="bank">Bank transfer</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              {refundMode === "bank" ? (
                <div>
                  <Label className="text-xs text-slate-600">Bank account</Label>
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                    value={refundBankAccount?.id || ""}
                    onChange={(e) => {
                      const b = bankList.find(
                        (x) => String(x.id) === String(e.target.value),
                      );
                      setRefundBankAccount(b || null);
                    }}
                  >
                    <option value="">Select bank account</option>
                    {bankList.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.account_name || b.bank_name || b.head} (
                        {b.account_number || b.head})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <Label className="text-xs text-slate-600">Cash account</Label>
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                    value={
                      refundCashHead?.head ||
                      refundCashHead?.code ||
                      ""
                    }
                    onChange={(e) => {
                      const h = cashHeads.find(
                        (x) =>
                          String(x.head || x.code) === String(e.target.value),
                      );
                      setRefundCashHead(h || null);
                    }}
                  >
                    <option value="">Select cash account</option>
                    {cashHeads.map((h) => (
                      <option
                        key={h.head || h.code}
                        value={h.head || h.code}
                      >
                        {h.head || h.code} —{" "}
                        {h.description || h.name || "Cash"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Line items table */}
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-semibold">Item details</th>
                <th className="px-3 py-2 font-semibold">Account</th>
                <th className="px-3 py-2 text-right font-semibold">Quantity</th>
                <th className="px-3 py-2 text-right font-semibold">Rate</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {lineItems.map((row, idx) => (
                <tr key={row.id} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <Typeahead
                      id={`cn-item-${row.id}`}
                      labelKey="name"
                      options={products}
                      selected={row.product ? [row.product] : []}
                      onChange={(sel) => pickProduct(idx, sel[0] || null)}
                      placeholder="Type or click to select an item"
                      clearButton
                    />
                    <Input
                      className="mt-1.5 h-8"
                      value={row.description}
                      onChange={(e) =>
                        updateLine(idx, { description: e.target.value })
                      }
                      placeholder="Description"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Typeahead
                      id={`cn-acc-${row.id}`}
                      labelKey="label"
                      options={accountOptions}
                      selected={
                        row.account?.code
                          ? [
                              {
                                id: row.account.code,
                                label: `${row.account.code} — ${row.account.description || row.account.code}`,
                                code: row.account.code,
                                name: row.account.description,
                              },
                            ]
                          : []
                      }
                      onChange={(sel) => {
                        const a = sel[0];
                        updateLine(idx, {
                          account: a
                            ? {
                                code: a.code,
                                description: a.name || a.label,
                                head: a.code,
                              }
                            : null,
                        });
                      }}
                      placeholder="Select an account"
                      clearButton
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-9 text-right font-mono"
                      value={row.quantity}
                      onChange={(e) =>
                        updateLine(idx, { quantity: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-9 text-right font-mono"
                      value={
                        row.rate === ""
                          ? ""
                          : formatNumberWithCommas(String(row.rate))
                      }
                      onChange={(e) =>
                        updateLine(idx, {
                          rate: parseNumberFromFormatted(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-sm font-medium">
                    {formatNumber1(row.amount || 0)}
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                      onClick={() => removeLine(idx)}
                      disabled={lineItems.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-3 py-2">
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add New Row
            </Button>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Sub Total</span>
              <span className="font-mono">{formatNumber1(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
              <span>Total</span>
              <span className="font-mono">{formatNumber1(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-4">
        <Button
          type="button"
          onClick={handleSaveOpen}
          disabled={loading}
          className="bg-[var(--aa-navy,#0f2744)] text-white hover:bg-[var(--aa-navy,#0f2744)]/90"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            labels.save
          )}
        </Button>
        <Button type="button" variant="outline" onClick={handleClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function emptyLine() {
  return {
    id: `L-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    product: null,
    description: "",
    account: null,
    quantity: "1",
    rate: "0",
    amount: 0,
    lineKind: "service",
  };
}
