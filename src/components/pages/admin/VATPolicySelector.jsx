/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "reactstrap";
import { Card } from "reactstrap/lib";
import { Settings, Check, X, Save, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";
import { Receipt } from "lucide-react";

const VATPolicySelector = ({
  title = "Company VAT Policy",
  code,
  description = "Set whether VAT is exclusive or inclusive of prices",
  icon = "🧾",
}) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [allowSalesWithoutStock, setAllowSalesWithoutStock] = useState(
    activeBusiness?.allow_sales_without_stock || false
  );
  const [loadingStockSetting, setLoadingStockSetting] = useState(false);
  const dispatch = useDispatch();

  // VAT Policy options
  const vatPolicies = [
    {
      value: "vat_exclusive",
      label: "VAT-Exclusive (Recommended / Default)",
      description: "VAT is added on top of the base price",
    },
    {
      value: "vat_inclusive",
      label: "VAT-Inclusive (Exception)",
      description: "VAT is included in the displayed price",
    },
    {
      value: "all",
      label: "All (Both VAT-Exclusive and VAT-Inclusive)",
      description: "Supports both VAT-Exclusive (VAT added on top) and VAT-Inclusive (VAT included in price) based on individual tax settings",
    },
  ];

  // Initialize form when editing starts
  useEffect(() => {
    if (isEditing) {
      setForm({
        policy: code || "",
        allowSalesWithoutStock: activeBusiness?.allow_sales_without_stock || false
      });
    }
  }, [isEditing, code, activeBusiness?.allow_sales_without_stock]);

  // Sync allowSalesWithoutStock with activeBusiness
  useEffect(() => {
    setAllowSalesWithoutStock(activeBusiness?.allow_sales_without_stock || false);
  }, [activeBusiness?.allow_sales_without_stock]);

  const handleSubmit = () => {
    if (!form.policy) {
      toast.error("Please select a VAT policy");
      return;
    }

    setLoading(true);

    // Update VAT Policy first
    _postApi(
      `/account/update-vat-policy/${form.policy}/${activeBusiness.id}/${user.id}`,
      { store: activeBusiness.business_name },
      (vatPolicyResp) => {
        if (!vatPolicyResp.success) {
          toast.error("Failed to update VAT policy.");
          setLoading(false);
          return;
        }

        // Update Allow Sales Without Stock if it changed
        const stockSettingChanged =
          form.allowSalesWithoutStock !== (activeBusiness?.allow_sales_without_stock || false);

        if (stockSettingChanged) {
          _postApi(
            `/account/update-allow-sales-without-stock/${form.allowSalesWithoutStock ? "1" : "0"}/${activeBusiness.id}/${user.id}`,
            { store: activeBusiness.business_name },
            (stockResp) => {
              if (!stockResp.success) {
                toast.error("VAT policy updated but failed to update sales without stock setting.");
                setLoading(false);
                return;
              }

              // Use the latest business data from stock update
              dispatch({
                type: "UPDATE_BUSINESS_SETTINGS",
                payload: { business: stockResp.results },
              });
              setAllowSalesWithoutStock(form.allowSalesWithoutStock);
              setIsEditing(false);
              setForm({});
              setLoading(false);
              toast.success("Successfully updated VAT policy and sales without stock setting.");
            },
            (err) => {
              console.error("API Error updating stock setting:", err);
              setLoading(false);
              toast.error("VAT policy updated but failed to update sales without stock setting.");
            }
          );
        } else {
          // Only VAT policy was updated
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: { business: vatPolicyResp.results },
          });
          setIsEditing(false);
          setForm({});
          setLoading(false);
          toast.success("Successfully updated VAT policy.");
        }
      },
      (err) => {
        console.error("API Error updating VAT policy:", err);
        setLoading(false);
        toast.error("Something went wrong while updating VAT policy.");
      }
    );
  };

  const handleCancel = () => {
    setIsEditing(false);
    setForm({});
  };

  const handlePolicyChange = (value) => {
    setForm((prev) => ({
      ...prev,
      policy: value,
    }));
  };

  const handleStockSettingToggle = () => {
    const newValue = !allowSalesWithoutStock;
    setLoadingStockSetting(true);

    _postApi(
      `/account/update-allow-sales-without-stock/${newValue ? "1" : "0"}/${activeBusiness.id}/${user.id}`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: { business: resp.results },
          });
          setAllowSalesWithoutStock(newValue);
          toast.success("Successfully updated sales without stock setting.");
        } else {
          toast.error("Failed to update setting.");
        }
        setLoadingStockSetting(false);
      },
      (err) => {
        console.error("API Error:", err);
        setLoadingStockSetting(false);
        toast.error("Something went wrong while updating.");
      }
    );
  };

  const currentPolicy = vatPolicies.find((i) => i.value === code);
  const selectedPolicy = form.policy;

  return (
    <Card className="h-100 shadow-sm border-0">
      {/* Card Header */}

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
          <Receipt size={20} className="opacity-75" />
        </div>
      </div>

      <div className="card-body p-4">
        {!code && !isEditing ? (
          <div className="text-center py-2">
            <div className="text-muted mb-3">
              <Receipt size={32} className="opacity-25" />
            </div>
            <p className="text-muted mb-3">No VAT policy configured</p>
            <Button
              size="sm"
              color="primary"
              onClick={() => setIsEditing(true)}
              className="d-flex align-items-center gap-2 mx-auto"
            >
              <Settings size={16} />
              Configure Policy
            </Button>
          </div>
        ) : isEditing ? (
          <div>
            <div className="mb-3">
              <label className="fw-semibold text-gray-700 mb-3 d-block">
                {title}
              </label>
              <div className="d-flex flex-column gap-2">
                {vatPolicies.map((policy) => (
                  <div
                    key={policy.value}
                    className="border rounded p-3 cursor-pointer transition-all"
                    style={{
                      borderColor:
                        selectedPolicy === policy.value
                          ? activeBusiness?.primary_color || "#007bff"
                          : "#dee2e6",
                      backgroundColor:
                        selectedPolicy === policy.value
                          ? `${activeBusiness?.primary_color || "#007bff"}10`
                          : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => handlePolicyChange(policy.value)}
                  >
                    <div className="d-flex align-items-start gap-3">
                      <div className="mt-1">
                        <input
                          type="radio"
                          name="vatPolicy"
                          value={policy.value}
                          checked={selectedPolicy === policy.value}
                          onChange={() => handlePolicyChange(policy.value)}
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
                              selectedPolicy === policy.value
                                ? activeBusiness?.primary_color || "#007bff"
                                : "#212529",
                          }}
                        >
                          {policy.label}
                        </div>
                        <div className="text-muted small">
                          {policy.description}
                        </div>
                      </div>
                      {selectedPolicy === policy.value && (
                        <Check
                          size={20}
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

            {/* Allow Sales Without Stock Setting in Edit Mode */}
            <div className="border-top pt-3 mt-3">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <ShoppingCart size={16} className="text-muted" />
                    <label className="fw-semibold text-gray-700 mb-0">
                      Allow Sales Without Stock
                    </label>
                  </div>
                  <p className="text-muted small mb-0">
                    Enable sales when products are out of stock
                  </p>
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="allowSalesSwitchEdit"
                    checked={form.allowSalesWithoutStock || false}
                    onChange={(e) => {
                      setForm((prev) => ({
                        ...prev,
                        allowSalesWithoutStock: e.target.checked,
                      }));
                    }}
                    style={{
                      width: "3rem",
                      height: "1.5rem",
                      cursor: "pointer",
                      accentColor:
                        activeBusiness?.primary_color || "#007bff",
                    }}
                  />
                </div>
              </div>
              <div className="p-3 bg-light rounded">
                <small className="text-muted">
                  {form.allowSalesWithoutStock
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
                <X size={14} />
                Cancel
              </Button>
              <Button
                size="sm"
                color="primary"
                onClick={handleSubmit}
                disabled={loading || !form.policy}
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
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small">Current Policy:</span>
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

            <div className="bg-light rounded p-3 mb-3">
              <div className="fw-semibold text-primary">
                {currentPolicy?.label}
              </div>
              <div className="text-muted small mt-1">
                {currentPolicy?.description}
              </div>
            </div>

            {/* Allow Sales Without Stock Setting */}
            <div className="border-top pt-3 mt-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <ShoppingCart size={16} className="text-muted" />
                    <label className="fw-semibold text-gray-700 mb-0">
                      Allow Sales Without Stock
                    </label>
                  </div>
                  <p className="text-muted small mb-0">
                    Enable sales when products are out of stock
                  </p>
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="allowSalesSwitch"
                    checked={allowSalesWithoutStock}
                    onChange={handleStockSettingToggle}
                    disabled={loadingStockSetting}
                    style={{
                      width: "3rem",
                      height: "1.5rem",
                      cursor: loadingStockSetting ? "not-allowed" : "pointer",
                      accentColor:
                        activeBusiness?.primary_color || "#007bff",
                    }}
                  />
                </div>
              </div>
              {loadingStockSetting && (
                <div className="text-center mt-2">
                  <div
                    className="spinner-border spinner-border-sm"
                    role="status"
                  ></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default VATPolicySelector;


