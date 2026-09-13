/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { CalendarRange, Check, Save, Settings, X } from "lucide-react";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";
import { Button } from "@/components/ui/button";
import {
  describeFinancialYear,
  getFinancialYearForDate,
  getFinancialYearStartMonth,
  listFinancialYearOptions,
  MONTH_NAMES,
} from "@/utils/financialYear";

export default function FinancialYearSettings({
  title = "Financial Year",
  description = "Set when your accounting year starts. Reports use this for period defaults.",
}) {
  const dispatch = useDispatch();
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const savedMonth = getFinancialYearStartMonth(activeBusiness);
  const [isEditing, setIsEditing] = useState(false);
  const [draftMonth, setDraftMonth] = useState(savedMonth);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEditing) setDraftMonth(savedMonth);
  }, [isEditing, savedMonth]);

  const currentFy = useMemo(
    () => getFinancialYearForDate(savedMonth, new Date()),
    [savedMonth],
  );
  const previewOptions = useMemo(
    () => listFinancialYearOptions(isEditing ? draftMonth : savedMonth, 2, 0),
    [isEditing, draftMonth, savedMonth],
  );

  const handleSave = () => {
    if (!activeBusiness?.id) {
      toast.error("No active business");
      return;
    }
    const userId = user?.id || user?.email || activeBusiness.business_admin;
    if (!userId) {
      toast.error("User id is required to save");
      return;
    }
    setLoading(true);
    _postApi(
      `/account/update-financial-year/${activeBusiness.id}/${userId}`,
      { startMonth: draftMonth },
      (resp) => {
        setLoading(false);
        if (resp?.success && resp.results) {
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: { business: resp.results },
          });
          setIsEditing(false);
          toast.success("Financial year updated");
        } else {
          toast.error(resp?.message || "Failed to update financial year");
        }
      },
      (err) => {
        setLoading(false);
        console.error(err);
        toast.error("Network error. Could not update financial year");
      },
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-[var(--aa-navy,#1a2d5e)] to-[#243a6e] px-5 py-4 text-white">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-white/85">{description}</p>
          </div>
        </div>
        {!isEditing ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="border-0 bg-white/15 text-white hover:bg-white/25"
            onClick={() => setIsEditing(true)}
          >
            <Settings className="mr-1.5 h-4 w-4" />
            Configure
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="border-0 bg-white/15 text-white hover:bg-white/25"
              disabled={loading}
              onClick={() => setIsEditing(false)}
            >
              <X className="mr-1 h-4 w-4" />
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-white text-[var(--aa-navy,#1a2d5e)] hover:bg-slate-100"
              disabled={loading}
              onClick={handleSave}
            >
              {loading ? (
                "Saving…"
              ) : (
                <>
                  <Save className="mr-1 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current setup
          </p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {describeFinancialYear(savedMonth)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            This year (FY {currentFy.label}): {currentFy.fromDate} →{" "}
            {currentFy.toDate}
          </p>
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Financial year starts in
            </label>
            <select
              value={draftMonth}
              onChange={(e) => setDraftMonth(parseInt(e.target.value, 10))}
              className="h-10 w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent,#2c7be5)] focus:ring-1 focus:ring-[var(--aa-accent,#2c7be5)]"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
            <p className="text-sm text-slate-600">
              Preview: {describeFinancialYear(draftMonth)}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {previewOptions.slice(0, 3).map((fy) => (
              <li
                key={fy.startYear}
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-800">
                  FY {fy.label}
                </span>
                <span className="text-slate-500">
                  {fy.fromDate} → {fy.toDate}
                </span>
                {fy.startYear === currentFy.startYear ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <Check className="h-3.5 w-3.5" /> Current
                  </span>
                ) : (
                  <span className="w-16" />
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-slate-500">
          Accounting reports can pick a financial year; dates default to that
          year&apos;s start and end.
        </p>
      </div>
    </div>
  );
}
