import { useCallback, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { apiURL } from "@/redux/actions/api";
import { isSessionLocked, setSessionLocked } from "@/lib/sessionLock";
import { LOGIN_HOURS_ENDED_EVENT, LOGIN_HOURS_REFRESH_EVENT } from "@/lib/loginHours";

/**
 * At closing time, expire the session in place (password overlay).
 * Uses the server clock and the saved after-hours checkboxes, not stale login state.
 */
export default function LoginHoursGuard() {
  const user = useSelector((state) => state.auth.user);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const authenticated = useSelector((state) => state.auth.authenticated);
  const facilityId = activeBusiness?.id;
  const userId = user?.id;
  const timerRef = useRef(null);
  const pollRef = useRef(null);

  const lockSession = useCallback(() => {
    if (!authenticated || isSessionLocked()) return;
    setSessionLocked(true, "hours");
  }, [authenticated]);

  const applyStatus = useCallback(
    (status) => {
      if (!status?.enabled) return;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (status.shouldLock) {
        lockSession();
        return;
      }
      if (
        typeof status.msUntilLock === "number" &&
        status.msUntilLock >= 0 &&
        status.msUntilLock < 24 * 60 * 60 * 1000
      ) {
        timerRef.current = setTimeout(() => lockSession(), status.msUntilLock);
      }
    },
    [lockSession],
  );

  const fetchStatus = useCallback(async () => {
    if (!authenticated || !facilityId || !userId) return;
    const token = localStorage.getItem("@@__token");
    if (!token) return;
    try {
      const response = await fetch(
        `${apiURL}/account/login-hours-status/${facilityId}/${userId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            authorization: token,
          },
        },
      );
      const data = await response.json();
      if (data?.success) applyStatus(data);
    } catch (err) {
      console.warn("[login-hours] status check failed:", err);
    }
  }, [authenticated, facilityId, userId, applyStatus]);

  useEffect(() => {
    if (!authenticated || !facilityId || !userId) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      return undefined;
    }

    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 5000);

    const onEnded = () => lockSession();
    const onRefresh = () => fetchStatus();
    const onFocus = () => fetchStatus();
    window.addEventListener(LOGIN_HOURS_ENDED_EVENT, onEnded);
    window.addEventListener(LOGIN_HOURS_REFRESH_EVENT, onRefresh);
    window.addEventListener("focus", onFocus);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      window.removeEventListener(LOGIN_HOURS_ENDED_EVENT, onEnded);
      window.removeEventListener(LOGIN_HOURS_REFRESH_EVENT, onRefresh);
      window.removeEventListener("focus", onFocus);
    };
  }, [authenticated, facilityId, userId, fetchStatus, lockSession]);

  return null;
}
