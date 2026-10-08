const env = import.meta.env || {};

/** Version baked into this JavaScript bundle at build time. */
export const APP_VERSION = env.VITE_APP_VERSION || "0.0.0+dev";

/** Where to return after a production reload loads a fresh copy of the app. */
export const APP_UPDATE_RETURN_KEY = "aa-erp-update-return";

/**
 * A deployed bundle is stale when /version.json names a different build.
 * forceUpdate: false keeps the prompt off for an optional release.
 */
export function shouldPromptUpdate(localVersion, payload) {
  const serverVersion = String(payload?.version ?? "").trim();
  const current = String(localVersion ?? "").trim();
  if (!serverVersion || serverVersion === current) return false;
  return payload?.forceUpdate !== false;
}
