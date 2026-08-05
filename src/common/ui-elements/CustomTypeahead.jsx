import React from "react";
import { Typeahead } from "react-bootstrap-typeahead";
import { Col, InputGroup } from "react-bootstrap";

export default function CustomTypeahead(props) {
  const {
    options,
    onInputChange,
    onChange,
    labelKey,
    label,
    placeholder,
    col,
    _ref,
  } = props;
  return (
    <>
      <Col md={col || 4}>
        <InputGroup.Text className="font-weight-bold">{label}</InputGroup.Text>
        <Typeahead
          id="basic-typeahead-single"
          labelKey={labelKey}
          onChange={onChange}
          onInputChange={onInputChange}
          options={options}
          placeholder={placeholder || ""}
          ref={_ref}
          className="border border-dark border-radius"
          {...props}
        />
      </Col>
    </>
  );
}
