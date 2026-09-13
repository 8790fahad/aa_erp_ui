import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useLocation, useSearchParams } from "react-router-dom";
import moment from "moment";
import { toast } from "sonner";
import { FileText, Loader2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { Typeahead } from "react-bootstrap-typeahead";
import "react-bootstrap-typeahead/css/Typeahead.css";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import {
  formatNumberWithCommas,
  parseNumberFromFormatted,
} from "@/utilities";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import SearchCustomerInput from "@/components/pages/customer/components/SearchCustomerInput";

/**
 * Zoho Books–style create form.
 * Party first (Customer / Vendor) → date / subject → line items → Save as Open.
 * Invoice is optional (can apply credit later).
 */
export default function CreditNoteCreateForm({
  embedded: _embedded = false,
  onCancel,
  onCreated,
  forcedParty,
} = {}) {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const path = String(location.pathname || "").toLowerCase();
  const partyParam = String(
    forcedParty ||
      (path.includes("/party-vendor") ? "vendor" : "") ||
      (path.includes("/party-customer") ? "customer" : "") ||
      searchParams.get("party") ||
      "",
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
        saveRefund: "Save and Refund",
        creditsTitle: "Open credits",
        creditsHint: "Keep open — apply to future bills",
      }
    : {
        title: "New Credit Note",
        party: "Customer Name",
        partyPlaceholder: "Select a customer",
        number: "Credit Note#",
        date: "Credit Note Date",
        balanceAccount: "Customer Deposit",
        save: "Save to Deposit",
        saveRefund: "Save and Refund",
        creditsTitle: "Customer deposit",
        creditsHint:
          "Adds to deposit — use Apply Deposit on Create Invoice",
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
  const [reasons, setReasons] = useState([]);
  const [reasonCategory, setReasonCategory] = useState("RETURN");
  const [inventoryExplanation, setInventoryExplanation] = useState("");
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");

  const selectedReason = useMemo(
    () => reasons.find((r) => r.category === reasonCategory) || null,
    [reasons, reasonCategory],
  );
  const needsInventory = !!(
    selectedReason?.inventoryRelated && selectedReason?.restockInventory
  );

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

  const loadReasons = useCallback(() => {
    const docType = isVendor ? "debit" : "credit";
    _fetchApi(
      `/api/credit-notes/reason-metadata?docType=${docType}`,
      (resp) => {
        const list = resp?.data?.reasons || [];
        setReasons(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list.length) {
          const prefer =
            list.find((r) => r.category === "RETURN") || list[0];
          setReasonCategory(prefer.category);
        }
      },
      () => setReasons([]),
    );
  }, [isVendor]);

  const loadBranches = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/account/get/branches?facilityId=${facilityId}`,
      (resp) => {
        const list = resp?.results || resp?.data || resp?.branches || [];
        const rows = Array.isArray(list) ? list : [];
        setBranches(rows);
        const def =
          rows.find(
            (b) =>
              b.is_default === true ||
              b.is_default === 1 ||
              b.is_default === "1",
          ) || rows[0];
        if (def?.id != null) setBranchId(String(def.id));
      },
      () => setBranches([]),
    );
  }, [facilityId]);

  useEffect(() => {
    loadParties();
    loadAccounts();
    loadProducts();
    loadReasons();
    loadBranches();
  }, [loadParties, loadAccounts, loadProducts, loadReasons, loadBranches]);

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

  const productLabel = (product) =>
    String(product?.name || product?.item_name || product?.description || "").trim();

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
    const name = productLabel(product);
    updateLine(idx, {
      product,
      description: name,
      rate: String(product.selling_price ?? product.cost_price ?? "0"),
      quantity: "1",
      account: acc
        ? { code: acc.code, description: acc.name, head: acc.code }
        : accCode
          ? { code: accCode, description: accCode, head: accCode }
          : null,
      lineKind:
        String(product.item_type || product.type || "").toLowerCase() === "service"
          ? "service"
          : "product",
      product_id: product.sku || product.product_id || product.id || null,
      cost_price: product.cost_price ?? product.unit_cost ?? 0,
      inventory_account: product.inventory_account || null,
      cogs_head: product.cogs_head || null,
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
    if (needsInventory) {
      if (!inventoryExplanation.trim() || inventoryExplanation.trim().length < 5) {
        toast.error(
          selectedReason?.inventoryExplanationPrompt ||
            "Add a short inventory note (min 5 characters)",
        );
        return;
      }
      const missingProduct = validLines.some(
        (l) =>
          String(l.lineKind || "").toLowerCase() !== "service" &&
          !(l.product_id || l.product?.sku || l.product?.product_id),
      );
      if (missingProduct) {
        toast.error("Select a product on each return line so stock can be updated");
        return;
      }
    }

    setLoading(true);
    const reason =
      selectedReason?.value ||
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
      reasonCategory: reasonCategory || "DISCOUNT",
      inventoryExplanation: needsInventory
        ? inventoryExplanation.trim()
        : undefined,
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
        lineKind: item.lineKind || "product",
        product_id:
          item.product_id ||
          item.product?.sku ||
          item.product?.product_id ||
          null,
        branchId: branchId ? parseInt(branchId, 10) : null,
        cost_price: item.cost_price ?? item.product?.cost_price ?? 0,
        inventory_account:
          item.inventory_account || item.product?.inventory_account || null,
        cogs_head: item.cogs_head || item.product?.cogs_head || null,
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
              : isVendor
                ? `Vendor credit ${cnNo} saved as open credits`
                : `Credit note ${cnNo} posted to customer deposit. Use Apply Deposit on Create Invoice.`,
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

  const fieldInputClass =
    "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]";

  return (
    <div className="min-h-screen bg-white">
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileText
              className="size-6 text-[var(--aa-accent)]"
              strokeWidth={1.75}
            />
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {labels.title}
              </h1>
              <p className="text-xs text-slate-500">
                {isVendor
                  ? "Credit a vendor for returns or adjustments"
                  : "Credit a customer for returned inventory"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-slate-300 px-3 text-xs font-medium text-slate-700 shadow-sm"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>
        {!isVendor ? (
          <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            Select the customer, add returned product lines, then save. Apply
            the balance on Create Invoice with Apply Deposit.
          </div>
        ) : null}
      </div>

      <div className="space-y-4 border-b border-slate-100 bg-white px-6 py-5">
        <FormRow label={labels.party} required>
          {isVendor ? (
            <Typeahead
              id="cn-party"
              labelKey="label"
              options={partyOptions}
              selected={selectedParty}
              onChange={setSelectedParty}
              placeholder={labels.partyPlaceholder}
              clearButton
              size="sm"
              className="z-[300] w-full"
              positionFixed
              inputProps={{
                className: fieldInputClass,
              }}
            />
          ) : (
            <SearchCustomerInput
              size="sm"
              selected={
                selectedParty[0]
                  ? [
                      {
                        customerNo: selectedParty[0].id,
                        name: selectedParty[0].label,
                        Account: selectedParty[0].label,
                      },
                    ]
                  : []
              }
              onChange={(customer) => {
                if (!customer) {
                  setSelectedParty([]);
                  return;
                }
                setSelectedParty([
                  {
                    id: customer.customerNo,
                    label:
                      customer.Account ||
                      customer.name ||
                      customer.customerNo ||
                      "Customer",
                  },
                ]);
              }}
              className="w-full"
            />
          )}
        </FormRow>

        <FormRow
          label={labels.number}
          required
          hint={
            <p className="mt-1 text-[11px] text-slate-500">
              From number generator ({numberQueryType})
            </p>
          }
        >
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={loadingNumber ? "Generating…" : creditNoteNumber || "—"}
              className={`${fieldInputClass} max-w-xs bg-slate-50 font-medium`}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-9 shrink-0 p-0"
              title="Regenerate from number generator"
              disabled={loadingNumber}
              onClick={reserveNoteNumber}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingNumber ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </FormRow>

        <FormRow label="Reference">
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Optional invoice / order number"
            className={fieldInputClass}
          />
        </FormRow>

        <FormRow label={labels.date} required>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${fieldInputClass} max-w-xs`}
          />
        </FormRow>

        <FormRow
          label="Reason"
          required
          hint={
            selectedReason?.explanation ? (
              <p className="mt-1 text-[11px] text-slate-500">
                {selectedReason.explanation}
              </p>
            ) : null
          }
        >
          <select
            value={reasonCategory}
            onChange={(e) => setReasonCategory(e.target.value)}
            className={fieldInputClass}
          >
            {reasons.length === 0 ? (
              <option value="RETURN">Customer returns goods</option>
            ) : (
              reasons.map((r) => (
                <option key={r.category} value={r.category}>
                  {r.label}
                </option>
              ))
            )}
          </select>
        </FormRow>

        {needsInventory ? (
          <>
            <FormRow label="Warehouse / Store" required>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className={fieldInputClass}
              >
                <option value="">Select store…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.branch_name || b.name || b.id}
                  </option>
                ))}
              </select>
            </FormRow>

            <FormRow label="Inventory note" required align="start">
              <Textarea
                value={inventoryExplanation}
                onChange={(e) => setInventoryExplanation(e.target.value)}
                placeholder={
                  selectedReason?.inventoryExplanationPrompt ||
                  "Describe how inventory is affected…"
                }
                rows={2}
                className="min-h-[4.5rem] resize-none border-slate-300"
              />
            </FormRow>
          </>
        ) : null}

        <FormRow label="Subject" align="start">
          <Textarea
            value={subject}
            onChange={(e) => setSubject(e.target.value.slice(0, 250))}
            placeholder="Enter a subject within 250 characters"
            rows={2}
            className="min-h-[4.5rem] resize-none border-slate-300"
          />
        </FormRow>

        <FormRow label={labels.balanceAccount}>
          <div className="flex h-9 max-w-xs items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
            {labels.balanceAccount}
          </div>
        </FormRow>

        <FormRow label="After save" required align="start" wide>
          <div
            className="grid max-w-3xl gap-2 sm:grid-cols-2"
            role="radiogroup"
            aria-label="After save"
          >
            <OutcomeOption
              checked={outcome === "credits"}
              title={labels.creditsTitle}
              description={labels.creditsHint}
              onSelect={() => setOutcome("credits")}
            />
            <OutcomeOption
              checked={outcome === "refund"}
              title="Refund"
              description="Pay out now via cash / bank (closes note)"
              onSelect={() => setOutcome("refund")}
            />
          </div>
          {outcome === "refund" ? (
            <div className="mt-3 grid max-w-3xl gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Mode
                </label>
                <select
                  className={`mt-1 ${fieldInputClass}`}
                  value={refundMode}
                  onChange={(e) => setRefundMode(e.target.value)}
                >
                  <option value="bank">Bank transfer</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              {refundMode === "bank" ? (
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Bank account
                  </label>
                  <select
                    className={`mt-1 ${fieldInputClass}`}
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
                  <label className="text-xs font-medium text-slate-600">
                    Cash account
                  </label>
                  <select
                    className={`mt-1 ${fieldInputClass}`}
                    value={
                      refundCashHead?.head || refundCashHead?.code || ""
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
                      <option key={h.head || h.code} value={h.head || h.code}>
                        {h.head || h.code} — {h.description || h.name || "Cash"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : null}
        </FormRow>
      </div>

      <div className="flex w-full flex-col bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-6 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Item Table
          </p>
        </div>
        <div className="w-full overflow-x-auto px-4 sm:px-6">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="min-w-[280px] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                  Item Details
                </th>
                <th className="min-w-[180px] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                  Account
                </th>
                <th className="w-24 px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                  Quantity
                </th>
                <th className="w-28 px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                  Rate
                </th>
                <th className="w-28 px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                  Amount
                </th>
                <th className="w-10 px-1 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {lineItems.map((row, idx) => (
                <tr
                  key={row.id}
                  className="bg-white hover:bg-slate-50/80 align-top"
                >
                  <td className="px-3 py-3">
                    {row.product || (row.description || "").trim() ? (
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900">
                              {productLabel(row.product) || row.description || "Item"}
                            </p>
                            {(row.product?.sku || row.product?.product_id) && (
                              <p className="text-[11px] text-slate-500">
                                SKU: {row.product.sku || row.product.product_id}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            className="shrink-0 text-[11px] font-medium text-[var(--aa-accent)] hover:underline"
                            onClick={() => pickProduct(idx, null)}
                          >
                            Change
                          </button>
                        </div>
                        <input
                          className="h-8 w-full rounded border border-slate-300 px-2 text-sm outline-none focus:border-[var(--aa-accent)]"
                          value={row.description}
                          onChange={(e) =>
                            updateLine(idx, { description: e.target.value })
                          }
                          placeholder="Description (optional)"
                        />
                      </div>
                    ) : (
                      <Typeahead
                        id={`cn-item-${row.id}`}
                        labelKey={(opt) => productLabel(opt)}
                        options={products}
                        selected={[]}
                        onChange={(sel) => pickProduct(idx, sel[0] || null)}
                        placeholder="Type or click to select an item"
                        clearButton
                        size="sm"
                        className="z-[300] w-full"
                        positionFixed
                        filterBy={(opt, props) => {
                          const q = String(props.text || "").toLowerCase();
                          if (!q) return true;
                          return [
                            opt.name,
                            opt.item_name,
                            opt.sku,
                            opt.product_id,
                            opt.description,
                          ].some((v) =>
                            String(v || "")
                              .toLowerCase()
                              .includes(q),
                          );
                        }}
                        inputProps={{
                          className:
                            "border border-slate-300 rounded px-2 py-1.5 text-sm w-full h-9",
                        }}
                        renderMenuItemChildren={(opt) => (
                          <div className="py-1">
                            <div className="text-sm font-medium text-slate-800">
                              {productLabel(opt)}
                            </div>
                            {(opt.sku || opt.product_id) && (
                              <small className="text-xs text-slate-500">
                                {opt.sku || opt.product_id}
                              </small>
                            )}
                          </div>
                        )}
                      />
                    )}
                  </td>
                  <td className="px-3 py-3">
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
                      size="sm"
                      className="z-[300] w-full"
                      positionFixed
                      inputProps={{
                        className:
                          "border border-slate-300 rounded px-2 py-1.5 text-sm w-full h-9",
                      }}
                    />
                  </td>
                  <td className="px-2 py-3">
                    <input
                      className="h-9 w-full rounded border border-slate-300 px-2 text-right text-sm tabular-nums outline-none focus:border-[var(--aa-accent)]"
                      value={row.quantity}
                      onChange={(e) =>
                        updateLine(idx, { quantity: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-2 py-3">
                    <input
                      className="h-9 w-full rounded border border-slate-300 px-2 text-right text-sm tabular-nums outline-none focus:border-[var(--aa-accent)]"
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
                  <td className="px-2 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                    {formatNumber1(row.amount || 0)}
                  </td>
                  <td className="px-1 py-3 text-center">
                    <button
                      type="button"
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      onClick={() => removeLine(idx)}
                      disabled={lineItems.length <= 1}
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-[var(--aa-accent)] hover:bg-slate-50"
            >
              <Plus size={14} />
              Add New Row
            </button>
            <div className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Sub Total</span>
                <span className="tabular-nums">
                  {formatNumber1(totals.subtotal)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-semibold text-slate-900">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatNumber1(totals.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-[#f7f7f8] px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSaveOpen}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--aa-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--aa-accent-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              outcome === "refund" ? labels.saveRefund : labels.save
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold text-slate-900">
            Total Amount:{" "}
            <span className="text-slate-800">
              {formatNumber1(totals.total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function OutcomeOption({ checked, title, description, onSelect }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`flex w-full items-start gap-2.5 rounded-md border px-3 py-2.5 text-left ${
        checked
          ? "border-[var(--aa-accent)] bg-[var(--aa-accent)]/5"
          : "border-slate-300 bg-white hover:bg-slate-50"
      }`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          checked ? "border-[var(--aa-accent)]" : "border-slate-400"
        }`}
      >
        {checked ? (
          <span className="h-2 w-2 rounded-full bg-[var(--aa-accent)]" />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-900">
          {title}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
          {description}
        </span>
      </span>
    </button>
  );
}

function FormRow({
  label,
  required = false,
  children,
  hint = null,
  align = "center",
  wide = false,
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-4 ${
        wide
          ? "lg:grid-cols-[9rem_minmax(0,1fr)]"
          : "lg:grid-cols-[9rem_minmax(0,28rem)]"
      } ${align === "start" ? "lg:items-start" : "lg:items-center"}`}
    >
      <label
        className={`text-sm font-medium text-slate-600 lg:text-right ${
          align === "start" ? "lg:pt-2" : ""
        }`}
      >
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <div className="min-w-0">
        {children}
        {hint}
      </div>
    </div>
  );
}

function emptyLine() {
  return {
    id: `L-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    product: null,
    product_id: null,
    description: "",
    account: null,
    quantity: "1",
    rate: "0",
    amount: 0,
    lineKind: "product",
    cost_price: 0,
    inventory_account: null,
    cogs_head: null,
  };
}
