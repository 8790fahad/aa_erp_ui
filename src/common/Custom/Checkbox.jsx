/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React from "react";
import { useSelector } from "react-redux";
import { Input } from "reactstrap";
// import { themeClass } from "variables";

function Checkbox(props) {
  const {
    container = "",
    label = "",
    key = "1",
    checked = false,
    onChange = (f) => f,
  } = props;
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  return (
    <div className={`custom-control custom-checkbox mb-3 ${container}`}>
      <Input
        className="custom-control-input"
        id={`${props.label}${props.name}-${key}`}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{
          borderWidth: 2,
          borderColor: activeBusiness?.primary_color,
          color: activeBusiness?.primary_color,
        }}
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
