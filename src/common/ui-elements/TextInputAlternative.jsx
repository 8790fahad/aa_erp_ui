import React from "react";
import {  InputGroup,FormControl } from "react-bootstrap";
// import { secondaryColor } from "../../variables";

function TextInput(props) {
  const { label } = props;

  return (
    <InputGroup>
      <InputGroup.Text className="font-weight-bold">{label}</InputGroup.Text>
      <FormControl
        className="form-control-alternative"
        // style={{ border: `1px solid ${secondaryColor}`, ...props.style }}
        {...props}
      />
    </InputGroup>
  );
}

export default TextInput;
