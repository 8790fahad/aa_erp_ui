import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgVersion = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
).version || "0.0.0";

// GitHub project pages: https://<user>.github.io/aa_erp_ui/
const base = process.env.GITHUB_PAGES === "true" ? "/aa_erp_ui/" : "/";

function appVersionPlugin() {
  let appVersion = "";

  const resolveVersion = (command) => {
    if (command === "build") {
      if (!appVersion || appVersion.endsWith("+dev")) {
        appVersion = `${pkgVersion}+${Date.now().toString(36)}`;
      }
      return appVersion;
    }
    if (!appVersion) appVersion = `${pkgVersion}+dev`;
    return appVersion;
  };

  const versionPayload = () =>
    JSON.stringify({ version: appVersion || `${pkgVersion}+dev`, forceUpdate: true });

  const applyCacheHeaders = (req, res) => {
    const pathOnly = String(req.url || "").split("?")[0];
    const isShell =
      pathOnly === "/" ||
      pathOnly.endsWith("/version.json") ||
      pathOnly.endsWith(".html");
    if (isShell) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return;
    }
    if (pathOnly.includes("/assets/")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  };

  return {
    name: "app-version",
    config(_config, { command }) {
      return {
        define: {
          "import.meta.env.VITE_APP_VERSION": JSON.stringify(resolveVersion(command)),
        },
      };
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: `${versionPayload()}\n`,
      });
    },
    transformIndexHtml(html) {
      const version = appVersion || `${pkgVersion}+dev`;
      if (html.includes('name="app-version"')) return html;
      return html.replace(
        "</head>",
        `    <meta name="app-version" content="${version}" />\n  </head>`,
      );
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathOnly = String(req.url || "").split("?")[0];
        if (!pathOnly.endsWith("/version.json")) {
          next();
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.end(versionPayload());
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        applyCacheHeaders(req, res);
        next();
      });
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    appVersionPlugin(),
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
        target: "http://localhost:42844",
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
