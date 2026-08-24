import { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import moment from "moment";
import { toast } from "sonner";

import {
  Container,
  Row,
  Col,
  Input,
  Label,
  Button,
  Card,
  CardBody,
  CardTitle,
  Badge,
  Pagination,
  PaginationItem,
  PaginationLink,
  Table,
} from "reactstrap";

import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import CustomTable1 from "@/common/Custom/CustomTable1";
import Loading from "@/common/Custom/Loading";
import { Eye, List, Grid3x3, Plus, X, ChevronDown } from "lucide-react";
import { Button as UIButton } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const fmtQty = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
};

const fmtDateTime = (value) => {
  if (!value) return "—";
  const m = moment(value);
  return m.isValid() ? m.format("YYYY-MM-DD HH:mm") : String(value);
};

/** Normalize manufacturing runStatus for UI actions. */
const normalizeRunStatus = (raw) => {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (!s || s === "unknown" || s === "—") return "unknown";
  if (s === "closed" || s === "close") return "closed";
  if (
    s === "partial" ||
    s === "incomplete" ||
    s === "uncomplete" ||
    s === "in_progress" ||
    s === "in-progress"
  ) {
    return "partial";
  }
  if (s === "complete" || s === "completed") return "complete";
  return s;
};

/** One list row per batch (batch_no, Batch-* id, or id). */
const manufacturingBatchKey = (row = {}) => {
  const batch = String(row.batch_no || "").trim();
  const id = String(row.id || "").trim();
  if (batch) return batch;
  if (/^Batch-/i.test(id)) return id;
  return id;
};

const dedupeManufacturingRecords = (rows = []) => {
  const byBatchKey = new Map();
  for (const row of rows) {
    const key = manufacturingBatchKey(row);
    if (!key) continue;
    const prev = byBatchKey.get(key);
    if (!prev) {
      byBatchKey.set(key, row);
      continue;
    }
    const rowTime = new Date(row.created_at || 0).getTime();
    const prevTime = new Date(prev.created_at || 0).getTime();
    if (rowTime > prevTime) {
      byBatchKey.set(key, row);
      continue;
    }
    if (rowTime === prevTime) {
      const rowIdMatchesBatch =
        String(row.id || "").trim() === String(row.batch_no || "").trim();
      const prevIdMatchesBatch =
        String(prev.id || "").trim() === String(prev.batch_no || "").trim();
      if (rowIdMatchesBatch && !prevIdMatchesBatch) {
        byBatchKey.set(key, row);
      }
    }
  }
  return Array.from(byBatchKey.values()).sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime(),
  );
};

const isRawMaterialType = (type) => {
  const t = String(type || "raw_material").toLowerCase();
  return t === "raw_material" || t.includes("raw material");
};

const isOtherCostType = (type) => {
  const t = String(type || "").toLowerCase();
  return t === "other" || t === "by_product_credit" || t.includes("by_product");
};

const resolveOtherCostAmounts = (item) => {
  const otherType = String(
    item.otherType || item.other_type || "rate",
  ).toLowerCase();
  const rateNum = parseFloat(item.rate ?? item.rate_amount ?? 0);
  const rate = Number.isFinite(rateNum) ? rateNum : 0;
  const qtyNum = Number(item.quantity ?? item.recipeQty ?? 0);
  let actualQty = Number(
    item.actual_qty ?? item.actualQty ?? item.qtyUsed ?? 0,
  );

  if (otherType === "percentage") {
    return {
      actualQty: qtyNum,
      rate,
      amount: Number(item.amount ?? 0),
    };
  }

  actualQty = actualQty || qtyNum;
  let amount = Number(item.amount ?? 0);
  if (!amount) {
    if (actualQty > 0 && rate > 0) amount = actualQty * rate;
    else if (rate > 0) amount = rate;
  }
  return { actualQty, rate, amount };
};

const mapIngredientRow = (ing, totalOutputQty) => {
  const recipeQty = Number(ing.quantity ?? 0);
  let expectedQty = Number(
    ing.expectedQty ?? ing.expected_qty ?? ing.expectedQuantity ?? 0,
  );
  let actualQty = Number(
    ing.actualQty ?? ing.actual_qty ?? ing.qtyUsed ?? ing.qty_used ?? 0,
  );
  if (!expectedQty && recipeQty && totalOutputQty > 0) {
    expectedQty = recipeQty * totalOutputQty;
  }
  if (!actualQty && ing.qtyUsed != null) {
    actualQty = Number(ing.qtyUsed);
  }
  const unitCost = Number(
    ing.unit_cost ?? ing.product?.unit_cost ?? ing.product?.cost_price ?? 0,
  );
  const otherAmounts = isOtherCostType(ing.type || ing.item_type || "")
    ? resolveOtherCostAmounts(ing)
    : null;
  return {
    name:
      ing.description ||
      ing.item_name ||
      ing.name ||
      ing.rawMaterialName ||
      ing.product?.item_name ||
      "—",
    type: ing.type || ing.item_type || "",
    recipeQty,
    expectedQty,
    actualQty: otherAmounts ? otherAmounts.actualQty : actualQty,
    unitCost,
    rate: otherAmounts ? otherAmounts.rate : Number(ing.rate ?? 0) || 0,
    totalCost: otherAmounts
      ? otherAmounts.amount
      : unitCost * actualQty,
    amount: otherAmounts ? otherAmounts.amount : Number(ing.amount ?? 0),
    unit:
      ing.unit ||
      ing.unit_of_measure ||
      ing.unitOfMeasure ||
      ing.product?.unit_of_measure ||
      "",
    sku:
      ing.rawMaterialSku ||
      ing.item_code ||
      ing.sku ||
      ing.product?.sku ||
      ing.product?.item_code ||
      "",
    accountHead: ing.accountHead || ing.account_head || "",
    descriptionCode: ing.descriptionCode || ing.description_code || "",
    otherType: ing.otherType || ing.other_type || "",
    percentageBasis: ing.percentageBasis || ing.percentage_basis || "",
  };
};

