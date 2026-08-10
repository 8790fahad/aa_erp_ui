/**
 * Normalize Nigerian phone numbers to MSISDN form: 234XXXXXXXXXX
 * Accepts 080…, 801…, 234…, +234…, 00234…
 */
export function normalizeNigerianPhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) {
    digits = `234${digits.slice(1)}`;
  } else if (!digits.startsWith("234") && digits.length === 10) {
    digits = `234${digits}`;
  }
  return digits;
}

/** Valid Nigerian mobile MSISDN: 234 + 10 digits starting with 7/8/9 */
export function isValidNigerianPhone(phone) {
  const normalized = normalizeNigerianPhone(phone);
  return /^234[789]\d{9}$/.test(normalized);
}

/** Digits for the +234-prefixed input (national part, max 11 with leading 0). */
export function toNationalPhoneInput(phone) {
  const normalized = normalizeNigerianPhone(phone);
  if (/^234\d{10}$/.test(normalized)) return normalized.slice(3);
  return String(phone || "")
    .replace(/\D/g, "")
    .slice(0, 11);
}

/** Restrict live input to digits useful for Nigerian numbers. */
export function sanitizePhoneInput(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 13);
}

export const NIGERIAN_PHONE_HINT =
  "Enter a valid Nigerian phone number (e.g. 8012345678)";
