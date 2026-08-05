import React from "react";
import { Typeahead } from "react-bootstrap-typeahead";
import { InputGroup } from "react-bootstrap";

function Autocomplete(props) {
  const { required, label, _ref } = props;
  return (
    <InputGroup>
      {label && label !== "" ? (
        <InputGroup.Text className="font-weight-bold">
          {label}
          {required && <span className="text-danger">*</span>}
        </InputGroup.Text>
      ) : null}
      <Typeahead
        id={`${props.label}-12`}
        ref={_ref}
        className={`border border-primary rounded ${props.className}`}
        {...props}
      />
    </InputGroup>
  );
}

export default Autocomplete;
