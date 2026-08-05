import { useState } from "react";
import { Container, Row, Col, Label, Input, Table, Button } from "reactstrap";
import CustomCard from "@/common/Custom/CustomCard2";

import { CustomButton } from "@/common/ui-elements";
import { _postApi } from "@/redux/actions/api";
import { toast } from "sonner";

const MeasurementForm = () => {
  const [formData, setFormData] = useState({
    category: "",
    unit: "",
    status: "active",
  });

  const [tableData, setTableData] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAdd = () => {
    const { category, unit } = formData;

    if (!category.trim() || !unit.trim()) {
      alert("Please fill all fields.");
      return;
    }

    setTableData((prev) => [...prev, formData]);
    setFormData({ category: "", unit: "", code: "", status: "active" });
  };

  const handleDelete = (index) => {
    const updatedData = tableData.filter((_, i) => i !== index);
    setTableData(updatedData);
  };

  const handleSubmit = () => {
    if (tableData.length === 0) {
      alert("No data to submit.");
      return;
    }

    const payload = {
      query_type: "insert",
      items: tableData,
    };

    _postApi(
      `/inventory/unit-of-measure`,
      payload,
      () => {
        toast.success("sdfsd");
        alert("success");
        // console.log(payload);
        //setTableData({});
      },
      (err) => {
        console.log(err);
        toast.error("failed to fetch data");
      }
    );
  };

  const handleSubmit1 = async () => {
    if (tableData.length === 0) {
      alert("No data to submit.");
      return;
    }
    const payload = {
      facilityId: "ae9d49ee-3f9c-4f1e-bd6c-d2f18c61269f",
      query_type: "insert",
      items: tableData.map((item) => ({
        id: {}, // facility id
        category: item.category,
        unit: `${item.unit} (${item.code})`,
      })),
    };
    try {
      const response = await fetch(
        "http://localhost:42790/inventory/unit-of-measure",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        throw new Error("failed to submit");
      }
      // const result = await response.json();
      // console.log("Data submitted");
      setTableData([]);
    } catch (error) {
      console.error("Error:", error);
      alert("An error occured while submitting data");
    }

    // api for sendind to backend
  };

  return (
    <CustomCard back header="Add Unit of Measurements">
      <Container>
        {/* Input Fields */}
        <Row className="mb-3">
          <Col md={4}>
            <Label>Category</Label>
            <Input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="Enter category"
            />
          </Col>
          <Col md={4}>
            <Label>Unit</Label>
            <Input
              type="text"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              placeholder="Enter unit"
            />
          </Col>

          <Col md={4}>
            <Label>Status</Label>
            <Input
              type="select"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Input>
          </Col>
        </Row>

        {/* Add Button */}
        <Row className="mb-4">
          <Col className="text-center">
            <CustomButton onClick={handleAdd}>Add</CustomButton>
          </Col>
        </Row>

        {/* Table */}
        <Table bordered responsive>
          <thead>
            <tr>
              <th>Category</th>
              <th>Unit</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {tableData.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center text-muted">
                  No data available
                </td>
              </tr>
            ) : (
              tableData.map((item, index) => (
                <tr key={index}>
                  <td>{item.category}</td>
                  <td>{item.unit}</td>
                  <td>{item.status}</td>
                  <td>
                    <Button
                      color="danger"
                      size="sm"
                      onClick={() => handleDelete(index)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>

        {/* Submit Button */}
        <Row className="mt-3">
          <Col className="text-center">
            <CustomButton onClick={handleSubmit}>Submit</CustomButton>
          </Col>
        </Row>
      </Container>
    </CustomCard>
  );
};

export default MeasurementForm;
