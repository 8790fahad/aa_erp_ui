
import { Row } from "reactstrap";
import SimpleInput from "../../../inventria/components/SimpleInput";
import PropTypes from "prop-types";
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

CustomerForm.propTypes = {
  form: PropTypes.object,
  handleFormChange: PropTypes.func,
  showDeposit: PropTypes.bool,
};  

export default CustomerForm;
