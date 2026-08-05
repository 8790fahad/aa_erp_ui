import React from "react";
import RadioBox from "./RadioBox";

function RadioGroup(props) {
  const {
    container = "",
    options = [],
    onChange = (f) => f,
    value = "",
    label = "",
    name = "",
  } = props;

  return (
    <div className={container}>

      <div className='d-flex flex-row'>
      <h6 className='font-weight-bold'>{label}</h6>
        {/* {JSON.stringify({name, value})} */}
        {options.map((_item, _i) => (
          <RadioBox
            container='mx-4'
            label={_item.label}
            name={name}
            checked={_item.name === value}
            onChange={() => onChange(name, _item.name)}
          />
        ))}
      </div>
    </div>
  );
}

export default RadioGroup;
