import React from "react";
import { InputGroup } from "react-bootstrap";
// import { themeClass } from "../../variables";

function Checkbox(props) {
  const { container = "", label = "", key = "1" } = props;

  return (
    <div className={`custom-control custom-checkbox mb-3 ${container}`}>
      <InputGroup.Checkbox
        className="custom-control-input"
        id={`${props.label}${props.name}-${key}`}
        type="checkbox"
      />
      <label
        className="custom-control-label"
        htmlFor={`${props.label}${props.name}-${key}`}
      >
        <span>{label}</span>
      </label>
    </div>
  );
}

export default Checkbox;
