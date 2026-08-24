import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { _postApi } from "@/redux/actions/api";
import moment from "moment";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock,
  ChevronDown, ChevronRight, Loader2, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportHeaderBand } from "./productionReportUi";

const APP = "var(--aa-navy)";

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(v, dp = 2) {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function fmtMoney(v) {
  const n = parseFloat(v);
  if (!Number.isFinite(n) || n === 0) return "—";
  return `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(v, showSign = false) {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return "—";
  const s = `${Math.abs(n).toFixed(1)}%`;
  if (!showSign) return `${n.toFixed(1)}%`;
  return n >= 0 ? `+${s}` : `-${s}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────
const YIELD_CFG = {
  within_tolerance: { cls: "bg-green-100 text-green-800 border-green-200", Icon: CheckCircle2, label: "Within tolerance" },
  variance_flagged: { cls: "bg-red-100 text-red-800 border-red-200", Icon: AlertTriangle, label: "Variance flagged" },
  pending_review:   { cls: "bg-amber-100 text-amber-800 border-amber-200", Icon: Clock, label: "Pending review" },
};

function YieldBadge({ status }) {
  const cfg = YIELD_CFG[status] || YIELD_CFG.pending_review;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      <cfg.Icon size={12} />
      {cfg.label}
    </span>
  );
}

function MetricCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex flex-col gap-0.5 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-xl font-bold tabular-nums" style={{ color: accent || "#111" }}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div className="px-4 py-2 mt-4 rounded-t-sm" style={{ backgroundColor: APP }}>
      <h3 className="text-sm font-bold text-white uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function TableWrap({ children }) {
  return (
    <div className="bg-white border border-t-0 border-gray-200 overflow-x-auto">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  );
}

function Th({ children, right, w }) {
  return (
    <th className={`px-3 py-2 text-[11px] font-bold text-gray-600 uppercase tracking-wide border-r border-gray-100 ${right ? "text-right" : "text-left"} ${w || ""}`}>
      {children}
    </th>
  );
}
function Td({ children, right, bold, red, muted, cls = "" }) {
  return (
    <td className={`px-3 py-2 border-r border-gray-100 ${right ? "text-right tabular-nums" : ""} ${bold ? "font-bold" : ""} ${red ? "text-red-600 font-semibold" : muted ? "text-gray-400" : "text-gray-800"} ${cls}`}>
      {children}
    </td>
  );
}

// ── Cost breakdown panel (costing-page style) ───────────────────────────────
function TypeBadge({ type }) {
  if (type === "raw_material")
    return <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-orange-100 text-orange-700 whitespace-nowrap">Raw Mat.</span>;
  if (type === "by_product")
    return <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-purple-100 text-purple-700 whitespace-nowrap">By-Product</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-gray-100 text-gray-600">Other</span>;
}

function SubtotalRow({ label, amount, indent = false }) {
  return (
    <tr className="bg-orange-50/60 border-t border-orange-200">
      <td colSpan={4} className={`px-3 py-1.5 text-xs font-bold text-orange-800 ${indent ? "pl-8" : ""}`}>{label}</td>
      <td className="px-3 py-1.5 text-right text-xs font-bold tabular-nums text-orange-800">{fmtMoney(amount)}</td>
    </tr>
  );
}

