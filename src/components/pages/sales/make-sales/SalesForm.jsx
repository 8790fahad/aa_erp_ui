/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import SearchBar from "@/common/Custom/SearchBar";
import { getPurchasedItems } from "@/redux/actions/purchase";
import { useState, useCallback, useEffect } from "react";
import { useDispatch } from "react-redux";
import { Col, Label, Row } from "reactstrap";
import ActiveStoresList from "../../purchase/ActiveStoresList";
import SimpleInput from "@/common/SimpleInput";
// import SearchStoresInput from "../../../app/admin/stores/SearchStores";

function SalesForm({
  disabled,
  form,
  handleChange = (f) => f,
  qttyRef,
  itemNameRef,
  setFilterText = (f) => f,
}) {
  const showImei = true;
  const [text, setText] = useState("");
  const [selected_store, setSelected_store] = useState("");
  const dispatch = useDispatch();
  const getPurchaseList = useCallback(() => {
    // alert(activeStore)
    dispatch(
      getPurchasedItems(selected_store, () => console.log("Loading..."))
    );
  }, [dispatch, selected_store]);
  useEffect(() => {
    getPurchaseList();
  }, [getPurchaseList]);

  return (
    <Row className="mb-1">
      {/* {JSON.stringify(activeBusiness)} */}
      <Col md={6} className="my-2">
        <Label>Search Item</Label>
        <SearchBar
          _ref={itemNameRef}
          // placeholder="Search for items by code or name"
          filterText={text}
          onFilterTextChange={(v) => {
            setFilterText(v);
            setText(v);
          }}
        />
      </Col>
      <SimpleInput
        size={3}
        _ref={qttyRef}
        field={{
          label: "Enter Quantity",
          type: "number",
          value: form.quantity_sold,
          name: "quantity_sold",
          onChange: handleChange,
          // onFocus: (e) => qttyRef.current.select(),
        }}
      />
      {showImei && (
        <SimpleInput
          size={3}
          field={{
            disabled: disabled,
            label: "SKU",
            type: "number",
            value: form.imeiText,
            name: "imeiText",
            onChange: handleChange,
          }}
        />
      )}
    </Row>
  );
}

export default SalesForm;