const parseManufacturingData = (record) => {
  if (!record) return null;

  let data = {};
  try {
    data =
      typeof record.data === "string"
        ? JSON.parse(record.data || "{}")
        : record.data || {};
  } catch {
    data = {};
  }

  const products = Array.isArray(data.products) ? data.products : [];
  const runMetrics = data.runMetrics || {};
  const sessionHistory = Array.isArray(data.sessionHistory)
    ? data.sessionHistory
    : [];
  const lastSession = sessionHistory.length
    ? sessionHistory[sessionHistory.length - 1]
    : null;

  const productSummaries = products.map((p, idx) => {
    const fgs = Array.isArray(p.finishedGoods) ? p.finishedGoods : [];
    const finishedGoods = fgs.map((fg) => {
      const goodQty = Number(fg.goodQuantity ?? fg.goodQty ?? 0);
      const wasteQty = Number(fg.wasteQuantity ?? fg.wasteQty ?? 0);
      const previousGoodQty = Number(fg.previousGoodQuantity ?? 0);
      const previousWasteQty = Number(fg.previousWasteQuantity ?? 0);
      const expectedQty = Number(fg.expectedQty ?? 0);
      const sessionOutput = goodQty + wasteQty;
      const cumulativeOutput =
        Number(fg.totalOutput ?? 0) ||
        previousGoodQty + previousWasteQty + sessionOutput;
      let yieldPct =
        fg.yieldPct != null && fg.yieldPct !== ""
          ? Number(fg.yieldPct)
          : null;
      if (yieldPct == null && expectedQty > 0) {
        yieldPct = parseFloat(
          (((previousGoodQty + goodQty) / expectedQty) * 100).toFixed(2),
        );
      }
      return {
        productName:
          fg.finishedGood?.item_name ||
          fg.finishedGood?.name ||
          fg.productName ||
          p.productName ||
          p.engineName ||
          "—",
        productSku:
          fg.finishedGood?.item_code ||
          fg.finishedGood?.sku ||
          p.productSku ||
          "",
        quantity: Number(fg.quantity ?? 0),
        unitOfMeasure:
          fg.unitOfMeasure ||
          fg.unit ||
          fg.finishedGood?.unit_of_measure ||
          "",
        expectedQty,
        goodQty,
        wasteQty,
        previousGoodQty,
        previousWasteQty,
        sessionOutput,
        cumulativeOutput,
        yieldPct,
        operator: fg.operator || "",
        branch: fg.branch_name || "",
        branchId: fg.branch_id || fg.branchLocationId || "",
        engineName: fg.engineName || p.engineName || "",
        multiplierValue: Number(fg.multiplierValue ?? fg.units ?? 1),
        wasteType: fg.wasteType || "",
        wasteReason: fg.wasteReason || "",
        sessionStartTime: fg.sessionStartTime || "",
        sessionEndTime: fg.sessionEndTime || "",
        shortfallReason: fg.shortfallReason || "",
        category: fg.category || "",
        warehouse: fg.warehouse || "",
        scrapProducts: (fg.wasteScrapByProductSelection || []).map(
          (s) => s.item_name || s.name || s.sku || "—",
        ),
      };
    });

    const rawItems = Array.isArray(p.items)
      ? p.items
      : Array.isArray(p.ingredients)
        ? p.ingredients
        : [];

    const totalOutputQty = finishedGoods.reduce(
      (sum, fg) => sum + fg.goodQty + fg.wasteQty,
      0,
    );

    const allIngredients = rawItems.map((ing) =>
      mapIngredientRow(ing, totalOutputQty),
    );

    return {
      index: idx + 1,
      engineName: p.engineName || finishedGoods[0]?.engineName || "",
      productName:
        p.productName || p.engineName || finishedGoods[0]?.productName || "—",
      productSku: p.productSku || "",
      units: Number(p.units ?? p.productQty ?? 0),
      finishedGoods,
      rawMaterials: allIngredients.filter((ing) => isRawMaterialType(ing.type)),
      otherItems: allIngredients.filter((ing) => isOtherCostType(ing.type)),
      ingredients: allIngredients,
    };
  });

  const goodQty = Number(
    record.good_qty ??
      runMetrics.goodQty ??
      lastSession?.goodQty ??
      productSummaries.reduce(
        (sum, p) =>
          sum + p.finishedGoods.reduce((a, fg) => a + fg.goodQty, 0),
        0,
      ),
  );
  const wasteQty = Number(
    record.waste_qty ??
      runMetrics.wasteQty ??
      lastSession?.brokenQty ??
      productSummaries.reduce(
        (sum, p) =>
          sum + p.finishedGoods.reduce((a, fg) => a + fg.wasteQty, 0),
        0,
      ),
  );

  let yieldPct = record.yield_pct ?? runMetrics.yieldPct ?? null;
  const expectedTotal = productSummaries.reduce(
    (sum, p) =>
      sum + p.finishedGoods.reduce((a, fg) => a + fg.expectedQty, 0),
    0,
  );
  if (
    (yieldPct === null || yieldPct === undefined || yieldPct === "") &&
    expectedTotal > 0
  ) {
    yieldPct = parseFloat(((goodQty / expectedTotal) * 100).toFixed(2));
  }

  const costingType = data.costingType || record.type || "";
  const mapSharedCost = (cost) => {
    const recipeQty = Number(cost.quantity ?? 0);
    const expectedQty = Number(
      cost.expected_qty ??
        cost.expectedQty ??
        cost.expectedQuantity ??
        recipeQty,
    );
    const actualQty = Number(
      cost.actual_qty ?? cost.actualQty ?? cost.qtyUsed ?? cost.qty_used ?? 0,
    );
    const unitCost = Number(cost.unit_cost ?? 0);
    const base = {
      name:
        cost.description ||
        cost.rawMaterialName ||
        cost.item_name ||
        cost.name ||
        "—",
      type: cost.type || "",
      sku: cost.rawMaterialSku || cost.raw_material_sku || "",
      accountHead: cost.accountHead || cost.account_head || "",
      recipeQty,
      expectedQty,
      unitCost,
      otherType: cost.otherType || cost.other_type || "",
      percentageBasis: cost.percentageBasis || cost.percentage_basis || "",
    };

    if (isRawMaterialType(cost.type)) {
      return {
        ...base,
        actualQty,
        rate: unitCost,
        totalCost: unitCost * actualQty,
        amount: unitCost * actualQty,
      };
    }

    const { actualQty: oActual, rate: oRate, amount: oAmount } =
      resolveOtherCostAmounts(cost);
    return {
      ...base,
      actualQty: oActual,
      rate: oRate,
      totalCost: oAmount,
      amount: oAmount,
    };
  };
  const allSharedCosts = (Array.isArray(data.sharedCosts) ? data.sharedCosts : []).map(
    mapSharedCost,
  );
  const sharedRawMaterials = allSharedCosts.filter((c) =>
    isRawMaterialType(c.type),
  );
  const sharedOtherCosts = allSharedCosts.filter((c) => isOtherCostType(c.type));

  const sessionHistoryRows = sessionHistory.map((s, idx) => ({
    index: idx + 1,
    goodQty: Number(s.goodQty ?? 0),
    wasteQty: Number(s.brokenQty ?? s.wasteQty ?? 0),
    startTime: s.sessionStartTime || s.startTime || "",
    endTime: s.sessionEndTime || s.endTime || "",
    notes: s.notes || s.shortfallReason || "",
  }));

  const sharedJointWaste = data.sharedJointWaste || null;

  return {
    batchNo: record.batch_no || record.id || "—",
    costingType,
    costingLabel:
      costingType === "joint_shared"
        ? "Joint / Shared"
        : costingType === "job_specific"
          ? "Job / Specific"
          : costingType || "—",
    runStatus: normalizeRunStatus(
      record.run_status || data.runStatus || record.status || "—",
    ),
    status: record.status || "—",
    productionDate: record.production_date || record.created_at,
    output: Number(data.output ?? 0),
    qtyUse: Number(data.qtyUse ?? 0),
    goodQty,
    wasteQty,
    yieldPct:
      yieldPct != null && yieldPct !== "" && Number.isFinite(Number(yieldPct))
        ? Number(yieldPct)
        : null,
    productSummaries,
    sharedCosts: allSharedCosts,
    sharedRawMaterials,
    sharedOtherCosts,
    sessionHistory: sessionHistoryRows,
    sharedJointWaste,
    templateByProduct: data.templateByProduct || null,
    expectedTotal,
    notes: record.notes,
    productionLine: record.production_line,
    creatorName: record.creator_name,
  };
};

