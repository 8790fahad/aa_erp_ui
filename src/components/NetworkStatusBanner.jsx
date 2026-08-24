import { useEffect, useRef } from "react";
import { Wifi, WifiOff, RefreshCw, SignalLow } from "lucide-react";
import { toast } from "sonner";
import { useSharedNetworkStatus } from "@/components/NetworkStatusProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Global network status UI for unreliable connections.
 * Shows a sticky banner when offline or slow, and a short toast when restored.
 */
export default function NetworkStatusBanner() {
  const { status, isOffline, isSlow, rttMs, checking, checkNow } =
    useSharedNetworkStatus();
  const prevStatus = useRef(status);

  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = status;

    if (prev === "offline" && (status === "online" || status === "slow")) {
      toast.success(
        status === "slow"
          ? "Back online — connection is still slow. Save often."
          : "Back online. You can continue working.",
        { id: "aa-network-restored", duration: 4000 },
      );
    }

    if (status === "offline" && prev !== "offline") {
      toast.error(
        "No internet connection. Changes may not save until you reconnect.",
        {
          id: "aa-network-offline",
          duration: 5000,
        },
      );
    }
  }, [status]);

  if (!isOffline && !isSlow) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-x-0 top-0 z-[100] border-b px-3 py-2 text-sm shadow-md",
        isOffline
          ? "border-red-700 bg-red-600 text-white"
          : "border-amber-700 bg-amber-500 text-slate-900",
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {isOffline ? (
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <SignalLow className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="font-semibold leading-tight">
              {isOffline ? "You are offline" : "Slow or unstable connection"}
            </p>
            <p
              className={cn(
                "text-xs leading-snug",
                isOffline ? "text-red-50" : "text-amber-950/80",
              )}
            >
              {isOffline
                ? "Most AA ERP actions need internet. Check your mobile data or Wi‑Fi, then retry."
                : `Network is weak${rttMs ? ` (~${Math.round(rttMs / 1000)}s response)` : ""}. Prefer smaller uploads and wait for saves to finish.`}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant={isOffline ? "secondary" : "outline"}
          onClick={() => checkNow()}
          disabled={checking}
          className={cn(
            "shrink-0 gap-1.5",
            isOffline
              ? "bg-white text-red-700 hover:bg-red-50"
              : "border-amber-800/40 bg-white/90 text-amber-950 hover:bg-white",
          )}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", checking && "animate-spin")}
            aria-hidden
          />
          {checking ? "Checking…" : "Retry"}
        </Button>
      </div>
    </div>
  );
}

/** Compact pill for the top bar when connected / degraded. */
export function NetworkStatusIndicator({ className }) {
  const { isOffline, isSlow, checking, checkNow } = useSharedNetworkStatus();

  const label = isOffline
    ? "Offline"
    : isSlow
      ? "Slow net"
      : checking
        ? "Checking"
        : "Online";

  return (
    <button
      type="button"
      title={
        isOffline
          ? "No connection — tap to retry"
          : isSlow
            ? "Slow connection — tap to re-check"
            : "Connection OK — tap to re-check"
      }
      onClick={() => checkNow()}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
        isOffline
          ? "bg-red-500/25 text-red-100 hover:bg-red-500/40"
          : isSlow
            ? "bg-amber-400/25 text-amber-100 hover:bg-amber-400/40"
            : "bg-white/10 text-emerald-100 hover:bg-white/15",
        className,
      )}
    >
      {isOffline ? (
        <WifiOff className="h-3.5 w-3.5" aria-hidden />
      ) : isSlow ? (
        <SignalLow className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Wifi className="h-3.5 w-3.5" aria-hidden />
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
