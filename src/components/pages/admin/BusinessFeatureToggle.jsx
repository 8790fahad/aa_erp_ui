/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Card } from "reactstrap";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";
import { UPDATE_BUSINESS_SETTINGS } from "@/redux/actions/actionTypes";

/**
 * Reusable settings card with an enable/disable switch stored on `business`.
 */
export default function BusinessFeatureToggle({
  title,
  description,
  icon = "⚙️",
  field,
  endpointPath,
  enabledLabel = "Enabled",
  disabledLabel = "Disabled",
  enabledHelp = "",
  disabledHelp = "",
}) {
  const dispatch = useDispatch();
  const activeBusiness = useSelector((state) => state.auth.activeBusiness) || {};
  const user = useSelector((state) => state.auth.user) || {};
  const currentValue = !!activeBusiness?.[field];
  const [isEditing, setIsEditing] = useState(false);
  const [isEnabled, setIsEnabled] = useState(currentValue);
  const [loading, setLoading] = useState(false);

  const primary =
    activeBusiness?.primary_color || "#1a2d5e";

  const handleCancel = () => {
    setIsEnabled(currentValue);
    setIsEditing(false);
  };

  const handleSubmit = () => {
    if (!activeBusiness?.id) return;
    const userId = user?.id || activeBusiness.business_admin;
    if (!userId) {
      toast.error("Missing user id");
      return;
    }

    setLoading(true);
    _postApi(
      `/account/${endpointPath}/${isEnabled ? "1" : "0"}/${activeBusiness.id}/${userId}`,
      {},
      (resp) => {
        setLoading(false);
        if (resp?.success && resp.results) {
          dispatch({
            type: UPDATE_BUSINESS_SETTINGS,
            payload: { business: resp.results },
          });
          setIsEditing(false);
          toast.success(resp.message || "Setting updated");
        } else {
          toast.error(resp?.message || "Failed to update setting");
        }
      },
      (err) => {
        setLoading(false);
        toast.error(err?.message || "Network error");
      },
    );
  };

  return (
    <Card className="h-100 shadow-sm border-0">
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
              {description && (
                <small className="opacity-75">{description}</small>
              )}
            </div>
          </div>
          <Settings size={20} className="opacity-75" />
        </div>
      </div>

      <div className="card-body p-4">
        {isEditing ? (
          <div>
            <label className="fw-semibold text-gray-700 mb-3 d-block">
              {title}
            </label>
            <div className="form-check form-switch" style={{ fontSize: "1.1rem" }}>
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id={`toggle-${field}`}
                checked={isEnabled}
                onChange={() => setIsEnabled((v) => !v)}
                style={{
                  width: "3rem",
                  height: "1.5rem",
                  cursor: "pointer",
                  accentColor: primary,
                }}
              />
              <label
                className="form-check-label ms-3"
                htmlFor={`toggle-${field}`}
                style={{ cursor: "pointer" }}
              >
                {isEnabled ? (
                  <span className="text-success fw-semibold">{enabledLabel}</span>
                ) : (
                  <span className="text-muted">{disabledLabel}</span>
                )}
              </label>
            </div>
            <div className="mt-3 p-3 bg-light rounded">
              <small className="text-muted">
                {isEnabled ? enabledHelp : disabledHelp}
              </small>
            </div>
            <div className="d-flex justify-content-end gap-2 mt-4">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{ backgroundColor: primary, borderColor: primary }}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="text-muted small">Current Setting:</span>
              <button
                type="button"
                className="btn btn-link text-decoration-none p-0 d-flex align-items-center gap-1"
                onClick={() => {
                  setIsEnabled(currentValue);
                  setIsEditing(true);
                }}
              >
                <Settings size={14} />
                Change
              </button>
            </div>
            <div className="bg-light rounded p-3">
              <div className="d-flex align-items-center gap-3">
                <div className="form-check form-switch m-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={currentValue}
                    disabled
                    style={{
                      width: "2.5rem",
                      height: "1.25rem",
                      accentColor: primary,
                    }}
                  />
                </div>
                <div className="flex-grow-1">
                  <div
                    className="fw-semibold"
                    style={{ color: currentValue ? primary : "#6c757d" }}
                  >
                    {currentValue ? enabledLabel : disabledLabel}
                  </div>
                  <div className="text-muted small mt-1">
                    {currentValue ? enabledHelp : disabledHelp}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
