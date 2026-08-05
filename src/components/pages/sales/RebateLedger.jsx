import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import moment from "moment";
import { toast } from "sonner";
import { RefreshCw, Percent, FileText, Printer, X } from "lucide-react";
import { _fetchApi, _postApi, _deleteApi, _putApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 200;
const TABS = [
  { key: "rules", label: "Rules" },
  { key: "billing", label: "Billing" },
  { key: "rebates", label: "Rebates" },
];

function productMatchesRule(line, rule) {
  const isAll =
    !rule.productSku &&
    (!rule.product || rule.product === "All products");
  if (isAll) return true;
  const lineSku = String(line.product_sku || line.sku || "").trim();
  const lineName = String(line.product_name || "").trim();
  if (rule.productSku && lineSku && rule.productSku === lineSku) return true;
  return lineName === String(rule.product || "").trim();
}

const STATUS_META = {
  pending: {
    label: "Pending",
    className: "border-amber-300 text-amber-800 bg-amber-50",
  },
  approved: {
    label: "Approved",
    className: "border-sky-300 text-sky-800 bg-sky-50",
  },
  paid: {
    label: "Paid",
    className: "border-emerald-300 text-emerald-800 bg-emerald-50",
  },
};

const inputClass =
  "h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]";

function parsePeriodDates(period) {
  const m = String(period || "").trim().match(/^Q([1-4])\s+(\d{4})$/i);
  if (!m) return null;
  const q = Number(m[1]);
  const y = Number(m[2]);
  const startMonth = (q - 1) * 3;
  return {
    fromDate: moment({ year: y, month: startMonth, day: 1 }).format(
      "YYYY-MM-DD",
    ),
    toDate: moment({ year: y, month: startMonth + 2 })
      .endOf("month")
      .format("YYYY-MM-DD"),
  };
}

function lineDate(row) {
  return moment(row.invoice_date).format("YYYY-MM-DD");
}

function inRange(dateStr, fromDate, toDate) {
  if (!dateStr || dateStr === "Invalid date") return false;
  if (fromDate && dateStr < fromDate) return false;
  if (toDate && dateStr > toDate) return false;
  return true;
}

export default function RebateLedger() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const userId = user?.id;

  const [tab, setTab] = useState("rules");
  const [rules, setRules] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [loadingRules, setLoadingRules] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [billing, setBilling] = useState([]);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [billingProductFilter, setBillingProductFilter] = useState("");

  const [branchIds, setBranchIds] = useState("");

  const [fromDate, setFromDate] = useState(
    moment().startOf("quarter").format("YYYY-MM-DD"),
  );
  const [toDate, setToDate] = useState(
    moment().endOf("quarter").format("YYYY-MM-DD"),
  );
  const [search, setSearch] = useState("");

  const [ruleForm, setRuleForm] = useState({
    name: "",
    product: "All products",
    productSku: "",
    period: "",
    fromDate: "",
    toDate: "",
    minQty: "",
    rebatePercent: "",
  });
  const [issuingCnKey, setIssuingCnKey] = useState(null);
  const [creditNoteDoc, setCreditNoteDoc] = useState(null);

  const loadRulesAndStatuses = useCallback(() => {
    if (!facilityId) return;
    setLoadingRules(true);
    _fetchApi(
      `/api/v1/rebate-ledger/rules?facilityId=${facilityId}`,
      (resp) => {
        setRules(Array.isArray(resp?.results) ? resp.results : []);
        setLoadingRules(false);
      },
      () => {
        toast.error("Unable to load rebate rules");
        setRules([]);
        setLoadingRules(false);
      },
    );
    _fetchApi(
      `/api/v1/rebate-ledger/statuses?facilityId=${facilityId}`,
      (resp) => {
        setStatuses(
          resp?.results && typeof resp.results === "object"
            ? resp.results
            : {},
        );
      },
      () => setStatuses({}),
    );
  }, [facilityId]);

  useEffect(() => {
    loadRulesAndStatuses();
  }, [loadRulesAndStatuses]);

  useEffect(() => {
    if (!facilityId) return;
    setLoadingProducts(true);
    _fetchApi(
      `/api/products?facilityId=${facilityId}`,
      (resp) => {
        const list = Array.isArray(resp?.data) ? resp.data : [];
        setProducts(
          list.filter(
            (p) =>
              !p.status ||
              String(p.status).toLowerCase() === "active",
          ),
        );
        setLoadingProducts(false);
      },
      () => {
        toast.error("Unable to load product list");
        setProducts([]);
        setLoadingProducts(false);
      },
    );
    _fetchApi(
      `/account/get/branches?facilityId=${facilityId}`,
      (resp) => {
        const list = Array.isArray(resp)
          ? resp
          : Array.isArray(resp?.results)
            ? resp.results
            : [];
        const ids = list
          .map((b) => b.id)
          .filter((id) => id != null && id !== "")
          .join(",");
        setBranchIds(ids);
      },
      () => setBranchIds(""),
    );
  }, [facilityId]);

  const filteredBilling = useMemo(() => {
    if (!billingProductFilter) return billing;
    return billing.filter((row) => {
      const sku = String(row.product_sku || "").trim();
      const name = String(row.product_name || "").trim();
      return (
        sku === billingProductFilter || name === billingProductFilter
      );
    });
  }, [billing, billingProductFilter]);

  const fetchBilling = useCallback(async () => {
    if (!facilityId || !userId) {
      if (!userId) toast.error("User session required to load billing");
      return;
    }
    setLoadingBilling(true);
    try {
      const rows = await fetchAllSalesLines({
        facilityId,
        userId: String(userId),
        fromDate,
        toDate,
        search: search.trim(),
        branchId: branchIds,
      });
      setBilling(rows);
    } catch (e) {
      console.error(e);
      toast.error("Unable to load billing lines");
      setBilling([]);
    } finally {
      setLoadingBilling(false);
    }
  }, [facilityId, userId, fromDate, toDate, search, branchIds]);

  useEffect(() => {
    if (tab === "billing" || tab === "rebates") {
      fetchBilling();
    }
  }, [tab, fetchBilling]);

  const onPeriodChange = (period) => {
    const dates = parsePeriodDates(period);
    setRuleForm((f) => ({
      ...f,
      period,
      ...(dates
        ? { fromDate: dates.fromDate, toDate: dates.toDate }
        : {}),
    }));
  };

  const addRule = (e) => {
    e.preventDefault();
    if (
      !ruleForm.name ||
      !ruleForm.period ||
      !ruleForm.minQty ||
      !ruleForm.rebatePercent
    ) {
      toast.error("Fill rule name, period, min qty, and rebate %");
      return;
    }
    if (!facilityId) {
      toast.error("No active business selected");
      return;
    }
    const dates =
      ruleForm.fromDate && ruleForm.toDate
        ? { fromDate: ruleForm.fromDate, toDate: ruleForm.toDate }
        : parsePeriodDates(ruleForm.period) || {
            fromDate: fromDate,
            toDate: toDate,
          };
    setSavingRule(true);
    _postApi(
      "/api/v1/rebate-ledger/rules",
      {
        facilityId,
        userId,
        name: ruleForm.name.trim(),
        product: ruleForm.product.trim() || "All products",
        productSku: ruleForm.productSku || "",
        period: ruleForm.period.trim(),
        fromDate: dates.fromDate,
        toDate: dates.toDate,
        minQty: Number(ruleForm.minQty),
        rebatePercent: Number(ruleForm.rebatePercent),
      },
      (resp) => {
        setSavingRule(false);
        if (resp?.success && resp.result) {
          setRules((r) => [resp.result, ...r]);
          setRuleForm({
            name: "",
            product: "All products",
            productSku: "",
            period: "",
            fromDate: "",
            toDate: "",
            minQty: "",
            rebatePercent: "",
          });
          toast.success("Rule saved");
        } else {
          toast.error(resp?.message || "Failed to save rule");
        }
      },
      (err) => {
        setSavingRule(false);
        toast.error(err?.message || "Failed to save rule");
      },
    );
  };

  const removeRule = (id) => {
    if (!facilityId) return;
    _deleteApi(
      `/api/v1/rebate-ledger/rules/${id}?facilityId=${facilityId}`,
      {},
      (resp) => {
        if (resp?.success) {
          setRules((r) => r.filter((x) => x.id !== id));
          setStatuses((s) => {
            const next = { ...s };
            Object.keys(next).forEach((k) => {
              if (k.endsWith(`|${id}`)) delete next[k];
            });
            return next;
          });
          toast.success("Rule removed");
        } else {
          toast.error(resp?.message || "Failed to remove rule");
        }
      },
      () => toast.error("Failed to remove rule"),
    );
  };

  const ledger = useMemo(() => {
    const customers = [
      ...new Set(
        billing
          .map((p) => (p.customer_name || "").trim())
          .filter((c) => c && c !== "—"),
      ),
    ];
    const rows = [];
    for (const customer of customers) {
      for (const rule of rules) {
        const matches = billing.filter((p) => {
          const name = (p.customer_name || "").trim();
          if (name !== customer) return false;
          const d = lineDate(p);
          if (!inRange(d, rule.fromDate, rule.toDate)) return false;
          return productMatchesRule(p, rule);
        });
        if (matches.length === 0) continue;
        const totalQty = matches.reduce(
          (s, p) => s + (parseFloat(p.qty) || 0),
          0,
        );
        const totalValue = matches.reduce(
          (s, p) => s + (parseFloat(p.line_total) || 0),
          0,
        );
        const qualifies = totalQty >= rule.minQty;
        const rebateAmount = qualifies
          ? totalValue * (rule.rebatePercent / 100)
          : 0;
        const key = `${customer}|${rule.id}`;
        const customerNo =
          matches.find((m) => m.customer_no)?.customer_no || "";
        rows.push({
          key,
          customer,
          customerNo,
          rule,
          totalQty,
          totalValue,
          qualifies,
          rebateAmount,
          progress: Math.min(100, (totalQty / rule.minQty) * 100),
          status: statuses[key]?.status || "pending",
          payoutType: statuses[key]?.payoutType || "credit",
          creditNoteNumber: statuses[key]?.creditNoteNumber || "",
        });
      }
    }
    return rows.sort((a, b) => b.rebateAmount - a.rebateAmount);
  }, [billing, rules, statuses]);

  const openCreditNotePreview = (row, overrides = {}) => {
    setCreditNoteDoc({
      creditNoteNumber: overrides.creditNoteNumber || row.creditNoteNumber,
      customer: row.customer,
      customerNo: row.customerNo,
      date: overrides.date || moment().format("YYYY-MM-DD"),
      reason:
        overrides.reason ||
        `Post-sale volume rebate: ${row.rule.name} (${row.rule.period})`,
      lineDescription:
        overrides.lineDescription ||
        `Volume rebate — ${row.rule.name} (${row.rule.period}) · ${row.rule.product}`,
      amount: overrides.amount ?? row.rebateAmount,
      ruleName: row.rule.name,
      period: row.rule.period,
      product: row.rule.product,
      rebatePercent: row.rule.rebatePercent,
      businessName:
        activeBusiness?.business_name ||
        activeBusiness?.name ||
        "AA Foods Nigeria Limited",
    });
  };

  const issueCreditNote = (row) => {
    if (!facilityId || !userId) return;
    if (!row.customerNo) {
      toast.error("Customer number missing on this rebate — refresh billing.");
      return;
    }
    if (row.creditNoteNumber) {
      openCreditNotePreview(row);
      return;
    }
    setIssuingCnKey(row.key);
    _postApi(
      "/api/v1/rebate-ledger/issue-credit-note",
      {
        facilityId,
        userId,
        ruleId: row.rule.id,
        customer: row.customer,
        customerNo: row.customerNo,
        rebateAmount: row.rebateAmount,
      },
      (resp) => {
        setIssuingCnKey(null);
        if (!resp?.success) {
          if (resp?.data?.creditNoteNumber) {
            setStatuses((s) => ({
              ...s,
              [row.key]: {
                ...s[row.key],
                creditNoteNumber: resp.data.creditNoteNumber,
                status: "paid",
                payoutType: "credit",
              },
            }));
            openCreditNotePreview(row, {
              creditNoteNumber: resp.data.creditNoteNumber,
            });
            return;
          }
          toast.error(resp?.message || "Failed to issue credit note");
          return;
        }
        const data = resp.data || {};
        setStatuses((s) => ({
          ...s,
          [row.key]: {
            ...s[row.key],
            creditNoteNumber: data.creditNoteNumber,
            status: "paid",
            payoutType: "credit",
            customerNo: row.customerNo,
          },
        }));
        toast.success(`Credit note ${data.creditNoteNumber} issued`);
        openCreditNotePreview(row, data);
      },
      () => {
        setIssuingCnKey(null);
        toast.error("Failed to issue credit note");
      },
    );
  };

  const updateStatus = (row, patch) => {
    if (!facilityId) return;
    const next = {
      status: patch.status ?? row.status,
      payoutType: patch.payoutType ?? row.payoutType,
    };
    setStatuses((s) => ({
      ...s,
      [row.key]: { ...s[row.key], ...next },
    }));
    _putApi(
      "/api/v1/rebate-ledger/statuses",
      {
        facilityId,
        userId,
        ruleId: row.rule.id,
        customer: row.customer,
        customerNo: row.customerNo || "",
        status: next.status,
        payoutType: next.payoutType,
      },
      (resp) => {
        if (!resp?.success) {
          toast.error(resp?.message || "Failed to update status");
          loadRulesAndStatuses();
        }
      },
      () => {
        toast.error("Failed to update status");
        loadRulesAndStatuses();
      },
    );
  };

  const totalPayable = ledger
    .filter((r) => r.qualifies)
    .reduce((s, r) => s + r.rebateAmount, 0);
  const totalPaid = ledger
    .filter((r) => r.qualifies && r.status === "paid")
    .reduce((s, r) => s + r.rebateAmount, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            <Percent className="h-3.5 w-3.5 text-[var(--aa-accent)]" />
            Trade incentives
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Rebate Ledger
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Rules apply against billed sales invoices — not purchase orders.
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              Payable this cycle
            </div>
            <div className="font-mono text-lg font-semibold text-slate-900">
              {formatNumber1(totalPayable)}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              Paid out
            </div>
            <div className="font-mono text-lg font-semibold text-emerald-700">
              {formatNumber1(totalPaid)}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-[var(--aa-accent)] text-slate-900"
                : "border-b-2 border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "rules" && (
        <section className="space-y-4">
          <form
            onSubmit={addRule}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3"
          >
            <input
              className={`${inputClass} min-w-[140px] flex-1`}
              placeholder="Rule name"
              value={ruleForm.name}
              onChange={(e) =>
                setRuleForm({ ...ruleForm, name: e.target.value })
              }
            />
            <div className="min-w-[200px] flex-[1.2]">
              <select
                className={`${inputClass} w-full`}
                value={
                  ruleForm.productSku
                    ? `sku:${ruleForm.productSku}`
                    : ruleForm.product === "All products"
                      ? "__all__"
                      : `name:${ruleForm.product}`
                }
                disabled={loadingProducts}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__all__") {
                    setRuleForm((f) => ({
                      ...f,
                      product: "All products",
                      productSku: "",
                    }));
                    return;
                  }
                  if (v.startsWith("sku:")) {
                    const sku = v.slice(4);
                    const item = products.find((p) => p.sku === sku);
                    setRuleForm((f) => ({
                      ...f,
                      product: item?.name || sku,
                      productSku: sku,
                    }));
                    return;
                  }
                  const name = v.replace(/^name:/, "");
                  setRuleForm((f) => ({
                    ...f,
                    product: name,
                    productSku: "",
                  }));
                }}
              >
                <option value="__all__">
                  {loadingProducts ? "Loading products…" : "All products"}
                </option>
                {products.map((p) => (
                  <option
                    key={p.id || p.sku || p.name}
                    value={p.sku ? `sku:${p.sku}` : `name:${p.name}`}
                  >
                    {p.sku ? `${p.name} (${p.sku})` : p.name}
                  </option>
                ))}
              </select>
            </div>
            <input
              className={`${inputClass} w-[120px]`}
              placeholder="Period e.g. Q1 2026"
              value={ruleForm.period}
              onChange={(e) => onPeriodChange(e.target.value)}
            />
            <input
              className={`${inputClass} w-[130px]`}
              type="date"
              title="From"
              value={ruleForm.fromDate}
              onChange={(e) =>
                setRuleForm({ ...ruleForm, fromDate: e.target.value })
              }
            />
            <input
              className={`${inputClass} w-[130px]`}
              type="date"
              title="To"
              value={ruleForm.toDate}
              onChange={(e) =>
                setRuleForm({ ...ruleForm, toDate: e.target.value })
              }
            />
            <input
              className={`${inputClass} w-[100px] font-mono`}
              type="number"
              placeholder="Min qty"
              value={ruleForm.minQty}
              onChange={(e) =>
                setRuleForm({ ...ruleForm, minQty: e.target.value })
              }
            />
            <input
              className={`${inputClass} w-[100px] font-mono`}
              type="number"
              step="0.1"
              placeholder="Rebate %"
              value={ruleForm.rebatePercent}
              onChange={(e) =>
                setRuleForm({ ...ruleForm, rebatePercent: e.target.value })
              }
            />
            <Button type="submit" size="sm" disabled={savingRule}>
              {savingRule ? "Saving…" : "Add rule"}
            </Button>
          </form>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5">Rule</th>
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5">Period</th>
                  <th className="px-3 py-2.5 text-right">Min Qty</th>
                  <th className="px-3 py-2.5 text-right">Rebate</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {loadingRules &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={`sk-${i}`}>
                      <td colSpan={6} className="px-3 py-2">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))}
                {!loadingRules &&
                  rules.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {r.name}
                    </td>
                    <td className="bg-white px-3 py-2.5 text-slate-600">
                      {r.product}
                      {r.productSku ? (
                        <span className="mt-0.5 block font-mono text-[11px] text-slate-400">
                          {r.productSku}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {r.period}
                      {r.fromDate && r.toDate ? (
                        <span className="mt-0.5 block font-mono text-[11px] text-slate-400">
                          {r.fromDate} → {r.toDate}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {Number(r.minQty).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {r.rebatePercent}%
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeRule(r.id)}
                        className="text-xs text-rose-600 underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {!loadingRules && rules.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-slate-500"
                    >
                      No rules yet. Add one above — it saves to your database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "billing" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">From</label>
              <input
                type="date"
                className={inputClass}
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">To</label>
              <input
                type="date"
                className={inputClass}
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs text-slate-500">Search</label>
              <input
                className={`${inputClass} w-full`}
                placeholder="Invoice, customer, product…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs text-slate-500">Product</label>
              <select
                className={`${inputClass} w-full`}
                value={billingProductFilter}
                onChange={(e) => setBillingProductFilter(e.target.value)}
              >
                <option value="">All products</option>
                {products.map((p) => (
                  <option key={p.id || p.sku} value={p.sku || p.name}>
                    {p.sku ? `${p.name} (${p.sku})` : p.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={fetchBilling}
              disabled={loadingBilling}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${loadingBilling ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5">Invoice</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5 text-right">Unit Price</th>
                  <th className="px-3 py-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {loadingBilling &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-3 py-2">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))}
                {!loadingBilling &&
                  filteredBilling.map((p) => (
                    <tr
                      key={
                        p.store_entry_id ||
                        `${p.invoice_no}-${p.product_name}-${p.qty}`
                      }
                      className="border-b border-slate-100 bg-white"
                    >
                      <td className="bg-white px-3 py-2.5 font-mono text-xs text-slate-700">
                        {p.invoice_no}
                      </td>
                      <td className="bg-white px-3 py-2.5 text-slate-600">
                        {p.invoice_date
                          ? moment(p.invoice_date).format("DD-MMM-YYYY")
                          : "—"}
                      </td>
                      <td className="bg-white px-3 py-2.5">
                        {p.customer_name || "—"}
                      </td>
                      <td className="bg-white px-3 py-2.5 text-slate-600">
                        {p.product_name || "—"}
                        {p.product_sku ? (
                          <span className="mt-0.5 block font-mono text-[11px] text-slate-400">
                            {p.product_sku}
                          </span>
                        ) : null}
                      </td>
                      <td className="bg-white px-3 py-2.5 text-right font-mono">
                        {formatNumber1(p.qty || 0)}
                      </td>
                      <td className="bg-white px-3 py-2.5 text-right font-mono">
                        {formatNumber1(p.unit_price || 0)}
                      </td>
                      <td className="bg-white px-3 py-2.5 text-right font-mono">
                        {formatNumber1(p.line_total || 0)}
                      </td>
                    </tr>
                  ))}
                {!loadingBilling && filteredBilling.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="bg-white px-3 py-8 text-center text-slate-500"
                    >
                      No billed sales lines in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "rebates" && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={fetchBilling}
              disabled={loadingBilling}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${loadingBilling ? "animate-spin" : ""}`}
              />
              Refresh billing
            </Button>
          </div>

          {loadingBilling && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
            </div>
          )}

          {!loadingBilling && ledger.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
              No billing lines match a rebate rule yet. Check Rules dates and
              product names against invoiced sales.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {!loadingBilling &&
              ledger.map((row) => (
                <div
                  key={row.key}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {row.customer}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {row.rule.name} · {row.rule.period}
                      </div>
                    </div>
                    {row.qualifies ? (
                      <span
                        className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_META[row.status].className}`}
                      >
                        {STATUS_META[row.status].label}
                      </span>
                    ) : (
                      <span className="rounded border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        In progress
                      </span>
                    )}
                  </div>

                  <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${row.qualifies ? "bg-emerald-500" : "bg-[var(--aa-accent)]"}`}
                      style={{ width: `${row.progress}%` }}
                    />
                  </div>
                  <div className="mb-3 font-mono text-[11px] text-slate-500">
                    {row.totalQty.toLocaleString()} /{" "}
                    {Number(row.rule.minQty).toLocaleString()} units
                  </div>

                  <div className="mb-3 flex justify-between gap-4">
                    <div>
                      <div className="text-[10px] uppercase text-slate-500">
                        Billed value
                      </div>
                      <div className="font-mono text-sm font-semibold">
                        {formatNumber1(row.totalValue)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase text-slate-500">
                        Rebate ({row.rule.rebatePercent}%)
                      </div>
                      <div
                        className={`font-mono text-sm font-semibold ${row.qualifies ? "text-slate-900" : "text-slate-300"}`}
                      >
                        {row.qualifies
                          ? formatNumber1(row.rebateAmount)
                          : "—"}
                      </div>
                    </div>
                  </div>

                  {row.qualifies && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={row.status}
                          onChange={(e) =>
                            updateStatus(row, { status: e.target.value })
                          }
                          className={`${inputClass} flex-1`}
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="paid">Paid</option>
                        </select>
                        <select
                          value={row.payoutType}
                          onChange={(e) =>
                            updateStatus(row, {
                              payoutType: e.target.value,
                            })
                          }
                          className={`${inputClass} flex-1`}
                        >
                          <option value="credit">Credit note</option>
                          <option value="cash">Cash payment</option>
                        </select>
                      </div>
                      {row.payoutType === "credit" && (
                        <div className="flex flex-wrap items-center gap-2">
                          {row.creditNoteNumber ? (
                            <>
                              <span className="font-mono text-[11px] text-slate-600">
                                {row.creditNoteNumber}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => openCreditNotePreview(row)}
                              >
                                <FileText className="mr-1.5 h-3.5 w-3.5" />
                                View credit note
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 bg-[var(--aa-navy,#0f2744)] text-white hover:bg-[var(--aa-navy,#0f2744)]/90"
                              disabled={issuingCnKey === row.key}
                              onClick={() => issueCreditNote(row)}
                            >
                              <FileText className="mr-1.5 h-3.5 w-3.5" />
                              {issuingCnKey === row.key
                                ? "Issuing…"
                                : "Issue credit note"}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}

      {creditNoteDoc && (
        <CreditNotePreviewModal
          doc={creditNoteDoc}
          onClose={() => setCreditNoteDoc(null)}
        />
      )}
    </div>
  );
}

function CreditNotePreviewModal({ doc, onClose }) {
  const printDoc = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 print:static print:bg-white print:p-0">
      <div className="my-6 w-full max-w-2xl print:my-0 print:max-w-none">
        <div className="mb-3 flex items-center justify-end gap-2 print:hidden">
          <Button type="button" variant="outline" size="sm" onClick={printDoc}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Close
          </Button>
        </div>

        <article className="credit-note-sheet rounded-lg border border-slate-200 bg-white shadow-xl print:rounded-none print:border-0 print:shadow-none">
          <div
            className="px-8 py-6 text-white"
            style={{
              background:
                "linear-gradient(135deg, #0f2744 0%, #1a3a5c 55%, #0f2744 100%)",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-300">
                  Credit note
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">
                  {doc.businessName}
                </h2>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-semibold text-[var(--aa-accent,#c4a35a)]">
                  {doc.creditNoteNumber || "—"}
                </div>
                <div className="mt-1 text-xs text-slate-300">
                  {moment(doc.date).format("DD MMM YYYY")}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 px-8 py-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Credit to
                </div>
                <div className="mt-1 font-semibold text-slate-900">
                  {doc.customer}
                </div>
                {doc.customerNo ? (
                  <div className="font-mono text-xs text-slate-500">
                    {doc.customerNo}
                  </div>
                ) : null}
              </div>
              <div className="sm:text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Reason
                </div>
                <div className="mt-1 text-sm text-slate-700">{doc.reason}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Offset against outstanding invoices
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 font-semibold">Description</th>
                    <th className="px-3 py-2 text-right font-semibold">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-3 text-slate-800">
                      <div>{doc.lineDescription}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {doc.rebatePercent}% of qualifying billed sales ·{" "}
                        {doc.period}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600">
                      1
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-slate-900">
                      {formatNumber1(doc.amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-1.5 border-t border-slate-200 pt-3">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatNumber1(doc.amount)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>VAT</span>
                  <span className="font-mono">{formatNumber1(0)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-slate-900">
                  <span>Credit total</span>
                  <span className="font-mono text-[var(--aa-accent,#0f2744)]">
                    {formatNumber1(doc.amount)}
                  </span>
                </div>
              </div>
            </div>

            <p className="border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
              This credit note reduces the customer&apos;s outstanding balance
              and may be applied against future invoices. Issued from Rebate
              Ledger for {doc.ruleName}.
            </p>
          </div>
        </article>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .credit-note-sheet, .credit-note-sheet * { visibility: visible !important; }
          .credit-note-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}

async function fetchAllSalesLines({
  facilityId,
  userId,
  fromDate,
  toDate,
  search,
  branchId,
}) {
  let page = 1;
  let all = [];
  let totalCount = Infinity;
  while (all.length < totalCount) {
    const batch = await fetchSalesLinePage({
      facilityId,
      userId,
      fromDate,
      toDate,
      search,
      branchId,
      page,
      pageSize: PAGE_SIZE,
    });
    all = all.concat(batch.rows);
    totalCount = Number.isFinite(batch.totalCount)
      ? batch.totalCount
      : all.length;
    if (!batch.rows.length) break;
    page += 1;
    if (page > 50) break;
  }
  return all;
}

function fetchSalesLinePage({
  facilityId,
  userId,
  fromDate,
  toDate,
  search,
  branchId,
  page,
  pageSize,
}) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      facilityId: String(facilityId),
      userId: String(userId),
      fromDate,
      toDate,
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search) params.set("search", search);
    if (branchId) params.set("branchId", String(branchId));

    _fetchApi(
      `/api/v1/transactions/sales-line-report?${params.toString()}`,
      (res) => {
        if (res?.success) {
          resolve({
            rows: Array.isArray(res.results) ? res.results : [],
            totalCount: parseInt(res.totalCount || 0, 10),
          });
        } else {
          reject(new Error(res?.message || "Failed to fetch sales lines"));
        }
      },
      (err) => reject(err),
    );
  });
}
