/* eslint-disable no-unused-vars */
import CustomCard from "@/common/Custom/CustomCard2";
import React, { useState } from "react";
import { CardBody, Col, Input, Label, Row, Table } from "reactstrap";
import { Alert } from "reactstrap";

export default function AccountReview() {
  const _form = {
    from: "",
    to: "",
    search: "",
  };
  const [form, setForm] = useState(_form);
  const [data, setData] = useState([]);

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleAdd = () => {};
  return (
    <div>
      <CustomCard header="Review Account Report">
        <CardBody>
          <Row>
            <Col md={4}>
              <Label>From:</Label>
              <Input
                type="date"
                name="from"
                value={form.from}
                onChange={handleChange}
              />
            </Col>
            <Col md={4}></Col>
            <Col md={4}>
              <Label>To:</Label>
              <Input
                type="date"
                name="to"
                value={form.to}
                onChange={handleChange}
              />
            </Col>
            <Col md={12} className="mt-3">
              <Input
                type="search"
                name="search"
                value={form.search}
                onChange={handleChange}
              />
            </Col>
          </Row>
          <center>
            <Alert className="mt-3 mb-3">
              There is no pending transaction at this time, check back later.
            </Alert>
          </center>
          <Row>
            <Table bordered>
              <thead>
                <tr>
                  <th>S/N</th>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Patient Name</th>
                  <th>Total Amount (₦)</th>
                  <th>Amount Paid (₦)</th>
                  <th>Balance (₦)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </Table>
          </Row>
        </CardBody>
      </CustomCard>
    </div>
  );
}
