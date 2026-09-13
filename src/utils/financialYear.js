import moment from "moment";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Normalize FY start month to 1–12 (default January). */
export function getFinancialYearStartMonth(businessOrMonth) {
  const raw =
    typeof businessOrMonth === "number" || typeof businessOrMonth === "string"
      ? businessOrMonth
      : businessOrMonth?.financial_year_start_month;
  const n = parseInt(raw, 10);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  return 1;
}

export function monthName(month) {
  const m = getFinancialYearStartMonth(month);
  return MONTH_NAMES[m - 1];
}

/**
 * Financial year that contains `referenceDate`.
 * Label uses start year when calendar FY, otherwise "YYYY/YY".
 */
export function getFinancialYearForDate(
  startMonthInput,
  referenceDate = new Date(),
) {
  const startMonth = getFinancialYearStartMonth(startMonthInput);
  const ref = moment(referenceDate);
  if (!ref.isValid()) {
    return getFinancialYearForDate(startMonth, new Date());
  }

  let startYear = ref.year();
  if (ref.month() + 1 < startMonth) {
    startYear -= 1;
  }

  const from = moment({
    year: startYear,
    month: startMonth - 1,
    day: 1,
  }).startOf("day");
  const to = from.clone().add(1, "year").subtract(1, "day").endOf("day");

  const label =
    startMonth === 1
      ? String(startYear)
      : `${startYear}/${String(startYear + 1).slice(-2)}`;

  return {
    startMonth,
    startYear,
    label,
    fromDate: from.format("YYYY-MM-DD"),
    toDate: to.format("YYYY-MM-DD"),
    asOfDate: moment.min(to, moment()).format("YYYY-MM-DD"),
  };
}

/** FY whose start year equals `startYear`. */
export function getFinancialYearByStartYear(startMonthInput, startYear) {
  const startMonth = getFinancialYearStartMonth(startMonthInput);
  const year = parseInt(startYear, 10);
  const from = moment({ year, month: startMonth - 1, day: 1 }).startOf("day");
  const to = from.clone().add(1, "year").subtract(1, "day").endOf("day");
  const label =
    startMonth === 1
      ? String(year)
      : `${year}/${String(year + 1).slice(-2)}`;
  return {
    startMonth,
    startYear: year,
    label,
    fromDate: from.format("YYYY-MM-DD"),
    toDate: to.format("YYYY-MM-DD"),
    asOfDate: moment.min(to, moment()).format("YYYY-MM-DD"),
  };
}

/** List of FY options around today (past years + current + next). */
export function listFinancialYearOptions(
  startMonthInput,
  yearsBack = 6,
  yearsForward = 1,
) {
  const current = getFinancialYearForDate(startMonthInput, new Date());
  const options = [];
  for (
    let y = current.startYear + yearsForward;
    y >= current.startYear - yearsBack;
    y -= 1
  ) {
    options.push(getFinancialYearByStartYear(startMonthInput, y));
  }
  return options;
}

export function describeFinancialYear(startMonthInput) {
  const startMonth = getFinancialYearStartMonth(startMonthInput);
  const start = monthName(startMonth);
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const end = monthName(endMonth);
  if (startMonth === 1) {
    return `Calendar year (${start} – ${end})`;
  }
  return `${start} – ${end}`;
}

export { MONTH_NAMES };
