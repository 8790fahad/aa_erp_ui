/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React from "react";
import Select from "react-select";

const CommonSelect = ({
  options = [],
  className = "",
  value = null, // Use `null` instead of an empty string
  onChange = () => {},
}) => {
  // Ensure `value` is an object from `options`
  const selectedValue = options.find((opt) => opt.value === value) || null;

  return (
    <Select
      classNamePrefix="react-select"
      className={className}
      options={options}
      value={selectedValue} // Use value, not defaultValue
      onChange={onChange}
      placeholder="Select"
    />
  );
};

export default CommonSelect;
