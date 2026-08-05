import React from "react";
import { InputGroup, FormControl } from "react-bootstrap";
// import { secondaryColor } from "../../variables";

function FileInput(props) {
  const { label } = props;

  return (
    <InputGroup>
      <InputGroup.Text className="font-weight-bold">{label}</InputGroup.Text>
      <FormControl type="file" {...props} />
    </InputGroup>
  );
}

export default FileInput;
