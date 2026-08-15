/**
 * Report balancing rules (mirror API `accountBalance.js`):
 * A. ASSET / EXPENSE → Dr − Cr
 * B/C/D. LIABILITY / EQUITY / REVENUE → Cr − Dr
 */

const CREDIT_NORMAL = new Set(["LIABILITY", "EQUITY", "REVENUE"]);

export function normalizeAccountNature(nature) {
  return String(nature || "")
    .trim()
    .toUpperCase();
}

export function isCreditNormalNature(nature) {
  return CREDIT_NORMAL.has(normalizeAccountNature(nature));
}

export function signedBalance(nature, debit, credit) {
  const dr = parseFloat(debit) || 0;
  const cr = parseFloat(credit) || 0;
  if (isCreditNormalNature(nature)) {
    return cr - dr;
  }
  return dr - cr;
}

export function inferNatureFromCode(accountCode) {
  const first = String(accountCode || "").trim().charAt(0);
  if (first === "1") return "ASSET";
  if (first === "2" || first === "9") return "LIABILITY";
  if (first === "3") return "EQUITY";
  if (first === "4" || first === "5" || first === "6") return "REVENUE";
  if (first === "7" || first === "8") return "EXPENSE";
  return "ASSET";
}

export function resolveAccountNature(nature, accountCode) {
  const n = normalizeAccountNature(nature);
  if (n) return n;
  return inferNatureFromCode(accountCode);
}
