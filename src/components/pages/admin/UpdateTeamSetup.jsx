/* eslint-disable no-unused-vars */
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Typeahead } from "react-bootstrap-typeahead";
import { toast } from "sonner";
import { Row, Col, Input, Table, Button, CardBody } from "reactstrap";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import { FaPlus, FaSave } from "react-icons/fa";
import { FiDelete } from "react-icons/fi";
import { _postApi } from "@/redux/actions/api";

export default function UpdateTeamSetup() {
  const [form, setForm] = useState({ member: "", position: "", status: "" });
  const [data, setData] = useState([]);
  const [memberData, setMemberData] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef();
  const navigate = useNavigate();
  const { teamId } = useParams();
  const { activeBusiness = {} } = useSelector((state) => state.auth);

  useEffect(() => {
    _postApi(
      `/v1/customer/getTeamMembers`,
      { teamId },
      (res) => {
        if (res.success) {
          setData(res.results);
        }
      },
      (err) => {
        toast.error("Failed to fetch team data");
        console.error(err);
      }
    );
  }, [teamId]);

  useEffect(() => {
    _postApi(
      `/inventory/product-list?query_type=team_members`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) setMemberData(resp.results);
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Could not fetch member list.");
      }
    );
  }, [activeBusiness.id]);

  const handleFormChange = ({ target: { name, value } }) =>
    setForm((prev) => ({ ...prev, [name]: value }));

  const validateForm = () => {
    if (!form.position) return toast.error("Position is required");
    if (!form.status) return toast.error("Status is required");
    return true;
  };

  const handleAdd = () => {
    if (!validateForm()) return;
    setData((prev) => [...prev, form]);
    setForm({ member: "", position: "", status: "" });
    inputRef.current.clear();
  };

  const handleDelete = (index) => {
    setData((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (data.length === 0) {
      return toaster.warning("Please add at least one team member.");
    }
    setLoading(true);
    _postApi(
      `/v1/materials/updateTeamMembers`,
      {
        data,
        teamId,
        facilityId: activeBusiness.id,
      },
      (res) => {
        if (res.success) {
          toaster.success("Team updated successfully");
          navigate(-1);
        } else {
          toast.error(res.message || "Failed to update");
        }
        setLoading(false);
      },
      (err) => {
        console.error(err);
        toast.error("An error occurred");
        setLoading(false);
      }
    );
  };

  return (
    <CustomCard back header={`Update Team: ${teamId}`}>
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
                <th className="text-left">Member</th>
                <th className="text-left">Position</th>
                <th className="text-left">Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr key={i}>
                  <td className="text-center">{i + 1}</td>
                  <td>{item.name || item.member}</td>
                  <td>{item.team_position || item.position}</td>
                  <td>{item.status}</td>
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
              <FaSave className="mr-2" /> Update
            </CustomButton>
          </div>
        )}
      </CardBody>
    </CustomCard>
  );
}
