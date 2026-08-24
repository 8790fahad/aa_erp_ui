/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "reactstrap";
import { Card } from "@/components/ui/card";
import { Settings, Check, X, Save } from "lucide-react";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";
import { GiMetalHand } from "react-icons/gi";

const CostingMethodSelector = ({
  title = "Costing Method",
  code,
  description = "Select costing method for products or batches",
  icon = "📊",
}) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const dispatch = useDispatch();

  // Costing method options
  const costingMethods = [
    {
      value: "process_costing",
      label: "Process Costing (Shared Inputs)",
      description: "Use shared inputs across multiple products or batches",
    },
    {
      value: "job_product_costing",
      label: "Job / Product Costing (Individual BOM)",
      description: "Use individual Bill of Materials for each product or job",
    },
  ];

  // Initialize form when editing starts
  useEffect(() => {
    if (isEditing) {
      setForm({ method: code || "" });
    }
  }, [isEditing, code]);

  const handleSubmit = () => {
    if (!form.method) {
      toast.error("Please select a costing method");
      return;
    }

    setLoading(true);
    _postApi(
      `/account/update-costing-method/${form.method}/${activeBusiness.id}/${user.id}`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: { business: resp.results },
          });
          setIsEditing(false);
          setForm({});
          toast.success("Successfully updated costing method.");
        } else {
          toast.error("Failed to update costing method.");
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
    setIsEditing(false);
    setForm({});
  };

  const handleMethodChange = (value) => {
    setForm((prev) => ({
      ...prev,
      method: value,
    }));
  };

  const currentMethod = costingMethods.find((i) => i.value === code);
  const selectedMethod = form.method;

  return (
    <Card className="mb-0 overflow-hidden rounded-xl border border-slate-200 shadow-none">
      {/* Card Header */}
      <div
        className="border-0 px-5 py-3.5 text-white"
        style={{ background: "var(--aa-navy)" }}
      >
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: "1.25rem" }}>{icon}</span>
            <div>
              <h5 className="mb-0 fw-bold">{title}</h5>
              {description && <small className="opacity-75">{description}</small>}
            </div>
          </div>
          <GiMetalHand size={18} className="opacity-75" />
        </div>
      </div>

      {/* Card Body */}
      <div className="px-5 py-4">
        {!code && !isEditing ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
            <p className="mb-0 text-sm text-slate-500">
              No costing method configured
            </p>
            <Button
              size="sm"
              color="primary"
              onClick={() => setIsEditing(true)}
              className="d-flex align-items-center gap-2"
              style={{
                backgroundColor: "var(--aa-navy)",
                borderColor: "var(--aa-navy)",
              }}
            >
              <Settings size={16} />
              Configure Method
            </Button>
          </div>
        ) : isEditing ? (
          <div>
            <div className="mb-3">
              <label className="fw-semibold text-gray-700 mb-3 d-block">
                {title} Method
              </label>
              <div className="d-flex flex-column gap-2">
                {costingMethods.map((method) => (
                  <div
                    key={method.value}
                    className="border rounded p-3 cursor-pointer transition-all"
                    style={{
                      borderColor:
                        selectedMethod === method.value
                          ? "var(--aa-navy)"
                          : "#dee2e6",
                      backgroundColor:
                        selectedMethod === method.value
                          ? "var(--aa-sidebar-active)"
                          : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => handleMethodChange(method.value)}
                  >
                    <div className="d-flex align-items-start gap-3">
                      <div className="mt-1">
                        <input
                          type="radio"
                          name="costingMethod"
                          value={method.value}
                          checked={selectedMethod === method.value}
                          onChange={() => handleMethodChange(method.value)}
                          className="form-check-input"
                          style={{
                            width: "18px",
                            height: "18px",
                            cursor: "pointer",
                            accentColor: "var(--aa-navy)",
                          }}
                        />
                      </div>
                      <div className="flex-grow-1">
                        <div
                          className="fw-semibold mb-1"
                          style={{
                            color:
                              selectedMethod === method.value
                                ? "var(--aa-navy)"
                                : "#212529",
                          }}
                        >
                          {method.label}
                        </div>
                        <div className="text-muted small">
                          {method.description}
                        </div>
                      </div>
                      {selectedMethod === method.value && (
                        <Check size={20} style={{ color: "var(--aa-navy)" }} />
                      )}
                    </div>
                  </div>
                ))}
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
                <X size={14} />
                Cancel
              </Button>
              <Button
                size="sm"
                color="primary"
                onClick={handleSubmit}
                disabled={loading || !form.method}
                className="d-flex align-items-center gap-2"
                style={{
                  backgroundColor: "var(--aa-navy)",
                  borderColor: "var(--aa-navy)",
                }}
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
          <div className="space-y-3">
            <div className="d-flex justify-content-between align-items-center">
              <span className="text-muted small">Current Method:</span>
              <Button
                size="sm"
                color="link"
                className="text-decoration-none p-0 d-flex align-items-center gap-1"
                onClick={() => setIsEditing(true)}
                style={{ color: "var(--aa-accent)" }}
              >
                <Settings size={14} />
                Change
              </Button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="fw-semibold" style={{ color: "var(--aa-navy)" }}>
                {currentMethod?.label}
              </div>
              <div className="text-muted small mt-1">
                {currentMethod?.description}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default CostingMethodSelector;

