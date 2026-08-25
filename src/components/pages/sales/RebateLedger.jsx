import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import moment from "moment";
import { toast } from "sonner";
import { RefreshCw, Percent, FileText, Printer, X, Banknote, Plus } from "lucide-react";
import { Typeahead } from "react-bootstrap-typeahead";
import "react-bootstrap-typeahead/css/Typeahead.css";
import { _fetchApi, _postApi, _deleteApi, _putApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdvancePaymentAccounts } from "@/components/common/useAdvancePaymentAccounts";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import SearchSupplierInput from "@/components/pages/purchase/SearchSuppliers";
import SearchCustomerInput from "@/components/pages/customer/components/SearchCustomerInput";

const PAGE_SIZE = 200;
const TABS = [
  { key: "rules", label: "Rules" },
  { key: "billing", label: "Billing" },
  { key: "rebates", label: "Rebates" },
];

function emptyRuleForm() {
  return {
    name: "",
    basis: "sales",
    // product | category | all — product selection mode
    productMode: "all",
    product: "All products",
    productSku: "",
    productCategory: "",
    supplierNo: "",
    supplierName: "",
    customerNo: "",
    customerName: "",
    period: "",
    fromDate: "",
    toDate: "",
    minQty: "",
    rebatePercent: "",
  };
}

function isCategorySku(sku) {
  return String(sku || "").startsWith("cat:");
}

function categoryFromSku(sku) {
  const s = String(sku || "");
  return s.startsWith("cat:") ? s.slice(4) : "";
}

function productMatchesRule(line, rule) {
  const isAll =
    !rule.productSku &&
    (!rule.product || rule.product === "All products");
  if (isAll) return true;

  if (isCategorySku(rule.productSku)) {
    const cat = categoryFromSku(rule.productSku) || String(rule.product || "").trim();
    const lineCat = String(
      line.product_category ||
        line.category ||
        line.item_type ||
        "",
    ).trim();
    const lineName = String(line.product_name || "").trim();
    if (cat && lineCat && cat.toLowerCase() === lineCat.toLowerCase()) {
      return true;
    }
    // Fallback: product name equals category label (rare)
    return cat && lineName && cat.toLowerCase() === lineName.toLowerCase();
  }

  const lineSku = String(line.product_sku || line.sku || "").trim();
  const lineName = String(line.product_name || "").trim();
  if (rule.productSku && lineSku && rule.productSku === lineSku) return true;
  return lineName === String(rule.product || "").trim();
}

function partyMatchesRule(line, rule) {
  const basis = String(rule.basis || "sales").toLowerCase();
  const hasSupplier = !!(rule.supplierNo || rule.supplierName);
  const hasCustomer = !!(rule.customerNo || rule.customerName);

  if (basis === "purchase" && hasSupplier) {
    const no = String(rule.supplierNo || "").trim();
    const name = String(rule.supplierName || "").trim();
    const lineNo = String(line.supplier_no || "").trim();
    const lineName = String(line.supplier_name || "").trim();
    if (no && lineNo) return no === lineNo;
    if (name && lineName) return name === lineName;
    return false;
  }
  if (basis === "sales" && hasCustomer) {
    const no = String(rule.customerNo || "").trim();
    const name = String(rule.customerName || "").trim();
    const lineNo = String(line.customer_no || "").trim();
    const lineName = String(line.customer_name || "").trim();
    if (no && lineNo) return no === lineNo;
    if (name && lineName) return name === lineName;
    return false;
  }
  // Legacy targetType-only rules
  const targetType = String(rule.targetType || "product").toLowerCase();
  if (targetType === "supplier") {
    const no = String(rule.supplierNo || "").trim();
    const name = String(rule.supplierName || "").trim();
    const lineNo = String(line.supplier_no || "").trim();
    const lineName = String(line.supplier_name || "").trim();
    if (no && lineNo) return no === lineNo;
    if (name && lineName) return name === lineName;
    return false;
  }
  if (targetType === "customer") {
    const no = String(rule.customerNo || "").trim();
    const name = String(rule.customerName || "").trim();
    const lineNo = String(line.customer_no || "").trim();
    const lineName = String(line.customer_name || "").trim();
    if (no && lineNo) return no === lineNo;
    if (name && lineName) return name === lineName;
    return false;
  }
  return true;
}

function ruleAppliesToLabel(rule) {
  const parts = [];
  if (rule.customerName || rule.customerNo) {
    parts.push(rule.customerName || rule.customerNo);
  }
  if (rule.supplierName || rule.supplierNo) {
    parts.push(rule.supplierName || rule.supplierNo);
  }
  if (isCategorySku(rule.productSku)) {
    parts.push(`Category: ${categoryFromSku(rule.productSku) || rule.product}`);
  } else if (rule.product && rule.product !== "All products") {
    parts.push(rule.product);
  } else if (!parts.length) {
    parts.push("All products");
  } else {
    parts.push("All products");
  }
  return parts.join(" · ");
}

