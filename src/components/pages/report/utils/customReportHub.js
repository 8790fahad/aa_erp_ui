export const ACCOUNTING_REPORTS_BASE = "/app/reports/accounting-reports";

/**
 * Canonical Custom Reports page path (no query string).
 * e.g. https://yourapp/app/reports/accounting-reports/custom-reports
 */
export const CUSTOM_REPORTS_HUB_PATH = `${ACCOUNTING_REPORTS_BASE}/custom-reports`;

/**
 * Hub list item for Accounting Reports → section 13.
 * Account-ledger rows include `accounts` (and related) in the query on the custom-reports URL.
 * @param {Record<string, unknown>} row
 */
export function mapCustomReportRow(row, base = ACCOUNTING_REPORTS_BASE) {
  const cfg = row.config_json;
  if (
    cfg &&
    typeof cfg === "object" &&
    cfg.kind === "account_ledger" &&
    Array.isArray(cfg.accountCodes) &&
    cfg.accountCodes.length > 0
  ) {
    const params = new URLSearchParams();
    params.set("accounts", cfg.accountCodes.join(","));
    if (cfg.reportName) params.set("name", String(cfg.reportName));
    if (cfg.fromDate) params.set("from", String(cfg.fromDate));
    if (cfg.toDate) params.set("to", String(cfg.toDate));
    return {
      title: row.title,
      description: row.description || "",
      path: `${base}/custom-reports?${params.toString()}`,
      dateMode: "range",
    };
  }
  return {
    title: row.title,
    description: row.description || "",
    path: `${base}/custom-reports`,
    dateMode: "range",
  };
}

/**
 * Actual navigation target for "Open" (account ledger with codes in query string, etc.).
 * @param {Record<string, unknown>} row
 */
export function resolveCustomReportTarget(row, base = ACCOUNTING_REPORTS_BASE) {
  const cfg = row.config_json;
  if (
    cfg &&
    typeof cfg === "object" &&
    cfg.kind === "account_ledger" &&
    Array.isArray(cfg.accountCodes) &&
    cfg.accountCodes.length > 0
  ) {
    const params = new URLSearchParams();
    params.set("accounts", cfg.accountCodes.join(","));
    if (cfg.reportName) params.set("name", String(cfg.reportName));
    if (cfg.fromDate) params.set("from", String(cfg.fromDate));
    if (cfg.toDate) params.set("to", String(cfg.toDate));
    return {
      title: row.title,
      description: row.description || "",
      path: `${base}/custom-reports?${params.toString()}`,
      dateMode: "range",
      external: true,
    };
  }

  const ext = String(row.external_app_path || "").trim();
  if (ext.startsWith("/app/")) {
    return {
      title: row.title,
      description: row.description || "",
      path: ext,
      dateMode: row.date_mode === "asOf" ? "asOf" : "range",
      external: true,
    };
  }
  const seg = String(row.target_path || "")
    .trim()
    .replace(/^\/+/, "");
  if (seg) {
    return {
      title: row.title,
      description: row.description || "",
      path: `${base}/${seg}`,
      dateMode: row.date_mode === "asOf" ? "asOf" : "range",
    };
  }
  return {
    title: row.title,
    description: row.description || "",
    path: `${base}/custom-reports`,
    dateMode: "range",
  };
}
