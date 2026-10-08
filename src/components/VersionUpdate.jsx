import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { APP_VERSION, shouldPromptUpdate } from "@/version";

const CHECK_MS = 5 * 60 * 1000;
// Dev never swaps in a new bundle, so a completed local update is remembered
// until version.local.json names a newer build. Production compares the
// version baked into the JavaScript that just loaded.
const DEV_APPLIED_KEY = "aa-erp-dev-applied-version";

function versionInUse() {
  if (import.meta.env.DEV) {
    const applied = sessionStorage.getItem(DEV_APPLIED_KEY);
    if (applied) return applied;
  }
  return APP_VERSION;
}

function versionUrl() {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  // Dev reads an optional local file so the prompt can be tried without a build.
  // Production always compares the baked bundle version to /version.json.
  const file = import.meta.env.DEV ? "version.local.json" : "version.json";
  return `${prefix}${file}`;
}

async function loadLatestVersion() {
  const response = await fetch(`${versionUrl()}?t=${Date.now()}`, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  if (import.meta.env.DEV && response.status === 404) return null;
  if (!response.ok) throw new Error("version check failed");
  return response.json();
}

async function applyAppUpdate(acceptedVersion) {
  if (import.meta.env.DEV && acceptedVersion) {
    sessionStorage.setItem(DEV_APPLIED_KEY, acceptedVersion);
  }
  // Leave localStorage alone. It holds the login token and user preferences.
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (registration) => {
          try {
            await registration.update();
          } catch {
            /* already stale */
          }
          await registration.unregister();
        }),
      );
    }
  } catch {
    /* no service worker */
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    /* Cache Storage unavailable */
  }

  const url = new URL(window.location.href);
  url.searchParams.set("v", String(Date.now()));
  window.location.replace(url.toString());
}

export default function VersionUpdate() {
  const [serverVersion, setServerVersion] = useState("");
  const [applying, setApplying] = useState(false);

  const check = useCallback(async () => {
    try {
      const payload = await loadLatestVersion();
      if (!payload || !shouldPromptUpdate(versionInUse(), payload)) {
        setServerVersion("");
        return;
      }
      setServerVersion(String(payload.version).trim());
    } catch {
      // A failed check must not block the app.
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("v")) {
      url.searchParams.delete("v");
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", next);
    }
  }, []);

  useEffect(() => {
    check();
    const timer = window.setInterval(check, CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  if (!serverVersion) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/55 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-update-title"
      aria-describedby="app-update-desc"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <img
          src={`${import.meta.env.BASE_URL}aa-erp-icon.svg`}
          alt=""
          className="mb-4 h-10 w-10"
        />
        <h2
          id="app-update-title"
          className="text-lg font-semibold text-slate-900"
        >
          New version available
        </h2>
        <p id="app-update-desc" className="mt-2 text-sm leading-6 text-slate-600">
          A new version is available. Update to continue with the latest copy
          of the app.
        </p>
        <p className="mt-3 text-xs text-slate-400">
          This copy {versionInUse()} · Latest {serverVersion}
        </p>
        <Button
          type="button"
          className="mt-5 h-10 w-full"
          autoFocus
          disabled={applying}
          onClick={() => {
            setApplying(true);
            applyAppUpdate(serverVersion);
          }}
        >
          {applying ? "Updating…" : "Update now"}
        </Button>
      </div>
    </div>
  );
}
