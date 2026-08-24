/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import { BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Typeahead } from "react-bootstrap-typeahead";
import { toast } from "sonner";
import { _fetchApi, _postApi } from "@/redux/actions/api";

const ACCOUNT_TAXONOMY = {
  assets: {
    current_assets: {
      cash_and_cash_equivalents: [],
      inventory: [],
      receivables: [],
      prepayments: [],
      short_term_investments: [],
      assets_held_for_sale: [],
      other_current_assets: [],
    },
    non_current_assets: {
      property_plant_equipment: [],
      investment_property: [],
      intangible_assets: [],
      investments: [],
      right_of_use_assets: [],
      biological_assets: [],
      long_term_receivables: [],
      other_non_current_assets: [],
    },
  },
  liabilities: {
    current_liabilities: {
      trade_payables: [],
      accruals: [],
      contract_liabilities_deferred_revenue: [],
      tax_payable: [],
      interest_payable: [],
      dividends_payable: [],
      short_term_loans: [],
      customer_deposits: [],
      refund_liabilities: [],
      other_current_liabilities: [],
    },
    non_current_liabilities: {
      loans: [],
      deferred_tax: [],
      provisions: [],
      lease_liabilities: [],
      employee_benefits: [],
      other_non_current_liabilities: [],
    },
  },
  equity: {
    share_capital: [],
    share_premium: [],
    retained_earnings: [],
    preference_dividends: [],
    other_reserves: [],
    treasury_shares: [],
    non_controlling_interests: [],
    revaluation_reserve: [],
    translation_reserve: [],
    accumulated_other_comprehensive_income: [],
     opening_balance_equity: [],
  },
  
  revenue: {
    operating_revenue: {
      sales: [],
      service_income: [],
      subscription_income: [],
      rental_income: [],
      project_revenue: [],
      commission_income: [],
      grant_income: [],
      other_operating_revenue: [],
    },
    non_operating_revenue: {
      interest_income: [],
      gain_on_disposal: [],
      foreign_exchange_gain: [],
      dividend_income: [],
      other_income: [],
    },
  },
  expenses: {
    cost_of_sales: {
      direct_materials: [],
      direct_labor: [],
      production_overhead: [],
      freight_in: [],
      import_duties: [],
      factory_utilities: [],
      subcontractor_costs: [],
      royalties: [],
      packaging_costs: [],
      quality_control_costs: [],
    },
    operating_expenses: {
      admin_expenses: [],
      selling_expenses: [],
      salaries: [],
      staff_welfare: [],
      rent_expense: [],
      utilities: [],
      depreciation_expense: [],
      amortization_expense: [],
      marketing_expenses: [],
      repair_and_maintenance: [],
      insurance_expense: [],
      travel_and_transport: [],
      professional_fees: [],
      training_and_development: [],
      IT_and_software_subscriptions: [],
      bad_debt_expense: [],
      research_and_development: [],
      regulatory_fees_and_levies: [],
      other_operating_expenses: [],
    },
    non_operating_expenses: {
      interest_payable: [],
      bank_charges: [],
      loan_processing_fees: [],
      impairment_loss: [],
      inventory_write_off: [],
      abnormal_production_loss: [],
      abnormal_inventory_loss: [],
      foreign_exchange_loss: [],
      loss_on_disposal: [],
      write_off_losses: [],
      penalties_and_fines: [],
    },
    taxes: {
      income_tax: [],
      deferred_tax: [],
      withholding_tax: [],
      education_tax: [],
      vat_expense: [],
      capital_gains_tax: [],
      other_taxes: [],
    },
  },
};

const NATURE_TO_ENUM = {
  assets: "ASSET",
  liabilities: "LIABILITY",
  equity: "EQUITY",
  revenue: "REVENUE",
  expenses: "EXPENSE",
};
const NATURE_PARENT_CODES = {
  assets: "1",
  liabilities: "2",
  equity: "3",
  revenue: "4",
  expenses: "5",
};

const humanize = (value = "") =>
  String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const ACCOUNT_ROLE_OPTIONS = [
  { value: "general", label: "General" },
  { value: "tax_control", label: "Tax control (VAT/WHT)" },
  { value: "bank", label: "Bank" },
  { value: "ar", label: "Accounts receivable" },
  { value: "ap", label: "Accounts payable" },
  { value: "clearing", label: "Clearing / suspense" },
  { value: "retained_earnings", label: "Retained earnings" },
];

