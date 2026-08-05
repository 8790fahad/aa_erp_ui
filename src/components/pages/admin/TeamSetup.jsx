/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import CustomButton from "@/common/Custom/CustomButton";
import React, { useRef, useState, useEffect } from "react";
import { FaCartPlus, FaPlus } from "react-icons/fa";
import { FiDelete } from "react-icons/fi";
import { Row, Table, Button, CardBody, Col, Input } from "reactstrap";
import CustomCard from "@/common/Custom/CustomCard2";
import { Typeahead } from "react-bootstrap-typeahead";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { useNavigate } from "react-router-dom";

export default function TeamSetup({ formSetup = [] }) {
  const [form, setForm] = useState({
    member: "",
    position: "",
    status: "",
  });
  const [data, setData] = useState([]);
  const [memberData, setMemberData] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef();
  const { user = {}, activeBusiness = {} } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  useEffect(() => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=team_members`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setMemberData(resp.results);
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  }, [activeBusiness.id]);

  const handleDelete = (index) => {
    setData((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    // if (!form.userId) return toast.error("Member is required");
    if (!form.position) return toast.error("Position is required");
    if (!form.status) return toast.error("Status is required");
    return true;
  };

  const handleFormChange = ({ target: { name, value } }) =>
    setForm((prev) => ({ ...prev, [name]: value }));

  const handleAdd = () => {
    if (!validateForm()) return;

    setData((prev) => [...prev, form]);
    setForm({
      member: "",
      position: "",
      status: "",
    });
    inputRef.current.clear();
  };

  const handleSubmit = () => {
    if (data.length === 0) {
      return toaster.warning("Please add at least one team member.");
    }

    setLoading(true);

    _postApi(
      `/v1/customer/insertTeamSetup`,
      {
        data,
        facilityId: activeBusiness?.id,
      },
      (res) => {
        if (res.success) {
          toaster.success(res.message || "Team setup submitted successfully");
          navigate(-1);
        } else {
          toast.error(res.message || "Failed to submit");
        }
        setLoading(false);
      },
      (err) => {
        toast.error("An error occurred while submitting");
        console.error(err);
        setLoading(false);
      }
    );
  };

  return (
    <CustomCard back header="Team Setup">
      {/* {JSON.stringify({ form, data, memberData })} */}
      <CardBody>
        <Row>
          <Col md={4}>
            <label>Member</label>
            <Typeahead
              id="member-typeahead"
              ref={inputRef}
              options={memberData}
              className="z-100"
              placeholder="Select Member..."
              onChange={(selected) => {
                const member = selected[0];
                if (member) {
                  setForm((prev) => ({
                    ...prev,
                    member: `${member.firstname} ${member.lastname}`,
                    userId: member.id,
                    firstName: member.firstname,
                    lastName: member.lastname,
                  }));
                }
              }}
              labelKey={(option) => `${option.firstname} ${option.lastname}`}
            />
          </Col>
          <Col md={4}>
            <label>Position</label>
            <Input
              type="select"
              name="position"
              value={form.position}
              onChange={handleFormChange}
            >
              <option value="">Select Position</option>
              <option value="Team Leader">Team Leader</option>
              <option value="Team Member">Team Member</option>
            </Input>
          </Col>
          <Col md={4}>
            <label>Status</label>
            <Input
              type="select"
              name="status"
              value={form.status}
              onChange={handleFormChange}
            >
              <option value="">Select Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Input>
          </Col>
        </Row>

        <center>
          <CustomButton
            onClick={handleAdd}
            className="mb-2 px-4 d-flex align-items-center fw-bold mt-4"
          >
            <FaPlus className="mr-2" /> Add
          </CustomButton>
        </center>

        {data.length > 0 && (
          <Table size="sm">
            <thead>
              <tr>
                <th className="text-center">#</th>
                <th className="text-center">Member</th>
                <th className="text-center">Position</th>
                <th className="text-center">Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr key={i}>
                  <td className="text-center">{i + 1}</td>
                  <td className="text-left">
                    {item.firstName} {item.lastName}
                  </td>
                  <td className="text-left">{item.position}</td>
                  <td className="text-left">{item.status}</td>
                  <td className="text-center">
                    <Button
                      size="sm"
                      onClick={() => handleDelete(i)}
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

        {data.length > 0 && (
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
