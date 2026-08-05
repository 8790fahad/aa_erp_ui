/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useRef } from "react";
import { Card, CardBody, CardHeader, Col, Input, Label, Row } from "reactstrap";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { _postApi } from "@/redux/actions/api";
import { unflatten } from "@/utilities";
import CustomButton from "@/common/Custom/CustomButton";
import StructureTree from "./StructureTree";

export default function SetupChartOfAccount() {
  const _form = {
    head: "",
    search: "",
    sub_head: "",
    description: "",
    account_type: "",
    account_category: "",
    store: "",
  };
  const [form, setForm] = useState(_form);
  const [isEditing, setIsEditing] = useState(false);
  const [chart, setChart] = useState([]);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [categories, setCategories] = useState([]);
  // 🌟 Track dynamic height
  const treeRef = useRef(null);
  const [cardMinHeight, setCardMinHeight] = useState("auto");
  const [openform, setFormOpen] = useState(false);

  const handleChange = ({ target: { name, value } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const getACCt = () => {
    if (!activeBusiness?.business_name) return;

    _postApi(
      `/account/chart-of-account?query_type=select`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          setChart(unflatten(resp.results));
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

  const getCategories = () => {
    if (!activeBusiness?.business_name) return;

    _postApi(
      `/account/chart-of-account?query_type=account_category`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          setCategories(resp.results);
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

  const handleCreate = () => {
    if (!form.head || !form.description) {
      toaster.warning("Head and Description are required.");
      return;
    }

    const endpoint = isEditing ? "update" : "create";

    _postApi(
      `/account/chart-of-account?query_type=${endpoint}`,
      form,
      (resp) => {
        if (resp.success) {
          toaster.success(`${isEditing ? "Updated" : "Created"} successfully`);
          getACCt();
          setForm(_form);
          setIsEditing(false);
        } else {
          toast.error("Failed to save data.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong.");
      }
    );
  };

  const handleDeleteNode = (node) => {
    _postApi(
      `/account/chart-of-account?query_type=delete`,
      { head: node.head },
      (resp) => {
        if (resp.success) {
          toaster.success("Deleted successfully");
          getACCt();
        } else {
          toast.error("Failed to delete.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while deleting.");
      }
    );
  };

  useEffect(() => {
    getACCt();
    getCategories();
  }, [activeBusiness?.business_name]);

  // 🌟 Adjust height dynamically when the chart updates
  useEffect(() => {
    if (treeRef.current) {
      setCardMinHeight(`${treeRef.current.scrollHeight + 50}px`);
    }
  }, [chart]);

  return (
    <div>
      {/* {JSON.stringify({ chart, activeBusiness })} */}
      <Card
        style={{
          borderWidth: 2,
          borderColor: activeBusiness?.primary_color,
          borderStyle: "solid",
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
          borderRadius: "8px",
          minHeight: "83vh",
          overflow: "auto",
        }}
      >
        <CardHeader
          style={{
            borderBottom: `1px solid ${activeBusiness?.primary_color}`,
            backgroundColor: activeBusiness?.primary_color,
            color: activeBusiness?.secondary_color,
            padding: "0.5rem 1rem",
            textAlign: "center",
            fontSize: "1.2rem",
            fontWeight: "bold",
            fontFamily: "Arial, sans-serif",
          }}
          className="d-flex align-items-center justify-content-center"
        >
          {" "}
          Chart of Account Setup{" "}
        </CardHeader>
        <CardBody>
          <Row>
            <Col md="8" className="pl-0 relative" style={{ marginTop: -100 }}>
              {/* {JSON.stringify(chart)} */}
              <div ref={treeRef}>
                <StructureTree
                  treeData={chart}
                  addChild={(node) => {
                    setFormOpen(true);
                    setForm((prev) => ({
                      ...prev,
                      sub_head: Number(node.head),
                      store: activeBusiness?.business_name || "",
                    }));
                  }}
                  editNode={(node) => {
                    setFormOpen(true);
                    setForm({
                      sub_head: Number(node.subhead),
                      head: Number(node.head),
                      description: node.description,
                      // id: node.id,
                      store: activeBusiness?.business_name || "",
                      account_type: node.account_type,
                      account_category: node.account_category,
                    });
                    setIsEditing(true);
                  }}
                  deleteNode={handleDeleteNode}
                />
              </div>
            </Col>
            {openform && (
              <Col md="4" className="pr-0">
                {JSON.stringify(form)}
                <Col md="12" className="mt-2">
                  <Label>Account Subhead Code</Label>
                  <Input
                    type="text"
                    name="sub_head"
                    value={form.sub_head}
                    onChange={handleChange}
                    disabled
                  />
                </Col>
                <Col md="12">
                  <Label>Select Head</Label>
                  <Input
                    type="text"
                    name="head"
                    value={form.head}
                    onChange={handleChange}
                    // disabled
                  />
                </Col>
                <Col md="12" className="mt-2">
                  <Label>Description</Label>
                  <Input
                    type="text"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                  />
                </Col>
                <Col md="12" className="mt-2">
                  <Label>Account Type</Label>
                  <Input
                    type="text"
                    name="account_type"
                    value={form.account_type}
                    onChange={handleChange}
                  />
                </Col>
                  
                <Col md="12" className="mt-2">
                  <Label>Account Category</Label>
                  <Input
                    type="select"
                    name="account_category"
                    value={form.account_category}
                    onChange={handleChange}
                    className="text-dark"
                  >
                    <option value="">Select Category.............. </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </Input>
                </Col>
            
                {/* {form.account_category === "Bank " && ()} */}
                <Row className="d-flex align-items-center justify-content-center">
                  <Col md="6" className="mt-2">
                    <CustomButton
                      onClick={() => {
                        setFormOpen(false);
                        setForm(_form);
                        setIsEditing(false);
                      }}
                      // className="mr-2"
                    >
                      Cancel 
                    </CustomButton>
                  </Col>
                  <Col md="6" className="mt-2">
                    <CustomButton
                      onClick={handleCreate}
                      disabled={!form.head || !form.description}
                    >
                      {isEditing ? "Update" : "Create"}
                    </CustomButton>
                  </Col>
                </Row>
              </Col>
            )}
          </Row>
        </CardBody>
      </Card>
    </div>
  );
}
