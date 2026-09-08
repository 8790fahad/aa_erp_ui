/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import CustomTypeahead from "@/common/Custom/Customtypeahead";
import { getSuppliers } from "@/redux/actions/suppliers";
import SupplierRegisteration from "../suppliers/SupplierRegisteration";
import {
  filterSuppliersByVendorType,
  filterSuppliersByAllowedTypes,
} from "@/utils/vendorType";
import { getUserFunctionalities, allowedVendorFetchTypes } from "@/lib/access";

export default function SearchSupplierInput(props) {
  const dispatch = useDispatch();
  const rawOptions = useSelector((state) => state.suppliers.supplierList);
  const user = useSelector((state) => state.auth.user);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const allowedTypes = allowedVendorFetchTypes(
    getUserFunctionalities(user, activeBusiness),
  );
  const options = filterSuppliersByVendorType(
    filterSuppliersByAllowedTypes(
      Array.isArray(rawOptions) ? rawOptions : [],
      allowedTypes,
    ),
    props.vendorType,
  );
  const [inputValue, setInputValue] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const getList = useCallback(() => {
    // Always fetch suppliers when component loads
    dispatch(getSuppliers());
    // alert(JSON.stringify(options))
  }, [dispatch]);

  useEffect(() => {
    // Ensure suppliers are always fetched when component mounts
    getList();
  }, [getList]);

  return (
    <>
      <CustomTypeahead
        {...props}
        options={options}
        labelKey="supplier_name"
        // Allow creating a new supplier directly from the input
        allowNew
        newSelectionPrefix="Create new supplier: "
        onInputChange={(v) => {
          setInputValue(v);
          if (v.length && props.onInputChange) {
            props.onInputChange(v);
          }
        }}
        disabled={props.disabled}
        edge={props.edge}
        onChange={(v) => {
          if (v.length) {
            const selected = v[0];

            // If user chose the "create new" option from the typeahead,
            // open the SupplierRegistration form instead of returning a value.
            if (selected && selected.customOption) {
              setShowCreateModal(true);
              return;
            }

            // Normal selection of an existing supplier
            props.onChange(selected);
          } else {
            // Handle clearing selection
            if (props.onChange) {
              props.onChange(null);
            }
          }
        }}
      />

      <SupplierRegisteration
        showModal={showCreateModal}
        closeModal={() => setShowCreateModal(false)}
        // No specific supplier selected – this opens the "create" mode
        selectedSupplier={null}
        getList={getList}
        empty={() => {}}
        defaultVendorType="all"
      />
    </>
  );
}
