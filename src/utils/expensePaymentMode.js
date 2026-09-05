/** Human-readable payment mode for bills and imprest lists. */
export function formatExpensePaymentMode(mode) {
  const raw = String(mode || "").trim().toLowerCase();
  if (!raw) return "—";
  if (
    raw === "credit_split" ||
    raw === "credit+cash+transfer" ||
    raw === "credit + cash + transfer"
  ) {
    return "Credit + Cash + Transfer";
  }
  if (raw === "split" || raw === "cash+transfer" || raw === "cash + transfer") {
    return "Cash + Transfer";
  }
  if (raw === "bank") return "Bank / Transfer";
  if (raw === "card") return "Card";
  return raw
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
