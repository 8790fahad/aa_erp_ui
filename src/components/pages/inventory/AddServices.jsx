/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Container, Label } from "reactstrap";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { _postApi } from "@/redux/actions/api";
import { toast } from "sonner";

const AddServices = () => {
  const navigate = useNavigate();
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [modalOpen, setModalOpen] = useState(false);
  const [chart, setChart] = useState([]);
  const [data, setData] = useState([]);
  const [formData, setFormData] = useState({
    itemName: "",
    itemPrice: "",
  });

  const getAllAccount = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/account/expenditure?query_type=inventory`,
      { store: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setChart(resp.results);
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
  }, []);

  const handleCategorySubmit = (e) => {
    e.preventDefault();
    const query = "add";

    _postApi(
      `/inventory/new-category/${query}`,
      {
        store: activeBusiness.business_name,
      },
      (res) => {
        // if (res.success) {
        toast.success("Successfully Submitted");
        setModalOpen(false);
        // }
      },
      (err) => {
        toast.error("An error occurred");
        console.log(err);
      }
    );
  };

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
    if (!formData.itemPrice.trim()) {
      validationErrors.itemPrice = "Type is required";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    const payload = {
      ...formData,
      store: activeBusiness.id,
    };

    _postApi(
      `/inventory/product-list?query_type=insert`,
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
  };

  return (
    <Container>
      <CustomCard back header="Add Services">
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

          <div className="col-md-6 mb-2">
            <div className="form-group">
              <Label>Price:</Label>
              <input
                type="text"
                id="itemName"
                name="itemPrice"
                value={formData.itemPrice}
                onChange={handleInputChange}
                className={`form-control ${
                  errors.itemPrice ? "is-invalid" : ""
                }`}
                placeholder="Enter item name"
              />
              {errors.itemPrice && (
                <div className="invalid-feedback">{errors.itemPrice}</div>
              )}
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
              <div className="d-flex align-items-center">Submit</div>
            </CustomButton>
          </div>
        </div>
      </CustomCard>
    </Container>
  );
};

export default AddServices;
