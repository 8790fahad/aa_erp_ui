import React from "react";
import { Form } from "react-bootstrap";

function SelectInput(props) {
  const { label, options, className } = props;
  return (
    <Form.Group controlId="">
      {label && label !== "" ? <Form.Label>{label}</Form.Label> : null}
      <Form.Control as="select" {...props}>
        <option>--select--</option>
        {options.map((item, index) => (
          <option key={index} value={item}>
            {item}
          </option>
        ))}
      </Form.Control>
    </Form.Group>
  );
}

export default SelectInput;
