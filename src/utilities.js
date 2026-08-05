import moment from "moment";
import { _fetchApi } from "@/redux/actions/api";

export const formatNumber = (num) => {
  if (num === null || num === undefined || num === "") return "0";
  const str = String(num);
  const parts = str.split(".");
  if (parts.length > 1) {
    // Format only the integer part; leave decimal part as-is (no commas)
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }
  return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

/**
 * Journal entry DR/CR amount formatting (same as account JournalEntryForm).
 * Comma thousands on the integer part; preserves an in-progress trailing ".".
 */
export function formatNumberWithCommas(value) {
  if (!value || value === "") return "";

  const numericValue = value.replace(/[^0-9.]/g, "");

  const endsWithDot = numericValue.endsWith(".");

  const parts = numericValue.split(".");
  const integerPart = parts[0] || "";
  const decimalPart = parts[1] || "";

  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (decimalPart) {
    return `${formattedInteger}.${decimalPart}`;
  } else if (endsWithDot && integerPart) {
    return `${formattedInteger}.`;
  } else {
    return formattedInteger;
  }
}

/** Strip commas; parseFloat-friendly numeric string (journal DR/CR). */
export function parseNumberFromFormatted(value) {
  if (!value || value === "") return "";
  return value.replace(/,/g, "");
}

/** While typing journal debit/credit amounts: digits, commas, dot. */
export function filterJournalAmountInput(value) {
  return value.replace(/[^0-9.,]/g, "");
}

export function checkStrEmpty(str) {
  return !(str && str.length > 1 && str.split(" ").join("").length > 0);
}
// export function checkStrEmpty(str) {
//   return !(str && str.length > 1 && str.split(" ").join("").length > 0);
// }

export function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export const today = moment().format("YYYY-MM-DD");

/** Earliest allowed posting date (general ledger / journals). */
export const POSTING_DATE_MIN = "2025-01-01";

export function getPostingDateMax() {
  return moment().format("YYYY-MM-DD");
}

/** Returns an error message string, or null when valid. */
export function validatePostingDateClient(dateStr, { field = "Date" } = {}) {
  if (!dateStr || String(dateStr).trim() === "") {
    return `${field} is required`;
  }
  const normalized = String(dateStr).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return `${field} must be a valid date (YYYY-MM-DD)`;
  }
  if (normalized < POSTING_DATE_MIN) {
    return `${field} cannot be before 1 January 2025`;
  }
  if (normalized > getPostingDateMax()) {
    return `${field} cannot be in the future`;
  }
  return null;
}
export const convertSignedMoney = (amt) => {
  if (parseInt(amt) < 0) return `(${formatNumber(Math.abs(amt))})`;
  else if (parseInt(amt) > 0) return `${formatNumber(amt)}`;
};

export function unflatten(arr) {
  var tree = [],
    mappedArr = {};

  for (let i = 0; i < arr.length; i++) {
    let item = arr[i];
    mappedArr[item.head] = { ...item, children: [] }; // Ensure `children` array exists
  }

  for (let key in mappedArr) {
    let node = mappedArr[key];

    if (node.subhead && mappedArr[node.subhead]) {
      // ✅ Only add as a child if parent exists
      mappedArr[node.subhead].children.push(node);
    } else {
      // ✅ If no parent, add to root tree
      tree.push(node);
    }
  }

  return tree;
}

/**
 * Convert flat array of accounts (with hierarchical head like 1010, 1210)
 * into a nested tree structure using only the `head` field.
 *
 * Works perfectly with your new 4-digit system:
 *   1     → root
 *   10    → parent
 *   1010  → child of 10
 *   12    → parent
 *   1210  → child of 12
 */
/**
 * Converts a flat list of accounts (with clean hierarchical `head` like "1010", "1210")
 * into a properly nested tree structure — NO subhead column needed.
 *
 * Perfectly handles:
 *   1 → 10 → 1010
 *   1 → 12 → 1210
 *   1200 → 120 → 12 → 1  (trailing zeros correctly collapsed)
 *
 * @param {Array} accounts - Array of account objects with `head` (string) and other fields
 * @returns {Array} Tree of root accounts (1, 2, 3, 4, 5) with nested children
 */
