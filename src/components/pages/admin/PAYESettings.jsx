import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import {
  Save,
  Plus,
  Trash2,
  Calculator,
  Users,
  Settings2,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_PAYE_SETTINGS_2026,
  DEFAULT_TAX_BANDS_2026,
  computePAYE,
  normalizePayeSettings,
  parseTaxBands,
} from "@/utils/paye2026";
import { formatNumberWithCommas, parseFormattedNumber } from "@/utils/numberUtils";
import { _postApi } from "@/redux/actions/api";
import { UPDATE_BUSINESS_SETTINGS } from "@/redux/actions/actionTypes";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";

const BASE_OPTIONS = [
  { value: "basic", label: "Basic salary only" },
  { value: "taxable", label: "Basic + taxable allowances" },
  { value: "gross", label: "Basic + all allowances" },
];

const STATUTORY_BASES = [
  { rateKey: "nhfRate", baseKey: "nhfBase", label: "NHF", hint: "National Housing Fund" },
  { rateKey: "nhisRate", baseKey: "nhisBase", label: "NHIS", hint: "Health insurance" },
  { rateKey: "pensionRate", baseKey: "pensionBase", label: "Pension", hint: "Employee pension" },
];

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);

const emptyProfile = () => ({
  payEntryFrequency: "monthly",
  basicSalary: 0,
  housingAllowance: 0,
  transportAllowance: 0,
  otherAllowances: 0,
  nonTaxableAllowances: 0,
  bonus: 0,
  isBonusTaxable: true,
  annualRent: 0,
  appliesRent: true,
  appliesNHF: true,
  appliesNHIS: true,
  appliesPension: true,
});

