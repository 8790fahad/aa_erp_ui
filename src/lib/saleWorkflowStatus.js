import React from "react";

/**
 * User-facing process stages (AA ERP sales):
 * Invoice → Cashier → Separation → Warehouse → Done
 *
 * Raw DB statuses still exist for history; they map into these buckets.
 */

export const PROCESS_STAGES = [
  {
    id: "invoice",
    short: "Invoice",
    label: "Invoice generated",
    color: "slate",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
    row: "bg-slate-50",
    statuses: ["sales_order", "invoice_generated", "submitted"],
  },
  {
    id: "cashier",
    short: "Cashier",
    label: "Cashier confirm payment",
    color: "amber",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
    row: "bg-amber-50",
    statuses: ["awaiting_payment", "awaiting_cashier_confirm"],
  },
  {
    id: "paid",
    short: "Separation",
    label: "Separation",
    color: "green",
    badge: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-500",
    row: "bg-green-50",
    statuses: [
      "payment_confirmed",
      "invoice_separation",
      "credit_approved",
      "final_invoice",
    ],
  },
  {
    id: "warehouse",
    short: "Warehouse",
    label: "Warehouse collect",
    color: "orange",
    badge: "bg-orange-100 text-orange-800 border-orange-200",
    dot: "bg-orange-500",
    row: "bg-orange-50",
    statuses: ["warehouse_picking", "dual_signature", "goods_released"],
  },
  {
    id: "done",
    short: "Done",
    label: "Completed",
    color: "emerald",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
    row: "bg-emerald-50",
    statuses: ["completed"],
  },
  {
    id: "cancelled",
    short: "Reversed",
    label: "Reversed after closing",
    color: "red",
    badge: "bg-red-100 text-red-800 border-red-200",
    dot: "bg-red-500",
    row: "bg-red-50",
    statuses: ["cancelled", "reversed"],
  },
];

/** Credit sales only — waiting approval before Paid. */
export const CREDIT_PROCESS_STAGE = {
  id: "credit",
  short: "Credit",
  label: "Credit approval",
  color: "rose",
  badge: "bg-rose-100 text-rose-800 border-rose-200",
  dot: "bg-rose-500",
  row: "bg-rose-50",
  statuses: ["awaiting_credit_approval"],
};

const STATUS_TO_PROCESS = (() => {
  const map = {};
  for (const stage of [...PROCESS_STAGES, CREDIT_PROCESS_STAGE]) {
    for (const s of stage.statuses) map[s] = stage;
  }
  return map;
})();

/** Raw status detail (timeline / history). */
export const SALE_WORKFLOW_STATUS_META = {
  sales_order: {
    label: "Create Sales Order",
    short: "Invoice",
    color: "slate",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
    row: "bg-slate-50",
  },
  invoice_generated: {
    label: "Invoice generated",
    short: "Invoice",
    color: "slate",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
    row: "bg-slate-50",
  },
  submitted: {
    label: "Invoice submitted",
    short: "Invoice",
    color: "slate",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
    row: "bg-slate-50",
  },
  awaiting_payment: {
    label: "Awaiting payment",
    short: "Cashier",
    color: "amber",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
    row: "bg-amber-50",
  },
  awaiting_cashier_confirm: {
    label: "Cashier confirm",
    short: "Cashier",
    color: "amber",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
    row: "bg-amber-50",
  },
  payment_confirmed: {
    label: "Separation",
    short: "Separation",
    color: "green",
    badge: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-500",
    row: "bg-green-50",
  },
  awaiting_credit_approval: {
    label: "Credit approval",
    short: "Credit",
    color: "rose",
    badge: "bg-rose-100 text-rose-800 border-rose-200",
    dot: "bg-rose-500",
    row: "bg-rose-50",
  },
  credit_approved: {
    label: "Separation",
    short: "Separation",
    color: "green",
    badge: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-500",
    row: "bg-green-50",
  },
  invoice_separation: {
    label: "Separation",
    short: "Separation",
    color: "green",
    badge: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-500",
    row: "bg-green-50",
  },
  final_invoice: {
    label: "Separation",
    short: "Separation",
    color: "green",
    badge: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-500",
    row: "bg-green-50",
  },
  warehouse_picking: {
    label: "Warehouse collect",
    short: "Warehouse",
    color: "orange",
    badge: "bg-orange-100 text-orange-800 border-orange-200",
    dot: "bg-orange-500",
    row: "bg-orange-50",
  },
  dual_signature: {
    label: "Warehouse — dual signature",
    short: "Warehouse",
    color: "orange",
    badge: "bg-orange-100 text-orange-800 border-orange-200",
    dot: "bg-orange-500",
    row: "bg-orange-50",
  },
  goods_released: {
    label: "Warehouse — goods released",
    short: "Warehouse",
    color: "orange",
    badge: "bg-orange-100 text-orange-800 border-orange-200",
    dot: "bg-orange-500",
    row: "bg-orange-50",
  },
  completed: {
    label: "Done",
    short: "Done",
    color: "emerald",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
    row: "bg-emerald-50",
  },
  cancelled: {
    label: "Reversed after closing",
    short: "Reversed",
    color: "red",
    badge: "bg-red-100 text-red-800 border-red-200",
    dot: "bg-red-500",
    row: "bg-red-50",
  },
  reversed: {
    label: "Reversed after closing",
    short: "Reversed",
    color: "red",
    badge: "bg-red-100 text-red-800 border-red-200",
    dot: "bg-red-500",
    row: "bg-red-50",
  },
};

