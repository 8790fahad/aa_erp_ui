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