export default function PAYESettings({ embedded = false }) {
  const dispatch = useDispatch();
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId || "";
  const brandColor = activeBusiness?.primary_color || "var(--aa-navy)";

  const now = new Date();
  const [assessmentYear, setAssessmentYear] = useState(now.getFullYear());
  const [previewMonth, setPreviewMonth] = useState(now.getMonth() + 1);
  const [previewYear, setPreviewYear] = useState(now.getFullYear());
  const [autoCalculationFromDb, setAutoCalculationFromDb] = useState(true);
  const [settings, setSettings] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoCalcSaving, setAutoCalcSaving] = useState(false);
  const [savingProfileId, setSavingProfileId] = useState(null);
  const [chartOfAccount, setChartOfAccount] = useState([]);
  const [selectedPayeLedger, setSelectedPayeLedger] = useState(null);

  const autoCalculation = useMemo(() => {
    if (activeBusiness?.paye_auto_calculation != null) {
      return (
        activeBusiness.paye_auto_calculation !== false &&
        activeBusiness.paye_auto_calculation !== 0 &&
        activeBusiness.paye_auto_calculation !== "0"
      );
    }
    return autoCalculationFromDb !== false;
  }, [activeBusiness?.paye_auto_calculation, autoCalculationFromDb]);

  const loadData = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        facilityId,
        assessmentYear: String(assessmentYear),
        month: String(previewMonth),
        year: String(previewYear),
      });
      const res = await fetch(`/api/hr/paye-settings/employees?${params}`);
      const data = await res.json();
      if (data.success) {
        setAutoCalculationFromDb(data.data.settings?.autoCalculation !== false);
        setSettings(normalizePayeSettings(data.data.settings));
        setEmployees(data.data.employees || []);
      } else {
        toast.error(data.message || "Failed to load PAYE settings");
      }
    } catch {
      toast.error("Failed to load PAYE settings");
    } finally {
      setLoading(false);
    }
  }, [facilityId, assessmentYear, previewMonth, previewYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!activeBusiness?.business_name) return;
    _postApi(
      `/account/chart-of-account?query_type=select`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) setChartOfAccount(resp.results || []);
      },
      () => setChartOfAccount([])
    );
  }, [activeBusiness?.business_name]);

  useEffect(() => {
    if (!settings?.payeLedgerAccount || !chartOfAccount.length) {
      setSelectedPayeLedger(null);
      return;
    }
    setSelectedPayeLedger(
      chartOfAccount.find((a) => a.head === settings.payeLedgerAccount) || null
    );
  }, [settings?.payeLedgerAccount, chartOfAccount]);

  const liveEmployees = useMemo(() => {
    if (!autoCalculation) {
      return employees.map((emp) => ({
        ...emp,
        effectiveMonthlyTax:
          emp.payeOverride != null ? emp.payeOverride : emp.storedComputedPaye,
      }));
    }

    if (!settings) return employees;

    return employees.map((emp) => {
      const calc = computePAYE({
        ...emp.profile,
        basic: emp.profile?.basicSalary,
        housing: emp.profile?.housingAllowance,
        transport: emp.profile?.transportAllowance,
        settings,
        appliesRent: emp.profile?.appliesRent,
        appliesNHF: emp.profile?.appliesNHF,
        appliesNHIS: emp.profile?.appliesNHIS,
        appliesPension: emp.profile?.appliesPension,
        payEntryFrequency: emp.profile?.payEntryFrequency,
        annualRent: emp.profile?.annualRent,
        otherAllowances: emp.profile?.otherAllowances,
        bonus: emp.profile?.bonus,
      });
      return {
        ...emp,
        liveCalc: calc,
        computedMonthlyTax: calc.monthlyTax,
        effectiveMonthlyTax: calc.monthlyTax,
      };
    });
  }, [employees, settings, autoCalculation]);

  const handleAutoCalculationToggle = (checked) => {
    if (!activeBusiness?.id || !user?.id) return;
    setAutoCalcSaving(true);
    _postApi(
      `/account/update-paye-auto-calculation/${checked ? "1" : "0"}/${activeBusiness.id}/${user.id}`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          dispatch({
            type: UPDATE_BUSINESS_SETTINGS,
            payload: { business: resp.results },
          });
          setAutoCalculationFromDb(checked);
          loadData();
          toast.success(
            checked
              ? "PAYE auto calculation enabled"
              : "PAYE auto calculation disabled — manual overrides apply"
          );
        } else {
          toast.error(resp.message || "Failed to update auto calculation setting");
        }
        setAutoCalcSaving(false);
      },
      () => {
        toast.error("Failed to update auto calculation setting");
        setAutoCalcSaving(false);
      }
    );
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/hr/paye-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          facilityId,
          assessmentYear,
          updatedBy: user?.id || user?.userId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("PAYE settings saved");
        setSettings(normalizePayeSettings(data.data));
        loadData();
      } else {
        toast.error(data.error || data.message || "Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const taxBands = parseTaxBands(settings?.taxBands);

  const updateBand = (index, field, value) => {
    setSettings((prev) => {
      const bands = [...parseTaxBands(prev.taxBands)];
      bands[index] = {
        ...bands[index],
        [field]: field === "width" ? (value === "" ? null : parseFloat(value)) : parseFloat(value),
      };
      return { ...prev, taxBands: bands };
    });
  };

  const addBand = () => {
    setSettings((prev) => ({
      ...prev,
      taxBands: [...parseTaxBands(prev.taxBands), { width: null, rate: 0.25 }],
    }));
  };

  const removeBand = (index) => {
    setSettings((prev) => ({
      ...prev,
      taxBands: parseTaxBands(prev.taxBands).filter((_, i) => i !== index),
    }));
  };

  const updateEmployeeProfile = (employeeId, patch) => {
    setEmployees((prev) =>
      prev.map((e) =>
        e.employeeId === employeeId
          ? { ...e, profile: { ...(e.profile || emptyProfile()), ...patch } }
          : e
      )
    );
  };

  const saveEmployeeProfile = async (emp) => {
    setSavingProfileId(emp.employeeId);
    try {
      const res = await fetch(`/api/hr/paye-settings/employees/${emp.employeeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, ...(emp.profile || emptyProfile()) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Saved pay profile for ${emp.name}`);
        setEmployees((prev) =>
          prev.map((e) =>
            e.employeeId === emp.employeeId ? { ...e, profile: data.data } : e
          )
        );
      } else {
        toast.error(data.message || "Failed to save profile");
      }
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSavingProfileId(null);
    }
  };

  const savePayeOverride = async (emp, value) => {
    try {
      const res = await fetch("/api/hr/paye-settings/paye-override", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: emp.employeeId,
          facilityId,
          month: previewMonth,
          year: previewYear,
          payeOverride: value === "" ? null : parseFloat(value),
          userId: user?.id || user?.userId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEmployees((prev) =>
          prev.map((e) =>
            e.employeeId === emp.employeeId
              ? {
                  ...e,
                  payeOverride: data.data.payeOverride,
                  payrollId: data.data.payrollId,
                  effectiveMonthlyTax:
                    data.data.payeOverride != null
                      ? data.data.payeOverride
                      : e.storedComputedPaye,
                }
              : e
          )
        );
        toast.success("Manual PAYE saved");
      } else {
        toast.error(data.message || "Failed to save override");
      }
    } catch {
      toast.error("Failed to save override");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-8 text-center space-y-3">
        <p className="text-sm font-bold text-amber-900">
          Could not load PAYE settings
        </p>
        <p className="text-xs text-amber-800">
          Check that the API is running, then retry. Employees need an active{" "}
          <strong>Salary Structure</strong> to link with PAYE.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={loadData}
          className="rounded-xl font-bold"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={`w-full space-y-3 ${embedded ? "" : "p-4"}`}>
      {/* Header + actions */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Calculator className="w-5 h-5 shrink-0" style={{ color: brandColor }} />
            PAYE Tax Settings
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {autoCalculation
              ? "Nigeria Tax Act 2026 — rates, bands, and employee tax preview"
              : "Auto calculation is off — enter PAYE manually during payroll"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
              Auto calculation
            </span>
            <Switch
              checked={autoCalculation}
              disabled={autoCalcSaving}
              onCheckedChange={handleAutoCalculationToggle}
            />
          </div>
          {autoCalculation && (
            <>
              <select
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-white"
                value={assessmentYear}
                onChange={(e) => setAssessmentYear(parseInt(e.target.value, 10))}
              >
                {[2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <Button
                onClick={handleSaveSettings}
                disabled={saving}
                className="rounded-xl font-bold"
                style={{ backgroundColor: brandColor }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Settings
              </Button>
            </>
          )}
        </div>
      </div>

      {/* PAYE ledger — must be set before rates / bands */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              PAYE Ledger Account
            </label>
            <p className="text-xs text-slate-500">
              Select the liability account first. Rates &amp; tax bands appear after
              this is set.
            </p>
            <TypeaheadCustom
              options={chartOfAccount}
              placeholder="Select PAYE payable account head..."
              labelKey={(item) => `${item.description} (${item.head})`}
              onChange={(selected) => {
                const account = selected.length > 0 ? selected[0] : null;
                setSelectedPayeLedger(account);
                setSettings((prev) => ({
                  ...(prev || {}),
                  payeLedgerAccount: account ? account.head : "",
                }));
              }}
              fixed={true}
              selected={selectedPayeLedger ? [selectedPayeLedger] : []}
            />
          </div>
          {!autoCalculation && (
            <Button
              onClick={handleSaveSettings}
              disabled={saving}
              className="rounded-xl font-bold shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Ledger
            </Button>
          )}
        </div>
      </div>

      {autoCalculation && !settings?.payeLedgerAccount && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          Select a <span className="font-semibold text-slate-700">PAYE Ledger Account</span> above
          to configure Rates &amp; Bases and Progressive Tax Bands.
        </div>
      )}

      {autoCalculation && Boolean(settings?.payeLedgerAccount) && (
      <div className="space-y-3">
        {/* Rates & bases — rent relief + statutory rows */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
          <div>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Settings2 className="w-3.5 h-3.5" /> Rates &amp; Bases
            </h3>
            <p className="mt-1 text-[11px] text-slate-500 leading-snug">
              Pay is <span className="font-semibold text-slate-700">basic salary</span> plus
              allowances (taxable or non-taxable in HR → Allowances). Choose which pay each
              statutory rate applies to.
            </p>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Rent relief
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Rate (%)"
                value={settings.rentReliefRate}
                onChange={(v) => setSettings((p) => ({ ...p, rentReliefRate: v }))}
              />
              <Field
                label="Annual cap (₦)"
                value={settings.rentReliefCap}
                money
                onChange={(v) => setSettings((p) => ({ ...p, rentReliefCap: v }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Statutory rates &amp; calculation base
            </p>
            <div className="space-y-2">
              {STATUTORY_BASES.map(({ rateKey, baseKey, label, hint }) => (
                <div
                  key={rateKey}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end rounded-lg border border-slate-100 p-2.5"
                >
                  <div className="sm:col-span-2 min-w-0">
                    <p className="text-sm font-bold text-slate-800 leading-tight">{label}</p>
                    <p className="text-[10px] text-slate-400 truncate">{hint}</p>
                  </div>
                  <div className="sm:col-span-3">
                    <Field
                      label="Rate (%)"
                      value={settings[rateKey]}
                      onChange={(v) => setSettings((p) => ({ ...p, [rateKey]: v }))}
                    />
                  </div>
                  <div className="sm:col-span-7 space-y-1 min-w-0">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Applies to
                    </label>
                    <select
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm"
                      value={
                        settings[baseKey] === "bht"
                          ? "taxable"
                          : settings[baseKey] || "basic"
                      }
                      onChange={(e) =>
                        setSettings((p) => ({ ...p, [baseKey]: e.target.value }))
                      }
                    >
                      {BASE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 leading-snug px-0.5">
              Non-taxable allowances are paid to the employee but excluded from PAYE
              chargeable income.
            </p>
          </div>
        </div>

        {/* Tax bands */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
              Progressive Tax Bands
            </h3>
            <button
              type="button"
              onClick={addBand}
              className="text-xs font-bold flex items-center gap-1 shrink-0"
              style={{ color: brandColor }}
            >
              <Plus className="w-3 h-3" /> Add band
            </button>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Applied to annual chargeable income. Leave width empty for remainder.
          </p>

          <div className="space-y-1.5">
            {taxBands.map((band, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Width (₦) or blank"
                  className="flex-1 min-w-0 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  value={band.width ?? ""}
                  onChange={(e) => updateBand(i, "width", e.target.value)}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Rate"
                  className="w-16 shrink-0 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  value={band.rate > 1 ? band.rate : band.rate * 100}
                  onChange={(e) =>
                    updateBand(i, "rate", parseFloat(e.target.value) / 100)
                  }
                />
                <span className="text-xs text-slate-400 shrink-0">%</span>
                {taxBands.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBand(i)}
                    className="p-1 text-red-400 hover:text-red-600 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {!autoCalculation && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
          Tax rates and employee preview are hidden while auto calculation is off.
          Turn it on to configure 2026 PAYE rules and preview computed tax.
        </div>
      )}

      {autoCalculation && Boolean(settings?.payeLedgerAccount) && (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden w-full">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: brandColor }} />
            Employee PAYE Preview
          </h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Preview period:</span>
            <select className="px-2 py-1 border rounded-lg" value={previewMonth}
              onChange={(e) => setPreviewMonth(parseInt(e.target.value, 10))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("en", { month: "short" })}</option>
              ))}
            </select>
            <select className="px-2 py-1 border rounded-lg" value={previewYear}
              onChange={(e) => setPreviewYear(parseInt(e.target.value, 10))}>
              {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <tr>
                <th className="text-left p-2.5 w-[36%]">Employee</th>
                <th className="text-right p-2.5 w-[20%]">Chargeable (annual)</th>
                <th className="text-right p-2.5 w-[18%]">Annual tax</th>
                <th className="text-right p-2.5 w-[18%]">Monthly tax</th>
                <th className="p-2.5 w-[8%]" />
              </tr>
            </thead>
            <tbody>
              {liveEmployees.map((emp) => (
                <React.Fragment key={emp.employeeId}>
                  <tr className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="p-2.5">
                      <div className="font-bold text-slate-900">{emp.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {emp.designation}
                        {emp.salaryStructureName
                          ? ` · ${emp.salaryStructureName}`
                          : " · No salary structure"}
                      </div>
                      {!emp.salaryStructureId && (
                        <div className="text-[10px] text-amber-600 font-semibold mt-0.5">
                          Assign a Salary Structure on the employee to link PAYE
                        </div>
                      )}
                    </td>
                    <td className="p-2.5 text-right font-mono text-xs">
                      {formatCurrency(emp.liveCalc?.chargeableIncome)}
                    </td>
                    <td className="p-2.5 text-right font-mono text-xs">
                      {formatCurrency(emp.liveCalc?.annualTax)}
                    </td>
                    <td className="p-2.5 text-right font-black" style={{ color: brandColor }}>
                      {formatCurrency(emp.effectiveMonthlyTax)}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === emp.employeeId ? null : emp.employeeId)}
                      >
                        {expandedId === emp.employeeId ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                  {expandedId === emp.employeeId && (
                    <tr className="bg-slate-50/80">
                      <td colSpan={5} className="p-3">
                        <EmployeePayForm
                          profile={emp.profile || emptyProfile()}
                          brandColor={brandColor}
                          saving={savingProfileId === emp.employeeId}
                          onChange={(patch) => updateEmployeeProfile(emp.employeeId, patch)}
                          onSave={() => saveEmployeeProfile(emp)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {!liveEmployees.length && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400 text-sm">
                    No active employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, money = false }) {
  return (
    <div className="space-y-1 min-w-0">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {label}
      </label>
      <input
        type={money ? "text" : "number"}
        step={money ? undefined : "0.01"}
        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
        value={money ? formatNumberWithCommas(value) : value}
        onChange={(e) =>
          onChange(
            money
              ? parseFormattedNumber(e.target.value)
              : parseFloat(e.target.value) || 0,
          )
        }
      />
    </div>
  );
}

function EmployeePayForm({ profile, onChange, onSave, saving, brandColor }) {
  const flags = [
    { key: "appliesRent", label: "Rent relief" },
    { key: "appliesNHF", label: "NHF" },
    { key: "appliesNHIS", label: "NHIS" },
    { key: "appliesPension", label: "Pension" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="text-xs font-bold text-slate-500">Pay entry frequency</label>
        {["monthly", "annual"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onChange({ payEntryFrequency: f })}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${
              profile.payEntryFrequency === f ? "text-white" : "bg-white border text-slate-500"
            }`}
            style={profile.payEntryFrequency === f ? { backgroundColor: brandColor } : {}}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { key: "basicSalary", label: "Basic salary" },
          { key: "taxableAllowances", label: "Taxable allowances" },
          { key: "nonTaxableAllowances", label: "Non-taxable allowances" },
          { key: "bonus", label: "Bonus" },
          { key: "annualRent", label: "Annual rent" },
        ].map(({ key, label }) => {
          const value =
            key === "taxableAllowances"
              ? (parseFloat(profile.housingAllowance) || 0) +
                (parseFloat(profile.transportAllowance) || 0) +
                (parseFloat(profile.otherAllowances) || 0)
              : profile[key];
          return (
            <div key={key} className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase">{label}</label>
              <input
                type="text"
                className="w-full p-2 border rounded-lg text-xs"
                value={formatNumberWithCommas(value)}
                onChange={(e) => {
                  const amount = parseFormattedNumber(e.target.value);
                  if (key === "taxableAllowances") {
                    onChange({
                      housingAllowance: 0,
                      transportAllowance: 0,
                      otherAllowances: amount,
                    });
                  } else {
                    onChange({ [key]: amount });
                  }
                }}
              />
            </div>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={profile.isBonusTaxable !== false}
          onChange={(e) => onChange({ isBonusTaxable: e.target.checked })}
          className="rounded"
        />
        Bonus is taxable (include in PAYE chargeable income)
      </label>

      <div className="flex flex-wrap gap-4">
        {flags.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={profile[key] !== false}
              onChange={(e) => onChange({ [key]: e.target.checked })}
              className="rounded"
            />
            {label}
          </label>
        ))}
      </div>

      <Button
        size="sm"
        onClick={onSave}
        disabled={saving}
        className="rounded-lg font-bold text-xs"
        style={{ backgroundColor: brandColor }}
      >
        {saving ? "Saving..." : "Save employee pay profile"}
      </Button>
    </div>
  );
}
