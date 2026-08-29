import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  FileText,
  Wallet,
  HandCoins,
} from "lucide-react";
import moment from "moment";
import { format } from "date-fns";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import SpecialInvoiceTreatment from "@/components/sales/SpecialInvoiceTreatment";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/** Distinct series colors (Trend-style soft palette, one hue each) */
const CHART_GRID = "#f1f5f4";
const PL_COLORS = {
  revenue: "#10b981", // emerald green
  cogs: "#F2A93B", // gold
  grossProfit: "#2563eb", // royal blue
  operatingExpenses: "#CC4D3D", // terracotta red
  netProfit: "#7c3aed", // violet (clearly different from blue)
};

const PL_SERIES_ORDER = [
  "revenue",
  "cogs",
  "grossProfit",
  "operatingExpenses",
  "netProfit",
];

function plItemSorter(item) {
  const key = item?.dataKey || item?.value;
  const idx = PL_SERIES_ORDER.indexOf(key);
  return idx === -1 ? 99 : idx;
}

function PlChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload || {};
  const colorByKey = Object.fromEntries(
    payload.map((e) => [e.dataKey, e.color]),
  );
  const rows = [
    {
      key: "revenue",
      name: "Revenue",
      value: point.revenue,
      color: colorByKey.revenue || PL_COLORS.revenue,
    },
    {
      key: "cogs",
      name: "COGS",
      value: point.cogs,
      color: colorByKey.cogs || PL_COLORS.cogs,
    },
    {
      key: "grossProfit",
      name: "Gross Profit",
      value: point.grossProfit,
      color: colorByKey.grossProfit || PL_COLORS.grossProfit,
    },
    {
      key: "operatingExpenses",
      name: "Operating Expenses",
      value: point.operatingExpenses,
      color: colorByKey.operatingExpenses || PL_COLORS.operatingExpenses,
    },
    {
      key: "netProfit",
      name: "Net Profit",
      value: point.netProfit,
      color: colorByKey.netProfit || PL_COLORS.netProfit,
    },
  ];

  return (
    <div className="bg-gray-900 text-white text-xs rounded-lg shadow-lg px-3 py-2 min-w-[140px] whitespace-nowrap">
      <p className="font-semibold mb-1.5 text-white">{label}</p>
      {rows.map((row) => (
        <p
          key={row.key}
          className="flex items-center gap-1.5 text-gray-200 mb-0.5 last:mb-0"
        >
          <span
            className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
            style={{ backgroundColor: row.color }}
          />
          <span className="text-gray-300">{row.name}:</span>
          <span className="font-medium text-white">
            ₦{formatCompact(row.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

function formatCompact(amount) {
  const value = parseFloat(amount || 0);
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return formatNumber1(value);
}

function formatCurrency(amount) {
  return `₦${formatNumber1(Math.abs(amount || 0))}`;
}

function ChangeBadge({ value, label, invert = false }) {
  const hasNoComparison =
    value === null ||
    value === undefined ||
    label === "— vs prior period" ||
    Number.isNaN(Number(value));

  if (hasNoComparison) {
    return (
      <span className="text-xs font-medium text-gray-400">
        — vs prior period
      </span>
    );
  }

  const num = parseFloat(value || 0);
  const isPositive = invert ? num < 0 : num > 0;
  const isNegative = invert ? num > 0 : num < 0;
  const Icon = isPositive ? ArrowUpRight : isNegative ? ArrowDownRight : null;
  const color = isPositive
    ? "text-emerald-600"
    : isNegative
      ? "text-red-500"
      : "text-gray-400";

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label || (num === 0 ? "0%" : `${num > 0 ? "+" : ""}${num.toFixed(1)}%`)}
    </span>
  );
}

const CARD_CLASS =
  "bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200";

function KpiCard({
  title,
  value,
  change,
  changeLabel,
  invertChange = false,
  color = "#1a2d5e",
  onClick,
}) {
  const clickable = typeof onClick === "function";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`${CARD_CLASS} relative overflow-hidden p-4 sm:p-5 text-left w-full ${
        clickable
          ? "cursor-pointer hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          : "cursor-default"
      }`}
      style={{
        background: `linear-gradient(135deg, ${color}12 0%, #ffffff 55%)`,
        borderColor: `${color}33`,
        ...(clickable ? { ["--tw-ring-color"]: color } : {}),
      }}
    >
      <span
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ backgroundColor: color }}
      />
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide" style={{ color }}>
          {title}
        </p>
        {clickable && (
          <span className="text-[10px] font-medium text-gray-400">
            View report
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <p className="text-2xl font-bold tracking-tight" style={{ color }}>
          ₦{formatCompact(value)}
        </p>
        <ChangeBadge value={change} label={changeLabel} invert={invertChange} />
      </div>
    </button>
  );
}

const KPI_REPORT_META = {
  revenue: {
    title: "Revenue report",
    description: "Sales breakdown for the selected dashboard period",
    color: PL_COLORS.revenue,
    amountKey: "revenue",
    tabs: ["category", "product"],
  },
  cogs: {
    title: "COGS report",
    description: "Cost of goods sold by category and product",
    color: PL_COLORS.cogs,
    amountKey: "cogs",
    tabs: ["category", "product"],
  },
  grossProfit: {
    title: "Gross profit report",
    description: "Revenue − COGS by category and product",
    color: PL_COLORS.grossProfit,
    amountKey: "grossProfit",
    tabs: ["category", "product"],
  },
  operatingExpenses: {
    title: "Operating expenses report",
    description: "Operating expense breakdown for the selected period",
    color: PL_COLORS.operatingExpenses,
    amountKey: "amount",
    tabs: ["category"],
  },
  netProfit: {
    title: "Net profit overview",
    description: "Revenue − COGS − Operating expenses for the selected period",
    color: PL_COLORS.netProfit,
    amountKey: "netProfit",
    tabs: ["summary"],
  },
};

function ReportBreakdownRows({ rows, amountKey, accent }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.amount || 0)), 1);
  if (!rows.length) {
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        No activity in this period
      </p>
    );
  }
  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const amt = parseFloat(row.amount || 0);
        const width = Math.max((Math.abs(amt) / max) * 100, 3);
        return (
          <div key={row.id || row.name}>
            <div className="mb-1 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {row.name}
                </p>
                {row.sub ? (
                  <p className="truncate text-xs text-gray-400">{row.sub}</p>
                ) : null}
              </div>
              <div className="flex-shrink-0 text-right">
                <p
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: accent }}
                >
                  ₦{formatCompact(amt)}
                </p>
                {row.units != null ? (
                  <p className="text-[11px] text-gray-400 tabular-nums">
                    {formatNumber1(row.units)} units
                  </p>
                ) : null}
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-gray-100">
              <div
                className="h-full rounded"
                style={{ width: `${width}%`, backgroundColor: accent }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KpiReportSheet({
  open,
  onOpenChange,
  kpiKey,
  period,
  kpis,
  salesByCategory,
  topProducts,
  operating,
  navigate,
}) {
  const meta = KPI_REPORT_META[kpiKey] || KPI_REPORT_META.revenue;
  const [tab, setTab] = useState(meta.tabs[0]);

  useEffect(() => {
    setTab(meta.tabs[0]);
  }, [kpiKey, meta.tabs]);

  const periodLabel = `${moment(period.from).format("DD MMM YYYY")} – ${moment(
    period.to,
  ).format("DD MMM YYYY")}`;

  const products = topProducts?.all || topProducts?.byPrice || [];

  const categoryRows = useMemo(() => {
    if (kpiKey === "operatingExpenses") {
      return (operating || []).map((item) => ({
        name: item.name,
        amount: item.amount,
        units: null,
      }));
    }
    return (salesByCategory || []).map((item) => {
      const revenue = parseFloat(item.revenue || 0);
      const cogs = parseFloat(item.cogs || 0);
      let amount = revenue;
      if (kpiKey === "cogs") amount = cogs;
      if (kpiKey === "grossProfit") amount = revenue - cogs;
      return {
        name: item.name,
        amount,
        units: item.units,
      };
    });
  }, [kpiKey, salesByCategory, operating]);

  const productRows = useMemo(() => {
    return (products || []).map((item) => {
      const revenue = parseFloat(item.revenue || 0);
      const cogs = parseFloat(item.cogs || 0);
      let amount = revenue;
      if (kpiKey === "cogs") amount = cogs;
      if (kpiKey === "grossProfit") amount = revenue - cogs;
      return {
        id: item.id || item.sku || item.name,
        name: item.name,
        sub: [item.sku, item.category].filter(Boolean).join(" · "),
        amount,
        units: item.units,
      };
    });
  }, [kpiKey, products]);

  const totalValue =
    kpiKey === "revenue"
      ? kpis.totalRevenue ?? kpis.totalIncome
      : kpiKey === "cogs"
        ? kpis.cogs
        : kpiKey === "grossProfit"
          ? kpis.grossProfit
          : kpiKey === "operatingExpenses"
            ? kpis.operatingExpenses ?? kpis.totalExpenses
            : kpis.netProfit;

  const sortedCategory = [...categoryRows].sort(
    (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
  );
  const sortedProduct = [...productRows].sort(
    (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader className="text-left">
          <SheetTitle style={{ color: meta.color }}>{meta.title}</SheetTitle>
          <SheetDescription>
            {meta.description}
            <span className="mt-1 block text-xs text-gray-500">
              {periodLabel}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs text-gray-500">Period total</p>
          <p
            className="text-2xl font-bold tabular-nums"
            style={{ color: meta.color }}
          >
            ₦{formatCompact(totalValue)}
          </p>
        </div>

        {meta.tabs.includes("summary") ? (
          <div className="mt-5 space-y-3">
            {[
              {
                label: "Revenue",
                value: kpis.totalRevenue ?? kpis.totalIncome,
                color: PL_COLORS.revenue,
              },
              {
                label: "COGS",
                value: kpis.cogs,
                color: PL_COLORS.cogs,
              },
              {
                label: "Gross Profit",
                value: kpis.grossProfit,
                color: PL_COLORS.grossProfit,
              },
              {
                label: "Operating Expenses",
                value: kpis.operatingExpenses ?? kpis.totalExpenses,
                color: PL_COLORS.operatingExpenses,
              },
              {
                label: "Net Profit",
                value: kpis.netProfit,
                color: PL_COLORS.netProfit,
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
              >
                <span className="text-sm text-gray-700">{row.label}</span>
                <span
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: row.color }}
                >
                  ₦{formatCompact(row.value)}
                </span>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                navigate("/app/reports/accounting-reports/aa_erp-income-statement")
              }
              className="mt-2 w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Open full income statement
            </button>
          </div>
        ) : (
          <>
            {meta.tabs.length > 1 && (
              <div className="mt-4 inline-flex w-full items-center rounded-lg border border-gray-200 bg-white p-0.5 text-xs font-medium">
                {meta.tabs.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`flex-1 rounded-md px-3 py-2 transition-colors ${
                      tab === t ? "text-white shadow-sm" : "text-gray-500"
                    }`}
                    style={
                      tab === t ? { backgroundColor: meta.color } : undefined
                    }
                  >
                    {t === "category"
                      ? "By category"
                      : t === "product"
                        ? "By product"
                        : t}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4">
              <ReportBreakdownRows
                rows={
                  tab === "product" ||
                  (meta.tabs.length === 1 && meta.tabs[0] === "product")
                    ? sortedProduct
                    : sortedCategory
                }
                amountKey={meta.amountKey}
                accent={meta.color}
              />
            </div>

            {kpiKey === "revenue" && (
              <button
                type="button"
                onClick={() => navigate("/app/sales/sales-line-report")}
                className="mt-5 w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Open sales line report
              </button>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const RECV_AGING_COLORS = {
  current: "#9FE1CB",
  "1_30": "#5DCAA5",
  "31_60": "#1D9E75",
  "61_90": "#0F6E56",
  "90_plus": "#085041",
};

const PAY_AGING_COLORS = {
  current: "#F0997B",
  "1_30": "#E37F53",
  "31_60": "#D85A30",
  "61_90": "#993C1D",
  "90_plus": "#712B13",
};

const AGING_BUCKETS = [
  { key: "current", label: "Current" },
  { key: "1_30", label: "1–30" },
  { key: "31_60", label: "31–60" },
  { key: "61_90", label: "61–90" },
  { key: "90_plus", label: "90+" },
];

function AgingBarRows({ aging, colors }) {
  const amounts = AGING_BUCKETS.map((b) =>
    parseFloat(aging?.[b.key] || 0),
  );
  const max = Math.max(...amounts, 1);
  return (
    <div className="space-y-2">
      {AGING_BUCKETS.map((bucket, i) => {
        const amt = amounts[i];
        const width = Math.round((amt / max) * 100);
        return (
          <div key={bucket.key} className="flex items-center gap-2.5">
            <span className="w-11 flex-shrink-0 text-xs text-gray-500">
              {bucket.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded bg-gray-100">
              <div
                className="h-full rounded"
                style={{
                  width: `${width}%`,
                  backgroundColor: colors[bucket.key],
                }}
              />
            </div>
            <span className="w-16 flex-shrink-0 text-right text-xs tabular-nums text-gray-800">
              ₦{formatCompact(amt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ArApToggle({ value, onChange }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-gray-300 text-xs">
      <button
        type="button"
        onClick={() => onChange("total")}
        className={`px-3 py-1 transition-colors ${
          value === "total"
            ? "bg-white font-medium text-gray-900 shadow-sm"
            : "bg-transparent text-gray-500"
        }`}
      >
        Total
      </button>
      <button
        type="button"
        onClick={() => onChange("aging")}
        className={`border-l border-gray-300 px-3 py-1 transition-colors ${
          value === "aging"
            ? "bg-white font-medium text-gray-900 shadow-sm"
            : "bg-transparent text-gray-500"
        }`}
      >
        Aging
      </button>
    </div>
  );
}

function DonutChart({ items, total }) {
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const gap = items.length > 1 ? 2 : 0;
  let offset = 0;
  const safeTotal = total > 0 ? total : 1;

  return (
    <svg className="w-28 h-28 flex-shrink-0" viewBox="0 0 120 120">
      {items.length === 0 ? (
        <>
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="#eef2f0"
            strokeWidth="16"
          />
          <circle cx="60" cy="60" r="28" fill="white" />
        </>
      ) : (
        <>
          {items.map((item, index) => {
            const segmentLength = Math.max(
              (item.amount / safeTotal) * circumference - gap,
              0,
            );
            const currentOffset = offset;
            offset += segmentLength + gap;
            return (
              <circle
                key={index}
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke={item.color}
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${segmentLength} ${circumference}`}
                strokeDashoffset={-currentOffset}
                transform="rotate(-90 60 60)"
              />
            );
          })}
          <circle cx="60" cy="60" r="28" fill="white" />
        </>
      )}
    </svg>
  );
}

function TopRankingCard({
  title,
  data,
  unitField,
  unitSuffix,
  showCustomerId,
  accentColor = "#10b981",
}) {
  const [mode, setMode] = useState("unit");
  const list = (mode === "price" ? data?.byPrice : data?.byUnit) || [];
  const maxValue = Math.max(
    ...list.map((item) =>
      mode === "price" ? item.revenue : item[unitField] || 0,
    ),
    1,
  );

  return (
    <div
      className={`${CARD_CLASS} relative overflow-hidden p-4 sm:p-5`}
      style={{
        background: `linear-gradient(135deg, ${accentColor}12 0%, #ffffff 55%)`,
        borderColor: `${accentColor}33`,
      }}
    >
      <span
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ backgroundColor: accentColor }}
      />
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold" style={{ color: accentColor }}>
          {title}
        </h3>
        <div className="inline-flex flex-shrink-0 items-center rounded-lg border border-gray-200 bg-white/80 p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode("price")}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              mode === "price" ? "text-white shadow-sm" : "text-gray-500"
            }`}
            style={
              mode === "price" ? { backgroundColor: accentColor } : undefined
            }
          >
            By Price
          </button>
          <button
            type="button"
            onClick={() => setMode("unit")}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              mode === "unit" ? "text-white shadow-sm" : "text-gray-500"
            }`}
            style={
              mode === "unit" ? { backgroundColor: accentColor } : undefined
            }
          >
            By Unit
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="py-8 text-center text-xs text-gray-400">
          No sales activity in this period
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((item, index) => {
            const value =
              mode === "price" ? item.revenue : item[unitField] || 0;
            const widthPct = Math.max((value / maxValue) * 100, 4);
            return (
              <div key={item.id ?? index}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="inline-flex min-w-0 items-start gap-2.5">
                    <span
                      className="mt-0.5 w-4 flex-shrink-0 text-xs font-semibold"
                      style={{ color: accentColor }}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">
                        {item.name}
                      </span>
                      {item.sku && (
                        <span className="block truncate text-xs text-gray-400">
                          SKU: {item.sku}
                        </span>
                      )}
                      {!item.sku &&
                        showCustomerId &&
                        item.id &&
                        item.id !== item.name && (
                          <span className="block truncate text-xs text-gray-400">
                            ID: {item.id}
                          </span>
                        )}
                    </span>
                  </span>
                  <span
                    className="flex-shrink-0 text-sm font-semibold tabular-nums"
                    style={{ color: accentColor }}
                  >
                    {mode === "price"
                      ? `₦${formatCompact(item.revenue)}`
                      : `${value} ${unitSuffix}`}
                  </span>
                </div>
                <div className="ml-[26px] h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: accentColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VarianceValue({ value }) {
  const num = parseFloat(value || 0);
  const color =
    num > 0 ? "text-emerald-600" : num < 0 ? "text-red-500" : "text-gray-500";
  return (
    <span className={`font-semibold ${color}`}>
      {num > 0 ? "+" : ""}
      {num.toFixed(2)}%
    </span>
  );
}

function RecentProductionCard({ data, navigate }) {
  return (
    <div className={`${CARD_CLASS} p-4 sm:p-5`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">
          Recent Production
        </h3>
        <button
          type="button"
          onClick={() =>
            navigate("/app/reports/production-reports/daily-batch-log")
          }
          className="text-xs text-emerald-600 hover:text-emerald-700"
        >
          View all
        </button>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">
          No recent production batches
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[460px]">
            <thead>
              <tr className="text-gray-400 uppercase text-[10px] tracking-wide border-b border-gray-100">
                <th className="text-left font-medium py-1.5 pr-2">
                  Date / Batch
                </th>
                <th className="text-left font-medium py-1.5 pr-2">
                  Raw Material
                </th>
                <th className="text-right font-medium py-1.5 pr-2">Qty</th>
                <th className="text-right font-medium py-1.5 pr-2">Actual %</th>
                <th className="text-right font-medium py-1.5 pr-2">
                  Expected %
                </th>
                <th className="text-right font-medium py-1.5">Variance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((item) => (
                <tr key={item.id}>
                  <td className="py-1.5 pr-2 align-top">
                    <p className="font-medium text-gray-900 whitespace-nowrap">
                      {item.batchNo}
                    </p>
                    <p className="text-gray-400">
                      {moment(item.date).format("DD/MM/YYYY")}
                    </p>
                  </td>
                  <td className="py-1.5 pr-2 align-top text-gray-700">
                    {item.rawMaterialName}
                  </td>
                  <td className="py-1.5 pr-2 align-top text-right text-gray-900 font-medium whitespace-nowrap">
                    {formatCompact(item.rawMaterialQty)} {item.rawMaterialUnit}
                  </td>
                  <td className="py-1.5 pr-2 align-top text-right font-medium text-gray-900">
                    {parseFloat(item.actualYieldPct || 0).toFixed(1)}%
                  </td>
                  <td className="py-1.5 pr-2 align-top text-right text-gray-500">
                    {parseFloat(item.expectedYieldPct || 0).toFixed(1)}%
                  </td>
                  <td className="py-1.5 align-top text-right">
                    <VarianceValue value={item.variancePct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecentActivityCard({ data, navigate }) {
  const accent = "#10b981";
  return (
    <div
      className={`${CARD_CLASS} relative overflow-hidden p-4 sm:p-5`}
      style={{
        background: `linear-gradient(135deg, ${accent}12 0%, #ffffff 55%)`,
        borderColor: `${accent}33`,
      }}
    >
      <span
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ backgroundColor: accent }}
      />
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: accent }}>
          Recent Activity
        </h3>
        <button
          type="button"
          onClick={() => navigate("/app/sales/invoices")}
          className="text-xs font-medium hover:underline"
          style={{ color: accent }}
        >
          View all
        </button>
      </div>
      {data.length === 0 ? (
        <p className="py-2 text-sm text-gray-400">No recent invoices</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[380px] text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] uppercase tracking-wide text-gray-400">
                <th className="py-1.5 pr-2 text-left font-medium">Activity</th>
                <th className="py-1.5 pr-2 text-left font-medium">Date</th>
                <th className="py-1.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((item) => {
                const category =
                  item.category || (item.isInflow ? "inflow" : "outflow");
                const isNeutral = category === "neutral";
                const isInflow = category === "inflow";
                const amountClass = isInflow
                  ? "text-emerald-600"
                  : isNeutral
                    ? "text-gray-900"
                    : "text-red-500";
                const iconWrapClass = isInflow
                  ? "bg-emerald-50 text-emerald-600"
                  : isNeutral
                    ? "bg-gray-100 text-gray-500"
                    : "bg-red-50 text-red-500";
                const Icon = isInflow
                  ? ArrowDownLeft
                  : isNeutral
                    ? FileText
                    : ArrowUpRight;
                const isPositive = parseFloat(item.amount || 0) >= 0;

                return (
                  <tr key={item.id}>
                    <td className="py-1.5 pr-2 align-top">
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${iconWrapClass}`}
                        >
                          <Icon className="h-3 w-3" />
                        </div>
                        <span className="block truncate font-medium text-gray-900">
                          {item.description}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-2 align-top text-gray-400">
                      {timeAgo(item.date)}
                    </td>
                    <td
                      className={`whitespace-nowrap py-1.5 text-right align-top font-semibold ${amountClass}`}
                    >
                      {isPositive ? "+" : "-"}
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const d = moment(dateStr);
  const diffHours = moment().diff(d, "hours");
  if (diffHours < 24) return `${Math.max(diffHours, 1)}h ago`;
  if (diffHours < 48) return "Yesterday";
  return d.format("MMM D");
}

const DATE_PRESETS = [
  {
    label: "Today",
    getRange: () => ({ from: new Date(), to: new Date() }),
  },
  {
    label: "Yesterday",
    getRange: () => {
      const d = moment().subtract(1, "day").toDate();
      return { from: d, to: d };
    },
  },
  {
    label: "Last 7 days",
    getRange: () => ({
      from: moment().subtract(6, "days").toDate(),
      to: new Date(),
    }),
  },
  {
    label: "Last 30 days",
    getRange: () => ({
      from: moment().subtract(29, "days").toDate(),
      to: new Date(),
    }),
  },
  {
    label: "This month",
    getRange: () => ({
      from: moment().startOf("month").toDate(),
      to: new Date(),
    }),
  },
  {
    label: "Last month",
    getRange: () => ({
      from: moment().subtract(1, "month").startOf("month").toDate(),
      to: moment().subtract(1, "month").endOf("month").toDate(),
    }),
  },
  {
    label: "This quarter",
    getRange: () => ({
      from: moment().startOf("quarter").toDate(),
      to: new Date(),
    }),
  },
  {
    label: "This year",
    getRange: () => ({
      from: moment().startOf("year").toDate(),
      to: new Date(),
    }),
  },
  {
    label: "Last year",
    getRange: () => ({
      from: moment().subtract(1, "year").startOf("year").toDate(),
      to: moment().subtract(1, "year").endOf("year").toDate(),
    }),
  },
];

function isSameRange(a, b) {
  if (!a?.from || !a?.to || !b?.from || !b?.to) return false;
  return (
    moment(a.from).isSame(b.from, "day") && moment(a.to).isSame(b.to, "day")
  );
}

function DateRangePicker({ period, onChange }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(period);

  useEffect(() => {
    if (open) setDraft(period);
  }, [open, period]);

  const periodLabel =
    period.from && period.to
      ? `${format(period.from, "MMM d")} – ${format(period.to, "MMM d, yyyy")}`
      : "Select period";

  const handleApply = () => {
    if (!draft.from || !draft.to) return;
    const range =
      draft.from <= draft.to ? draft : { from: draft.to, to: draft.from };
    onChange(range);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
        >
          {periodLabel}
          <ChevronDown className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex flex-col sm:flex-row">
          <div className="flex sm:flex-col gap-1 p-2 sm:w-36 flex-shrink-0 overflow-x-auto sm:overflow-visible border-b sm:border-b-0 sm:border-r border-gray-100">
            {DATE_PRESETS.map((preset) => {
              const isActive = isSameRange(draft, preset.getRange());
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setDraft(preset.getRange())}
                  className={`text-left text-sm px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div>
            <Calendar
              mode="range"
              selected={draft}
              defaultMonth={draft.from}
              onSelect={(selected) => {
                if (selected) setDraft(selected);
              }}
              numberOfMonths={2}
            />
            <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-1 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                {draft.from ? format(draft.from, "MMM d, yyyy") : "Start date"}
                {" – "}
                {draft.to ? format(draft.to, "MMM d, yyyy") : "End date"}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!draft.from || !draft.to}
                  className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function FinancialOverviewSection({
  facilityId,
  labels,
  bankAccountsSlot,
  hasProduction = false,
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [period, setPeriod] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - 5);
    from.setDate(1);
    return { from, to };
  });
  const [recvView, setRecvView] = useState("total"); // total | aging
  const [payView, setPayView] = useState("total"); // total | aging
  const [billsMode, setBillsMode] = useState("purchases"); // purchases | expenses
  const [plChartMode, setPlChartMode] = useState("bar"); // bar | line
  const [kpiReport, setKpiReport] = useState(null); // revenue | cogs | ...

  const formatDateForAPI = (date) => moment(date).format("DD-MM-YYYY");

  const fetchOverview = useCallback(() => {
    if (!facilityId) return;
    setLoading(true);
    const from = formatDateForAPI(period.from);
    const to = formatDateForAPI(period.to);

    _fetchApi(
      `/api/dashboard/financial-overview?facilityId=${facilityId}&from=${from}&to=${to}`,
      (response) => {
        if (response?.success && response.results) {
          setOverview(response.results);
        } else {
          setOverview(null);
        }
        setLoading(false);
      },
      () => {
        setOverview(null);
        setLoading(false);
      },
    );
  }, [facilityId, period.from, period.to]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const kpis = overview?.kpis || {};
  const trend = overview?.profitLossTrend || [];
  const operating = overview?.operatingExpenseBreakdown || [];
  const operatingTotal = overview?.operatingExpensesTotal || 0;
  const accounts = overview?.bankAccounts || [];
  const activity = overview?.recentActivity || [];
  const production = overview?.recentProduction || [];
  const topProducts = overview?.topProducts || {};
  const topCustomers = overview?.topCustomers || {};
  const salesByCategory = overview?.salesByCategory || [];
  const arAp = overview?.receivablesPayables || {};
  const outstanding = overview?.outstandingBills || {};
  const advanceDeposit = overview?.advanceDepositBalances || {};
  const customerDeposits = advanceDeposit.customerDeposits || {
    total: 0,
    count: 0,
    parties: [],
  };
  const supplierAdvances = advanceDeposit.supplierAdvances || {
    total: 0,
    count: 0,
    parties: [],
  };
  const bankBalance =
    kpis.cashInBank ??
    accounts.reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);

  if (loading && !overview) {
    return (
      <div className="mb-8 space-y-5 animate-pulse">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:gap-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100" />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-gray-100" />
      </div>
    );
  }

  const outstandingList =
    billsMode === "purchases"
      ? outstanding.purchases || []
      : outstanding.expenses || [];
  const outstandingTotal =
    billsMode === "purchases"
      ? outstanding.purchasesTotal || 0
      : outstanding.expensesTotal || 0;

  return (
    <div className="mb-8 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Revenue − COGS = Gross Profit · Gross Profit − Operating Expenses =
            Net Profit
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SpecialInvoiceTreatment
            fromDate={moment(period.from).format("YYYY-MM-DD")}
            toDate={moment(period.to).format("YYYY-MM-DD")}
            buttonSize="sm"
            className="h-9 text-sm border-gray-200"
          />
          <DateRangePicker period={period} onChange={setPeriod} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <KpiCard
          title="Revenue"
          value={kpis.totalRevenue ?? kpis.totalIncome}
          change={kpis.revenueChange ?? kpis.incomeChange}
          changeLabel={kpis.revenueChangeLabel ?? kpis.incomeChangeLabel}
          color={PL_COLORS.revenue}
          onClick={() => setKpiReport("revenue")}
        />
        <KpiCard
          title="COGS"
          value={kpis.cogs}
          change={kpis.cogsChange}
          changeLabel={kpis.cogsChangeLabel}
          invertChange
          color={PL_COLORS.cogs}
          onClick={() => setKpiReport("cogs")}
        />
        <KpiCard
          title="Gross Profit"
          value={kpis.grossProfit}
          change={kpis.grossProfitChange}
          changeLabel={kpis.grossProfitChangeLabel}
          color={PL_COLORS.grossProfit}
          onClick={() => setKpiReport("grossProfit")}
        />
        <KpiCard
          title="Operating Expenses"
          value={kpis.operatingExpenses ?? kpis.totalExpenses}
          change={kpis.operatingExpensesChange ?? kpis.expenseChange}
          changeLabel={
            kpis.operatingExpensesChangeLabel ?? kpis.expenseChangeLabel
          }
          invertChange
          color={PL_COLORS.operatingExpenses}
          onClick={() => setKpiReport("operatingExpenses")}
        />
        <KpiCard
          title="Net Profit"
          value={kpis.netProfit}
          change={kpis.netProfitChange}
          changeLabel={kpis.netProfitChangeLabel}
          color={PL_COLORS.netProfit}
          onClick={() => setKpiReport("netProfit")}
        />
      </div>

      <KpiReportSheet
        open={!!kpiReport}
        onOpenChange={(open) => {
          if (!open) setKpiReport(null);
        }}
        kpiKey={kpiReport || "revenue"}
        period={period}
        kpis={kpis}
        salesByCategory={salesByCategory}
        topProducts={topProducts}
        operating={operating}
        navigate={navigate}
      />

      <div className={`${CARD_CLASS} p-4 sm:p-5`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Profit &amp; Loss
          </h3>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setPlChartMode("bar")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  plChartMode === "bar"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                Bar
              </button>
              <button
                type="button"
                onClick={() => setPlChartMode("line")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  plChartMode === "line"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                Line
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                navigate(
                  "/app/reports/accounting-reports/aa_erp-income-statement",
                )
              }
              className="text-xs text-[var(--aa-navy,#1a2d5e)] hover:underline"
            >
              View P&amp;L
            </button>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            {plChartMode === "bar" ? (
              <BarChart
                data={trend}
                margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
                barCategoryGap="18%"
                barGap={2}
              >
                <CartesianGrid
                  strokeDasharray="0"
                  stroke={CHART_GRID}
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={{ stroke: "#111827", strokeWidth: 1 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickFormatter={(v) => formatCompact(v)}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<PlChartTooltip />}
                  cursor={{ fill: "rgba(15, 23, 42, 0.04)" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  fill={PL_COLORS.revenue}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
                <Bar
                  dataKey="cogs"
                  name="COGS"
                  fill={PL_COLORS.cogs}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
                <Bar
                  dataKey="grossProfit"
                  name="Gross Profit"
                  fill={PL_COLORS.grossProfit}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
                <Bar
                  dataKey="operatingExpenses"
                  name="Operating Expenses"
                  fill={PL_COLORS.operatingExpenses}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
                <Bar
                  dataKey="netProfit"
                  name="Net Profit"
                  fill={PL_COLORS.netProfit}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            ) : (
              <ComposedChart
                data={trend}
                margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient
                    id="plLineRevenueFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="0"
                  stroke={CHART_GRID}
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickFormatter={(v) => formatCompact(v)}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<PlChartTooltip />}
                  cursor={{
                    stroke: "#d1d5db",
                    strokeWidth: 1.5,
                    strokeDasharray: "4 4",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke={PL_COLORS.revenue}
                  strokeWidth={2.75}
                  fill="url(#plLineRevenueFill)"
                  activeDot={{
                    r: 5,
                    fill: PL_COLORS.revenue,
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cogs"
                  name="COGS"
                  stroke={PL_COLORS.cogs}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: PL_COLORS.cogs,
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="grossProfit"
                  name="Gross Profit"
                  stroke={PL_COLORS.grossProfit}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: PL_COLORS.grossProfit,
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="operatingExpenses"
                  name="Operating Expenses"
                  stroke={PL_COLORS.operatingExpenses}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: PL_COLORS.operatingExpenses,
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="netProfit"
                  name="Net Profit"
                  stroke={PL_COLORS.netProfit}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: PL_COLORS.netProfit,
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5">
        {/* Total Receivable */}
        <div
          className={`${CARD_CLASS} relative overflow-hidden p-5`}
          style={{
            background: `linear-gradient(135deg, ${PL_COLORS.revenue}14 0%, #ffffff 55%)`,
            borderColor: `${PL_COLORS.revenue}40`,
          }}
        >
          <span
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
            style={{ backgroundColor: PL_COLORS.revenue }}
          />
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ArrowDownLeft
                className="h-[18px] w-[18px]"
                style={{ color: PL_COLORS.revenue }}
              />
              <span
                className="text-[13px] font-semibold"
                style={{ color: PL_COLORS.revenue }}
              >
                Total receivable
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  navigate("/app/reports/accounting-reports/receivable-aging")
                }
                className="text-xs font-medium hover:underline"
                style={{ color: PL_COLORS.revenue }}
              >
                View report
              </button>
              <ArApToggle value={recvView} onChange={setRecvView} />
            </div>
          </div>
          {recvView === "total" ? (
            <button
              type="button"
              onClick={() =>
                navigate("/app/reports/accounting-reports/receivable-aging")
              }
              className="w-full text-left"
            >
              <div
                className="text-[30px] font-semibold tabular-nums tracking-tight"
                style={{ color: PL_COLORS.revenue }}
              >
                ₦{formatCompact(arAp.totalReceivable)}
              </div>
              <p className="mt-1 text-[13px] text-gray-600">
                {arAp.receivableOpenCount || 0} open invoices
                {arAp.totalReceivable > 0
                  ? ` · `
                  : ""}
                {arAp.totalReceivable > 0 && (
                  <span className="font-medium text-amber-700">
                    ₦{formatCompact(arAp.receivableOverdue)} overdue (
                    {Math.round(
                      ((arAp.receivableOverdue || 0) /
                        (arAp.totalReceivable || 1)) *
                        100,
                    )}
                    %)
                  </span>
                )}
              </p>
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                navigate("/app/reports/accounting-reports/receivable-aging")
              }
              className="w-full text-left"
            >
              <AgingBarRows
                aging={arAp.receivableAging}
                colors={RECV_AGING_COLORS}
              />
            </button>
          )}
        </div>

        {/* Total Payable */}
        <div
          className={`${CARD_CLASS} relative overflow-hidden p-5`}
          style={{
            background: `linear-gradient(135deg, ${PL_COLORS.operatingExpenses}14 0%, #ffffff 55%)`,
            borderColor: `${PL_COLORS.operatingExpenses}40`,
          }}
        >
          <span
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
            style={{ backgroundColor: PL_COLORS.operatingExpenses }}
          />
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ArrowUpRight
                className="h-[18px] w-[18px]"
                style={{ color: PL_COLORS.operatingExpenses }}
              />
              <span
                className="text-[13px] font-semibold"
                style={{ color: PL_COLORS.operatingExpenses }}
              >
                Total payable
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  navigate("/app/reports/accounting-reports/payable-aging")
                }
                className="text-xs font-medium hover:underline"
                style={{ color: PL_COLORS.operatingExpenses }}
              >
                View report
              </button>
              <ArApToggle value={payView} onChange={setPayView} />
            </div>
          </div>
          {payView === "total" ? (
            <button
              type="button"
              onClick={() =>
                navigate("/app/reports/accounting-reports/payable-aging")
              }
              className="w-full text-left"
            >
              <div
                className="text-[30px] font-semibold tabular-nums tracking-tight"
                style={{ color: PL_COLORS.operatingExpenses }}
              >
                ₦{formatCompact(arAp.totalPayable)}
              </div>
              <p className="mt-1 text-[13px] text-gray-600">
                {arAp.payableOpenCount || 0} open bills
                {arAp.totalPayable > 0 ? ` · ` : ""}
                {arAp.totalPayable > 0 && (
                  <span className="font-medium text-amber-700">
                    ₦{formatCompact(arAp.payableOverdue)} overdue (
                    {Math.round(
                      ((arAp.payableOverdue || 0) / (arAp.totalPayable || 1)) *
                        100,
                    )}
                    %)
                  </span>
                )}
              </p>
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                navigate("/app/reports/accounting-reports/payable-aging")
              }
              className="w-full text-left"
            >
              <AgingBarRows
                aging={arAp.payableAging}
                colors={PAY_AGING_COLORS}
              />
            </button>
          )}
        </div>
      </div>

      {/* Advance & Deposit Balances — quick decision view */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5">
        <div
          className={`${CARD_CLASS} relative overflow-hidden p-5`}
          style={{
            background: `linear-gradient(135deg, ${PL_COLORS.grossProfit}14 0%, #ffffff 55%)`,
            borderColor: `${PL_COLORS.grossProfit}40`,
          }}
        >
          <span
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
            style={{ backgroundColor: PL_COLORS.grossProfit }}
          />
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet
                className="h-[18px] w-[18px]"
                style={{ color: PL_COLORS.grossProfit }}
              />
              <span
                className="text-[13px] font-semibold"
                style={{ color: PL_COLORS.grossProfit }}
              >
                Customer deposit balances
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate("/app/payments/verification-points")}
              className="text-xs font-medium hover:underline"
              style={{ color: PL_COLORS.grossProfit }}
            >
              Verification Points
            </button>
          </div>
          <div
            className="text-[30px] font-semibold tabular-nums tracking-tight"
            style={{ color: PL_COLORS.grossProfit }}
          >
            ₦{formatCompact(customerDeposits.total)}
          </div>
          <p className="mt-1 mb-3 text-[13px] text-gray-600">
            {customerDeposits.count || 0} customer
            {(customerDeposits.count || 0) === 1 ? "" : "s"} with prepaid
            deposits
          </p>
          {(customerDeposits.parties || []).length === 0 ? (
            <p className="py-2 text-xs text-gray-400">
              No customer deposit balances
            </p>
          ) : (
            <div className="max-h-44 space-y-2 overflow-y-auto">
              {customerDeposits.parties.slice(0, 6).map((party) => (
                <div
                  key={party.partyNo}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white/80 px-2.5 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {party.partyName}
                    </div>
                    <div className="truncate text-[11px] text-gray-500">
                      {party.partyNo}
                    </div>
                  </div>
                  <span
                    className="flex-shrink-0 text-sm font-semibold tabular-nums"
                    style={{ color: PL_COLORS.grossProfit }}
                  >
                    ₦{formatCompact(party.balance)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className={`${CARD_CLASS} relative overflow-hidden p-5`}
          style={{
            background: `linear-gradient(135deg, ${PL_COLORS.cogs}14 0%, #ffffff 55%)`,
            borderColor: `${PL_COLORS.cogs}40`,
          }}
        >
          <span
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
            style={{ backgroundColor: PL_COLORS.cogs }}
          />
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <HandCoins
                className="h-[18px] w-[18px]"
                style={{ color: PL_COLORS.cogs }}
              />
              <span
                className="text-[13px] font-semibold"
                style={{ color: PL_COLORS.cogs }}
              >
                Supplier advance balances
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate("/app/payments/apply-deposit")}
              className="text-xs font-medium hover:underline"
              style={{ color: PL_COLORS.cogs }}
            >
              Apply advance
            </button>
          </div>
          <div
            className="text-[30px] font-semibold tabular-nums tracking-tight"
            style={{ color: PL_COLORS.cogs }}
          >
            ₦{formatCompact(supplierAdvances.total)}
          </div>
          <p className="mt-1 mb-3 text-[13px] text-gray-600">
            {supplierAdvances.count || 0} supplier
            {(supplierAdvances.count || 0) === 1 ? "" : "s"} with prepaid
            advances
          </p>
          {(supplierAdvances.parties || []).length === 0 ? (
            <p className="py-2 text-xs text-gray-400">
              No supplier advance balances
            </p>
          ) : (
            <div className="max-h-44 space-y-2 overflow-y-auto">
              {supplierAdvances.parties.slice(0, 6).map((party) => (
                <div
                  key={party.partyNo}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white/80 px-2.5 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {party.partyName}
                    </div>
                    <div className="truncate text-[11px] text-gray-500">
                      {party.partyNo}
                    </div>
                  </div>
                  <span
                    className="flex-shrink-0 text-sm font-semibold tabular-nums"
                    style={{ color: PL_COLORS.cogs }}
                  >
                    ₦{formatCompact(party.balance)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className={`${CARD_CLASS} relative overflow-hidden p-4 sm:p-5`}
        style={{
          background: `linear-gradient(135deg, ${
            billsMode === "purchases"
              ? PL_COLORS.cogs
              : PL_COLORS.operatingExpenses
          }12 0%, #ffffff 50%)`,
          borderColor: `${
            billsMode === "purchases"
              ? PL_COLORS.cogs
              : PL_COLORS.operatingExpenses
          }33`,
        }}
      >
        <span
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
          style={{
            backgroundColor:
              billsMode === "purchases"
                ? PL_COLORS.cogs
                : PL_COLORS.operatingExpenses,
          }}
        />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3
            className="text-sm font-semibold"
            style={{
              color:
                billsMode === "purchases"
                  ? PL_COLORS.cogs
                  : PL_COLORS.operatingExpenses,
            }}
          >
            Outstanding Bills
          </h3>
          <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white/80 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setBillsMode("purchases")}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                billsMode === "purchases"
                  ? "text-white shadow-sm"
                  : "text-gray-500"
              }`}
              style={
                billsMode === "purchases"
                  ? { backgroundColor: PL_COLORS.cogs }
                  : undefined
              }
            >
              Purchases
            </button>
            <button
              type="button"
              onClick={() => setBillsMode("expenses")}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                billsMode === "expenses"
                  ? "text-white shadow-sm"
                  : "text-gray-500"
              }`}
              style={
                billsMode === "expenses"
                  ? { backgroundColor: PL_COLORS.operatingExpenses }
                  : undefined
              }
            >
              Expenses
            </button>
          </div>
        </div>
        <p className="mb-3 text-xs text-gray-600">
          Outstanding:{" "}
          <span
            className="text-base font-semibold tabular-nums"
            style={{
              color:
                billsMode === "purchases"
                  ? PL_COLORS.cogs
                  : PL_COLORS.operatingExpenses,
            }}
          >
            ₦{formatCompact(outstandingTotal)}
          </span>
        </p>
        {outstandingList.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">
            No outstanding {billsMode}
          </p>
        ) : (
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {outstandingList.slice(0, 8).map((item, idx) => {
              const accent =
                billsMode === "purchases"
                  ? PL_COLORS.cogs
                  : PL_COLORS.operatingExpenses;
              const isOverdue =
                item.dueDate && moment(item.dueDate).isBefore(moment(), "day");
              return (
                <div
                  key={`${item.ref}-${idx}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white/70 px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: accent }}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">
                        {item.party}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        {item.invoiceNo || item.ref}
                        {item.dueDate
                          ? ` · due ${moment(item.dueDate).format("DD/MM/YYYY")}`
                          : ""}
                        {isOverdue ? (
                          <span className="ml-1 font-medium text-red-600">
                            · overdue
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <span
                    className="flex-shrink-0 font-semibold tabular-nums"
                    style={{ color: accent }}
                  >
                    {formatCurrency(item.amountDue)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <div
          className={`${CARD_CLASS} relative overflow-hidden p-4 sm:p-5`}
          style={{
            background: `linear-gradient(135deg, ${PL_COLORS.operatingExpenses}12 0%, #ffffff 55%)`,
            borderColor: `${PL_COLORS.operatingExpenses}33`,
          }}
        >
          <span
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
            style={{ backgroundColor: PL_COLORS.operatingExpenses }}
          />
          <h3
            className="mb-1 text-sm font-semibold"
            style={{ color: PL_COLORS.operatingExpenses }}
          >
            Expense Breakdown
          </h3>
          <p className="mb-4 text-xs text-gray-500">Operating expenses</p>
          <div className="flex items-center gap-4">
            <DonutChart items={operating} total={operatingTotal} />
            <div className="min-w-0 flex-1 space-y-2">
              {operating.length === 0 ? (
                <p className="text-xs text-gray-400">
                  No operating expense activity in this period
                </p>
              ) : (
                operating.slice(0, 5).map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <span
                        className="h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate text-gray-700">{item.name}</span>
                    </span>
                    <span
                      className="flex-shrink-0 font-semibold tabular-nums"
                      style={{ color: item.color || PL_COLORS.operatingExpenses }}
                    >
                      ₦{formatCompact(item.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {bankAccountsSlot ? (
          bankAccountsSlot
        ) : (
          <div
            className={`${CARD_CLASS} relative overflow-hidden p-4 sm:p-5`}
            style={{
              background: "linear-gradient(135deg, #1a2d5e14 0%, #ffffff 55%)",
              borderColor: "#1a2d5e40",
            }}
          >
            <span className="absolute bottom-0 left-0 top-0 w-1 rounded-l-2xl bg-[var(--aa-navy,#1a2d5e)]" />
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--aa-navy,#1a2d5e)]">
                Accounts
              </h3>
              <button
                type="button"
                onClick={() => navigate("/app/account/bank-accounts")}
                className="text-xs font-medium text-[var(--aa-navy,#1a2d5e)] hover:underline"
              >
                Manage
              </button>
            </div>
            <p className="mb-3 text-xs text-gray-600">
              Total:{" "}
              <span className="text-base font-semibold tabular-nums text-[var(--aa-navy,#1a2d5e)]">
                ₦{formatCompact(bankBalance)}
              </span>
            </p>
            <div className="space-y-2">
              {accounts.length === 0 ? (
                <p className="text-xs text-gray-400">No bank accounts found</p>
              ) : (
                accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white/70 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {account.name}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {account.bankName || "Bank"}
                        {account.accountNumber
                          ? ` ···${String(account.accountNumber).slice(-4)}`
                          : ""}
                      </p>
                    </div>
                    <p
                      className={`flex-shrink-0 text-sm font-semibold tabular-nums ${
                        account.balance < 0
                          ? "text-red-500"
                          : "text-[var(--aa-navy,#1a2d5e)]"
                      }`}
                    >
                      {account.balance < 0 ? "-" : ""}
                      {formatCurrency(account.balance)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopRankingCard
          title="Top 5 Selling Products & Services"
          data={topProducts}
          unitField="units"
          unitSuffix="units"
          accentColor={PL_COLORS.revenue}
        />
        <TopRankingCard
          title="Top 5 Customers"
          data={topCustomers}
          unitField="orderCount"
          unitSuffix="invoices"
          showCustomerId
          accentColor={PL_COLORS.grossProfit}
        />
      </div>

      <div
        className={`grid grid-cols-1 gap-3 ${hasProduction ? "lg:grid-cols-2" : ""}`}
      >
        {hasProduction && (
          <RecentProductionCard data={production} navigate={navigate} />
        )}

        <RecentActivityCard data={activity} navigate={navigate} />
      </div>
    </div>
  );
}
