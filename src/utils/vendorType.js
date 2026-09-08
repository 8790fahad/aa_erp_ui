export const VENDOR_TYPE_INVENTORY = "inventory";
export const VENDOR_TYPE_EXPENSE = "expense";
export const VENDOR_TYPE_ALL = "all";

export const VENDOR_TYPE_OPTIONS = [
  { value: VENDOR_TYPE_INVENTORY, label: "Inventory" },
  { value: VENDOR_TYPE_EXPENSE, label: "Expenses" },
  { value: VENDOR_TYPE_ALL, label: "All" },
];

export function normalizeVendorType(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "inventory" || v === "inventories") return VENDOR_TYPE_INVENTORY;
  if (v === "expense" || v === "expenses") return VENDOR_TYPE_EXPENSE;
  if (v === "all") return VENDOR_TYPE_ALL;
  return "";
}

export function vendorTypeLabel(value) {
  const v = normalizeVendorType(value);
  if (v === VENDOR_TYPE_INVENTORY) return "Inventory";
  if (v === VENDOR_TYPE_EXPENSE) return "Expenses";
  if (v === VENDOR_TYPE_ALL) return "All";
  return "—";
}

/**
 * Inventory vendors appear on Inventory Bill (and goods received).
 * Expense vendors appear on Expense Bill and Imprest.
 * "All" vendors appear on every list. Untyped (legacy) vendors stay visible too.
 */
export function matchesVendorType(supplier, type) {
  const want = normalizeVendorType(type);
  if (!want || want === VENDOR_TYPE_ALL) return true;
  const have = normalizeVendorType(
    supplier?.vendor_type || supplier?.supplier_type,
  );
  if (!have || have === VENDOR_TYPE_ALL) return true;
  return have === want;
}

export function filterSuppliersByVendorType(list, type) {
  return (Array.isArray(list) ? list : []).filter((s) =>
    matchesVendorType(s, type),
  );
}

export function canSeeAllVendorTypes(allowedTypes) {
  const allowed = Array.isArray(allowedTypes) ? allowedTypes : [];
  return (
    allowed.includes(VENDOR_TYPE_ALL) &&
    allowed.includes(VENDOR_TYPE_INVENTORY) &&
    allowed.includes(VENDOR_TYPE_EXPENSE)
  );
}

/** Keep only vendors the user's Vendor Type permissions allow. */
export function filterSuppliersByAllowedTypes(list, allowedTypes) {
  const rows = Array.isArray(list) ? list : [];
  if (!allowedTypes?.length || canSeeAllVendorTypes(allowedTypes)) return rows;
  return rows.filter((s) => {
    const have =
      normalizeVendorType(s?.vendor_type || s?.supplier_type) ||
      VENDOR_TYPE_ALL;
    return allowedTypes.includes(have);
  });
}
