/* eslint-disable no-unused-vars */
import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import React, { useState } from "react";
import {
  Col,
  Container,
  Input,
  Label,
  Row,
} from "reactstrap";

export default function CashMovement() {
  const _form = {
    date: "",
    from: "",
    to: "",
    amount: "",
    comment_optinal: "",
  };
  const [form, setForm] = useState(_form);

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
      <CustomCard header="Cash Movement">
        <Container>
          <Row>
            <div>
              <Row>
                <Col md={6}></Col>
                <Col md={6}>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                  />
                </Col>
                <Col md={6}>
                  <Label>From</Label>
                  <Input
                    type="select"
                    name="from"
                    value={form.from}
                    onChange={handleChange}
                  >
                    <option>---select---</option>
                    <option>10000 - Demo Specialist Hospital Limited</option>
                    <option>20000 - Revenue</option>
                    <option>30000 - Expenses</option>
                    <option>40000 - Asset</option>
                    <option>50000 - Equity & Liability</option>
                    <option>40001 - Non Current Assets</option>
                    <option>40002 - Current Asset</option>
                    <option>400021 - Cash</option>
                    <option>400022 - Bank</option>
                  </Input>
                </Col>
                <Col md={6}>
                  <Label>To</Label>
                  <Input
                    type="select"
                    name="to"
                    value={form.to}
                    onChange={handleChange}
                  />
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
                <Col md={6}>
                  <Label>Comment (Optional)</Label>
                  <Input
                    type="text"
                    name="comment_optinal"
                    value={form.comment_optinal}
                    onChange={handleChange}
                  />
                </Col>
              </Row>
              <center>
                <CustomButton className="mt-3" onClick={handleAdd}>
                  Move Money Now
                </CustomButton>
              </center>
            </div>
          </Row>
        </Container>
      </CustomCard>
    </div>
  );
}
