import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  IDLE_OPTIONS,
  getSessionPrefs,
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
  const [idleMinutes, setIdleMinutes] = useState(10);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const prefs = getSessionPrefs(userId);
    setEnabled(prefs.enabled);
    setIdleMinutes(prefs.idleMinutes);
    setDirty(false);
  }, [userId]);

  const save = () => {
    setSessionPrefs(userId, { enabled, idleMinutes });
    setDirty(false);
    toast.success(
      enabled
        ? `Auto-lock on after ${idleMinutes} minutes of inactivity`
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
            setEnabled(e.target.checked);
            setDirty(true);
          }}
        />
      </label>

      <div
        className={`space-y-1.5 ${enabled ? "" : "pointer-events-none opacity-50"}`}
      >
        <label className="text-xs font-medium text-slate-600">
          Lock after
        </label>
        <select
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent,#2c7be5)] focus:ring-1 focus:ring-[var(--aa-accent,#2c7be5)]"
          value={idleMinutes}
          disabled={!enabled}
          onChange={(e) => {
            setIdleMinutes(Number(e.target.value));
            setDirty(true);
          }}
        >
          {IDLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
