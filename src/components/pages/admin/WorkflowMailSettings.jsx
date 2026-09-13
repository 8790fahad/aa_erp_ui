/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Mail, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { _fetchApi, _postApi } from "@/redux/actions/api";

const FALLBACK_CATALOG = [
  {
    id: "invoice",
    label: "Sales invoices",
    steps: [
      {
        id: "actor",
        label: "Person who posted the invoice",
        sentTo:
          "Confirmation email to the user who created or posted the invoice",
      },
      {
        id: "discount",
        label: "Discount approval",
        sentTo: "Collection Reconciliation (Discount) / Verification Points users",
      },
      {
        id: "credit",
        label: "Credit approval",
        sentTo: "Verification Points (Credit) users",
      },
      {
        id: "deposit",
        label: "Apply deposit",
        sentTo: "Verification Points (Apply Deposit) users",
      },
      {
        id: "payment_mode",
        label: "Payment mode approval",
        sentTo: "Verification Points (Payment Mode) users",
      },
      {
        id: "verification",
        label: "Verification Points / Cashier",
        sentTo: "Cashiers and Verification Points collectors",
      },
      {
        id: "separation",
        label: "Invoice Separation",
        sentTo: "Invoice Separation users",
      },
      {
        id: "warehouse",
        label: "Warehouse Collection",
        sentTo: "Warehouse Collection / Warehouse Requests users",
      },
    ],
  },
  {
    id: "memo",
    label: "Memos",
    steps: [
      {
        id: "actor",
        label: "Person who posted the memo",
        sentTo: "Confirmation email to the user who posted the memo",
      },
      {
        id: "approval",
        label: "Memo approval",
        sentTo: "Internal Audit / Administrative Review / Pending Memos users",
      },
      {
        id: "raiser",
        label: "Memo raiser (returned / rejected / status)",
        sentTo: "The staff member who originally raised the memo",
      },
      {
        id: "bill",
        label: "Bill (after approval)",
        sentTo: "Bill / Create Bill / View Expenses Memos users",
      },
    ],
  },
  {
    id: "purchase_requisition",
    label: "Purchase requisitions",
    steps: [
      {
        id: "actor",
        label: "Person who posted the PR",
        sentTo: "Confirmation email to the user who posted the requisition",
      },
      {
        id: "approval",
        label: "Purchase Order approval",
        sentTo: "Approve Purchase Order / Goods received users",
      },
      {
        id: "bill",
        label: "Bill",
        sentTo: "Bill / Create Bill users",
      },
    ],
  },
  {
    id: "purchase_order",
    label: "Purchase orders",
    steps: [
      {
        id: "actor",
        label: "Person who posted the PO",
        sentTo: "Confirmation email to the user who posted the purchase order",
      },
      {
        id: "approval",
        label: "Approve Purchase Order",
        sentTo: "Approve Purchase Order / Goods received users",
      },
    ],
  },
  {
    id: "goods_transfer",
    label: "Goods transfers",
    steps: [
      {
        id: "actor",
        label: "Person who posted the transfer",
        sentTo: "Confirmation email to the user who posted the transfer",
      },
      {
        id: "approval",
        label: "Pending Approvals",
        sentTo: "Pending Approvals / Goods users",
      },
    ],
  },
  {
    id: "journal",
    label: "Journal entries",
    steps: [
      {
        id: "actor",
        label: "Person who posted the journal",
        sentTo: "Confirmation email to the user who posted the journal",
      },
      {
        id: "next",
        label: "Journal Entries queue",
        sentTo: "Journal Entries users who need to post or view it",
      },
    ],
  },
  {
    id: "production",
    label: "Production",
    steps: [
      {
        id: "actor",
        label: "Person who posted production",
        sentTo: "Confirmation email to the user who posted production",
      },
      {
        id: "price_setup",
        label: "Price Setup",
        sentTo: "Price Setup users for costing follow-up",
      },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    steps: [
      {
        id: "actor",
        label: "Person who ran payroll",
        sentTo: "Confirmation email to the user who ran or posted payroll",
      },
      {
        id: "confirm",
        label: "Payroll History / confirm",
        sentTo: "Payroll History / Processing users",
      },
      {
        id: "payment",
        label: "Payroll Payment",
        sentTo: "Payroll Payment users",
      },
    ],
  },
  {
    id: "credit_note",
    label: "Credit notes",
    steps: [
      {
        id: "actor",
        label: "Person who posted the credit note",
        sentTo: "Confirmation email to the user who posted the credit note",
      },
      {
        id: "next",
        label: "Credit Notes queue",
        sentTo: "Credit Notes users",
      },
    ],
  },
  {
    id: "price_update",
    label: "Price updates",
    steps: [
      {
        id: "actor",
        label: "Person who changed prices",
        sentTo: "Confirmation email to the user who updated prices",
      },
      {
        id: "next",
        label: "Price Setup / Sales",
        sentTo: "Price Setup, Make sales, Invoices, and Products users",
      },
    ],
  },
  {
    id: "deposit_git",
    label: "Deposit to GIT",
    steps: [
      {
        id: "actor",
        label: "Person who posted the deposit",
        sentTo: "Confirmation email to the user who posted the deposit",
      },
      {
        id: "pay_bills",
        label: "Pay Bills",
        sentTo: "Pay Bills / Create Bill users",
      },
    ],
  },
  {
    id: "rebate",
    label: "Rebates",
    steps: [
      {
        id: "actor",
        label: "Person who posted the rebate",
        sentTo: "Confirmation email to the user who posted the rebate",
      },
      {
        id: "next",
        label: "Next rebate step",
        sentTo: "Users on the next rebate action",
      },
    ],
  },
  {
    id: "vat_return",
    label: "VAT return reminders",
    steps: [
      {
        id: "next",
        label: "VAT return owners",
        sentTo: "Users responsible for the VAT return / next VAT action",
      },
    ],
  },
];

function stepKey(processId, stepId) {
  return `${processId}.${stepId}`;
}

function flattenSteps(catalog) {
  const keys = [];
  (catalog || []).forEach((process) => {
    (process.steps || []).forEach((step) => {
      keys.push(stepKey(process.id, step.id));
    });
  });
  return keys;
}

function isTruthyFlag(v) {
  return !(v === false || v === 0 || v === "0" || v === "false");
}

/** Flat map of `process.step` → boolean (defaults on). Supports legacy parent keys. */
function mapFromCatalog(catalog, source = {}) {
  const map = {};
  (catalog || []).forEach((process) => {
    const steps = process.steps || [];
    const hasParent = Object.prototype.hasOwnProperty.call(
      source || {},
      process.id,
    );
    const parentOn = hasParent ? isTruthyFlag(source[process.id]) : true;
    steps.forEach((step) => {
      const key = stepKey(process.id, step.id);
      if (Object.prototype.hasOwnProperty.call(source || {}, key)) {
        map[key] = isTruthyFlag(source[key]);
      } else if (hasParent) {
        map[key] = parentOn;
      } else {
        map[key] = true;
      }
    });
  });
  return map;
}

/**
 * Process workflow emails — master switch + nested per-step toggles.
 */
export default function WorkflowMailSettings() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const facilityId = activeBusiness?.id;

  const [catalog, setCatalog] = useState(FALLBACK_CATALOG);
  const [enabled, setEnabled] = useState(true);
  const [processes, setProcesses] = useState(() =>
    mapFromCatalog(FALLBACK_CATALOG),
  );
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const allStepKeys = useMemo(() => flattenSteps(catalog), [catalog]);
  const enabledCount = allStepKeys.filter((key) => processes[key]).length;
  const totalSteps = allStepKeys.length;

  const load = useCallback(() => {
    if (!facilityId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    _fetchApi(
      `/account/workflow-mail-settings/${facilityId}`,
      (resp) => {
        setLoading(false);
        if (!resp?.success) {
          const on = !(
            activeBusiness?.workflow_mail_enabled === false ||
            activeBusiness?.workflow_mail_enabled === 0 ||
            activeBusiness?.workflow_mail_enabled === "0"
          );
          setEnabled(on);
          setProcesses(
            mapFromCatalog(
              FALLBACK_CATALOG,
              activeBusiness?.workflow_mail_processes,
            ),
          );
          return;
        }
        const nextCatalog =
          Array.isArray(resp.results?.catalog) && resp.results.catalog.length
            ? resp.results.catalog
            : FALLBACK_CATALOG;
        setCatalog(nextCatalog);
        setEnabled(Boolean(resp.results?.workflow_mail_enabled));
        setProcesses(
          mapFromCatalog(nextCatalog, resp.results?.workflow_mail_processes),
        );
        setDirty(false);
      },
      () => {
        setLoading(false);
        const on = !(
          activeBusiness?.workflow_mail_enabled === false ||
          activeBusiness?.workflow_mail_enabled === 0 ||
          activeBusiness?.workflow_mail_enabled === "0"
        );
        setEnabled(on);
        setProcesses(
          mapFromCatalog(
            FALLBACK_CATALOG,
            activeBusiness?.workflow_mail_processes,
          ),
        );
      },
    );
  }, [
    facilityId,
    activeBusiness?.workflow_mail_enabled,
    activeBusiness?.workflow_mail_processes,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleStep = (processId, stepId) => {
    const key = stepKey(processId, stepId);
    setProcesses((prev) => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  };

  const processStepKeys = (process) =>
    (process.steps || []).map((step) => stepKey(process.id, step.id));

  const processCheckedCount = (process) =>
    processStepKeys(process).filter((key) => processes[key]).length;

  const setProcessAll = (process, value) => {
    setProcesses((prev) => {
      const next = { ...prev };
      processStepKeys(process).forEach((key) => {
        next[key] = value;
      });
      return next;
    });
    setDirty(true);
  };

  const toggleProcessParent = (process) => {
    const keys = processStepKeys(process);
    const allOn = keys.length > 0 && keys.every((key) => processes[key]);
    setProcessAll(process, !allOn);
  };

  const setAllSteps = (value) => {
    const next = {};
    allStepKeys.forEach((key) => {
      next[key] = value;
    });
    setProcesses(next);
    setDirty(true);
  };

  const save = () => {
    if (!facilityId || !user?.id) {
      toast.error("No active business");
      return;
    }
    setSaving(true);
    _postApi(
      `/account/update-workflow-mail/${facilityId}/${user.id}`,
      {
        workflow_mail_enabled: Boolean(enabled),
        workflow_mail_processes: processes,
      },
      (resp) => {
        setSaving(false);
        if (resp?.success) {
          const business = resp.results || {
            ...activeBusiness,
            workflow_mail_enabled: Boolean(enabled),
            workflow_mail_processes: processes,
          };
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: { business },
          });
          setDirty(false);
          toast.success(
            enabled
              ? "Process email settings saved"
              : "Process emails are off — in-app alerts still work",
          );
        } else {
          toast.error(resp?.message || "Failed to save process email setting");
        }
      },
      (err) => {
        setSaving(false);
        toast.error(err?.message || "Failed to save process email setting");
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-[var(--aa-navy)]/10 p-2.5 text-[var(--aa-navy)]">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Process emails
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Turn email on or off for each process step. Parent checkboxes
              control every step under that process. Applies to{" "}
              <span className="font-medium text-slate-700">
                {activeBusiness?.business_name || "this business"}
              </span>
              . In-app notifications stay on even when email is off.
            </p>
          </div>
        </div>

        <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-900">
              Send process emails
            </p>
            <p className="text-xs text-slate-500">
              Master switch — off stops every process email below
            </p>
          </div>
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-slate-300 accent-[var(--aa-navy)]"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setDirty(true);
            }}
          />
        </label>

        <div
          className={`mt-5 space-y-2 ${enabled ? "" : "pointer-events-none opacity-50"}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Where mail is sent
              {!loading ? (
                <span className="ml-2 font-normal normal-case text-slate-400">
                  {enabledCount} of {totalSteps} on
                </span>
              ) : null}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs font-medium text-[var(--aa-navy)] hover:underline"
                onClick={() => setAllSteps(true)}
                disabled={!enabled}
              >
                Check all
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                className="text-xs font-medium text-[var(--aa-navy)] hover:underline"
                onClick={() => setAllSteps(false)}
                disabled={!enabled}
              >
                Uncheck all
              </button>
            </div>
          </div>

          {loading ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Loading process list…
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {catalog.map((process) => {
                const steps = process.steps || [];
                const checked = processCheckedCount(process);
                const allOn = steps.length > 0 && checked === steps.length;
                const someOn = checked > 0 && !allOn;
                return (
                  <li key={process.id} className="bg-white">
                    <div className="flex items-start gap-3 px-3 py-3 sm:px-4">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-[var(--aa-navy)]"
                        checked={allOn}
                        ref={(el) => {
                          if (el) el.indeterminate = someOn;
                        }}
                        disabled={!enabled}
                        onChange={() => toggleProcessParent(process)}
                        aria-label={`Toggle all ${process.label} emails`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900">
                            {process.label}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {checked} of {steps.length} steps
                          </p>
                        </div>
                        <ul className="mt-2 space-y-1.5 border-l border-slate-200 pl-3">
                          {steps.map((step) => {
                            const key = stepKey(process.id, step.id);
                            return (
                              <li key={key}>
                                <label className="flex cursor-pointer gap-2.5 rounded-md px-1 py-1.5 hover:bg-slate-50">
                                  <input
                                    type="checkbox"
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-[var(--aa-navy)]"
                                    checked={Boolean(processes[key])}
                                    disabled={!enabled}
                                    onChange={() =>
                                      toggleStep(process.id, step.id)
                                    }
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-xs font-medium text-slate-800">
                                      {step.label}
                                    </span>
                                    <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                                      {step.sentTo}
                                    </span>
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {enabled
              ? `${enabledCount} step${enabledCount === 1 ? "" : "s"} will send email.`
              : "All process emails are off. Staff still get in-app notifications."}
          </p>
          <Button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="shrink-0 gap-2"
          >
            {saving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
