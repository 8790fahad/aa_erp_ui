/* eslint-disable react/jsx-key */
/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect } from "react";
import { useState } from "react";
import {
  Col,
  Row,
} from "reactstrap";
import moment from "moment";
// import CustomTable from "../../components/CustomTable";
// import { formatNumber1 } from "../../app/utilities";
import { _fetchApi } from "@/redux/actions/api";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import CustomTable1 from "@/common/Custom/CustomTable1";
import { useNavigate } from "react-router-dom";
import { formatNumber } from "@/utilities";

export default function BudgetProposal() {
  const _form = {
    year: moment().format("YYYY"),
    purpose: "",
    from_name: "",
    type: "",
  };
  const history = useNavigate();
  const [form, setForm] = useState(_form);
  const [proposal, setProposal] = useState([]);

  const getProposal = useCallback(() => {
    _fetchApi(
      `/account/get-budget?query_type=select&year=${form.year}&type=${form.type}`,
      (res) => {
        if (res.success) {
          setProposal(res.results);
        }
      },
      (err) => console.log(err)
    );
  }, []);

  useEffect(() => {
    getProposal();
  }, [getProposal]);

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({ ...p, [name]: value }));
  };

  const fields = [
    {
      value: "admin_description",
      title: "Business Name",
      custom: true,
      className: "text-left",
      component: (ite) => (
        <div className="text-sm">{ite.admin_description || "-"}</div>
      ),
    },
    {
      value: "administrative_code",
      title: "Administrative Code",
      className: "text-center",
    },
    {
      value: "geo_code",
      title: "Geo Code",
      className: "text-center",
    },
    {
      value: "economic_code",
      title: "Economic Code",
      className: "text-center",
    },
    {
      value: "description",
      title: "Budget Description",
      className: "text-left",
    },
    {
      value: "amount",
      title: "Amount",
      custom: true,
      className: "text-right",
      component: (item) => (
        <div className="text-sm font-semibold">{formatNumber(item.amount || 0)}</div>
      ),
    },
  ];

  return (
    <div>
      <CustomCard header="Budget proposal">
        <Row className="mx-0">
          <div className="d-flex justify-content-between align-items-center w-100 mb-3">
            <Row className="mx-0 align-items-center">
            <Col md={4} sm={4} xs={4} className="pl-0 pr-2">
              <select
                className="form-control"
                onChange={handleChange}
                name="type"
              >
                <option value="revenue">Revenue</option>
                <option value="expenditures">Expenditures</option>
                <option value="asset">Asset</option>
                <option value="equity_liability">Equity & Liability</option>
              </select>
              </Col>

              <Col md={4} sm={4} xs={4} className="pl-0 pr-2">
              <select
                className="form-control"
                onChange={handleChange}
                name="year"
              >
                {Array.from(
                  { length: 3 },
                  (_, i) => i + Number(moment().format("YYYY"))
                ).map((year) => (
                  <option value={year}>{year}</option>
                ))}
              </select>
              </Col>
              
              <Col md={4} sm={4} xs={4} className="px-0">
                <CustomButton
                  onClick={() =>
                    history("/app/account/add-proposal")
                  }
                  size={"sm"}
                >
                  Add Items
                </CustomButton>
                </Col>
            </Row>

            <h5>Total Amount: 0</h5>
          </div>
          <CustomTable1 fields={fields} data={proposal} pageSize={10} message="No budget proposals found" />
        </Row>
        {/* <center>
          <CustomButton loading={loading} className="mt-3" onClick={handleAdd}>
            Create
          </CustomButton>
        </center> */}
      </CustomCard>
    </div>
  );
}
