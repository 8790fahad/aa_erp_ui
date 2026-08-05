import React, { useState, useEffect, useCallback, useRef } from "react";
import { FiDelete } from "react-icons/fi";
import { MdDelete } from "react-icons/md";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router";
import {
  Card,
  CardBody,
  CardHeader,
  Col,
  Label,
  Row,
  Table,
  Container,
} from "reactstrap";

import useQuery from "@/hooks/useQuery";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";
import CustomButton from "@/common/Custom/CustomButton";
import SearchStoresInput from "@/common/Custom/SearchStoresInput";
import SimpleInput from "@/common/SimpleInput";
import { formatNumber } from "@/utilities";

function TransferForm({ ref_from, store }) {
  // const ref_from = useRef(null);
  // const user = useSelector((state) => state.auth.activeBusiness.business_name);
  // const ref_to = useRef();
  const ref_item_name = useRef();
  const query = useQuery();
  const activeStore = query.get("store");
  const [loading, setLoading] = useState();
  const [arr, setArr] = useState([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [form, setForm] = useState({
    storeFrom: "" || activeStore,
    storeTo: "" || store,
    quantity: "",
    item_name: "",
  });

  const [selectedItem, setSelectedItem] = useState({});
  const handleDelete = (i) => {
    let newVal = arr.filter((item, index) => i !== index);
    setArr(newVal);
  };
  const onFormChange = (key, value) => setForm((p) => ({ ...p, [key]: value }));
  const navigate = useNavigate();
  const theme = useSelector((state) => state.auth.activeBusiness);
  const handleReset = () => {
    // ref_from.current.clear();
    ref_item_name.current.clear();
    ref_item_name.current.focus();
    // ref_to.current.clear();
    setForm((p) => ({ ...p, quantity: "" }));
  };
  const handleAdd = () => {
    setLoading(true);
    if (form.item_name === "") {
      toast.error("please select item name");
      setLoading(false);
    } else if (form.storeTo === "") {
      toast.error("please select select store to");
      setLoading(false);
    } else if (form.storeFrom === "") {
      toast.error("please select store to");
      setLoading(false);
    } else if (form.quantity === "") {
      toast.error("please quantity is required");
      setLoading(false);
    } else if (parseFloat(form.quantity) > parseFloat(selectedItem.quantity)) {
      toast.error("Quantity is more than store quantity");
      setLoading(false);
    } else {
      setArr((p) => [...p, form]);
      setLoading(false);
      handleReset();
    }
  };

  const handleSubmit = () => {
    setSubmitLoading(true);
    _postApi(
      "/account/good/transfer",
      { data: arr },
      (res) => {
        if (res.status) {
          toast.success("Successfully Submit");
          setSubmitLoading(false);
          setArr([]);
        }
      },
      (err) => {
        toast.error("error occured");
        console.log(err);
        setSubmitLoading(false);
      }
    );
  };
  const handleKeyPress = useCallback(
    (e) => {
      switch (e.key) {
        case "Enter":
          return handleAdd();
        case "F10":
          return handleSubmit();

        default:
          return null;
      }
    },
    [handleAdd]
  );
  useEffect(() => {
    // ref_to.current.setState({ text: user });
  }, [store]);
  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress);

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);

  return (
    <Container>
      {/* {JSON.stringify({ arr })} */}
      <Card className="border border-dark m-2" style={{ height: "97%" }}>
        <CardHeader
          className="text-white border border-dark d-flex"
          style={{ backgroundColor: theme.primary_color }}
        >
          <CustomButton
            handleSubmit={() => {
              navigate(-1);
            }}
          >
            Back
          </CustomButton>
          <div
            style={{
              marginLeft: "18em",
              marginTop: "0.3em",
              fontWeight: "bold",
            }}
          >
            Transfer Form
          </div>
        </CardHeader>
        <CardBody>
          {/* {JSON.stringify(user)} */}
          <Row className="m-0">
            <Col md={6}>
              <Label>Transfer From</Label>
              <SearchStoresInput
                onChange={(selected) =>
                  onFormChange("storeFrom", selected.storeName)
                }
                defaultSelected={[activeStore]}
                onInputChange={(v) => v}
              />
            </Col>
            <Col md={6}>
              <Label>Transfer To</Label>
              <SearchStoresInput
                onChange={(selected) =>
                  onFormChange("storeTo", selected.storeName)
                }
                onInputChange={(v) => v}
                ref_from={ref_from}
                // defaultSelected={[store]}
              />
            </Col>
            <Col md={6}>
              <Label>Select Item</Label>
              {/* <SearchFromBranchStore
                activeStore={activeStore || "Show All Stores"}
                _ref={ref_item_name}
                onInputChange={(v) => {
                  console.log(v);
                }}
                onChange={(selected) => {
                  onFormChange("item_name", selected.item_name);
                  setSelectedItem(selected);
                  // alert(JSON.stringify(selected));
                  setForm((p) => ({
                    ...p,
                    id: selected._id,
                    price: parseInt(selected.selling_price),
                    cost: selected.cost,
                    markup: selected.markup,
                    quantity: 0,
                    expiry_date: selected.expiry_date,
                    storeName: selected.storeName,
                    supplierName: selected.supplierName,
                    supplier_code: selected.supplier_code,
                    item_code: selected.item_code,
                    // ...selected,
                  }));
                }}
              /> */}
            </Col>

            <SimpleInput
              label="Quantity"
              field={{ type: "text", name: "quantity", value: form.quantity }}
              size="6"
              handleChange={({ target: { name, value } }) => {
                setForm((p) => ({ ...p, [name]: value }));
              }}
            />
          </Row>
          <Card
            className="p-1 px-2 my-1"
            style={{ borderLeftWidth: 2, borderLeftColor: primaryColor }}
          >
            {/* <div className="row">
              <div className="col-md-6">
                Qtty Available: {selectedItem.quantity}
              </div>
              <div className="col-md-6">Truck No: {selectedItem.truckNo}</div>
              <div className="col-md-6">Waybill: {selectedItem.waybillNo}</div>
              <div className="col-md-6">
                Amount:{" "}
                {formatNumber(
                  parseFloat(selectedItem.quantity) *
                    parseFloat(selectedItem.cost)
                )}
              </div>
              <div className="col-md-6">
                Cost Price: {formatNumber(parseFloat(selectedItem.cost))}
              </div>
              <div className="col-md-6">Total Solid Value</div>
            </div> */}
            <Card
              className="pt-2"
              style={{
                borderLeft: `3px solid ${theme.primary_color}`,
                borderRight: `3px solid ${theme.primary_color}`,
              }}
            >
              <Row>
                <Col>
                  <label htmlFor="qtty" className="ml-3">
                    Quantity Available:
                  </label>
                  <label htmlFor="">{selectedItem.quantity}</label>
                </Col>
                <Col>
                  <label htmlFor="price" className="ml-1">
                    Cost Price:
                  </label>
                  <label htmlFor="">
                    {formatNumber(parseFloat(selectedItem.selling_price))}
                  </label>
                </Col>
                <Col>
                  <label htmlFor="drugName" className="ml-1">
                    Amount:{" "}
                  </label>
                  <label htmlFor="">
                    {formatNumber(
                      parseFloat(selectedItem.quantity) *
                        parseFloat(selectedItem.selling_price)
                    )}
                  </label>
                </Col>
              </Row>
            </Card>
          </Card>
          <center className="mt-2">
            <CustomButton color="primary" loading={loading} onClick={handleAdd}>
              Add to List
            </CustomButton>
          </center>
          <Table className="mt-1" bordered>
            <thead>
              <tr>
                <th className="text-center">Del</th>
                <th className="text-center">Item </th>
                <th className="text-center">Qty </th>
                <th className="text-center">Price</th>
                <th className="text-center">Amount</th>
                <th className="text-center">Transfer From</th>
                <th className="text-center">Transfer To</th>
              </tr>
            </thead>
            <tbody>
              {arr.map((item, idx) => (
                <tr key={idx}>
                  <td className="text-center text-danger">
                    <MdDelete
                      size="20"
                      onClick={() => handleDelete(idx)}
                      style={{ cursor: "pointer" }}
                    />
                  </td>
                  <td>{item.item_name}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right">{formatNumber(item.price)}</td>
                  <td className="text-right">
                    {formatNumber(
                      parseInt(item.price) * parseInt(item.quantity)
                    )}
                  </td>
                  <td className="text-center">{item.storeFrom}</td>
                  <td className="text-center">{item.storeTo}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <center>
            <CustomButton
              color="primary"
              loading={submitLoading}
              handleSubmit={handleSubmit}
              disabled={!arr.length ? true : false}
            >
              Submit
            </CustomButton>
          </center>
        </CardBody>
      </Card>
    </Container>
  );
}

export default TransferForm;
