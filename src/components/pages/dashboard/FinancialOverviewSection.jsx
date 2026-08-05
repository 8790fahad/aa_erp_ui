import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  FileText,
} from "lucide-react";
import moment from "moment";
import { format } from "date-fns";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

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

function KpiCard({ title, value, change, changeLabel, invertChange = false }) {
  return (
    <div className={`${CARD_CLASS} p-4 sm:p-5`}>
      <p className="mb-2 text-xs font-medium text-gray-500">{title}</p>
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <p className="text-2xl font-bold text-gray-900 tracking-tight">
          ₦{formatCompact(value)}
        </p>
        <ChangeBadge value={change} label={changeLabel} invert={invertChange} />
      </div>
    </div>
  );
}

function StatusBar({ segments }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  return (
    <div className="h-2.5 rounded-full overflow-hidden flex bg-gray-100 gap-[1px]">
      {segments.map((segment, index) => (
        <div
          key={index}
          className={`${segment.color} first:rounded-l-full last:rounded-r-full`}
          style={{ width: `${(segment.value / total) * 100}%` }}
        />
      ))}
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

// Catmull-Rom -> Cubic Bezier smoothing for a soft, natural-looking curve
function smoothLinePath(points) {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function ProfitLossChart({ data }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const hasActivity = data?.some(
    (d) => (d.revenue ?? d.income ?? 0) > 0.001 || (d.expenses ?? 0) > 0.001,
  );

  if (!data?.length || !hasActivity) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-gray-400">
        No revenue or expense activity for this period
      </div>
    );
  }

  const maxValue = Math.max(
    ...data.flatMap((d) => [d.revenue ?? d.income ?? 0, d.expenses ?? 0]),
    1,
  );
  const width = Math.max(480, data.length * 72);
  const height = 224; // matches Tailwind h-56 (14rem) so % based overlays align pixel-perfect
  const padding = { top: 24, right: 20, bottom: 32, left: 56 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Keep single-month series visible (centered) instead of collapsing to x=0
  const xStep = data.length > 1 ? chartW / (data.length - 1) : 0;
  const xAt = (i) =>
    data.length > 1 ? padding.left + i * xStep : padding.left + chartW / 2;
  const yScale = (v) => padding.top + chartH - (v / maxValue) * chartH;

  const revenueCoords = data.map((d, i) => ({
    x: xAt(i),
    y: yScale(d.revenue ?? d.income ?? 0),
  }));
  const expenseCoords = data.map((d, i) => ({
    x: xAt(i),
    y: yScale(d.expenses ?? 0),
  }));

  const revenuePath = smoothLinePath(revenueCoords);
  const expensePath = smoothLinePath(expenseCoords);
  const firstX = xAt(0);
  const lastX = xAt(data.length - 1);
  const baseline = padding.top + chartH;
  const revenueAreaPath = `${revenuePath} L ${lastX},${baseline} L ${firstX},${baseline} Z`;

  // One invisible hover band per data point, split at midpoints between neighbors
  const bandWidths = data.map((_, i) => {
    if (data.length === 1) return 100;
    const x = xAt(i);
    const start = i === 0 ? padding.left : (xAt(i - 1) + x) / 2;
    const end =
      i === data.length - 1 ? width - padding.right : (x + xAt(i + 1)) / 2;
    return ((end - start) / width) * 100;
  });

  const activeIndex =
    hoverIndex !== null && hoverIndex < data.length ? hoverIndex : null;
  const active = activeIndex !== null ? data[activeIndex] : null;
  const activeXPercent =
    activeIndex !== null ? (xAt(activeIndex) / width) * 100 : 0;
  const activeRevYPercent =
    activeIndex !== null ? (revenueCoords[activeIndex].y / height) * 100 : 0;
  const activeExpYPercent =
    activeIndex !== null ? (expenseCoords[activeIndex].y / height) * 100 : 0;
  const tooltipAlign =
    activeXPercent < 18 ? "left" : activeXPercent > 82 ? "right" : "center";
  // Keep the tooltip inside the chart's own box (not translated above it) — the
  // horizontal scroll wrapper implicitly clips vertical overflow too, which was
  // cutting the tooltip off and leaving only its background sliver visible.
  const tooltipTransform =
    tooltipAlign === "left"
      ? "translateX(0)"
      : tooltipAlign === "right"
        ? "translateX(-100%)"
        : "translateX(-50%)";

  return (
    <div className="overflow-x-auto">
      <div className="relative min-w-[480px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full h-56 block"
        >
          <defs>
            <linearGradient id="plRevenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const y = padding.top + chartH * (1 - tick);
            const label = `₦${formatCompact(maxValue * tick)}`;
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#f1f5f4"
                  vectorEffect="non-scaling-stroke"
                />
                <text x={8} y={y + 4} className="fill-gray-400 text-[10px]">
                  {label}
                </text>
              </g>
            );
          })}
          {activeIndex !== null && (
            <line
              x1={xAt(activeIndex)}
              y1={padding.top}
              x2={xAt(activeIndex)}
              y2={baseline}
              stroke="#d1d5db"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path d={revenueAreaPath} fill="url(#plRevenueFill)" stroke="none" />
          <path
            d={expensePath}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="2"
            strokeDasharray="5 5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={revenuePath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {data.length === 1 && (
            <>
              <circle
                cx={revenueCoords[0].x}
                cy={revenueCoords[0].y}
                r="4"
                fill="#10b981"
              />
              <circle
                cx={expenseCoords[0].x}
                cy={expenseCoords[0].y}
                r="4"
                fill="#cbd5e1"
              />
            </>
          )}
          {data.map((d, i) => (
            <text
              key={d.monthKey || i}
              x={xAt(i)}
              y={height - 8}
              textAnchor="middle"
              className={`text-[11px] transition-colors ${
                i === activeIndex
                  ? "fill-gray-900 font-medium"
                  : "fill-gray-500"
              }`}
            >
              {d.month}
            </text>
          ))}
        </svg>

        {/* Hover bands: HTML overlay so pointer detection works regardless of SVG scaling */}
        <div
          className="absolute inset-0 flex"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {bandWidths.map((w, i) => (
            <div
              key={data[i].monthKey || i}
              className="h-full cursor-pointer"
              style={{ width: `${w}%` }}
              onMouseEnter={() => setHoverIndex(i)}
            />
          ))}
        </div>

        {active !== null && (
          <>
            <div
              className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm pointer-events-none"
              style={{
                left: `${activeXPercent}%`,
                top: `${activeRevYPercent}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
            <div
              className="absolute w-2.5 h-2.5 rounded-full bg-gray-400 border-2 border-white shadow-sm pointer-events-none"
              style={{
                left: `${activeXPercent}%`,
                top: `${activeExpYPercent}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
            <div
              className="absolute z-10 pointer-events-none bg-gray-900 text-white text-xs rounded-lg shadow-lg px-3 py-2 min-w-[130px] whitespace-nowrap"
              style={{
                left: `${activeXPercent}%`,
                top: "8px",
                transform: tooltipTransform,
              }}
            >
              <p className="font-semibold mb-1">{active.month}</p>
              <p className="flex items-center gap-1.5 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block flex-shrink-0" />
                Revenue: ₦{formatCompact(active.revenue ?? active.income)}
              </p>
              <p className="flex items-center gap-1.5 text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block flex-shrink-0" />
                Expenses: ₦{formatCompact(active.expenses)}
              </p>
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded-full bg-emerald-500 inline-block" />
          Revenue
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded-full bg-gray-300 inline-block" />
          Expenses
        </span>
      </div>
    </div>
  );
}

function TopRankingCard({
  title,
  data,
  unitField,
  unitSuffix,
  showCustomerId,
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
    <div className={`${CARD_CLASS} p-4 sm:p-5`}>
      <div className="flex items-center justify-between mb-2 gap-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5 text-xs font-medium flex-shrink-0">
          <button
            type="button"
            onClick={() => setMode("price")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              mode === "price"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            By Price
          </button>
          <button
            type="button"
            onClick={() => setMode("unit")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              mode === "unit"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            By Unit
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-xs text-gray-400 py-8 text-center">
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
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="inline-flex items-start gap-2.5 min-w-0">
                    <span className="text-xs font-semibold text-gray-400 w-4 flex-shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate block">
                        {item.name}
                      </span>
                      {item.sku && (
                        <span className="text-xs text-gray-400 truncate block">
                          SKU: {item.sku}
                        </span>
                      )}
                      {!item.sku &&
                        showCustomerId &&
                        item.id &&
                        item.id !== item.name && (
                          <span className="text-xs text-gray-400 truncate block">
                            ID: {item.id}
                          </span>
                        )}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                    {mode === "price"
                      ? `₦${formatCompact(item.revenue)}`
                      : `${value} ${unitSuffix}`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden ml-[26px]">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${widthPct}%` }}
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
  return (
    <div className={`${CARD_CLASS} p-4 sm:p-5`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
        <button
          type="button"
          onClick={() => navigate("/app/sales/invoices")}
          className="text-xs text-emerald-600 hover:text-emerald-700"
        >
          View all
        </button>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">No recent invoices</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[380px]">
            <thead>
              <tr className="text-gray-400 uppercase text-[10px] tracking-wide border-b border-gray-100">
                <th className="text-left font-medium py-1.5 pr-2">Activity</th>
                <th className="text-left font-medium py-1.5 pr-2">Date</th>
                <th className="text-right font-medium py-1.5">Amount</th>
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
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${iconWrapClass}`}
                        >
                          <Icon className="w-3 h-3" />
                        </div>
                        <span className="font-medium text-gray-900 truncate block">
                          {item.description}
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 pr-2 align-top text-gray-400 whitespace-nowrap">
                      {timeAgo(item.date)}
                    </td>
                    <td
                      className={`py-1.5 align-top text-right font-semibold whitespace-nowrap ${amountClass}`}
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
  const invoices = overview?.invoicesSummary || {};
  const bills = overview?.billsToPay || {};
  const accounts = overview?.bankAccounts || [];
  const activity = overview?.recentActivity || [];
  const production = overview?.recentProduction || [];
  const topProducts = overview?.topProducts || {};
  const topCustomers = overview?.topCustomers || {};

  if (loading && !overview) {
    return (
      <div className="mb-8 space-y-5 animate-pulse">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100" />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="mb-8 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Financial Overview
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            From chart of accounts &amp; general ledger
          </p>
        </div>
        <DateRangePicker period={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        <KpiCard
          title="Total Revenue"
          value={kpis.totalRevenue ?? kpis.totalIncome}
          change={kpis.revenueChange ?? kpis.incomeChange}
          changeLabel={kpis.revenueChangeLabel ?? kpis.incomeChangeLabel}
        />
        <KpiCard
          title="Total Expenses"
          value={kpis.totalExpenses}
          change={kpis.expenseChange}
          changeLabel={kpis.expenseChangeLabel}
          invertChange
        />
        <KpiCard
          title="Net Profit"
          value={kpis.netProfit}
          change={kpis.netProfitChange}
          changeLabel={kpis.netProfitChangeLabel}
        />
        <KpiCard
          title="Cash in Bank"
          value={kpis.cashInBank}
          change={kpis.cashChange}
          changeLabel={kpis.cashChangeLabel}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-5">
        <div className={`xl:col-span-2 ${CARD_CLASS} p-4 sm:p-5`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Profit &amp; Loss
            </h3>
            <button
              type="button"
              onClick={() => navigate("/app/reports/accounting-reports")}
              className="text-xs text-emerald-600 hover:text-emerald-700"
            >
              View report
            </button>
          </div>
          <ProfitLossChart data={trend} />
        </div>

        <div className="flex flex-col gap-4">
          <div className={`${CARD_CLASS} p-4 sm:p-5`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">
                {labels?.dashboardInvoices || "Invoices"}
              </h3>
              <button
                type="button"
                onClick={() => navigate("/app/sales/invoices")}
                className="text-xs text-emerald-600 hover:text-emerald-700"
              >
                View all
              </button>
            </div>
            <StatusBar
              segments={[
                {
                  value: invoices.notDueYet || 0,
                  color: "bg-emerald-500",
                },
                {
                  value: invoices.overdue || 0,
                  color: "bg-red-500",
                },
              ]}
            />
            <div className="space-y-1 mt-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  Not yet due
                </span>
                <span className="font-medium">
                  {formatCurrency(invoices.notDueYet)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                  Overdue
                </span>
                <span className="font-medium">
                  {formatCurrency(invoices.overdue)}
                </span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-sm">
              <span className="text-gray-500">Paid last 30 days</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(invoices.paidLast30Days)}
              </span>
            </div>
          </div>

          <div className={`${CARD_CLASS} p-4 sm:p-5`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Bills to Pay
              </h3>
              <button
                type="button"
                onClick={() => navigate("/app/purchase/bills")}
                className="text-xs text-emerald-600 hover:text-emerald-700"
              >
                View all
              </button>
            </div>
            <StatusBar
              segments={[
                { value: bills.notDueYet || 0, color: "bg-emerald-500" },
                { value: bills.overdue || 0, color: "bg-red-500" },
              ]}
            />
            <div className="space-y-1 mt-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  Unpaid
                </span>
                <span className="font-medium">
                  {formatCurrency(bills.unpaid)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                  Overdue
                </span>
                <span className="font-medium">
                  {formatCurrency(bills.overdue)}
                </span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-sm">
              <span className="text-gray-500">Paid last 30 days</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(bills.paidLast30Days)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <div className={`${CARD_CLASS} p-4 sm:p-5`}>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            Expense Breakdown
          </h3>
          <p className="text-xs text-gray-500 mb-4">Operating expenses</p>
          <div className="flex items-center gap-4">
            <DonutChart items={operating} total={operatingTotal} />
            <div className="space-y-2 flex-1 min-w-0">
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
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate text-gray-700">
                        {item.name}
                      </span>
                    </span>
                    <span className="font-medium text-gray-900 flex-shrink-0">
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
          <div className={`${CARD_CLASS} p-4 sm:p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Accounts</h3>
              <button
                type="button"
                onClick={() => navigate("/app/account/bank-accounts")}
                className="text-xs text-emerald-600 hover:text-emerald-700"
              >
                Manage
              </button>
            </div>
            <div className="space-y-3">
              {accounts.length === 0 ? (
                <p className="text-xs text-gray-400">No bank accounts found</p>
              ) : (
                accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {account.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {account.bankName || "Bank"}
                        {account.accountNumber
                          ? ` ···${String(account.accountNumber).slice(-4)}`
                          : ""}
                      </p>
                    </div>
                    <p
                      className={`text-sm font-semibold flex-shrink-0 ${
                        account.balance < 0 ? "text-red-500" : "text-gray-900"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopRankingCard
          title="Top 5 Selling Products & Services"
          data={topProducts}
          unitField="units"
          unitSuffix="units"
        />
        <TopRankingCard
          title="Top 5 Customers"
          data={topCustomers}
          unitField="orderCount"
          unitSuffix="invoices"
          showCustomerId
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
