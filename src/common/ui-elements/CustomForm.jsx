
import { RadioGroup, SelectInput, TextInput } from ".";
import Checkbox from "./CheckBox";
import classNames from "classnames";
// import ToggleSwitch from "./toggle-switch/ToggleSwitch";


function CustomForm({
  fields = [],
  handleChange = (f) => f,
  handleRadioChange = (f) => f,
  handleSwitchChange = (f) => f,
}) {
  return (
    <div className="row m-0">
      {fields.map((el, i) => {
        if (el.type && el.type === "select") {
          return (
            <div
              className={classNames([
                `col-md-${el.col || 4} offset-md-${el.offset || ""}`,
              ])}
              key={i}
            >
              <SelectInput
                label={el.label}
                name={el.name}
                value={el.value || ""}
                options={el.options || []}
                required={el.required}
                disabled={el.disabled}
                onChange={handleChange}
              />
            </div>
          );
        } else if (el.type && el.type === "radio") {
          return (
            <div
              className={classNames([
                `col-md-${el.col || 4} offset-md-${el.offset || ""}`,
              ])}
              key={i}
            >
              <RadioGroup
                container="row"
                label={el.label}
                name={el.name}
                options={el.options}
                onChange={handleRadioChange}
                value={el.value}
              />
            </div>
          );
        } else if (el.type === "switch") {
          return (
            <div
            key={i}
              className={classNames([
                `col-md-${el.col || 4} offset-md-${el.offset || ""}`,
              ])}
            >
              {/* <ToggleSwitch
                container="d-flex flex-row"
                name={el.name}
                options={el.options}
                onChange={handleSwitchChange}
                value={el.value}
                label={el.label}
              /> */}
            </div>
          );
        } else if (el.type && el.type === "checkbox") {
          return (
            <div
            key={i}
              className={classNames([
                `col-md-${el.col || 4} offset-md-${el.offset || ""}`,
              ])}
            >
              <Checkbox
                container="d-flex flex-row"
                label={el.label}
                name={el.name}
                options={el.options}
                onChange={handleRadioChange}
                value={el.value}
              />
            </div>
          );
        } else if (el.type && el.type === "custom") {
          return (
            <div
              className={classNames([
                `col-md-${el.col || 4} offset-md-${el.offset || ""}`,
                el.container,
              ])}
              md={{ size: el.div || 4, offset: el.offset || "" }}
              key={i}
            >
              {el.component()}
            </div>
          );
          // } else if (el.type === "switch") {
          //   return <SwitchButton />;
        } else {
          return (
            <div
              className={`col-md-${el.col || 4} offset-md-${el.offset || ""}`}
              key={i}
            >
              <TextInput
                label={el.label}
                type={el.type || "text"}
                name={el.name}
                value={el.value}
                required={el.required}
                disabled={el.disabled}
                readOnly={el.readonly}
                onChange={handleChange}
              />
            </div>
          );
        }
      })}
    </div>
  );
}

export default CustomForm;
