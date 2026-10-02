import { _postApi } from "@/redux/actions/api";

export const PRICE_MOVE_LIMIT = 0.1;

function norm(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function money(value) {
  const amount = Number(value) || 0;
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function prettyDate(value) {
  if (!value) return "";
  const text = String(value).slice(0, 10);
  const date = new Date(`${text}T12:00:00`);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function parseAmount(value) {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/,/g, "").trim();
  if (!cleaned) return NaN;
  return Number(cleaned);
}

export function checkSimilarPayment(payment) {
  return new Promise((resolve) => {
    _postApi(
      "/api/v1/check-similar-payment",
      {
        facilityId: payment.facilityId,
        supplierNumber: payment.supplierNumber || "",
        payeeName: payment.payeeName || "",
        transactionDate: payment.transactionDate,
        amount: payment.amount,
        narration: payment.narration || "",
      },
      (res) => resolve(Array.isArray(res?.matches) ? res.matches : []),
      () => resolve([]),
    );
  });
}

export function describeSimilarPayments(matches) {
  return (matches || []).map((match) => {
    const reasons = [];
    if ((match.reasons || []).includes("same_amount")) {
      reasons.push("same amount");
    }
    if ((match.reasons || []).includes("same_narration")) {
      reasons.push("same narration");
    }
    const reasonText = reasons.join(" and ") || "similar details";
    const reference = match.reference ? ` (${match.reference})` : "";
    const narration = match.narration ? ` Narration: ${match.narration}.` : "";
    return `Same transaction date ${prettyDate(match.date)}${reference}: ${reasonText}, ₦${money(match.amount)}.${narration}`;
  });
}

export function productUnitCostMoves(items, productList) {
  const list = Array.isArray(productList) ? productList : [];
  return (items || []).map((item) => {
    const sku = norm(item.sku || item.item_code);
    const name = norm(item.item_name || item.name);
    const catalog = list.find((product) => {
      const productSku = norm(product.sku);
      if (sku && productSku && productSku === sku) return true;
      const productName = norm(product.name || product.item_name);
      return Boolean(name && productName && productName === name);
    });
    return {
      label: item.item_name || item.name || item.sku || "Item",
      kind: "Unit cost",
      entered: parseAmount(item.cost),
      baseline: Number(catalog?.cost_price),
    };
  });
}

export function describePriceMoves(lines) {
  const messages = [];
  for (const line of lines || []) {
    const entered = Number(line.entered);
    const baseline = Number(line.baseline);
    if (!Number.isFinite(entered) || !Number.isFinite(baseline) || baseline <= 0) {
      continue;
    }
    const change = Math.abs(entered - baseline) / baseline;
    if (change + 1e-9 < PRICE_MOVE_LIMIT) continue;
    const direction = entered > baseline ? "higher" : "lower";
    const percent = (change * 100).toFixed(1);
    messages.push(
      `${line.label}: ${line.kind || "Price"} ₦${money(entered)} is ${percent}% ${direction} than the current ₦${money(baseline)}.`,
    );
  }
  return messages;
}

/**
 * Returns true when the user may continue.
 * Opens the confirm dialog only when a similar payment or a 10% price move is found.
 */
export async function confirmProceedGuards(ask, { payment, prices } = {}) {
  const lines = [];
  if (
    payment?.facilityId &&
    payment?.transactionDate &&
    (payment.supplierNumber || payment.payeeName)
  ) {
    const matches = await checkSimilarPayment(payment);
    lines.push(...describeSimilarPayments(matches));
  }
  if (prices?.length) {
    lines.push(...describePriceMoves(prices));
  }
  if (!lines.length) return true;
  return ask({
    title: "Confirm before you continue",
    lines,
  });
}