function CostBreakdown({ item, isByProduct, hasShared, allocatedLines, allSharedLines, proportion }) {
  const rawLines   = item.rawMaterialLines  || [];
  const otherLines = item.otherCostLines    || [];

  // ── shared-pool allocation view ──────────────────────────────────────────
  if (hasShared && !isByProduct) {
    // Net = (sum of non-credit pool amounts − credit amounts) × this product's proportion
    const netTotal = item.totalCost; // already computed correctly in the API

    return (
      <div className="bg-slate-50 border-t border-gray-200 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
          Cost Breakdown — {item.name}
        </p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600">
              <th className="px-2 py-1.5 text-left font-semibold">Type</th>
              <th className="px-2 py-1.5 text-left font-semibold">Description</th>
              <th className="px-2 py-1.5 text-right font-semibold">Rate / Basis</th>
              <th className="px-2 py-1.5 text-right font-semibold">Qty</th>
              <th className="px-2 py-1.5 text-right font-semibold">Amount (₦)</th>
            </tr>
          </thead>
          <tbody>
            {/* Product's own raw material lines (from production template) */}
            {rawLines.map((l, i) => (
              <tr key={`rm-${i}`} className="border-t border-gray-100 bg-orange-50/30">
                <td className="px-2 py-1.5"><TypeBadge type="raw_material" /></td>
                <td className="px-2 py-1.5">
                  <p className="font-medium">{l.name || "—"}</p>
                  {l.sku && <p className="text-[10px] text-gray-400">{l.sku}</p>}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{l.rate > 0 ? fmtMoney(l.rate) : "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{l.qty > 0 ? fmt(l.qty) : "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium">{l.amount > 0 ? fmtMoney(l.amount) : "—"}</td>
              </tr>
            ))}
            {/* Product's own other cost lines */}
            {otherLines.map((l, i) => (
              <tr key={`oc-${i}`} className="border-t border-gray-100">
                <td className="px-2 py-1.5"><TypeBadge type="other" /></td>
                <td className="px-2 py-1.5 font-medium">{l.accountName || "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">
                  {l.basisType === "%" ? `${l.rate}%` : l.rate > 0 ? fmtMoney(l.rate) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{l.qty > 0 ? fmt(l.qty) : "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium">{l.amount > 0 ? fmtMoney(l.amount) : "—"}</td>
              </tr>
            ))}
            {/* Shared pool allocation — single summary line */}
            <tr className="border-t border-blue-200 bg-blue-50/40">
              <td className="px-2 py-1.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-blue-100 text-blue-700 whitespace-nowrap">Shared</span>
              </td>
              <td className="px-2 py-1.5 font-medium text-blue-800">
                Shared costs allocation ({(proportion * 100).toFixed(1)}% of pool)
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums text-gray-400">—</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-gray-400">—</td>
              <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-blue-800">{fmtMoney(netTotal)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-300">
              <td colSpan={4} className="px-2 py-2 text-xs font-bold text-gray-700">
                Total Production Cost
              </td>
              <td className="px-2 py-2 text-right text-sm font-bold tabular-nums" style={{ color: APP }}>
                {fmtMoney(netTotal + rawLines.reduce((s,l)=>s+l.amount,0) + otherLines.reduce((s,l)=>s+l.amount,0))}
              </td>
            </tr>
            <tr className="bg-gray-50 border-t border-gray-200">
              <td colSpan={4} className="px-2 py-1.5 text-xs text-gray-500">
                Total Production Cost per unit ({fmt(item.qtyProduced)} {item.unit})
              </td>
              <td className="px-2 py-1.5 text-right text-xs font-semibold tabular-nums text-gray-700">
                {item.qtyProduced > 0
                  ? fmtMoney((netTotal + rawLines.reduce((s,l)=>s+l.amount,0) + otherLines.reduce((s,l)=>s+l.amount,0)) / item.qtyProduced)
                  : "—"} / unit
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  // ── by-product / job-specific detail view ────────────────────────────────
  const allLines = [
    ...otherLines.map((l) => ({ ...l, type: "other" })),
    ...rawLines.map((l) => ({ ...l, type: "raw_material" })),
  ];
  const rawSubtotal   = rawLines.reduce((s, l) => s + l.amount, 0);
  const otherSubtotal = otherLines.reduce((s, l) => s + l.amount, 0);
  const unitCost      = item.byProductUnitCost || 0;
  const qty           = item.qtyProduced || 1;
  const totalCost     = item.totalCost || (unitCost * qty);

  return (
    <div className="bg-slate-50 border-t border-gray-200 px-4 py-3">
      {allLines.length > 0 && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Cost Breakdown</p>
          <table className="w-full text-xs border-collapse mb-2">
            <thead>
              <tr className="bg-gray-100 text-gray-600">
                <th className="px-2 py-1.5 text-left font-semibold">Type</th>
                <th className="px-2 py-1.5 text-left font-semibold">Product / Account</th>
                <th className="px-2 py-1.5 text-right font-semibold">Rate / Basis</th>
                <th className="px-2 py-1.5 text-right font-semibold">Qty</th>
                <th className="px-2 py-1.5 text-right font-semibold">Amount (₦)</th>
              </tr>
            </thead>
            <tbody>
              {allLines.map((l, i) => (
                <tr key={i} className={`border-t border-gray-100 ${l.type === "raw_material" ? "bg-orange-50/30" : ""}`}>
                  <td className="px-2 py-1.5"><TypeBadge type={l.type} /></td>
                  <td className="px-2 py-1.5 font-medium">{l.name || l.accountName || "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">
                    {l.basisType === "%" ? `${l.rate}%` : l.rate > 0 ? fmtMoney(l.rate) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.qty > 0 ? fmt(l.qty) : "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium">{l.amount > 0 ? fmtMoney(l.amount) : "—"}</td>
                </tr>
              ))}
            </tbody>
            {rawSubtotal > 0 && (
              <tfoot>
                <SubtotalRow label={`Subtotal Raw Materials for ${item.name}`} amount={rawSubtotal} />
              </tfoot>
            )}
          </table>
        </>
      )}

      {/* Unit cost + total summary (like costing page) */}
      <div className="border border-gray-200 rounded bg-white divide-y divide-gray-100 text-xs mt-1">
        {unitCost > 0 && (
          <div className="flex justify-between items-center px-3 py-1.5 text-[var(--aa-navy)] font-semibold">
            <span>+ Unit cost ({item.name}) × {fmt(qty)}</span>
            <span className="tabular-nums">{fmtMoney(unitCost * qty)}</span>
          </div>
        )}
        {rawLines.length > 0 && otherSubtotal > 0 && (
          <div className="flex justify-between items-center px-3 py-1.5 text-gray-600">
            <span>Other costs subtotal</span>
            <span className="tabular-nums">{fmtMoney(otherSubtotal)}</span>
          </div>
        )}
        <div className="flex justify-between items-center px-3 py-2 font-bold text-sm bg-gray-50">
          <span className="text-gray-700">Cost per unit (total)</span>
          <span className="tabular-nums" style={{ color: APP }}>{fmtMoney(qty > 0 ? totalCost / qty : 0)}</span>
        </div>
        <div className="flex justify-between items-center px-3 py-2 font-bold text-sm bg-gray-50">
          <span className="text-gray-700">Total cost (unit × {fmt(qty)})</span>
          <span className="tabular-nums" style={{ color: APP }}>{fmtMoney(totalCost)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Product row ─────────────────────────────────────────────────────────────
// proportion  = this product's output weight / total fg output weight (0–1)
// sharedLines = the shared cost pool lines from the parent batch
function ProductRow({ item, proportion, sharedLines }) {
  const isByProduct = item.type === "by_product";

  // Job-specific: has its own raw/other cost lines
  const hasJobLines = item.rawMaterialLines?.length > 0 || item.otherCostLines?.length > 0;
  // Joint/shared: can expand to show proportional allocation from pool
  const hasShared   = !isByProduct && proportion > 0 && sharedLines?.length > 0;
  const hasDetail   = hasJobLines || hasShared;

  const [open, setOpen] = useState(false);

  // kept for compatibility but CostBreakdown now receives allSharedLines directly
  const allocatedLines = hasShared
    ? (sharedLines || []).filter((l) => !l.isCredit).map((l) => ({ ...l, allocated: l.amount * proportion }))
    : [];

  return (
    <>
      <tr
        className={`border-b border-gray-100 ${hasDetail ? "cursor-pointer hover:bg-[var(--aa-navy)]/5" : ""} transition-colors ${isByProduct ? "bg-purple-50/40" : ""}`}
        onClick={() => hasDetail && setOpen((o) => !o)}
      >
        <Td>
          <div className="flex items-center gap-2">
            {hasDetail
              ? (open
                  ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
                  : <ChevronRight size={14} className="text-gray-400 shrink-0" />)
              : <span className="w-[14px] shrink-0" />}
            <div>
              <p className="font-semibold">{item.name}</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${isByProduct ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                {isByProduct ? "By-product" : "Finished good"}
              </span>
            </div>
          </div>
        </Td>
        <Td right>
          <span className="font-semibold">{item.qtyProduced > 0 ? fmt(item.qtyProduced) : "—"}</span>
          {item.unit && <span className="block text-[10px] text-gray-400">{item.unit}</span>}
        </Td>
        <Td right>
          {item.totalCost > 0 ? (
            <>
              <span className="font-semibold">{fmtMoney(item.totalCost)}</span>
              {item.costPerUnit > 0 && (
                <span className="block text-[10px] text-gray-400">{fmtMoney(item.costPerUnit)} / unit</span>
              )}
            </>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </Td>
      </tr>

      {open && hasDetail && (
        <tr className="border-b border-gray-200">
          <td colSpan={3} className="px-0 py-0">
            <CostBreakdown
              item={item}
              isByProduct={isByProduct}
              hasShared={hasShared}
              allocatedLines={allocatedLines}
              allSharedLines={sharedLines}
              proportion={proportion}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function BatchDetailReport() {
  const navigate = useNavigate();
  const { batchId } = useParams();
  const { activeBusiness } = useSelector((s) => s.auth);
  const facilityId = activeBusiness?.id;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [varianceReason, setVarianceReason] = useState("");
  const [savingReason, setSavingReason] = useState(false);

  const load = useCallback(() => {
    if (!facilityId || !batchId) return;
    setLoading(true);
    setError("");
    _postApi(
      "/api/reports/production/batch-detail",
      { facilityId, batchId },
      (resp) => {
        setLoading(false);
        if (resp.success && resp.data) {
          setData(resp.data);
          setVarianceReason(resp.data.batch?.varianceReason || "");
        } else {
          setError(resp.message || "Failed to load batch detail");
        }
      },
      () => { setLoading(false); setError("Server unreachable."); }
    );
  }, [facilityId, batchId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-gray-500 text-sm min-h-screen bg-gray-50">
        <Loader2 size={20} className="animate-spin" /> Loading batch detail…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <Button variant="outline" size="sm" className="mb-4"
          onClick={() => navigate("/app/production/production-reports/daily-batch-log")}>
          <ArrowLeft size={14} /> Back
        </Button>
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const { batch, yieldMetrics: ym, sharedCostLines, totalSharedCost, netSharedCost, totalSharedCostPerUnit, scaleUnits, productItems } = data;
  const isVarianceFlagged = batch.yieldStatus === "variance_flagged";
  const COLS = 2;
  const business    = activeBusiness || {};
  const businessName = business.business_name || business.name || "Company";

  return (
    <div className="min-h-screen bg-gray-50 p-3">
      <div id="batch-detail-printable" className="max-w-[1200px] mx-auto space-y-3">

        {/* ── Print styles (injected once) ── */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #batch-detail-printable, #batch-detail-printable * { visibility: visible; }
            #batch-detail-printable { position: absolute; inset: 0; padding: 16px; }
            .no-print { display: none !important; }
            @page { margin: 12mm; size: A4; }
          }
        `}</style>

        {/* ── Back + Print ── */}
        <div className="flex items-center justify-between no-print">
          <button
            onClick={() => navigate("/app/production/production-reports/daily-batch-log")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} /> Back to daily log
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            className="flex items-center gap-1.5"
          >
            <Printer size={14} /> Print / Save PDF
          </Button>
        </div>

        {/* ── Company header band ── */}
        <ReportHeaderBand
          business={business}
          reportTitle="Batch Detail Report"
          periodLabel={batch.batchNo}
        />


        {/* ── Variance warning banner ── */}
        {isVarianceFlagged && (
          <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">
                  Yield variance exceeds threshold — {fmtPct(ym.variancePct, true)} vs expected
                </p>
                <p className="text-xs text-red-600 mt-0.5">
                  Variance amount: <strong>{fmtMoney(ym.varianceAmountPerUnit)}</strong> per unit.
                  A variance reason is required before this batch can be closed.
                </p>
                <div className="mt-2.5">
                  <label className="text-xs font-bold text-red-700 uppercase tracking-wide block mb-1">
                    Variance Reason *
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      value={varianceReason}
                      onChange={(e) => setVarianceReason(e.target.value)}
                      rows={2}
                      placeholder="Describe the reason for the yield variance…"
                      className="flex-1 rounded border border-red-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                    />
                    <button
                      disabled={!varianceReason.trim() || savingReason}
                      onClick={() => {
                        setSavingReason(true);
                        // Save via API — endpoint to be wired
                        setTimeout(() => setSavingReason(false), 800);
                      }}
                      className="px-4 py-2 rounded bg-red-600 text-white text-xs font-bold disabled:opacity-50 hover:bg-red-700 self-end"
                    >
                      {savingReason ? "Saving…" : "Save reason"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 3 Yield metric cards ── */}
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            label="Expected Yield %"
            value={fmtPct(ym.expectedYieldPct)}
            accent={APP}
            sub="template target yield"
          />
          <MetricCard
            label="Actual Yield %"
            value={fmtPct(ym.actualYieldPct)}
            accent={ym.actualYieldPct >= ym.expectedYieldPct ? "#16a34a" : ym.actualYieldPct > 0 ? "#d97706" : "#9ca3af"}
            sub={`from ${ym.inputQty > 0 ? fmt(ym.inputQty, 4) : "—"} ${batch.rawMaterial?.unit || "Kg"} consumed`}
          />
          <MetricCard
            label="Variance %"
            value={fmtPct(ym.variancePct, true)}
            accent={Math.abs(ym.variancePct) > 5 ? "#dc2626" : "#16a34a"}
            sub={Math.abs(ym.variancePct) > 5 ? "outside ±5% threshold" : "within ±5% threshold"}
          />
        </div>

        {/* ── Shared cost pool ── */}
        {sharedCostLines.length > 0 && (
          <>
            <SectionHeader title={`Shared Cost Pool — ${scaleUnits} units`} />
            <TableWrap>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <Th>Description</Th>
                  <Th>Type</Th>
                  <Th right>Basis Value</Th>
                  <Th right>Amount (₦)</Th>
                </tr>
              </thead>
              <tbody>
                {sharedCostLines.map((line, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${line.isCredit ? "bg-purple-50/30" : ""}`}>
                    <Td>{line.accountName}</Td>
                    <Td>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${
                        line.type === "raw_material" ? "bg-orange-100 text-orange-700" :
                        line.type === "by_product"   ? "bg-purple-100 text-purple-700" :
                                                       "bg-gray-100 text-gray-600"
                      }`}>
                        {line.type === "raw_material" ? "Raw Material" :
                         line.type === "by_product"   ? "By-Product"   : "Other"}
                      </span>
                    </Td>
                    <Td right muted>
                      {line.basisType === "%" ? `${line.basisValue}%` : line.basisValue > 0 ? fmt(line.basisValue) : "—"}
                    </Td>
                    <Td right red={line.isCredit} bold={line.isCredit}>
                      {line.amount !== 0
                        ? (line.isCredit
                            ? `(${Math.abs(line.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })})`
                            : line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }))
                        : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-right text-xs font-bold text-gray-700 border-r border-gray-100">
                    Total shared cost per unit ({scaleUnits} units)
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-gray-800 border-r border-gray-100">
                    {fmtMoney(totalSharedCostPerUnit)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: APP }}>
                    {fmtMoney(totalSharedCost)}
                  </td>
                </tr>
              </tfoot>
            </TableWrap>
          </>
        )}

        {/* ── Products produced ── */}
        {productItems.length > 0 && (() => {
          // Compute each finished good's output weight for proportional cost allocation
          const fgItems = productItems.filter((p) => p.type !== "by_product");
          const totalOutputKg = fgItems.reduce((s, p) => s + p.qtyProduced * (p.multiplierValue || 1), 0);
          return (
          <>
            <SectionHeader title={`Products Produced — ${productItems.length} item${productItems.length !== 1 ? "s" : ""}`} />
            <div className="bg-white border border-t-0 border-gray-200 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <Th>Product</Th>
                    <Th right>Qty Produced</Th>
                    <Th right>Cost (₦)</Th>
                  </tr>
                </thead>
                <tbody>
                  {productItems.map((item, i) => {
                    const outputKg = item.qtyProduced * (item.multiplierValue || 1);
                    const proportion = totalOutputKg > 0 && item.type !== "by_product"
                      ? outputKg / totalOutputKg
                      : 0;
                    return (
                      <ProductRow key={i} item={item} proportion={proportion} sharedLines={sharedCostLines} />
                    );
                  })}
                </tbody>
                {productItems.some((p) => p.totalCost > 0) && (
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                    <tr>
                      <td className="px-3 py-2 text-sm font-bold text-gray-700">Total</td>
                      <td className="px-3 py-2 text-right text-sm font-bold tabular-nums text-gray-700">
                        {fmt(productItems.filter(p => p.type !== "by_product").reduce((s, p) => s + p.qtyProduced, 0))}
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-bold tabular-nums" style={{ color: APP }}>
                        {fmtMoney(productItems.filter(p => p.type !== "by_product").reduce((s, p) => s + p.totalCost, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
          );
        })()}

        {/* ── Footer ── */}
        <p className="text-right text-[10px] text-gray-400 pb-4">
          Batch created: {moment(batch.createdAt).format("DD MMM YYYY [at] HH:mm")}
        </p>
      </div>
    </div>
  );
}
