import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import moment from "moment";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import PayableSettings from "./PayableSettings";

export default function VatSettings() {
  const { activeBusiness } = useSelector((state) => state.auth);
  const vatAccountCode = String(activeBusiness?.vat_account_code || "").trim();

  const [fromDate, setFromDate] = useState(() =>
    moment().startOf("month").format("YYYY-MM-DD"),
  );
  const [toDate, setToDate] = useState(() => moment().format("YYYY-MM-DD"));
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [accountName, setAccountName] = useState("");

  const runFetch = useCallback(() => {
    if (!activeBusiness?.id || !vatAccountCode) {
      setSummary(null);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({
      facilityId: String(activeBusiness.id),
      head: vatAccountCode,
      fromDate,
      toDate,
    });
    _fetchApi(
      `/account/vat-head-position?${params.toString()}`,
      (res) => {
        setLoading(false);
        if (!res?.success) {
          setSummary(null);
          toast.error(res?.message || "Unable to load VAT Recoverable totals");
          return;
        }
        setAccountName(res.description || "VAT Recoverable");
        setSummary({
          inputVat: Number(res.input_vat || 0),
          outputVat: Number(res.output_vat || 0),
          net: Number(res.net || 0),
          amountToPay: Number(res.amount_to_pay || 0),
          recoverable: Number(res.recoverable || 0),
        });
      },
      (err) => {
        console.error(err);
        setLoading(false);
        setSummary(null);
        toast.error("Unable to load VAT Recoverable totals");
      },
    );
  }, [activeBusiness?.id, vatAccountCode, fromDate, toDate]);

  useEffect(() => {
    runFetch();
  }, [runFetch]);

  const periodLabel = useMemo(
    () =>
      `${moment(fromDate).format("DD MMM YYYY")} – ${moment(toDate).format("DD MMM YYYY")}`,
    [fromDate, toDate],
  );

  return (
    <div className="space-y-4">
      <PayableSettings
        title="VAT Recoverable"
        code={vatAccountCode}
        description="Select the VAT Recoverable GL head. Totals below are taken only from that head."
        icon="🧾"
      />

      <Card className="mb-0 overflow-hidden rounded-xl border border-slate-200 shadow-none">
        <div
          className="border-0 px-5 py-3.5 text-white"
          style={{ background: "var(--aa-navy)" }}
        >
          <h5 className="mb-0 fw-bold">VAT position</h5>
          <small className="opacity-75">
            Debits and credits on the selected VAT Recoverable head only
          </small>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-gray-600 block mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border rounded px-2 py-2 text-sm bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border rounded px-2 py-2 text-sm bg-white"
              />
            </div>
            <Button
              type="button"
              onClick={runFetch}
              disabled={loading || !vatAccountCode}
              className="bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading
                </>
              ) : (
                "Refresh"
              )}
            </Button>
          </div>

          {!vatAccountCode ? (
            <p className="text-sm text-slate-500 mb-0">
              Select a VAT Recoverable account above to see Input VAT, Output
              VAT, and the amount to pay.
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-0">
                Head {vatAccountCode}
                {accountName ? ` · ${accountName}` : ""} · {periodLabel}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-sky-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 mb-1">
                    Total Input VAT
                  </p>
                  <p className="text-xl font-bold tabular-nums text-sky-900 mb-0">
                    ₦{formatNumber1(summary?.inputVat || 0)}
                  </p>
                  <p className="text-xs text-sky-700/80 mt-1 mb-0">
                    Debits on this head (purchases / bills)
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-1">
                    Total Output VAT
                  </p>
                  <p className="text-xl font-bold tabular-nums text-emerald-900 mb-0">
                    ₦{formatNumber1(summary?.outputVat || 0)}
                  </p>
                  <p className="text-xs text-emerald-700/80 mt-1 mb-0">
                    Credits on this head (sales invoices)
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-amber-50 p-4">
                  {(summary?.recoverable || 0) > 0.005 ? (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-1">
                        VAT recoverable
                      </p>
                      <p className="text-xl font-bold tabular-nums text-amber-900 mb-0">
                        ₦{formatNumber1(summary.recoverable)}
                      </p>
                      <p className="text-xs text-amber-800/80 mt-1 mb-0">
                        Input VAT is higher than Output VAT — credit for the
                        business
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-1">
                        Amount to pay
                      </p>
                      <p className="text-xl font-bold tabular-nums text-amber-900 mb-0">
                        ₦{formatNumber1(summary?.amountToPay || 0)}
                      </p>
                      <p className="text-xs text-amber-800/80 mt-1 mb-0">
                        Output VAT − Input VAT
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  to="/app/purchase/input-vat"
                  className="text-sm font-medium"
                  style={{ color: "var(--aa-accent)" }}
                >
                  Open Input VAT report
                </Link>
                <Link
                  to="/app/sales/vat-report"
                  className="text-sm font-medium"
                  style={{ color: "var(--aa-accent)" }}
                >
                  Open VAT Report (sales)
                </Link>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