function ruleAppliesToSub(rule) {
  const bits = [];
  if (rule.customerNo) bits.push(rule.customerNo);
  if (rule.supplierNo) bits.push(rule.supplierNo);
  if (rule.productSku && !isCategorySku(rule.productSku)) bits.push(rule.productSku);
  if (isCategorySku(rule.productSku)) bits.push(rule.productSku);
  return bits.join(" · ");
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

function monthRange(m) {
  const start = m.clone().startOf("month");
  const end = m.clone().endOf("month");
  return {
    fromDate: start.format("YYYY-MM-DD"),
    toDate: end.format("YYYY-MM-DD"),
  };
}

function parsePeriodDates(period) {
  const raw = String(period || "").trim();
  if (!raw) return null;

  if (/^this\s+month$/i.test(raw)) {
    return monthRange(moment());
  }
  if (/^next\s+month$/i.test(raw)) {
    return monthRange(moment().add(1, "month"));
  }
  if (/^last\s+month$/i.test(raw)) {
    return monthRange(moment().subtract(1, "month"));
  }

  // In 2 months | +2 months
  let m = raw.match(/^(?:in\s+)?\+?\s*(\d+)\s+months?$/i);
  if (m) {
    return monthRange(moment().add(Number(m[1]), "months"));
  }

  // Aug 2026 | August 2026 | 2026-08
  const named = moment(raw, ["MMM YYYY", "MMMM YYYY", "YYYY-MM"], true);
  if (named.isValid()) {
    return monthRange(named);
  }

  // Legacy quarters still parse for existing rules
  m = raw.match(/^Q([1-4])[\s\-_/]*(\d{4})$/i);
  if (!m) m = raw.match(/^(\d{4})[\s\-_/]*Q([1-4])$/i);
  if (m) {
    const q = Number(m[1].length === 4 ? m[2] : m[1]);
    const y = Number(m[1].length === 4 ? m[1] : m[2]);
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

  // YYYY-MM-DD → YYYY-MM-DD
  m = raw.match(
    /^(\d{4}-\d{2}-\d{2})\s*(?:→|->|to|–|-)\s*(\d{4}-\d{2}-\d{2})$/i,
  );
  if (m) {
    return { fromDate: m[1], toDate: m[2] };
  }

  return null;
}

function buildPeriodOptions() {
  const opts = ["Last month", "This month", "Next month"];
  for (let i = 2; i <= 6; i += 1) {
    opts.push(moment().add(i, "months").format("MMM YYYY"));
  }
  for (let i = 2; i <= 3; i += 1) {
    opts.unshift(moment().subtract(i, "months").format("MMM YYYY"));
  }
  return opts;
}

function formatPeriodFromDates(fromDate, toDate) {
  if (!fromDate || !toDate) return "";
  const from = moment(fromDate, "YYYY-MM-DD", true);
  const to = moment(toDate, "YYYY-MM-DD", true);
  if (!from.isValid() || !to.isValid()) return "";

  const isFullMonth =
    from.date() === 1 && to.isSame(from.clone().endOf("month"), "day");
  if (isFullMonth) {
    if (from.isSame(moment(), "month")) return "This month";
    if (from.isSame(moment().add(1, "month"), "month")) return "Next month";
    if (from.isSame(moment().subtract(1, "month"), "month")) return "Last month";
    return from.format("MMM YYYY");
  }

  // Legacy quarter display for old rules
  if (
    from.date() === 1 &&
    to.isSame(from.clone().add(2, "months").endOf("month"), "day") &&
    from.month() % 3 === 0
  ) {
    return `Q${Math.floor(from.month() / 3) + 1} ${from.year()}`;
  }
  return `${from.format("YYYY-MM-DD")} → ${to.format("YYYY-MM-DD")}`;
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
    moment().startOf("month").format("YYYY-MM-DD"),
  );
  const [toDate, setToDate] = useState(
    moment().endOf("month").format("YYYY-MM-DD"),
  );
  const [search, setSearch] = useState("");

  const [ruleForm, setRuleForm] = useState(emptyRuleForm);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [issuingCnKey, setIssuingCnKey] = useState(null);
  const [payingKey, setPayingKey] = useState(null);
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [creditNoteDoc, setCreditNoteDoc] = useState(null);
  const [coaCategories, setCoaCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const productTypeaheadRef = useRef(null);

  // Prefer CoA/product categories from API (BUA, Dangote, …); fall back to product list.
  const productCategories = useMemo(() => {
    if (coaCategories.length) {
      return coaCategories.map((c) => ({
        name: c.category || c.name,
        count: c.count || 0,
      }));
    }
    const map = new Map();
    for (const p of products) {
      const cat = String(p.category || "").trim();
      if (!cat) continue;
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [coaCategories, products]);

  const productBySku = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      if (p.sku) map.set(String(p.sku), p);
    }
    return map;
  }, [products]);

  const selectedProduct = useMemo(() => {
    if (ruleForm.productMode !== "product") return [];
    if (isCategorySku(ruleForm.productSku)) return [];
    if (ruleForm.productSku) {
      const bySku = products.find((p) => p.sku === ruleForm.productSku);
      if (bySku) return [bySku];
    }
    const byName = products.find((p) => p.name === ruleForm.product);
    if (byName) return [byName];
    if (ruleForm.product && ruleForm.product !== "All products") {
      return [
        {
          id: `custom-${ruleForm.product}`,
          name: ruleForm.product,
          sku: ruleForm.productSku || "",
        },
      ];
    }
    return [];
  }, [
    products,
    ruleForm.product,
    ruleForm.productSku,
    ruleForm.productMode,
  ]);
  const [payForm, setPayForm] = useState({
    modeOfPayment: "cash",
    chequeNo: "",
  });
  const {
    accountHead,
    setAccountHead,
    bankAccount,
    setBankAccount,
    accountList,
    headList,
  } = useAdvancePaymentAccounts(tab === "rebates", facilityId, payForm.modeOfPayment);

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
    setLoadingCategories(true);
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
      `/api/products/categories?facilityId=${facilityId}`,
      (resp) => {
        const list = Array.isArray(resp?.data) ? resp.data : [];
        setCoaCategories(
          list
            .map((c) =>
              typeof c === "string"
                ? { category: c, count: 0 }
                : {
                    category: c.category || c.name || "",
                    count: c.count || 0,
                  },
            )
            .filter((c) => c.category),
        );
        setLoadingCategories(false);
      },
      () => {
        setCoaCategories([]);
        setLoadingCategories(false);
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
      const common = {
        facilityId,
        userId: String(userId),
        fromDate,
        toDate,
        search: search.trim(),
        branchId: branchIds,
      };
      const [salesRows, purchaseRows] = await Promise.all([
        fetchAllSalesLines(common),
        fetchAllPurchaseLines(common),
      ]);
      const enrich = (r, basis) => {
        const sku = String(r.product_sku || "").trim();
        const prod = sku ? productBySku.get(sku) : null;
        return {
          ...r,
          basis: r.basis || basis,
          item_type: r.item_type || prod?.item_type || "",
          category:
            r.category ||
            r.product_category ||
            prod?.category ||
            prod?.item_type ||
            "",
          product_category:
            r.product_category || prod?.category || "",
        };
      };
      setBilling([
        ...salesRows.map((r) => enrich(r, "sales")),
        ...purchaseRows.map((r) => enrich(r, "purchase")),
      ]);
    } catch (e) {
      console.error(e);
      toast.error("Unable to load billing lines");
      setBilling([]);
    } finally {
      setLoadingBilling(false);
    }
  }, [facilityId, userId, fromDate, toDate, search, branchIds, productBySku]);

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

  const onPeriodDateChange = (key, value) => {
    setRuleForm((f) => {
      const next = { ...f, [key]: value };
      const fromDate = key === "fromDate" ? value : f.fromDate;
      const toDate = key === "toDate" ? value : f.toDate;
      // Keep period label in sync with from/to when it was empty or a known quarter/range
      const parsed = parsePeriodDates(f.period);
      const periodLooksDerived =
        !f.period ||
        (parsed &&
          parsed.fromDate === f.fromDate &&
          parsed.toDate === f.toDate);
      if (periodLooksDerived && fromDate && toDate) {
        next.period = formatPeriodFromDates(fromDate, toDate);
      }
      return next;
    });
  };

  const addRule = (e) => {
    e.preventDefault();
    if (
      !ruleForm.name ||
      !ruleForm.period ||
      !ruleForm.fromDate ||
      !ruleForm.toDate ||
      !ruleForm.minQty ||
      !ruleForm.rebatePercent
    ) {
      toast.error("Fill rule name, period (from–to), min qty, and rebate %");
      return;
    }
    if (ruleForm.fromDate > ruleForm.toDate) {
      toast.error("Period From date must be on or before To date");
      return;
    }
    if (!facilityId) {
      toast.error("No active business selected");
      return;
    }
    const basis = ruleForm.basis === "purchase" ? "purchase" : "sales";
    if (basis === "sales" && !ruleForm.customerNo && !ruleForm.customerName) {
      toast.error("Select a customer for this sales rebate");
      return;
    }
    if (
      basis === "purchase" &&
      !ruleForm.supplierNo &&
      !ruleForm.supplierName
    ) {
      toast.error("Select a supplier for this purchase rebate");
      return;
    }

    const productMode = ruleForm.productMode || "all";
    let product = "All products";
    let productSku = "";
    if (productMode === "category") {
      const cat = String(ruleForm.productCategory || "").trim();
      if (!cat) {
        toast.error("Select a product category");
        return;
      }
      product = cat;
      productSku = `cat:${cat}`;
    } else if (productMode === "product") {
      product = String(ruleForm.product || "").trim();
      productSku = String(ruleForm.productSku || "").trim();
      if (!product || product === "All products") {
        toast.error("Select an individual product");
        return;
      }
    }

    const targetType = basis === "purchase" ? "supplier" : "customer";
    const dates = {
      fromDate: ruleForm.fromDate,
      toDate: ruleForm.toDate,
    };
    const periodLabel =
      ruleForm.period.trim() ||
      formatPeriodFromDates(dates.fromDate, dates.toDate);
    setSavingRule(true);
    _postApi(
      "/api/v1/rebate-ledger/rules",
      {
        facilityId,
        userId,
        name: ruleForm.name.trim(),
        basis,
        targetType,
        product,
        productSku,
        supplierNo: basis === "purchase" ? ruleForm.supplierNo : "",
        supplierName: basis === "purchase" ? ruleForm.supplierName : "",
        customerNo: basis === "sales" ? ruleForm.customerNo : "",
        customerName: basis === "sales" ? ruleForm.customerName : "",
        period: periodLabel,
        fromDate: dates.fromDate,
        toDate: dates.toDate,
        minQty: Number(ruleForm.minQty),
        rebatePercent: Number(ruleForm.rebatePercent),
      },
      (resp) => {
        setSavingRule(false);
        if (resp?.success && resp.result) {
          setRules((r) => [resp.result, ...r]);
          setRuleForm(emptyRuleForm());
          setSelectedSupplier(null);
          setSelectedCustomer(null);
          productTypeaheadRef.current?.clear?.();
          setAddRuleOpen(false);
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
    const rows = [];
    for (const rule of rules) {
      const ruleBasis = rule.basis === "purchase" ? "purchase" : "sales";
      const targetType = String(rule.targetType || "product").toLowerCase();
      const parties = [
        ...new Set(
          billing
            .filter((p) => {
              if ((p.basis || "sales") !== ruleBasis) return false;
              return partyMatchesRule(p, rule);
            })
            .map((p) => (p.customer_name || p.supplier_name || "").trim())
            .filter((c) => c && c !== "—"),
        ),
      ];
      for (const party of parties) {
        const matches = billing.filter((p) => {
          if ((p.basis || "sales") !== ruleBasis) return false;
          const name = (p.customer_name || p.supplier_name || "").trim();
          if (name !== party) return false;
          const d = lineDate(p);
          if (!inRange(d, rule.fromDate, rule.toDate)) return false;
          if (!partyMatchesRule(p, rule)) return false;
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
        const qtyRemaining = Math.max(0, rule.minQty - totalQty);
        const unitValue =
          totalQty > 0 ? totalValue / totalQty : 0;
        // Estimate rebate if they reach min qty at current average unit value
        const projectedRebate =
          unitValue > 0
            ? unitValue * rule.minQty * (rule.rebatePercent / 100)
            : totalValue * (rule.rebatePercent / 100);
        const key = `${party}|${rule.id}`;
        const customerNo =
          matches.find((m) => m.customer_no || m.supplier_no)?.customer_no ||
          matches.find((m) => m.supplier_no)?.supplier_no ||
          "";
        rows.push({
          key,
          customer: party,
          customerNo,
          basis: ruleBasis,
          targetType,
          rule: { ...rule, basis: ruleBasis, targetType },
          totalQty,
          totalValue,
          qualifies,
          rebateAmount,
          qtyRemaining,
          projectedRebate,
          progress: Math.min(100, (totalQty / rule.minQty) * 100),
          status: statuses[key]?.status || "pending",
          payoutType: statuses[key]?.payoutType || "credit",
          creditNoteNumber: statuses[key]?.creditNoteNumber || "",
          modeOfPayment: statuses[key]?.modeOfPayment || "",
          paymentReference: statuses[key]?.paymentReference || "",
          chequeNo: statuses[key]?.chequeNo || "",
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
        (row.basis === "purchase"
          ? `Post-purchase volume rebate: ${row.rule.name} (${row.rule.period})`
          : `Post-sale volume rebate: ${row.rule.name} (${row.rule.period})`),
      basis: row.basis || "sales",
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

  const issuePayment = (row) => {
    if (!facilityId || !userId) return;
    if (!row.customerNo) {
      toast.error("Customer number missing on this rebate — refresh billing.");
      return;
    }
    if (row.paymentReference || row.creditNoteNumber) {
      toast.info(
        row.paymentReference
          ? `Already paid: ${row.paymentReference}`
          : `Already credited: ${row.creditNoteNumber}`,
      );
      return;
    }
    const mode = payForm.modeOfPayment;
    if (mode === "cash" && !accountHead?.head && !accountHead?.code) {
      toast.error("Select a cash account");
      return;
    }
    if (["bank", "cheque"].includes(mode) && !bankAccount?.id) {
      toast.error("Select a bank account");
      return;
    }
    if (mode === "cheque" && !String(payForm.chequeNo || "").trim()) {
      toast.error("Enter cheque number");
      return;
    }

    setPayingKey(row.key);
    _postApi(
      "/api/v1/rebate-ledger/issue-payment",
      {
        facilityId,
        userId,
        ruleId: row.rule.id,
        customer: row.customer,
        customerNo: row.customerNo,
        rebateAmount: row.rebateAmount,
        modeOfPayment: mode,
        accountHead:
          mode === "cash"
            ? { head: accountHead.head || accountHead.code }
            : undefined,
        bankAccount:
          ["bank", "cheque"].includes(mode) && bankAccount
            ? { id: bankAccount.id }
            : undefined,
        chequeNo: mode === "cheque" ? payForm.chequeNo : undefined,
      },
      (resp) => {
        setPayingKey(null);
        if (!resp?.success) {
          toast.error(resp?.message || "Failed to pay rebate");
          return;
        }
        const data = resp.data || {};
        setStatuses((s) => ({
          ...s,
          [row.key]: {
            ...s[row.key],
            status: "paid",
            payoutType: "cash",
            paymentReference: data.paymentReference,
            modeOfPayment: data.modeOfPayment,
            chequeNo: data.chequeNo || "",
            customerNo: row.customerNo,
          },
        }));
        toast.success(
          `Rebate paid via ${String(data.modeOfPayment || mode).toUpperCase()} · ${data.paymentReference}`,
        );
      },
      () => {
        setPayingKey(null);
        toast.error("Failed to pay rebate");
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
            Each rule is based on{" "}
            <span className="font-medium text-slate-700">Sales</span> (customer invoices)
            or <span className="font-medium text-slate-700">Purchase</span> (supplier bills).
            Settle with credit note / vendor credit, or mode of payment.
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
          <div className="flex items-center justify-end">
            <Button
              type="button"
              size="sm"
              className="bg-[var(--aa-navy,#0f2744)] text-white hover:bg-[var(--aa-navy,#0f2744)]/90"
              onClick={() => setAddRuleOpen(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add rule
            </Button>
          </div>

          <Sheet open={addRuleOpen} onOpenChange={setAddRuleOpen}>
            <SheetContent
              side="right"
              className="!inset-y-0 !right-0 !left-auto flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l border-slate-200 p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:!max-w-md [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:bg-white/10 [&>button]:hover:opacity-100"
            >
              <SheetHeader className="shrink-0 space-y-1 border-b border-slate-200 bg-[var(--aa-navy,#0f2744)] px-5 py-4 pr-12 text-left">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md bg-white/10 p-2">
                    <Percent className="h-4 w-4 text-[var(--aa-accent,#c4a35a)]" />
                  </div>
                  <div className="min-w-0">
                    <SheetTitle className="text-lg font-semibold leading-tight text-white">
                      Add rebate rule
                    </SheetTitle>
                    <SheetDescription className="mt-0.5 text-xs text-white/70">
                      Sales: customer + products · Purchase: supplier + products
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <form
                onSubmit={addRule}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-5 py-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">
                      Rule name
                    </label>
                    <input
                      className={`${inputClass} w-full`}
                      placeholder="e.g. E2E Rice Rebate"
                      value={ruleForm.name}
                      onChange={(e) =>
                        setRuleForm({ ...ruleForm, name: e.target.value })
                      }
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">
                      Basis
                    </label>
                    <select
                      className={`${inputClass} w-full`}
                      value={ruleForm.basis || "sales"}
                      onChange={(e) => {
                        const basis = e.target.value;
                        setRuleForm({
                          ...emptyRuleForm(),
                          name: ruleForm.name,
                          basis,
                          period: ruleForm.period,
                          fromDate: ruleForm.fromDate,
                          toDate: ruleForm.toDate,
                          minQty: ruleForm.minQty,
                          rebatePercent: ruleForm.rebatePercent,
                          productMode: ruleForm.productMode || "all",
                          product: ruleForm.product,
                          productSku: ruleForm.productSku,
                          productCategory: ruleForm.productCategory,
                        });
                        setSelectedSupplier(null);
                        setSelectedCustomer(null);
                      }}
                    >
                      <option value="sales">Sales</option>
                      <option value="purchase">Purchase</option>
                    </select>
                  </div>

                  {ruleForm.basis === "purchase" ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">
                        Supplier
                      </label>
                      <SearchSupplierInput
                        selected={selectedSupplier ? [selectedSupplier] : []}
                        onChange={(sup) => {
                          setSelectedSupplier(sup);
                          setRuleForm((f) => ({
                            ...f,
                            supplierNo:
                              sup?.supplier_number ||
                              sup?.supplierNo ||
                              "",
                            supplierName: sup?.supplier_name || "",
                          }));
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">
                        Customer
                      </label>
                      <SearchCustomerInput
                        selected={selectedCustomer ? [selectedCustomer] : []}
                        onChange={(cus) => {
                          setSelectedCustomer(cus);
                          setRuleForm((f) => ({
                            ...f,
                            customerNo: cus?.customerNo || "",
                            customerName: cus
                              ? cus.fullname ||
                                cus.name ||
                                cus.customerName ||
                                cus.company_name ||
                                ""
                              : "",
                          }));
                        }}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">
                      Product selection
                    </label>
                    <select
                      className={`${inputClass} w-full`}
                      value={ruleForm.productMode || "all"}
                      onChange={(e) => {
                        const productMode = e.target.value;
                        setRuleForm((f) => ({
                          ...f,
                          productMode,
                          product: "All products",
                          productSku: "",
                          productCategory: "",
                        }));
                        productTypeaheadRef.current?.clear?.();
                      }}
                    >
                      <option value="all">All products</option>
                      <option value="category">By category</option>
                      <option value="product">Individual product</option>
                    </select>
                  </div>

                  {ruleForm.productMode === "category" ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">
                        Category
                      </label>
                      <select
                        className={`${inputClass} w-full`}
                        value={ruleForm.productCategory || ""}
                        onChange={(e) => {
                          const productCategory = e.target.value;
                          setRuleForm((f) => ({
                            ...f,
                            productCategory,
                            product: productCategory || "All products",
                            productSku: productCategory
                              ? `cat:${productCategory}`
                              : "",
                          }));
                        }}
                        disabled={loadingProducts || loadingCategories}
                      >
                        <option value="">
                          {loadingProducts || loadingCategories
                            ? "Loading categories…"
                            : productCategories.length
                              ? "Select category…"
                              : "No categories found"}
                        </option>
                        {productCategories.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                            {c.count ? ` (${c.count})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {ruleForm.productMode === "product" ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">
                        Product
                      </label>
                      <Typeahead
                        id="rebate-rule-product-typeahead"
                        ref={productTypeaheadRef}
                        labelKey={(p) =>
                          p?.sku ? `${p.name} (${p.sku})` : p?.name || ""
                        }
                        options={products}
                        selected={selectedProduct}
                        placeholder={
                          loadingProducts
                            ? "Loading products…"
                            : "Type to search product…"
                        }
                        disabled={loadingProducts}
                        clearButton
                        highlightOnlyResult
                        onChange={(selected) => {
                          if (!selected?.length) {
                            setRuleForm((f) => ({
                              ...f,
                              product: "",
                              productSku: "",
                            }));
                            return;
                          }
                          const product = selected[0];
                          setRuleForm((f) => ({
                            ...f,
                            product: product.name || "",
                            productSku: product.sku || "",
                          }));
                        }}
                      />
                    </div>
                  ) : null}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">
                      Period
                    </label>
                    <select
                      className={`${inputClass} w-full`}
                      value={
                        buildPeriodOptions().includes(ruleForm.period)
                          ? ruleForm.period
                          : ruleForm.period || ruleForm.fromDate || ruleForm.toDate
                            ? "__custom__"
                            : ""
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) {
                          setRuleForm((f) => ({
                            ...f,
                            period: "",
                            fromDate: "",
                            toDate: "",
                          }));
                          return;
                        }
                        if (v === "__custom__") {
                          setRuleForm((f) => ({
                            ...f,
                            period:
                              f.fromDate && f.toDate
                                ? formatPeriodFromDates(f.fromDate, f.toDate) ||
                                  f.period ||
                                  "Custom"
                                : f.period || "Custom",
                          }));
                          return;
                        }
                        onPeriodChange(v);
                      }}
                    >
                      <option value="">Select period…</option>
                      {buildPeriodOptions().map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                      <option value="__custom__">Custom range</option>
                    </select>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-slate-500">
                          From
                        </label>
                        <input
                          className={`${inputClass} w-full`}
                          type="date"
                          value={ruleForm.fromDate}
                          onChange={(e) =>
                            onPeriodDateChange("fromDate", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-slate-500">
                          To
                        </label>
                        <input
                          className={`${inputClass} w-full`}
                          type="date"
                          value={ruleForm.toDate}
                          onChange={(e) =>
                            onPeriodDateChange("toDate", e.target.value)
                          }
                        />
                      </div>
                    </div>
                    {ruleForm.fromDate && ruleForm.toDate ? (
                      <p className="text-[11px] text-slate-500">
                        {formatPeriodFromDates(
                          ruleForm.fromDate,
                          ruleForm.toDate,
                        ) || `${ruleForm.fromDate} → ${ruleForm.toDate}`}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        Choose this month, next month, or set From / To dates.
                      </p>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">
                        Min qty
                      </label>
                      <input
                        className={`${inputClass} w-full font-mono`}
                        type="number"
                        placeholder="1"
                        value={ruleForm.minQty}
                        onChange={(e) =>
                          setRuleForm({ ...ruleForm, minQty: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">
                        Rebate %
                      </label>
                      <input
                        className={`${inputClass} w-full font-mono`}
                        type="number"
                        step="0.1"
                        placeholder="2.5"
                        value={ruleForm.rebatePercent}
                        onChange={(e) =>
                          setRuleForm({
                            ...ruleForm,
                            rebatePercent: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddRuleOpen(false)}
                    disabled={savingRule}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={savingRule}
                    className="bg-[var(--aa-navy,#0f2744)] text-white hover:bg-[var(--aa-navy,#0f2744)]/90"
                  >
                    {savingRule ? "Saving…" : "Save rule"}
                  </Button>
                </div>
              </form>
            </SheetContent>
          </Sheet>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5">Rule</th>
                  <th className="px-3 py-2.5">Basis</th>
                  <th className="px-3 py-2.5">Based on</th>
                  <th className="px-3 py-2.5">Applies to</th>
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
                      <td colSpan={8} className="px-3 py-2">
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
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          r.basis === "purchase"
                            ? "border-violet-200 bg-violet-50 text-violet-800"
                            : "border-sky-200 bg-sky-50 text-sky-800"
                        }`}
                      >
                        {r.basis === "purchase" ? "Purchase" : "Sales"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                        {r.basis === "purchase" ? "Supplier" : "Customer"}
                        {isCategorySku(r.productSku)
                          ? " · Category"
                          : r.product && r.product !== "All products"
                            ? " · Product"
                            : " · All products"}
                      </span>
                    </td>
                    <td className="bg-white px-3 py-2.5 text-slate-600">
                      {ruleAppliesToLabel(r)}
                      {ruleAppliesToSub(r) ? (
                        <span className="mt-0.5 block font-mono text-[11px] text-slate-400">
                          {ruleAppliesToSub(r)}
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
                      colSpan={8}
                      className="px-3 py-8 text-center text-slate-500"
                    >
                      No rules yet. Click Add rule to create one.
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
                  <th className="px-3 py-2.5">Doc</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Basis</th>
                  <th className="px-3 py-2.5">Party</th>
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
                      <td colSpan={8} className="px-3 py-2">
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
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            p.basis === "purchase"
                              ? "border-violet-200 bg-violet-50 text-violet-800"
                              : "border-sky-200 bg-sky-50 text-sky-800"
                          }`}
                        >
                          {p.basis === "purchase" ? "Purchase" : "Sales"}
                        </span>
                      </td>
                      <td className="bg-white px-3 py-2.5">
                        {p.customer_name || p.supplier_name || "—"}
                        {(p.customer_no || p.supplier_no) && (
                          <span className="mt-0.5 block font-mono text-[11px] text-slate-400">
                            {p.customer_no || p.supplier_no}
                          </span>
                        )}
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
              No billing lines match a rebate rule yet. Check Rules basis (Sales /
              Purchase), dates, and product names.
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
                        <span
                          className={`mr-1.5 inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                            row.basis === "purchase"
                              ? "border-violet-200 bg-violet-50 text-violet-800"
                              : "border-sky-200 bg-sky-50 text-sky-800"
                          }`}
                        >
                          {row.basis === "purchase" ? "Purchase" : "Sales"}
                        </span>
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
                  <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[11px] text-slate-500">
                    <span>
                      {row.totalQty.toLocaleString()} /{" "}
                      {Number(row.rule.minQty).toLocaleString()} units
                    </span>
                    <span>{Math.round(row.progress)}%</span>
                  </div>
                  <div className="mb-2 text-[11px] text-slate-500">
                    Applies to: {ruleAppliesToLabel(row.rule)}
                  </div>

                  {!row.qualifies ? (
                    <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      <div className="font-semibold">
                        Need {row.qtyRemaining.toLocaleString()} more unit
                        {row.qtyRemaining === 1 ? "" : "s"} to reach target
                      </div>
                      <div className="mt-0.5 text-amber-800/90">
                        {row.basis === "purchase" ? "Purchase" : "Sell"}{" "}
                        {row.qtyRemaining.toLocaleString()} more of{" "}
                        {isCategorySku(row.rule.productSku)
                          ? `category “${categoryFromSku(row.rule.productSku) || row.rule.product}”`
                          : row.rule.product && row.rule.product !== "All products"
                            ? `“${row.rule.product}”`
                            : "qualifying products"}{" "}
                        to unlock an estimated rebate of{" "}
                        <span className="font-mono font-semibold">
                          {formatNumber1(row.projectedRebate)}
                        </span>{" "}
                        ({row.rule.rebatePercent}%).
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                      Target reached — rebate of{" "}
                      <span className="font-mono font-semibold">
                        {formatNumber1(row.rebateAmount)}
                      </span>{" "}
                      is available.
                    </div>
                  )}

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
                        {row.qualifies
                          ? `Rebate (${row.rule.rebatePercent}%)`
                          : `Est. rebate (${row.rule.rebatePercent}%)`}
                      </div>
                      <div
                        className={`font-mono text-sm font-semibold ${
                          row.qualifies ? "text-slate-900" : "text-amber-700"
                        }`}
                      >
                        {formatNumber1(
                          row.qualifies
                            ? row.rebateAmount
                            : row.projectedRebate,
                        )}
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
                          disabled={row.status === "paid"}
                        >
                          <option value="credit">
                            {row.basis === "purchase"
                              ? "Vendor credit"
                              : "Customer credit note"}
                          </option>
                          <option value="cash">Mode of payment</option>
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
                                : row.basis === "purchase"
                                  ? "Issue vendor credit"
                                  : "Issue credit note"}
                            </Button>
                          )}
                        </div>
                      )}
                      {row.payoutType === "cash" && (
                        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/80 p-2.5">
                          {row.paymentReference ? (
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-700">
                              <span className="font-mono font-semibold">
                                {row.paymentReference}
                              </span>
                              <span className="uppercase tracking-wide text-slate-500">
                                {row.modeOfPayment || "paid"}
                              </span>
                              {row.chequeNo ? (
                                <span>Chq {row.chequeNo}</span>
                              ) : null}
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-wrap gap-2">
                                <select
                                  className={`${inputClass} min-w-[120px] flex-1`}
                                  value={payForm.modeOfPayment}
                                  onChange={(e) =>
                                    setPayForm({
                                      ...payForm,
                                      modeOfPayment: e.target.value,
                                      chequeNo: "",
                                    })
                                  }
                                >
                                  <option value="cash">Cash</option>
                                  <option value="bank">Bank</option>
                                  <option value="cheque">Cheque</option>
                                </select>
                                {payForm.modeOfPayment === "cash" ? (
                                  <select
                                    className={`${inputClass} min-w-[160px] flex-[1.4]`}
                                    value={accountHead?.head || ""}
                                    onChange={(e) => {
                                      const head = e.target.value;
                                      const found =
                                        headList.find(
                                          (h) =>
                                            String(h.head || h.code) === head,
                                        ) || {};
                                      setAccountHead({
                                        ...found,
                                        head: found.head || found.code || head,
                                      });
                                    }}
                                  >
                                    <option value="">Cash account…</option>
                                    {headList.map((h) => {
                                      const code = h.head || h.code;
                                      return (
                                        <option key={code} value={code}>
                                          {h.description || h.name || code} (
                                          {code})
                                        </option>
                                      );
                                    })}
                                  </select>
                                ) : (
                                  <select
                                    className={`${inputClass} min-w-[160px] flex-[1.4]`}
                                    value={bankAccount?.id || ""}
                                    onChange={(e) => {
                                      const id = e.target.value;
                                      const found =
                                        accountList.find(
                                          (a) => String(a.id) === String(id),
                                        ) || null;
                                      setBankAccount(found);
                                    }}
                                  >
                                    <option value="">Bank account…</option>
                                    {accountList.map((a) => (
                                      <option key={a.id} value={a.id}>
                                        {a.account_name}
                                        {a.head ? ` (${a.head})` : ""}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                {payForm.modeOfPayment === "cheque" ? (
                                  <input
                                    className={`${inputClass} min-w-[120px]`}
                                    placeholder="Cheque no."
                                    value={payForm.chequeNo}
                                    onChange={(e) =>
                                      setPayForm({
                                        ...payForm,
                                        chequeNo: e.target.value,
                                      })
                                    }
                                  />
                                ) : null}
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 bg-[var(--aa-navy,#0f2744)] text-white hover:bg-[var(--aa-navy,#0f2744)]/90"
                                disabled={payingKey === row.key}
                                onClick={() => issuePayment(row)}
                              >
                                <Banknote className="mr-1.5 h-3.5 w-3.5" />
                                {payingKey === row.key
                                  ? row.basis === "purchase"
                                    ? "Receiving…"
                                    : "Paying…"
                                  : row.basis === "purchase"
                                    ? "Receive rebate"
                                    : "Pay rebate claim"}
                              </Button>
                            </>
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
                  {doc.basis === "purchase" ? "Credit from vendor" : "Credit to"}
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
  return fetchLineReportPage({
    facilityId,
    userId,
    fromDate,
      toDate,
    search,
    branchId,
    page,
    pageSize,
    endpoint: "/api/v1/transactions/sales-line-report",
  });
}

async function fetchAllPurchaseLines(args) {
  let page = 1;
  let all = [];
  let totalCount = Infinity;
  while (all.length < totalCount) {
    const batch = await fetchLineReportPage({
      ...args,
      page,
      pageSize: PAGE_SIZE,
      endpoint: "/api/v1/transactions/purchase-line-report",
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

function fetchLineReportPage({
  facilityId,
  userId,
  fromDate,
  toDate,
  search,
  branchId,
  page,
  pageSize,
  endpoint,
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
      `${endpoint}?${params.toString()}`,
      (res) => {
        if (res?.success) {
          resolve({
            rows: Array.isArray(res.results) ? res.results : [],
            totalCount: parseInt(res.totalCount || 0, 10),
          });
        } else {
          reject(new Error(res?.message || "Failed to fetch lines"));
        }
      },
      (err) => reject(err),
    );
  });
}
