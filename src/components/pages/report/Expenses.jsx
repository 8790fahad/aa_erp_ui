import { useState } from "react";
import { Label, Col, Row, Input, Button, Table } from "reactstrap";
import { FcCheckmark } from "react-icons/fc";
// import {saveTransaction} from "../../redux/actions/transactions";
import { FiDelete } from "react-icons/fi";
import { useSelector } from "react-redux";
import moment from "moment";
import { useNavigate } from "react-router";
import { CURRENCY, TRANSACTION_TYPES } from "@/constants";
import { newExpenses } from "@/redux/actions/transactionApi";
import { toast } from "sonner";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import { formatNumber } from "@/utilities";
import SearchStoresInput from "@/common/Custom/SearchStoresInput";

export default function Expenses() {
  const initForm = {
    item_name: "",
    // quantity: '',
    cost: "",
  };
  const [form, setForm] = useState(initForm);
  const [selected_store, setSelected_store] = useState("");
  const [data, setData] = useState([]);
  const users = useSelector((state) => state.auth.user);
  const facilityId = useSelector((state) => state.auth.activeBusiness.id);
  const isValid = (form) => {
    const values = Object.values(form);
    // alert(values.filter(item=>item==='').length)
    return values && values.filter((item) => item === "").length < 1;
  };
  const history = useNavigate();
  const addData = () => {
    if (isValid(form)) {
      setData((prev) => [
        ...prev,
        {
          ...form,
          query_type: TRANSACTION_TYPES.NEW_EXPENSES,
          dr: parseInt(form.cost),
          cr: 0,
          destination: "EXPENSES",
          description: form.item_name,
          price: form.cost,
          totalAmount: parseInt(form.cost),
          branch_name: selected_store,
          collectedBy: users.username,
          userId: users.id,
          facilityId: facilityId,
        },
      ]);
      setForm(initForm);
    }
  };

  const handleDelete = (index) => {
    let item = data.filter((i, idx) => index !== idx);
    setData(item);
    console.log(index);
  };

  const handleChange = ({ target: { value, name } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const submitAll = (e) => {
    e.preventDefault();
    let newArr = [];
    data.forEach((i) =>
      newArr.push({ ...i, receiptNo: moment().format("ssmsDDMMhh") })
    );
    newExpenses(
      newArr,
      () => {
        console.log("Transaction successiful");
        toast.success("Transaction successiful");
        history("/app/report/expenses");
      },
      () => {
        toast.error("Failed to saved transaction");
      }
    );
    setData([]);
    setForm(initForm);
  };
  let total = data.reduce((i, idx) => i + parseFloat(idx.cost), 0);
  return (
    <div>
      <CustomCard back header={"Expenses form"}>
        <Row>
          <Col md="4">
            <Label>Select Store</Label>
            <SearchStoresInput
              onChange={(selected) => {
                setSelected_store(selected.storeName);
                form.store_name = selected.storeName;
              }}
              activeStore={selected_store}
              defaultStore={selected_store}
            />
          </Col>
          <Col md="4">
            <Label>Description</Label>
            <Input
              type="text"
              name="item_name"
              value={form.item_name}
              onChange={handleChange}
            />
          </Col>

          {/* <Col md="2">
          <Label>Qty</Label>
          <Input
            type="number"
            name="quantity"
            value={form.quantity}
            onChange={handleChange}
          />
        </Col> */}

          <Col md="4">
            <Label>Amount</Label>
            <Input
              type="number"
              name="cost"
              value={form.cost}
              onChange={handleChange}
            />
          </Col>
        </Row>

        <center>
          <CustomButton size="sm" onClick={addData} className="m-2 px-5">
            + Add
          </CustomButton>
        </center>
        <h3 className="text-right">Total: {total}</h3>
        <Table striped bordered>
          <thead>
            <tr>
              <th style={{ width: "2%" }}>S/N</th>
              <th className="text-center">Description</th>
              {/* <th className="text-center">Qty</th> */}
              <th className="text-center">Cost({CURRENCY})</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {data &&
              data.map((item, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{item.item_name}</td>
                  {/* <td className="text-center">{item.quantity}</td> */}
                  <td className="text-right">{formatNumber(item.cost)}</td>
                  <td className="text-right">
                    <Button
                      color="danger"
                      size="sm"
                      onClick={() => handleDelete(index)}
                    >
                      <FiDelete /> Delete
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </Table>
        <Row>
          <Col md={12} className="text-center">
            <CustomButton
              onClick={submitAll}
              className="d-flex"
              style={{ marginLeft: "auto" }}
            >
              <FcCheckmark className="mr-1" size={20} /> Submit
            </CustomButton>
          </Col>
        </Row>
      </CustomCard>
    </div>
  );
}
