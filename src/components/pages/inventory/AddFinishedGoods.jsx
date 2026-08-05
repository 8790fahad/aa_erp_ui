/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  Button,
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
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";

const AddFinishedGoods = () => {
  const navigate = useNavigate();
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [modalOpen, setModalOpen] = useState(false);
  const [chart, setChart] = useState([]);
  const [data, setData] = useState([]);
  const [formData, setFormData] = useState({
    itemName: "",
    type: "",
    account_head: "",
    account_description: "",
  });
  const [category, setCategory] = useState("");
  const [option, setOption] = useState([]);
  const [type, setType] = useState([]);
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
        setOption(data.results.map((item) => ({ name: item.category })));
      },
      (err) => {
        console.error(err);
      }
    );
  };

  const getType = () => {
    _fetchApi(
      `/inventory/get-product-type`,
      (data) => {
        setType(data.results.map((item) => ({ name: item.description })));
      },
      (err) => {
        console.error(err);
      }
    );
  };

  const handleCategorySubmit = (e) => {
    e.preventDefault();
    const query = "add";

    _postApi(
      `/inventory/new-category/${query}`,
      {
        category: category,
        store: activeBusiness.business_name,
      },
      (res) => {
        toast.success("Successfully Submitted");
        setCategory("");
        getCategory();
        setModalOpen(false);
      },
      (err) => {
        toast.error("An error occurred");
        console.log(err);
      }
    );
  };

  const getACCt = () => {
    if (!activeBusiness?.business_name) return;

    _postApi(
      `/account/chart-of-account?query_type=select`,
      { store: activeBusiness.business_name },
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
    getACCt();
    getCategory();
    getType();
  }, []);

  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = () => {
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
      `/inventory/product-list?query_type=insert`,
      payload,
      (resp) => {
        if (resp.success) {
          setData(resp.results);
          toaster.success("Submitted successfully.");
          navigate(-1);
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
      account_head: "",
      account_description: "",
    });

    if (setCategory) {
      setCategory("");
    }
  };

  return (
    <Container>
      <CustomCard back header="Add finished goods">
        <div className="row">
          <div className="col-md-6 mb-2">
            <div className="form-group">
              <Label>Item Name: </Label>
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
              <Label>Type:</Label>
              <Typeahead
                id="single-select-typeahead"
                size="md"
                className="col-md-12 pl-0 pr-0 custom-typeahead-border"
                options={type}
                placeholder="Select product type..."
                onChange={(selectedItems) => {
                  setFormData({
                    ...formData,
                    type: selectedItems[0]?.name || "",
                  });
                }}
                selected={formData.type ? [{ name: formData.type }] : []}
                labelKey="name"
              />

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
              />
              <CustomButton className="ml-2 sm" size="sm" onClick={toggleModal}>
                <MdAddCircle />
              </CustomButton>
            </div>
          </div>

          <div className="col-md-6 mb-2">
            <Label>Finished goods Account:</Label>
            <Typeahead
              id="inventory-account"
              size="md"
              className="col-md-12 pl-0 pr-0 custom-typeahead-border"
              options={chart.map((account) => ({
                label: `${account.description}`,
                value: account.head,
                head: account.head,
                description: account.description,
              }))}
              placeholder="Select inventory account..."
              onChange={(selectedItems) => {
                if (selectedItems.length > 0) {
                  setFormData({
                    ...formData,
                    account_head: selectedItems[0].head,
                    account_description: selectedItems[0].description,
                  });
                } else {
                  setFormData({
                    ...formData,
                    account_head: "",
                    account_description: "",
                  });
                }
              }}
              selected={
                formData.account_head
                  ? chart
                      .filter(
                        (account) => account.head === formData.account_head
                      )
                      .map((account) => ({
                        label: `${account.description}`,
                        value: account.head,
                        head: account.head,
                        description: account.description,
                      }))
                  : []
              }
              labelKey="label"
            />
          </div>

          <div className="d-flex justify-content-center mt-3">
            <CustomButton
              className="py-1"
              onClick={() => {
                handleSubmit();
              }}
            >
              <div className="d-flex align-items-center">Submit</div>
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

export default AddFinishedGoods;
