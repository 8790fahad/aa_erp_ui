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
  const hasExternalOptions = Array.isArray(props.options);
  const options = hasExternalOptions
    ? props.options
    : filterSuppliersByVendorType(
        filterSuppliersByAllowedTypes(
          Array.isArray(rawOptions) ? rawOptions : [],
          allowedTypes,
        ),
        props.vendorType,
      );
  const [inputValue, setInputValue] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const allowNew = props.allowNew !== false;

  const getList = useCallback(() => {
    if (hasExternalOptions) return;
    dispatch(getSuppliers());
  }, [dispatch, hasExternalOptions]);

  useEffect(() => {
    if (hasExternalOptions) return;
    getList();
  }, [getList, hasExternalOptions]);

  return (
    <>
      <CustomTypeahead
        {...props}
        options={options}
        labelKey={props.labelKey || "supplier_name"}
        allowNew={allowNew}
        newSelectionPrefix={
          allowNew ? "Create new supplier: " : undefined
        }
        paginate={props.paginate}
        maxResults={props.maxResults}
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

            if (selected && selected.customOption) {
              setShowCreateModal(true);
              return;
            }

            props.onChange(selected);
          } else if (props.onChange) {
            props.onChange(null);
          }
        }}
      />

      {allowNew ? (
        <SupplierRegisteration
          showModal={showCreateModal}
          closeModal={() => setShowCreateModal(false)}
          selectedSupplier={null}
          getList={getList}
          empty={() => {}}
          defaultVendorType="all"
        />
      ) : null}
    </>
  );
}
