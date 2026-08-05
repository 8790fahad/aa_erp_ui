/* eslint-disable no-unused-vars */
import CustomCard from "@/common/Custom/CustomCard2";
import React from "react";
import { useState } from "react";
import { CardBody, Col, Container, Input, Label, Row } from "reactstrap";

export default function OpeningBalance() {
  const _form = {
    date: "",
    select_account: "",
    amount: "",
  };
  const [form, setForm] = useState(_form);
  const [data, setData] = useState([]);

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({ ...p, [name]: value }));
  };
  const handleAdd = () => {
    // _postApi("classes", form, () => {
    setForm(_form);
    // },
    // (err) => console.log(err)
    // )
    console.log(_form);
  };
  return (
    <div>
      <CustomCard header="Opening Balance">
        <Container>
          <CardBody>
            <Row>
              <Col md={6}></Col>
              <Col md={6}>
                <Label>Date</Label>
                <Input
                  type="date"
                  name="date"
                  value={form.data}
                  onChange={handleChange}
                />
              </Col>
              <Col md={6}>
                <Label>Select Account</Label>
                <Input
                  type="select"
                  name="select_account"
                  value={form.select_account}
                  onChange={handleChange}
                >
                  <option> --------select---------</option>
                  <option> POS</option>
                  <option> CASH</option>
                  <option> Transfar</option>
                </Input>
              </Col>
              <Col md={6}>
                <Label>Amount</Label>
                <Input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                />
              </Col>
            </Row>
          </CardBody>
        </Container>
      </CustomCard>
    </div>
  );
}
