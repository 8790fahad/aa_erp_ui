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

/**
 * App brand colors for payroll / HR chrome.
 * Prefer CSS variables so UI stays aligned with the shell theme
 * (do not use per-business primary_color for app chrome).
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
