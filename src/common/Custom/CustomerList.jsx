/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React, { useCallback, useEffect } from "react";
import { getCustomers } from "@/redux/actions/customer";
import { useDispatch, useSelector } from "react-redux";
import TypeaheadCustom from "./TypeaheadCustom";

function CustomerList(props) {
  const dispatch = useDispatch();
  const options = useSelector((state) => state.customer.customerList) || [];

  const getList = useCallback(() => {
    dispatch(getCustomers());
  }, [dispatch]);

  useEffect(() => {
    getList();
  }, [getList]);
  return (
    <>
      <TypeaheadCustom
        _ref={props.ref}
        placeholder="Search customer by name"
        options={options}
        labelKey={(i) => i.accName}
        onInputChange={(i) => i.accName}
        onChange={(v) => {
          if (v.length) {
            props.onChange(v);
          }
        }}
        {...props}
      />
    </>
  );
}

export default CustomerList;
