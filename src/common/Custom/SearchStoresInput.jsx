/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import React from "react";
import { useSelector } from "react-redux";
import CustomTypeahead from "./Customtypeahead";

function SearchStoresInput(props) {
  const options = useSelector((state) => state.stores.storeList);

  return (
    <>
      <CustomTypeahead
        {...props}
        _ref={props.ref_from}
        options={options}
        placeholder="Search stores by name"
        labelKey="storeName"
        onInputChange={(v) => {
          if (v&&v.length) {
            props.onInputChange(v);
          }
          // console.error({IIIIIIIIIIIIISSSSSSS:v});
        }}
        // inline={true}
        // clearButton
        onChange={(v) => {
          if (v.length) {
            props.onChange(v[0]);
          }
        }}
      />
    </>
  );
}

export default SearchStoresInput;
