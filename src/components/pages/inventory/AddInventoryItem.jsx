/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css"; // Import Bootstrap CSS
import {
  Button,
  Col,
  Container,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "reactstrap";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import { useNavigate } from "react-router-dom";
import { Typeahead } from "react-bootstrap-typeahead";
import { MdAddCircle } from "react-icons/md";
import { useSelector } from "react-redux";
import { _postApi } from "@/redux/actions/api";
import { toast } from "sonner";

const AddInventoryItem = () => {
  const navigate = useNavigate();
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [modalOpen, setModalOpen] = useState(false);
  const [chart, setChart] = useState([]);
  const [data, setData] = useState([]);
  const [formData, setFormData] = useState({
    itemName: "",
    type: "",
  });
  const [category, setCategory] = useState("");
  const [option, setOption] = useState([]);
  const toggleModal = () => setModalOpen(!modalOpen);

  const handleCategory = (e) => {
    const { value } = e.target;
    setCategory(value);
  };

  const getCategory = () => {
    const query = "get";

    _postApi(
      `/inventory/new-category/${query}`,
      {
        store: activeBusiness.business_name,
      },
      (data) => {
        // if (data.success) {
        setOption(data.results.map((item) => ({ name: item.category })));
        // }
      },
      (err) => {
        console.error(err);
      }
    );
  };

  const handleCategorySubmit = (e) => {
    e.preventDefault();
    // console.log("Product Data:", category, activeBusiness.business_name);
    const query = "add";

    _postApi(
      `/inventory/new-category/${query}`,
      {
        category: category,
        store: activeBusiness.business_name,
      },
      (res) => {
        // if (res.success) {
        toast.success("Successfully Submitted");
        setCategory("");
        getCategory();
        setModalOpen(false);
        // }
      },
      (err) => {
        toast.error("An error occurred");
        console.log(err);
      }
    );
  };

  const getAllAccount = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/account/expenditure?query_type=inventory`,
      { store: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setChart(resp.results);
          // alert(JSON.stringify(resp.results))
        } else {
          toast.error("Failed to load chart data.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    getAllAccount();
    getCategory();
  }, []);

  // State for validation errors
  const [errors, setErrors] = useState({});

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Handle form submission
  const handleSubmit = () => {
    // e.preventDefault();

    // Validate inputs
    const validationErrors = {};
    if (!formData.itemName.trim()) {
      validationErrors.itemName = "Item name is required";
    }
    if (!category.trim()) {
      validationErrors.category = "Category is required";
    }
    if (!formData.type.trim()) {
      validationErrors.type = "Type is required";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    const payload = {
      ...formData,
      category: category,
    };

    _postApi(
      `/inventory/register?query_type=insert`,
      payload,
      (resp) => {
        if (resp.success) {
          setData(resp.results);
          toaster.success("Submitted successfully.");
        } else {
          toast.error("Failed to submit.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while submitting data.");
      }
    );

    setFormData({
      itemName: "",
      category: "",
      type: "",
    });

    if (setCategory) {
      setCategory("");
    }
  };

  return (
    <Container>
      <CustomCard back header="Add inventory item">
        {/* {JSON.stringify(chart)} */}
        <div className="row">
          <div className="col-md-6 mb-2">
            <div className="form-group">
              <Label>Item Name:</Label>
              <input
                type="text"
                id="itemName"
                name="itemName"
                value={formData.itemName}
                onChange={handleInputChange}
                className={`form-control ${
                  errors.itemName ? "is-invalid" : ""
                }`}
                placeholder="Enter item name"
              />
              {errors.itemName && (
                <div className="invalid-feedback">{errors.itemName}</div>
              )}
            </div>
          </div>

          <Col md={6} className="mb-1">
            <Label>Account chart code:</Label>
            <Typeahead
              id="expenditure-typeahead"
              size="md"
              className="col-md-12 pl-0 pr-0 custom-typeahead-border"
              options={chart?.map((exp) => ({
                label: `${exp.head} - ${exp.description}`,
                value: exp.head,
                description: exp.description,
                account_type: exp.account_type,
                balance_type: exp.Balance_Type,
              }))}
              placeholder="Select inventory code..."
              onChange={(selectedItems) => {
                if (selectedItems.length > 0) {
                  setFormData((prev) => ({
                    ...prev,
                    chart_type: selectedItems[0].description,
                    chart_head: selectedItems[0].value,
                    chart_description: selectedItems[0].description,
                    account_type: selectedItems[0].account_type,
                    balance_type: selectedItems[0].balance_type,
                  }));
                } else {
                  setFormData((prev) => ({
                    ...prev,
                    chart_type: "",
                    chart_head: "",
                    chart_description: "",
                  }));
                }
              }}
              selected={
                formData.chart_type
                  ? chart
                      .filter((exp) => exp.head === formData.chart_head)
                      ?.map((exp) => ({
                        label: `${exp.head} - ${exp.description}`,
                        value: exp.head,
                        description: exp.description,
                      }))
                  : []
              }
              labelKey="label"
              style={{
                borderRadius: "7px",
              }}
            />
          </Col>

          <div className="col-md-6 mb-2">
            <div className="form-group">
              <Label>Type:</Label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className={`form-control ${errors.type ? "is-invalid" : ""}`}
              >
                <option value="">Select type</option>
                <option value="Goods">Goods</option>
                <option value="Services">Services</option>
              </select>
              {errors.type && (
                <div className="invalid-feedback">{errors.type}</div>
              )}
            </div>
          </div>

          <div className="col-md-6 mb-2">
            <Label>Category:</Label>
            <div className="col-11 d-flex align-items-end pl-0">
              <Typeahead
                id="single-select-typeahead"
                size={"md"}
                className="col-md-12 pl-0 pr-0 custom-typeahead-border"
                options={option}
                placeholder="Select category..."
                onChange={(selectedItems) => {
                  setCategory(selectedItems[0]?.name || "");
                }}
                selected={category ? [{ name: category }] : []}
                labelKey="name"
                //   style={{
                //     borderRadius: "7px",
                //   }}
              />
              <CustomButton className="ml-2 sm" size="sm" onClick={toggleModal}>
                <MdAddCircle />
              </CustomButton>
            </div>
          </div>

          <div className="d-flex justify-content-center mt-3">
            <CustomButton
              className="py-1"
              onClick={() => {
                handleSubmit();
                navigate(`/app/inventory/inventory-list`);
              }}
            >
              <div className="d-flex align-items-center">Register Item</div>
            </CustomButton>
          </div>
        </div>
      </CustomCard>

      <Modal isOpen={modalOpen} toggle={toggleModal}>
        <ModalHeader toggle={toggleModal}>Add New category</ModalHeader>
        <ModalBody>
          <Label>Category:</Label>
          <Input
            type="text"
            name="category"
            bsSize="sm"
            value={category}
            onChange={handleCategory}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={toggleModal} size="sm">
            Cancel
          </Button>
          <CustomButton
            onClick={handleCategorySubmit}
            size="sm"
            className="ml-2"
          >
            Add category
          </CustomButton>
        </ModalFooter>
      </Modal>
    </Container>
  );
};

export default AddInventoryItem;
