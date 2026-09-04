/** Invoice / list kinds: walk-in vs registered customer. */

export function isWalkInCustomer(customerOrType) {
  const raw =
    typeof customerOrType === "string"
      ? customerOrType
      : customerOrType?.customer_type;
  const t = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  return t === "walk-in" || t === "walkin" || t === "walking";
}

export function normalizeCustomerKind(customerOrType) {
  return isWalkInCustomer(customerOrType) ? "walk-in" : "customer";
}

export function customerKindLabel(customerOrType) {
  return isWalkInCustomer(customerOrType) ? "Walk-in" : "Customer";
}

/** Walk-in: 0. Empty/null: unlimited (null). 0: no credit. Otherwise the amount. */
export function parseCreditLimitValue(value, { walkIn = false } = {}) {
  if (walkIn) return 0;
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (s === "") return null;
  const n = parseFloat(s.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Null/blank = unlimited. 0 is a real cap (no credit). */
export function isUnlimitedCreditLimit(value, { walkIn = false } = {}) {
  if (walkIn) return false;
  return parseCreditLimitValue(value) == null;
}
