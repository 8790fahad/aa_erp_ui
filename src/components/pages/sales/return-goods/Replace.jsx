
import CustomCard from "@/common/Custom/CustomCard2";
import { FiDelete } from "react-icons/fi";
import { useDispatch } from "react-redux";
// import { useSelector } from 'react-redux'
import {
 
  CardBody,

  Table,
  Row,
  Col,
  Button,
} from "reactstrap";
import SearchItemInput from "../make-sales/SearchItem";

import { CustomButton } from "@/common/ui-elements";
import { formatNumber } from "@/utilities";
import TextInput from "@/common/Custom/TextInput";



export default function Replace({
  _ref,
  theme,
  form = {},
  handleChange = (f) => f,
  itemDetails = {},
  setSelected,
  handleAdd = (f) => f,
  data,
  handleDelete = (f) => f,
  selling_price,
  returnItem,
  selected,
  handleQtyChanges,
  handleSubmit,
  returnAmt,
  repRef,
  amount_paid,
  loading,
}) {
  const dispatch = useDispatch();
  const total_rep = data
    .filter((item) => item.type === "replace")
    .reduce((a, b) => a + parseInt(b.selling_price) * parseInt(b.quantity), 0);
  const total_ret = data
    .filter((item) => item.type === "return")
    .reduce((a, b) => a + parseInt(b.selling_price) * parseInt(b.quantity), 0);

  return (
    <CustomCard header="Replace Item">
      {/* <CardHeader
        className="text-white border border-dark"
        style={{ backgroundColor: theme.primary_color }}
      >
        Replace Item
      </CardHeader> */}

      <CardBody className="bg-white">
        {/* {JSON.stringify(form)} */}
        <Row className="m-0">
          <Col md="6" className="p-0">
            <SearchItemInput
              label="Item Name"
              _ref={_ref}
              disabled
              onInputChange={(v) => setSelected(v)}
              onChange={(v) => setSelected(v)}
            />
          </Col>
          <Col md="6" className="p-0">
            <TextInput
              container="col-md-12"
              type="number"
              className="mb-2"
              label="Quantity Return"
              placeholder="quantity"
              name="ret_quantity"
              value={form.ret_quantity}
              onChange={handleQtyChanges}
            />
          </Col>
          <Col md="6" className="p-0">
            <SearchItemInput
              _ref={repRef}
              labelKey="item_name"
              label="Replace With"
              onChange={(v) => setSelected([v])}
              onInputChange={(v) => setSelected([v])}
            />
          </Col>
          <Col md="6" className="p-0">
            <TextInput
              container="col-md-12"
              type="number"
              className="mb-2"
              label="Quantity Replace"
              placeholder="quantity"
              name="rep_quantity"
              value={form.rep_quantity}
              onChange={handleChange}
            />
          </Col>
          <Col>
            Remaining Qty:{" "}
            <span className="font-weight-bold">{itemDetails.quantity}</span>
          </Col>
          <Col>
            Selling Price:
            <span className="font-weight-bold">
              {formatNumber(itemDetails.selling_price)}
            </span>
          </Col>
          <Col>
            Expiry Date:
            <span className="font-weight-bold">{itemDetails.expiry_date}</span>
          </Col>
        </Row>
        <center>
          <CustomButton className="m-2" onClick={handleAdd}>
            Add to cart
          </CustomButton>
        </center>
        {/* {JSON.stringify(data)} */}
        <Table striped bordered>
          <tr>
            <th className="text-center">Item Name</th>
            <th className="text-center">Selling Price</th>
            <th className="text-center">Qty</th>
            <th className="text-center">Amount</th>
            <th className="text-center">Status</th>
            <th className="text-center">X</th>
          </tr>

          {data.map((item, i) =>
            item.item_name || item.description ? (
              <tr key={i}>
                {/* {JSON.stringify()} */}
                <td>{item.item_name ? item.item_name : item.description}</td>
                <td className="text-right">
                  {formatNumber(item.selling_price)}
                </td>
                <td className="text-center">{formatNumber(item.quantity)}</td>
                <td className="text-right">
                  {formatNumber(item.selling_price * item.quantity)}
                </td>
                <td>{item.type}</td>
                <td>
                  <Button
                    onClick={() => handleDelete(i)}
                    className="btn-danger"
                    size="sm"
                  >
                    <FiDelete />
                  </Button>
                </td>
              </tr>
            ) : null
          )}
        </Table>

        <div className="d-flex flex-direction-row justify-content-between mb-1">
          <div>
            Total Amount Returned:{" "}
            <span className="font-weight-bold">{formatNumber(total_ret)}</span>
          </div>
          <div className="">
            Total Replace Amount:{" "}
            <span className="font-weight-bold">{formatNumber(total_rep)}</span>
          </div>
        </div>
        <span>
          Total Balance to be paid:{" "}
          <b>{formatNumber(parseFloat(total_rep || 0) - parseFloat(total_ret))}</b>
        </span>

        <Row>
          <Col md="6" className="p-0">
            <TextInput
              container="col-md-12"
              type="number"
              className="mb-2"
              label="Amount Paid"
              name="amountPaid"
              value={amount_paid}
              onChange={({ target: { value } }) => {
                dispatch({ type: "AMOUNT_PAID", payload: value });
              }}
            />
          </Col>
          <Col md="6" className="p-0">
            <TextInput
              container="col-md-12"
              type="number"
              className="mb-2"
              label="Discount"
              name="discount"
              value={form.discount}
              onChange={handleChange}
            />
          </Col>
        </Row>
        <center>
          <CustomButton
            className="px-5 m-2"
            onClick={handleSubmit}
            loading={loading}
          >
            ₦{formatNumber(amount_paid)} Submit
          </CustomButton>
        </center>
      </CardBody>
    </CustomCard>
  );
}
