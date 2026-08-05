/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "reactstrap";
import { Card } from "reactstrap/lib";
import { Settings, Check, X, Save } from "lucide-react";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";

const DEPRECIATION_METHODS = [
  {
    value: "Straight Line",
    label: "Straight-line",
    description:
      "Even expense each year over the asset useful life (cost − residual).",
  },
  {
    value: "Reducing Balance",
    label: "Reducing Balance",
    description:
      "Depreciation applied as a percentage of the declining net book value.",
  },
];

const FREQUENCIES = [
  { value: "monthly", label: "Monthly", hint: "Every month on the chosen day" },
  {
    value: "quarterly",
    label: "Quarterly",
    hint: "Jan / Apr / Jul / Oct on the chosen day",
  },
  { value: "yearly", label: "Yearly", hint: "January on the chosen day" },
];

const DepreciationMethodSelector = ({
  title = "Depreciation Method",
  code,
  description = "Default depreciation method for new fixed assets",
  icon = "📉",
}) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    if (isEditing) {
      setForm({
        method: code || activeBusiness?.depreciation_method || "Straight Line",
        autoEnabled: Boolean(activeBusiness?.auto_depreciation_enabled),
        frequency: activeBusiness?.auto_depreciation_frequency || "monthly",
        day: String(activeBusiness?.auto_depreciation_day || 1),
      });
    }
  }, [isEditing, code, activeBusiness]);

  const handleSubmit = () => {
    if (!form.method) {
      toast.error("Please select a depreciation method");
      return;
    }
    const day = parseInt(form.day, 10);
    if (form.autoEnabled && (Number.isNaN(day) || day < 1 || day > 28)) {
      toast.error("Auto-run day must be between 1 and 28");
      return;
    }

    setLoading(true);
    _postApi(
      `/account/update-depreciation-method/${encodeURIComponent(form.method)}/${activeBusiness.id}/${user.id}`,
      {
        store: activeBusiness.business_name,
        auto_depreciation_enabled: Boolean(form.autoEnabled),
        auto_depreciation_frequency: form.frequency || "monthly",
        auto_depreciation_day: day || 1,
      },
      (resp) => {
        if (resp.success) {
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: { business: resp.results },
          });
          setIsEditing(false);
          setForm({});
          toast.success("Depreciation settings saved.");
        } else {
          toast.error(resp.message || "Failed to update depreciation settings.");
        }
        setLoading(false);
      },
      (err) => {
        console.error("API Error:", err);
        setLoading(false);
        toast.error("Something went wrong while updating.");
      },
    );
  };

  const handleCancel = () => {
    setIsEditing(false);
    setForm({});
  };

  const currentMethod = DEPRECIATION_METHODS.find((i) => i.value === code);
  const selectedMethod = form.method;
  const autoEnabled = Boolean(activeBusiness?.auto_depreciation_enabled);
  const autoFreq = activeBusiness?.auto_depreciation_frequency || "monthly";
  const autoDay = activeBusiness?.auto_depreciation_day || 1;
  const lastRun = activeBusiness?.auto_depreciation_last_run
    ? String(activeBusiness.auto_depreciation_last_run).slice(0, 10)
    : null;

  return (
    <Card className="h-100 shadow-sm border-0">
      <div
        className="card-header border-0 text-white position-relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${
            activeBusiness?.primary_color || "#007bff"
          } 0%, ${activeBusiness?.primary_color || "#007bff"}dd 100%)`,
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
          <Settings size={20} className="opacity-75" />
        </div>
      </div>

      <div className="card-body p-4">
        {!code && !isEditing ? (
          <div className="text-center py-2">
            <p className="text-muted mb-3">No depreciation method configured</p>
            <Button
              size="sm"
              color="primary"
              onClick={() => setIsEditing(true)}
              className="d-flex align-items-center gap-2 mx-auto"
            >
              <Settings size={16} />
              Configure Method
            </Button>
          </div>
        ) : isEditing ? (
          <div>
            <div className="mb-3">
              <label className="fw-semibold text-gray-700 mb-3 d-block">
                Default method for new assets
              </label>
              <div className="d-flex flex-column gap-2">
                {DEPRECIATION_METHODS.map((method) => (
                  <div
                    key={method.value}
                    className="border rounded p-3"
                    style={{
                      borderColor:
                        selectedMethod === method.value
                          ? activeBusiness?.primary_color || "#007bff"
                          : "#dee2e6",
                      backgroundColor:
                        selectedMethod === method.value
                          ? `${activeBusiness?.primary_color || "#007bff"}10`
                          : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() =>
                      setForm((prev) => ({ ...prev, method: method.value }))
                    }
                  >
                    <div className="d-flex align-items-start gap-3">
                      <div className="mt-1">
                        <input
                          type="radio"
                          name="depreciationMethod"
                          value={method.value}
                          checked={selectedMethod === method.value}
                          onChange={() =>
                            setForm((prev) => ({
                              ...prev,
                              method: method.value,
                            }))
                          }
                          className="form-check-input"
                          style={{
                            width: "18px",
                            height: "18px",
                            cursor: "pointer",
                            accentColor:
                              activeBusiness?.primary_color || "#007bff",
                          }}
                        />
                      </div>
                      <div className="flex-grow-1">
                        <div
                          className="fw-semibold mb-1"
                          style={{
                            color:
                              selectedMethod === method.value
                                ? activeBusiness?.primary_color || "#007bff"
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
                        <Check
                          size={18}
                          style={{
                            color: activeBusiness?.primary_color || "#007bff",
                          }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border rounded p-3 mb-3 bg-light">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div>
                  <div className="fw-semibold">Auto-run depreciation (cron)</div>
                  <div className="text-muted small">
                    Server job posts book depreciation on the schedule below
                  </div>
                </div>
                <div className="form-check form-switch m-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={Boolean(form.autoEnabled)}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        autoEnabled: e.target.checked,
                      }))
                    }
                    style={{
                      width: "2.5rem",
                      height: "1.25rem",
                      cursor: "pointer",
                      accentColor: activeBusiness?.primary_color || "#007bff",
                    }}
                  />
                </div>
              </div>

              {form.autoEnabled && (
                <div className="row g-3 mt-1">
                  <div className="col-md-6">
                    <label className="small fw-semibold text-muted text-uppercase">
                      Frequency
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={form.frequency || "monthly"}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          frequency: e.target.value,
                        }))
                      }
                    >
                      {FREQUENCIES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <div className="text-muted small mt-1">
                      {
                        FREQUENCIES.find((f) => f.value === form.frequency)
                          ?.hint
                      }
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="small fw-semibold text-muted text-uppercase">
                      Day of month (1–28)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      className="form-control form-control-sm"
                      value={form.day || "1"}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, day: e.target.value }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="d-flex gap-2 justify-content-end">
              <Button
                size="sm"
                color="secondary"
                outline
                onClick={handleCancel}
                disabled={loading}
                className="d-flex align-items-center gap-1"
              >
                <X size={14} /> Cancel
              </Button>
              <Button
                size="sm"
                color="primary"
                onClick={handleSubmit}
                disabled={loading || !form.method}
                className="d-flex align-items-center gap-1"
              >
                <Save size={14} />
                {loading ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
              <div>
                <div className="text-muted small text-uppercase fw-semibold mb-1">
                  Current default
                </div>
                <div
                  className="fw-bold"
                  style={{ color: activeBusiness?.primary_color || "#007bff" }}
                >
                  {currentMethod?.label || code}
                </div>
                {currentMethod?.description && (
                  <div className="text-muted small mt-1">
                    {currentMethod.description}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                color="primary"
                outline
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
            </div>

            <div className="border rounded p-3">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div className="fw-semibold">Auto-run depreciation</div>
                  <div className="text-muted small">
                    {autoEnabled
                      ? `${autoFreq.charAt(0).toUpperCase()}${autoFreq.slice(1)} on day ${autoDay}`
                      : "Off — use Run Depreciation on Asset Register"}
                  </div>
                  {lastRun && (
                    <div className="text-muted small mt-1">
                      Last auto run: {lastRun}
                    </div>
                  )}
                </div>
                <span
                  className={`badge ${autoEnabled ? "bg-success" : "bg-secondary"}`}
                >
                  {autoEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default DepreciationMethodSelector;
