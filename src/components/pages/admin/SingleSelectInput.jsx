/* eslint-disable react/prop-types */
import React, { useState, useEffect } from "react";
import { Button, Label } from "reactstrap";
import { Save, X, Settings } from "lucide-react";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import { _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";

const SingleSelectSetting = ({
  label,
  code,
  settingKey,
  title,
  apiEndpoint,
  chartOfAccount,
}) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();

  // Find initial account object from code with better matching
  const findInitialAccount = () => {
    if (!code || !chartOfAccount || chartOfAccount.length === 0) {
      return null;
    }

    const found = chartOfAccount.find((i) => i.head === code);

    return found || null;
  };

  const initialAccount = findInitialAccount();

  const [form, setForm] = useState(initialAccount);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Update form when code or chartOfAccount changes
  useEffect(() => {
    const newInitialAccount = findInitialAccount();
    setForm(newInitialAccount);
  }, [code, chartOfAccount, label]);

  const handleSubmit = () => {
    if (!form?.head) {
      toast.error(`Please select ${label}`);
      return;
    }

    setLoading(true);
    _postApi(
      `/account/update-payable-code/${form.head}/${activeBusiness.id}/${user.id}?query_type=${settingKey}`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {


          setIsEditing(false);
          toast.success(`${label} updated successfully.`);
          window.location.reload();
        } else {
          toast.error(`Failed to update ${label}`);
        }
        setLoading(false);
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong.");
        setLoading(false);
      }
    );
  };

  const handleCancel = () => {
    setIsEditing(false);
    setForm(initialAccount); // reset to original object
  };

  return (
    <div className="space-y-3 px-5 py-4">
      <Label className="mb-0 text-sm font-semibold text-slate-700">
        {label} Code
      </Label>

      {!form && !isEditing ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
          <p className="mb-0 text-sm text-slate-500">No account configured</p>
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
            Configure Account
          </Button>
        </div>
      ) : isEditing ? (
        <div>
          <div className="mb-3">
            <TypeaheadCustom
              options={chartOfAccount || []}
              placeholder={`Select ${title.toLowerCase()} account`}
              labelKey={(i) => `${i.description} - (${i.head})`}
              onChange={(selectedItems) => {
                setForm(selectedItems.length > 0 ? selectedItems[0] : null);
              }}
              selected={form ? [form] : []}
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
              disabled={loading || !form?.head}
              className="d-flex align-items-center gap-2"
              style={{
                backgroundColor: "var(--aa-navy)",
                borderColor: "var(--aa-navy)",
              }}
            >
              {loading ? (
                <>
                  <div className="spinner-border spinner-border-sm" role="status"></div>
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
        <div className="space-y-2">
          <div className="d-flex justify-content-between align-items-center">
            <span className="text-muted small">Current Account:</span>
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
              {form?.description || "No description available"}
            </div>
            <div className="text-muted small">
              Code: {form?.head || "No code available"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SingleSelectSetting;