export default function ManufacturingProduction() {
  const { activeBusiness } = useSelector((state) => state.auth);
  const primaryColor = activeBusiness?.primary_color || "#1a2d5e";
  const navigate = useNavigate();
  const location = useLocation();

  const [viewMode, setViewMode] = useState("list"); // 'list' or 'card'
  const [productionRecords, setProductionRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [dateRange, setDateRange] = useState({
    startDate: moment().subtract(30, "days").format("YYYY-MM-DD"),
    endDate: moment().format("YYYY-MM-DD"),
  });
  const [modal, setModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [closingRunId, setClosingRunId] = useState(null);

  const closeManufacturingRun = useCallback(
    (item) => {
      if (!activeBusiness?.id || !item?.id) return;
      const runStatus = normalizeRunStatus(
        item.run_status ||
          (typeof item.data === "object" ? item.data?.runStatus : null),
      );
      if (runStatus !== "partial") {
        toast.error("Only incomplete runs can be closed");
        return;
      }
      setClosingRunId(item.id);
      _postApi(
        `/api/production/manufacturing-records/${encodeURIComponent(item.id)}/close-run`,
        { facilityId: activeBusiness.id },
        (resp) => {
          setClosingRunId(null);
          if (resp?.success) {
            toast.success(resp.message || "Run closed");
            setProductionRecords((prev) =>
              prev.map((row) => {
                if (String(row.id) !== String(item.id)) return row;
                let data = row.data;
                if (typeof data === "string") {
                  try {
                    data = JSON.parse(data);
                  } catch {
                    data = {};
                  }
                }
                if (!data || typeof data !== "object") data = {};
                return {
                  ...row,
                  run_status: "closed",
                  data: { ...data, runStatus: "closed" },
                };
              }),
            );
          } else {
            toast.error(resp?.message || "Failed to close run");
          }
        },
        (err) => {
          setClosingRunId(null);
          toast.error(err?.message || "Failed to close run");
        },
      );
    },
    [activeBusiness?.id],
  );

  // Initialize filters & pagination from URL on first load
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    const urlStartDate = params.get("startDate");
    const urlEndDate = params.get("endDate");
    const urlSearch = params.get("search") || "";
    const urlPage = parseInt(params.get("page") || "1", 10);
    const urlPageSize = parseInt(params.get("pageSize") || "10", 10);

    setDateRange((prev) => ({
      startDate: urlStartDate || prev.startDate,
      endDate: urlEndDate || prev.endDate,
    }));

    setSearchTerm(urlSearch);

    setCurrentPage(!Number.isNaN(urlPage) && urlPage > 0 ? urlPage : 1);
    setItemsPerPage(
      !Number.isNaN(urlPageSize) && urlPageSize > 0 ? urlPageSize : 10
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep URL in sync with filters & pagination
  useEffect(() => {
    const params = new URLSearchParams();

    if (dateRange.startDate) params.set("startDate", dateRange.startDate);
    if (dateRange.endDate) params.set("endDate", dateRange.endDate);
    if (searchTerm) params.set("search", searchTerm);

    params.set("page", String(currentPage));
    params.set("pageSize", String(itemsPerPage));

    navigate(
      {
        pathname: location.pathname,
        search: params.toString(),
      },
      { replace: true }
    );
  }, [
    dateRange.startDate,
    dateRange.endDate,
    searchTerm,
    currentPage,
    itemsPerPage,
    navigate,
    location.pathname,
  ]);

  const fetchProductionRecords = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoading(true);
    _fetchApi(
      // Fetch a larger batch and handle filtering + pagination on the client
      `/api/production/manufacturing-records?facilityId=${activeBusiness.id}&page=1&limit=1000`,
      (resp) => {
        setLoading(false);
        if (resp.success) {
          setProductionRecords(
            dedupeManufacturingRecords(resp.data.productionRecords || []),
          );
        } else {
          toast.error("Failed to load production records");
        }
      },
      (err) => {
        setLoading(false);
        console.error("API Error:", err);
        toast.error("Error fetching production records");
      }
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    fetchProductionRecords();
  }, [fetchProductionRecords]);

  // Apply date and search filters locally
  const filteredRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return productionRecords.filter((record) => {
      // Prefer filtering by the record creation date (when it was entered),
      // and fall back to the production date if needed. This matches the UI
      // behaviour where the default date range is "recent activity".
      const recordDate = record.created_at
        ? moment(record.created_at).format("YYYY-MM-DD")
        : record.production_date
        ? moment(record.production_date).format("YYYY-MM-DD")
        : null;

      const withinStart =
        !dateRange.startDate ||
        (recordDate && recordDate >= dateRange.startDate);
      const withinEnd =
        !dateRange.endDate || (recordDate && recordDate <= dateRange.endDate);

      const matchesSearch =
        !term ||
        (record.id && String(record.id).toLowerCase().includes(term)) ||
        (record.batch_no &&
          String(record.batch_no).toLowerCase().includes(term)) ||
        (record.notes &&
          String(record.notes).toLowerCase().includes(term)) ||
        (record.production_line &&
          String(record.production_line).toLowerCase().includes(term));

      return withinStart && withinEnd && matchesSearch;
    });
  }, [productionRecords, dateRange.startDate, dateRange.endDate, searchTerm]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleDateChange = (field, value) => {
    setDateRange((prev) => ({
      ...prev,
      [field]: value,
    }));
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const toggleModal = () => setModal(!modal);

  const viewItemDetails = (item) => {
    setSelectedItem(item);
    toggleModal();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "success";
      case "reserved":
        return "warning";
      case "draft":
        return "secondary";
      case "sold":
        return "danger";
      default:
        return "secondary";
    }
  };

  const ListView = () => {
    const getRunMetrics = (item) => {
      let data = {};
      try {
        data =
          typeof item.data === "string"
            ? JSON.parse(item.data || "{}")
            : item.data || {};
      } catch {
        data = {};
      }
      const runMetrics = data?.runMetrics || {};
      const sessionHistory = Array.isArray(data?.sessionHistory)
        ? data.sessionHistory
        : [];
      const lastSession = sessionHistory.length
        ? sessionHistory[sessionHistory.length - 1]
        : null;
      const firstFg = data?.products?.[0]?.finishedGoods?.[0] || {};
      const goodQty = Number(
        item.good_qty ??
          runMetrics.goodQty ??
          lastSession?.goodQty ??
          firstFg.goodQuantity ??
          0,
      );
      const wasteQty = Number(
        item.waste_qty ??
          runMetrics.wasteQty ??
          lastSession?.brokenQty ??
          firstFg.wasteQuantity ??
          0,
      );
      let yieldPctRaw =
        item.yield_pct ?? runMetrics.yieldPct ?? firstFg.yieldPct ?? null;
      const expectedQty = Number(
        runMetrics.expectedQty ??
          firstFg.expectedQty ??
          0,
      );
      if (
        (yieldPctRaw === null || yieldPctRaw === undefined || yieldPctRaw === "") &&
        expectedQty > 0
      ) {
        yieldPctRaw = parseFloat(((goodQty / expectedQty) * 100).toFixed(2));
      }
      const runStatus = normalizeRunStatus(
        item.run_status || data.runStatus || item.status || "unknown",
      );
      return {
        goodQty,
        wasteQty,
        yieldPct:
          yieldPctRaw === null || yieldPctRaw === undefined || yieldPctRaw === ""
            ? null
            : Number(yieldPctRaw),
        runStatus,
      };
    };

    const fields = [
      {
        value: "production_date",
        title: "Date",
        custom: true,
        className: "text-left",
        component: (item) => {
          const displayDate = item.created_at || item.production_date;
          return (
            <div className="text-sm">
              {displayDate ? moment(displayDate).format("YYYY-MM-DD") : "N/A"}
            </div>
          );
        },
      },
      {
        value: "batch_no",
        title: "Batch",
        custom: true,
        className: "text-left",
        component: (item) => (
          <div className="font-medium">{item.batch_no || item.id}</div>
        ),
      },
      {
        value: "costing_type",
        title: "Type",
        custom: true,
        className: "text-left",
        component: (item) => (
          <div className="text-sm">
            <Badge
              color={item.type === "joint_shared" ? "info" : "primary"}
            >
              {item.type === "joint_shared"
                ? "Joint / Shared"
                : item.type === "job_specific"
                ? "Job / Specific"
                : item.type || "N/A"}
            </Badge>
          </div>
        ),
      },
      {
        value: "status",
        title: "Status",
        custom: true,
        className: "text-center",
        component: (item) => (
          <div className="flex justify-center">
            {/* {} */}
            <Badge color={getStatusColor(item.status)}>
              {item.status
                ? item.status.charAt(0).toUpperCase() + item.status.slice(1)
                : "-"}
            </Badge>
          </div>
        ),
      },
      {
        value: "good_qty",
        title: "Good Qty",
        custom: true,
        className: "text-center",
        component: (item) => (
          <div className="text-sm text-center">
            {getRunMetrics(item).goodQty.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 4,
            })}
          </div>
        ),
      },
      {
        value: "waste_qty",
        title: "Waste",
        custom: true,
        className: "text-center",
        component: (item) => (
          <div className="text-sm text-center">
            {getRunMetrics(item).wasteQty.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 4,
            })}
          </div>
        ),
      },
      {
        value: "yield_pct",
        title: "Yield",
        custom: true,
        className: "text-center",
        component: (item) => {
          const { yieldPct } = getRunMetrics(item);
          return (
            <div className="text-sm text-center">
              {yieldPct === null || Number.isNaN(yieldPct)
                ? "N/A"
                : `${yieldPct.toFixed(2)}%`}
            </div>
          );
        },
      },
      {
        value: "run_status",
        title: "Run Status",
        custom: true,
        className: "text-center",
        component: (item) => {
          const { runStatus } = getRunMetrics(item);
          const badgeColor =
            runStatus === "partial"
              ? "warning"
              : runStatus === "closed"
                ? "secondary"
                : "success";
          return (
            <div className="flex justify-center">
              <Badge color={badgeColor}>{runStatus}</Badge>
            </div>
          );
        },
      },
      {
        value: "action",
        title: "Action",
        custom: true,
        className: "text-center",
        component: (item) => {
          const { runStatus } = getRunMetrics(item);
          const isClosing = closingRunId === item.id;
          return (
            <div className="flex justify-center gap-2 flex-wrap">
              {runStatus === "partial" ? (
                <>
                  <UIButton
                    variant="outline"
                    size="sm"
                    disabled={isClosing}
                    onClick={() => closeManufacturingRun(item)}
                    className="text-slate-700 border-slate-300 hover:bg-slate-50"
                    title="Close incomplete run"
                  >
                    {isClosing ? "Closing…" : "Close"}
                  </UIButton>
                  <UIButton
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(
                        `/app/production/record-production/new?type=${
                          item.type || "job_specific"
                        }&resumeBatch=${item.id}`,
                      )
                    }
                    className="text-amber-700 border-amber-300 hover:bg-amber-50"
                    title="Resume run"
                  >
                    Resume
                  </UIButton>
                </>
              ) : null}
              <UIButton
                variant="ghost"
                size="sm"
                onClick={() => viewItemDetails(item)}
                className="text-[var(--aa-accent)] hover:text-[var(--aa-accent-hover)] hover:bg-blue-50"
                title="View Details"
              >
                <Eye className="h-4 w-4" />
              </UIButton>
            </div>
          );
        },
      },
    ];

    return (
      <CustomTable1
        data={filteredRecords}
        fields={fields}
        loading={loading}
        pageSize={itemsPerPage}
        initialPageIndex={currentPage - 1}
        onPageChange={(page) => setCurrentPage(page)}
        onPageSizeChange={(size) => {
          setItemsPerPage(size);
          setCurrentPage(1);
        }}
        message="No production records found"
      />
    );
  };

  const CardView = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const pageRecords = filteredRecords.slice(
      startIndex,
      startIndex + itemsPerPage
    );

    if (pageRecords.length === 0) {
      return (
        <div className="text-center py-5">
          <p className="text-muted">No production records found</p>
        </div>
      );
    }

    return (
      <Row>
        {pageRecords.map((record) => {
          const details = parseManufacturingData(record);
          const displayName =
            details?.productSummaries?.[0]?.productName ||
            details?.productSummaries?.[0]?.finishedGoods?.[0]?.productName ||
            record.id;

          return (
          <Col md={6} lg={4} xl={3} key={record.id} className="mb-4">
            <Card className="h-100 shadow-sm">
              <CardBody>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <CardTitle tag="h6" className="mb-0">
                    {displayName}
                  </CardTitle>
                  <Badge color={getStatusColor(record.status)}>
                    {record.status}
                  </Badge>
                </div>

                <div className="mb-2">
                  <small className="text-muted">Batch:</small>
                  <div className="fw-bold">{details?.batchNo || record.id}</div>
                </div>

                <div className="mb-2">
                  <small className="text-muted">Good Qty:</small>
                  <div className="fw-bold">
                    {fmtQty(details?.goodQty ?? 0)}
                  </div>
                </div>

                <div className="mb-2">
                  <small className="text-muted">Date:</small>
                  <div>{moment(record.created_at).format("YYYY-MM-DD")}</div>
                </div>

                <div className="mb-3">
                  <small className="text-muted">Notes:</small>
                  <div className="fw-bold">{record.notes}</div>
                </div>

                <div className="d-flex justify-content-center">
                  <CustomButton
                    size="sm"
                    color="info"
                    onClick={() => viewItemDetails(record)}
                  >
                    <Eye size={14} className="me-1" />
                    View Details
                  </CustomButton>
                </div>
              </CardBody>
            </Card>
          </Col>
          );
        })}
      </Row>
    );
  };

  const renderPagination = () => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredRecords.length / itemsPerPage)
    );
    if (totalPages <= 1) return null;

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }

    return (
      <Pagination className="justify-content-center mt-3 mb-0">
        <PaginationItem disabled={currentPage === 1}>
          <PaginationLink
            previous
            onClick={() => handlePageChange(currentPage - 1)}
          />
        </PaginationItem>

        {pages.map((page) => (
          <PaginationItem key={page} active={page === currentPage}>
            <PaginationLink onClick={() => handlePageChange(page)}>
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}

        <PaginationItem disabled={currentPage === totalPages}>
          <PaginationLink
            next
            onClick={() => handlePageChange(currentPage + 1)}
          />
        </PaginationItem>
      </Pagination>
    );
  };

  return (
    <Container fluid>

      <CustomCard
        header={
          <div className="d-flex justify-content-between align-items-center">
            <span>Manufacturing Production Records</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <UIButton
                  size="sm"
                  className="gap-1 bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white"
                >
                  <Plus size={12} />
                  Record Production
                  <ChevronDown size={12} />
                </UIButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() =>
                    navigate(
                      "/app/production/record-production/new?type=job_specific"
                    )
                  }
                >
                  Job / Specific Costing
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    navigate(
                      "/app/production/record-production/new?type=joint_shared"
                    )
                  }
                >
                  Joint / Shared Cost Allocation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      >
{/* {JSON.stringify(productionRecords)} */}
        <div className="mb-3">
          <Row className="align-items-end">
            <Col md={3}>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => handleDateChange("startDate", e.target.value)}
              />
            </Col>
            <Col md={3}>
              <Label>End Date</Label>
              <Input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => handleDateChange("endDate", e.target.value)}
              />
            </Col>
            <Col md={4}>
              <Label>Search</Label>
              <Input
                type="text"
                placeholder="Search by product name or batch..."
                value={searchTerm}
                onChange={handleSearch}
              />
            </Col>
            <Col md={2}>
              <div className="d-flex gap-2">
                <Button
                  size="sm"
                  color={viewMode === "list" ? "primary" : "secondary"}
                  onClick={() => setViewMode("list")}
                  title="List View"
                >
                  <List size={16} />
                </Button>
                <Button
                  size="sm"
                  color={viewMode === "card" ? "primary" : "secondary"}
                  onClick={() => setViewMode("card")}
                  title="Card View"
                >
                  <Grid3x3 size={16} />
                </Button>
              </div>
            </Col>
          </Row>
        </div>

        {loading && viewMode === "card" ? (
          <div className="d-flex justify-content-center my-5">
            <Loading />
          </div>
        ) : (
          <>
            {viewMode === "list" ? <ListView /> : <CardView />}
            {viewMode === "card" && renderPagination()}
          </>
        )}

        {!loading && productionRecords.length === 0 && !loading && (
          <div className="text-center py-5">
            <div className="mb-3">
              <i className="fa fa-box-open fa-3x text-muted"></i>
            </div>
            <h5>No Production Records Found</h5>
            <p className="text-muted">
              There are no production records matching your current filters.
            </p>
            <center>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <UIButton className="gap-1 bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white">
                    <Plus size={16} />
                    Record New Production
                    <ChevronDown size={16} />
                  </UIButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onSelect={() =>
                      navigate(
                        "/app/production/record-production/new?type=job_specific"
                      )
                    }
                  >
                    Job / Specific Costing
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      navigate(
                        "/app/production/record-production/new?type=joint_shared"
                      )
                    }
                  >
                    Joint / Shared Cost Allocation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </center>
          </div>
        )}


      </CustomCard>
         {/* Item Details Modal */}
         {modal && selectedItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col">
              <div
                className="text-white p-4"
                style={{
                  background: `linear-gradient(to right, ${primaryColor}, ${primaryColor}dd)`,
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold">Production Details</h3>
                    <p className="text-white/80 text-sm mt-1">
                      {parseManufacturingData(selectedItem)?.batchNo || "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleModal}
                    className="p-1.5 hover:bg-white/20 rounded transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
                {(() => {
                  const details = parseManufacturingData(selectedItem);
                  if (!details) return null;

                  const sectionTitle = (title) => (
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                      <div
                        className="w-1 h-5 rounded-full"
                        style={{ backgroundColor: primaryColor }}
                      />
                      <h5 className="mb-0 fw-bold text-gray-800">{title}</h5>
                    </div>
                  );

                  const tableHeadStyle = {
                    backgroundColor: `${primaryColor}12`,
                    color: primaryColor,
                  };

                  return (
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                        {sectionTitle("Batch Summary")}
                        <Row>
                          <Col md={3} className="mb-2">
                            <small className="text-muted d-block uppercase text-xs fw-semibold">
                              Batch Number
                            </small>
                            <strong>{details.batchNo}</strong>
                          </Col>
                          <Col md={3} className="mb-2">
                            <small className="text-muted d-block uppercase text-xs fw-semibold">
                              Costing Type
                            </small>
                            <Badge
                              color={
                                details.costingType === "joint_shared"
                                  ? "info"
                                  : "primary"
                              }
                            >
                              {details.costingLabel}
                            </Badge>
                          </Col>
                          <Col md={3} className="mb-2">
                            <small className="text-muted d-block uppercase text-xs fw-semibold">
                              Production Date
                            </small>
                            <strong>
                              {details.productionDate
                                ? moment(details.productionDate).format(
                                    "YYYY-MM-DD",
                                  )
                                : "N/A"}
                            </strong>
                          </Col>
                          <Col md={3} className="mb-2">
                            <small className="text-muted d-block uppercase text-xs fw-semibold">
                              Status
                            </small>
                            <Badge
                              color={getStatusColor(details.status)}
                              className="me-1"
                            >
                              {details.status}
                            </Badge>
                            <Badge
                              color={
                                details.runStatus === "partial"
                                  ? "warning"
                                  : details.runStatus === "closed"
                                    ? "secondary"
                                    : "success"
                              }
                            >
                              {details.runStatus}
                            </Badge>
                          </Col>
                        </Row>

                        <Row className="mt-2 g-3">
                          <Col md={4}>
                            <div
                              className="rounded-lg p-3 text-center border"
                              style={{
                                borderColor: `${primaryColor}30`,
                                backgroundColor: `${primaryColor}08`,
                              }}
                            >
                              <small className="text-muted d-block">
                                Qty Expected (Total)
                              </small>
                              <div
                                className="fs-5 fw-bold"
                                style={{ color: primaryColor }}
                              >
                                {fmtQty(details.expectedTotal)}
                              </div>
                            </div>
                          </Col>
                          <Col md={4}>
                            <div className="rounded-lg p-3 text-center border border-success-subtle bg-success-subtle">
                              <small className="text-muted d-block">
                                Qty Actual (Good)
                              </small>
                              <div className="fs-5 fw-bold text-success">
                                {fmtQty(details.goodQty)}
                              </div>
                            </div>
                          </Col>
                          <Col md={4}>
                            <div className="rounded-lg p-3 text-center border border-warning-subtle bg-warning-subtle">
                              <small className="text-muted d-block">Waste</small>
                              <div className="fs-5 fw-bold text-warning">
                                {fmtQty(details.wasteQty)}
                              </div>
                            </div>
                          </Col>
                        </Row>
                        {details.costingType === "joint_shared" &&
                        (details.output > 0 || details.qtyUse > 0) ? (
                          <Row className="mt-2">
                            <Col md={6}>
                              <small className="text-muted d-block uppercase text-xs">
                                Output / Scale Factor
                              </small>
                              <strong>{fmtQty(details.qtyUse || details.output)}</strong>
                            </Col>
                          </Row>
                        ) : null}
                        <div className="text-center mt-2">
                          <small className="text-muted">Yield: </small>
                          <strong>
                            {details.yieldPct != null
                              ? `${details.yieldPct.toFixed(2)}%`
                              : "N/A"}
                          </strong>
                        </div>
                      </div>

                      {details.sessionHistory.length > 0 ? (
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                          {sectionTitle("Session History")}
                          <Table responsive bordered size="sm" className="mb-0">
                            <thead style={tableHeadStyle}>
                              <tr>
                                <th>#</th>
                                <th className="text-end">Good Qty</th>
                                <th className="text-end">Waste Qty</th>
                                <th>Session Start</th>
                                <th>Session End</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {details.sessionHistory.map((s) => (
                                <tr key={s.index}>
                                  <td>{s.index}</td>
                                  <td className="text-end text-success fw-semibold">
                                    {fmtQty(s.goodQty)}
                                  </td>
                                  <td className="text-end">{fmtQty(s.wasteQty)}</td>
                                  <td>{fmtDateTime(s.startTime)}</td>
                                  <td>{fmtDateTime(s.endTime)}</td>
                                  <td>{s.notes || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      ) : null}

                      {details.productSummaries.map((product) => (
                        <div
                          key={product.index}
                          className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
                        >
                          <div
                            className="px-4 py-3 border-b"
                            style={{
                              background: `linear-gradient(to right, ${primaryColor}12, ${primaryColor}06)`,
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                                style={{ backgroundColor: primaryColor }}
                              >
                                {product.index}
                              </div>
                              <div>
                                <h5 className="mb-0 fw-bold">
                                  Finished Goods (Output) #{product.index}
                                </h5>
                                <p className="text-sm text-muted mb-0">
                                  {product.productName}
                                  {product.productSku
                                    ? ` (${product.productSku})`
                                    : ""}
                                  {product.engineName
                                    ? ` · Engine: ${product.engineName}`
                                    : ""}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-4 space-y-4">
                            {product.finishedGoods.map((fg, fgIdx) => (
                              <div
                                key={fgIdx}
                                className="rounded-xl border border-gray-200 p-3"
                              >
                                <Row className="g-2 mb-2">
                                  <Col md={4}>
                                    <small className="text-muted d-block text-xs uppercase">
                                      Product
                                    </small>
                                    <strong>{fg.productName}</strong>
                                    {fg.productSku ? (
                                      <div className="text-muted small">
                                        {fg.productSku}
                                      </div>
                                    ) : null}
                                  </Col>
                                  <Col md={2}>
                                    <small className="text-muted d-block text-xs uppercase">
                                      Unit
                                    </small>
                                    <strong>{fg.unitOfMeasure || "—"}</strong>
                                  </Col>
                                  <Col md={3}>
                                    <small className="text-muted d-block text-xs uppercase">
                                      Warehouse
                                    </small>
                                    <strong>{fg.branch || "—"}</strong>
                                  </Col>
                                  <Col md={3}>
                                    <small className="text-muted d-block text-xs uppercase">
                                      Operator
                                    </small>
                                    <strong>{fg.operator || "—"}</strong>
                                  </Col>
                                </Row>

                                <Row className="g-2 mb-2">
                                  <Col md={2}>
                                    <small className="text-muted d-block text-xs uppercase">
                                      Expected Qty
                                    </small>
                                    <div
                                      className="fw-bold fs-6"
                                      style={{ color: primaryColor }}
                                    >
                                      {fmtQty(fg.expectedQty)}
                                    </div>
                                  </Col>
                                  <Col md={2}>
                                    <small className="text-muted d-block text-xs uppercase">
                                      Good Qty
                                    </small>
                                    <div className="fw-bold fs-6 text-success">
                                      {fmtQty(fg.goodQty)}
                                    </div>
                                  </Col>
                                  <Col md={2}>
                                    <small className="text-muted d-block text-xs uppercase">
                                      Waste Qty
                                    </small>
                                    <div className="fw-bold fs-6 text-warning">
                                      {fmtQty(fg.wasteQty)}
                                    </div>
                                  </Col>
                                  <Col md={2}>
                                    <small className="text-muted d-block text-xs uppercase">
                                      Multiplier
                                    </small>
                                    <strong>{fmtQty(fg.multiplierValue)}</strong>
                                  </Col>
                                  <Col md={2}>
                                    <small className="text-muted d-block text-xs uppercase">
                                      Session Output
                                    </small>
                                    <strong>{fmtQty(fg.sessionOutput)}</strong>
                                  </Col>
                                  <Col md={2}>
                                    <small className="text-muted d-block text-xs uppercase">
                                      Cumulative
                                    </small>
                                    <strong>{fmtQty(fg.cumulativeOutput)}</strong>
                                  </Col>
                                </Row>

                                {(fg.wasteQty > 0 ||
                                  fg.sessionStartTime ||
                                  fg.sessionEndTime) && (
                                  <Row className="g-2 mb-2">
                                    {fg.wasteQty > 0 ? (
                                      <>
                                        <Col md={3}>
                                          <small className="text-muted d-block text-xs uppercase">
                                            Waste Type
                                          </small>
                                          <strong>{fg.wasteType || "—"}</strong>
                                        </Col>
                                        <Col md={3}>
                                          <small className="text-muted d-block text-xs uppercase">
                                            Waste Reason
                                          </small>
                                          <strong>{fg.wasteReason || "—"}</strong>
                                        </Col>
                                        {fg.scrapProducts?.length > 0 ? (
                                          <Col md={6}>
                                            <small className="text-muted d-block text-xs uppercase">
                                              Scrap / By-Product
                                            </small>
                                            <strong>
                                              {fg.scrapProducts.join(", ")}
                                            </strong>
                                          </Col>
                                        ) : null}
                                      </>
                                    ) : null}
                                    <Col md={3}>
                                      <small className="text-muted d-block text-xs uppercase">
                                        Session Start
                                      </small>
                                      <strong>
                                        {fmtDateTime(fg.sessionStartTime)}
                                      </strong>
                                    </Col>
                                    <Col md={3}>
                                      <small className="text-muted d-block text-xs uppercase">
                                        Session End
                                      </small>
                                      <strong>
                                        {fmtDateTime(fg.sessionEndTime)}
                                      </strong>
                                    </Col>
                                  </Row>
                                )}

                                <div
                                  className="rounded-md px-3 py-2 mt-2"
                                  style={{
                                    backgroundColor: `${primaryColor}10`,
                                    border: `1px solid ${primaryColor}25`,
                                  }}
                                >
                                  <div className="d-flex flex-wrap align-items-center gap-2">
                                    <span
                                      className="text-xs fw-semibold"
                                      style={{ color: primaryColor }}
                                    >
                                      Yield Summary
                                    </span>
                                    <Badge
                                      color={
                                        fg.yieldPct == null
                                          ? "secondary"
                                          : fg.yieldPct >= 95
                                            ? "success"
                                            : fg.yieldPct >= 80
                                              ? "warning"
                                              : "danger"
                                      }
                                    >
                                      Yield:{" "}
                                      {fg.yieldPct != null
                                        ? `${fg.yieldPct.toFixed(2)}%`
                                        : "N/A"}
                                    </Badge>
                                    <span className="text-xs text-muted">
                                      Session: {fmtQty(fg.sessionOutput)} ·
                                      Cumulative: {fmtQty(fg.cumulativeOutput)} /
                                      Expected {fmtQty(fg.expectedQty)}
                                    </span>
                                  </div>
                                  {fg.shortfallReason ? (
                                    <div className="mt-2 text-xs">
                                      <span className="text-danger fw-semibold">
                                        Shortfall Reason:{" "}
                                      </span>
                                      {fg.shortfallReason}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ))}

                            {product.rawMaterials.length > 0 ? (
                              <div className="rounded-lg border border-orange-200 overflow-hidden">
                                <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-2 border-b border-orange-200">
                                  <strong className="text-orange-800">
                                    Raw Materials (Product Specific)
                                  </strong>
                                  <span className="text-orange-600 small ms-2">
                                    {product.rawMaterials.length} item(s)
                                  </span>
                                </div>
                                <Table responsive bordered size="sm" className="mb-0">
                                  <thead className="bg-orange-50">
                                    <tr>
                                      <th>Ingredient</th>
                                      <th>SKU</th>
                                      <th className="text-end">Recipe Qty</th>
                                      <th className="text-end">Expected Qty</th>
                                      <th className="text-end">Actual Qty</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {product.rawMaterials.map((ing, i) => (
                                      <tr key={i}>
                                        <td>{ing.name}</td>
                                        <td>{ing.sku || "—"}</td>
                                        <td className="text-end">
                                          {fmtQty(ing.recipeQty)}
                                        </td>
                                        <td className="text-end fw-semibold">
                                          {fmtQty(ing.expectedQty)}
                                        </td>
                                        <td className="text-end fw-semibold text-success">
                                          {fmtQty(ing.actualQty)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </Table>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}

                      {details.sharedRawMaterials.length > 0 ? (
                        <div className="bg-white rounded-lg border border-green-200 shadow-sm overflow-hidden">
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 border-b border-green-200">
                            <strong className="text-green-800">
                              Shared Raw Materials
                            </strong>
                          </div>
                          <div className="p-3">
                            <Table responsive bordered size="sm" className="mb-0">
                              <thead className="bg-green-50">
                                <tr>
                                  <th>Material</th>
                                  <th>SKU</th>
                                  <th className="text-end">Recipe Qty</th>
                                  <th className="text-end">Expected Qty</th>
                                  <th className="text-end">Actual Qty Used</th>
                                </tr>
                              </thead>
                              <tbody>
                                {details.sharedRawMaterials.map((cost, idx) => (
                                  <tr key={idx}>
                                    <td>{cost.name}</td>
                                    <td>{cost.sku || "—"}</td>
                                    <td className="text-end">
                                      {fmtQty(cost.recipeQty)}
                                    </td>
                                    <td className="text-end fw-semibold">
                                      {fmtQty(cost.expectedQty)}
                                    </td>
                                    <td className="text-end fw-semibold text-success">
                                      {fmtQty(cost.actualQty)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>
                        </div>
                      ) : null}

                      {details.sharedJointWaste &&
                      (details.sharedJointWaste.wasteQuantity > 0 ||
                        details.sharedJointWaste.wasteType) ? (
                        <div className="bg-white rounded-lg border border-amber-200 shadow-sm p-4">
                          {sectionTitle("Shared Joint Waste")}
                          <Row>
                            <Col md={3}>
                              <small className="text-muted d-block">Waste Type</small>
                              <strong>
                                {details.sharedJointWaste.wasteType || "—"}
                              </strong>
                            </Col>
                            <Col md={3}>
                              <small className="text-muted d-block">Waste Qty</small>
                              <strong>
                                {fmtQty(details.sharedJointWaste.wasteQuantity)}
                              </strong>
                            </Col>
                            {details.sharedJointWaste.scrapProduct ? (
                              <Col md={6}>
                                <small className="text-muted d-block">
                                  Scrap / By-Product
                                </small>
                                <strong>
                                  {details.sharedJointWaste.scrapProduct
                                    .item_name ||
                                    details.sharedJointWaste.scrapProduct.name ||
                                    "—"}
                                </strong>
                              </Col>
                            ) : null}
                          </Row>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>

              <div className="border-t bg-white p-4 flex justify-end">
                <CustomButton
                  onClick={toggleModal}
                  style={{
                    backgroundColor: primaryColor,
                    borderColor: primaryColor,
                  }}
                >
                  <X size={14} className="me-1" />
                  Close
                </CustomButton>
              </div>
            </div>
          </div>
        )}
    </Container>
  );
}
