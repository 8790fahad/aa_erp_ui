import React from "react";
import { Form, InputGroup } from "react-bootstrap";
// import { themeClass } from "../../variables";

function RadioBox(props) {
  const { container = "", label = "" } = props;

  return (
    <div className={`${container}`}>
      <div className="custom-control custom-radio">
        <input
          type="radio"
          id={"m-radio" + props.label}
          className="custom-control-input"
          {...props}
        />
        <label
          className="custom-control-label"
          htmlFor={"m-radio" + props.label}
        >
          {label}
        </label>
      </div>
    </div>
  );
}

export default RadioBox;