export const FULFILLMENT_STATUS_META = {
  pending: {
    label: "Pending",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
  },
  printed: {
    label: "Printed",
    badge: "bg-violet-100 text-violet-800 border-violet-200",
    dot: "bg-violet-500",
  },
  collecting: {
    label: "Collecting",
    badge: "bg-orange-100 text-orange-800 border-orange-200",
    dot: "bg-orange-500",
  },
  collected: {
    label: "Collected",
    badge: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-500",
  },
};

export function getProcessStage(status, paymentType) {
  const isCredit = String(paymentType || "").toLowerCase() === "credit";
  // Credit sales in separation are still unpaid — show Credit, not Paid
  if (
    isCredit &&
    ["payment_confirmed", "invoice_separation", "credit_approved", "final_invoice"].includes(
      String(status || ""),
    )
  ) {
    return {
      ...CREDIT_PROCESS_STAGE,
      short: "Credit",
      label: "Credit — not paid",
    };
  }
  return (
    STATUS_TO_PROCESS[status] || {
      id: "invoice",
      short: status || "—",
      label: status || "Unknown",
      color: "slate",
      badge: "bg-slate-100 text-slate-700 border-slate-200",
      dot: "bg-slate-400",
      row: "bg-slate-50",
      statuses: [],
    }
  );
}

export function getWorkflowStatusMeta(status, paymentType) {
  const process = getProcessStage(status, paymentType);
  const detail = SALE_WORKFLOW_STATUS_META[status];
  const isCredit = String(paymentType || "").toLowerCase() === "credit";
  if (
    isCredit &&
    ["payment_confirmed", "invoice_separation", "credit_approved", "final_invoice"].includes(
      String(status || ""),
    )
  ) {
    return {
      label: "Credit — not paid",
      short: "Credit",
      color: "rose",
      badge: CREDIT_PROCESS_STAGE.badge,
      dot: CREDIT_PROCESS_STAGE.dot,
      row: CREDIT_PROCESS_STAGE.row,
      processId: "credit",
      processLabel: "Credit — not paid",
    };
  }
  if (detail) {
    return {
      ...detail,
      short: process.short || detail.short,
      badge: process.badge || detail.badge,
      dot: process.dot || detail.dot,
      row: process.row || detail.row,
      color: process.color || detail.color,
      processId: process.id,
      processLabel: process.label,
    };
  }
  return {
    label: status || "Unknown",
    short: process.short || status || "—",
    color: process.color || "slate",
    badge: process.badge,
    dot: process.dot,
    row: process.row,
    processId: process.id,
    processLabel: process.label,
  };
}

export function getFulfillmentStatusMeta(status) {
  return FULFILLMENT_STATUS_META[status] || FULFILLMENT_STATUS_META.pending;
}

export function statusMatchesProcessStage(
  workflowStatus,
  processStageId,
  paymentType,
) {
  if (!processStageId) return true;
  const isCredit = String(paymentType || "").toLowerCase() === "credit";
  const creditSepStatuses = [
    "payment_confirmed",
    "invoice_separation",
    "credit_approved",
    "final_invoice",
  ];
  if (processStageId === "credit") {
    if (isCredit && creditSepStatuses.includes(String(workflowStatus || ""))) {
      return true;
    }
    return CREDIT_PROCESS_STAGE.statuses.includes(String(workflowStatus || ""));
  }
  if (
    processStageId === "paid" &&
    isCredit &&
    creditSepStatuses.includes(String(workflowStatus || ""))
  ) {
    return false;
  }
  const stage =
    PROCESS_STAGES.find((s) => s.id === processStageId) ||
    (processStageId === "credit" ? CREDIT_PROCESS_STAGE : null);
  if (!stage) return String(workflowStatus || "") === processStageId;
  return stage.statuses.includes(String(workflowStatus || ""));
}

export function WorkflowStatusBadge({
  status,
  paymentType,
  label,
  compact = false,
  className = "",
}) {
  const meta = getWorkflowStatusMeta(status, paymentType);
  const text =
    label ||
    (compact ? meta.short || meta.label : meta.processLabel || meta.label);
  return React.createElement(
    "span",
    {
      title: meta.processLabel || meta.label,
      className: `inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${meta.badge} ${className}`,
    },
    React.createElement("span", {
      className: `h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`,
    }),
    text,
  );
}
