import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { _fetchApi, _postApi } from '@/redux/actions/api';
import moment from 'moment';
import { toast } from 'sonner';

import {
  Container,
  Row,
  Col,
  Input,
  Label,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  FormGroup,
  Badge,
  Table
} from 'reactstrap';

import CustomCard from '@/common/Custom/CustomCard2';
import CustomButton from '@/common/Custom/CustomButton';
import { Typeahead } from 'react-bootstrap-typeahead';
import { FaTrash, FaPlus, FaBoxes, FaBoxOpen, FaEye } from 'react-icons/fa';

export default function ManufacturingGoodrecieve() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  // Form state
  const [form, setForm] = useState({
    receiveDate: moment().format("YYYY-MM-DD"),
    truckNumber: "",
    waybillNumber: "",
    notes: "",
  });

  // Goods items (finished goods produced)
  const [goodsItems, setGoodsItems] = useState([
    {
      id: Date.now(),
      product: null,
      quantity: "",
      batchNo: "",
      warehouse: "",
      unitCost: 0,
      totalCost: 0,
      expiryDate: "",
    },
  ]);

  // WIP consumption items (raw materials used)
  const [wipItems, setWipItems] = useState([
    {
      id: Date.now() + 1,
      product: null,
      availableQty: 0,
      quantity: "",
      unitCost: 0,
      totalCost: 0,
    },
  ]);

  // Options
  const [finishedGoodProducts, setFinishedGoodProducts] = useState([]);
  const [rawMaterialProducts, setRawMaterialProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch data on component mount
  useEffect(() => {
    fetchFinishedGoodProducts();
    fetchRawMaterialProducts();
    fetchWarehouses();
  }, []);

  const fetchFinishedGoodProducts = useCallback(() => {
    if (!activeBusiness?.id) return;

    _postApi(
      `/inventory/product-list?query_type=select`,
      {
        facilityId: activeBusiness.id,
        type: "Finished Good",
      },
      (resp) => {
        if (resp.success) {
          console.log("Finished Good Products:", resp.results);
          setFinishedGoodProducts(resp.results || []);
        } else {
          toast.error("Failed to load finished goods");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Error fetching finished goods");
      }
    );
  }, [activeBusiness.id]);

  const fetchRawMaterialProducts = useCallback(() => {
    if (!activeBusiness?.id) return;

    _postApi(
      `/inventory/product-list?query_type=select`,
      {
        facilityId: activeBusiness.id,
        type: "Raw Material",
      },
      (resp) => {
        if (resp.success) {
          console.log("Raw Material Products:", resp.results);
          setRawMaterialProducts(resp.results || []);
        } else {
          toast.error("Failed to load raw materials");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Error fetching raw materials");
      }
    );
  }, [activeBusiness.id]);

  const fetchWarehouses = useCallback(() => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/warehouses/get?facilityId=${activeBusiness.id}`,
      (resp) => {
        if (resp.success) {
          setWarehouses(resp.results || []);
        } else {
          toast.error("Failed to load warehouses");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Error fetching warehouses");
      }
    );
  }, [activeBusiness.id]);

  // Form handlers
  const handleFormChange = ({ target: { name, value } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Goods items handlers
  const addGoodsItem = () => {
    setGoodsItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        product: null,
        quantity: "",
        batchNo: "",
        warehouse: "",
        unitCost: 0,
        totalCost: 0,
        expiryDate: "",
      },
    ]);
  };

  const removeGoodsItem = (id) => {
    if (goodsItems.length <= 1) {
      toast.error("At least one finished good is required");
      return;
    }
    setGoodsItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleGoodsItemChange = (id, field, value) => {
    setGoodsItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };

          // Auto-generate batch number if product is selected
          if (field === "product" && value) {
            updatedItem.batchNo = `BATCH-${moment().format(
              "YYYYMMDD"
            )}-${Math.floor(Math.random() * 1000)}`;
            updatedItem.unitCost = value.cost_price || 0;
          }

          // Calculate total cost
          if (field === "quantity" || field === "unitCost") {
            const quantity = field === "quantity" ? value : item.quantity;
            const unitCost = field === "unitCost" ? value : item.unitCost;
            updatedItem.totalCost = (Number(quantity) || 0) * (Number(unitCost) || 0);
          }

          return updatedItem;
        }
        return item;
      })
    );
  };

  // WIP items handlers
  const addWipItem = () => {
    setWipItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        product: null,
        availableQty: 0,
        quantity: "",
        unitCost: 0,
        totalCost: 0,
      },
    ]);
  };

  const removeWipItem = (id) => {
    if (wipItems.length <= 1) {
      toast.error("At least one WIP item is required");
      return;
    }
    setWipItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleWipItemChange = (id, field, value) => {
    setWipItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };

          // Set available quantity and unit cost when product is selected
          if (field === "product" && value) {
            updatedItem.availableQty = value.stock_quantity || 0;
            updatedItem.unitCost = value.cost_price || 0;
          }

          // Calculate total cost
          if (field === "quantity" || field === "unitCost") {
            const quantity = field === "quantity" ? value : item.quantity;
            const unitCost = field === "unitCost" ? value : item.unitCost;
            updatedItem.totalCost = (Number(quantity) || 0) * (Number(unitCost) || 0);
          }

          return updatedItem;
        }
        return item;
      })
    );
  };

  // Validation
  const validateForm = () => {
    // Check if all goods items have required fields
    for (const item of goodsItems) {
      if (!item.product || !item.quantity || !item.batchNo) {
        toast.error("Please fill all required fields for finished goods");
        return false;
      }
      if (Number(item.quantity) <= 0) {
        toast.error("Quantity must be greater than 0 for finished goods");
        return false;
      }
    }

    // Check if all WIP items have required fields
    for (const item of wipItems) {
      if (!item.product || !item.quantity) {
        toast.error("Please fill all required fields for WIP items");
        return false;
      }
      if (Number(item.quantity) <= 0) {
        toast.error("Quantity must be greater than 0 for WIP items");
        return false;
      }
      if (Number(item.quantity) > Number(item.availableQty)) {
        toast.error(
          `Insufficient quantity for ${item.product?.item_name}`
        );
        return false;
      }
    }

    return true;
  };

  // Submit form
  const handleSubmit = () => {
    if (!validateForm()) return;

    setLoading(true);

    // Prepare data for submission
    const finishedGoods = goodsItems.map(item => ({
      productId: item.product.id,
      productName: item.product.item_name,
      quantity: Number(item.quantity),
      batchNo: item.batchNo,
      warehouse: item.warehouse,
      unitCost: Number(item.unitCost),
      totalCost: Number(item.totalCost),
      expiryDate: item.expiryDate,
    }));

    const wipConsumption = wipItems.map(item => ({
      productId: item.product.id,
      productName: item.product.item_name,
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost),
      totalCost: Number(item.totalCost),
    }));

    const requestData = {
      facilityId: activeBusiness.id,
      receiveDate: form.receiveDate,
      truckNumber: form.truckNumber,
      waybillNumber: form.waybillNumber,
      notes: form.notes,
      finishedGoods: finishedGoods,
      wipConsumption: wipConsumption,
      createdBy: user.id,
    };

    console.log("Sending request data:", requestData);

    _postApi(
      "/api/production/goods-receive",
      requestData,
      (res) => {
        setLoading(false);
        if (res.success) {
          toast.success("Manufacturing goods received successfully");
          navigate("/app/production/manufacturing");
        } else {
          toast.error(res.message || "Failed to receive manufacturing goods");
        }
      },
      (err) => {
        setLoading(false);
        console.error("API Error:", err);
        toast.error("Error receiving manufacturing goods");
      }
    );
  };

  // Calculate totals
  const getTotalFinishedGoodsCost = () => {
    return goodsItems.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0);
  };

  const getTotalWipCost = () => {
    return wipItems.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0);
  };

  const getTotalProductionCost = () => {
    return getTotalFinishedGoodsCost() + getTotalWipCost();
  };

  return (
    <Container fluid>
      <CustomCard back header="Manufacturing Goods Receipt">
        <CardBody>
          {/* Receipt Details */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle tag="h5" className="mb-0">
                Receipt Details
              </CardTitle>
            </CardHeader>
            <CardBody>
              <Row>
                <Col md={4}>
                  <FormGroup>
                    <Label>Receive Date <span className="text-danger">*</span></Label>
                    <Input
                      type="date"
                      name="receiveDate"
                      value={form.receiveDate}
                      onChange={handleFormChange}
                    />
                  </FormGroup>
                </Col>
                <Col md={4}>
                  <FormGroup>
                    <Label>Truck Number</Label>
                    <Input
                      type="text"
                      name="truckNumber"
                      value={form.truckNumber}
                      onChange={handleFormChange}
                      placeholder="Enter truck number"
                    />
                  </FormGroup>
                </Col>
                <Col md={4}>
                  <FormGroup>
                    <Label>Waybill Number</Label>
                    <Input
                      type="text"
                      name="waybillNumber"
                      value={form.waybillNumber}
                      onChange={handleFormChange}
                      placeholder="Enter waybill number"
                    />
                  </FormGroup>
                </Col>
                <Col md={12}>
                  <FormGroup>
                    <Label>Notes/Comments</Label>
                    <Input
                      type="textarea"
                      name="notes"
                      value={form.notes}
                      onChange={handleFormChange}
                      placeholder="Add any notes or comments about this receipt"
                      rows={2}
                    />
                  </FormGroup>
                </Col>
              </Row>
            </CardBody>
          </Card>

          {/* Finished Goods Produced */}
          <Card className="mb-4">
            <CardHeader>
              <div className="d-flex justify-content-between align-items-center">
                <CardTitle tag="h5" className="mb-0">
                  <FaBoxOpen className="me-2" />
                  Finished Goods Produced
                </CardTitle>
                <CustomButton
                  size="sm"
                  color="primary"
                  onClick={addGoodsItem}
                >
                  <FaPlus size={12} className="me-1" />
                  Add Item
                </CustomButton>
              </div>
            </CardHeader>
            <CardBody>
              {goodsItems.map((item, index) => (
                <Card key={item.id} className="mb-3">
                  <CardHeader className="bg-light">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <FaBoxOpen className="me-2" />
                        <span className="fw-bold">
                          {item.product?.item_name || "New Finished Good"}
                        </span>
                      </div>
                      {goodsItems.length > 1 && (
                        <CustomButton
                          size="sm"
                          color="danger"
                          onClick={() => removeGoodsItem(item.id)}
                        >
                          <FaTrash size={12} />
                        </CustomButton>
                      )}
                    </div>
                  </CardHeader>
                  <CardBody>
                    <Row className="align-items-end">
                      <Col md={4}>
                        <FormGroup>
                          <Label>Product <span className="text-danger">*</span></Label>
                          <Typeahead
                            id={`finished-good-product-${item.id}`}
                            options={finishedGoodProducts}
                            labelKey="item_name"
                            placeholder="Select finished good..."
                            onChange={(selected) =>
                              handleGoodsItemChange(item.id, "product", selected[0] || null)
                            }
                            selected={item.product ? [item.product] : []}
                          />
                        </FormGroup>
                      </Col>
                      <Col md={2}>
                        <FormGroup>
                          <Label>Quantity <span className="text-danger">*</span></Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              handleGoodsItemChange(item.id, "quantity", e.target.value)
                            }
                            placeholder="Quantity"
                            min="0"
                          />
                        </FormGroup>
                      </Col>
                      <Col md={2}>
                        <FormGroup>
                          <Label>Batch Number <span className="text-danger">*</span></Label>
                          <Input
                            type="text"
                            value={item.batchNo}
                            onChange={(e) =>
                              handleGoodsItemChange(item.id, "batchNo", e.target.value)
                            }
                            placeholder="Batch number"
                          />
                        </FormGroup>
                      </Col>
                      <Col md={2}>
                        <FormGroup>
                          <Label>Warehouse</Label>
                          <select
                            className="form-select"
                            value={item.warehouse}
                            onChange={(e) =>
                              handleGoodsItemChange(item.id, "warehouse", e.target.value)
                            }
                          >
                            <option value="">Select warehouse</option>
                            {warehouses.map((warehouse) => (
                              <option key={warehouse.id} value={warehouse.id}>
                                {warehouse.name}
                              </option>
                            ))}
                          </select>
                        </FormGroup>
                      </Col>
                      <Col md={2}>
                        <FormGroup>
                          <Label>Expiry Date</Label>
                          <Input
                            type="date"
                            value={item.expiryDate}
                            onChange={(e) =>
                              handleGoodsItemChange(item.id, "expiryDate", e.target.value)
                            }
                          />
                        </FormGroup>
                      </Col>
                      <Col md={2}>
                        <div className="d-flex justify-content-between align-items-end h-100">
                          <div>
                            <Label>Unit Cost</Label>
                            <div className="fw-bold">
                              {(Number(item.unitCost) || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </div>
                          </div>
                        </div>
                      </Col>
                      <Col md={2}>
                        <div className="d-flex justify-content-between align-items-end h-100">
                          <div>
                            <Label>Total Cost</Label>
                            <div className="fw-bold">
                              {(Number(item.totalCost) || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </div>
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </CardBody>
                </Card>
              ))}

              {/* Finished Goods Summary */}
              <Row className="mt-3">
                <Col md={8}></Col>
                <Col md={4}>
                  <Card className="bg-light">
                    <CardBody>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Total Finished Goods Cost:</span>
                        <span className="fw-bold">
                          {getTotalFinishedGoodsCost().toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </div>
                    </CardBody>
                  </Card>
                </Col>
              </Row>
            </CardBody>
          </Card>

          {/* WIP Items Consumed */}
          <Card className="mb-4">
            <CardHeader>
              <div className="d-flex justify-content-between align-items-center">
                <CardTitle tag="h5" className="mb-0">
                  <FaBoxes className="me-2" />
                  WIP Items Consumed
                </CardTitle>
                <CustomButton
                  size="sm"
                  color="primary"
                  onClick={addWipItem}
                >
                  <FaPlus size={12} className="me-1" />
                  Add Item
                </CustomButton>
              </CardHeader>
            </CardHeader>
            <CardBody>
              {wipItems.map((item, index) => (
                <Card key={item.id} className="mb-3">
                  <CardHeader className="bg-light">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <FaBoxes className="me-2" />
                        <span className="fw-bold">
                          {item.product?.item_name || "New WIP Item"}
                        </span>
                      </div>
                      {wipItems.length > 1 && (
                        <CustomButton
                          size="sm"
                          color="danger"
                          onClick={() => removeWipItem(item.id)}
                        >
                          <FaTrash size={12} />
                        </CustomButton>
                      )}
                    </div>
                  </CardHeader>
                  <CardBody>
                    <Row className="align-items-end">
                      <Col md={5}>
                        <FormGroup>
                          <Label>Product <span className="text-danger">*</span></Label>
                          <Typeahead
                            id={`wip-product-${item.id}`}
                            options={rawMaterialProducts}
                            labelKey="item_name"
                            placeholder="Select raw material..."
                            onChange={(selected) =>
                              handleWipItemChange(item.id, "product", selected[0] || null)
                            }
                            selected={item.product ? [item.product] : []}
                          />
                          {item.product && (
                            <div className="small text-muted mt-1">
                              Available: {Number(item.availableQty).toLocaleString()}
                            </div>
                          )}
                        </FormGroup>
                      </Col>
                      <Col md={2}>
                        <FormGroup>
                          <Label>Quantity <span className="text-danger">*</span></Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              handleWipItemChange(item.id, "quantity", e.target.value)
                            }
                            placeholder="Quantity"
                            min="0"
                            max={item.availableQty}
                          />
                        </FormGroup>
                      </Col>
                      <Col md={2}>
                        <FormGroup>
                          <Label>Unit Cost</Label>
                          <Input
                            type="number"
                            value={item.unitCost}
                            onChange={(e) =>
                              handleWipItemChange(item.id, "unitCost", e.target.value)
                            }
                            placeholder="Unit cost"
                            step="0.01"
                          />
                        </FormGroup>
                      </Col>
                      <Col md={3}>
                        <div className="d-flex justify-content-between align-items-end h-100">
                          <div>
                            <Label>Total Cost</Label>
                            <div className="fw-bold">
                              {(Number(item.totalCost) || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </div>
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </CardBody>
                </Card>
              ))}

              {/* WIP Items Summary */}
              <Row className="mt-3">
                <Col md={8}></Col>
                <Col md={4}>
                  <Card className="bg-light">
                    <CardBody>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Total WIP Cost:</span>
                        <span className="fw-bold">
                          {getTotalWipCost().toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </div>
                    </CardBody>
                  </Card>
                </Col>
              </Row>
            </CardBody>
          </Card>

          {/* Production Summary */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle tag="h5" className="mb-0">
                Production Summary
              </CardTitle>
            </CardHeader>
            <CardBody>
              <Row>
                <Col md={6}>
                  <div className="d-flex justify-content-between mb-2">
                    <span>Finished Goods Cost:</span>
                    <span className="fw-bold">
                      {getTotalFinishedGoodsCost().toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span>WIP Items Cost:</span>
                    <span className="fw-bold">
                      {getTotalWipCost().toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="d-flex justify-content-between">
                    <span className="fw-bold">Total Production Cost:</span>
                    <span className="fw-bold text-primary">
                      {getTotalProductionCost().toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  </div>
                </Col>
              </Row>
            </CardBody>
          </Card>

          {/* Action Buttons */}
          <div className="d-flex justify-content-between">
            <CustomButton
              color="secondary"
              onClick={() => navigate("/app/production/manufacturing")}
              disabled={loading}
            >
              Cancel
            </CustomButton>
            <CustomButton
              color="primary"
              onClick={handleSubmit}
              loading={loading}
              disabled={loading}
            >
              Record Production
            </CustomButton>
          </div>
        </CardBody>
      </CustomCard>
    </Container>
  );
}