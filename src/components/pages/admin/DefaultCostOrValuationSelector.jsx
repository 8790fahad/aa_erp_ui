/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "reactstrap";
import { Card } from "@/components/ui/card";
import { Settings, Check, X, Save } from "lucide-react";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";
import { GiMetalHand } from "react-icons/gi";

const DefaultCostOrValuationSelector = ({
  title = "Default Cost or System Valuation",
  description = "Use product default cost or system valuation method for inventory",
}) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const dispatch = useDispatch();

  const code = activeBusiness?.default_valuation_source || "default_cost";
  const invEvM = activeBusiness?.inv_ev_m || "Weighted Average Cost";

  const options = [
    {
      value: "default_cost",
      label: "Use Default Cost",
      description: "Use product default cost / cost price",
    },
    {
      value: "system_valuation",
      label: "Use System Valuation Method",
      description: `Use inventory valuation method: ${invEvM}`,
    },
  ];

  useEffect(() => {
    if (isEditing) {
      setForm({ source: code });
    }
  }, [isEditing, code]);

  const handleSubmit = () => {
    if (!form.source) {
      toast.error("Please select an option");
      return;
    }

    setLoading(true);
    _postApi(
      `/account/update-default-valuation-source/${form.source}/${activeBusiness.id}/${user.id}`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: { business: resp.results },
          });
          setIsEditing(false);
          setForm({});
          toast.success("Successfully updated default valuation source.");
        } else {
          toast.error("Failed to update.");
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

  const handleSourceChange = (value) => {
    setForm((prev) => ({ ...prev, source: value }));
  };

  const currentOption = options.find((i) => i.value === code);
  const selectedSource = form.source;

  return (
    <Card className="mb-0 overflow-hidden rounded-xl border border-slate-200 shadow-none">
      <div
        className="border-0 px-5 py-3.5 text-white"
        style={{ background: "var(--aa-navy)" }}
      >
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: "1.25rem" }}>📊</span>
            <div>
              <h5 className="mb-0 fw-bold">{title}</h5>
              {description && <small className="opacity-75">{description}</small>}
            </div>
          </div>
          <GiMetalHand size={18} className="opacity-75" />
        </div>
      </div>

      <div className="px-5 py-4">
        {!code && !isEditing ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
            <p className="mb-0 text-sm text-slate-500">
              No valuation source configured
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
              Configure
            </Button>
          </div>
        ) : isEditing ? (
          <div>
            <div className="mb-3">
              <label className="fw-semibold text-gray-700 mb-3 d-block">
                {title}
              </label>
              <div className="d-flex flex-column gap-2">
                {options.map((opt) => (
                  <div
                    key={opt.value}
                    className="border rounded p-3 cursor-pointer transition-all"
                    style={{
                      borderColor:
                        selectedSource === opt.value
                          ? "var(--aa-navy)"
                          : "#dee2e6",
                      backgroundColor:
                        selectedSource === opt.value
                          ? "var(--aa-sidebar-active)"
                          : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => handleSourceChange(opt.value)}
                  >
                    <div className="d-flex align-items-start gap-3">
                      <div className="mt-1">
                        <input
                          type="radio"
                          name="valuationSource"
                          value={opt.value}
                          checked={selectedSource === opt.value}
                          onChange={() => handleSourceChange(opt.value)}
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
                              selectedSource === opt.value
                                ? "var(--aa-navy)"
                                : "#212529",
                          }}
                        >
                          {opt.label}
                        </div>
                        <div className="text-muted small">
                          {opt.description}
                        </div>
                      </div>
                      {selectedSource === opt.value && (
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
                disabled={loading || !form.source}
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
                    />
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
              <span className="text-muted small">Current:</span>
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
                {currentOption?.label}
              </div>
              <div className="text-muted small mt-1">
                {code === "system_valuation"
                  ? `Method selected: ${invEvM}`
                  : currentOption?.description}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default DefaultCostOrValuationSelector;
