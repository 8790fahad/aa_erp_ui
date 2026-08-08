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
        // Avoid fine-grained manualChunks: splitting react-bootstrap/antd/redux/etc.
        // produced circular ESM graphs and blank-page TDZ crashes in production
        // ("Cannot access 'w' before initialization", antd reading React.version).
        // Only isolate heavy leaf libs that do not share init cycles with React.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("exceljs") || id.includes("node_modules/xlsx")) {
            return "excel";
          }
          if (id.includes("jspdf") || id.includes("html2canvas")) {
            return "pdf";
          }
          if (
            id.includes("node_modules/three/") ||
            id.includes("node_modules/three\\")
          ) {
            return "three";
          }
          return "vendor";
        },
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
