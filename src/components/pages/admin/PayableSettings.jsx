/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "reactstrap";
import { Card, Label } from "reactstrap/lib";
import { Settings, Check, X, Save } from "lucide-react";
import { toast } from "sonner";

import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import { _postApi } from "@/redux/actions/api";

const PayableSettings = ({
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
  const dispatch = useDispatch();

  const getChartOfAccount = useCallback(() => {
    if (!activeBusiness?.business_name) return;

    _postApi(
      `/account/chart-of-account?query_type=select`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          setChartOfAccount(resp.results);
        }
      },
      (err) => {
        console.error("API Error:", err);
      }
    );
  }, [activeBusiness.business_name]);

  useEffect(() => {
    getChartOfAccount();
  }, [getChartOfAccount]);

  // Initialize form when editing starts
  useEffect(() => {
    if (isEditing) {
      setForm({ head: code || "" });
    }
  }, [isEditing, code]);

  const handleSubmit = () => {
    if (!form.head) {
      toast.error("Please select an account");
      return;
    }

    setLoading(true);
    _postApi(
      `/account/update-payable-code/${form.head}/${activeBusiness.id}/${user.id}?query_type=${title}`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          setIsEditing(false);
          setForm({});
          toast.success("Successfully updated account code.");
          // Reload the page to reflect changes
          window.location.reload();
        } else {
          toast.error("Failed to update account code.");
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

  const currentAccount = chartOfAccount.find((i) => i.head === code);
  const selectedAccount = chartOfAccount.find((i) => i.head === form.head);

  return (
    <Card className="h-100 shadow-sm border-0">
      {/* Card Header */}
      {/* {JSON.stringify(code)} */}
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
              <small className="opacity-75">{description}</small>
            </div>
          </div>
          <Settings size={20} className="opacity-75" />
        </div>
      </div>

      {/* Card Body */}
      <div className="card-body p-4">
        {!code && !isEditing ? (
          <div className="text-center py-2">
            <div className="text-muted mb-3">
              <Settings size={32} className="opacity-25" />
            </div>
            <p className="text-muted mb-3">No account configured</p>
            <Button
              size="sm"
              color="primary"
              onClick={() => setIsEditing(true)}
              className="d-flex align-items-center gap-2 mx-auto"
            >
              <Settings size={16} />
              Configure Account
            </Button>
          </div>
        ) : isEditing ? (
          <div>
            <div className="mb-3">
              <Label className="fw-semibold text-gray-700 mb-2">
                {title} Account
              </Label>
              <TypeaheadCustom
                options={chartOfAccount}
                placeholder={`Select ${title.toLowerCase()} account`}
                labelKey={(i) => `${i.description} - (${i.head})`}
                onChange={(selectedItems) => {
                  if (selectedItems.length > 0) {
                    setForm((prev) => ({
                      ...prev,
                      head: selectedItems[0].head,
                    }));
                  } else {
                    setForm((prev) => ({
                      ...prev,
                      head: "",
                    }));
                  }
                }}
                selected={selectedAccount ? [selectedAccount] : []}
              />
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
                disabled={loading || !form.head}
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
              <span className="text-muted small">Current Account:</span>
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
              <div className="fw-semibold text-primary">
                {currentAccount?.description}
              </div>
              <div className="text-muted small">
                Code: {currentAccount?.head}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default PayableSettings;
