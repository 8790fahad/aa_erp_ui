import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { _postApi } from "@/redux/actions/api";
import {
  MIN_IDLE_MINUTES,
  MAX_IDLE_MINUTES,
  DEFAULT_IDLE_MINUTES,
  normalizeIdleMinutes,
  prefsFromBusiness,
  setSessionPrefs,
} from "@/lib/sessionLock";

/**
 * Business-wide idle lock — one setting for the facility.
 * When enabled, every user under this business locks after the idle minutes.
 */
export default function SessionSettings() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const facilityId = activeBusiness?.id;

  const [enabled, setEnabled] = useState(false);
  const [idleMinutes, setIdleMinutes] = useState(String(DEFAULT_IDLE_MINUTES));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const prefs = prefsFromBusiness(activeBusiness);
    setEnabled(prefs.enabled);
    setIdleMinutes(String(prefs.idleMinutes || DEFAULT_IDLE_MINUTES));
    setDirty(false);
    if (facilityId) {
      setSessionPrefs(facilityId, prefs);
    }
  }, [facilityId, activeBusiness?.session_lock_enabled, activeBusiness?.session_lock_idle_minutes]);

  const save = () => {
    if (!facilityId || !user?.id) {
      toast.error("No active business");
      return;
    }
    const minutes = normalizeIdleMinutes(
      idleMinutes === "" || idleMinutes == null
        ? DEFAULT_IDLE_MINUTES
        : idleMinutes,
    );
    setIdleMinutes(String(minutes));
    setSaving(true);

    _postApi(
      `/account/update-session-lock/${facilityId}/${user.id}`,
      {
        session_lock_enabled: Boolean(enabled),
        session_lock_idle_minutes: minutes,
      },
      (resp) => {
        setSaving(false);
        if (resp?.success) {
          const business = resp.results || {
            ...activeBusiness,
            session_lock_enabled: Boolean(enabled),
            session_lock_idle_minutes: minutes,
          };
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: { business },
          });
          setSessionPrefs(facilityId, {
            enabled: Boolean(enabled),
            idleMinutes: minutes,
          });
          setDirty(false);
          toast.success(
            enabled
              ? `All users lock after ${minutes} minute${minutes === 1 ? "" : "s"} of inactivity`
              : "Session lock turned off for this business",
          );
        } else {
          toast.error(resp?.message || "Failed to save session lock");
        }
      },
      (err) => {
        setSaving(false);
        toast.error(err?.message || "Failed to save session lock");
      },
    );
  };

  return (
    <div className="mx-auto max-w-lg space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-[var(--aa-navy,#1a2d5e)]/10 p-2.5 text-[var(--aa-navy,#1a2d5e)]">
          <Lock className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Session lock
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            One setup for{" "}
            <span className="font-medium text-slate-700">
              {activeBusiness?.business_name || "this business"}
            </span>
            . If a user steps away, the app locks for them after the idle time
            you set — they enter their password to continue without losing their
            place.
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">
            Lock when users are inactive
          </p>
          <p className="text-xs text-slate-500">
            Applies to every user under this business
          </p>
        </div>
        <input
          type="checkbox"
          className="h-5 w-5 rounded border-slate-300 accent-[var(--aa-navy,#1a2d5e)]"
          checked={enabled}
          onChange={(e) => {
            const on = e.target.checked;
            setEnabled(on);
            if (
              on &&
              (!idleMinutes || !Number.isFinite(Number(idleMinutes)))
            ) {
              setIdleMinutes(String(DEFAULT_IDLE_MINUTES));
            }
            setDirty(true);
          }}
        />
      </label>

      <div
        className={`space-y-1.5 ${enabled ? "" : "pointer-events-none opacity-50"}`}
      >
        <label
          htmlFor="session-idle-minutes"
          className="text-xs font-medium text-slate-600"
        >
          Lock after (minutes)
        </label>
        <div className="flex items-center gap-2">
          <input
            id="session-idle-minutes"
            type="number"
            min={MIN_IDLE_MINUTES}
            max={MAX_IDLE_MINUTES}
            step={1}
            disabled={!enabled}
            value={idleMinutes}
            onChange={(e) => {
              setIdleMinutes(e.target.value);
              setDirty(true);
            }}
            className="h-10 w-28 rounded-md border border-slate-300 bg-white px-3 text-sm tabular-nums outline-none focus:border-[var(--aa-accent,#2c7be5)] focus:ring-1 focus:ring-[var(--aa-accent,#2c7be5)] disabled:bg-slate-100"
            placeholder={String(DEFAULT_IDLE_MINUTES)}
          />
          <span className="text-sm text-slate-500">minute(s)</span>
        </div>
        <p className="text-[11px] text-slate-400">
          Default is {DEFAULT_IDLE_MINUTES} minutes. You can enter{" "}
          {MIN_IDLE_MINUTES}–{MAX_IDLE_MINUTES}. Same timeout for all users.
        </p>
      </div>

      <div className="flex justify-end pt-1">
        <Button
          type="button"
          disabled={!dirty || saving}
          onClick={save}
          className="bg-[var(--aa-navy,#1a2d5e)] text-white hover:opacity-90"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
