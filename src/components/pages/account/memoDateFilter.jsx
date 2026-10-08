import moment from "moment";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All dates" },
  { value: "today", label: "Today" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

export function getTodayDateRange() {
  const today = moment().format("YYYY-MM-DD");
  return { dateRange: "today", dateFrom: today, dateTo: today };
}

export function resolvePresetRange(value, current = {}) {
  const today = moment();
  if (value === "all") {
    return { dateFrom: "", dateTo: "" };
  }
  if (value === "today") {
    const day = today.format("YYYY-MM-DD");
    return { dateFrom: day, dateTo: day };
  }
  if (value === "this_month") {
    return {
      dateFrom: today.clone().startOf("month").format("YYYY-MM-DD"),
      dateTo: today.clone().endOf("month").format("YYYY-MM-DD"),
    };
  }
  if (value === "last_month") {
    const last = today.clone().subtract(1, "month");
    return {
      dateFrom: last.clone().startOf("month").format("YYYY-MM-DD"),
      dateTo: last.clone().endOf("month").format("YYYY-MM-DD"),
    };
  }
  if (value === "this_year") {
    return {
      dateFrom: today.clone().startOf("year").format("YYYY-MM-DD"),
      dateTo: today.clone().endOf("year").format("YYYY-MM-DD"),
    };
  }
  return {
    dateFrom: current.dateFrom || "",
    dateTo: current.dateTo || "",
  };
}

const NAMED_PRESETS = ["today", "this_month", "last_month", "this_year"];

/** Resolve a URL date filter. Missing params mean today. */
export function inferDateRange(rangeParam, from, to) {
  if (rangeParam === "all") {
    return { dateRange: "all", dateFrom: "", dateTo: "" };
  }
  if (rangeParam === "custom") {
    return { dateRange: "custom", dateFrom: from || "", dateTo: to || "" };
  }
  if (NAMED_PRESETS.includes(rangeParam)) {
    return { dateRange: rangeParam, ...resolvePresetRange(rangeParam) };
  }
  if (!from && !to) return getTodayDateRange();
  const today = getTodayDateRange();
  if (from === today.dateFrom && to === today.dateTo) return today;
  for (const preset of ["this_month", "last_month", "this_year"]) {
    const resolved = resolvePresetRange(preset);
    if (from === resolved.dateFrom && to === resolved.dateTo) {
      return { dateRange: preset, ...resolved };
    }
  }
  return { dateRange: "custom", dateFrom: from || "", dateTo: to || "" };
}

export function writeDateRangeParams(params, { dateRange, dateFrom, dateTo }) {
  params.delete("allDates");
  if (dateRange === "all") {
    params.set("dateRange", "all");
    params.delete("fromDate");
    params.delete("toDate");
    return;
  }
  if (!dateRange || dateRange === "today") params.delete("dateRange");
  else params.set("dateRange", dateRange);
  if (dateFrom) params.set("fromDate", dateFrom);
  else params.delete("fromDate");
  if (dateTo) params.set("toDate", dateTo);
  else params.delete("toDate");
}

export function memoInDateRange(memo, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const memoDate = memo?.date ? moment(memo.date).startOf("day") : null;
  if (!memoDate || !memoDate.isValid()) return false;
  if (dateFrom && memoDate.isBefore(moment(dateFrom).startOf("day"))) return false;
  if (dateTo && memoDate.isAfter(moment(dateTo).endOf("day"))) return false;
  return true;
}

export function MemoDateRangeFilter({
  dateRange,
  dateFrom,
  dateTo,
  onRangeChange,
  onFromChange,
  onToChange,
}) {
  return (
    <>
      <div className="w-full sm:w-44">
        <Select value={dateRange} onValueChange={onRangeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Today" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {dateRange === "custom" && (
        <div className="flex w-full gap-2 sm:w-auto">
          <input
            type="date"
            className="form-control h-9"
            value={dateFrom}
            onChange={(e) => onFromChange(e.target.value)}
            aria-label="From date"
          />
          <input
            type="date"
            className="form-control h-9"
            value={dateTo}
            onChange={(e) => onToChange(e.target.value)}
            aria-label="To date"
          />
        </div>
      )}
    </>
  );
}
