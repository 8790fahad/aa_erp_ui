/* eslint-disable react/prop-types */
import { Table } from "reactstrap";
import { MdDeleteForever } from "react-icons/md";
import { formatNumber } from "@/utilities";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import SearchCustomerInput from "../../customer/components/SearchCustomerInput";
import { formatNumber1 } from "@/components/router/utilities";

function CartList({
  setSelectedCustomer = {},
  handleSubmit = (f) => f,
  handleDelete = (f) => f,
  submitting,
  taxes = [],
  selectedTaxes = [],
  setSelectedTaxes = (f) => f,
  calculateTotalTax = () => 0,
  getTotalWithTax = () => 0,
  cart = [],
  saleType = "credit",
}) {
  let subtotal = cart
    .filter((item) => item?.status === "for sale")
    .reduce((a, b) => a + parseFloat(b?.amount), 0);
  let totalTax = calculateTotalTax();
  let total = getTotalWithTax();
  let checkout = `Complete ${
    saleType === "cash" ? "Cash" : "Credit"
  } Sale ₦ ${formatNumber1(total)}`;
  return (
    <CustomCard outline container="p-0" body="p-0" header="Cart">
      {/* {JSON.stringify(setSelectedCustomer)} */}
      {/* <CardTitle className="text-center">Cart List</CardTitle> */}
      <div className="p-1">
        <SearchCustomerInput
          label="Customer Name"
          onChange={(v) => {
            setSelectedCustomer(v[0]);
          }}
        />

        {/* VAT Selection */}
        <div className="mb-3">
          <label className="form-label small">Apply VAT:</label>
          <div className="row">
            {taxes
              .filter(
                (tax) =>
                  tax.description.toLowerCase().includes("vat") &&
                  tax.tax_type === "exclusive"
              )
              .map((tax) => (
                <div key={tax.id} className="col-12 mb-1">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`tax-${tax.id}`}
                      checked={selectedTaxes.some((t) => t.id === tax.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTaxes([...selectedTaxes, tax]);
                        } else {
                          setSelectedTaxes(
                            selectedTaxes.filter((t) => t.id !== tax.id)
                          );
                        }
                      }}
                    />
                    <label
                      className="form-check-label small"
                      htmlFor={`tax-${tax.id}`}
                    >
                      {tax.description} ({tax.rate}%)
                    </label>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div style={{ height: "50vh", overflow: "scroll" }}>
          <Table size="sm">
            <thead>
              <tr>
                <th className="text-center">Item</th>
                {/* <th className="text-center">Type</th> */}
                <th className="text-center">Qty</th>
                <th className="text-center">Price</th>
                <th className="text-center">Total</th>
                <th className="text-center">X</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item, i) => (
                <tr key={i}>
                  <td>{item?.item_name}</td>

                  <td className="text-center">
                    {formatNumber(item?.quantity)}
                  </td>
                  <td className="text-right">{formatNumber1(item?.price)}</td>
                  <td className="text-right">{formatNumber1(item?.amount)}</td>
                  <td
                    className="text-right text-danger"
                    onClick={() => handleDelete(i)}
                  >
                    <MdDeleteForever size="20" />{" "}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        {/* Amount Summary */}
        <div className="mb-3 p-2 bg-light rounded">
          <div className="d-flex justify-content-between">
            <span>Subtotal:</span>
            <span>₦{formatNumber1(subtotal)}</span>
          </div>
          <div className="d-flex justify-content-between">
            <span>Tax:</span>
            <span>₦{formatNumber1(totalTax)}</span>
          </div>
          <hr className="my-1" />
          <div className="d-flex justify-content-between font-weight-bold">
            <span>Total Amount:</span>
            <span>₦{formatNumber1(total)}</span>
          </div>
        </div>
        <center className="mt-1">
          <CustomButton
            loading={submitting}
            // disabled={total <= 0}
            onClick={(e) => {
              handleSubmit(e);
            }}
            className="px-5"
          >
            {checkout}
          </CustomButton>
        </center>
      </div>
    </CustomCard>
  );
}

export default CartList;
