import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import moment from "moment";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import {
  formatNumberWithCommas,
  parseNumberFromFormatted,
  filterJournalAmountInput,
} from "@/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Cashier supervisor hand-in confirmation — not bank reconciliation.
 */
export default function CollectionReconciliation() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const facilityId = activeBusiness?.id;

  const [date, setDate] = useState(() => moment().format("YYYY-MM-DD"));
  const [cashierFilter, setCashierFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [cashiers, setCashiers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [confirmingId, setConfirmingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [linesByCashier, setLinesByCashier] = useState({});
  const [linesLoading, setLinesLoading] = useState(null);

  const load = useCallback(() => {
    if (!facilityId || !date) return;
    setLoading(true);
    const params = new URLSearchParams({
      facilityId: String(facilityId),
      date,
    });

    _fetchApi(
      `/api/v1/collection-reconciliation?${params.toString()}`,
      (res) => {
        setLoading(false);
        if (res?.success) {
          const list = Array.isArray(res.cashiers) ? res.cashiers : [];
          setCashiers(list);
          setSummary(res.summary || null);
          setCashierFilter((prev) => {
            if (prev === "all") return prev;
            const stillThere = list.some(
              (c) => String(c.cashier_user_id) === String(prev),
            );
            return stillThere ? prev : "all";
          });
          const next = {};
          list.forEach((c) => {
            const cashVal =
              c.received_cash != null ? c.received_cash : c.expected_cash ?? 0;
            const transferVal =
              c.received_transfer != null
                ? c.received_transfer
                : c.expected_transfer ?? 0;
            next[c.cashier_user_id] = {
              received_cash: formatNumberWithCommas(String(cashVal)),
              received_transfer: formatNumberWithCommas(String(transferVal)),
              note: c.note || "",
            };
          });
          setDrafts(next);
        } else {
          toast.error(res?.message || "Failed to load reconciliation");
          setCashiers([]);
          setSummary(null);
        }
      },
      (err) => {
        setLoading(false);
        toast.error(err?.message || "Failed to load reconciliation");
        setCashiers([]);
        setSummary(null);
      },
    );
  }, [facilityId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const loadLines = useCallback(
    (cashierUserId) => {
      if (!facilityId || !date || !cashierUserId) return;
      if (linesByCashier[cashierUserId]) return;
      setLinesLoading(cashierUserId);
      const params = new URLSearchParams({
        facilityId: String(facilityId),
        date,
      });
      _fetchApi(
        `/api/v1/collection-reconciliation/${encodeURIComponent(
          cashierUserId,
        )}/lines?${params.toString()}`,
        (res) => {
          setLinesLoading(null);
          if (res?.success) {
            setLinesByCashier((prev) => ({
              ...prev,
              [cashierUserId]: Array.isArray(res.lines) ? res.lines : [],
            }));
          } else {
            toast.error(res?.message || "Failed to load lines");
          }
        },
        (err) => {
          setLinesLoading(null);
          toast.error(err?.message || "Failed to load lines");
        },
      );
    },
    [facilityId, date, linesByCashier],
  );

  const toggleExpand = (cashierUserId) => {
    if (expandedId === cashierUserId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(cashierUserId);
    loadLines(cashierUserId);
  };

  const updateDraft = (cashierUserId, field, value) => {
    let nextValue = value;
    if (field === "received_cash" || field === "received_transfer") {
      const withoutCommas = String(value || "").replace(/,/g, "");
      const sanitizedValue = filterJournalAmountInput(withoutCommas);
      const parts = sanitizedValue.split(".");
      const numericValue =
        parts.length > 2
          ? parts[0] + "." + parts.slice(1).join("")
          : sanitizedValue;
      nextValue = formatNumberWithCommas(numericValue);
    }
    setDrafts((prev) => ({
      ...prev,
      [cashierUserId]: {
        ...(prev[cashierUserId] || {
          received_cash: "",
          received_transfer: "",
          note: "",
        }),
        [field]: nextValue,
      },
    }));
  };

  const confirmCashier = (row) => {
    if (!facilityId || !user?.id) {
      toast.error("Missing business or user session");
      return;
    }
    const draft = drafts[row.cashier_user_id] || {};
    const received_cash = parseFloat(
      parseNumberFromFormatted(draft.received_cash),
    );
    const received_transfer = parseFloat(
      parseNumberFromFormatted(draft.received_transfer),
    );
    if (!Number.isFinite(received_cash) || !Number.isFinite(received_transfer)) {
      toast.error("Enter valid received amounts");
      return;
    }

    setConfirmingId(row.cashier_user_id);
    _postApi(
      "/api/v1/collection-reconciliation/confirm",
      {
        facilityId,
        date,
        branchId: 0,
        cashierUserId: row.cashier_user_id,
        received_cash,
        received_transfer,
        note: draft.note || null,
        confirmed_by: user.id,
        confirmed_by_name:
          [user.firstname, user.lastname].filter(Boolean).join(" ").trim() ||
          user.name ||
          user.username ||
          null,
      },
      (res) => {
        setConfirmingId(null);
        if (res?.success) {
          toast.success(res.message || "Confirmed");
          setLinesByCashier({});
          load();
        } else {
          toast.error(res?.message || "Could not confirm");
        }
      },
      (err) => {
        setConfirmingId(null);
        toast.error(err?.message || "Could not confirm");
      },
    );
  };

  const isLocked = (status) =>
    status === "confirmed" || status === "variance";

  const filteredCashiers = useMemo(() => {
    if (cashierFilter === "all") return cashiers;
    return cashiers.filter(
      (c) => String(c.cashier_user_id) === String(cashierFilter),
    );
  }, [cashiers, cashierFilter]);

  const viewSummary = useMemo(() => {
    if (cashierFilter === "all" && summary) {
      return {
        expected_cash: Number(summary.expected_cash) || 0,
        expected_transfer: Number(summary.expected_transfer) || 0,
        expected_total:
          (Number(summary.expected_cash) || 0) +
          (Number(summary.expected_transfer) || 0),
        confirmed_cash: Number(summary.received_cash) || 0,
        confirmed_transfer: Number(summary.received_transfer) || 0,
        confirmed_total:
          (Number(summary.received_cash) || 0) +
          (Number(summary.received_transfer) || 0),
        confirmed_count: Number(summary.confirmed_count) || 0,
        open_count: Number(summary.open_count) || 0,
      };
    }

    const rows = filteredCashiers;
    let expected_cash = 0;
    let expected_transfer = 0;
    let confirmed_cash = 0;
    let confirmed_transfer = 0;
    let confirmed_count = 0;
    let open_count = 0;

    rows.forEach((c) => {
      expected_cash += Number(c.expected_cash) || 0;
      expected_transfer += Number(c.expected_transfer) || 0;
      if (isLocked(c.status)) {
        confirmed_count += 1;
        confirmed_cash += Number(c.received_cash) || 0;
        confirmed_transfer += Number(c.received_transfer) || 0;
      } else {
        open_count += 1;
      }
    });

    return {
      expected_cash,
      expected_transfer,
      expected_total: expected_cash + expected_transfer,
      confirmed_cash,
      confirmed_transfer,
      confirmed_total: confirmed_cash + confirmed_transfer,
      confirmed_count,
      open_count,
    };
  }, [cashierFilter, summary, filteredCashiers]);

  const cards = useMemo(
    () => [
      {
        label: "Expected total",
        value: viewSummary.expected_total,
      },
      {
        label: "Expected cash",
        value: viewSummary.expected_cash,
      },
      {
        label: "Expected transfer",
        value: viewSummary.expected_transfer,
      },
      {
        label: "Confirmed total",
        value: viewSummary.confirmed_total,
      },
      {
        label: "Confirmed",
        value: viewSummary.confirmed_count,
        raw: true,
      },
      {
        label: "Open",
        value: viewSummary.open_count,
        raw: true,
      },
    ],
    [viewSummary],
  );

  return (
    <div className="min-h-screen bg-slate-50/80 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              to="/app/payments/collection-points"
              className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[var(--aa-accent)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Collection Points
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <ClipboardCheck className="h-7 w-7 text-[var(--aa-accent)]" />
              Collection Reconciliation
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Supervisor confirms each cashier&apos;s hand-in for the day (not
              bank reconciliation)
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Date
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setCashierFilter("all");
                setLinesByCashier({});
                setExpandedId(null);
              }}
              className="h-10 w-[160px] bg-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Cashier
            </label>
            <Select
              value={cashierFilter}
              onValueChange={(v) => {
                setCashierFilter(v);
                setExpandedId(null);
              }}
            >
              <SelectTrigger className="h-10 w-[220px] bg-white">
                <SelectValue placeholder="All cashiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cashiers</SelectItem>
                {cashiers.map((c) => (
                  <SelectItem
                    key={c.cashier_user_id}
                    value={String(c.cashier_user_id)}
                  >
                    {c.cashier_name || c.cashier_user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {c.label}
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {c.raw
                  ? c.value ?? 0
                  : `₦${formatNumber1(Number(c.value) || 0)}`}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredCashiers.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">
              No collections found for this date
              {cashierFilter !== "all" ? " / cashier" : ""}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Cashier</th>
                    <th className="px-3 py-2.5 font-semibold text-right">
                      Exp. cash
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-right">
                      Exp. transfer
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-right">
                      Received cash
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-right">
                      Received transfer
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-right">
                      Variance
                    </th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCashiers.map((row) => {
                    const locked = isLocked(row.status);
                    const draft = drafts[row.cashier_user_id] || {};
                    const recvCash =
                      parseFloat(
                        parseNumberFromFormatted(draft.received_cash),
                      ) || 0;
                    const recvTransfer =
                      parseFloat(
                        parseNumberFromFormatted(draft.received_transfer),
                      ) || 0;
                    const liveVariance =
                      locked && row.variance_total != null
                        ? Number(row.variance_total)
                        : moneySafe(recvCash - row.expected_cash) +
                          moneySafe(recvTransfer - row.expected_transfer);
                    const expanded = expandedId === row.cashier_user_id;
                    const lines = linesByCashier[row.cashier_user_id] || [];

                    return (
                      <Fragment key={row.cashier_user_id}>
                        <tr className="border-b border-slate-100 align-middle">
                          <td className="px-3 py-2.5">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-[var(--aa-accent)]"
                              onClick={() => toggleExpand(row.cashier_user_id)}
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              {row.cashier_name || row.cashier_user_id}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            ₦{formatNumber1(row.expected_cash)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            ₦{formatNumber1(row.expected_transfer)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {locked ? (
                              <span className="tabular-nums">
                                ₦{formatNumber1(row.received_cash)}
                              </span>
                            ) : (
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                className="ml-auto h-8 w-[130px] text-right tabular-nums"
                                value={draft.received_cash ?? ""}
                                onChange={(e) =>
                                  updateDraft(
                                    row.cashier_user_id,
                                    "received_cash",
                                    e.target.value,
                                  )
                                }
                              />
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {locked ? (
                              <span className="tabular-nums">
                                ₦{formatNumber1(row.received_transfer)}
                              </span>
                            ) : (
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                className="ml-auto h-8 w-[130px] text-right tabular-nums"
                                value={draft.received_transfer ?? ""}
                                onChange={(e) =>
                                  updateDraft(
                                    row.cashier_user_id,
                                    "received_transfer",
                                    e.target.value,
                                  )
                                }
                              />
                            )}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right tabular-nums font-medium ${
                              Math.abs(liveVariance) > 0.05
                                ? "text-amber-700"
                                : "text-emerald-700"
                            }`}
                          >
                            ₦{formatNumber1(liveVariance)}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusPill status={row.status} />
                          </td>
                          <td className="px-3 py-2.5">
                            {locked ? (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                {row.confirmed_by_name || "Confirmed"}
                              </span>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                className="h-8"
                                disabled={confirmingId === row.cashier_user_id}
                                onClick={() => confirmCashier(row)}
                              >
                                {confirmingId === row.cashier_user_id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  "Confirm"
                                )}
                              </Button>
                            )}
                          </td>
                        </tr>
                        {expanded ? (
                          <tr className="border-b border-slate-100 bg-slate-50/70">
                            <td colSpan={8} className="px-4 py-3">
                              {linesLoading === row.cashier_user_id ? (
                                <p className="text-xs text-slate-500">
                                  Loading lines…
                                </p>
                              ) : lines.length === 0 ? (
                                <p className="text-xs text-slate-500">
                                  No collection lines
                                </p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-slate-500">
                                      <th className="py-1 text-left font-medium">
                                        Time
                                      </th>
                                      <th className="py-1 text-left font-medium">
                                        Ref
                                      </th>
                                      <th className="py-1 text-left font-medium">
                                        Customer
                                      </th>
                                      <th className="py-1 text-left font-medium">
                                        Mode
                                      </th>
                                      <th className="py-1 text-right font-medium">
                                        Amount
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {lines.map((line) => (
                                      <tr
                                        key={line.entry_id}
                                        className="border-t border-slate-200/80"
                                      >
                                        <td className="py-1.5 text-slate-600">
                                          {moment(line.created_at).format(
                                            "HH:mm",
                                          )}
                                        </td>
                                        <td className="py-1.5">
                                          {line.sale_code || "—"}
                                        </td>
                                        <td className="py-1.5">
                                          {line.customer_name ||
                                            line.customer_no ||
                                            "—"}
                                        </td>
                                        <td className="py-1.5 capitalize">
                                          {line.payment_type}
                                        </td>
                                        <td className="py-1.5 text-right tabular-nums">
                                          ₦{formatNumber1(line.amount)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              {!locked ? (
                                <div className="mt-3 max-w-md">
                                  <label className="mb-1 block text-xs font-medium text-slate-600">
                                    Note (optional)
                                  </label>
                                  <Input
                                    value={draft.note || ""}
                                    onChange={(e) =>
                                      updateDraft(
                                        row.cashier_user_id,
                                        "note",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="e.g. short by ₦500 — IOU"
                                    className="h-8 bg-white"
                                  />
                                </div>
                              ) : row.note ? (
                                <p className="mt-2 text-xs text-slate-600">
                                  Note: {row.note}
                                </p>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function moneySafe(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

function StatusPill({ status }) {
  const s = String(status || "open");
  const styles =
    s === "confirmed"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : s === "variance"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-slate-100 text-slate-600 ring-slate-200";
  const label =
    s === "confirmed"
      ? "Confirmed"
      : s === "variance"
        ? "Variance"
        : "Open";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${styles}`}
    >
      {label}
    </span>
  );
}
