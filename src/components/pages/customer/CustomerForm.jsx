import SimpleInput from "@/common/SimpleInput";
import React from "react";
import { Row } from "reactstrap";


function CustomerForm({
  form = {},
  handleFormChange = (f) => f,
  showDeposit = true,
}) {
  const fields = [
    {
      label: "Customer Name",
      name: "customerName",
      type: "text",
      value: form.customerName,
      required: true,
    },
    {
      label: "Customer Category",
      name: "customerCategory",
      type: "text",
      value: form.customerCategory,
      hide: true,
      // required: true,
    },
    {
      label: "Address",
      name: "address",
      type: "text",
      value: form.address,
      // required: true,
    },
    {
      label: "Phone",
      name: "phone",
      type: "number",
      value: form.phone,
      // required: true,
    },
    {
      label: "Email",
      name: "email",
      type: "text",
      value: form.email,
      // required: true,
    },
    {
      label: "Deposit Amount",
      name: "amount",
      type: "number",
      value: form.amount,
      hide: !showDeposit,
    },
  ];

  return (
    <Row>
      {fields.map((field, i) => {
        if (field.hide) {
          return null;
        } else {
          return (
            <SimpleInput
              key={i}
              field={field}
              size="6"
              handleChange={handleFormChange}
            />
          );
        }
      })}
    </Row>
  );
}

export default CustomerForm;
