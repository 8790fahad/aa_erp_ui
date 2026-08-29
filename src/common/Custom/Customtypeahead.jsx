/* eslint-disable react/prop-types */
import React, { useId } from "react";
import { Typeahead } from "react-bootstrap-typeahead";
import { useSelector } from "react-redux";

function CustomTypeahead(props) {
  const {
    label,
    labelKey = "name",
    options = [],
    _ref = null,
    inline = false,
    className = "",
    edge = false,
    disabled = false,
    selected,
    allowNew = false,
    id: idProp,
    style,
    ...rest
  } = props;
  const reactId = useId();
  const id = idProp || `typeahead-${reactId}`;
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const resolvedLabelKey =
    allowNew && typeof labelKey === "function"
      ? "name"
      : labelKey || "name";

  return (
    <div>
      {label && (
        <label
          className={
            inline
              ? `col-md-2 m-0 p-0 font-weight-bold mb-2 ${className}`
              : "mb-2"
          }
        >
          {label}
        </label>
      )}

      <Typeahead
        {...rest}
        id={id}
        style={
          style || {
            border: edge
              ? "none"
              : `2px solid ${activeBusiness?.primary_color}`,
            borderRadius: 5,
          }
        }
        ref={_ref}
        options={options}
        labelKey={resolvedLabelKey}
        disabled={disabled}
        allowNew={allowNew}
        {...(Array.isArray(selected) ? { selected } : {})}
      />
    </div>
  );
}

export default CustomTypeahead;
