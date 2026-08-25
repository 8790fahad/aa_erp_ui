import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Lock, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiURL } from "@/redux/actions/api";
import { logout } from "@/redux/actions/auth";
import {
  SESSION_PREFS_EVENT,
  clearSessionLockState,
  getSessionPrefs,
  isSessionLocked,
  setSessionLocked,
} from "@/lib/sessionLock";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

/**
 * Watches inactivity and shows a password unlock overlay.
 * Mount inside the authenticated app shell only.
 */
export default function SessionLockGuard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const authenticated = useSelector((state) => state.auth.authenticated);
  const userId = user?.id;
  const email = user?.email || "";

  const [locked, setLocked] = useState(() => isSessionLocked());
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");
  const [prefs, setPrefs] = useState(() => getSessionPrefs(userId));

  const timerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    setPrefs(getSessionPrefs(userId));
  }, [userId]);

  useEffect(() => {
    const onPrefs = (e) => {
      if (e?.detail?.userId && e.detail.userId !== userId) return;
      setPrefs(e?.detail?.prefs || getSessionPrefs(userId));
    };
    window.addEventListener(SESSION_PREFS_EVENT, onPrefs);
    return () => window.removeEventListener(SESSION_PREFS_EVENT, onPrefs);
  }, [userId]);

  const lockNow = useCallback(() => {
    setSessionLocked(true);
    setLocked(true);
    setPassword("");
    setError("");
  }, []);

  const unlockLocal = useCallback(() => {
    setSessionLocked(false);
    setLocked(false);
    setPassword("");
    setError("");
    lastActivityRef.current = Date.now();
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (!prefs.enabled || locked || !authenticated) return;
    lastActivityRef.current = Date.now();
    if (timerRef.current) clearTimeout(timerRef.current);
    const ms = Math.max(1, Number(prefs.idleMinutes) || 10) * 60 * 1000;
    timerRef.current = setTimeout(() => {
      lockNow();
    }, ms);
  }, [prefs.enabled, prefs.idleMinutes, locked, authenticated, lockNow]);

  useEffect(() => {
    if (!authenticated || !prefs.enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return undefined;
    }
    if (locked) return undefined;

    const onActivity = () => resetIdleTimer();
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, onActivity, { passive: true }),
    );
    resetIdleTimer();

    return () => {
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, onActivity),
      );
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [authenticated, prefs.enabled, locked, resetIdleTimer]);

  // If prefs turned off while locked, stay locked until unlock — only stop new timers.
  useEffect(() => {
    if (!prefs.enabled && !locked) {
      clearSessionLockState();
    }
  }, [prefs.enabled, locked]);

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Enter your password");
      return;
    }
    if (!email) {
      setError("No email on this account. Please sign out and sign in again.");
      return;
    }

    setUnlocking(true);
    setError("");
    try {
      const response = await fetch(`${apiURL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (data.success === false) {
        setError(data.message || "Incorrect password");
        setUnlocking(false);
        return;
      }
      if (data.token) {
        localStorage.setItem("@@__token", data.token);
      }
      unlockLocal();
      toast.success("Welcome back");
    } catch {
      setError("Unable to verify password. Check your connection.");
    } finally {
      setUnlocking(false);
    }
  };

  const handleSignOut = () => {
    clearSessionLockState();
    dispatch(
      logout(() => {
        navigate("/login");
      }),
    );
  };

  if (!locked) return null;

  const displayName =
    [user?.firstName || user?.firstname, user?.lastName || user?.lastname]
      .filter(Boolean)
      .join(" ") ||
    user?.name ||
    email ||
    "User";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-lock-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") e.preventDefault();
      }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="bg-[var(--aa-navy,#1a2d5e)] px-6 py-5 text-center text-white">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
            <Lock className="h-6 w-6" />
          </div>
          <h2 id="session-lock-title" className="text-lg font-semibold">
            Session locked
          </h2>
          <p className="mt-1 text-sm text-white/80">
            Enter your password to continue
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4 px-6 py-5">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
            <p className="text-sm font-medium text-slate-900">{displayName}</p>
            {email ? (
              <p className="text-xs text-slate-500">{email}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="session-unlock-password"
              className="text-xs font-medium text-slate-600"
            >
              Password
            </label>
            <input
              id="session-unlock-password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[var(--aa-accent,#2c7be5)] focus:ring-1 focus:ring-[var(--aa-accent,#2c7be5)]"
              placeholder="Your account password"
            />
            {error ? (
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            disabled={unlocking}
            className="h-11 w-full bg-[var(--aa-navy,#1a2d5e)] text-white hover:opacity-90"
          >
            {unlocking ? "Checking..." : "Unlock"}
          </Button>

          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-1.5 py-1 text-xs text-slate-500 hover:text-slate-800"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out instead
          </button>
        </form>
      </div>
    </div>
  );
}
