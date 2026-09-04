// export default SearchCustomerInput;
/* eslint-disable react/prop-types */
import { getCustomers } from "@/redux/actions/customer";
import { useCallback, useEffect, useId, useMemo } from "react";
import { Typeahead } from "react-bootstrap-typeahead";
import { useDispatch, useSelector } from "react-redux";
import { customerKindLabel } from "@/utils/customerKind";

function SearchCustomerInput(props) {
  const dispatch = useDispatch();
  const typeaheadId = useId();
  const options = useSelector((state) => state.customer.customerList) || [];
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

  const getList = useCallback(() => {
    dispatch(getCustomers());
  }, [dispatch]);

  useEffect(() => {
    getList();
  }, [getList]);

  const labelKeyFn = useCallback((row) => {
    if (!row) return "";
    const name = row.fullname || row.customerName || row.name;
    if (typeof name === "string" && name.trim()) return name.trim();
    return row.customerNo != null ? String(row.customerNo) : "";
  }, []);

  const validOptions = useMemo(() => {
    return (options || []).filter((opt) => {
      if (!opt || opt.customerNo == null) return false;
      return labelKeyFn(opt).length > 0;
    });
  }, [options, labelKeyFn]);

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
    const fromStore = validOptions.find(
      (o) => String(o.customerNo) === id
    );
    return fromStore ? [fromStore] : list;
  }, [selected, validOptions]);

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
      <Typeahead
        id={controlId}
        disabled={disabled}
        options={validOptions}
        className="z-100"
        placeholder="Select Customer"
        labelKey={labelKeyFn}
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
