/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Card } from "reactstrap";
import { Clock, Save, X } from "lucide-react";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";

const TIMEZONES = [
  { value: "Africa/Lagos", label: "Africa/Lagos (WAT)" },
  { value: "Africa/Accra", label: "Africa/Accra (GMT)" },
  { value: "UTC", label: "UTC" },
];

export default function InvoiceClosingSettings({
  title = "Invoice Payment Validity",
  description = "Unpaid invoices that are not on credit reverse automatically after daily closing time",
}) {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    if (isEditing) {
      setForm({
        enabled: Boolean(activeBusiness?.invoice_closing_enabled),
        time: activeBusiness?.invoice_closing_time || "17:00",
        timezone: activeBusiness?.invoice_closing_timezone || "Africa/Lagos",
      });
    }
  }, [isEditing, activeBusiness]);

  const handleSubmit = () => {
    if (!/^\d{1,2}:\d{2}$/.test(String(form.time || ""))) {
      toast.error("Closing time must be HH:mm (e.g. 17:00)");
      return;
    }

    setLoading(true);
    _postApi(
      `/account/update-invoice-closing/${activeBusiness.id}/${user.id}`,
      {
        invoice_closing_enabled: Boolean(form.enabled),
        invoice_closing_time: form.time,
        invoice_closing_timezone: form.timezone || "Africa/Lagos",
      },
      (resp) => {
        setLoading(false);
        if (resp?.success) {
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: { business: resp.results },
          });
          setIsEditing(false);
          toast.success("Invoice closing settings saved.");
        } else {
          toast.error(resp?.message || "Failed to save settings");
        }
      },
      (err) => {
        setLoading(false);
        toast.error(err?.message || "Failed to save settings");
      },
    );
  };

  const handleRunNow = () => {
    if (!activeBusiness?.id) return;
    setRunning(true);
    _postApi(
      `/account/run-invoice-closing/${activeBusiness.id}`,
      {
        userId: user?.id,
        reason: `Manual reverse of unpaid non-credit invoices after closing time ${activeBusiness.invoice_closing_time || "17:00"}`,
      },
      (resp) => {
        setRunning(false);
        if (resp?.success) {
          toast.success(resp.message || "Closing reverse completed");
        } else {
          toast.error(resp?.message || "Failed to run closing reverse");
        }
      },
      (err) => {
        setRunning(false);
        toast.error(err?.message || "Failed to run closing reverse");
      },
    );
  };

  const enabled = Boolean(activeBusiness?.invoice_closing_enabled);
  const time = activeBusiness?.invoice_closing_time || "17:00";
  const timezone = activeBusiness?.invoice_closing_timezone || "Africa/Lagos";
  const lastRun = activeBusiness?.invoice_closing_last_run
    ? String(activeBusiness.invoice_closing_last_run).slice(0, 10)
    : null;

  return (
    <Card className="h-100 shadow-sm border-0">
      <div
        className="card-header border-0 text-white position-relative overflow-hidden"
        style={{
          background: "var(--aa-navy)",
        }}
      >
        <div className="d-flex align-items-center justify-content-between py-2">
          <div className="d-flex align-items-center gap-2">
            <Clock size={20} className="opacity-90" />
            <div>
              <h5 className="mb-0 text-white">{title}</h5>
              <small className="text-white-50">{description}</small>
            </div>
          </div>
          {!isEditing && (
            <Button
              color="light"
              size="sm"
              className="text-primary fw-semibold"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="card-body">
        {!isEditing ? (
          <div className="space-y-3">
            <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
              <span className="text-muted">Auto reverse unpaid non-credit</span>
              <span
                className={`badge ${enabled ? "bg-success" : "bg-secondary"}`}
              >
                {enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
              <span className="text-muted">Daily closing time</span>
              <strong>{time}</strong>
            </div>
            <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
              <span className="text-muted">Timezone</span>
              <strong>{timezone}</strong>
            </div>
            <div className="d-flex justify-content-between align-items-center py-2">
              <span className="text-muted">Last run</span>
              <strong>{lastRun || "—"}</strong>
            </div>
            <p className="small text-muted mt-3 mb-3">
              After closing time, cash / transfer / bank / split invoices still
              waiting for cashier confirmation are reversed (GL, stock, and
              invoice removed). Credit invoices are never auto-reversed.
            </p>
            <Button
              color="outline-primary"
              size="sm"
              disabled={running}
              onClick={handleRunNow}
            >
              {running ? "Running…" : "Run reverse now"}
            </Button>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            <label className="d-flex align-items-center gap-2 mb-0">
              <input
                type="checkbox"
                checked={Boolean(form.enabled)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, enabled: e.target.checked }))
                }
              />
              <span>Enable daily auto-reverse after closing time</span>
            </label>

            <div>
              <label className="form-label small text-muted mb-1">
                Closing time
              </label>
              <input
                type="time"
                className="form-control"
                value={form.time || "17:00"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, time: e.target.value }))
                }
              />
              <small className="text-muted">
                Example: 17:00 — unpaid non-credit invoices reverse after 5:00
                PM.
              </small>
            </div>

            <div>
              <label className="form-label small text-muted mb-1">
                Timezone
              </label>
              <select
                className="form-select"
                value={form.timezone || "Africa/Lagos"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, timezone: e.target.value }))
                }
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="d-flex gap-2 mt-2">
              <Button
                color="primary"
                size="sm"
                disabled={loading}
                onClick={handleSubmit}
                className="d-inline-flex align-items-center gap-1"
              >
                <Save size={14} />
                {loading ? "Saving…" : "Save"}
              </Button>
              <Button
                color="light"
                size="sm"
                disabled={loading}
                onClick={() => {
                  setIsEditing(false);
                  setForm({});
                }}
                className="d-inline-flex align-items-center gap-1"
              >
                <X size={14} />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
