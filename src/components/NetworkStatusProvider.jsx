import { createContext, useContext } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

const NetworkStatusContext = createContext(null);

export function NetworkStatusProvider({ children }) {
  const value = useNetworkStatus();
  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useSharedNetworkStatus() {
  const ctx = useContext(NetworkStatusContext);
  if (!ctx) {
    throw new Error(
      "useSharedNetworkStatus must be used within NetworkStatusProvider",
    );
  }
  return ctx;
}
