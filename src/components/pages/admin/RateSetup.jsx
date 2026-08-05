/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import CustomButton from "@/common/Custom/CustomButton";
import React, { useRef, useState, useEffect } from "react";
import { FaCartPlus, FaPlus } from "react-icons/fa";
import { FiDelete } from "react-icons/fi";
import { Row, Table, Button, CardBody, Col, Input } from "reactstrap";
import CustomCard from "@/common/Custom/CustomCard2";
import { Typeahead } from "react-bootstrap-typeahead";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { useNavigate } from "react-router-dom";
import { formatNumber1 } from "@/components/router/utilities";
import { Badge } from "reactstrap/lib";

export default function RateSetup({ formSetup = [] }) {
  const [form, setForm] = useState({
    rateType: "",
    customerType: "",
    amount: "",
    status: "",
  });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef();
  const { user = {}, activeBusiness = {} } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  const handleDelete = (index) => {
    setData((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!form.rate) return toast.error("Rate Name is required");
    if (!form.amount) return toast.error("Amount is required");
    if (!form.status) return toast.error("Status is required");
    if (!form.rateType) return toast.error("Rate Type is required");
    if (!form.customerType) return toast.error("Customer Type is required");
    return true;
  };

  const handleFormChange = ({ target: { name, value } }) =>
    setForm((prev) => ({ ...prev, [name]: value }));

  const handleAdd = () => {
    if (!validateForm()) return;

    setData((prev) => [...prev, form]);
    setForm({
      rate: "",
      rateType: "",
      customerType: "",
      amount: "",
      status: "",
    });
    inputRef.current.clear();
  };

  const handleSubmit = () => {
    if (data.length === 0) {
      return toaster.warning("Please add at least one rate.");
    }

    setLoading(true);

    _postApi(
      `/v1/materials/insertRateSetup`,
      {
        data,
        facilityId: activeBusiness?.id,
      },
      (res) => {
        if (res.success) {
          toaster.success(res.message || "Rate setup submitted successfully");
          navigate(-1);
        } else {
          toast.error(res.message || "Failed to submit");
        }
        setLoading(false);
      },
      (err) => {
        toast.error("An error occurred while submitting");
        console.error(err);
        setLoading(false);
      }
    );
  };

  return (
    <CustomCard back header="Rate Setup">
      {/* {JSON.stringify(data)} */}
      <CardBody>
        <Row>
          <Col md={4}>
            <label>Rate Name</label>
            <Input
              type="text"
              name="rate"
              value={form.rate}
              onChange={handleFormChange}
            />
          </Col>
          <Col md={4}>
            <label>Amount</label>
            <Input
              type="text"
              name="amount"
              value={form.amount}
              onChange={handleFormChange}
            />
          </Col>
          <Col md={4}>
            <label>Status</label>
            <Input
              type="select"
              name="status"
              value={form.status}
              onChange={handleFormChange}
            >
              <option value="">Select Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Input>
          </Col>
          <Col md={4}>
            <label>Rate Type</label>
            <Input
              type="select"
              name="rateType"
              value={form.rateType}
              onChange={handleFormChange}
            >
              <option value="">Select Status</option>
              <option value="Rate">Rate</option>
              <option value="Operator Rate">Operator Rate</option>
            </Input>
          </Col>
          <Col md={4}>
            <label>Customer Type</label>
            <Input
              type="select"
              name="customerType"
              value={form.customerType}
              onChange={handleFormChange}
            >
              <option value="">Select Status</option>
              <option value="partners">Partners</option>
              <option value="directors">Directors</option>
              <option value="customers">Customers</option>
            </Input>
          </Col>
        </Row>

        <center>
          <CustomButton
            onClick={handleAdd}
            className="mb-2 px-4 d-flex align-items-center fw-bold mt-4"
          >
            <FaPlus className="mr-2" /> Add
          </CustomButton>
        </center>

        {data.length > 0 && (
          <Table size="sm">
            <thead>
              <tr>
                <th className="text-center">#</th>
                <th className="text-left">Rate</th>
                <th className="text-center">Amount</th>
                <th className="text-center">Rate Type</th>
                <th className="text-center">Customer Type</th>
                <th className="text-center">Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr key={i}>
                  <td className="text-center">{i + 1}</td>
                  <td className="text-left">{item.rate}</td>
                  <td className="text-right">{formatNumber1(item.amount)}</td>
                  <td className="text-center">{item.rateType}</td>
                  <td className="text-center">{item.customerType}</td>
                  <td className="text-center">
                    <Badge
                      color={item.status === "Active" ? "success" : "danger"}
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td className="text-center">
                    <Button
                      size="sm"
                      onClick={() => handleDelete(i)}
                      className="btn btn-danger"
                    >
                      <FiDelete />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {data.length > 0 && (
          <div className="text-center">
            <CustomButton
              onClick={handleSubmit}
              loading={loading}
              className="px-5 d-flex align-items-center mx-auto"
            >
              <FaCartPlus className="mr-2" /> Submit
            </CustomButton>
          </div>
        )}
      </CardBody>
    </CustomCard>
  );
}
