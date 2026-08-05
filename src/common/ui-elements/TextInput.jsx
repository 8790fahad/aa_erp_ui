import { checkStrEmpty } from "@/utilities";
import React from "react";
import { Form } from "react-bootstrap";

// import { secondaryColor } from "../../variables";

function TextInput(props) {
  const { label, required = false, className } = props;

  return (
    <Form.Group>
      {!checkStrEmpty(label) && (
        <Form.Label>
          {label}
          {required && <span className="text-danger">*</span>}
        </Form.Label>
      )}

      <Form.Control {...props} />
    </Form.Group>
  );
}

export default TextInput;
