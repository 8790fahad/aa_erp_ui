/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Label } from "reactstrap";
import { Card } from "@/components/ui/card";
import { Settings, Check, X, Save } from "lucide-react";
import { toast } from "sonner";

import { _postApi } from "@/redux/actions/api";
import { GiMetalHand } from "react-icons/gi";

const InventoryValMethod = ({
  title = "",
  code,
  description,
  icon,
  apiEndpoint = "default",
}) => {
  const [chartOfAccount, setChartOfAccount] = useState([]);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const dispatch = useDispatch();

  // Inventory valuation method options
  const inventoryValMethods = [
    { value: "Weighted Average Cost", label: "Weighted Average Cost" },
    { value: "FIFO", label: "FIFO (First In, First Out)" },
  ];

  // Valuation date options
  const valuationDateOptions = [
    { value: "All", label: "All" },
    { value: "Daily", label: "Daily" },
    { value: "Weekly", label: "Weekly" },
    { value: "Monthly", label: "Monthly" },
    { value: "Yearly", label: "Yearly" },
  ];

  // Initialize form when editing starts
  useEffect(() => {
    if (isEditing) {
      setForm({
        method: code || activeBusiness?.inv_ev_m || "",
        valuation_date: activeBusiness?.valuation_date || "All",
      });
    }
  }, [isEditing, code, activeBusiness?.inv_ev_m, activeBusiness?.valuation_date]);

  useEffect(() => {
    if (isEditingDate) {
      setForm((prev) => ({
        ...prev,
        method: code || activeBusiness?.inv_ev_m || "",
        valuation_date: activeBusiness?.valuation_date || "All",
      }));
    }
  }, [isEditingDate, code, activeBusiness?.inv_ev_m, activeBusiness?.valuation_date]);

  const handleSubmit = () => {
    // When editing only the date, method comes from activeBusiness
    const methodToSave =
      form.method || code || activeBusiness?.inv_ev_m || "";

    if (!methodToSave) {
      toast.error("Please select a valuation method");
      return;
    }

    if (!form.valuation_date) {
      toast.error("Please select a valuation date frequency");
      return;
    }

    setLoading(true);
    _postApi(
      `/account/update-inventory-val-method/${encodeURIComponent(
        methodToSave,
      )}/${activeBusiness.id}/${user.id}`,
      {
        store: activeBusiness.business_name,
        valuation_date: form.valuation_date,
      },
      (resp) => {
        if (resp.success) {
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: { business: resp.results },
          });
          setIsEditing(false);
          setIsEditingDate(false);
          setForm({});
          toast.success("Successfully updated inventory valuation settings.");
        } else {
          toast.error("Failed to update inventory valuation method.");
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
    setIsEditingDate(false);
    setForm({});
  };

  const currentMethod = inventoryValMethods.find((i) => i.value === code);
  const selectedMethod = inventoryValMethods.find(
    (i) => i.value === form.method,
  );
  const selectedValuationDate = valuationDateOptions.find(
    (opt) => opt.value === form.valuation_date,
  );
  const currentValuationDate =
    valuationDateOptions.find(
      (opt) => opt.value === activeBusiness?.valuation_date,
    ) || { value: "All", label: "All" };

  return (
    <Card className="mb-0 overflow-hidden rounded-xl border border-slate-200 shadow-none">
      <div
        className="border-0 px-5 py-3.5 text-white"
        style={{ background: "var(--aa-navy)" }}
      >
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: "1.25rem" }}>{icon}</span>
            <div>
              <h5 className="mb-0 fw-bold">{title}</h5>
              <small className="opacity-75">{description}</small>
            </div>
          </div>
          <GiMetalHand size={18} className="opacity-75" />
        </div>
      </div>

      <div className="px-5 py-4">
        {!code && !isEditing ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
            <p className="mb-0 text-sm text-slate-500">
              No valuation method configured
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
              <Label className="fw-semibold text-gray-700 mb-2">
                {title} Method
              </Label>
              <select
                className="form-select w-100"
                value={form.method || ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, method: e.target.value }))
                }
              >
                <option value="">-- Select method --</option>
                {inventoryValMethods.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <Label className="fw-semibold text-gray-700 mb-2">
                Valuation Date
              </Label>
              <select
                className="form-select w-100"
                value={form.valuation_date || "All"}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    valuation_date: e.target.value,
                  }))
                }
              >
                {valuationDateOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
              <div className="text-muted small">
                Method: {currentMethod?.value}
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center">
              <span className="text-muted small">Valuation Date:</span>
              <Button
                size="sm"
                color="link"
                className="text-decoration-none p-0 d-flex align-items-center gap-1"
                onClick={() => setIsEditingDate(true)}
                style={{ color: "var(--aa-accent)" }}
              >
                <Settings size={14} />
                Change
              </Button>
            </div>

            {isEditingDate ? (
              <div>
                <div className="mb-3">
                  <select
                    className="form-select w-100"
                    value={form.valuation_date || "All"}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        valuation_date: e.target.value,
                      }))
                    }
                  >
                    {valuationDateOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
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
                    disabled={loading}
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
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="fw-semibold" style={{ color: "var(--aa-navy)" }}>
                  {currentValuationDate.label}
                </div>
                <div className="text-muted small">
                  Frequency: {currentValuationDate.value}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default InventoryValMethod;
