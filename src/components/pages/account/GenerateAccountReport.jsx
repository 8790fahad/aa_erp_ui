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
  Table,
} from "reactstrap";

export default function GenerateAccountReport() {
  const _form = {
    from: "",
    to: "",
    select_report_type: "",
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
      <CustomCard header="Daily Total">
        <Container>
          <div>
          <Row>
              <Col>
                <div>
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
                      <Label>To</Label>
                      <Input
                        type="date"
                        name="to"
                        value={form.to}
                        onChange={handleChange}
                      />
                    </Col>
                    <Col md={6} className="mb-5"> 
                      <Label>Select Report Type</Label>
                      <Input
                        type="select"
                        name="select_report_type"
                        value={form.select_report_type}
                        onChange={handleChange}
                      >
                        <option>------select-----</option>
                        <option>Daily Total</option>
                        <option>Petient Income</option>
                        <option>Sumary Of Sales And Expenses</option>
                        <option>Revenue</option>
                        <option>Expenses</option>
                        <option>Statement Of Financial Position</option>
                        <option>Trial Balance</option>
                      </Input>
                    </Col>
                    <Col md={6} className="mt-4">
                      <CustomButton onClick={handleAdd}>
                        Export/Download
                      </CustomButton>
                    </Col>
                   
                  </Row>
                </div>
              </Col>
            </Row>
            <Row>

            </Row>
            
            <Row>
              
              <Table bordered>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Paid (₦)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                </tbody>
              </Table>
            </Row>
          </div>
        </Container>
      </CustomCard>
    </div>
  );
}
