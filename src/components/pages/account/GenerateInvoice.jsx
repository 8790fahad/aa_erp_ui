/* eslint-disable no-unused-vars */
import React, { useState } from "react";
import { Button, CardBody } from "reactstrap";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import CustomCard from "@/common/Custom/CustomCard2";
import CommonSelect from "@/common/Custom/CommonSelect";
import Datatable from "@/common/Custom/DataTable";
import { invoiceNumber, paymentMethod, transactionDate } from "./selectOption";

export default function GenerateInvoice() {
  const _form = {
    expenditure_type: "",
    date: "",
    select_source_account: "",
    collected_by: "",
    total_amount: "",
    mode_of_payment: "",
    narrition: "",
  };

  const navigate = useNavigate();
  const [form, setForm] = useState(_form);
  const [data, setData] = useState([]);

  const handleChange = ({ target: { name, value } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const createInvoice = () => {
    navigate("/app/account/invoice");
  };

  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  const columns = [
    {
      title: "Invoice Number",
      dataIndex: "invoiceNumber",
      sorter: (a, b) => a.invoiceNumber.length - b.invoiceNumber.length,
      render: (text) => (
        <Link
          to="#"
          className="link-primary"
          data-bs-toggle="modal"
          data-bs-target="#view_invoice"
        >
          {text}
        </Link>
      ),
    },
    {
      title: "Date",
      dataIndex: "date",
      sorter: (a, b) => a.date.localeCompare(b.date),
    },
    {
      title: "Description",
      dataIndex: "description",
      sorter: (a, b) => a.description.localeCompare(b.description),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      sorter: (a, b) => a.amount - b.amount,
    },
    {
      title: "Payment Method",
      dataIndex: "paymentMethod",
      sorter: (a, b) => a.paymentMethod.localeCompare(b.paymentMethod),
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      sorter: (a, b) => a.dueDate.localeCompare(b.dueDate),
    },
    {
      title: "Status",
      dataIndex: "status",
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (status) => (
        <span
          className={`badge badge-soft-${status.toLowerCase()} d-flex align-items-center`}
        >
          <i className="ti ti-circle-filled fs-5 me-1" />
          {status}
        </span>
      ),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: () => (
        <div className="dropdown">
          <Link
            to="#"
            className="btn btn-white btn-icon btn-sm"
            data-bs-toggle="dropdown"
          >
            <i className="ti ti-dots-vertical fs-14" />
          </Link>
          <ul className="dropdown-menu dropdown-menu-right p-3">
            <li>
              <Link
                className="dropdown-item"
                to="#"
                data-bs-toggle="modal"
                data-bs-target="#view_invoice"
              >
                <i className="ti ti-menu me-2" /> View Invoice
              </Link>
            </li>
            <li>
              <Link className="dropdown-item" to="/edit-invoice">
                <i className="ti ti-edit-circle me-2" /> Edit
              </Link>
            </li>
            <li>
              <Link
                className="dropdown-item"
                to="#"
                data-bs-toggle="modal"
                data-bs-target="#delete-modal"
              >
                <i className="ti ti-trash-x me-2" /> Delete
              </Link>
            </li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <div>
      <CustomCard header="Generate Invoice">
        <CardBody>
          <div className="card-header d-flex justify-content-between align-items-center">
            <h4>Invoices List</h4>
            <div className="d-flex">
              {/* Add Invoice Button */}
              <Button
                onClick={createInvoice}
                className="btn me-2"
                style={{
                  backgroundColor: activeBusiness?.primary_color,
                  color: activeBusiness?.secondary_color,
                }}
              >
                Add Invoice
              </Button>

              {/* Filter Dropdown */}
              <div className="dropdown me-2">
                <Link
                  to="#"
                  className="btn btn-white dropdown-toggle"
                  data-bs-toggle="dropdown"
                >
                  <i className="ti ti-filter me-2" /> Filter
                </Link>
                <div className="dropdown-menu p-3">
                  <form>
                    <h4 className="border-bottom p-3">Filter</h4>
                    <div className="p-3">
                      <div className="row">
                        <div className="col-md-6 mb-3">
                          <label>Invoice Number</label>
                          <CommonSelect
                            options={invoiceNumber}
                            defaultValue={invoiceNumber[0]}
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label>Date</label>
                          <CommonSelect
                            options={transactionDate}
                            defaultValue={transactionDate[0]}
                          />
                        </div>
                        <div className="col-md-12 mb-3">
                          <label>Payment Method</label>
                          <CommonSelect
                            options={paymentMethod}
                            defaultValue={paymentMethod[0]}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="p-3 d-flex justify-content-end">
                      <Link to="#" className="btn btn-light me-3">
                        Reset
                      </Link>
                      <button type="submit" className="btn btn-primary">
                        Apply
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Sort Dropdown */}
              <div className="dropdown">
                <Link
                  to="#"
                  className="btn btn-outline-light bg-white dropdown-toggle"
                  data-bs-toggle="dropdown"
                >
                  <i className="ti ti-sort-ascending-2 me-2" /> Sort by A-Z
                </Link>
                <ul className="dropdown-menu p-3">
                  <li>
                    <Link to="#" className="dropdown-item active">
                      Ascending
                    </Link>
                  </li>
                  <li>
                    <Link to="#" className="dropdown-item">
                      Descending
                    </Link>
                  </li>
                  <li>
                    <Link to="#" className="dropdown-item">
                      Recently Viewed
                    </Link>
                  </li>
                  <li>
                    <Link to="#" className="dropdown-item">
                      Recently Added
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Invoice List */}
          <div className="card-body p-0 py-3">
            <Datatable dataSource={data} columns={columns} Selection={true} />
          </div>
        </CardBody>
      </CustomCard>
    </div>
  );
}
