import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  MIN_IDLE_MINUTES,
  MAX_IDLE_MINUTES,
  DEFAULT_IDLE_MINUTES,
  getSessionPrefs,
  normalizeIdleMinutes,
  setSessionPrefs,
} from "@/lib/sessionLock";

/**
 * Personal idle lock — when enabled, inactivity locks the app
 * until the user enters their password again.
 */
export default function SessionSettings() {
  const user = useSelector((state) => state.auth.user);
  const userId = user?.id;
  const [enabled, setEnabled] = useState(false);
  const [idleMinutes, setIdleMinutes] = useState(String(DEFAULT_IDLE_MINUTES));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const prefs = getSessionPrefs(userId);
    setEnabled(prefs.enabled);
    setIdleMinutes(String(prefs.idleMinutes || DEFAULT_IDLE_MINUTES));
    setDirty(false);
  }, [userId]);

  const save = () => {
    const minutes = normalizeIdleMinutes(
      idleMinutes === "" || idleMinutes == null
        ? DEFAULT_IDLE_MINUTES
        : idleMinutes,
    );
    setIdleMinutes(String(minutes));
    setSessionPrefs(userId, { enabled, idleMinutes: minutes });
    setDirty(false);
    toast.success(
      enabled
        ? `Auto-lock on after ${minutes} minute${minutes === 1 ? "" : "s"} of inactivity`
        : "Auto-lock turned off",
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
            If you step away, the app locks. Enter your password to continue —
            you will not lose your place.
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">
            Lock when I am inactive
          </p>
          <p className="text-xs text-slate-500">
            Recommended on shared computers
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
          {MIN_IDLE_MINUTES}–{MAX_IDLE_MINUTES}.
        </p>
      </div>

      <div className="flex justify-end pt-1">
        <Button
          type="button"
          disabled={!dirty}
          onClick={save}
          className="bg-[var(--aa-navy,#1a2d5e)] text-white hover:opacity-90"
        >
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
      </div>
    </div>
  );
}
