/** Business-wide idle lock preferences (one setup per facility). */

import { useEffect, useState } from "react";

const PREFS_KEY = "aa_erp_session_prefs";
const LOCKED_KEY = "aa_erp_session_locked";
export const SESSION_PREFS_EVENT = "aa-erp-session-prefs-changed";
export const SESSION_LOCK_EVENT = "aa-erp-session-locked-changed";

/** Min / max idle minutes admins can set. */
export const MIN_IDLE_MINUTES = 1;
export const MAX_IDLE_MINUTES = 240;
/** Default idle timeout when session lock is first enabled. */
export const DEFAULT_IDLE_MINUTES = 10;

const DEFAULT_PREFS = {
  enabled: false,
  idleMinutes: DEFAULT_IDLE_MINUTES,
};

function prefsStorageKey(facilityId) {
  return facilityId ? `${PREFS_KEY}:biz:${facilityId}` : PREFS_KEY;
}

export function normalizeIdleMinutes(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < MIN_IDLE_MINUTES) {
    return DEFAULT_IDLE_MINUTES;
  }
  return Math.min(MAX_IDLE_MINUTES, Math.max(MIN_IDLE_MINUTES, n));
}

/** Build prefs from a business / activeBusiness record. */
export function prefsFromBusiness(business) {
  if (!business) return { ...DEFAULT_PREFS };
  return {
    enabled: Boolean(business.session_lock_enabled),
    idleMinutes: normalizeIdleMinutes(
      business.session_lock_idle_minutes ?? DEFAULT_IDLE_MINUTES,
    ),
  };
}

/**
 * Read prefs for a facility.
 * Prefer `business` (API / Redux) when provided; fall back to local cache.
 */
export function getSessionPrefs(facilityId, business) {
  if (business && (business.session_lock_enabled !== undefined || business.id)) {
    return prefsFromBusiness(business);
  }
  try {
    const raw = localStorage.getItem(prefsStorageKey(facilityId));
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

/** Cache prefs locally (same tab / quick reload) and notify listeners. */
export function setSessionPrefs(facilityId, prefs) {
  const next = {
    enabled: Boolean(prefs.enabled),
    idleMinutes: normalizeIdleMinutes(prefs.idleMinutes),
  };
  localStorage.setItem(prefsStorageKey(facilityId), JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent(SESSION_PREFS_EVENT, {
      detail: { facilityId, prefs: next },
    }),
  );
  return next;
}

export function isSessionLocked() {
  return sessionStorage.getItem(LOCKED_KEY) === "1";
}

export function useSessionLocked() {
  const [locked, setLocked] = useState(() =>
    typeof window === "undefined" ? false : isSessionLocked(),
  );
  useEffect(() => {
    const sync = (event) =>
      setLocked(Boolean(event?.detail?.locked ?? isSessionLocked()));
    window.addEventListener(SESSION_LOCK_EVENT, sync);
    return () => window.removeEventListener(SESSION_LOCK_EVENT, sync);
  }, []);
  return locked;
}

function emitSessionLock(locked) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SESSION_LOCK_EVENT, { detail: { locked: Boolean(locked) } }),
  );
}

/**
 * Radix Dialog/Sheet treat the lock overlay as an outside click/focus.
 * Prevent dismiss so open forms stay put until the user unlocks.
 */
export function guardDismissWhileLocked(handler) {
  return (event) => {
    if (isSessionLocked()) {
      event.preventDefault();
      return;
    }
    handler?.(event);
  };
}

export function setSessionLocked(locked) {
  if (locked) sessionStorage.setItem(LOCKED_KEY, "1");
  else sessionStorage.removeItem(LOCKED_KEY);
  emitSessionLock(Boolean(locked));
}

export function clearSessionLockState() {
  sessionStorage.removeItem(LOCKED_KEY);
  emitSessionLock(false);
}
