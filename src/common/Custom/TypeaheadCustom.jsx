/* eslint-disable react/prop-types */
import React, { useId } from "react";
import { Typeahead } from "react-bootstrap-typeahead";

function TypeaheadCustom(props) {
  const {
    label,
    labelKey = "name",
    options = [],
    _ref = null,
    inline = false,
    fixed = false,
    flip = false,
    selected,
    allowNew = false,
    id: idProp,
    ...rest
  } = props;

  const reactId = useId();
  const id = idProp || `typeahead-${reactId}`;
  const resolvedLabelKey =
    allowNew && typeof labelKey === "function"
      ? "name"
      : labelKey || "name";

  return (
    <div>
      {label && (
        <label
          className={
            inline ? "col-md-2 m-0 p-0 font-weight-bold mb-1" : ""
          }
        >
          {label}
        </label>
      )}

      <Typeahead
        {...rest}
        id={id}
        ref={_ref}
        options={options}
        labelKey={resolvedLabelKey}
        positionFixed={fixed}
        flip={flip}
        allowNew={allowNew}
        {...(Array.isArray(selected) ? { selected } : {})}
      />
    </div>
  );
}

export default TypeaheadCustom;
