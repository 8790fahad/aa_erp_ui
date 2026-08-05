/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { CardBody, Col, Container, Input, Label, Row, Table } from "reactstrap";
import { useSelector } from "react-redux";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { _fetchApi, _postApi } from "@/redux/actions/api";

import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import { FaEdit, FaSave } from "react-icons/fa";
import { MdAdd, MdDelete, MdOutlineCancel } from "react-icons/md";
import { Typeahead } from "react-bootstrap-typeahead";
import { toast } from "sonner";
import { formatNumber } from "@/utilities";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber1 } from "@/components/router/utilities";

export default function ManufacturingRequisition() {
  const inputRef = useRef();
  const { user = {}, activeBusiness = {} } = useSelector((state) => state.auth);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [editMaterial, setEditMaterial] = useState({});

  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [newMaterial, setNewMaterial] = useState({
    item_name: "",
    item_code: "",
    initiated_qty: "",
    category: "",
    unit_of_measure: "",
  });
  const [form, setForm] = useState({
    date: moment().format("YYYY-MM-DD"),
    requisitor: user.fullname || user.username,
    notes: "",
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    let isValid = true;
    const newErrors = {};

    if (materials.length === 0) {
      toast.error("Requisition details are required");
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const navigate = useNavigate();

  const getProductList = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list-2?query_type=select`,
      {
        facilityId: activeBusiness.id,
        type: "Raw Material",
      },
      (resp) => {
        if (resp.success) {
          console.log("Product List:", resp.results);
          setItems(
            resp.results.map((item) => ({
              ...item,
              item_name: item.item_name,
              item_code: item.item_code,
              category: item.category,
              unit_of_measure: item.unit_of_measure,
              cost_price: item.cost_price,
              selling_price: item.selling_price,
              stock_quantity: item.stock_quantity,
              status: item.status,
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
    getProductList();
  }, []);

  const handleChange = ({ target: { name, value } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleAddMaterial = () => {
    if (newMaterial.item_name && newMaterial.initiated_qty) {
      setMaterials((prev) => [...prev, { ...newMaterial, id: Date.now() }]);
      setNewMaterial({
        item_name: "",
        item_code: "",
        initiated_qty: "",
        category: "",
        unit_of_measure: "",
      });
      inputRef.current?.focus();
      inputRef.current?.clear();
    } else {
      toast.error("Please select an item and enter quantity");
    }
  };

  const handleEditMaterial = (index) => {
    setEditIndex(index);
    setEditMaterial(materials[index]);
  };

  const handleSaveEdit = (index) => {
    const updatedMaterials = [...materials];
    updatedMaterials[index] = editMaterial;
    setMaterials(updatedMaterials);
    setEditIndex(null);
    setEditMaterial({});
  };

  const handleCancelEdit = () => {
    setEditIndex(null);
    setEditMaterial({});
  };

  const handleDeleteMaterial = (index) => {
    setMaterials((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    setLoading(true);

    _postApi(
      `/api/production/material-requisitions/create`,
      {
        facilityId: activeBusiness.id,
        quantityRequired: materials.reduce(
          (sum, item) => sum + (Number(item.initiated_qty) || 0),
          0
        ),
        priority: "medium",
        notes: form.notes || "",
        materials: materials.map((item) => ({
          product_id: item.id,
          item_name: item.item_name,
          item_code: item.item_code,
          category: item.category,
          unit_of_measure: item.unit_of_measure,
          quantity_requested: Number(item.initiated_qty),
          unit_cost: Number(item.cost_price) || 0,
          notes: "",
        })),
        createdBy: user.id,
      },
      (res) => {
        setLoading(false);
        if (res.success) {
          toast.success("Material Requisition created successfully");
          navigate("/app/production/requisition");
        } else {
          toast.error(res.message || "Failed to create material requisition");
        }
      },
      (err) => {
        toast.error(err?.message || "Error Occurred");
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

  return (
    <Container>
      <CustomCard back header="Material Requisition">
        <CardBody>
          <Row>
            <Col md={6}>
              <Label>Date</Label>
              <Input type="date" name="date" value={form.date} disabled />
            </Col>
            <Col md={6}>
              <Label>Requisitor</Label>
              <Input
                type="text"
                name="requisitor"
                value={form.requisitor}
                disabled
              />
            </Col>
            <Col md={12} className="mt-2">
              <Label>Notes</Label>
              <Textarea
                name="notes"
                onChange={handleChange}
                value={form.notes}
              />
            </Col>
          </Row>
          <Label className="mt-4 d-flex justify-content-between">
            Requisition Details
            <span className="text-muted small">
              {materials.length} item(s) added
            </span>
          </Label>
          <div className="table-responsive">
            <Table responsive>
              <thead className="thead-dark">
                <tr>
                  <th style={{ width: "20%" }}>Item</th>
                  <th style={{ width: "15%" }}>SKU</th>
                  <th style={{ width: "15%" }}>Unit</th>
                  <th style={{ width: "15%" }}>Quantity</th>
                  {/* <th style={{ width: "15%" }}>Unit Price</th> */}
                  <th style={{ width: "10%" }} className="text-center">
                    Action
                  </th>
                </tr>
              </thead>
              {/* {JSON.stringify(items,"=====")} */}
              <tbody>
                <tr>
                  <td>
                    <Typeahead
                      id="material-typeahead-new"
                      ref={inputRef}
                      options={items}
                      className="z-100"
                      placeholder="Select item..."
                      onChange={(selected) => {
                        const selectedItem = selected[0];
                        if (selectedItem) {
                          setNewMaterial((prev) => ({
                            ...prev,
                            ...selectedItem,
                            item_name: selectedItem.item_name || "",
                            item_code: selectedItem.item_code || "",
                            category: selectedItem.category || "",
                            unit_of_measure: selectedItem.unit_of_measure || "",
                          }));

                          // Set units based on category
                          if (selectedItem.category) {
                            const categoryUnits =
                              categories?.find(
                                (cat) => cat.category === selectedItem.category
                              )?.units || [];
                            setUnits(categoryUnits);
                          }
                        }
                      }}
                      labelKey={(option) =>
                        `${option.item_name} (${option.item_code})`
                      }
                    />
                  </td>
                  <td>{newMaterial.item_code}</td>
                  <td>
                    {newMaterial.category} ({newMaterial.unit_of_measure})
                  </td>

                  <td>
                    <Input
                      type="number"
                      name="initiated_qty"
                      value={newMaterial.initiated_qty}
                      onChange={(e) =>
                        setNewMaterial((prev) => ({
                          ...prev,
                          initiated_qty: e.target.value,
                        }))
                      }
                      placeholder="Quantity"
                    />
                  </td>
                  {/* <td>
                  <Input
                    type="text"
                    value={newMaterial.cost_price ? Number(newMaterial.cost_price).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }) : "0.00"}
                    disabled
                  />
                </td> */}
                  <td className="text-center flex justify-center items-center">
                    <CustomButton
                      size="sm"
                      color="primary"
                      onClick={handleAddMaterial}
                    >
                      <MdAdd size="20" />
                    </CustomButton>
                  </td>
                </tr>

                {materials.map((mat, index) => (
                  <tr key={index}>
                    {editIndex === index ? (
                      <>
                        <td>
                          <Input
                            value={editMaterial.item_name}
                            onChange={(e) =>
                              setEditMaterial({
                                ...editMaterial,
                                item_name: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
                          <select
                            className="form-select"
                            required
                            value={editMaterial.category}
                            onChange={(e) => {
                              setEditMaterial({
                                ...editMaterial,
                                category: e.target.value,
                              });
                            }}
                          >
                            <option value="">Select category</option>
                            {categories?.map((sup) => (
                              <option key={sup.category} value={sup.category}>
                                {sup.category}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="form-select"
                            required
                            value={editMaterial.unit_of_measure}
                            onChange={(e) => {
                              setEditMaterial({
                                ...editMaterial,
                                unit_of_measure: e.target.value,
                              });
                            }}
                          >
                            <option value="">Select unit</option>
                            {units?.map((sup) => (
                              <option key={sup} value={sup}>
                                {sup}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <Input
                            type="number"
                            value={editMaterial.initiated_qty}
                            className="text-center"
                            onChange={(e) =>
                              setEditMaterial({
                                ...editMaterial,
                                initiated_qty: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
                          <Input
                            type="text"
                            value={
                              editMaterial.cost_price
                                ? Number(
                                    editMaterial.cost_price
                                  ).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : "0.00"
                            }
                            disabled
                          />
                        </td>
                        <td className="text-center">
                          <div className="d-flex justify-content-center gap-1">
                            <CustomButton
                              size="sm"
                              color="success"
                              onClick={() => handleSaveEdit(index)}
                            >
                              <FaSave size="16" />
                            </CustomButton>
                            <CustomButton
                              size="sm"
                              color="secondary"
                              onClick={handleCancelEdit}
                            >
                              <MdOutlineCancel size="16" />
                            </CustomButton>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{mat.item_code}</td>
                        <td>{mat.item_name}</td>
                        <td>
                          {mat.category}({mat.unit_of_measure})
                        </td>
                        <td className="text-center">
                          {formatNumber1(mat.initiated_qty)}
                        </td>
                        <td className="text-center">
                          <div className="d-flex justify-content-center gap-1">
                            <CustomButton
                              size="sm"
                              color="warning"
                              onClick={() => handleEditMaterial(index)}
                            >
                              <FaEdit size="16" />
                            </CustomButton>
                            <CustomButton
                              size="sm"
                              color="danger"
                              onClick={() => handleDeleteMaterial(index)}
                            >
                              <MdDelete size="16" />
                            </CustomButton>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {materials.length > 0 && (
                  <tr className="table-secondary">
                    <td colSpan="3" className="text-end fw-bold">
                      Total Items:
                    </td>
                    <td className="text-center fw-bold">{materials.length}</td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>

          {materials.length === 0 && (
            <div className="text-center py-4 text-muted">
              <p>
                No materials added yet. Please add materials to the requisition.
              </p>
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center mt-3">
            <div>
              <CustomButton onClick={() => navigate(-1)}>Back</CustomButton>
            </div>
            <div>
              <CustomButton
                loading={loading}
                color="primary"
                onClick={handleSubmit}
                disabled={materials.length === 0}
              >
                Submit Requisition
              </CustomButton>
            </div>
          </div>
        </CardBody>
      </CustomCard>
    </Container>
  );
}
