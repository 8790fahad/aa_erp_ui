/** Client-side idle lock preferences (per user). */

const PREFS_KEY = "aa_erp_session_prefs";
const LOCKED_KEY = "aa_erp_session_locked";
export const SESSION_PREFS_EVENT = "aa-erp-session-prefs-changed";

export const IDLE_OPTIONS = [
  { value: 5, label: "5 minutes" },
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
];

const DEFAULT_PREFS = {
  enabled: false,
  idleMinutes: 10,
};

function prefsStorageKey(userId) {
  return userId ? `${PREFS_KEY}:${userId}` : PREFS_KEY;
}

export function getSessionPrefs(userId) {
  try {
    const raw = localStorage.getItem(prefsStorageKey(userId));
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    const idleMinutes = IDLE_OPTIONS.some((o) => o.value === Number(parsed.idleMinutes))
      ? Number(parsed.idleMinutes)
      : DEFAULT_PREFS.idleMinutes;
    return {
      enabled: Boolean(parsed.enabled),
      idleMinutes,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function setSessionPrefs(userId, prefs) {
  const next = {
    enabled: Boolean(prefs.enabled),
    idleMinutes: IDLE_OPTIONS.some((o) => o.value === Number(prefs.idleMinutes))
      ? Number(prefs.idleMinutes)
      : DEFAULT_PREFS.idleMinutes,
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
