/** Client-side copy of login-hours rules (must match aa_erp_api/src/services/loginHours.js). */

function parseHhMm(value, fallback = "08:00") {
  const raw = String(value || fallback).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  const source = match ? raw : String(fallback);
  const parts = source.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/) || ["", "8", "00"];
  let hour = Math.min(23, Math.max(0, parseInt(parts[1], 10) || 0));
  if (hour === 24) hour = 0;
  const minute = Math.min(59, Math.max(0, parseInt(parts[2], 10) || 0));
  return {
    hour,
    minute,
    mins: hour * 60 + minute,
    label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

function getNowPartsInTimezone(timeZone = "Africa/Lagos", now = new Date()) {
  const tz = timeZone || "Africa/Lagos";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    let hour = parseInt(get("hour"), 10);
    if (!Number.isFinite(hour) || hour === 24) hour = 0;
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      hour,
      minute: parseInt(get("minute"), 10) || 0,
      second: parseInt(get("second"), 10) || 0,
      timeZone: tz,
    };
  } catch (_) {
    return {
      date: now.toISOString().slice(0, 10),
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds(),
      timeZone: "local",
    };
  }
}

function isWithinBusinessHours(openMins, closeMins, nowMins) {
  if (openMins === closeMins) return true;
  if (openMins < closeMins) {
    return nowMins >= openMins && nowMins < closeMins;
  }
  return nowMins >= openMins || nowMins < closeMins;
}

function isTruthyFlag(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function userAllowsAfterHoursLogin(user) {
  const value = user?.allow_after_hours_login;
  if (value === false || value === 0 || value === "0" || value === "false") {
    return false;
  }
  if (value === true || value === 1 || value === "1" || value === "true") {
    return true;
  }
  return false;
}

export function evaluateLoginHours(business, user, now = new Date()) {
  if (!isTruthyFlag(business?.login_hours_enabled)) {
    return { allowed: true, afterHours: false };
  }

  const opening = parseHhMm(business.login_opening_time, "08:00");
  const closing = parseHhMm(business.login_closing_time, "17:00");
  const parts = getNowPartsInTimezone(
    business.login_hours_timezone || "Africa/Lagos",
    now,
  );
  const nowMins = parts.hour * 60 + parts.minute;
  const inHours = isWithinBusinessHours(opening.mins, closing.mins, nowMins);

  if (inHours) {
    return { allowed: true, afterHours: false, opening, closing, parts };
  }

  if (userAllowsAfterHoursLogin(user)) {
    return { allowed: true, afterHours: true, opening, closing, parts };
  }

  return {
    allowed: false,
    afterHours: true,
    opening,
    closing,
    parts,
    code: "LOGIN_HOURS",
    message: `Business hours are ${opening.label}–${closing.label} (${parts.timeZone}). You cannot sign in until opening time.`,
  };
}

export function msUntilForcedLogout(business, user, now = new Date()) {
  if (!isTruthyFlag(business?.login_hours_enabled)) return null;
  if (userAllowsAfterHoursLogin(user)) return null;

  const opening = parseHhMm(business.login_opening_time, "08:00");
  const closing = parseHhMm(business.login_closing_time, "17:00");
  const parts = getNowPartsInTimezone(
    business.login_hours_timezone || "Africa/Lagos",
    now,
  );
  const nowMins = parts.hour * 60 + parts.minute;
  const inHours = isWithinBusinessHours(opening.mins, closing.mins, nowMins);
  if (!inHours) return 0;

  const nowSecs = parts.hour * 3600 + parts.minute * 60 + (parts.second || 0);
  const closeSecs = closing.hour * 3600 + closing.minute * 60;
  let delta = closeSecs - nowSecs;
  if (delta <= 0 && opening.mins > closing.mins && nowMins >= opening.mins) {
    delta = closeSecs + 24 * 3600 - nowSecs;
  }
  return Math.max(0, delta * 1000);
}

export function normalizeTimeInput(value, fallback = "08:00") {
  return parseHhMm(value, fallback).label;
}

export const LOGIN_HOURS_ENDED_EVENT = "aa-login-hours-ended";
export const LOGIN_HOURS_REFRESH_EVENT = "aa-login-hours-refresh";
