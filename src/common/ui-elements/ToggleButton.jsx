import React from "react";
import { ToggleButton as ToggleButtonn } from "react-bootstrap";
import { ButtonGroup } from "react-bootstrap";

function ToggleButton(props) {
  const [checked, setChecked] = React.useState(false);
  const [radioValue, setRadioValue] = React.useState("1");

  const radios = [{ name: "Active", value: "1" }];

  return (
    <>
      <label className="">{props.label}</label>
      <div className="custom-control custom-switch">
        <input
          type="checkbox"
          className="custom-control-input"
          id="customSwitch1"
        />
        <label className="custom-control-label" for="customSwitch1">
          {props.value}
        </label>
      </div>
    </>
  );
}
export default ToggleButton;
