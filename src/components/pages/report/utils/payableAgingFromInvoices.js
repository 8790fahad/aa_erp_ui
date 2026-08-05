/**
 * AP aging buckets from outstanding purchase invoices.
 * "Current" = not yet past due (by due date) or no due date.
 */
export function payableAgingBucket(asAtStr, dueStr, fallbackStr) {
  const asDay = parseDay(asAtStr);
  if (!asDay) return "current";

  const dueRaw = dueStr || fallbackStr || null;
  const dueDay = parseDay(dueRaw);
  if (!dueDay) return "current";

  const daysPastDue = Math.floor((asDay - dueDay) / 86400000);
  if (daysPastDue <= 0) return "current";
  if (daysPastDue <= 30) return "d1_30";
  if (daysPastDue <= 60) return "d31_60";
  return "d61_plus";
}

function parseDay(isoLike) {
  if (!isoLike) return null;
  const s = String(isoLike).slice(0, 10);
  const t = new Date(`${s}T12:00:00`);
  return Number.isNaN(t.getTime()) ? null : t.getTime();
}

export function aggregateSupplierAgingFromInvoices(invoices, asAtDateStr) {
  const map = new Map();

  for (const inv of invoices || []) {
    const bal = Number(inv.amount_due ?? inv.balance_due ?? 0);
    if (!Number.isFinite(bal) || bal <= 0) continue;

    const supplierNo =
      String(inv.ref_number ?? inv.supplierNo ?? "").trim() || "—";
    const supplierName =
      String(inv.supplier_name ?? inv.supplierName ?? "").trim() || supplierNo;

    const bucket = payableAgingBucket(
      asAtDateStr,
      inv.due_date,
      inv.transaction_date,
    );

    if (!map.has(supplierNo)) {
      map.set(supplierNo, {
        supplierNo,
        supplierName,
        current: 0,
        d1_30: 0,
        d31_60: 0,
        d61_plus: 0,
      });
    }
    const row = map.get(supplierNo);
    row[bucket] += bal;
  }

  const rows = Array.from(map.values())
    .map((r) => ({
      ...r,
      total: r.current + r.d1_30 + r.d31_60 + r.d61_plus,
    }))
    .sort((a, b) =>
      String(a.supplierName).localeCompare(String(b.supplierName), undefined, {
        sensitivity: "base",
      }),
    );

  const totals = rows.reduce(
    (acc, r) => ({
      current: acc.current + r.current,
      d1_30: acc.d1_30 + r.d1_30,
      d31_60: acc.d31_60 + r.d31_60,
      d61_plus: acc.d61_plus + r.d61_plus,
      total: acc.total + r.total,
    }),
    { current: 0, d1_30: 0, d31_60: 0, d61_plus: 0, total: 0 },
  );

  return { rows, totals };
}
