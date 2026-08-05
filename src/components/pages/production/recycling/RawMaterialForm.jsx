/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  CardBody,
  Col,
  Container,
  Input,
  Label,
  Row,
  Table,
} from "reactstrap";
import { useSelector } from "react-redux";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { _fetchApi, _postApi } from "@/redux/actions/api";

import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import { FaCartPlus, FaEdit, FaSave } from "react-icons/fa";
import { MdAdd, MdDelete, MdOutlineCancel } from "react-icons/md";
import { Typeahead } from "react-bootstrap-typeahead";
import { toast } from "sonner";
import { formatNumber } from "@/utilities";
import SearchCustomerInput from "../../customer/components/SearchCustomerInput";
import { FiDelete } from "react-icons/fi";
import { formatNumber1 } from "@/components/router/utilities";

export default function RawMaterialForm() {
  const inputRef = useRef();
  const { user = {}, activeBusiness = {} } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState([]);
  const [rate, setRate] = useState([]);
  const [rates, setRates] = useState([]);
  const [payableData, setPayableData] = useState([]);
  const [bankDetails, setBankDetails] = useState([]);
  const [rawMaterialData, setRawMaterialData] = useState([]);
  const [materialType, setMaterialType] = useState([
    { id: "black", name: "Black" },
    { id: "white", name: "White" },
    { id: "color", name: "Color" },
    { id: "others", name: "Others" },
  ]);

  const [form, setForm] = useState({
    date: moment().format("YYYY-MM-DD"),
    customer: "",
    branch: user.branch_name,
    type_of_material: "",
    quantity: "",
    rate: "",
    rate_discount: "",
    amount: 0,
    discount: 0,
    discount_type: "",
    category: "Weight / Mass",
    unit: "(Kg)",
  });

  const validateForm = () => {
    let isValid = true;

    if (!selectedCustomer.length) {
      toast.error("Customer is required");
      isValid = false;
    }

    if (!form.type_of_material?.trim()) {
      toast.error("Type of Material is required");
      isValid = false;
    }

    if (!form.category?.trim()) {
      toast.error("Category is required");
      isValid = false;
    }

    if (!form.unit?.trim()) {
      toast.error("Unit is required");
      isValid = false;
    }

    if (!form.quantity || isNaN(form.quantity) || Number(form.quantity) <= 0) {
      toast.error("Valid Quantity is required");
      isValid = false;
    }

    if (!form.rate || isNaN(form.rate) || Number(form.rate) <= 0) {
      toast.error("Valid Rate is required");
      isValid = false;
    }

    return isValid;
  };

  const navigate = useNavigate();

  const handleChange = ({ target: { name, value } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddMaterial = () => {
    if (!validateForm()) return;
    const rate = Number(form.rate) || 0;
    const rateDiscount = Number(form.rate_discount) || 0;
    setMaterials((prev) => [...prev, { ...form, rate: rate - rateDiscount }]);
    setForm({
      ...form,
      // date: moment().format("YYYY-MM-DD"),
      customer: "",
      branch: user.branch_name,
      type_of_material: "",
      quantity: "",
      rate_discount: 0,
      amount: 0,
      discount: 0,
    });
  };

  const getRateSetup = () => {
    // if (!selectedCustomer[0]?.customer_type) return;
    _postApi(
      `/inventory/product-list?query_type=rate`,
      {
        facilityId: activeBusiness.id,
        // category: selectedCustomer[0]?.customer_type,
      },
      (resp) => {
        if (resp.success && resp.results.length > 0) {
          setRate(resp.results);
          // setForm((prev) => ({
          //   ...prev,
          //   rate: resp?.results[0]?.amount,
          // }));
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    getRateSetup();
  }, []);
  // }, [selectedCustomer]);

  const getPayableData = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=payable`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setPayableData(
            resp.results.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
            }))
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    getPayableData();
  }, []);

  const getRawMaterialData = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=raw_materials`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setRawMaterialData(
            resp.results.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
            }))
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    getRawMaterialData();
  }, []);

  const totalAmount = materials.reduce((acc, item) => acc + item.amount, 0);
  const totalDiscount = materials.reduce((acc, item) => acc + item.discount, 0);
  const receiptNo = new Date().getTime();
  const handleSubmit = () => {
    // if (
    //   !selectedCustomer?.length ||
    // //   !payableData?.length ||
    //   !rawMaterialData?.length
    // ) {
    //   toast.error("Missing required data");
    //   return;
    // }

    if (materials.length === 0) {
      toast.error("No materials added");
      return;
    }

    console.log("Submitting with materials:", materials);

    const data = {
      payableDescription: payableData[0]?.name,
      payableCode: payableData[0]?.code,
      payableChartCode: payableData[0]?.chart_code,
      rawMaterialDescription: rawMaterialData[0]?.name,
      rawMaterialCode: rawMaterialData[0]?.code,
      rawMaterialChartCode: rawMaterialData[0]?.chart_code,
      totalAmount,
      receiptNo,
      query_type_1: "tax",
      query_type_2: "net",
      facilityId: activeBusiness.id,
    };

    setLoading(true);

    // First API call: insert materials
    _postApi(
      `/v1/materials/insert`,
      {
        customerNo: selectedCustomer[0].customerNo,
        customer_name: selectedCustomer[0].fullname,
        materials,
        query_type: "insert",
        user_id: user.id,
      },
      (res) => {
        if (res.success) {
          toast.success(
            `Materials Collected Successfully with collection Id of ${res.receiptNo}`
          );

          // Navigate to PDF preview
          navigate(
            `/app/production/raw-material-collected/collection-pdf?customerName=${selectedCustomer[0]?.fullname}&customer_id=${selectedCustomer[0]?.customerNo}&receiptNo=${res.receiptNo}&date=${form.date}`
          );

          // Second API call: insert material ledger
          _postApi(
            `/v1/materials/insertMaterialLedger`,
            { data },
            (ledgerRes) => {
              if (ledgerRes.success) {
                console.log("Ledger entry successful", ledgerRes);
              }
              setLoading(false);
            },
            (ledgerErr) => {
              toast.error("Error in ledger entry");
              console.error(ledgerErr);
              setLoading(false);
            }
          );
        } else {
          toast.error("Failed to insert materials");
          setLoading(false);
        }
      },
      (err) => {
        toast.error("Error occurred while submitting materials");
        console.error(err);
        setLoading(false);
      }
    );
  };

  const getCategory = useCallback(() => {
    _fetchApi(
      `/inventory/get-category?facilityId=${activeBusiness.id}`,
      (data) => {
        if (data.success) {
          setCategories(data.results);
        }
      },
      (err) => {
        console.error(err);
      }
    );
  }, [activeBusiness.id]);

  useEffect(() => {
    getCategory();
  }, [activeBusiness.id, getCategory]);

  useEffect(() => {
    let amount = 0;
    const qty = Number(form.quantity) || 0;
    const rate = Number(form.rate) || 0;
    const rateDiscount = Number(form.rate_discount) || 0;
    const discount = Number(form.discount) || 0;

    if (form.discount_type === "rate") {
      amount = (rate - rateDiscount) * qty;
    } else if (form.discount_type === "amount") {
      amount = rate * qty - discount;
    } else {
      amount = rate * qty;
    }

    setForm((prev) => ({ ...prev, amount }));
  }, [
    form.quantity,
    form.rate,
    form.rate_discount,
    form.discount,
    form.discount_type,
  ]);

  const getRevenueItems = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=select-all`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setBankDetails(
            resp.results.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
            }))
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    getRevenueItems();
  }, []);

  const handleDelete = (index) => {
    setMaterials((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Container>
      <CustomCard back header="Material Receive">
        {/* {JSON.stringify(form)} */}
        <CardBody>
          <Row>
            <Col md={4}>
              <Label>Date</Label>
              <Input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                // disabled
                style={{
                  borderColor: activeBusiness.primary_color,
                  borderWidth: 2,
                }}
              />
            </Col>
            <Col md={4}>
              <Label>Customer</Label>
              <SearchCustomerInput
                disabled={materials.length > 0}
                label="Select Customer"
                onChange={setSelectedCustomer}
                color={activeBusiness.primary_color}
              />
            </Col>
            <Col md={4}>
              <Label>Type of Material</Label>
              <select
                onChange={handleChange}
                name="type_of_material"
                value={form.type_of_material}
                className="form-select"
                style={{
                  borderColor: activeBusiness.primary_color,
                  borderWidth: 2,
                }}
              >
                <option value="">Select Type of Material</option>
                {materialType.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Col>
            <Col md={4}>
              <Label for="category">Category</Label>
              <Input name="category" value={form.category} disabled />
            </Col>
            <Col md={4}>
              <Label>Unit</Label>
              <Input name="unit" value={form.unit} disabled />
            </Col>

            <Col md={4}>
              <Label>Quantity</Label>
              <Input
                type="number"
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                style={{
                  borderColor: activeBusiness.primary_color,
                  borderWidth: 2,
                }}
              />
            </Col>
            <Col md={4} className="">
              <Label>Rate</Label>
              {/* <Input
                type="number"
                name="rate"
                value={form.rate}
                onChange={handleChange}
                style={{
                  borderColor: activeBusiness.primary_color,
                  borderWidth: 2,
                }}
              /> */}
              <select
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    rate: e.target.value,
                  }))
                }
                name="rate"
                value={form.rate}
                className="form-select"
                style={{
                  borderColor: activeBusiness.primary_color,
                  borderWidth: 2,
                }}
              >
                <option value="">Select Rate</option>
                {rate.map((rate) => (
                  <option key={rate.amount} value={rate.amount}>
                    {rate.rate} - {rate.amount}
                  </option>
                ))}
              </select>
            </Col>
            {/* <Col md={4} className="mt-2">
              <Label>Amount</Label>
              <div
                className="input"
                onInput={handleChange}
                style={{
                  borderColor: activeBusiness.primary_color,
                  borderWidth: 2,
                  padding: "0.375rem 0.75rem",
                  borderStyle: "solid",
                  borderRadius: "0.45rem",
                  outline: "none",
                  backgroundColor: "lightgray",
                }}
              >
                {formatNumber1(form.amount)}
              </div>
            </Col> */}
            {selectedCustomer[0]?.customer_type === "customers" && (
              <>
                <Col md={4}>
                  <Label>Discount type</Label>
                  <select
                    onChange={handleChange}
                    name="discount_type"
                    value={form.discount_type}
                    className="form-select"
                    style={{
                      borderColor: activeBusiness.primary_color,
                      borderWidth: 2,
                    }}
                  >
                    <option value="">Select Discount Type</option>
                    <option value="rate">Rate</option>
                    <option value="amount">General</option>
                  </select>
                </Col>
                {form.discount_type && (
                  <>
                    {form.discount_type === "rate" ? (
                      <Col md={4} className="">
                        <Label>Discount (%)</Label>
                        <Input
                          type="number"
                          name="rate_discount"
                          value={form.rate_discount}
                          onChange={handleChange}
                          style={{
                            borderColor: activeBusiness.primary_color,
                            borderWidth: 2,
                          }}
                        />
                      </Col>
                    ) : (
                      <Col md={4} className="">
                        <Label>Discount (₦)</Label>
                        <Input
                          type="number"
                          name="discount"
                          value={form.discount}
                          onChange={handleChange}
                          style={{
                            borderColor: activeBusiness.primary_color,
                            borderWidth: 2,
                          }}
                        />
                      </Col>
                    )}
                  </>
                )}
              </>
            )}

            {/* <Col md={4} className="mt-2">
              <Label>Account</Label>
              <Typeahead
                id="material-typeahead"
                ref={inputRef}
                options={bankDetails}
                className="z-100"
                placeholder="Select Mode of payment..."
                onChange={(selected) =>
                  setForm((prev) => ({
                    ...prev,
                    ...selected[0],
                    bank_name: selected[0]?.name || "",
                    bank_code: selected[0]?.code || "",
                    bank_chart_code: selected[0]?.chart_code || "",
                  }))
                }
                labelKey={(option) => `${option.name} - (${option.code})`}
              />
            </Col> */}
          </Row>

          <center>
            <CustomButton
              loading={loading}
              className="mt-3"
              onClick={handleAddMaterial}
            >
              Add
            </CustomButton>
          </center>

          {/* {JSON.stringify(materials)} */}

          {materials.length > 0 && (
            <Table responsive>
              <thead>
                <tr>
                  <th style={{ width: "20%" }}>Material</th>
                  <th style={{ width: "20%" }}>Unit</th>
                  <th style={{ width: "20%" }}>Quantity</th>
                  {/* <th style={{ width: "20%" }}>Rate (₦)</th> */}
                  {/* <th style={{ width: "20%" }}>Amount (₦)</th>
                  <th style={{ width: "20%" }}>Discount (₦)</th> */}
                  <th style={{ width: "20%" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((item, index) => (
                  <tr key={index}>
                    <td>{item.type_of_material}</td>
                    <td>{formatNumber(item.unit)}</td>
                    <td>{formatNumber(item.quantity)}</td>
                    {/* <td>{formatNumber1(item.rate)}</td> */}

                    {/* <td>{formatNumber1(item.amount)}</td>

                    <td>{formatNumber1(item.discount)}</td> */}
                    <td className="text-center">
                      <Button
                        size="sm"
                        onClick={() => handleDelete(index)}
                        className="btn btn-danger"
                      >
                        <FiDelete />
                      </Button>
                    </td>
                  </tr>
                ))}
                {/* <tr>
                  <td colSpan="4" className="text-end font-weight-bold">
                    Total
                  </td>
                  <td>{formatNumber1(totalAmount)}</td>
                  <td>{formatNumber1(totalDiscount)}</td>
                  <td></td>
                </tr> */}
              </tbody>
            </Table>
          )}
          {materials.length > 0 && (
            <div className="text-center">
              <CustomButton
                onClick={handleSubmit}
                loading={loading}
                className="px-5 d-flex align-items-center mx-auto"
              >
                <FaCartPlus className="mr-2" /> Submit
              </CustomButton>
            </div>
          )}
        </CardBody>
      </CustomCard>
    </Container>
  );
}
