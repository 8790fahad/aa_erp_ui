/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React from "react";
import { useSelector } from "react-redux";
import { Row, Col, FormGroup, Label, Input } from "reactstrap";

function DaterangeSelector({ from, to, handleChange }) {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  return (
    <Row>
      <Col md={4}>
        <FormGroup>
          <Label style={{ fontWeight: "bold" }}>From:</Label>
          <Input
            type="date"
            value={from}
            name="from"
            onChange={handleChange}
            style={{
              borderWidth: 2,
              borderColor: activeBusiness?.primary_color,
            }}
          />
        </FormGroup>
      </Col>

      <Col md={4}></Col>

      <Col md={4}>
        <FormGroup>
          <Label style={{ fontWeight: "bold" }}>To:</Label>
          <Input
            type="date"
            value={to}
            name="to"
            onChange={handleChange}
            style={{
              borderWidth: 2,
              borderColor: activeBusiness?.primary_color,
            }}
          />
        </FormGroup>
      </Col>
    </Row>
  );
}

export default DaterangeSelector;
