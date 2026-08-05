/* eslint-disable no-unused-vars */
import React, { useState } from "react";
import { Col, Input, Label, Row } from "reactstrap";
import CustomButton from "@/common/Custom/CustomButton";
import { FaSave } from "react-icons/fa";
import { useSelector } from "react-redux";
import CustomForm from "@/common/Custom/CustomForm";
import { useNavigate } from "react-router";
import CustomCard from "@/common/Custom/CustomCard2";
import { _postApi } from "@/redux/actions/api";
import { toast } from "sonner";

export default function CreateTaxes() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [form, setForm] = useState({
    taxes_name: "",
    rate: 0,
    rate_type: "",
    taxes_head: "",
    query_type: "insert",
  });

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({
      ...p,
      [name]: value,
    }));
  };

  const handleSubmit = () => {
    setLoading(true);
    _postApi(
      "/create-new-taxes",
      { form },
      (res) => {
        if (res.success) {
          setLoading(false);
          toast.success("Successfully Submit");
          navigate("/app/account/create-taxes");
        }
      },
      (err) => {
        setLoading(false);
        console.log(err);
        toast.error("error occured");
      }
    );
  };

  return (
    <CustomCard back header={"Create Taxes"}>
      <Row>
        {/* <CustomForm fields={fields} handleChange={handleChange} /> */}
      </Row>
      <Row className="mt-3 mb-3">
        <Col md={6}>
          <Label>Head</Label>
          <Input
            type="number"
            value={form.taxes_head}
            onChange={handleChange}
            name="taxes_head"
          />
        </Col>
        <Col md={6}>
          <Label>Taxes Name</Label>
          <Input
            type="text"
            value={form.taxes_name}
            onChange={handleChange}
            name="taxes_name"
            placeholder="Taxes Name"
          />
        </Col>
        <Col md={6}>
          <Label>Rate Type</Label>
          <Input
            type="select"
            value={form.rate_type}
            onChange={handleChange}
            name="rate_type"
          >
            <option value="">--select--</option>
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed</option>
          </Input>
        </Col>
        <Col md={6}>
          <Label>Rate</Label>
          <Input
            type="number"
            value={form.rate}
            onChange={handleChange}
            name="rate"
          />
        </Col>
      </Row>

      <center>
        <CustomButton
          className="px-5 d-flex align-items-center gap-2"
          loading={loading}
          disabled={loading}
          onClick={() => handleSubmit()}
        >
          <FaSave /> Create
        </CustomButton>
      </center>
    </CustomCard>
  );
}
