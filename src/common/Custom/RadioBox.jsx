/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React from "react";
import { useSelector } from "react-redux";
import { Input } from "reactstrap";
// import { themeClass } from "variables";

function RadioBox(props) {
  const { container = "", label = "" } = props;
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  return (
    <div className={`custom-control custom-radio mb-3 ${container}`}>
      {/* {JSON.stringify(activeBusiness)} */}
      <Input
        {...props}
        className="custom-control-input custom-control-input-default"
        id={`${props.label}${props.name}-1`}
        type="radio"
        style={{
          borderWidth: 2,
          borderColor: activeBusiness?.primary_color,
        }}
      />
      <label
        className="custom-control-label font-weight-bold"
        htmlFor={`${props.label}${props.name}-1`}
      >
        {label}
      </label>
    </div>
  );
}

export default RadioBox;
