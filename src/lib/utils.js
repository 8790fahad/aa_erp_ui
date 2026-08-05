import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import accountTypesData from './accountTypes.json';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
export async function onRequestGet() {
  return new Response(JSON.stringify({ msg: "Hello from Cloudflare!" }), {
    headers: { "content-type": "application/json" },
  })
}
export const filterRoutesByAppType = (routes, appType) => {
  return routes
    ?.filter((route) => {
      // If there's no appTypeAccess, default to visible
      return !route.access || route.access.includes(appType);
    })
    .map((route) => ({
      ...route,
      children: route.children
        ? filterRoutesByAppType(route.children, appType)
        : undefined,
    }));
};

export const accountTypes = [
  { code: "00", title: "Default" },
  { code: "10", title: "Savings Account" },
  { code: "20", title: "Current Account" },
];

/**
 * Get all account types
 * @returns {Array} Array of account type objects
 */
export const getAccountTypes = () => {
  return accountTypesData.accountTypes || [];
};

/**
 * Get detail types for a specific account type
 * @param {string} type - The account type (e.g., "Cash and cash equivalents")
 * @returns {Array} Array of detail type objects
 */
export const getDetailTypesByType = (type) => {
  if (!type) return [];
  const accountType = accountTypesData.accountTypes.find(
    (at) => at.type === type
  );
  return accountType?.children || [];
};

/**
 * Get account type by type name
 * @param {string} type - The account type name
 * @returns {Object|null} Account type object or null
 */
export const getAccountTypeByName = (type) => {
  if (!type) return null;
  return accountTypesData.accountTypes.find((at) => at.type === type) || null;
};

/**
 * Get detail type by detail type name
 * @param {string} type - The account type name
 * @param {string} detailType - The detail type name
 * @returns {Object|null} Detail type object or null
 */
export const getDetailTypeByName = (type, detailType) => {
  const detailTypes = getDetailTypesByType(type);
  return detailTypes.find((dt) => dt.detailType === detailType) || null;
};

export function toWordsconver(s) {
  // / System for American Numbering
  var th_val = ["", "thousand", "million", "billion", "trillion"];
  // System for uncomment this line for Number of English
  // var th_val = ['','thousand','million', 'milliard','billion'];

  var dg_val = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
  ];
  var tn_val = [
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  var tw_val = [
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];
  if (s) {
    s = s.toString() || 0;
    s = s.replace(/[\\, ]/g, "");
    if (s != parseInt(s)) return "not a number ";
    var x_val = s.indexOf(".");
    if (x_val == -1) x_val = s.length;
    if (x_val > 15) return "too big";
    var n_val = s.split("");
    var str_val = "";
    var sk_val = 0;
    for (var i = 0; i < x_val; i++) {
      if ((x_val - i) % 3 == 2) {
        if (n_val[i] == "1") {
          str_val += tn_val[Number(n_val[i + 1])] + " ";
          i++;
          sk_val = 1;
        } else if (n_val[i] != 0) {
          str_val += tw_val[n_val[i] - 2] + " ";
          sk_val = 1;
        }
      } else if (n_val[i] != 0) {
        str_val += dg_val[n_val[i]] + " ";
        if ((x_val - i) % 3 == 0) str_val += "hundred ";
        sk_val = 1;
      }
      if ((x_val - i) % 3 == 1) {
        if (sk_val) str_val += th_val[(x_val - i - 1) / 3] + " ";
        sk_val = 0;
      }
    }
    if (x_val != s.length) {
      var y_val = s.length;
      str_val += "point ";
      for (var e = x_val + 1; e < y_val; e++) str_val += dg_val[n_val[e]] + " ";
    }
    return str_val.replace(/\s+/g, " ");
  }
}
