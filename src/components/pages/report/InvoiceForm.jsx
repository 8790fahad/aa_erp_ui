/* eslint-disable no-unused-vars */
// import { Tab } from "evergreen-ui";
import React, { useEffect, useState } from "react";
import { PDFViewer } from "@react-pdf/renderer";
import moment from "moment";
import { FiDelete } from "react-icons/fi";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { Button, Table } from "reactstrap";
import { _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomForm from "@/common/Custom/CustomForm";
import { formatNumber } from "@/utilities";
import CustomButton from "@/common/Custom/CustomButton";
import FinalInvoice from "./FinalInvoice";
import SearchCustomerInput from "../customer/components/SearchCustomerInput";
import { Label } from "reactstrap";

export default function InvoiceForm() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    item_name: "",
    quantity: 0,
    amount: "",
    cost: "",
  });
  const [data, setData] = useState([]);
  const [preview, setPreview] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState([]);
  let receiptNo = moment().format("MMhhssDDYYms");
  const users = useSelector((state) => state.auth.user);
  const user = useSelector((state) => state.auth.activeBusiness);
  const history = useNavigate();

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({
      ...p,
      [name]: value,
    }));
  };

  const handleDelete = (index) => {
    let newData = data.filter((i, id) => index !== id);
    setData(newData);
  };

  useEffect(() => {
    if (selectedCustomer.length) {
      setForm((p) => ({
        ...p,
        name: selectedCustomer[0].fullname,
        phone: selectedCustomer[0].phone,
        address: selectedCustomer[0].address,
      }));
    }
  }, [selectedCustomer]);

  useEffect(() => {
    if (form.quantity && form.cost) {
      setForm((p) => ({
        ...p,
        amount: Number(form.quantity) * Number(form.cost),
      }));
    }
  }, [form.quantity, form.cost]);

  const arr = [
    "Sales Invoice",
    "Transfer Invoice",
    "Pucharse Invoice",
    "Expense Invoice",
    "Other Invoice",
  ];

  const fields = [
    {
      label: "Invoice type",
      name: "type",
      required: true,
      value: form.type,
      type: "custom",
      custom: true,
      component: (item) => (
        <div>
          <Label className="font-weight-bold">Invoice type</Label>
          <select
            name="type"
            disabled={data.length}
            value={form.type}
            onChange={handleChange}
            className="form-control"
          >
            <option value="">--select--</option>
            {arr.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
      ),
      col: 6,
    },
    {
      label: "Name",
      // name: "name",
      // required: true,
      type: "custom",
      custom: true,
      component: (item) => (
        <div>
          <Label className="font-weight-bold">Name</Label>
          <SearchCustomerInput
            disabled={data.length}
            label="Select Customer"
            onChange={(item) => {
              setSelectedCustomer(item);
              console.log(item);
              setForm((p) => ({
                ...p,
                name: item.fullname,
                phone: item.phone,
                address: item.address,
              }));
            }}
            color={user.primary_color}
          />
        </div>
      ),
      // value: form.name,
      col: 6,
    },
    // {
    //   label: "Address",
    //   name: "address",
    //   required: false,
    //   value: form.address,
    //   col: 6,
    // },
    // {
    //   label: "Phone Number",
    //   name: "phone",
    //   required: false,
    //   type: "number",
    //   value: form.phone,
    //   col: 6,
    // },
  ];

  const fields2 = [
    {
      label: "Description",
      name: "item_name",
      required: false,
      value: form.item_name,
    },
    {
      label: "Quantity",
      name: "quantity",
      type: "number",
      required: false,
      value: form.quantity,
    },
    {
      label: "Cost Price",
      name: "cost",
      required: false,
      value: form.cost,
      type: "number",
      handleChange: ({ target: { value } }) => {
        setForm((p) => ({
          ...p,
          cost: value,
          amount: Number(form.quantity) * Number(value),
        }));
      },
    },
    {
      label: "Amount",
      name: "amount",
      required: false,
      value: form.amount,
      type: "number",
      disabled: true,
    },
  ];

  const validateForm = () => {
    let isValid = true;

    if (!selectedCustomer.length) {
      toast.error("Customer is required");
      isValid = false;
    }

    if (!form.item_name?.trim()) {
      toast.error("Item Name is required");
      isValid = false;
    }

    if (!form.quantity || isNaN(form.quantity) || Number(form.quantity) <= 0) {
      toast.error("Valid Quantity is required");
      isValid = false;
    }

    if (!form.cost || isNaN(form.cost) || Number(form.cost) <= 0) {
      toast.error("Valid Cost is required");
      isValid = false;
    }
    if (!form.type?.trim()) {
      toast.error("Invoice Type is required");
      isValid = false;
    }

    return isValid;
  };

  const handleAdd = () => {
    if (!validateForm()) return;
    setData((p) => [...p, form]);
    setForm((p) => ({
      ...p,
      item_name: "",
      quantity: 0,
      amount: "",
      cost: 0,
    }));
  };

  const handleSubmit = () => {
    let newData = [];
    data.forEach((i) =>
      newData.push({
        ...i,
        invoice_no: receiptNo,
        facilityId: user.id,
        query_type: "insert",
        created_by: users.username,
      })
    );
    _postApi(
      "/customer/post-invoice",
      { newData },
      (res) => {
        setPreview(true);
        toast.success(res.msg);
        console.log(newData, "LDLLDLDLD");
      },
      (err) => {
        console.log(err);
      }
    );
  };
  let details = data && data.length ? data[0] : {};
  const total = data.reduce((it, i) => it + parseFloat(i.amount), 0);
  return (
    <div>
      {/* {JSON.stringify(form, null, 2)}
      {JSON.stringify(selectedCustomer, null, 2)} */}
      {!preview ? (
        <CustomCard
          back
          header="Invoice Form"
          headerRight={`  Invoice No: ${receiptNo}`}
        >
          <CustomForm fields={fields} handleChange={handleChange} />
          <br />
          <CustomForm fields={fields2} handleChange={handleChange} />
          <center>
            <Button
              color="primary"
              outline
              className="m-2 px-3"
              onClick={handleAdd}
            >
              Click to add
            </Button>
          </center>
          <Table size="sm" bordered striped>
            <thead>
              <tr>
                <th>S/N</th>
                <th>Description</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Cost</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{item.item_name}</td>
                  <td>{item.type}</td>
                  <td>{item.quantity}</td>
                  <td>{formatNumber(item.cost)}</td>
                  <td className="text-right">{formatNumber(item.amount)}</td>
                  <td className="text-right">
                    <Button
                      onClick={() => handleDelete(i)}
                      color="danger"
                      className="px-2 flex justify-center align-center"
                      size="sm"
                    >
                      <FiDelete /> Del
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <center>
            <CustomButton className="px-5" onClick={handleSubmit}>
              Submit Invoice
            </CustomButton>
          </center>
        </CustomCard>
      ) : (
        <div className="d-flex">
          <div className="m-2">
            <Button
              color="danger"
              onClick={() => {
                history("/app/reports/invoice-list");
                setPreview(false);
              }}
            >
              Close
            </Button>
          </div>
          <PDFViewer height="700" width="1100">
            <FinalInvoice
              data={data}
              info={details}
              //  page={page}
              receiptNo={details.invoice_no}
              busInfo={user}
              users={users}
              _customerName={details.name}
              total={total}
            />
          </PDFViewer>
        </div>
      )}
    </div>
  );
}
