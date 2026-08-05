/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, CardBody, Col, Input, Label, Row, Table } from "reactstrap";
import { useSelector } from "react-redux";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { _fetchApi, _postApi } from "@/redux/actions/api";

import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import { FaCartPlus } from "react-icons/fa";
import { toast } from "sonner";
import SearchCustomerInput from "../../customer/components/SearchCustomerInput";
import { FiDelete } from "react-icons/fi";

export default function CollectionForm() {
  const inputRef = useRef();
  const { user = {}, activeBusiness = {} } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [materialData, setMaterialData] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState([]);
  const [pass, setPass] = useState("");
  const [saleData, setSaleData] = useState([]);
  const [payableData, setPayableData] = useState([]);
  const [rawMaterialData, setRawMaterialData] = useState([]);
  const [form, setForm] = useState({
    date: moment().format("YYYY-MM-DD"),
    customer: "",
    branch: user.branch_name,
    type_of_material: "",
    quantity: "",
    rate: "",
    amount: 0,
    discount: 0,
    amount_lost: 0,
  });

  const validateForm = () => {
    let isValid = true;

    if (!form.customerNo) {
      toast.error("Customer is required");
      isValid = false;
    }

    if (!form.type_of_material) {
      toast.error("Type of Material is required");
      isValid = false;
    }

    if (!form.quantity) {
      toast.error("Quantity is required");
      isValid = false;
    }

    return isValid;
  };

  const navigate = useNavigate();

  const handleChange = ({ target: { name, value } }) => {
    if (
      name === "quantity" &&
      Number(value) > Number(form.available_quantity)
    ) {
      toast.error(
        `${value} cannot exceed available quantity of ${form.available_quantity}`
      );
      return;
    }
    if (name === "type_of_material") {
      const selectedMaterial = materialData.find(
        (item) => item.entrie_id === value
      );
      if (selectedMaterial) {
        setForm((prev) => ({
          ...prev,
          type: selectedMaterial.type,
          [name]: selectedMaterial.material_type,
          entry_id: selectedMaterial.entrie_id,
          unit: selectedMaterial.unit || "Kilogram (kg)",
          available_quantity: Number(
            selectedMaterial.quantity -
              materials
                .filter((mat) => mat.entry_id === selectedMaterial.entrie_id)
                .reduce((acc, mat) => acc + mat.quantity, 0)
          ),
          rate: selectedMaterial.rate || 0,
        }));
        return;
      } else {
        setForm((prev) => ({
          ...prev,
          unit: "",
          available_quantity: 0,
          rate: 0,
          entry_id: "",
        }));
        return;
      }
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddMaterial = () => {
    if (validateForm()) {
      setMaterials((prev) => [...prev, form]);
      setForm((p) => ({
        ...p,
        date: moment().format("YYYY-MM-DD"),
        branch: user.branch_name,
        type_of_material: "",
        quantity: "",
        rate: 0,
        amount: 0,
        unit: "",
        available_quantity: 0,
        entry_id: "",
        amount_lost: 0,
        quantity_lost: 0,
      }));
    }
  };

  useEffect(() => {
    const amount = Number(form.quantity) * Number(form.rate);
    setForm((prev) => ({ ...prev, amount }));
  }, [form.quantity, form.rate]);

  useEffect(() => {
    if (form.collection_type === "full") {
      const lost = Number(form.available_quantity - form.quantity);
      const amount_lost = Number(form.quantity_lost) * Number(form.rate);
      setForm((prev) => ({ ...prev, quantity_lost: lost }));
    } else {
      setForm((p) => ({ ...p, lost: 0 }));
    }
  }, [form.available_quantity, form.quantity, form.collection_type]);

  const handleDelete = (index) => {
    setMaterials((prev) => prev.filter((_, i) => i !== index));
  };

  const getMaterialData = useCallback(() => {
    if (!form?.customerNo) {
      setMaterialData([]);
      return;
    }
    _postApi(
      `/v1/materials/getCollectionMaterials`,
      {
        customerNo: form?.customerNo,
        status: "finished_goods",
      },
      (res) => {
        if (res.success && res.results) {
          setMaterialData(res.results);
        }
        setLoading(false);
      },
      (err) => {
        toast.error("Error Occurred");
        console.error(err);
        setLoading(false);
      }
    );
  }, [form?.customerNo]);

  useEffect(() => {
    getMaterialData();
  }, [form?.customerNo]);

  const getSalesData = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=sales`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setSaleData(
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
    getSalesData();
  }, []);

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

  const totalAmount = materials.reduce(
    (acc, mat) => acc + mat.quantity * mat.rate,
    0
  );

  const handleSubmit = () => {
    if (!pass) {
      toast.error("Pass is required");
      return;
    }
    setLoading(true);

    const createEntry = (
      amount,
      account_description,
      account_head,
      account_subhead,
      query_type
    ) => ({
      amount,
      account_description,
      account_head,
      account_subhead,
      query_type,
    });

    const salesEntries = saleData.map((item) =>
      createEntry(totalAmount, item.name, item.code, item.chart_code, "net")
    );

    const customerEntries = createEntry(
      totalAmount,
      selectedCustomer?.fullname,
      selectedCustomer?.customerNo,
      selectedCustomer?.subhead,
      "tax"
    );

    const data = {
      salesEntries,
      customerEntries,
      transaction_date: form.date, // ✅ Pass the date from form
    };

    _postApi(
      `/v1/materials/insertCollectionMaterials`,
      {
        materials,
        customerNo: selectedCustomer?.customerNo,
        customerName: selectedCustomer?.fullname,
        pass,
        query_type: "insert",
        user_id: user.id,
      },
      (res) => {
        if (res.success) {
          _postApi(
            `/v1/materials/insertCollectionProductionLedger`,
            data,
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
          navigate(`/app/production/collection`);
        }
        setLoading(false);
      },
      (err) => {
        toast.error("Error Occurred");
        console.error(err);
        setLoading(false);
      }
    );
  };

  return (
    <CustomCard back header="Issue Material">
      {/* {JSON.stringify({ materialData, selectedCustomer, totalAmount })} */}
      <CardBody>
        <Row>
          <Col md={4}>
            <Label>Date</Label>
            <Input
              type="date"
              name="date"
              value={form.date}
              disabled
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
              onChange={(selectedItems) => {
                if (materials.length === 0) {
                  if (selectedItems.length > 0) {
                    const { customerNo, fullname } = selectedItems[0];
                    setForm((prevForm) => ({
                      ...prevForm,
                      customerNo,
                      customerName: fullname,
                    }));
                    setSelectedCustomer(selectedItems[0]);
                  } else {
                    setForm((prevForm) => ({
                      ...prevForm,
                      customerNo: "",
                      customerName: "",
                    }));
                  }
                }
              }}
              color={activeBusiness.primary_color}
            />
          </Col>
          <Col md={4}>
            <Label>Type of Material</Label>
            <select
              disabled={!form?.customerNo}
              className="form-select"
              name="type_of_material"
              value={form.entry_id}
              onChange={handleChange}
              style={{
                borderColor: activeBusiness.primary_color,
                borderWidth: 2,
              }}
            >
              <option value="">Select Type of Material</option>
              {materialData
                .filter(
                  (item) =>
                    !materials.some(
                      (mat) =>
                        mat.entry_id === item.entrie_id &&
                        mat.quantity >= item.quantity
                    )
                )
                .map((item) => ({
                  ...item,
                  quantity: Number(
                    item.quantity -
                      materials
                        .filter((mat) => mat.entry_id === item.entrie_id)
                        .reduce((acc, mat) => acc + mat.quantity, 0)
                  ),
                }))
                .map((item) => (
                  <option key={item.id} value={item.entrie_id}>
                    {item.material_type} - {item.type}
                  </option>
                ))}
            </select>
          </Col>
        </Row>

        <Row className="mt-2">
          <Col md={4}>
            <Label>Available Quantity</Label>
            <div
              className="p-1.5 h-10 bg-light border-2 rounded"
              style={{ borderColor: activeBusiness.primary_color }}
            >
              {form.available_quantity} {form.unit}
            </div>
          </Col>

          <Col md={4}>
            <Label>Rate</Label>
            <Input
              type="text"
              disabled
              name="rate"
              value={form.rate}
              onChange={handleChange}
              style={{
                borderColor: activeBusiness.primary_color,
                borderWidth: 2,
              }}
            />
          </Col>
          <Col md={4}>
            <Label>Type of Collection</Label>
            <select
              className="form-select"
              name="collection_type"
              value={form.collection_type}
              onChange={(e) => {
                if (e.target.value === "full") {
                  setForm((prev) => ({
                    ...prev,
                    // quantity: prev.available_quantity,
                    // quantity_lost: 0,
                    collection_type: e.target.value,
                  }));
                } else {
                  setForm((prev) => ({
                    ...prev,
                    collection_type: e.target.value,
                    quantity_lost: 0,
                  }));
                }
              }}
              style={{
                borderColor: activeBusiness.primary_color,
                borderWidth: 2,
              }}
            >
              <option value="">Select</option>
              <option value="partial">Partial</option>
              <option value="full">Full</option>
            </select>
          </Col>
          {form.collection_type && (
            <Col md={4}>
              <Label className="d-flex justify-content-between">
                Quantity (Max: {form.available_quantity || 0})
                {form.available_quantity && form.available_quantity > 0 && (
                  <span
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        quantity: prev.available_quantity,
                      }))
                    }
                    className="text-primary cursor-pointer"
                  >
                    MAX
                  </span>
                )}
              </Label>
              <Input
                type="number"
                name="quantity"
                disabled={!form.available_quantity}
                max={form.available_quantity}
                value={form.quantity}
                onChange={handleChange}
                style={{
                  borderColor: activeBusiness.primary_color,
                  borderWidth: 2,
                }}
              />
            </Col>
          )}

          {form.collection_type === "full" && (
            <Col md={4}>
              <Label>Quantity Lost</Label>
              <Input
                type="number"
                disabled
                name="quantity_lost"
                value={form.quantity_lost}
                style={{
                  borderColor: activeBusiness.primary_color,
                  borderWidth: 2,
                }}
              />
            </Col>
          )}
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
        {materials.length > 0 && (
          <Row>
            <Col md={4}></Col>
            <Col md={4}></Col>
            <Col md={4} className="mt-2">
              <Label>Pass Card No.</Label>
              <Input
                type="text"
                name="pass_card_no"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                style={{
                  borderColor: activeBusiness.primary_color,
                  borderWidth: 2,
                }}
              />
            </Col>
          </Row>
        )}

        {materials.length > 0 && (
          <Table responsive>
            <thead>
              <tr>
                <th style={{ width: "20%" }}>Material</th>
                {/* <th style={{ width: "20%" }}>Unit</th> */}
                <th style={{ width: "20%" }}>Quantity</th>
                <th style={{ width: "20%" }}>Quantity Lost</th>
                {/* <th style={{ width: "20%" }}>Amount (₦)</th> */}
                {/* <th style={{ width: "20%" }}>Discount (₦)</th> */}
                <th style={{ width: "20%" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((item, index) => (
                <tr key={index}>
                  <td>
                    {item.type_of_material} - {item.type}
                  </td>
                  {/* <td>{item.unit}</td> */}
                  <td>
                    {item.quantity} {item.unit}
                  </td>
                  <td>
                    {item.quantity_lost} {item.unit}
                  </td>
                  {/* <td>{formatNumber1(item.rate)}</td> */}
                  {/* <td>{formatNumber1(item.amount)}</td> */}
                  {/* <td>{formatNumber1(item.discount)}</td> */}
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
  );
}
