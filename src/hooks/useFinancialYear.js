import { useMemo } from "react";
import { useSelector } from "react-redux";
import {
  getFinancialYearForDate,
  getFinancialYearStartMonth,
  listFinancialYearOptions,
} from "@/utils/financialYear";

/**
 * Defaults and options for financial-year-aligned report dates.
 */
export default function useFinancialYear() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const startMonth = getFinancialYearStartMonth(activeBusiness);

  const current = useMemo(
    () => getFinancialYearForDate(startMonth, new Date()),
    [startMonth],
  );

  const options = useMemo(
    () => listFinancialYearOptions(startMonth, 8, 1),
    [startMonth],
  );

  return {
    startMonth,
    current,
    options,
    defaultFromDate: current.fromDate,
    defaultToDate: momentMinToday(current.toDate),
    defaultAsOfDate: current.asOfDate,
  };
}

function momentMinToday(isoDate) {
  const today = new Date().toISOString().slice(0, 10);
  return isoDate > today ? today : isoDate;
}
