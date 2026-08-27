/* eslint-disable no-unused-vars */
import React, { useState } from "react";
import { Button, Container, Row } from "reactstrap";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { customerName, productName } from "./selectOption";
import CustomCard from "@/common/Custom/CustomCard2";
import CommonSelect from "@/common/Custom/CommonSelect";
import CustomerList from "@/common/Custom/CustomerList";
import { Trash } from "lucide-react";

export default function Invoice() {
  const history = useNavigate();
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  // State for form data
  const [invoiceData, setInvoiceData] = useState({
    selectedProduct: { value: "", label: "" },
    customerName: customerName[0], // default value
    invoiceNumber: "INV681537",
    invoiceDate: "",
    dueDate: "",
    products: [
      {
        productName: productName[0], // default product
        quantity: 2,
        unitPrice: 500,
        discount: 5,
        netAmount: 450,
      },
    ],
    subtotal: 500,
    discount: 50,
    tax: 10,
    total: 460,
    signatureName: "",
  });

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInvoiceData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  // Handle product changes
  const handleProductChange = (index, field, value) => {
    const updatedProducts = invoiceData.products.map((product, idx) =>
      idx === index ? { ...product, [field]: value } : product
    );
    setInvoiceData((prevState) => ({
      ...prevState,
      products: updatedProducts,
    }));
  };

  const addProductRow = () => {
    setInvoiceData((prevState) => ({
      ...prevState,
      products: [
        ...prevState.products,
        {
          productName: productName[0], // default product
          quantity: 1,
          unitPrice: 0,
          discount: 0,
          netAmount: 0,
        },
      ],
    }));
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    // Construct the object to send to the database
    const formData = {
      customerName: invoiceData.customerName,
      invoiceNumber: invoiceData.invoiceNumber,
      invoiceDate: invoiceData.invoiceDate,
      dueDate: invoiceData.dueDate,
      products: invoiceData.products,
      subtotal: invoiceData.subtotal,
      discount: invoiceData.discount,
      tax: invoiceData.tax,
      total: invoiceData.total,
      signatureName: invoiceData.signatureName,
    };

    // console.log("Form Data:", formData);
    // Send this formData object to your backend API
    // Example: axios.post('/api/invoice', formData);
  };

  const goBack = () => {
    history(-1);
  };

  return (
    <>
      {/* <Row> */}
        <CustomCard back header="Invoice">
          <Container>
            <div className="row">
              <div className="col-md-12 px-0">
                <form onSubmit={handleSubmit}>
                  <div>
                    <div className="card-body p-0">

                      {/* Customer Information */}
                      <div className="card shadow rounded">
                        <div className="card-header bg-light">
                          <div className="d-flex align-items-center">
                            <h4 className="text-dark">Customer Information</h4>
                          </div>
                        </div>
                        <div className="card-body pb-0">
                          <div className="info-section">
                            <div className="row">
                              <div className="col-lg-3 col-md-6">
                                <div className="mb-3">
                                  <CustomerList />
                                </div>
                              </div>
                              <div className="col-lg-3 col-md-6">
                                <div className="mb-3">
                                  <label className="form-label">
                                    Invoice Number
                                  </label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    name="invoiceNumber"
                                    value={invoiceData.invoiceNumber}
                                    onChange={handleInputChange}
                                  />
                                </div>
                              </div>
                              <div className="col-lg-3 col-md-6">
                                <div className="mb-3">
                                  <label className="form-label">
                                    Invoice Date
                                  </label>
                                  <input
                                    type="date"
                                    className="form-control"
                                    name="invoiceDate"
                                    value={invoiceData.invoiceDate}
                                    onChange={handleInputChange}
                                  />
                                </div>
                              </div>
                              <div className="col-lg-3 col-md-6">
                                <div className="mb-3">
                                  <label className="form-label">Due Date</label>
                                  <input
                                    type="date"
                                    className="form-control"
                                    name="dueDate"
                                    value={invoiceData.dueDate}
                                    onChange={handleInputChange}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Product Information */}
                      <div className="card mt-3 shadow rounded">
                        <div className="card-header bg-light">
                          <div className="d-flex align-items-center">
                            <h4 className="text-dark">Product Information</h4>
                          </div>
                        </div>
                        <div className="card-body pb-0">
                          <div className="info-section">
                            <div className="row align-items-end">
                              <div className="col-lg-3 col-md-6">
                                <div className="mb-3">
                                  <label className="form-label">
                                    Product Name
                                  </label>
                                  <CommonSelect
                                    className="select"
                                    options={productName}
                                    value={invoiceData.selectedProduct.label}
                                    onChange={(value) => {
                                      console.log(value);
                                      setInvoiceData((p) => ({
                                        ...p,
                                        selectedProduct: value,
                                      }));
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="col-lg-3 col-md-6">
                                <div className="mb-3">
                                  <label className="form-label">Quantity</label>
                                  <input
                                    type="number"
                                    className="form-control"
                                    placeholder="Enter Quantity"
                                    defaultValue={2}
                                  />
                                </div>
                              </div>
                              <div className="col-lg-3">
                                <div className="mb-3">
                                  <Link to="#" className="btn btn-primary">
                                    <i className="ti ti-plus me-2" />
                                    Add to Bill
                                  </Link>
                                </div>
                              </div>
                              <div className="col-md-12">
                                <div className="invoice-product-table">
                                  <div className="table-responsive invoice-table">
                                    <table className="table">
                                      <thead>
                                        <tr>
                                          <th>Product Name</th>
                                          <th>Quantity</th>
                                          <th>Unit Price</th>
                                          <th>Discount</th>
                                          <th>Net Amount</th>
                                          <th>Action</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        <tr>
                                          <td>Uniform</td>
                                          <td>
                                            <input
                                              type="number"
                                              className="form-control"
                                              defaultValue={100}
                                            />
                                          </td>
                                          <td>
                                            <input
                                              type="text"
                                              className="form-control"
                                              defaultValue={500}
                                            />
                                          </td>
                                          <td>
                                            <input
                                              type="text"
                                              className="form-control"
                                              placeholder="%"
                                              defaultValue={5}
                                            />
                                          </td>
                                          <td>₦450</td>
                                          <td>
                                            <Link
                                              to="#"
                                              className="delete-invoive-list"
                                              data-bs-toggle="modal"
                                              data-bs-target="#delete-modal"
                                            >
                                              <Trash color="red" />
                                            </Link>
                                          </td>
                                        </tr>
                                        <tr>
                                          <td>Description</td>
                                          <td>
                                            <input
                                              type="number"
                                              className="form-control"
                                            />
                                          </td>
                                          <td>
                                            <input
                                              type="text"
                                              className="form-control"
                                            />
                                          </td>
                                          <td>
                                            <input
                                              type="text"
                                              className="form-control"
                                              placeholder="4%"
                                            />
                                          </td>
                                          <td>₦300</td>
                                          <td>
                                            <Link
                                              to="#"
                                              className="delete-invoive-list"
                                              data-bs-toggle="modal"
                                              data-bs-target="#delete-modal"
                                            >
                                              <Trash color="red" />
                                            </Link>
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Invoice Summary */}
                      <div className="invoice-info mt-4">
                        <div className="row">
                          <div className="col-xxl-9 col-lg-8 mb-sm-4">
                            <label className="fw-bold">
                              Message on invoice
                            </label>
                            <div>
                              <textarea
                                rows={5}
                                cols={6}
                                className="form-control"
                                placeholder=""
                                defaultValue={""}
                              />
                            </div>
                          </div>
                          <div className="col-xxl-3 col-lg-4 mt-4 shadow rounded">
                            <div className="invoice-amount-details">
                              <ul>
                                <li>
                                  <span>Subtotal</span>
                                  <h6>₦{invoiceData.subtotal}</h6>
                                </li>
                                <li>
                                  <span>Discount</span>
                                  <h6>₦{invoiceData.discount}</h6>
                                </li>
                                <li>
                                  <span>Tax</span>
                                  <h6>₦{invoiceData.tax}</h6>
                                </li>
                                <li>
                                  <h5>Total</h5>
                                  <h5>₦{invoiceData.total}</h5>
                                </li>
                              </ul>
                              <div className="mb-3">
                                <label className="form-label">
                                  Signature Name
                                </label>
                                <input
                                  type="text"
                                  className="form-control"
                                  name="signatureName"
                                  value={invoiceData.signatureName}
                                  onChange={handleInputChange}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Submit and Cancel Buttons */}
                      <div className="text-end mt-4">
                        <button
                          type="button"
                          className="btn btn-light me-3"
                          onClick={goBack}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn"
                          style={{
                            backgroundColor: activeBusiness?.primary_color,
                            color: activeBusiness.secondary_color,
                            marginLeft: "7px",
                          }}
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </Container>
        </CustomCard>
      {/* </Row> */}
    </>
  );
}
