/**
 * Opening balance amount + date rules:
 * - If amount is set (non-zero), date is required
 * - Date must be a real calendar date (YYYY-MM-DD)
 * - Future dates are allowed
 */
export function parseOpeningBalanceAmount(value) {
  if (value === "" || value == null) return 0;
  const n = parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

export function isValidOpeningBalanceDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * @returns {{ ok: true, amount: number, date: string|null } | { ok: false, message: string }}
 */
export function validateOpeningBalanceFields(amountRaw, dateRaw) {
  const amount = parseOpeningBalanceAmount(amountRaw);
  if (Number.isNaN(amount)) {
    return { ok: false, message: "Opening Balance amount must be a valid number" };
  }

  const date = String(dateRaw || "").trim();

  if (amount !== 0) {
    if (!date) {
      return {
        ok: false,
        message:
          "Opening Balance Date is required when an Opening Balance amount is entered",
      };
    }
    if (!isValidOpeningBalanceDate(date)) {
      return {
        ok: false,
        message: "Opening Balance Date must be a valid date (YYYY-MM-DD)",
      };
    }
  } else if (date && !isValidOpeningBalanceDate(date)) {
    return {
      ok: false,
      message: "Opening Balance Date must be a valid date (YYYY-MM-DD)",
    };
  }

  // Future dates are allowed — no max-date check
  return { ok: true, amount, date: date || null };
}
