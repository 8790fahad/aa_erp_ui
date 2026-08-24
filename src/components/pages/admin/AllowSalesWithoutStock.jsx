/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "reactstrap";
import { Card } from "reactstrap/lib";
import { Settings, Save, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";

const AllowSalesWithoutStock = ({
  title = "Allow Sales Without Stock",
  value,
  description = "Enable or disable the ability to make sales when products are out of stock",
  icon = "🛒",
}) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const [isEnabled, setIsEnabled] = useState(value || false);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const dispatch = useDispatch();

  const handleToggle = () => {
    setIsEnabled((prev) => !prev);
  };

  const handleSubmit = () => {
    setLoading(true);
    _postApi(
      `/account/update-allow-sales-without-stock/${isEnabled ? "1" : "0"}/${activeBusiness.id}/${user.id}`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: { business: resp.results },
          });
          setIsEditing(false);
          toast.success("Successfully updated sales without stock setting.");
        } else {
          toast.error("Failed to update setting.");
        }
        setLoading(false);
      },
      (err) => {
        console.error("API Error:", err);
        setLoading(false);
        toast.error("Something went wrong while updating.");
      }
    );
  };

  const handleCancel = () => {
    setIsEnabled(value || false);
    setIsEditing(false);
  };

  return (
    <Card className="h-100 shadow-sm border-0">
      {/* Card Header */}
      <div
        className="card-header border-0 text-white position-relative overflow-hidden"
        style={{
          background: "var(--aa-navy)",
          padding: "1rem",
        }}
      >
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: "1.5rem" }}>{icon}</span>
            <div>
              <h5 className="mb-0 fw-bold">{title}</h5>
              {description && <small className="opacity-75">{description}</small>}
            </div>
          </div>
          <ShoppingCart size={20} className="opacity-75" />
        </div>
      </div>

      {/* Card Body */}
      <div className="card-body p-4">
        {isEditing ? (
          <div>
            <div className="mb-4">
              <label className="fw-semibold text-gray-700 mb-3 d-block">
                {title}
              </label>
              <div className="d-flex align-items-center gap-3">
                <div
                  className="form-check form-switch"
                  style={{ fontSize: "1.1rem" }}
                >
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="allowSalesSwitch"
                    checked={isEnabled}
                    onChange={handleToggle}
                    style={{
                      width: "3rem",
                      height: "1.5rem",
                      cursor: "pointer",
                      accentColor:
                        activeBusiness?.primary_color || "#007bff",
                    }}
                  />
                  <label
                    className="form-check-label ms-3"
                    htmlFor="allowSalesSwitch"
                    style={{ cursor: "pointer" }}
                  >
                    {isEnabled ? (
                      <span className="text-success fw-semibold">Enabled</span>
                    ) : (
                      <span className="text-muted">Disabled</span>
                    )}
                  </label>
                </div>
              </div>
              <div className="mt-3 p-3 bg-light rounded">
                <small className="text-muted">
                  {isEnabled
                    ? "Sales can be made even when products are out of stock. This allows flexibility in order processing but may lead to negative inventory."
                    : "Sales require sufficient stock. Products must have available inventory before a sale can be completed."}
                </small>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2">
              <Button
                size="sm"
                color="secondary"
                outline
                onClick={handleCancel}
                disabled={loading}
                className="d-flex align-items-center gap-2"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                color="primary"
                onClick={handleSubmit}
                disabled={loading}
                className="d-flex align-items-center gap-2"
              >
                {loading ? (
                  <>
                    <div
                      className="spinner-border spinner-border-sm"
                      role="status"
                    ></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="text-muted small">Current Setting:</span>
              <Button
                size="sm"
                color="link"
                className="text-decoration-none p-0 d-flex align-items-center gap-1"
                onClick={() => setIsEditing(true)}
              >
                <Settings size={14} />
                Change
              </Button>
            </div>

            <div className="bg-light rounded p-3">
              <div className="d-flex align-items-center gap-3 mb-2">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={value || false}
                    disabled
                    style={{
                      width: "2.5rem",
                      height: "1.25rem",
                      accentColor:
                        activeBusiness?.primary_color || "#007bff",
                    }}
                  />
                </div>
                <div className="flex-grow-1">
                  <div
                    className="fw-semibold"
                    style={{
                      color: value
                        ? activeBusiness?.primary_color || "#007bff"
                        : "#6c757d",
                    }}
                  >
                    {value ? "Enabled" : "Disabled"}
                  </div>
                  <div className="text-muted small mt-1">
                    {value
                      ? "Sales can be made without stock"
                      : "Sales require available stock"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default AllowSalesWithoutStock;
