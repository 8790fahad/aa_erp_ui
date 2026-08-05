import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
// import "bootstrap/dist/css/bootstrap.min.css";
import { SidebarProvider } from "./components/ui/sidebar.jsx";
import { Provider } from "react-redux";
import store from "./redux/store.js";

import { Toaster } from "./components/ui/sonner.jsx";

import { SpeedInsights } from "@vercel/speed-insights/react"
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <SidebarProvider>
        <App />
        <Toaster position="top-center" duration={3000} dismissible />
        <SpeedInsights />
      </SidebarProvider>
    </Provider>
  </StrictMode>
);
