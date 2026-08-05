/* eslint-disable no-unused-vars */
/* eslint-disable no-dupe-else-if */
/* eslint-disable react/jsx-key */
/* eslint-disable react/prop-types */
import React from "react";
import { Row, Col } from "reactstrap";
import SelectInput from "../SelectInput";
import TextInput from "./TextInput";
import RadioGroup from "./RedioGroup";
import Checkbox from "./Checkbox";
import SwitchButton from "./Hook/SwitchButton";

export default function CustomForm(props) {
  const {
    fields = [],
    handleChange = (f) => f,
    handleRadioChange = (f) => f,
    setState = (f) => f,
  } = props;
  return (
    <Row className='m-0'>
      {fields.map((el, i) => {
        if(el.area_hidden && el.show){
          return false;
        }
        else if (el.type && el.type === "select") {
          return (
            <Col md={{ size: el.col || 4, offset: el.offset || "" }} key={i}>
              {!el.show && (
                <SelectInput
                  label={el.label}
                  name={el.name}
                  value={el.value}
                  options={el.options || []}
                  required={el.required}
                  disabled={el.disabled}
                  onChange={el.handleChange ? el.handleChange : handleChange}
                />
              )}
              {el.switch ? (
                <SwitchButton name={el.name} setState={setState} />
              ) : null}
            </Col>
          );
        } else if (el.type && el.type === "radio") {
          return (
            <Col md={{ size: el.col || 4, offset: el.offset || "" }} key={i}>
              {!el.show && (
                <RadioGroup
                  container='d-flex flex-row'
                  label={el.label}
                  name={el.name}
                  options={el.options}
                  onChange={handleRadioChange}
                  value={el.value}
                />
              )}
              {el.switch ? (
                <SwitchButton name={el.name} setState={setState} />
              ) : null}
            </Col>
          );
        } else if (el.type && el.type === "checkbox") {
          return (
            <Col md={{ size: el.col || 4, offset: el.offset || "" }} key={i}>
              <Checkbox
                container='d-flex flex-row'
                label={el.label}
                name={el.name}
                options={el.options}
                onChange={handleRadioChange}
                value={el.value}
              />
              {el.switch ? (
                <SwitchButton name={el.name} setState={setState} />
              ) : null}
            </Col>
          );
        } else if (el.type && el.type === "custom") {
          return (
            <Col
              className={el.container}
              md={{ size: el.col || 4, offset: el.offset || "" }}
              key={i}
            >
              {!el.show && el.component()}
              {el.switch ? (
                <SwitchButton name={el.name} setState={setState} />
              ) : null}
            </Col>
          );
        } else if (el.type === "switch") {
          return <SwitchButton />;
        } else if (el.type === "switch") {
          return <input type='hidden' name={el.name} value={el.value} />;
        } else {
          return (
            <Col md={{ size: el.col || 4, offset: el.offset || "" }} key={i}>
              {!el.show && (
                <TextInput
                  label={el.label}
                  type={el.type || "text"}
                  name={el.name}
                  value={el.value}
                  required={el.required}
                  disabled={el.disabled}
                  onChange={el.handleChange ? el.handleChange : handleChange}
                />
              )}
              {el.switch ? (
                <SwitchButton name={el.name} setState={setState} />
              ) : null}
            </Col>
          );
        }
      })}
    </Row>
  );
}
