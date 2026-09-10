/** AA ERP brand tokens — keep in sync with `src/index.css` `:root` variables. */
export const AA_NAVY = "#1a2d5e";
export const AA_NAVY_HOVER = "#243a73";
export const AA_ACCENT = "#2c7be5";
export const AA_ACCENT_HOVER = "#1a68d1";
export const AA_SIDEBAR_ACTIVE = "#e8f1fc";
export const AA_SIDEBAR_BG = "#f3f4f7";

function readCssVar(name, fallback) {
  if (typeof window === "undefined" || !window.getComputedStyle) {
    return fallback;
  }
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

export function normalizeHex(hex, fallback = AA_NAVY) {
  const raw = String(hex || "").trim();
  const m = raw.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return fallback;
  let h = m[1];
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return `#${h.toUpperCase()}`;
}

function hexToRgb(hex) {
  const n = normalizeHex(hex).slice(1);
  const num = parseInt(n, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function shadeHex(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const mix = (c) =>
    percent < 0
      ? c + (percent / 100) * c
      : c + (percent / 100) * (255 - c);
  const nr = clamp(mix(r));
  const ng = clamp(mix(g));
  const nb = clamp(mix(b));
  return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1).toUpperCase()}`;
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

/**
 * Push the business primary color onto the CSS tokens the shell already uses
 * (top bar, primary buttons, document headers).
 */
export function applyAaBrandToDocument(primaryHex) {
  if (typeof document === "undefined") return AA_NAVY;
  const primary = normalizeHex(primaryHex, AA_NAVY);
  const useAppNavy = primary.toUpperCase() === AA_NAVY.toUpperCase();
  const hover = useAppNavy ? AA_NAVY_HOVER : shadeHex(primary, -18);
  const accent = useAppNavy ? AA_ACCENT : shadeHex(primary, 22);
  const accentHover = useAppNavy ? AA_ACCENT_HOVER : shadeHex(primary, 8);
  const sidebarActive = useAppNavy
    ? AA_SIDEBAR_ACTIVE
    : shadeHex(primary, 88);
  const { r, g, b } = hexToRgb(primary);
  const { h, s, l } = rgbToHsl({ r, g, b });
  const hsl = (hh, ss, ll) =>
    `${Math.round(hh)} ${Math.round(ss * 100)}% ${Math.round(ll * 100)}%`;

  const root = document.documentElement;
  root.style.setProperty("--aa-navy", primary);
  root.style.setProperty("--aa-navy-hover", hover);
  root.style.setProperty("--aa-doc-header", primary);
  root.style.setProperty("--aa-accent", accent);
  root.style.setProperty("--aa-accent-hover", accentHover);
  root.style.setProperty("--aa-sidebar-active", sidebarActive);
  root.style.setProperty("--bs-primary", primary);
  root.style.setProperty("--bs-primary-rgb", `${r}, ${g}, ${b}`);
  root.style.setProperty("--sidebar-primary", hsl(h, s, l));
  root.style.setProperty("--sidebar-accent", hsl(h, Math.min(1, s + 0.2), 0.95));
  root.style.setProperty(
    "--sidebar-accent-foreground",
    hsl(h, s, Math.max(0.28, l - 0.1)),
  );
  root.style.setProperty("--sidebar-ring", hsl(h, s, l));
  return primary;
}

/**
 * App brand colors for payroll / HR chrome.
 * Prefer CSS variables so UI stays aligned with the shell theme.
 */
export function getAaBrandColors() {
  const primaryColor = readCssVar("--aa-navy", AA_NAVY);
  const accentColor = readCssVar("--aa-accent", AA_ACCENT);
  const navyHover = readCssVar("--aa-navy-hover", AA_NAVY_HOVER);
  const accentHover = readCssVar("--aa-accent-hover", AA_ACCENT_HOVER);
  const sidebarActive = readCssVar("--aa-sidebar-active", AA_SIDEBAR_ACTIVE);
  const sidebarBg = readCssVar("--aa-sidebar-bg", AA_SIDEBAR_BG);

  return {
    primaryColor,
    secondaryColor: navyHover,
    accentColor,
    navyHover,
    accentHover,
    sidebarActive,
    sidebarBg,
    headerGradient: `linear-gradient(to right, ${primaryColor}, ${navyHover})`,
    brandButtonStyle: {
      backgroundColor: primaryColor,
      borderColor: primaryColor,
      color: "#fff",
    },
    appColorStyle: {
      ["--app-primary"]: primaryColor,
      ["--app-secondary"]: navyHover,
      ["--app-accent"]: accentColor,
    },
  };
}
