/* eslint-disable react/prop-types */
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { AsyncTypeahead } from "react-bootstrap-typeahead";
import "react-bootstrap-typeahead/css/Typeahead.css";
import { useSelector } from "react-redux";
import { _fetchApi } from "@/redux/actions/api";
import { customerKindLabel } from "@/utils/customerKind";

function SearchCustomerInput(props) {
  const typeaheadId = useId();
  const facilityId = useSelector((state) => state.auth.activeBusiness?.id);
  const {
    onChange,
    disabled,
    color,
    borderWidth,
    selected,
    id: elId,
    label: labelText,
    ...restProps
  } = props;

  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const requestId = useRef(0);

  const labelKeyFn = useCallback((row) => {
    if (!row) return "";
    const name = row.fullname || row.customerName || row.name;
    if (typeof name === "string" && name.trim()) return name.trim();
    return row.customerNo != null ? String(row.customerNo) : "";
  }, []);

  const selectedForTypeahead = useMemo(() => {
    const list =
      selected == null
        ? []
        : Array.isArray(selected)
          ? selected
          : [selected];
    if (list.length === 0) return [];
    const item = list[0];
    if (!item || item.customerNo == null) return list;
    const id = String(item.customerNo);
    const fromOptions = options.find((o) => String(o.customerNo) === id);
    return fromOptions ? [fromOptions] : list;
  }, [selected, options]);

  const mergedOptions = useMemo(() => {
    const list = (options || []).filter((opt) => {
      if (!opt || opt.customerNo == null) return false;
      return labelKeyFn(opt).length > 0;
    });
    const sel = selectedForTypeahead[0];
    if (
      sel?.customerNo != null &&
      !list.some((o) => String(o.customerNo) === String(sel.customerNo))
    ) {
      return [sel, ...list];
    }
    return list;
  }, [options, selectedForTypeahead, labelKeyFn]);

  const handleSearch = useCallback(
    (query) => {
      if (!facilityId) {
        setOptions([]);
        setIsLoading(false);
        return;
      }
      const id = ++requestId.current;
      setIsLoading(true);
      const params = new URLSearchParams({
        query_type: "search",
        customer: facilityId,
        search: String(query || "").trim(),
        limit: "25",
      });
      _fetchApi(
        `/account/customer-details?${params.toString()}`,
        (data) => {
          if (id !== requestId.current) return;
          setOptions(data?.results || []);
          setIsLoading(false);
        },
        () => {
          if (id !== requestId.current) return;
          setOptions([]);
          setIsLoading(false);
        },
      );
    },
    [facilityId],
  );

  const controlId = elId || `search-customer-${typeaheadId}`;

  return (
    <>
      {labelText ? (
        <label
          htmlFor={controlId}
          className="block text-xs font-medium text-gray-700 mb-1"
        >
          {labelText}
        </label>
      ) : null}
      <AsyncTypeahead
        id={controlId}
        disabled={disabled}
        isLoading={isLoading}
        options={mergedOptions}
        className="z-[300] w-full"
        positionFixed
        placeholder="Type to search customer"
        promptText="Type at least 3 characters"
        searchText="Searching…"
        emptyLabel="No customers found"
        labelKey={labelKeyFn}
        minLength={3}
        delay={250}
        useCache
        filterBy={() => true}
        clearButton
        selected={selectedForTypeahead}
        renderMenuItemChildren={(option) => (
          <div className="py-1">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-slate-800">
                {labelKeyFn(option)}
              </div>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  customerKindLabel(option) === "Walk-in"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {customerKindLabel(option)}
              </span>
            </div>
            <small className="text-slate-600 text-xs">
              Customer ID: {option.customerNo}
            </small>
          </div>
        )}
        onSearch={handleSearch}
        onChange={(selectedItems) => {
          if (!onChange) return;
          onChange(selectedItems?.[0] || null);
        }}
        inputProps={{
          style: { borderColor: color, borderWidth: borderWidth },
        }}
        {...restProps}
      />
    </>
  );
}

export default SearchCustomerInput;
