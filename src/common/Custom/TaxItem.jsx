/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React, { useState } from "react";
import PropTypes from "prop-types";
import { formatNumber } from "@/utilities";
import TextInput from "./TextInput";
import { Edit } from "lucide-react";
import { Col } from "reactstrap";
import { FormCheck } from "react-bootstrap";

// Define prop types for validation
TaxItem.propTypes = {
  item: PropTypes.shape({
    description: PropTypes.string,
    rate_type: PropTypes.string,
    rate: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    tax_type: PropTypes.string,
  }),
  index: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  taxesApplied: PropTypes.arrayOf(PropTypes.object),
  setTaxesApplied: PropTypes.func,
  form: PropTypes.shape({
    amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
};

function TaxItem({
  item = {},
  index = 0,
  taxesApplied = [],
  setTaxesApplied = () => {},
  expense,
  form = {},
}) {
  const [isEdit, setIsEdit] = useState(false);
  let _amount = Number(expense.unitCost) * Number(expense.quantity);
  const selectedAppliedIndex = taxesApplied.findIndex((i) => i.id === item.id);
  const isSelected = selectedAppliedIndex !== -1;

  // Calculate tax amount safely
  const calculateTaxAmount = () => {
    const amount = parseFloat(_amount) || 0;
    const rate = parseFloat(item.rate) || 0;

    if (item.rate_type === "percentage" && item.tax_type === "inclusive") {
      return ((rate / (100 + rate)) * amount).toFixed(2);
    }
    if (item.rate_type === "percentage") {
      return ((rate / 100) * amount).toFixed(2);
    }
    return rate.toFixed(2);
  };

  const amount = calculateTaxAmount();
  const checkBoxIsDisabled =Number(_amount)

  const handleCheckboxChange = () => {
    if (!isSelected) {
      const taxObj = {
        ...item,
        description: item.description,
        amount,
      };
      setTaxesApplied((prev) => [...prev, taxObj]);
    } else {
      const newList = taxesApplied.filter((a) => a.id !== item.id);
      setTaxesApplied(newList);
    }
  };

  const handleAmountChange = (value) => {
    const newTaxAppliedArr = taxesApplied.map((tax, idx) =>
      idx === selectedAppliedIndex ? { ...tax, amount: value } : tax
    );
    setTaxesApplied(newTaxAppliedArr);
  };

  return (
    <Col md={3} className="mb-1">
      {/* {JSON.stringify(_amount)} */}
      <div className="d-flex flex-row align-items-center">
        <div className="me-4">
          <label htmlFor={`${item.description}-${index}`}>
            {item.description} ({item.tax_type})
          </label>
          <FormCheck
            id={`${item.description}-${index}`}
            title={
              checkBoxIsDisabled ? "Please enter an amount" : item.description
            }
            // disabled={checkBoxIsDisabled}
            type="checkbox"
            className="ms-2"
            checked={isSelected}
            onChange={handleCheckboxChange}
          />
        </div>
        {isSelected && !isEdit && (
          <div>
            (₦{formatNumber(taxesApplied[selectedAppliedIndex].amount)}){" "}
            <a
              href="#"
              className="ms-2"
              onClick={(e) => {
                e.preventDefault();
                setIsEdit(true);
              }}
            >
              <Edit size={16} /> edit
            </a>
          </div>
        )}
      </div>

      {isSelected && isEdit && (
        <TextInput
          size="sm"
          label={`Enter new value for ${item.description}`}
          value={taxesApplied[selectedAppliedIndex].amount}
          onChange={(e) => handleAmountChange(e.target.value)}
        />
      )}
    </Col>
  );
}

export default TaxItem;