export function unflattenAccount(accounts) {
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return [];
  }

  const map = new Map();
  const roots = [];

  // Step 1: Clone all accounts into map with empty children array
  for (const acc of accounts) {
    // Support both 'head' and 'code' field names, and 'subhead'/'parent_code' for parent
    const head = acc.head || acc.code;
    if (!head) continue;

    const headStr = String(head).trim();
    map.set(headStr, {
      ...acc,
      head: headStr, // Ensure head is always set
      children: [], // Always initialize children as array
    });
  }

  // Step 2: Link each account to its parent using subhead (parent_code) if available,
  // otherwise use head prefix logic
  for (const acc of accounts) {
    const head = acc.head || acc.code;
    if (!head) continue;

    const headStr = String(head).trim();
    const node = map.get(headStr);
    if (!node) continue;

    // First try to use subhead/parent_code if available
    const subhead = acc.subhead || acc.parent_code || acc.parentCode;
    if (subhead) {
      const subheadStr = String(subhead).trim();
      if (map.has(subheadStr)) {
        map.get(subheadStr).children.push(node);
        continue;
      }
    }

    // If no subhead, use head prefix logic for hierarchical codes
    // Root level: single digit (1, 2, 3, 4, 5) or if no parent found
    if (headStr.length === 1) {
      roots.push(node);
      continue;
    }

    // Find parent by progressively removing last digit(s)
    let parentHead = headStr;
    while (parentHead.length > 1) {
      parentHead = parentHead.slice(0, -1); // Remove last digit

      // Stop if we find an existing parent in the map
      if (map.has(parentHead)) {
        map.get(parentHead).children.push(node);
        break;
      }
    }

    // If no parent found, treat as root
    if (parentHead.length <= 1 && !map.has(parentHead)) {
      roots.push(node);
    }
  }

  // Step 3: Sort all children recursively for perfect natural order
  const sortTree = (node) => {
    if (Array.isArray(node.children) && node.children.length > 0) {
      node.children.sort((a, b) => {
        const aHead = (a.head || "").toString();
        const bHead = (b.head || "").toString();
        return aHead.localeCompare(bHead);
      });
      node.children.forEach(sortTree);
    }
  };

  roots.forEach(sortTree);

  // Final sort of roots (1 → 2 → 3 → 4 → 5)
  roots.sort((a, b) => {
    const aHead = (a.head || "").toString();
    const bHead = (b.head || "").toString();
    return aHead.localeCompare(bHead);
  });

  return roots;
}

export function unflattenBalance(arr) {
  const tree = [];
  const mappedArr = {};

  // Step 1: Map all items by head
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    mappedArr[item.head] = {
      ...item,
      children: [],
      balance: item.balance || 0,
    };
  }

  // Step 2: Build the tree structure
  for (let key in mappedArr) {
    const node = mappedArr[key];
    if (node.subhead && mappedArr[node.subhead]) {
      mappedArr[node.subhead].children.push(node);
    } else {
      tree.push(node);
    }
  }

  // Step 3: Recursive function to aggregate balances from children
  function aggregateBalance(node) {
    if (!node.children.length) return node.balance;
    const childrenBalance = node.children.reduce((sum, child) => {
      return sum + aggregateBalance(child);
    }, 0);
    node.balance += childrenBalance;
    return node.balance;
  }

  // Step 4: Aggregate for all root nodes
  for (const root of tree) {
    aggregateBalance(root);
  }

  return tree;
}

// Receipt generator
export function generateReceiptNo(callback) {
  const today = moment().format("DDMMYY");
  _fetchApi(
    `/transactions/getNextTransactionID`,
    ({ transactionId }) => {
      _fetchApi(
        `/transactions/getReceiptNo`,
        ({ receiptNo }) => {
          receiptNo = receiptNo ? receiptNo : 1;
          transactionId = transactionId ? transactionId : 1;
          let rec = `${today}${receiptNo}${transactionId}`;
          callback(rec, receiptNo);
        },
        (err) => console.log(err)
      );
    },
    (err) => console.log(err)
  );
}
// end

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

/** Branches from `branches` table: lowest `id` ≈ first created (auto-increment PK). */
export function sortBranchesByFirstCreated(results) {
  if (!Array.isArray(results)) return [];
  return [...results].sort(
    (a, b) => Number(a?.id ?? 0) - Number(b?.id ?? 0),
  );
}

/** Resolve branch select value — defaults to first-created branch when unset/invalid. */
export function resolveDefaultBranchLocationId(
  branchLocationId,
  branchOptions,
) {
  const list = Array.isArray(branchOptions) ? branchOptions : [];
  if (!list.length) return "";
  const raw =
    branchLocationId != null && branchLocationId !== ""
      ? String(branchLocationId)
      : "";
  if (raw && list.some((b) => String(b.id) === raw)) return raw;
  return String(list[0].id);
}

//Access control functions conditioners
export const isAuthenticated = (user) => !!user;

export const hasAccess = (user, rights) =>
  rights.some((right) => user?.accessTo?.includes(right));

export const hasSubAccess = (user, rights) =>
  rights.some((right) => user?.functionalities.includes(right));

export const canUseThis = (user, rights) =>
  rights.some((right) => user.functionalities.includes(right));

export const hasRole = (user, roles) =>
  roles.some((role) => user.roles.includes(role));
// conditioner ending.
