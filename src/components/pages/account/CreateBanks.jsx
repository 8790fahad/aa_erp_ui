/* eslint-disable no-unused-vars */
import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import { _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { Plus, Save } from "lucide-react";
import moment from "moment";
import React, { useState } from "react";
import { useSelector } from "react-redux";
import { Col, Container, Input, Label, Row, Table } from "reactstrap";

export const account_type = [
  { value: "revenue", label: "Revenue Bank" },
  { value: "expenditure", label: "Expenditure Bank" },
];

export default function CreateBanks() {
  const today = moment().format("YYYY-MM-DD");
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  // Initial form state
  const _form = {
    account_name: "",
    account_number: "",
    bank_name: "",
    bank_code: "",
    account_type: "",
  };

  const [form, setForm] = useState(_form);
  const [bankList, setBankList] = useState([]); // Store added banks

  // Handle input change
  const handleChange = ({ target: { name, value } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Add bank to table
  const handleAddBank = () => {
    if (
      !form.account_name ||
      !form.account_number ||
      !form.bank_name ||
      !form.bank_code
    ) {
      toast.error("All fields are required!");
      return;
    }

    setBankList((prev) => [...prev, form]);
    setForm(_form); // Reset form
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (bankList.length === 0) {
      toaster.warning("No bank details to submit.");
      return;
    }
    _postApi(
      `/account/bank/new?query_type=insert_bank`,
      { banks: bankList, store: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          toaster.success("Bank details saved successfully.");
          setBankList([]);
        } else {
          toast.error("Failed to save bank details.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong.");
      }
    );
  };

  return (
    <div>
      <CustomCard header="Create Bank">
        <Container>
          <Row>
            <Col md={4}>
              <Label>Account Name</Label>
              <Input
                type="text"
                name="account_name"
                value={form.account_name}
                onChange={handleChange}
              />
            </Col>
            <Col md={4}>
              <Label>Account Number</Label>
              <Input
                type="number"
                name="account_number"
                value={form.account_number}
                onChange={handleChange}
              />
            </Col>
            <Col md={4}>
              <Label>Account Type</Label>
              <Input
                type="select"
                name="account_type"
                value={form.account_type}
                onChange={handleChange}
              >
                <option value="">Select........</option>
                {account_type.map((exp) => (
                  <option key={exp.value} value={exp.value}>
                    {exp.label}
                  </option>
                ))}
              </Input>
            </Col>
            <Col md={4}>
              <Label>Bank Name</Label>
              <Input
                type="text"
                name="bank_name"
                value={form.bank_name}
                onChange={handleChange}
              />
            </Col>
            <Col md={4}>
              <Label>Bank Code</Label>
              <Input
                type="number"
                name="bank_code"
                value={form.bank_code}
                onChange={handleChange}
              />
            </Col>
            <Col md={4}>
              <Label>Account Type</Label>
              <Input
                type="select"
                name="account_type"
                value={form.account_type}
                onChange={handleChange}
              >
                <option value="">Select........</option>
                {account_type.map((exp) => (
                  <option key={exp.value} value={exp.value}>
                    {exp.label}
                  </option>
                ))}
              </Input>
            </Col>
          </Row>

          <Row>
            <Col md={12}>
              <center>
                <CustomButton
                  className="mt-2 mb-2 d-flex align-items-center gap-2"
                  onClick={handleAddBank}
                >
                  <Plus size={18} />
                  Add Bank
                </CustomButton>
              </center>
            </Col>

            {/* Bank Details Table */}
            <Table bordered>
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Account Number</th>
                  <th>Bank Name</th>
                  <th>Bank Code</th>
                </tr>
              </thead>
              <tbody>
                {bankList.map((bank, index) => (
                  <tr key={index}>
                    <td>{bank.account_name}</td>
                    <td>{bank.account_number}</td>
                    <td>{bank.bank_name}</td>
                    <td>{bank.bank_code}</td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <Col md={12}>
              <center style={bankList.length === 0 ? { display: "none" } : {}}>
                <CustomButton
                  className="mt-2 mb-2 d-flex align-items-center gap-2"
                  onClick={handleSubmit}
                >
                  <Save size={18} />
                  Submit Bank Details
                </CustomButton>
              </center>
            </Col>
          </Row>
        </Container>
      </CustomCard>
    </div>
  );
}
