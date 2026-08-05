/* eslint-disable no-prototype-builtins */
// const allAvatars = (ctx => {
//   let keys = ctx.keys();
//   return keys.map(ctx);
// })(require.context('./images/avatars', true, /.*/));

import { _fetchApi } from "@/redux/actions/api";
import moment from "moment";
// import { _fetchApi } from "../redux/actions/api";

// export function randomArray(arr) {
//   const index = Math.round(Math.random() * (arr.length - 1));
//   return arr[index];
// }

// export function randomAvatar() {
//   return randomArray(allAvatars);
// }

export const formatNumber = (num) => {
  if (num) {
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
  } else {
    return "0";
  }
};

export function formatNumber1(n = 0) {
  if (typeof n !== "number" && typeof n !== "string") {
    return "0";
  }

  // Convert n to a number if it's a string and round it to a certain number of decimal places
  n = parseFloat(n);

  if (isNaN(n)) {
    return "0";
  }

  // Format the number with commas for thousands and round it to two decimal places
  const formattedNumber = n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formattedNumber;
}

export function formatNumber2(n = 0) {
  if (typeof n !== "number" && typeof n !== "string") {
    return "0";
  }

  n = parseFloat(n);

  if (isNaN(n)) {
    return "0";
  }

  // Format number without decimal places
  const formattedNumber = n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return formattedNumber;
}

export const today = moment().format("YYYY-MM-DD");
export const convertSignedMoney = (amt) => {
  if (parseInt(amt) < 0) return `(${formatNumber(Math.abs(amt))})`;
  else if (parseInt(amt) > 0) return `${formatNumber(amt)}`;
};
export function unflatten(arr) {
  var tree = [],
    mappedArr = {},
    arrElem,
    mappedElem;

  // First map the nodes of the array to an object -> create a hash table.
  for (var i = 0, len = arr.length; i < len; i++) {
    arrElem = arr[i];
    mappedArr[arrElem.title] = arrElem;
    mappedArr[arrElem.title]["children"] = [];
  }

  for (var title in mappedArr) {
    if (mappedArr.hasOwnProperty(title)) {
      mappedElem = mappedArr[title];
      // If the element is not at the root level, add it to its parent array of children.
      if (mappedElem.subhead) {
        mappedArr[mappedElem["subhead"]]["children"].push(mappedElem);
      }
      // If the element is at the root level, add it to first level elements array.
      else {
        tree.push(mappedElem);
      }
    }
  }
  return tree;
}
export function generateReceiptNo(callback) {
  // console.log()
  const today = moment().format("DDMMYY");
  _fetchApi(
    `/transactions/getNextTransactionID`,
    ({ transactionId }) => {
      // let txnId = pad(transactionId, 6, 0)
      _fetchApi(
        `/transactions/getReceiptNo`,
        ({ receiptNo }) => {
          receiptNo = receiptNo ? receiptNo : 1;
          transactionId = transactionId ? transactionId : 1;
          // console.log(receiptNo)
          // let rcptNo = pad(receiptNo, 4, 0)
          let rec = `${today}${receiptNo}${transactionId}`;
          callback(rec, receiptNo);
          // const newBalance = this.state.depositForm.balance + this.state.depositForm.amount
          // this.setState(prevState => ({ depositForm: Object.assign({}, prevState.depositForm, { receiptNo: rec, receiptId: receiptNo }) }))
        },
        (err) => console.log(err)
      );
    },
    (err) => console.log(err)
  );
}

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

// export const formatCurrencyInWords = (amount) => {
//   const [naira, kobo] = amount.toString().split(".");

//   const nairaInWords = toWordsconver(naira)?.toUpperCase();
//   const koboInWords =
//     kobo !== "00" ? `${toWordsconver(kobo)} KOBO` : "";

//   return `${nairaInWords} NAIRA ${koboInWords} ONLY`;
// };


export const isAuthenticated = (user) => !!user;

export const hasAccess = (user, rights) =>
  rights.some((right) => user.accessTo.includes(right));

export const hasSubAccess = (user, rights) =>
  rights.some((right) => user.functionalities.includes(right));

export const canUseThis = (user, rights) =>
  rights.some((right) => user.functionalities.includes(right));

export const hasRole = (user, roles) =>
  roles.some((role) => user.roles.includes(role));
