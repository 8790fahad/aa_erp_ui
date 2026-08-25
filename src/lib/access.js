/** Shared privilege checks for sidebar, Home, and Quick create. */

export function parseAccessList(value, fallback = []) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return fallback;
}

export function getUserFunctionalities(user, activeBusiness) {
  return parseAccessList(
    activeBusiness?.functionalities,
    parseAccessList(user?.functionalities),
  );
}

/**
 * Privilege gate for permission-based UI.
 * - "Admin" in the list → full access
 * - No privileges assigned → no access
 * - Item with no privilege keys → no access
 */
export function canAccessPrivileges(privileges, functionalities) {
  if (!functionalities?.length) return false;
  if (
    functionalities.includes("Admin") ||
    functionalities.includes("Administrator")
  ) {
    return true;
  }
  const keys = Array.isArray(privileges)
    ? privileges.filter(Boolean)
    : privileges
      ? [privileges]
      : [];
  if (!keys.length) return false;
  return keys.some((key) => functionalities.includes(key));
}

export function privilegeKeysForItem(item) {
  if (!item) return [];
  if (Array.isArray(item.functionality) && item.functionality.length) {
    return item.functionality;
  }
  if (item.functionality) return [item.functionality];
  if (Array.isArray(item.privileges) && item.privileges.length) {
    return item.privileges;
  }
  if (item.privileges) return [item.privileges];
  // Fallback to title only when explicitly allowed by caller
  return item.title ? [item.title] : [];
}
