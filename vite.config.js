import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// GitHub project pages: https://<user>.github.io/aa_erp_ui/
const base = process.env.GITHUB_PAGES === "true" ? "/aa_erp_ui/" : "/";

export default defineConfig({
  base,
  plugins: [
    react({
      // Ensure React is transpiled for maximum compatibility
      jsxRuntime: 'automatic',
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5175,
    proxy: {
      "/api": {
        target: "http://localhost:42843",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    target: 'es2015', // Single target - ensures all modern syntax is transpiled
    cssTarget: 'chrome80', // CSS compatibility target
    minify: 'esbuild', // Use esbuild minification (respects target setting)
    // GitHub Pages soft-fails files over ~10 MiB (returns 404). Keep chunks under that.
    chunkSizeWarningLimit: 2500,
    commonjsOptions: {
      transformMixedEsModules: true, // Ensure CommonJS modules are properly transformed
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("antd") || id.includes("@ant-design")) return "antd";
          if (id.includes("exceljs") || id.includes("xlsx")) return "excel";
          if (
            id.includes("jspdf") ||
            id.includes("html2canvas") ||
            id.includes("@react-pdf")
          ) {
            return "pdf";
          }
          if (
            id.includes("three") ||
            id.includes("@react-three") ||
            id.includes("troika")
          ) {
            return "three";
          }
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("evergreen-ui")) return "evergreen";
          if (id.includes("react-icons")) return "icons";
          if (
            id.includes("react-bootstrap") ||
            id.includes("bootstrap") ||
            id.includes("reactstrap")
          ) {
            return "bootstrap";
          }
          if (id.includes("moment") || id.includes("date-fns")) return "dates";
          if (id.includes("lucide-react") || id.includes("@radix-ui")) {
            return "ui";
          }
          if (id.includes("redux") || id.includes("react-redux")) return "redux";
          if (id.includes("react-router")) return "router";
          if (id.includes("react-dom") || id.includes("/react/")) return "vendor";
          return "deps";
        },
        // Ensure consistent chunk naming for better caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  esbuild: {
    target: 'es2015', // Ensure esbuild transpiles to ES2015 (removes optional chaining, nullish coalescing, etc.)
    format: 'esm', // Output as ES modules
    legalComments: 'none', // Remove comments for smaller bundle
  },
});
