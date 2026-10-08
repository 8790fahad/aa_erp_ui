import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./styles/dashboard-home.css";
// import "bootstrap/dist/css/bootstrap.min.css";
import { SidebarProvider } from "./components/ui/sidebar.jsx";
import { Provider } from "react-redux";
import store from "./redux/store.js";

import { Toaster } from "./components/ui/sonner.jsx";
import { NetworkStatusProvider } from "./components/NetworkStatusProvider.jsx";
import NetworkStatusBanner from "./components/NetworkStatusBanner.jsx";
import VersionUpdate from "./components/VersionUpdate.jsx";

import { SpeedInsights } from "@vercel/speed-insights/react"

// Drop the cache-bust param before the router reads the address bar.
const startupUrl = new URL(window.location.href);
if (startupUrl.searchParams.has("v")) {
  startupUrl.searchParams.delete("v");
  const next = `${startupUrl.pathname}${startupUrl.search}${startupUrl.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <SidebarProvider>
        <NetworkStatusProvider>
          <VersionUpdate />
          <App />
          <NetworkStatusBanner />
          <Toaster position="top-center" duration={3000} dismissible />
          <SpeedInsights />
        </NetworkStatusProvider>
      </SidebarProvider>
    </Provider>
  </StrictMode>
);
