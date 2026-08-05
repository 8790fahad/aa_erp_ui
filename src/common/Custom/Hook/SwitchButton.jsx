/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import { Pane, Switch } from "evergreen-ui";
import React, { useState } from "react";
import { useSelector } from "react-redux";
import Label from "reactstrap/lib/Label";

export default function SwitchButton({
  col = 4,
  label = "",
  setState,
  name = "",
  value = "",
}) {
  const [toggle, setToggle] = useState(false);

  const handleChange = () => {
    setToggle(!toggle);
    if (!toggle) {
      setState((prev) => ({ ...prev, [name]: true }));
    } else {
      setState((prev) => ({ ...prev, [name]: false }));
    }
  };
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  return (
    <div>
      {/* <Col md={col}> */}
      <div className="d-flex ">
        <Label style={{ margin: "7px" }}>{label}</Label>
        <Pane
          style={{
            borderWidth: 2,
            borderColor: activeBusiness?.primary_color,
          }}
        >
          <Switch
            margin={2}
            checked={toggle}
            height={25}
            name={name}
            value={value}
            onChange={handleChange}
          />
        </Pane>
      </div>
      {/* </Col> */}
    </div>
  );
}
