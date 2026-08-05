/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useState } from "react";
import CustomCard from "@/common/Custom/CustomCard2";
import { Button, CardBody, Input, Row, Table } from "reactstrap";
import { FaChevronDown } from "react-icons/fa";
import CustomButton from "@/common/Custom/CustomButton";
import { useSelector } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { formatNumber } from "@/utilities";
import { Label } from "reactstrap/lib";
import { Typeahead } from "react-bootstrap-typeahead";
import { useLocation } from "react-router-dom";

export default function RecordProduction() {
  const [loading, setLoading] = useState(false);
  const [isRawMaterialsOpen, setIsRawMaterialsOpen] = useState(true);
  const [isExpensesOpen, setIsExpensesOpen] = useState(false);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [items, setItems] = useState([]);
  const [manufacturingRequisition, setManufacturingRequisition] = useState({});
  const [manufacturingDetails, setManufacturingDetails] = useState([]);
  const [workInProgress, setWorkInProgress] = useState({});
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [costunit, setCostunit] = useState([]);
  const [expensesunit, setExpensesunit] = useState([]);
  const location = useLocation();
  const mr_no = location.search.split("=")[1];
  const toggleRawMaterials = () => setIsRawMaterialsOpen((prev) => !prev);
  const toggleExpenses = () => setIsExpensesOpen((prev) => !prev);
  const [newExpense, setNewExpense] = useState({
    item: "",
    amount: "",
    item_code: "",
    chart_code: "",
  });
  const [newRawMaterial, setNewRawMaterial] = useState({
    description: "",
    quantity: "",
    item_code: "",
    chart_code: "",
  });

  const [product, setProduct] = useState({
    name: "",
    quantity: null,
    expenses: [],
    raw_materials: [],
    selling_price: "",
    product_manufacturing_code: "",
    total_production_cost: "",
    subhead: "",
  });

  const getManufacturingDetails = () => {
    _postApi(
      `/production/select-details`,
      { query_type: "select-details", mr_no },
      (resp) => {
        if (resp.success) {
          setManufacturingDetails(
            resp.results.map((item) => ({
              ...item,
              item_name: item.item_name,
              item_code: item.head,
              item_subhead: item.subhead,
              approved_qty: Number(item.quantity),
              cost_price: Number(item.cost_price),
            }))
          );
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  const totalExpenses = product.expenses.reduce(
    (acc, item) => acc + Number(item.amount || 0),
    0
  );

  const totalRawMaterials = product?.raw_materials?.reduce(
    (acc, item) => acc + item.quantity * item.amount,
    0
  );

  const totalProduction = totalRawMaterials + totalExpenses;

  const quantityProduced = Number(product.quantity || 0);
  const costPrice =
    quantityProduced > 0 ? totalProduction / quantityProduced : 0;

  useEffect(() => {
    if (!activeBusiness?.id) return;

    _postApi(
      `/inventory/product-list?query_type=select_expenses`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setItems(
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

    _fetchApi(
      `/products/get-product-name/${activeBusiness.business_name}`,
      (data) => {
        if (data.success) {
          console.log("Product Names:", data.results);
        }
      },
      (err) => {
        console.error("Error fetching product names:", err);
      }
    );

    getManufacturingDetails();
    getManufacturingRequisition();
  }, [activeBusiness]);

  const getManufacturingRequisition = () => {
    _postApi(
      `/production/get-manufacture-requisition-by-mr-no`,
      { mr_no },
      (resp) => {
        if (resp.success) {
          setManufacturingRequisition(resp.results);
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    if (manufacturingRequisition[0]?.product_name) {
      setProduct((prev) => ({
        ...prev,
        name: manufacturingRequisition[0]?.product_name,
        product_manufacturing_code: manufacturingRequisition[0]?.account_code,
        totalRawMaterialsCost: manufacturingDetails.reduce(
          (acc, item) => acc + item.approved_qty * item.cost_price,
          0
        ),
        subhead: manufacturingRequisition[0]?.account_subhead,
      }));
    }
  }, [manufacturingRequisition]);

  const handleAddExpense = () => {
    if (newExpense.item && newExpense.amount) {
      setProduct((prev) => ({
        ...prev,
        expenses: [...prev.expenses, newExpense],
      }));
      setNewExpense({
        item: "",
        amount: "",
        item_code: "",
        chart_code: "",
        category: "",
        category_code: "",
        unit: "",
        unit_code: "",
      });
    }
  };

  const handleDeleteExpense = (index) => {
    setProduct((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((_, i) => i !== index),
    }));
  };

  const handleAdd = () => {
    if (!product.name || !product.quantity || product.expenses.length === 0) {
      toast.error(
        "Product name, quantity, expenses and cost price are required."
      );
      return;
    }

    setLoading(true);

    const data = {
      ...product,
      cost_price: costPrice,
      store: activeBusiness.business_name,
      WIP: workInProgress,
      total_production_cost: totalProduction,
      workInProgress: manufacturingDetails,
    };

    _postApi(
      "/products/add-product-data",
      data,
      (res) => {
        if (res.success) {
          toast.success("Ready for processing");
          setProduct({
            name: "",
            quantity: "",
            expenses: [],
          });
        }
        setLoading(false);
      },
      (err) => {
        toast.error("Error occurred while saving production data.");
        console.error(err);
        setLoading(false);
      }
    );
  };

  const handleAddRawMaterial = () => {
    if (newRawMaterial.description && newRawMaterial.quantity) {
      setProduct((prev) => ({
        ...prev,
        raw_materials: [...prev.raw_materials, newRawMaterial],
      }));
      setNewRawMaterial({
        description: "",
        quantity: "",
        item_code: "",
        chart_code: "",
        category: "",
        category_code: "",
        unit: "",
        unit_code: "",
      });
    }
  };

  const handleDeleteRawMaterial = (index) => {
    setProduct((prev) => ({
      ...prev,
      raw_materials: prev.raw_materials.filter((_, i) => i !== index),
    }));
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

  const getWorkInProgress = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=work_in_progress`,
      { store: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setWorkInProgress(resp.results);
        } else {
          toast.error("Failed to load work in progress data.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error(
          "Something went wrong while fetching work in progress data."
        );
      }
    );
  };

  useEffect(() => {
    getWorkInProgress();
  }, []);

  return (
    <CustomCard back header="Record production">
      {/* {JSON.stringify(product)} */}
      <CardBody>
        <div className="grid grid-cols-5 gap-2">
          <div className="col-span-1">
            <Label>Product name</Label>
            <Input
              type="text"
              bsSize="sm"
              value={product.name}
              placeholder="Product name"
              disabled
              style={{
                borderColor: activeBusiness.primary_color || "#4267b2",
                borderWidth: "2px",
                borderRadius: "7px",
              }}
            />
          </div>
          <div className="col-span-1">
            <Label>Category</Label>
            <select
              className="form-select p-1"
              value={product.category}
              placeholder="Product name"
              onChange={(e) => {
                setProduct({
                  ...product,
                  category: e.target.value,
                });

                setCostunit(
                  categories?.find((sup) => sup.category === e.target.value)
                    ?.units || []
                );
              }}
              style={{
                borderColor: activeBusiness.primary_color || "#4267b2",
                borderWidth: "2px",
                borderRadius: "7px",
              }}
            >
              <option value="">Select Category</option>
              {categories.map((category) => (
                <option key={category.category} value={category.category}>
                  {category.category}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-1">
            <Label>Unit</Label>
            <select
              className="form-select p-1"
              value={product.unit}
              onChange={(e) =>
                setProduct((prev) => ({ ...prev, unit: e.target.value }))
              }
              style={{
                borderColor: activeBusiness.primary_color || "#4267b2",
                borderWidth: "2px",
                borderRadius: "7px",
              }}
            >
              <option value="">Select Unit</option>
              {costunit.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-1">
            <Label>Quantity Produced</Label>
            <Input
              type="number"
              bsSize="sm"
              value={product.quantity}
              onChange={(e) =>
                setProduct((prev) => ({ ...prev, quantity: e.target.value }))
              }
              placeholder="Quantity Produced"
              style={{
                borderColor: activeBusiness.primary_color || "#4267b2",
                borderWidth: "2px",
                borderRadius: "7px",
              }}
            />
          </div>
          <div className="col-span-1">
            <div className="d-flex justify-content-between align-items-center">
              <Label>
                Cost Price <b>(Per Item)</b>
              </Label>
            </div>
            <Input
              type="number"
              bsSize="sm"
              disabled
              value={parseFloat(costPrice).toFixed(2)}
              placeholder="Cost Price"
              style={{
                borderColor: activeBusiness.primary_color || "#4267b2",
                borderWidth: "2px",
                borderRadius: "7px",
              }}
            />
          </div>
        </div>

        <Row>
          <div
            style={{
              fontWeight: "bold",
              width: "100%",
              marginTop: "15px",
              marginBottom: "-15px",
            }}
            className="col-md-4 text-right"
          >
            Total Cost of Production: ₦{formatNumber(totalProduction)}
          </div>
        </Row>

        {/* <div>
          <Label> Work In Progress Account</Label>
          <TypeaheadCustom
            options={chartOfAccount}
            placeholder="Select work in progress account"
            labelKey={(i) => `${i.description} - (${i.head}) `}
            onChange={(selectedItems) => {
              if (selectedItems.length > 0) {
                setWorkInProgress((prev) => ({
                  ...prev,
                  ...selectedItems[0],
                  head: selectedItems[0].head,
                }));
              }
            }}
          />
        </div> */}

        {/* Raw Materials Section */}

        <Row className="mt-4">
          <Button
            onClick={toggleRawMaterials}
            className="w-100 d-flex justify-content-between align-items-center"
            size="sm"
            style={{
              backgroundColor: activeBusiness.primary_color || "#4267b2",
              borderColor: activeBusiness.primary_color || "#4267b2",
            }}
          >
            <b>Raw Materials</b>
            <FaChevronDown
              style={{
                transition: "transform 0.3s ease",
                transform: isRawMaterialsOpen
                  ? "rotate(180deg)"
                  : "rotate(0deg)",
              }}
            />
          </Button>

          {isRawMaterialsOpen && (
            <Table responsive className="mt-2 mb-0">
              <thead>
                <tr>
                  <th className="text-left w-25">Description</th>
                  <th className="text-left w-25">Category</th>
                  <th className="text-left w-25">Unit</th>
                  <th className="text-center w-25">Quantity</th>
                  <th className="text-center w-25">Amount(₦)</th>
                  <th className="text-center w-25">Action</th>
                </tr>
              </thead>
              {/* {JSON.stringify(newRawMaterial)} */}
              <tbody>
                <tr>
                  <td style={{ width: "" }}>
                    <div style={{ position: "absolute", width: "20" }}>
                      <Typeahead
                        id="raw-material-typeahead"
                        size="sm"
                        options={manufacturingDetails}
                        labelKey="item_name"
                        placeholder="Select Raw Material"
                        onChange={(selected) =>
                          setNewRawMaterial((prev) => ({
                            ...prev,
                            description: selected[0]?.item_name || "",
                            item_code: selected[0]?.item_code || "",
                            chart_code: selected[0]?.item_subhead || "",
                            quantity: selected[0]?.approved_qty || "",
                            amount: selected[0]?.cost_price || "",
                          }))
                        }
                        // selected={
                        //   newRawMaterial.item_name
                        //     ? [
                        //         {
                        //           name: newRawMaterial.item_name,
                        //           code: newRawMaterial.item_code,
                        //           chart_code: newRawMaterial.chart_code,
                        //           quantity: newRawMaterial.quantity,
                        //           amount: newRawMaterial.amount,
                        //         },
                        //       ]
                        //     : []
                        // }
                      />
                    </div>
                  </td>
                  <td>
                    <select
                      className="w-full form-select"
                      required
                      value={newRawMaterial.category}
                      onChange={(e) => {
                        setNewRawMaterial({
                          ...newRawMaterial,
                          category: e.target.value,
                          category_code: e.target.value,
                        });
                        setUnits(
                          categories?.find(
                            (sup) => sup.category === e.target.value
                          )?.units || []
                        );
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
                      className="w-full form-select"
                      required
                      value={newRawMaterial.unit}
                      onChange={(e) => {
                        setNewRawMaterial({
                          ...newRawMaterial,
                          unit: e.target.value,
                          unit_code: e.target.value,
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
                      bsSize="sm"
                      value={newRawMaterial.quantity}
                      onChange={(e) =>
                        setNewRawMaterial((prev) => ({
                          ...prev,
                          quantity: e.target.value,
                        }))
                      }
                    />
                  </td>
                  <td className="text-right">
                    {formatNumber(
                      newRawMaterial.amount * newRawMaterial.quantity
                    )}
                  </td>
                  <td className="text-center">
                    <CustomButton size="sm" onClick={handleAddRawMaterial}>
                      Add
                    </CustomButton>
                  </td>
                </tr>
                {product?.raw_materials?.map((rm, idx) => (
                  <tr key={idx}>
                    <td>{rm.description}</td>
                    <td>{rm.category}</td>
                    <td>{rm.unit}</td>
                    <td className="text-center">{rm.quantity}</td>
                    <td className="text-right">{formatNumber(rm.amount)}</td>
                    <td>
                      <CustomButton
                        size="sm"
                        className="bg-danger"
                        onClick={() => handleDeleteRawMaterial(idx)}
                      >
                        Delete
                      </CustomButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Row>

        {/* Expenses Section */}

        <Row className="mt-4">
          <Button
            onClick={toggleExpenses}
            className="w-100 d-flex justify-content-between align-items-center"
            size="sm"
            style={{
              backgroundColor: activeBusiness.primary_color || "#4267b2",
              borderColor: activeBusiness.primary_color || "#4267b2",
            }}
          >
            <b>Expenses</b>
            <FaChevronDown
              style={{
                transition: "transform 0.3s ease",
                transform: isExpensesOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </Button>
          {isExpensesOpen && (
            <Table responsive className="mt-2">
              <thead>
                <tr>
                  <th style={{ width: "20%" }} className="text-center w-25">
                    Expense Name
                  </th>
                  <th style={{ width: "20%" }} className="text-center w-25">
                    Category
                  </th>
                  <th style={{ width: "20%" }} className="text-center w-25">
                    Unit
                  </th>
                  <th className="text-center w-25">Amount</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div style={{ position: "absolute", width: "20%" }}>
                      <Typeahead
                        id="expense-item-typeahead"
                        size="sm"
                        options={items}
                        labelKey="name"
                        placeholder="Select Expense"
                        onChange={(selected) =>
                          setNewExpense((prev) => ({
                            ...prev,
                            item: selected[0]?.name || "",
                            item_code: selected[0]?.code || "",
                            chart_code: selected[0]?.chart_code || "",
                          }))
                        }
                        selected={
                          newExpense.item
                            ? [
                                {
                                  name: newExpense.item,
                                  code: newExpense.item_code,
                                  chart_code: newExpense.chart_code,
                                },
                              ]
                            : []
                        }
                        style={{ width: "100%" }}
                      />
                    </div>
                  </td>
                  <td>
                    <select
                      className="w-full form-select"
                      required
                      value={newExpense.category}
                      onChange={(e) => {
                        setNewExpense({
                          ...newExpense,
                          category: e.target.value,
                          category_code: e.target.value,
                        });
                        setExpensesunit(
                          categories?.find(
                            (sup) => sup.category === e.target.value
                          )?.units || []
                        );
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
                      className="w-full form-select"
                      required
                      value={newExpense.unit}
                      onChange={(e) => {
                        setNewExpense({
                          ...newExpense,
                          unit: e.target.value,
                          unit_code: e.target.value,
                        });
                      }}
                    >
                      <option value="">Select unit</option>
                      {expensesunit?.map((sup) => (
                        <option key={sup} value={sup}>
                          {sup}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Input
                      type="number"
                      bsSize="sm"
                      name="amount"
                      value={newExpense.amount}
                      onChange={(e) =>
                        setNewExpense((prev) => ({
                          ...prev,
                          amount: e.target.value,
                        }))
                      }
                      style={{
                        borderColor: activeBusiness.primary_color || "#4267b2",
                        borderWidth: "2px",
                        borderRadius: "7px",
                      }}
                    />
                  </td>
                  <td className="text-center d-flex justify-content-center">
                    <CustomButton size="sm" onClick={handleAddExpense}>
                      Add
                    </CustomButton>
                  </td>
                </tr>
                {product?.expenses?.map((exp, idx) => (
                  <tr key={idx}>
                    <td>{exp.item}</td>
                    <td>{exp.category}</td>
                    <td>{exp.unit}</td>
                    <td className="text-right">{formatNumber(exp.amount)}</td>
                    <td className="text-center">
                      <CustomButton
                        size="sm"
                        className="bg-danger"
                        onClick={() => handleDeleteExpense(idx)}
                      >
                        Delete
                      </CustomButton>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="1" className="text-right">
                    <b>Total Expenses(₦):</b>
                  </td>
                  <td colSpan="2"></td>
                  <td className="text-right">
                    <b>
                      {formatNumber(
                        product.expenses.reduce(
                          (acc, item) => acc + Number(item.amount || 0),
                          0
                        )
                      )}
                    </b>
                  </td>
                  <td className="text-center"></td>
                </tr>
              </tbody>
            </Table>
          )}
        </Row>

        <center>
          <CustomButton
            loading={loading}
            className="mt-4"
            size="sm"
            onClick={handleAdd}
          >
            Submit
          </CustomButton>
        </center>
      </CardBody>

      {/* <Modal isOpen={markupModal} toggle={toggleMarkupModal}>
        <div className="modal-header">
          <h5 className="modal-title">Calculate Selling Price with Markup</h5>
          <button type="button" className="close" onClick={toggleMarkupModal}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <Label>Cost Price (Auto)</Label>
            <Input
              type="text"
              value={costPrice.toFixed(2)}
              readOnly
              bsSize="sm"
              className="form-control"
            />
          </div>
          <div className="form-group mt-2">
            <Label>Markup Type</Label>
            <Input
              type="select"
              bsSize="sm"
              value={markupType}
              onChange={(e) => setMarkupType(e.target.value)}
            >
              <option value="">-- Select Type --</option>
              <option value="fix">Fix</option>
              <option value="%">Percentage (%)</option>
            </Input>
          </div>
          {markupType && (
            <div className="form-group mt-2">
              <Label>Markup {markupType === "%" ? "(%)" : "(₦)"}</Label>
              <Input
                type="number"
                bsSize="sm"
                value={markupValue}
                onChange={(e) => setMarkupValue(e.target.value)}
              />
            </div>
          )}
        </div>
        <ModalFooter>
          <Button
            color="primary"
            onClick={() => {
              const parsedMarkup = parseFloat(markupValue);
              const parsedCost = parseFloat(product.cost_price);
              if (!isNaN(parsedMarkup) && !isNaN(parsedCost)) {
                const newSellingPrice =
                  parsedCost + (parsedCost * parsedMarkup) / 100;
                setProduct((prev) => ({
                  ...prev,
                  selling_price: newSellingPrice.toFixed(2),
                }));
              }
              toggleMarkupModal();
            }}
          >
            Apply
          </Button>
          <Button color="secondary" onClick={toggleMarkupModal}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal> */}
    </CustomCard>
  );
}
