/**
 * Utility functions for safe number parsing and formatting
 */

/**
 * Safely parses a value to a number, handling string conversion and validation
 * Removes any non-numeric characters except digits, dots, and minus signs
 * @param {any} value - The value to parse
 * @param {number} defaultValue - Default value to return if parsing fails (default: 0)
 * @returns {number} - Parsed number or defaultValue
 */
export const safeParseFloat = (value, defaultValue = 0) => {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  const valueStr = String(value);
  const cleanedValue = valueStr.replace(/[^\d.-]/g, "");
  const parsed = parseFloat(cleanedValue);

  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Safely parses a value to an integer
 * @param {any} value - The value to parse
 * @param {number} defaultValue - Default value to return if parsing fails (default: 0)
 * @returns {number} - Parsed integer or defaultValue
 */
export const safeParseInt = (value, defaultValue = 0) => {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  const valueStr = String(value);
  const cleanedValue = valueStr.replace(/[^\d.-]/g, "");
  const parsed = parseInt(cleanedValue, 10);

  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Formats a number as currency with proper locale formatting
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code (default: 'NGN')
 * @param {string} locale - Locale string (default: 'en-NG')
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (amount, currency = "NGN", locale = "en-NG") => {
  const safeAmount = safeParseFloat(amount);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
  }).format(safeAmount);
};

 export const formatNumberWithCommas = (value) => {
    if (!value) return "";
    // Remove any existing commas and non-numeric characters except decimal point
    const numericValue = value.toString().replace(/[^\d.]/g, "");
    // Split by decimal point
    const parts = numericValue.split(".");
    // Add commas to the integer part
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

   export  const parseFormattedNumber = (value) => {
    if (!value) return "";
    return value.toString().replace(/,/g, "");
  };

/**
 * Formats a number with locale-specific number formatting
 * @param {number} number - The number to format
 * @param {number} minimumFractionDigits - Minimum decimal places (default: 0)
 * @param {number} maximumFractionDigits - Maximum decimal places (default: 2)
 * @returns {string} - Formatted number string
 */
export const formatNumber = (
  number,
  minimumFractionDigits = 0,
  maximumFractionDigits = 2
) => {
  const safeNumber = safeParseFloat(number);
  return safeNumber.toLocaleString(undefined, {
    minimumFractionDigits,
    maximumFractionDigits,
  });
};

/**
 * Converts a number to words (Nigerian English format)
 * @param {number} num - The number to convert
 * @returns {string} - Number in words
 */
export const numberToWords = (num) => {
  let safeNum = safeParseInt(num);

  if (safeNum === 0) return "Zero";
  if (safeNum < 0) return "Negative " + numberToWords(-safeNum);

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
  ];
  const teens = [
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const scales = ["", "Thousand", "Million", "Billion", "Trillion"];

  function convertHundreds(n) {
    let result = "";

    if (n > 99) {
      result += ones[Math.floor(n / 100)] + " Hundred";
      n %= 100;
      if (n > 0) result += " and ";
    }

    if (n > 19) {
      result += tens[Math.floor(n / 10)];
      n %= 10;
      if (n > 0) result += "-" + ones[n].toLowerCase();
    } else if (n > 9) {
      result += teens[n - 10];
    } else if (n > 0) {
      result += ones[n];
    }

    return result;
  }

  if (safeNum === 0) return "Zero";

  let result = "";
  let scaleIndex = 0;

  while (safeNum > 0) {
    const chunk = safeNum % 1000;
    if (chunk !== 0) {
      let chunkWords = convertHundreds(chunk);
      if (scaleIndex > 0) {
        chunkWords += " " + scales[scaleIndex];
      }
      if (result) {
        result = chunkWords + ", " + result;
      } else {
        result = chunkWords;
      }
    }
    safeNum = Math.floor(safeNum / 1000);
    scaleIndex++;
  }

  return result + " Naira Only";
};

/**
 * Calculates total earnings from allowances and basic salary
 */
export const calculateTotalEarnings = (allowances, basic) => {
  let total = parseFloat(basic) || 0;
  if (!allowances) return total;
  
  const parsedAllowances = typeof allowances === "string" ? JSON.parse(allowances) : allowances;
  
  Object.values(parsedAllowances).forEach((val) => {
    if (val && val.toString().includes("%")) {
      total += (parseFloat(val.toString().replace("%", "")) / 100) * (parseFloat(basic) || 0);
    } else {
      total += parseFloat(val) || 0;
    }
  });
  return total;
};

/**
 * Calculates total deductions including statutory rates
 */
export const calculateTotalDeductions = (deductions, basic, payeRate = 0, pensionRate = 0) => {
  let total = 0;
  if (deductions) {
    const parsedDeductions = typeof deductions === "string" ? JSON.parse(deductions) : deductions;
    Object.values(parsedDeductions).forEach((val) => {
      if (val && val.toString().includes("%")) {
        total += (parseFloat(val.toString().replace("%", "")) / 100) * (parseFloat(basic) || 0);
      } else {
        total += parseFloat(val) || 0;
      }
    });
  }
  // Statutory (currently treated as absolute money values as requested)
  total += (parseFloat(payeRate) || 0);
  total += (parseFloat(pensionRate) || 0);
  return total;
};
