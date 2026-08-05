/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React from "react";
import { Typeahead } from "react-bootstrap-typeahead";
import { useSelector } from "react-redux";

function CustomTypeahead(props) {
  const {
    label,
    labelKey = "",
    options = [],
    _ref = null,
    inline = false,
    className = "",
    edge = false,
    disabled = false
  } = props;
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

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
        id={`${labelKey}-${new Date()}`}
        style={
          props.style || {
            border: edge
              ? "none"
              : `2px solid ${activeBusiness?.primary_color}`,
            borderRadius: 5,
          }
        }
        // className={inline ? 'col-md-10 rounded' : 'rounded'}
        ref={_ref}
        options={options}
        labelKey={labelKey}
        disabled={disabled}
        {...props}
      />
    </div>
  );
}

export default CustomTypeahead;
