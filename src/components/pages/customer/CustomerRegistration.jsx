/* eslint-disable no-unused-vars */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import PropTypes from "prop-types";
import { Loader2, Mail, Plus, Trash2, X } from "lucide-react";
import { _postApi, _fetchApi } from "@/redux/actions/api";
import { toast } from "sonner";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import { Label as ShadcnLabel } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  normalizeNigerianPhone,
  isValidNigerianPhone,
  toNationalPhoneInput,
  sanitizePhoneInput,
  NIGERIAN_PHONE_HINT,
} from "@/lib/nigerianPhone";

const SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "Miss"];
const emptyContactPerson = () => ({
  salutation: "",
  first_name: "",
  last_name: "",
  email: "",
  work_phone: "",
  mobile: "",
});

const inputClass =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]";
const labelClass = "mb-1.5 block text-xs font-medium text-slate-600";

const CustomerRegistartion = ({
  closeModal,
  empty = () => {},
  showModal,
  getList = () => {},
  onSuccess,
  selectedCustomer,
}) => {
  const { activeBusiness } = useSelector((state) => state.auth);
  const { user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const [chartOfAccount, setChartOfAccount] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("other");

  const userBranchIds = useMemo(() => {
    if (Array.isArray(user?.branchIds) && user.branchIds.length > 0) {
      return user.branchIds.map(Number).filter(Boolean);
    }
    if (Array.isArray(user?.branches) && user.branches.length > 0) {
      return user.branches
        .map((b) => Number(b.id || b.branch_id))
        .filter(Boolean);
    }
    if (user?.branchId) return [Number(user.branchId)];
    return [];
  }, [user?.branchIds, user?.branches, user?.branchId]);

  const userBranchId = userBranchIds[0] ?? null;

  const visibleBranches = useMemo(() => {
    if (!userBranchIds.length) return branches;
    return branches.filter((b) => userBranchIds.includes(Number(b.id)));
  }, [branches, userBranchIds]);

  const getInitialFormValues = useCallback(
    () => ({
      entity_type: "business",
      salutation: "",
      first_name: "",
      last_name: "",
      company_name: "",
      name: "",
      email: "",
      work_phone: "",
      mobile: "",
      language: "English",
      tin: "",
      company_id: "",
      tax_rate: "",
      currency: "NGN - Nigerian Naira",
      payment_terms: "Due on Receipt",
      enable_portal: false,
      opening_balance: "",
      obdate: "",
      receivable_code: activeBusiness?.receivable_code || "",
      receivable_accural_code: activeBusiness?.receivable_accural_code || "",
      branch_id: userBranchId ? String(userBranchId) : "",
      // Address
      billing_attention: "",
      billing_country: "Nigeria",
      billing_street1: "",
      billing_street2: "",
      billing_city: "",
      billing_state: "",
      billing_zip: "",
      billing_phone: "",
      shipping_attention: "",
      shipping_country: "Nigeria",
      shipping_street1: "",
      shipping_street2: "",
      shipping_city: "",
      shipping_state: "",
      shipping_zip: "",
      shipping_phone: "",
      remarks: "",
    }),
    [
      activeBusiness?.receivable_code,
      activeBusiness?.receivable_accural_code,
      userBranchId,
    ],
  );

  const [form, setForm] = useState(() => getInitialFormValues());
  const [contactPersons, setContactPersons] = useState([emptyContactPerson()]);

  const formatNumberWithCommas = (value) => {
    if (!value || value === "") return "";
    const isNegative = String(value).trim().startsWith("-");
    let cleanedValue = String(value).replace(/[^0-9.-]/g, "");
    if (cleanedValue.includes("-")) {
      cleanedValue = cleanedValue.replace(/-/g, "");
      if (isNegative) cleanedValue = "-" + cleanedValue;
    }
    const endsWithDot = cleanedValue.endsWith(".");
    const parts = cleanedValue.split(".");
    let integerPart = parts[0] || "";
    const decimalPart = parts[1] || "";
    let isNegativeValue = false;
    if (integerPart.startsWith("-")) {
      isNegativeValue = true;
      integerPart = integerPart.substring(1);
    }
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const prefix = isNegativeValue ? "-" : "";
    if (decimalPart) return `${prefix}${formattedInteger}.${decimalPart}`;
    if (endsWithDot && integerPart) return `${prefix}${formattedInteger}.`;
    return `${prefix}${formattedInteger}`;
  };

  const parseNumberFromFormatted = (value) => {
    if (!value || value === "") return "";
    return String(value).replace(/,/g, "");
  };

  const buildAddressString = (f) => {
    const parts = [
      f.billing_attention,
      f.billing_street1,
      f.billing_street2,
      f.billing_city,
      f.billing_state,
      f.billing_zip,
      f.billing_country,
    ].filter(Boolean);
    return parts.join(", ");
  };

  useEffect(() => {
    if (selectedCustomer) {
      const openingBalance =
        selectedCustomer.opening_balance || selectedCustomer.balance || null;
      const existingName =
        selectedCustomer.name ||
        selectedCustomer.fullname ||
        selectedCustomer.company_name ||
        "";
      setForm({
        ...getInitialFormValues(),
        customerNo: selectedCustomer.customerNo || "",
        entity_type: selectedCustomer.entity_type || "business",
        name: existingName,
        company_name: selectedCustomer.company_name || existingName,
        salutation: selectedCustomer.salutation || "",
        first_name: selectedCustomer.first_name || "",
        last_name: selectedCustomer.last_name || "",
        email: selectedCustomer.email || "",
        work_phone: toNationalPhoneInput(selectedCustomer.phone || ""),
        mobile: toNationalPhoneInput(selectedCustomer.mobile || ""),
        language: selectedCustomer.language || "English",
        tin: selectedCustomer.tin || "",
        company_id: selectedCustomer.company_id || "",
        tax_rate: selectedCustomer.tax_rate || "",
        currency: selectedCustomer.currency || "NGN - Nigerian Naira",
        payment_terms: selectedCustomer.payment_terms || "Due on Receipt",
        enable_portal: Boolean(selectedCustomer.enable_portal),
        remarks: selectedCustomer.remarks || "",
        opening_balance: openingBalance
          ? formatNumberWithCommas(String(openingBalance))
          : "",
        receivable_code: selectedCustomer.receivable_code || "",
        receivable_accural_code: selectedCustomer.receivable_accural_code || "",
        branch_id:
          selectedCustomer.branch_id != null
            ? String(selectedCustomer.branch_id)
            : userBranchId
              ? String(userBranchId)
              : "",
        billing_street1: selectedCustomer.address || "",
      });
    } else {
      setForm(getInitialFormValues());
    }
    setContactPersons([emptyContactPerson()]);
    setErrors({});
    setActiveTab("other");
  }, [selectedCustomer, getInitialFormValues, userBranchId]);

  useEffect(() => {
    if (!visibleBranches.length || selectedCustomer) return;
    setForm((prev) => {
      if (prev.branch_id) return prev;
      const isDefaultBranch = (b) =>
        b?.is_default === 1 || b?.is_default === "1" || b?.is_default === true;
      const fromUser =
        userBranchId &&
        visibleBranches.find((b) => String(b.id) === String(userBranchId));
      const target =
        fromUser ||
        visibleBranches.find(isDefaultBranch) ||
        visibleBranches[0];
      return target ? { ...prev, branch_id: String(target.id) } : prev;
    });
  }, [visibleBranches, userBranchId, selectedCustomer]);

  const handleChange = ({ target: { name, value } }) => {
    if (name === "opening_balance") {
      setForm((prev) => ({
        ...prev,
        [name]: formatNumberWithCommas(value),
      }));
    } else if (name === "company_name") {
      setForm((prev) => ({
        ...prev,
        company_name: value,
        name: prev.name?.trim() ? prev.name : value,
      }));
    } else if (name === "work_phone" || name === "mobile") {
      setForm((prev) => ({ ...prev, [name]: sanitizePhoneInput(value) }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const getChartOfAccount = useCallback(() => {
    if (!activeBusiness?.business_name) return;
    _postApi(
      `/account/chart-of-account?query_type=select`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) setChartOfAccount(resp.results);
      },
      (err) => console.error("API Error:", err),
    );
  }, [activeBusiness?.business_name]);

  useEffect(() => {
    if (showModal) getChartOfAccount();
  }, [getChartOfAccount, showModal]);

  const getBranches = useCallback(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/account/get/branches?facilityId=${activeBusiness.id}`,
      (res) => {
        if (res.success) setBranches(res.results || []);
      },
      (err) => console.error("Error fetching warehouses:", err),
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    if (showModal) getBranches();
  }, [getBranches, showModal]);

  const selectedReceivableAccount = chartOfAccount.find(
    (account) => account.head === form.receivable_code,
  );
  const selectedReceivableAccuralAccount = chartOfAccount.find(
    (account) => account.head === form.receivable_accural_code,
  );

  const copyBillingToShipping = () => {
    setForm((prev) => ({
      ...prev,
      shipping_attention: prev.billing_attention,
      shipping_country: prev.billing_country,
      shipping_street1: prev.billing_street1,
      shipping_street2: prev.billing_street2,
      shipping_city: prev.billing_city,
      shipping_state: prev.billing_state,
      shipping_zip: prev.billing_zip,
      shipping_phone: prev.billing_phone,
    }));
    toast.success("Billing address copied");
  };

  const validateForm = () => {
    const newErrors = {};
    const displayName = (form.name || form.company_name || "").trim();
    if (!displayName) {
      newErrors.name = "Display name is required";
    }
    const address = buildAddressString(form) || form.billing_street1?.trim();
    if (!address) {
      newErrors.address = "Billing address is required (Address tab)";
    }
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    const phone = form.work_phone || form.mobile || "";
    if (!String(phone).trim()) {
      newErrors.work_phone = "Phone number is required";
    } else if (!isValidNigerianPhone(phone)) {
      newErrors.work_phone = NIGERIAN_PHONE_HINT;
    }
    if (form.mobile && String(form.mobile).trim() && !isValidNigerianPhone(form.mobile)) {
      newErrors.mobile = NIGERIAN_PHONE_HINT;
    }
    if (!String(form.receivable_code || "").trim()) {
      newErrors.receivable_code = "Accounts receivable is required";
    }
    if (!String(form.receivable_accural_code || "").trim()) {
      newErrors.receivable_accural_code = "Customer deposits account is required";
    }
    const parsedOpeningBalance = form.opening_balance
      ? parseFloat(parseNumberFromFormatted(form.opening_balance)) || 0
      : 0;
    if (!selectedCustomer && parsedOpeningBalance !== 0) {
      if (!form.obdate) {
        newErrors.obdate =
          "Opening balance date is required when opening balance is provided";
      }
    }
    setErrors(newErrors);
    if (newErrors.address) setActiveTab("address");
    else if (newErrors.receivable_code || newErrors.receivable_accural_code)
      setActiveTab("other");
    return Object.keys(newErrors).length === 0;
  };

  const success_callback = () => {
    setLoading(false);
    getList();
    closeModal();
    empty();
    setForm(getInitialFormValues());
    setContactPersons([emptyContactPerson()]);
    setErrors({});
    if (onSuccess) onSuccess();
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!validateForm()) {
      toast.error("Please fix the errors before saving");
      return;
    }
    setLoading(true);

    const displayName = (form.name || form.company_name || "").trim();
    const phone = normalizeNigerianPhone(form.work_phone || form.mobile || "");
    const mobile = form.mobile
      ? normalizeNigerianPhone(form.mobile)
      : "";
    const address = buildAddressString(form) || form.billing_street1 || "";

    try {
      const billing_address = {
        attention: form.billing_attention,
        country: form.billing_country,
        street1: form.billing_street1,
        street2: form.billing_street2,
        city: form.billing_city,
        state: form.billing_state,
        zip: form.billing_zip,
        phone: form.billing_phone,
      };
      const shipping_address = {
        attention: form.shipping_attention,
        country: form.shipping_country,
        street1: form.shipping_street1,
        street2: form.shipping_street2,
        city: form.shipping_city,
        state: form.shipping_state,
        zip: form.shipping_zip,
        phone: form.shipping_phone,
      };
      const contact_persons = contactPersons.filter(
        (p) =>
          p.first_name ||
          p.last_name ||
          p.email ||
          p.work_phone ||
          p.mobile,
      );

      const basePayload = {
        name: displayName,
        fullname: displayName,
        entity_type: form.entity_type || "business",
        company_name: form.company_name || displayName,
        salutation: form.salutation || "",
        first_name: form.first_name || "",
        last_name: form.last_name || "",
        email: form.email || "",
        phone: phone || "",
        mobile: mobile || "",
        address: address || "",
        tin: form.tin || form.company_id || "",
        company_id: form.company_id || form.tin || "",
        tax_rate: form.tax_rate || "",
        enable_portal: Boolean(form.enable_portal),
        language: form.language || "English",
        currency: form.currency || "NGN - Nigerian Naira",
        payment_terms: form.payment_terms || "Due on Receipt",
        remarks: form.remarks || "",
        billing_address,
        shipping_address,
        contact_persons,
      };

      if (selectedCustomer) {
        const updatePayload = {
          ...basePayload,
          receivable_code: form.receivable_code,
          receivable_accural_code: form.receivable_accural_code,
          branch_id: form.branch_id || null,
        };
        _postApi(
          `/create-customer`,
          {
            ...updatePayload,
            query_type: "update",
            customerNo: selectedCustomer.customerNo,
            facilityId,
            head: form.receivable_code,
            deposit_code: form.receivable_accural_code,
            opening_balance_equity: activeBusiness.opening_balance_equity,
            created_by: user.id,
          },
          (res) => {
            setLoading(false);
            if (!res.success) {
              toast.error(res.message || "An error occurred!");
              return;
            }
            toast.success(`Customer ${displayName} updated successfully`);
            success_callback();
          },
          (err) => {
            setLoading(false);
            console.error(err);
            toast.error("An error occurred while updating customer!");
          },
        );
      } else {
        const parsedOpeningBalance =
          form.opening_balance && form.opening_balance !== ""
            ? parseFloat(parseNumberFromFormatted(form.opening_balance)) ||
              null
            : null;
        const payload = {
          ...basePayload,
          opening_balance: parsedOpeningBalance,
          obdate: form.obdate || null,
          facilityId,
          receivable_code: form.receivable_code,
          deposit_code: form.receivable_accural_code,
          branch_id: form.branch_id || null,
          created_by: user.id,
          opening_balance_equity: activeBusiness.opening_balance_equity,
        };
        _postApi(
          `/create-customer`,
          {
            ...payload,
            query_type: "create",
            fullname: displayName,
            head: form.receivable_code,
            deposit_code: form.receivable_accural_code,
          },
          (res) => {
            setLoading(false);
            if (!res.success) {
              toast.error(res.message || "An error occurred!");
              return;
            }
            const customerNo = res.data?.customerNo || "N/A";
            toast.success(
              `Customer ${displayName} added successfully (${customerNo})`,
            );
            success_callback();
          },
          (err) => {
            setLoading(false);
            console.error(err);
            toast.error("An error occurred while saving customer!");
          },
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred!");
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    closeModal();
    empty();
    setForm(getInitialFormValues());
    setContactPersons([emptyContactPerson()]);
    setErrors({});
    setActiveTab("other");
  };

  const addressField = (id, label, props = {}) => (
    <div>
      <ShadcnLabel htmlFor={id} className={labelClass}>
        {label}
      </ShadcnLabel>
      <input id={id} name={id} {...props} className={cn(inputClass, props.className)} />
    </div>
  );

  return (
    <Sheet
      open={showModal}
      onOpenChange={(open) => {
        if (!open) handleModalClose();
      }}
    >
      <SheetContent
        side="right"
        className="!inset-y-0 !right-0 !left-auto flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l border-slate-200 p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:!max-w-xl md:!max-w-2xl"
      >
        <SheetHeader className="shrink-0 space-y-1 border-b border-slate-200 bg-[var(--aa-navy)] px-5 py-4 text-left">
          <SheetTitle className="text-lg font-semibold text-white">
            {selectedCustomer ? "Edit Customer" : "New Customer"}
          </SheetTitle>
          <SheetDescription className="text-sm text-white/70">
            {selectedCustomer
              ? "Update customer details"
              : "Add a customer to your sales list"}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <div>
              <ShadcnLabel className={labelClass}>Customer Type</ShadcnLabel>
              <div className="flex items-center gap-5 pt-1">
                {[
                  ["business", "Business"],
                  ["individual", "Individual"],
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="radio"
                      name="entity_type"
                      value={value}
                      checked={form.entity_type === value}
                      onChange={handleChange}
                      className="accent-[var(--aa-accent)]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {/* Primary contact */}
            <div>
              <ShadcnLabel className={labelClass}>Primary Contact</ShadcnLabel>
              <div className="grid grid-cols-[5.5rem_1fr_1fr] gap-2">
                <select
                  name="salutation"
                  value={form.salutation}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">Salutation</option>
                  {SALUTATIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  placeholder="First Name"
                  className={inputClass}
                />
                <input
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  placeholder="Last Name"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <ShadcnLabel htmlFor="company_name" className={labelClass}>
                Company Name
              </ShadcnLabel>
              <input
                id="company_name"
                name="company_name"
                value={form.company_name}
                onChange={handleChange}
                placeholder="Company name"
                className={inputClass}
              />
            </div>

            <div>
              <ShadcnLabel htmlFor="name" className={labelClass}>
                Customer Display Name <span className="text-red-500">*</span>
              </ShadcnLabel>
              <input
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Select or type to add"
                className={cn(inputClass, errors.name && "border-red-500")}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-500">{errors.name}</p>
              )}
            </div>

            <div>
              <ShadcnLabel htmlFor="email" className={labelClass}>
                Email Address
              </ShadcnLabel>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Email address"
                  className={cn(
                    inputClass,
                    "pl-9",
                    errors.email && "border-red-500",
                  )}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email}</p>
              )}
            </div>

            <div>
              <ShadcnLabel className={labelClass}>
                Phone <span className="text-red-500">*</span>
              </ShadcnLabel>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex gap-1.5">
                  <span className="flex h-9 shrink-0 items-center rounded-md border border-slate-300 bg-slate-50 px-2 text-xs text-slate-600">
                    +234
                  </span>
                  <input
                    name="work_phone"
                    value={form.work_phone}
                    onChange={handleChange}
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="8012345678"
                    maxLength={11}
                    className={cn(
                      inputClass,
                      errors.work_phone && "border-red-500",
                    )}
                  />
                </div>
                <div className="flex gap-1.5">
                  <span className="flex h-9 shrink-0 items-center rounded-md border border-slate-300 bg-slate-50 px-2 text-xs text-slate-600">
                    +234
                  </span>
                  <input
                    name="mobile"
                    value={form.mobile}
                    onChange={handleChange}
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="Mobile"
                    maxLength={11}
                    className={cn(
                      inputClass,
                      errors.mobile && "border-red-500",
                    )}
                  />
                </div>
              </div>
              {errors.work_phone && (
                <p className="mt-1 text-xs text-red-500">{errors.work_phone}</p>
              )}
              {errors.mobile && (
                <p className="mt-1 text-xs text-red-500">{errors.mobile}</p>
              )}
            </div>

            <div>
              <ShadcnLabel htmlFor="language" className={labelClass}>
                Customer Language
              </ShadcnLabel>
              <select
                id="language"
                name="language"
                value={form.language}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="English">English</option>
                <option value="French">French</option>
                <option value="Hausa">Hausa</option>
                <option value="Yoruba">Yoruba</option>
                <option value="Igbo">Igbo</option>
              </select>
            </div>

            {/* Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-none border-b border-slate-200 bg-transparent p-0">
                {[
                  ["other", "Other Details"],
                  ["address", "Address"],
                  ["contacts", "Contact Persons"],
                  ["remarks", "Remarks"],
                ].map(([value, label]) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="rounded-none border-b-2 border-transparent px-2.5 py-2 text-xs data-[state=active]:border-[var(--aa-accent)] data-[state=active]:bg-transparent data-[state=active]:text-[var(--aa-accent)] data-[state=active]:shadow-none"
                  >
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="other" className="mt-4 space-y-4">
                <div>
                  <ShadcnLabel htmlFor="tax_rate" className={labelClass}>
                    Tax Rate
                  </ShadcnLabel>
                  <input
                    id="tax_rate"
                    name="tax_rate"
                    value={form.tax_rate}
                    onChange={handleChange}
                    placeholder="Select or type tax rate"
                    className={inputClass}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    To associate more than one tax, create a tax group in
                    Settings.
                  </p>
                </div>
                <div>
                  <ShadcnLabel htmlFor="company_id" className={labelClass}>
                    Company ID
                  </ShadcnLabel>
                  <input
                    id="company_id"
                    name="company_id"
                    value={form.company_id}
                    onChange={handleChange}
                    placeholder="Company ID / TIN"
                    className={inputClass}
                  />
                </div>
                <div>
                  <ShadcnLabel htmlFor="tin" className={labelClass}>
                    TIN
                  </ShadcnLabel>
                  <input
                    id="tin"
                    name="tin"
                    value={form.tin}
                    onChange={handleChange}
                    placeholder="Tax identification number"
                    className={inputClass}
                  />
                </div>
                <div>
                  <ShadcnLabel htmlFor="currency" className={labelClass}>
                    Currency
                  </ShadcnLabel>
                  <select
                    id="currency"
                    name="currency"
                    value={form.currency}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="NGN - Nigerian Naira">
                      NGN - Nigerian Naira
                    </option>
                    <option value="USD - US Dollar">USD - US Dollar</option>
                  </select>
                </div>
                <div>
                  <ShadcnLabel className={labelClass}>
                    Accounts Receivable <span className="text-red-500">*</span>
                  </ShadcnLabel>
                  <TypeaheadCustom
                    options={chartOfAccount}
                    placeholder="Select an account"
                    labelKey={(i) => `${i.description} - (${i.head})`}
                    onChange={(selectedItems) => {
                      setForm((prev) => ({
                        ...prev,
                        receivable_code: selectedItems[0]?.head || "",
                      }));
                    }}
                    fixed
                    flip
                    selected={
                      selectedReceivableAccount
                        ? [selectedReceivableAccount]
                        : []
                    }
                  />
                  {errors.receivable_code && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.receivable_code}
                    </p>
                  )}
                </div>
                <div>
                  <ShadcnLabel className={labelClass}>
                    Customer Deposits <span className="text-red-500">*</span>
                  </ShadcnLabel>
                  <TypeaheadCustom
                    options={chartOfAccount}
                    placeholder="Select an account"
                    labelKey={(i) => `${i.description} - (${i.head})`}
                    onChange={(selectedItems) => {
                      setForm((prev) => ({
                        ...prev,
                        receivable_accural_code: selectedItems[0]?.head || "",
                      }));
                    }}
                    fixed
                    flip
                    selected={
                      selectedReceivableAccuralAccount
                        ? [selectedReceivableAccuralAccount]
                        : []
                    }
                  />
                  {errors.receivable_accural_code && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.receivable_accural_code}
                    </p>
                  )}
                </div>
                <div>
                  <ShadcnLabel htmlFor="branch_id" className={labelClass}>
                    Warehouse
                  </ShadcnLabel>
                  <select
                    id="branch_id"
                    name="branch_id"
                    value={form.branch_id || ""}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="">Select warehouse...</option>
                    {visibleBranches.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.branch_name}
                      </option>
                    ))}
                  </select>
                </div>
                {!selectedCustomer && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <ShadcnLabel
                        htmlFor="opening_balance"
                        className={labelClass}
                      >
                        Opening Balance
                      </ShadcnLabel>
                      <div className="flex gap-1.5">
                        <span className="flex h-9 shrink-0 items-center rounded-md border border-slate-300 bg-slate-50 px-2 text-xs text-slate-600">
                          NGN
                        </span>
                        <input
                          id="opening_balance"
                          name="opening_balance"
                          value={form.opening_balance || ""}
                          onChange={handleChange}
                          placeholder="0.00"
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div>
                      <ShadcnLabel htmlFor="obdate" className={labelClass}>
                        As of
                        {form.opening_balance &&
                          parseFloat(
                            parseNumberFromFormatted(form.opening_balance),
                          ) !== 0 && (
                            <span className="ml-1 text-red-500">*</span>
                          )}
                      </ShadcnLabel>
                      <input
                        id="obdate"
                        name="obdate"
                        type="date"
                        value={form.obdate || ""}
                        onChange={handleChange}
                        className={cn(
                          inputClass,
                          errors.obdate && "border-red-500",
                        )}
                      />
                      {errors.obdate && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.obdate}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <ShadcnLabel htmlFor="payment_terms" className={labelClass}>
                    Payment Terms
                  </ShadcnLabel>
                  <select
                    id="payment_terms"
                    name="payment_terms"
                    value={form.payment_terms}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="Due on Receipt">Due on Receipt</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="enable_portal"
                    checked={Boolean(form.enable_portal)}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        enable_portal: e.target.checked,
                      }))
                    }
                    className="accent-[var(--aa-accent)]"
                  />
                  Allow portal access for this customer
                </label>
              </TabsContent>

              <TabsContent value="address" className="mt-4 space-y-5">
                {errors.address && (
                  <p className="text-xs text-red-500">{errors.address}</p>
                )}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-[var(--aa-navy)]">
                    Billing Address
                  </h4>
                  {addressField("billing_attention", "Attention", {
                    value: form.billing_attention,
                    onChange: handleChange,
                  })}
                  {addressField("billing_country", "Country/Region", {
                    value: form.billing_country,
                    onChange: handleChange,
                  })}
                  <div>
                    <ShadcnLabel className={labelClass}>
                      Address <span className="text-red-500">*</span>
                    </ShadcnLabel>
                    <input
                      name="billing_street1"
                      value={form.billing_street1}
                      onChange={handleChange}
                      placeholder="Street 1"
                      className={cn(
                        inputClass,
                        "mb-2",
                        errors.address && "border-red-500",
                      )}
                    />
                    <input
                      name="billing_street2"
                      value={form.billing_street2}
                      onChange={handleChange}
                      placeholder="Street 2"
                      className={inputClass}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {addressField("billing_city", "City", {
                      value: form.billing_city,
                      onChange: handleChange,
                    })}
                    {addressField("billing_state", "State", {
                      value: form.billing_state,
                      onChange: handleChange,
                    })}
                  </div>
                  {addressField("billing_zip", "ZIP Code", {
                    value: form.billing_zip,
                    onChange: handleChange,
                  })}
                  {addressField("billing_phone", "Phone", {
                    value: form.billing_phone,
                    onChange: handleChange,
                  })}
                </div>

                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-[var(--aa-navy)]">
                      Shipping Address
                    </h4>
                    <button
                      type="button"
                      onClick={copyBillingToShipping}
                      className="text-xs font-medium text-[var(--aa-accent)] hover:underline"
                    >
                      Copy billing address
                    </button>
                  </div>
                  {addressField("shipping_attention", "Attention", {
                    value: form.shipping_attention,
                    onChange: handleChange,
                  })}
                  {addressField("shipping_country", "Country/Region", {
                    value: form.shipping_country,
                    onChange: handleChange,
                  })}
                  <div>
                    <ShadcnLabel className={labelClass}>Address</ShadcnLabel>
                    <input
                      name="shipping_street1"
                      value={form.shipping_street1}
                      onChange={handleChange}
                      placeholder="Street 1"
                      className={cn(inputClass, "mb-2")}
                    />
                    <input
                      name="shipping_street2"
                      value={form.shipping_street2}
                      onChange={handleChange}
                      placeholder="Street 2"
                      className={inputClass}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {addressField("shipping_city", "City", {
                      value: form.shipping_city,
                      onChange: handleChange,
                    })}
                    {addressField("shipping_state", "State", {
                      value: form.shipping_state,
                      onChange: handleChange,
                    })}
                  </div>
                  {addressField("shipping_zip", "ZIP Code", {
                    value: form.shipping_zip,
                    onChange: handleChange,
                  })}
                  {addressField("shipping_phone", "Phone", {
                    value: form.shipping_phone,
                    onChange: handleChange,
                  })}
                </div>
                <p className="text-[11px] text-slate-500">
                  Note: Billing address is saved with the customer record.
                </p>
              </TabsContent>

              <TabsContent value="contacts" className="mt-4 space-y-3">
                {contactPersons.map((person, index) => (
                  <div
                    key={index}
                    className="space-y-2 rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">
                        Contact {index + 1}
                      </span>
                      {contactPersons.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setContactPersons((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-[4.5rem_1fr_1fr] gap-1.5">
                      <select
                        value={person.salutation}
                        onChange={(e) => {
                          const v = e.target.value;
                          setContactPersons((prev) =>
                            prev.map((p, i) =>
                              i === index ? { ...p, salutation: v } : p,
                            ),
                          );
                        }}
                        className={inputClass}
                      >
                        <option value="">Sal.</option>
                        {SALUTATIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <input
                        placeholder="First Name"
                        value={person.first_name}
                        onChange={(e) => {
                          const v = e.target.value;
                          setContactPersons((prev) =>
                            prev.map((p, i) =>
                              i === index ? { ...p, first_name: v } : p,
                            ),
                          );
                        }}
                        className={inputClass}
                      />
                      <input
                        placeholder="Last Name"
                        value={person.last_name}
                        onChange={(e) => {
                          const v = e.target.value;
                          setContactPersons((prev) =>
                            prev.map((p, i) =>
                              i === index ? { ...p, last_name: v } : p,
                            ),
                          );
                        }}
                        className={inputClass}
                      />
                    </div>
                    <input
                      placeholder="Email Address"
                      value={person.email}
                      onChange={(e) => {
                        const v = e.target.value;
                        setContactPersons((prev) =>
                          prev.map((p, i) =>
                            i === index ? { ...p, email: v } : p,
                          ),
                        );
                      }}
                      className={inputClass}
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        placeholder="Work Phone"
                        value={person.work_phone}
                        onChange={(e) => {
                          const v = e.target.value;
                          setContactPersons((prev) =>
                            prev.map((p, i) =>
                              i === index ? { ...p, work_phone: v } : p,
                            ),
                          );
                        }}
                        className={inputClass}
                      />
                      <input
                        placeholder="Mobile"
                        value={person.mobile}
                        onChange={(e) => {
                          const v = e.target.value;
                          setContactPersons((prev) =>
                            prev.map((p, i) =>
                              i === index ? { ...p, mobile: v } : p,
                            ),
                          );
                        }}
                        className={inputClass}
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setContactPersons((prev) => [...prev, emptyContactPerson()])
                  }
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--aa-accent)] hover:underline"
                >
                  <Plus className="size-3.5" />
                  Add Contact Person
                </button>
              </TabsContent>

              <TabsContent value="remarks" className="mt-4">
                <ShadcnLabel htmlFor="remarks" className={labelClass}>
                  Remarks (For Internal Use)
                </ShadcnLabel>
                <textarea
                  id="remarks"
                  name="remarks"
                  value={form.remarks}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Internal notes about this customer"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                />
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-[var(--aa-sidebar-bg)] px-5 py-3">
            <Button
              type="submit"
              disabled={loading}
              className="bg-[var(--aa-navy)] text-white shadow-none hover:bg-[var(--aa-navy-hover)]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={handleModalClose}
              className="border-slate-300 text-slate-700 shadow-none hover:bg-white"
            >
              <X className="mr-1.5 size-4" />
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

CustomerRegistartion.propTypes = {
  closeModal: PropTypes.func,
  empty: PropTypes.func,
  showModal: PropTypes.bool,
  getList: PropTypes.func,
  onSuccess: PropTypes.func,
  selectedCustomer: PropTypes.object,
};

CustomerRegistartion.defaultProps = {
  closeModal: () => {},
  empty: () => {},
  showModal: false,
  getList: () => {},
  onSuccess: null,
  selectedCustomer: null,
};

export default CustomerRegistartion;
