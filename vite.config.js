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
    chunkSizeWarningLimit: 1000,
    commonjsOptions: {
      transformMixedEsModules: true, // Ensure CommonJS modules are properly transformed
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
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
