import { useCallback, useEffect, useRef, useState } from "react";
import { apiURL } from "@/redux/actions/api";

/** EffectiveType values that usually mean a constrained mobile link. */
const SLOW_EFFECTIVE_TYPES = new Set(["slow-2g", "2g"]);

/** Ping slower than this (ms) is treated as a weak link. */
const SLOW_RTT_MS = 4000;
/** Abort ping after this — common on flaky African networks. */
const PING_TIMEOUT_MS = 12000;
/** How often to re-check while online. */
const ONLINE_POLL_MS = 25000;
/** How often to retry while offline / recovering. */
const OFFLINE_POLL_MS = 6000;

function readBrowserConnectionHint() {
  if (typeof navigator === "undefined") return { slowHint: false, type: null };
  const conn =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;
  if (!conn) return { slowHint: false, type: null };
  const type = String(conn.effectiveType || "").toLowerCase();
  const saveData = Boolean(conn.saveData);
  const slowHint =
    SLOW_EFFECTIVE_TYPES.has(type) ||
    saveData ||
    (Number(conn.rtt) > 0 && Number(conn.rtt) >= 1500);
  return { slowHint, type: type || null };
}

async function pingServer() {
  const controller = new AbortController();
  const started = performance.now();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiURL}/health`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const rtt = Math.round(performance.now() - started);
    if (!res.ok) {
      return { ok: false, rtt, reason: `http_${res.status}` };
    }
    return { ok: true, rtt, reason: null };
  } catch (err) {
    const rtt = Math.round(performance.now() - started);
    const aborted = err?.name === "AbortError";
    return {
      ok: false,
      rtt,
      reason: aborted ? "timeout" : "network",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Network awareness for unreliable / high-latency links (common across Africa).
 * Combines browser online events, Network Information API hints, and API pings.
 */
export function useNetworkStatus() {
  const [status, setStatus] = useState(() =>
    typeof navigator !== "undefined" && navigator.onLine === false
      ? "offline"
      : "online",
  );
  const [rttMs, setRttMs] = useState(null);
  const [lastCheckedAt, setLastCheckedAt] = useState(null);
  const [checking, setChecking] = useState(false);
  const statusRef = useRef(status);
  const mountedRef = useRef(true);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const applyResult = useCallback((browserOnline, ping) => {
    if (!mountedRef.current) return;
    const hint = readBrowserConnectionHint();
    setLastCheckedAt(Date.now());
    if (ping?.rtt != null) setRttMs(ping.rtt);

    if (!browserOnline || !ping?.ok) {
      setStatus("offline");
      return;
    }

    const slowByRtt = Number(ping.rtt) >= SLOW_RTT_MS;
    if (slowByRtt || hint.slowHint) {
      setStatus("slow");
      return;
    }
    setStatus("online");
  }, []);

  const checkNow = useCallback(async () => {
    if (!mountedRef.current) return statusRef.current;
    setChecking(true);
    const browserOnline =
      typeof navigator === "undefined" ? true : navigator.onLine !== false;
    if (!browserOnline) {
      applyResult(false, { ok: false, rtt: null, reason: "browser_offline" });
      setChecking(false);
      return "offline";
    }
    const ping = await pingServer();
    applyResult(true, ping);
    setChecking(false);
    return statusRef.current;
  }, [applyResult]);

  useEffect(() => {
    mountedRef.current = true;
    checkNow();

    const onOnline = () => {
      checkNow();
    };
    const onOffline = () => {
      setStatus("offline");
      setLastCheckedAt(Date.now());
    };
    const onApiNetworkError = () => {
      // A failed API call often means the link dropped even if navigator says online.
      if (statusRef.current !== "offline") {
        checkNow();
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("aa:network-error", onApiNetworkError);

    const conn =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;
    const onConnChange = () => checkNow();
    if (conn?.addEventListener) {
      conn.addEventListener("change", onConnChange);
    }

    let timeoutId = null;
    const scheduleNext = () => {
      if (!mountedRef.current) return;
      const ms =
        statusRef.current === "offline" || statusRef.current === "slow"
          ? OFFLINE_POLL_MS
          : ONLINE_POLL_MS;
      timeoutId = setTimeout(async () => {
        await checkNow();
        scheduleNext();
      }, ms);
    };
    scheduleNext();

    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("aa:network-error", onApiNetworkError);
      if (conn?.removeEventListener) {
        conn.removeEventListener("change", onConnChange);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [checkNow]);

  return {
    status,
    isOnline: status === "online" || status === "slow",
    isOffline: status === "offline",
    isSlow: status === "slow",
    rttMs,
    lastCheckedAt,
    checking,
    checkNow,
  };
}

export function notifyNetworkError(err) {
  try {
    const msg = String(err?.message || err || "").toLowerCase();
    const looksNetwork =
      err?.name === "TypeError" ||
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("network request failed") ||
      msg.includes("load failed") ||
      msg.includes("timeout");
    if (looksNetwork && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("aa:network-error", { detail: err }),
      );
    }
  } catch {
    /* ignore */
  }
}
