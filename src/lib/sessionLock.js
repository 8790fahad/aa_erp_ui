/** Client-side idle lock preferences (per user). */

const PREFS_KEY = "aa_erp_session_prefs";
const LOCKED_KEY = "aa_erp_session_locked";
export const SESSION_PREFS_EVENT = "aa-erp-session-prefs-changed";

/** Min / max idle minutes users can set. */
export const MIN_IDLE_MINUTES = 1;
export const MAX_IDLE_MINUTES = 240;
/** Default idle timeout when session lock is first enabled. */
export const DEFAULT_IDLE_MINUTES = 10;

const DEFAULT_PREFS = {
  enabled: false,
  idleMinutes: DEFAULT_IDLE_MINUTES,
};

function prefsStorageKey(userId) {
  return userId ? `${PREFS_KEY}:${userId}` : PREFS_KEY;
}

export function normalizeIdleMinutes(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < MIN_IDLE_MINUTES) {
    return DEFAULT_IDLE_MINUTES;
  }
  return Math.min(MAX_IDLE_MINUTES, Math.max(MIN_IDLE_MINUTES, n));
}

export function getSessionPrefs(userId) {
  try {
    const raw = localStorage.getItem(prefsStorageKey(userId));
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      idleMinutes: normalizeIdleMinutes(parsed.idleMinutes),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function setSessionPrefs(userId, prefs) {
  const next = {
    enabled: Boolean(prefs.enabled),
    idleMinutes: normalizeIdleMinutes(prefs.idleMinutes),
  };
  localStorage.setItem(prefsStorageKey(userId), JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent(SESSION_PREFS_EVENT, { detail: { userId, prefs: next } }),
  );
  return next;
}

export function isSessionLocked() {
  return sessionStorage.getItem(LOCKED_KEY) === "1";
}

export function setSessionLocked(locked) {
  if (locked) sessionStorage.setItem(LOCKED_KEY, "1");
  else sessionStorage.removeItem(LOCKED_KEY);
}

export function clearSessionLockState() {
  sessionStorage.removeItem(LOCKED_KEY);
}