const PL_LINE_OPTIONS = [
  { value: "turnover", label: "Turnover" },
  { value: "cost_of_sales", label: "Cost of sales" },
  { value: "admin_costs", label: "Admin / operating costs" },
  { value: "other_income", label: "Other income" },
  { value: "finance", label: "Finance / interest" },
  { value: "tax", label: "Tax" },
  { value: "impairment", label: "Impairment" },
];

const NATURE_ENUM_OPTIONS = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

const defaultReportingForNature = (accountNature) => {
  const n = String(accountNature || "").toUpperCase();
  const isPl = n === "REVENUE" || n === "EXPENSE";
  return {
    normalBalance: ["ASSET", "EXPENSE"].includes(n) ? "debit" : "credit",
    fsSection: isPl ? "profit_and_loss" : "balance_sheet",
    plLine: "",
  };
};

export default function AddAccountModal({ open, onClose, onSuccess }) {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  const [selectedNature, setSelectedNature] = useState("");
  const [selectedType, setSelectedType] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(false);

  const [isSubaccount, setIsSubaccount] = useState(false);
  const [parentAccounts, setParentAccounts] = useState([]);
  const [selectedParent, setSelectedParent] = useState(null);
  const [accountNumberTouched, setAccountNumberTouched] = useState(false);
  const accountNumberTouchedRef = useRef(false);
  // Live uniqueness check for the (editable) account code.
  // status: "" | "checking" | "available" | "taken" | "invalid"
  const [codeCheck, setCodeCheck] = useState({ status: "", message: "" });
  const codeCheckSeqRef = useRef(0);

  useEffect(() => {
    accountNumberTouchedRef.current = accountNumberTouched;
  }, [accountNumberTouched]);

  const [form, setForm] = useState({
    accountName: "",
    accountNumber: "",
    accountType: "",
    category: "",
    parentAccount: null,
    openingBalance: "",
    asOf: "",
    description: "",
    display: true,
    isActive: true,
    normalBalance: "debit",
    fsSection: "balance_sheet",
    reportingBehavior: "fixed",
    alternateNature: "",
    accountRole: "general",
    plLine: "",
  });

  /** Six digits only: nature 1–5 + five-digit sequence (e.g. 100001, 100002). */
  const isValidAccountNumber = (value) => {
    const v = String(value || "").trim();
    return /^[1-5]\d{5}$/.test(v);
  };

  // Format number with commas
  const formatNumberWithCommas = (value) => {
    if (!value || value === "") return "";

    // Remove all non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, "");

    // Check if the value ends with a decimal point (user is typing decimal)
    const endsWithDot = numericValue.endsWith(".");

    // Split into integer and decimal parts
    const parts = numericValue.split(".");
    const integerPart = parts[0] || "";
    const decimalPart = parts[1] || "";

    // Add commas to integer part
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    // Combine with decimal part if exists, or preserve trailing dot
    if (decimalPart) {
      return `${formattedInteger}.${decimalPart}`;
    } else if (endsWithDot && integerPart) {
      // Preserve the decimal point if user just typed it
      return `${formattedInteger}.`;
    } else {
      return formattedInteger;
    }
  };

  // Parse number from formatted string (remove commas)
  const parseNumberFromFormatted = (value) => {
    if (!value || value === "") return "";
    // Remove commas and keep only numbers and decimal point
    return value.replace(/,/g, "");
  };

  // Handle opening balance input
  const handleOpeningBalanceChange = (value) => {
    // Remove commas first, then sanitize
    const withoutCommas = value.replace(/,/g, "");
    const sanitizedValue = withoutCommas.replace(/[^0-9.,]/g, "");

    // Prevent multiple decimal points
    const parts = sanitizedValue.split(".");
    const numericValue =
      parts.length > 2
        ? parts[0] + "." + parts.slice(1).join("")
        : sanitizedValue;

    // Format with commas for display
    const formattedValue = formatNumberWithCommas(numericValue);

    setForm((f) => ({
      ...f,
      openingBalance: formattedValue,
    }));
  };

  // Function to generate account code using SQL function
  const generateAccountCode = useCallback((parentCode, facilityId) => {
    if (!facilityId) return;

    _postApi(
      "/account/generate-account-category-code",
      {
        facilityId: facilityId,
        parentCode: parentCode || null,
      },
      (resp) => {
        if (resp.success) {
          setForm((f) =>
            accountNumberTouchedRef.current
              ? f
              : { ...f, accountNumber: resp.code }
          );
        }
      }
    );
  }, []);

  // Auto-generate account number when parent account is selected
  useEffect(() => {
    if (!activeBusiness?.id || !selectedParent) return;

    const parentCode =
      selectedParent.head || selectedParent.code || selectedParent.parent_code;
    if (parentCode) {
      generateAccountCode(parentCode, activeBusiness.id);
    }
  }, [selectedParent, activeBusiness?.id, generateAccountCode]);

  // Auto-generate account number when account type changes - use code from Account type
  useEffect(() => {
    if (!activeBusiness?.id || !selectedType?.type) return;

    // Use code from Account type for next available number
    const parentCode = selectedType?.code;
    if (parentCode) {
      generateAccountCode(parentCode, activeBusiness.id);
    }
  }, [selectedType, activeBusiness?.id, generateAccountCode]);

  // Debounced uniqueness check whenever the (editable) code changes.
  useEffect(() => {
    const code = String(form.accountNumber || "").trim();

    if (!code || !activeBusiness?.id) {
      setCodeCheck({ status: "", message: "" });
      return;
    }

    // Manual codes (user-edited) can be anything they want — only uniqueness is
    // checked. System-generated codes must follow the six-digit nature format.
    if (!accountNumberTouched && !isValidAccountNumber(code)) {
      setCodeCheck({
        status: "invalid",
        message: "Code must be 6 digits: nature 1–5 + five digits (e.g. 100001).",
      });
      return;
    }

    setCodeCheck({ status: "checking", message: "Checking availability…" });
    const seq = ++codeCheckSeqRef.current;
    const handle = setTimeout(() => {
      _fetchApi(
        `/account/account-category/check-code?code=${encodeURIComponent(
          code
        )}&facilityId=${encodeURIComponent(activeBusiness.id)}`,
        (resp) => {
          if (seq !== codeCheckSeqRef.current) return; // stale
          if (resp?.success) {
            setCodeCheck(
              resp.available
                ? { status: "available", message: "Code is available." }
                : {
                    status: "taken",
                    message: `Code already in use${
                      resp.existing?.description
                        ? ` by "${resp.existing.description}"`
                        : ""
                    }.`,
                  }
            );
          } else {
            setCodeCheck({ status: "", message: "" });
          }
        },
        () => {
          if (seq !== codeCheckSeqRef.current) return;
          setCodeCheck({ status: "", message: "" });
        }
      );
    }, 400);

    return () => clearTimeout(handle);
  }, [form.accountNumber, activeBusiness?.id, accountNumberTouched]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedNature || !form.accountType || !form.category || !form.description) {
      toast.error(
        "Nature, Account type, Category, and Account Description are required"
      );
      return;
    }

    if (isSubaccount && !form.parentAccount) {
      toast.error("Parent account is required when creating a subaccount");
      return;
    }

    if (!form.accountNumber) {
      toast.error("Account code is required.");
      return;
    }

    // Strict six-digit format only applies to system-generated codes. Manual
    // codes (user-edited) may be anything as long as they are unique.
    if (!accountNumberTouched && !isValidAccountNumber(form.accountNumber)) {
      toast.error(
        "Account number must be six digits: nature 1–5 plus five digits (e.g. 100001, 100002)."
      );
      return;
    }

    if (codeCheck.status === "taken") {
      toast.error(`Account code "${form.accountNumber}" is already in use.`);
      return;
    }

    // Validate opening balance date if opening balance is provided
    if (form.openingBalance && !form.asOf) {
      toast.error(
        "Opening balance date is required when entering an opening balance"
      );
      return;
    }

    // For code generation API: nature digit (1–5) or parent account code; server derives level/parent_code from final code
    let parentCode = null;
    if (isSubaccount && selectedParent) {
      parentCode =
        form.parentAccount ||
        selectedParent.head ||
        selectedParent.code ||
        null;
    } else if (selectedType?.code) {
      parentCode = selectedType.code;
    }

    const accountNature = NATURE_TO_ENUM[selectedNature] || "";

    setLoading(true);
    _postApi(
      "/account/account-category",
      {
        parentCode,
        category: form.category,
        subcategory: selectedCategory?.key || form.category,
        normalBalance: form.normalBalance,
        fsSection: form.fsSection,
        reportingBehavior: form.reportingBehavior,
        alternateNature:
          form.reportingBehavior === "balance_switch"
            ? form.alternateNature || null
            : null,
        accountRole: form.accountRole || "general",
        plLine:
          form.fsSection === "profit_and_loss" ? form.plLine || null : null,
        type: selectedType?.type,
        accountNature: accountNature,
        detail: null,
        facilityId: activeBusiness.id,
        description: form.description,
        openingBalance: form.openingBalance
          ? parseNumberFromFormatted(form.openingBalance)
          : "",
        openingBalanceDate: form.asOf,
        accountNumber: form.accountNumber,
        display: form.display,
        isActive: form.isActive,
        openingBalanceEquity: activeBusiness.opening_balance_equity,
      },
      (resp) => {
        if (resp.success) {
          toast.success("Account created successfully!");
          onSuccess();
          onClose();
          // Reset form
          setForm({
            accountName: "",
            accountNumber: "",
            accountType: "",
            category: "",
            parentAccount: null,
            openingBalance: "",
            asOf: "",
            description: "",
            display: true,
            isActive: true,
            normalBalance: "debit",
            fsSection: "balance_sheet",
            reportingBehavior: "fixed",
            alternateNature: "",
            accountRole: "general",
            plLine: "",
          });
          setIsSubaccount(false);
          setSelectedType(null);
          setSelectedCategory(null);
          setSelectedParent(null);
          setSelectedNature("");
        } else {
          toast.error(resp.message || "Failed to create account");
        }
        setLoading(false);
      },
      () => {
        toast.error("Network error");
        setLoading(false);
      }
    );
  };

  const natureOptions = Object.keys(ACCOUNT_TAXONOMY);

  const filteredAccountTypes = (() => {
    if (!selectedNature || !ACCOUNT_TAXONOMY[selectedNature]) return [];
    const taxonomyTypes = Object.keys(ACCOUNT_TAXONOMY[selectedNature]);
    const accountNature = NATURE_TO_ENUM[selectedNature] || "";
    const parentCode = NATURE_PARENT_CODES[selectedNature] || "";

    return taxonomyTypes.map((taxonomyKey) => ({
      taxonomyKey,
      natureKey: selectedNature,
      type: humanize(taxonomyKey),
      category: humanize(taxonomyKey),
      code: parentCode,
      accountNature,
      account_nature: accountNature,
      normal_balance: ["LIABILITY", "EQUITY", "REVENUE"].includes(accountNature)
        ? "CREDIT"
        : "DEBIT",
      fs_section: ["REVENUE", "EXPENSE"].includes(accountNature) ? "PL" : "BS",
    }));
  })();

  const filteredCategories = (() => {
    if (!selectedNature || !selectedType?.taxonomyKey) return [];
    const branch = ACCOUNT_TAXONOMY[selectedNature]?.[selectedType.taxonomyKey];
    const keys =
      branch && typeof branch === "object" && !Array.isArray(branch)
        ? Object.keys(branch)
        : [];
    const categoryKeys = keys.length > 0 ? keys : [selectedType.taxonomyKey];
    return categoryKeys.map((k) => ({ key: k, label: humanize(k) }));
  })();

  const selectClass =
    "w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--aa-accent)]/30 focus:border-[var(--aa-navy)]";

  return (
    <Sheet
      open={!!open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose?.();
      }}
    >
      <SheetContent
        side="right"
        className="!inset-y-0 !right-0 !left-auto flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l border-slate-200 p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:!max-w-xl md:!max-w-2xl [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:bg-white/10 [&>button]:hover:opacity-100"
      >
        <SheetHeader className="shrink-0 space-y-1 border-b border-slate-200 bg-[var(--aa-navy)] px-5 py-4 pr-12 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-white/10 p-2">
              <BookOpen className="h-4 w-4 text-[var(--aa-accent,#93c5fd)]" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-lg font-semibold leading-tight text-white">
                Add New Account
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-xs text-white/70">
                Map the account for P&amp;L, Trial Balance, and Balance Sheet
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-5 md:px-6">
            <div className="space-y-5">
            {/* Nature (balance-sheet classification: Assets, Liabilities, …) */}
            <div>
              <Label>
                Nature <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-slate-500 mt-1 mb-1.5">
                High-level group (Assets, Liabilities, Equity, Revenue, Expenses). This is not the same as Account
                type below.
              </p>
              <select
                value={selectedNature}
                onChange={(e) => {
                  const nextNature = e.target.value || "";
                  setSelectedNature(nextNature);
                  setSelectedType(null);
                  setSelectedCategory(null);
                  setSelectedParent(null);
                  setIsSubaccount(false);
                  setAccountNumberTouched(false);
                  setForm((f) => ({
                    ...f,
                    accountNumber: "",
                    accountType: "",
                    category: "",
                    parentAccount: null,
                    ...defaultReportingForNature(
                      NATURE_TO_ENUM[nextNature] || ""
                    ),
                    reportingBehavior: "fixed",
                    alternateNature: "",
                    accountRole: "general",
                    plLine: "",
                  }));
                }}
                className={selectClass}
              >
                <option value="">Select nature...</option>
                {natureOptions.map((n) => (
                  <option key={n} value={n}>
                    {humanize(n)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Account type (subtype within the selected nature, e.g. Current assets) */}
              <div>
                <Label>
                  Account type <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-slate-500 mt-1 mb-1.5 min-h-[1rem]">
                  Choose the account type.
                </p>

                <Typeahead
                  id="account-type"
                  options={filteredAccountTypes}
                  labelKey={(option) => option.type}
                  placeholder="Select account type..."
                  selected={selectedType ? [selectedType] : []}
                  renderMenuItemChildren={(option) => (
                    <span className="text-gray-900">
                      {option.code ? `${option.code} — ${option.type}` : option.type}
                    </span>
                  )}
                  onChange={(selected) => {
                    const type = selected[0] || null;

                    // Reset form when account type changes
                    setSelectedType(type);
                    setSelectedCategory(null);
                    setSelectedParent(null);
                    setIsSubaccount(false);
                    if (type?.natureKey && !selectedNature) {
                      setSelectedNature(type.natureKey);
                    }
                    setAccountNumberTouched(false);
                    const nature =
                      type?.accountNature ||
                      NATURE_TO_ENUM[type?.natureKey || selectedNature] ||
                      "";
                    const defaults = defaultReportingForNature(nature);
                    setForm({
                      accountName: "",
                      accountNumber: "",
                      accountType: type?.type || "",
                      category: "",
                      parentAccount: null,
                      openingBalance: "",
                      asOf: "",
                      description: "",
                      display: true,
                      isActive: true,
                      ...defaults,
                      reportingBehavior: "fixed",
                      alternateNature: "",
                      accountRole: "general",
                      plLine: "",
                    });

                    setParentAccounts([]);
                    if (type?.code && activeBusiness?.id) {
                      generateAccountCode(type.code, activeBusiness.id);
                    }
                  }}
                  clearButton
                />
              </div>

              <div>
                <Label>
                  Sub Category <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-muted-foreground mt-1 mb-1.5 min-h-[1rem]">
                  Choose the detailed category.
                </p>
                <Typeahead
                  id="account-category"
                  options={filteredCategories}
                  labelKey={(option) => option.label}
                  placeholder="Select category..."
                  selected={selectedCategory ? [selectedCategory] : []}
                  onChange={(selected) => {
                    const category = selected[0] || null;
                    setSelectedCategory(category);
                    const subKey = category?.key || "";
                    const isTaxControl =
                      subKey === "tax_payable" ||
                      subKey === "deferred_tax" ||
                      /tax|vat|wht/i.test(subKey);
                    setForm((f) => {
                      const next = {
                        ...f,
                        category: category?.label || "",
                      };
                      // Tax-related subcategories suggest balance switch; you can
                      // still enable/disable it manually for any account below.
                      if (isTaxControl) {
                        next.reportingBehavior = "balance_switch";
                        next.alternateNature =
                          (NATURE_TO_ENUM[selectedNature] || "") === "LIABILITY"
                            ? "ASSET"
                            : "LIABILITY";
                        if (f.accountRole === "general") {
                          next.accountRole = "tax_control";
                        }
                      } else if (
                        f.accountRole === "tax_control" &&
                        f.reportingBehavior === "balance_switch"
                      ) {
                        // Left tax subcategory — keep switch settings; only clear tax role
                        next.accountRole = "general";
                      }
                      return next;
                    });
                  }}
                  clearButton
                  disabled={!selectedType}
                />
              </div>
            </div>

            {/* Make this a subaccount */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="subaccount"
                checked={isSubaccount}
                onCheckedChange={(checked) => {
                  setIsSubaccount(checked);
                  if (!checked) {
                    setForm((f) => ({ ...f, parentAccount: null }));
                    setSelectedParent(null);
                    setParentAccounts([]);
                  } else {
                    // Load parent accounts when checkbox is checked
                    if (selectedType?.code && activeBusiness?.id) {
                      const selectedAccountType = selectedType?.type || "";
                      _fetchApi(
                        `/account/parent-accounts-dropdown?parentCode=${encodeURIComponent(
                          selectedType.code
                        )}&type=${encodeURIComponent(
                          selectedAccountType
                        )}&facilityId=${activeBusiness.id}`,
                        (resp) => {
                          if (resp.success) {
                            // Transform results for Typeahead
                            const formattedParents = resp.results.map(
                              (item) => ({
                                head: item.head,
                                name:
                                  item.description ||
                                  item.detail ||
                                  item.parent_code,
                                parent_code: item.parent_code,
                                detail: item.detail,
                                description:
                                  item.description || item.detail || "",
                                type: item.type,
                                label: `${item.parent_code} ${
                                  item.description || item.detail
                                }`,
                                accountType: item.type,
                              })
                            );
                            setParentAccounts(formattedParents);
                          } else {
                            toast.error("Failed to load parent accounts");
                            setParentAccounts([]);
                          }
                        },
                        () => {
                          toast.error("Failed to load parent accounts");
                          setParentAccounts([]);
                        }
                      );
                    }
                  }
                }}
              />
              <Label
                htmlFor="subaccount"
                className="cursor-pointer font-normal"
              >
                Make this a subaccount
              </Label>
            </div>

            {/* Parent account */}
            {/* {JSON.stringify(parentAccounts)} */}
            {isSubaccount && (
              <div>
                <Label>
                  Parent account <span className="text-red-500">*</span>
                </Label>
                <Typeahead
                  id="parent-account"
                  options={parentAccounts}
                  labelKey={(option) => `${option.head} ${option.detail}`}
                  placeholder="Select parent account..."
                  selected={selectedParent ? [selectedParent] : []}
                  filterBy={(option, props) => {
                    const searchText = props.text.toLowerCase();
                    const head = (option.head || "").toLowerCase();
                    const name = (option.name || "").toLowerCase();
                    const detail = (option.detail || "").toLowerCase();
                    const description = (
                      option.description || ""
                    ).toLowerCase();
                    const parentCode = (option.parent_code || "").toLowerCase();
                    const label = (option.label || "").toLowerCase();

                    return (
                      head.includes(searchText) ||
                      name.includes(searchText) ||
                      detail.includes(searchText) ||
                      description.includes(searchText) ||
                      parentCode.includes(searchText) ||
                      label.includes(searchText)
                    );
                  }}
                  renderMenuItemChildren={(option) => (
                    <span className="text-gray-900">
                      {`${option.head} ${option.name}`}
                      {option.accountType ? (
                        <span className="text-muted-foreground text-sm ml-2">
                          · {option.accountType}
                        </span>
                      ) : null}
                    </span>
                  )}
                  onChange={(selected) => {
                    const parent = selected[0] || null;
                    setSelectedParent(parent);
                    setForm((f) => ({
                      ...f,
                      parentAccount:
                        parent?.head ||
                        parent?.code ||
                        parent?.parent_code ||
                        null,
                    }));

                    // Generate account code when parent account is selected
                    if (parent && activeBusiness?.id) {
                      const parentCode =
                        parent.head || parent.code || parent.parent_code;
                      if (parentCode) {
                        generateAccountCode(parentCode, activeBusiness.id);
                      }
                    }
                  }}
                  clearButton
                />
              </div>
            )}

            <div>
              <Label>
                Account Description <span className="text-red-500">*</span>
              </Label>
              <input
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Enter account description"
                className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--aa-accent)]/30 focus:border-[var(--aa-navy)]"
                required
              />
            </div>

            {selectedType && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Preview code
                </Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  readOnly={false}
                  aria-label="Account code — editable"
                  value={form.accountNumber}
                  onChange={(e) => {
                    const next = e.target.value.replace(/\D/g, "");
                    setAccountNumberTouched(true);
                    setForm((f) => ({ ...f, accountNumber: next }));
                  }}
                  placeholder="e.g. 200001"
                  className="h-11 rounded-lg border border-[var(--aa-navy)]/25 bg-[var(--aa-sidebar-active,#eff4fb)] px-4 font-mono text-base font-medium text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-[var(--aa-navy)] focus-visible:ring-2 focus-visible:ring-[var(--aa-accent)]/25"
                />
                <p className="text-xs text-muted-foreground">
                  You can keep the suggested code or type your own. It must be
                  unique within this business.
                </p>
                {codeCheck.message && (
                  <p
                    className={`text-xs font-medium ${
                      codeCheck.status === "available"
                        ? "text-green-600"
                        : codeCheck.status === "taken" ||
                          codeCheck.status === "invalid"
                        ? "text-red-600"
                        : "text-slate-500"
                    }`}
                  >
                    {codeCheck.message}
                  </p>
                )}
              </div>
            )}

            {/* Statement mapping */}
            {selectedType && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-4 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    Statement mapping
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    How this account appears on P&amp;L, Trial Balance, and Balance Sheet.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Financial statement</Label>
                    <select
                      value={form.fsSection}
                      onChange={(e) => {
                        const fsSection = e.target.value;
                        setForm((f) => ({
                          ...f,
                          fsSection,
                          plLine:
                            fsSection === "profit_and_loss" ? f.plLine : "",
                        }));
                      }}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--aa-accent)]/30 focus:border-[var(--aa-navy)]"
                    >
                      <option value="balance_sheet">Balance sheet</option>
                      <option value="profit_and_loss">Profit &amp; loss</option>
                      <option value="off_statement">Off statement</option>
                    </select>
                  </div>
                  <div>
                    <Label>Normal balance</Label>
                    <select
                      value={form.normalBalance}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          normalBalance: e.target.value,
                        }))
                      }
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--aa-accent)]/30 focus:border-[var(--aa-navy)]"
                    >
                      <option value="debit">Debit</option>
                      <option value="credit">Credit</option>
                    </select>
                  </div>
                  {form.fsSection === "profit_and_loss" && (
                    <div className="md:col-span-2">
                      <Label>P&amp;L line</Label>
                      <select
                        value={form.plLine}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, plLine: e.target.value }))
                        }
                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--aa-accent)]/30 focus:border-[var(--aa-navy)]"
                      >
                        <option value="">Derive from account type</option>
                        {PL_LINE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Special reporting */}
            {selectedType && (
              <div className="rounded-lg border border-slate-200 p-4 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    Special reporting
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Optional dual-nature accounts: reports place them on the
                    asset or liability side from the closing balance. Use for
                    VAT, WHT, clearing, suspense, or any similar account.
                  </p>
                </div>
                <div>
                  <Label>Reporting behavior</Label>
                  <select
                    value={form.reportingBehavior}
                    onChange={(e) => {
                      const reportingBehavior = e.target.value;
                      setForm((f) => ({
                        ...f,
                        reportingBehavior,
                        alternateNature:
                          reportingBehavior === "balance_switch"
                            ? f.alternateNature ||
                              ((NATURE_TO_ENUM[selectedNature] || "") ===
                              "LIABILITY"
                                ? "ASSET"
                                : "LIABILITY")
                            : "",
                      }));
                    }}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--aa-accent)]/30 focus:border-[var(--aa-navy)]"
                  >
                    <option value="fixed">Fixed (primary nature)</option>
                    <option value="balance_switch">
                      Balance switch (debit → asset, credit → liability)
                    </option>
                  </select>
                </div>
                {form.reportingBehavior === "balance_switch" && (
                  <div className="rounded-md border border-[var(--aa-navy)]/25 bg-[var(--aa-sidebar-active,#eff4fb)] p-3 space-y-3">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Closing{" "}
                      <span className="font-medium text-slate-800">
                        debit
                      </span>{" "}
                      balance → Balance Sheet{" "}
                      <span className="font-medium text-slate-800">Assets</span>
                      . Closing{" "}
                      <span className="font-medium text-slate-800">
                        credit
                      </span>{" "}
                      balance →{" "}
                      <span className="font-medium text-slate-800">
                        Liabilities
                      </span>
                      . Primary nature is your default home; alternate nature is
                      the other side when the balance flips.
                    </p>
                    <div>
                      <Label>Alternate nature (when balance flips)</Label>
                      <select
                        value={form.alternateNature}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            alternateNature: e.target.value,
                          }))
                        }
                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--aa-accent)]/30 focus:border-[var(--aa-navy)]"
                      >
                        <option value="">Select…</option>
                        {NATURE_ENUM_OPTIONS.filter(
                          (n) => n !== (NATURE_TO_ENUM[selectedNature] || "")
                        ).map((n) => (
                          <option key={n} value={n}>
                            {humanize(n)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                <div>
                  <Label>Account role</Label>
                  <select
                    value={form.accountRole}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, accountRole: e.target.value }))
                    }
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--aa-accent)]/30 focus:border-[var(--aa-navy)]"
                  >
                    {ACCOUNT_ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Opening balance - Only show for balance sheet accounts (ASSET, LIABILITY, EQUITY) */}
            {selectedType &&
              selectedType.accountNature &&
              ["ASSET", "LIABILITY", "EQUITY"].includes(
                selectedType.accountNature.toUpperCase()
              ) && (
                <>
                  <div>
                    <Label>
                      Opening balance
                      <span className="ml-2 text-gray-400">
                        <svg
                          className="inline w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    </Label>
                    <Input
                      type="text"
                      value={form.openingBalance}
                      onChange={(e) =>
                        handleOpeningBalanceChange(e.target.value)
                      }
                      placeholder="0.00"
                      className="text-right"
                    />
                    <a
                      href="#"
                      className="text-blue-600 text-sm underline mt-1 block"
                    >
                      More info on opening balances
                    </a>
                  </div>

                  {/* Opening balance date */}
                  <div>
                    <Label>
                      Opening balance date{" "}
                      {form.openingBalance && (
                        <span className="text-red-500">*</span>
                      )}
                    </Label>
                    <div className="relative">
                      <Input
                        type="date"
                        value={form.asOf}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, asOf: e.target.value }))
                        }
                        className="border-slate-200"
                        required={!!form.openingBalance}
                      />
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {form.asOf
                        ? `We'll start tracking from ${form.asOf} onwards.`
                        : "Select a date if entering an opening balance."}
                    </p>
                  </div>
                </>
              )}

            {selectedType && (
              <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <Label
                    htmlFor="account-display-switch"
                    className="font-normal text-sm text-slate-700 cursor-pointer flex-1"
                  >
                    Show in account lists (dropdowns)
                  </Label>
                  <Switch
                    id="account-display-switch"
                    checked={form.display}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, display: !!checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label
                    htmlFor="account-active-switch"
                    className="font-normal text-sm text-slate-700 cursor-pointer flex-1"
                  >
                    Active (turn off to disable this account)
                  </Label>
                  <Switch
                    id="account-active-switch"
                    checked={form.isActive}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, isActive: !!checked }))
                    }
                  />
                </div>
              </div>
            )}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-5 py-3.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
              className="border-slate-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                loading ||
                codeCheck.status === "taken" ||
                codeCheck.status === "invalid" ||
                codeCheck.status === "checking"
              }
              className="gap-1.5 border-0 bg-[var(--aa-navy)] text-white hover:bg-[var(--aa-navy)]/90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
