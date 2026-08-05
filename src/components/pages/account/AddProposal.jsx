/* eslint-disable no-unused-vars */
/* eslint-disable react/jsx-key */
import React from "react";
import { useState } from "react";
import { Col, Input, Label, Row } from "reactstrap";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { Typeahead } from "react-bootstrap-typeahead";
import { _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";

export default function AddProposal() {
  const options = [
    { label: "Code 001", value: "001" },
    { label: "Code 002", value: "002" },
    { label: "Code 003", value: "003" },
    { label: "Code 004", value: "004" },
  ];
  const type = [
    { name: "Revenue", type: 1 },
    { name: "Expenditures", type: 2 },
  ];

  const _form = {
    year: moment().format("YYYY"),
    purpose: "",
    type: "",
    amount: 0,
    description: "",
    budget_code: "",
  };
  const history = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(_form);

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleTypeaheadChange = (selectedItems, name) => {
    const selectedObject = selectedItems[0] || {};
    setForm((prev) => ({
      ...prev,
      [name]: selectedObject.value || "", // Save the "value" property
    }));
  };

  const handleAdd = () => {
    // setLoading(true);
    alert(JSON.stringify(form));
    _postApi(
      `/account/post-budget?query_type=create`,
      {
        ...form,
      },
      (res) => {
        if (res.success) {
          toast.success("Successfully Submit");
          setLoading(false);
          history(-1);
        }
      },
      (err) => {
        toast.error("error occured");
        console.log(err);
        setLoading(false);
      }
    );
  };

  return (
    <div>
      <CustomCard header="Budget proposal" back>
        <Row>
          <Col md={4}>
            <Label>Budget Year</Label>
            <select
              className="form-control"
              name="year"
              onChange={handleChange}
            >
              <option value="">Select Year</option>
              {Array.from(
                { length: 3 },
                (_, i) => i + Number(moment().format("YYYY"))
              ).map((year) => (
                <option value={year}>{year}</option>
              ))}
            </select>
          </Col>
          <Col md={4}>
            <Label>Administrative Code</Label>

            <Typeahead
              id="adminstrativeCode"
              size={"sm"}
              className="col-md-12 pl-0 pr-0"
              options={options}
              placeholder="Administrative Code..."
              onChange={(selectedItems) =>
                handleTypeaheadChange(selectedItems, "administrativeCode")
              }
              style={{
                // border: `2px solid ${activeBusiness?.primary_color}`,
                borderRadius: 7,
              }}
            />
          </Col>
          <Col md={4}>
            <Label>Economic Code</Label>
            <Typeahead
              id="economicCode"
              size={"sm"}
              className="col-md-12 pl-0 pr-0"
              options={options}
              placeholder="Economic Code..."
              onChange={(selectedItems) =>
                handleTypeaheadChange(selectedItems, "economicCode")
              }
              style={{
                // border: `2px solid ${activeBusiness?.primary_color}`,
                borderRadius: 7,
              }}
            />
          </Col>
          <Col md={4}>
            <Label>Geo Code</Label>
            <Typeahead
              id="geoCode"
              size={"sm"}
              className="col-md-12 pl-0 pr-0"
              options={options}
              placeholder="Geo Code..."
              onChange={(selectedItems) =>
                handleTypeaheadChange(selectedItems, "geoCode")
              }
              style={{
                // border: `2px solid ${activeBusiness?.primary_color}`,
                borderRadius: 7,
              }}
            />
          </Col>

          <Col md={4}>
            <Label>Budget Type</Label>
            <select
              className="form-control"
              name="type"
              onChange={handleChange}
            >
              <option value="">Select Type</option>
              {type.map((item) => (
                <option key={item.type} value={item.type}>
                  {item.name}
                </option>
              ))}
            </select>
          </Col>
          <Col md={4}>
            <Label>Amount</Label>
            <Input
              type="text"
              name="amount"
              placeholder="Amount"
              onChange={handleChange}
            />
          </Col>
          <Col md={12}>
            <Label>Description</Label>
            <textarea
              className="form-control"
              name="description"
              placeholder="Description"
              onChange={handleChange}
            />
          </Col>
        </Row>
        <center>
          <CustomButton loading={loading} className="mt-3" onClick={handleAdd}>
            Create
          </CustomButton>
        </center>
      </CustomCard>
    </div>
  );
}
