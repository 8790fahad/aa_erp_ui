# aa_erp_ui

AA ERP frontend (Vite + React).

## GitHub Pages

The app deploys automatically to GitHub Pages on every push to `main`.

- **Live URL:** https://8790fahad.github.io/aa_erp_ui/
- **Workflow:** `.github/workflows/github-pages.yml`

### One-time setup

1. Push this repo to GitHub (`main` branch).
2. In the repo: **Settings → Pages → Build and deployment**
3. Set **Source** to **GitHub Actions**.
4. Re-run the **Deploy Frontend to GitHub Pages** workflow if needed.

### Local production build (Pages base path)

```bash
GITHUB_PAGES=true npm run build
npm run preview
```

Normal local/root hosting still uses `base: "/"` (default `npm run build`).
