import { useCallback, useEffect, useRef, useState } from "react";
import { CardBody, Col, Container, Input, Label, Row, Table, Card, CardHeader, Badge } from "reactstrap";
import { useSelector } from "react-redux";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Typeahead } from "react-bootstrap-typeahead";
import { FaEdit, FaSave, FaPlus, FaTrash, FaTimes, FaShoppingCart, FaBox, FaClipboardList, FaUser, FaCalendar } from "react-icons/fa";
import { MdAdd, MdDelete, MdOutlineCancel, MdBusiness } from "react-icons/md";

import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import { formatNumber1 } from "@/components/router/utilities";
import { formatNumber2 } from "@/components/router/utilities";
import { formatNumber } from "@/utilities";
import SearchSupplierInput from "./SearchSuppliers";
import PurchaseRequisitionAPI from "./purchaseRequisitionApi";

export default function PurchaseRequisition() {
  const inputRef = useRef();
  const { user = {}, activeBusiness = {} } = useSelector((state) => state.auth);
  
  // State management
  const [stores, setStores] = useState([]);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [editExpense, setEditExpense] = useState({});
  const [newExpense, setNewExpense] = useState({
    item: "",
    quantity: "",
    category: "",
    unit: "",
  });
  
  const [form, setForm] = useState({
    date: moment().format("YYYY-MM-DD"),
    requisitor: user.fullname || user.username,
    branch: user.branch_name,
    reason: "",
    expenses: [],
  });

  const [errors, setErrors] = useState({
    branch: "",
    reason: "",
  });

  // Validation function
  const validateForm = () => {
    const newErrors = {
      branch: "",
      reason: "",
    };

    let isValid = true;

    if (!form.branch) {
      toast.error("Branch is required");
      isValid = false;
    }

    if (!form.reason) {
      toast.error("Reason for purchase is required");
      isValid = false;
    }

    if (expenses.length === 0) {
      isValid = false;
      toast.error("Requisition details is required");
    }

    setErrors(newErrors);
    return isValid;
  };

  const navigate = useNavigate();

  // API calls using the new API service
  const getProductList = useCallback(async () => {
    if (!activeBusiness?.id) return;
    
    try {
      setLoading(true);
      const response = await PurchaseRequisitionAPI.getProductList(activeBusiness.id);
      setItems(response.data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [activeBusiness.id]);

  const getBranches = useCallback(async () => {
    if (!activeBusiness?.id) return;
    
    try {
      const response = await PurchaseRequisitionAPI.getBranches(activeBusiness.id);
      setStores(response.data);
    } catch (error) {
      toast.error(error.message);
    }
  }, [activeBusiness.id]);

  const getCategories = useCallback(async () => {
    if (!activeBusiness?.id) return;
    
    try {
      const response = await PurchaseRequisitionAPI.getCategories(activeBusiness.id);
      setCategories(response.data);
    } catch (error) {
      toast.error(error.message);
    }
  }, [activeBusiness.id]);

  // Effects
  useEffect(() => {
    getProductList();
    getBranches();
    getCategories();
  }, [getProductList, getBranches, getCategories]);

  // Event handlers
  const handleChange = ({ target: { name, value } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleAddExpense = () => {
    if (newExpense.item && newExpense.quantity && newExpense.category && newExpense.unit) {
      setExpenses((prev) => [...prev, newExpense]);
      setNewExpense({ item: "", quantity: "", category: "", unit: "" });
      inputRef.current.focus();
      inputRef.current.clear();
    } else {
      toast.error("Please fill in all required fields");
    }
  };

  const handleEditExpense = (index) => {
    setEditIndex(index);
    setEditExpense(expenses[index]);
  };

  const handleSaveEdit = (index) => {
    const updatedExpenses = [...expenses];
    updatedExpenses[index] = editExpense;
    setExpenses(updatedExpenses);
    setEditIndex(null);
    setEditExpense({});
  };

  const handleCancelEdit = () => {
    setEditIndex(null);
    setEditExpense({});
  };

  const handleDeleteExpense = (index) => {
    setExpenses((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (expenses.length === 0) {
      toast.error("Please add at least one expense before submitting.");
      return;
    }

    setLoading(true);
    
    try {
      const requisitionData = {
        ...form,
        prefix: activeBusiness.prefix,
        expenses,
        user_id: user.id,
      };

      const response = await PurchaseRequisitionAPI.submitPurchaseRequisition(requisitionData);
      toast.success(response.message);
      
      // Navigate to purchase order PDF with the PR number
      // if (response.pr_no) {
        navigate(`/app/purchase/purchase-order-pdf?pr_no=${response.pr_no}`);
      // } else {
      //   navigate(-1);
      // }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <CustomCard back header="Purchase requisition">
        {/* {JSON.stringify(categories?.map((c) => c))} */}
        <CardBody>
          <Row>
            <Col md={6}>
              <Label>Date</Label>
              <Input type="date" name="date" value={form.date} disabled />
            </Col>
            <Col md={6}>
              <Label>Name</Label>
              <Input
                type="text"
                name="requisitor"
                value={form.requisitor}
                disabled
              />
            </Col>
            <Col md={6} className="mt-2">
              <SearchSupplierInput
                label="Preferred vendor/supplier"
                // onInputChange={(v) =>
                //   setForm((p) => ({
                //     ...p,
                //     supplier_name: v,
                //     supplier_code: UUIDV4(),
                //   }))
                // }
                onChange={
                  (s) => 
                  setForm((p) => ({
                    ...p,
                    supplier_name: s.supplier_name,
                    supplier_code: s.supplier_number,
                    account_code: s.supplier_subhead,
                  })
                  )
                }
              />
            </Col>

            <Col md={6} className="mt-2">
              <div className="form-group">
                <Label className="fw-bold text-muted small mb-2">
                  Department <span className="text-danger">*</span>
                </Label>
                <Typeahead
                  id="single-select-typeahead"
                  size="md"
                  className="custom-typeahead-border"
                  options={stores}
                  placeholder="Select warehouse..."
                  onChange={(selectedItems) =>
                    setForm((prev) => ({
                      ...prev,
                      branch_id: selectedItems[0]?.branch_id || "",
                      branch: selectedItems[0]?.branch_name || "",
                    }))
                  }
                  selected={
                    form.branch_id
                      ? [
                          {
                            branch_id: form.branch_id,
                            branch_name: form.branch,
                          },
                        ]
                      : []
                  }
                  labelKey="branch_name"
                  style={{
                    borderRadius: "8px",
                  }}
                />
                {errors.branch && (
                  <div className="text-danger mt-1 small">{errors.branch}</div>
                )}
              </div>
            </Col>
          </Row>
          {/* </CardBody>
          </Card> */}

          {/* Reason for Purchase */}

          <div className="form-group my-3">
            <Label className="fw-bold text-muted small mb-2">
              Reason for Purchase <span className="text-danger">*</span>
            </Label>
            <Input
              type="textarea"
              name="reason"
              value={form.reason}
              onChange={handleChange}
              invalid={!!errors.reason}
              rows={4}
              className="form-control-lg"
              placeholder="Please provide a detailed reason for this purchase requisition..."
              style={{ borderRadius: "8px" }}
            />
            {errors.reason && (
              <div className="text-danger mt-1 small">{errors.reason}</div>
            )}
          </div>

          {/* Requisition Details */}

          <div className="d-flex justify-content-between align-items-center mb-4">
            <h5 className="mb-0 fw-bold text-dark"></h5>
            <Badge color="info" className="px-3 py-2">
              <span className="fw-bold">
                {expenses.length} Item{expenses.length !== 1 ? "s" : ""}
              </span>
            </Badge>
          </div>

          <div className="table-responsive">
            <Table className="table-hover" style={{ borderRadius: "8px" }}>
              <thead style={{ backgroundColor: "#f8f9fa" }}>
                <tr>
                  <th style={{ width: "5%" }} className="text-center">
                    #
                  </th>
                  <th style={{ width: "35%" }}>Item Description</th>
                  <th style={{ width: "15%" }} className="text-center">
                    Quantity
                  </th>
                  <th style={{ width: "20%" }}>Category</th>
                  <th style={{ width: "15%" }}>Unit</th>
                  <th className="text-center" style={{ width: "10%" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Add New Item Row */}
                <tr style={{ backgroundColor: "#f0f8ff" }}>
                  <td className="text-center fw-bold text-muted">
                    {/* <FaPlus size={14} /> */}
                  </td>
                  <td>
                    <Typeahead
                      id="expense-item-typeahead"
                      size="sm"
                      className="custom-typeahead-border"
                      options={items}
                      placeholder="Search and select item..."
                      onChange={(selectedItems) =>
                        setNewExpense((prev) => ({
                          ...prev,
                          item: selectedItems[0]?.name || "",
                          item_code: selectedItems[0]?.code || "",
                          chart_code: selectedItems[0]?.chart_code || "",
                          subhead: selectedItems[0]?.subhead || "",
                        }))
                      }
                      ref={inputRef}
                      labelKey={(option) => `${option.name} (${option.code})`}
                      style={{ borderRadius: "6px" }}
                    />
                  </td>

                  <td>
                    <Input
                      type="number"
                      name="quantity"
                      value={newExpense.quantity}
                      onChange={(e) =>
                        setNewExpense({
                          ...newExpense,
                          quantity: Number(e.target.value),
                        })
                      }
                      className="form-control-sm text-center"
                      placeholder="0"
                      min="1"
                      style={{ borderRadius: "6px" }}
                    />
                  </td>

                  <td>
                    <select
                      className="form-select form-select-sm"
                      value={newExpense.category}
                      onChange={(e) => {
                        setNewExpense({
                          ...newExpense,
                          category: e.target.value,
                          category_code: e.target.value,
                        });
                        setUnits(
                          categories?.find(
                            (sup) => sup.category === e.target.value
                          )?.units || []
                        );
                      }}
                      style={{ borderRadius: "6px" }}
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
                      className="form-select form-select-sm"
                      value={newExpense.unit}
                      onChange={(e) => {
                        setNewExpense({
                          ...newExpense,
                          unit: e.target.value,
                          unit_code: e.target.value,
                        });
                      }}
                      style={{ borderRadius: "6px" }}
                    >
                      <option value="">Select unit</option>
                      {units?.map((sup) => (
                        <option key={sup} value={sup}>
                          {sup}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="text-center">
                    <CustomButton
                      size="sm"
                      onClick={handleAddExpense}
                      className="btn-success rounded-pill px-3 flex items-center"
                      disabled={
                        !newExpense.item ||
                        !newExpense.quantity ||
                        !newExpense.category ||
                        !newExpense.unit
                      }
                      title="Add item to requisition"
                    >
                      <FaPlus size={14} className="me-1" /> Add
                    </CustomButton>
                  </td>
                </tr>

                {/* Existing Items */}
                {expenses.map((expense, index) => (
                  <tr key={index} className="align-middle">
                    {editIndex === index ? (
                      <>
                        <td className="text-center fw-bold text-muted">
                          {index + 1}
                        </td>
                        <td>
                          <Typeahead
                            id="expense-item-typeahead"
                            size="sm"
                            // selected={editExpense.item}
                            // selected={`${editExpense.item} (${editExpense.item_code})`}
                            className="custom-typeahead-border"
                            options={items}
                            placeholder="Search and select item..."
                            onChange={(selectedItems) =>
                              setEditExpense((prev) => ({
                                ...editExpense,
                                item: selectedItems[0]?.name || "",
                                item_code: selectedItems[0]?.code || "",
                                chart_code: selectedItems[0]?.chart_code || "",
                                subhead: selectedItems[0]?.subhead || "",
                              }))
                            }
                            ref={inputRef}
                            labelKey={(option) =>
                              `${option.name} (${option.code})`
                            }
                            style={{ borderRadius: "6px" }}
                          />
                          <Input
                            value={editExpense.item}
                            onChange={(e) =>
                              setEditExpense({
                                ...editExpense,
                                item: e.target.value,
                              })
                            }
                            className="form-control-sm"
                            style={{ borderRadius: "6px" }}
                          />
                        </td>
                        <td>
                          <Input
                            type="number"
                            value={editExpense.quantity}
                            onChange={(e) =>
                              setEditExpense({
                                ...editExpense,
                                quantity: Number(e.target.value),
                              })
                            }
                            className="form-control-sm text-center"
                            min="1"
                            style={{ borderRadius: "6px" }}
                          />
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={editExpense.category}
                            onChange={(e) => {
                              setEditExpense({
                                ...editExpense,
                                category: e.target.value,
                                category_code: e.target.value,
                              });
                              setUnits(
                                categories?.find(
                                  (sup) => sup.category === e.target.value
                                )?.units || []
                              );
                            }}
                            style={{ borderRadius: "6px" }}
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
                            className="form-select form-select-sm"
                            value={editExpense.unit}
                            onChange={(e) => {
                              setEditExpense({
                                ...editExpense,
                                unit: e.target.value,
                                unit_code: e.target.value,
                              });
                            }}
                            style={{ borderRadius: "6px" }}
                          >
                            <option value="">Select unit</option>
                            {units?.map((sup) => (
                              <option key={sup} value={sup}>
                                {sup}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="text-center">
                          <div className="d-flex justify-content-center gap-1">
                            <CustomButton
                              size="sm"
                              onClick={() => handleSaveEdit(index)}
                              className="btn-success rounded-pill px-2"
                              title="Save changes"
                            >
                              <FaSave size={12} />
                            </CustomButton>
                            <CustomButton
                              size="sm"
                              color="danger"
                              onClick={handleCancelEdit}
                              className="rounded-pill px-2"
                              title="Cancel editing"
                            >
                              <FaTimes size={12} />
                            </CustomButton>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="text-center fw-bold text-muted">
                          {index + 1}
                        </td>
                        <td className="fw-medium">{expense.item}</td>
                        <td className="text-center">
                          <Badge color="primary" className="px-3 py-2">
                            {expense.quantity}
                          </Badge>
                        </td>
                        <td>
                          <Badge color="info" className="px-2 py-1">
                            {expense.category}
                          </Badge>
                        </td>
                        <td>{expense.unit}</td>
                        <td className="text-center">
                          <div className="d-flex justify-content-center gap-1">
                            {/* <CustomButton
                              size="sm"
                              className="btn-outline-primary rounded-pill px-2"
                              onClick={() => handleEditExpense(index)}
                              title="Edit item"
                            >
                              <FaEdit size={12} />
                            </CustomButton> */}
                            <CustomButton
                              size="md"
                              className="btn-outline-dange px-2"
                              onClick={() => handleDeleteExpense(index)}
                              title="Remove item"
                            >
                              <FaTrash size={12} />
                            </CustomButton>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>

            {/* Empty State */}
            {expenses.length === 0 && (
              <div className="text-center py-2 text-muted">
                <p className="mb-0">
                  No items added yet. Add items to create your requisition.
                </p>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-center pt-4">
            <CustomButton
              size="md"
              loading={loading}
              onClick={handleSubmit}
              className="btn-primary  flex"
              disabled={expenses.length === 0}
            >
              <FaShoppingCart className="me-2" size={20} />
              Submit Purchase Requisition
            </CustomButton>
          </div>
        </CardBody>
      </CustomCard>
    </Container>
  );
}