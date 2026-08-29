/** Canonical product VAT / taxable statuses (must match API). */
export const TAXABLE_STATUS_OPTIONS = [
  {
    value: "Taxable",
    label: "Taxable",
    badgeClass: "bg-blue-50 text-blue-700",
    itemClass: "text-blue-700 focus:bg-blue-50 focus:text-blue-800",
    dotClass: "bg-blue-500",
  },
  {
    value: "Non-Taxable",
    label: "Non-Taxable",
    badgeClass: "bg-slate-100 text-slate-600",
    itemClass: "text-slate-600 focus:bg-slate-100 focus:text-slate-800",
    dotClass: "bg-slate-400",
  },
  {
    value: "Exempted",
    label: "Exempted",
    badgeClass: "bg-amber-50 text-amber-800",
    itemClass: "text-amber-800 focus:bg-amber-50 focus:text-amber-900",
    dotClass: "bg-amber-500",
  },
  {
    value: "Zero Rated",
    label: "Zero Rated",
    badgeClass: "bg-teal-50 text-teal-800",
    itemClass: "text-teal-800 focus:bg-teal-50 focus:text-teal-900",
    dotClass: "bg-teal-500",
  },
];

export const TAXABLE_STATUS_VALUES = TAXABLE_STATUS_OPTIONS.map((o) => o.value);

/**
 * Normalize free-text / legacy taxable values to a canonical status.
 */
export function normalizeTaxableStatus(value, fallback = "Taxable") {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (!raw) return fallback;
  if (raw === "taxable") return "Taxable";
  if (
    raw === "non taxable" ||
    raw === "nontaxable" ||
    raw === "not taxable" ||
    raw === "non-taxable"
  ) {
    return "Non-Taxable";
  }
  if (raw === "exempted" || raw === "exempt" || raw === "exemption") {
    return "Exempted";
  }
  if (
    raw === "zero rated" ||
    raw === "zerorated" ||
    raw === "zero rate" ||
    raw === "0 rated"
  ) {
    return "Zero Rated";
  }
  if (TAXABLE_STATUS_VALUES.includes(String(value).trim())) {
    return String(value).trim();
  }
  if (String(value).trim() === "Not Taxable") return "Non-Taxable";
  return fallback;
}

/** True when VAT should be calculated / applied on this product. */
export function isProductTaxable(value) {
  return normalizeTaxableStatus(value, "") === "Taxable";
}

export function taxableStatusStyle(value) {
  const key = normalizeTaxableStatus(value, "Taxable");
  return (
    TAXABLE_STATUS_OPTIONS.find((o) => o.value === key) ||
    TAXABLE_STATUS_OPTIONS[0]
  );
}
