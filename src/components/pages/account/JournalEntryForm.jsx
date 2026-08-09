import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import Select from "react-select";
import {
  formatNumberWithCommas,
  parseNumberFromFormatted,
  filterJournalAmountInput,
  POSTING_DATE_MIN,
  getPostingDateMax,
  validatePostingDateClient,
} from "@/utilities";

// React Select styles aligned with CoA / Journal list (#4267B2, slate borders)
const customSelectStyles = {
  control: (provided, state) => ({
    ...provided,
    minHeight: "36px",
    height: "36px",
    borderColor: state.isFocused ? "#4267B2" : "#e2e8f0",
    borderWidth: "1px",
    borderRadius: "0.375rem",
    boxShadow: state.isFocused ? "0 0 0 2px rgb(66 103 178 / 0.2)" : "none",
    backgroundColor: "white",
    fontSize: "13px",
    "&:hover": {
      borderColor: state.isFocused ? "#4267B2" : "#cbd5e1",
    },
  }),
  valueContainer: (provided) => ({
    ...provided,
    padding: "0 0.625rem",
    height: "34px",
  }),
  input: (provided) => ({
    ...provided,
    margin: "0",
    padding: "0",
    color: "#0f172a",
    fontSize: "13px",
  }),
  placeholder: (provided) => ({
    ...provided,
    color: "#94a3b8",
    fontSize: "13px",
  }),
  singleValue: (provided) => ({
    ...provided,
    color: "#0f172a",
    fontSize: "13px",
  }),
  menu: (provided) => ({
    ...provided,
    zIndex: 9999,
    borderRadius: "0.5rem",
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    marginTop: "0.25rem",
  }),
  menuList: (provided) => ({
    ...provided,
    padding: "0.25rem",
    maxHeight: "280px",
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? "#eff4fb"
      : state.isFocused
        ? "#f8fafc"
        : "white",
    color: state.isSelected ? "#4267B2" : "#334155",
    fontSize: "13px",
    padding: "8px 10px",
    cursor: "pointer",
    "&:active": {
      backgroundColor: "#eff4fb",
    },
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  dropdownIndicator: (provided, state) => ({
    ...provided,
    padding: "4px",
    color: state.isFocused ? "#64748b" : "#94a3b8",
    "&:hover": {
      color: "#64748b",
    },
  }),
  clearIndicator: (provided) => ({
    ...provided,
    padding: "4px",
    color: "#94a3b8",
    "&:hover": {
      color: "#64748b",
    },
  }),
};

const JournalEntryForm = () => {
  const navigate = useNavigate();
  const { transaction_ref } = useParams();
  const isEdit = Boolean(transaction_ref);

  const { activeBusiness, user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const userId = user?.id
  // Try multiple sources for user role - default to admin for permissions
  const userRole =
    user?.role || user?.user_role || activeBusiness?.user_role || "admin";

  console.log("Journal Entry Form - User info:", {
    user,
    facilityId,
    userRole,
    userId,
  });

  const [formData, setFormData] = useState({
    reference_number: "",
    entry_date: new Date().toISOString().split('T')[0],
    description: "",
    currency: "NGN",
    exchange_rate: 1.0,
    notes: "",
  });

  const [lines, setLines] = useState([
    {
      account_code: "",
      debit: "",
      credit: "",
      number_id: null,
      line_date: "",
      line_description: "",
    },
    {
      account_code: "",
      debit: "",
      credit: "",
      number_id: null,
      line_date: "",
      line_description: "",
    },
  ]);

  const [accounts, setAccounts] = useState([]);
  const [names, setNames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [isOpeningBalance, setIsOpeningBalance] = useState(false);

  useEffect(() => {
    fetchAccounts();
    fetchCustomersAndSuppliers();
    if (isEdit) {
      fetchJournalEntry();
    } else {
      // Generate reference number for new entries
      generateReferenceNumber();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction_ref]);

  const generateReferenceNumber = () => {
    if (!facilityId) return;

    _fetchApi(
      `/get-and-update/JE/${facilityId}`,
      (resp) => {
        if (resp.success) {
          setFormData((prev) => ({
            ...prev,
            reference_number: `JE-${resp.results}`,
          }));
        }
      },
      (err) => {
        console.error("Error generating reference number:", err);
        toast.error("Failed to generate reference number");
      }
    );
  };

  const fetchAccounts = () => {
    if (!activeBusiness?.business_name) {
      console.warn("No business name available for fetching accounts");
      return;
    }

    console.log(
      "Fetching Chart of Accounts for:",
      activeBusiness.business_name
    );

    _postApi(
      `/account/chart-of-account?query_type=select`,
      { store: activeBusiness.business_name },
      (resp) => {
        console.log("Chart of Accounts response:", resp);
        if (resp.success && resp.results) {
          // Map from Account table: head (code), description (name), account_type, account_category
          const flatAccounts = resp.results
            .filter((acc) => acc.head && acc.head !== "0") // Filter out invalid accounts
            .map((acc) => ({
              code: String(acc.head), // Account code from 'head' field
              name: acc.description || "", // Account name from 'description' field
              type: acc.account_type || "", // Account type
              category: acc.account_category || "", // Category
              subhead: acc.subhead || "", // Subhead for grouping
              status: acc.status || "activated", // Status
            }))
            .filter((acc) => acc.status === "activated") // Only active accounts
            .sort((a, b) => {
              // Sort numerically if possible, otherwise alphabetically
              const aNum = parseInt(a.code);
              const bNum = parseInt(b.code);
              if (!isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum;
              }
              return a.code.localeCompare(b.code);
            });

          setAccounts(flatAccounts);
          console.log(
            `✓ Loaded ${flatAccounts.length} accounts from Chart of Accounts`
          );

          if (flatAccounts.length === 0) {
            toast.warning("No active accounts found in Chart of Accounts");
          }
        } else {
          console.error("Failed to load accounts:", resp);
          setAccounts([]);
          toast.error("Failed to load Chart of Accounts");
        }
      },
      (err) => {
        console.error("Error fetching accounts:", err);
        setAccounts([]);
        toast.error("Error loading Chart of Accounts");
      }
    );
  };

  const fetchCustomersAndSuppliers = () => {
    if (!facilityId) {
      console.warn("No facility ID available for fetching customers/suppliers");
      return;
    }

    _fetchApi(
      `/api/journals/customers-suppliers/${facilityId}`,
      (resp) => {
        console.log("Customers and suppliers response:", resp);
        if (resp.success && resp.data) {
          // Format the data for react-select
          const formattedData = resp?.data?.map((item) => ({
            value: item.No,
            label: `${item.No} - ${item.name}`,
            No: item.No,
            name: item.name,
            address: item.address || "",
            email: item.email || "",
            type: item.type,
          }));

          setNames(formattedData);
          console.log(
            `✓ Loaded ${formattedData.length} customers/suppliers for journal entry`
          );
        } else {
          console.error("Failed to load customers/suppliers:", resp);
          setNames([]);
          toast.error("Failed to load customers/suppliers");
        }
      },
      (err) => {
        console.error("Error fetching customers and suppliers:", err);
        setNames([]);
        toast.error("Error loading customers and suppliers");
      }
    );
  };

  const fetchJournalEntry = () => {
    setLoading(true);
    _fetchApi(
      `/api/journals/${transaction_ref}?facility_id=${facilityId}&user_role=${userRole}`,
      (resp) => {
        setLoading(false);
        if (resp.success) {
          const entry = resp.data;
          setFormData({
            reference_number: entry.reference_number,
            entry_date: entry.entry_date,
            description: entry.description || "",
            currency: entry.currency || "NGN",
            exchange_rate: entry.exchange_rate || 1.0,
            notes: entry.description || entry.notes || "", // Use description as notes
            status: entry.status || "draft",
            total_debit: entry.total_debit || "0.00",
            total_credit: entry.total_credit || "0.00",
          });

          setLines(
            entry.lines.map((line) => {
              const debitValue = line.debit ? String(line.debit) : "";
              const creditValue = line.credit ? String(line.credit) : "";

              return {
                account_code: line.account_code,
                debit: debitValue ? formatNumberWithCommas(debitValue) : "",
                credit: creditValue ? formatNumberWithCommas(creditValue) : "",
                number_id: line.number_id || null,
                line_date: line.line_date || "",
                line_description: line.line_description || line.description || "",
              };
            })
          );
        }
      },
      (err) => {
        setLoading(false);
        console.error("Error fetching journal entry:", err);
        toast.error("Failed to load journal entry");
        navigate("/app/account/journal-entries");
      }
    );
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        account_code: "",
        debit: "",
        credit: "",
        number_id: null,
        line_date: "",
        line_description: "",
      },
    ]);
  };

  const removeLine = (index) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index, field, value) => {
    const newLines = [...lines];

    // For debit and credit, validate and sanitize input
    if (field === "debit" || field === "credit") {
      // Remove commas first, then sanitize
      const withoutCommas = value.replace(/,/g, "");
      const sanitizedValue = filterJournalAmountInput(withoutCommas);

      // Prevent multiple decimal points
      const parts = sanitizedValue.split(".");
      const numericValue =
        parts.length > 2
          ? parts[0] + "." + parts.slice(1).join("")
          : sanitizedValue;

      // Format with commas for display
      const formattedValue = formatNumberWithCommas(numericValue);
      newLines[index][field] = formattedValue;

      // If debit is entered, clear credit and vice versa
      const numericValueFloat = parseFloat(numericValue) || 0;
      if (field === "debit" && numericValueFloat > 0) {
        newLines[index].credit = "";
      } else if (field === "credit" && numericValueFloat > 0) {
        newLines[index].debit = "";
      }
    } else {
      newLines[index][field] = value;
    }

    setLines(newLines);
  };

  // Helper function to check if account is A/R or A/P
  const isARorAPAccount = (accountCode) => {
    if (!accountCode) return false;
    const account = accounts.find((acc) => acc.code === accountCode);
    if (!account) return false;

    const accountName = account.name?.toUpperCase() || "";
    const accountType = account.type?.toUpperCase() || "";
    const accountCategory = account.category?.toUpperCase() || "";

    return (
      accountName.includes("A/R") ||
      accountName.includes("A/P") ||
      accountName.includes("ACCOUNTS RECEIVABLE") ||
      accountName.includes("ACCOUNTS PAYABLE") ||
      accountType.includes("RECEIVABLE") ||
      accountType.includes("PAYABLE") ||
      accountCategory === "ACCOUNTS_RECEIVABLE" ||
      accountCategory === "ACCOUNTS_PAYABLE"
    );
  };

  // Helper function to check if account is specifically A/R (Accounts Receivable)
  const isARAccount = (accountCode) => {
    if (!accountCode) return false;
    const account = accounts.find((acc) => acc.code === accountCode);
    if (!account) return false;

    const accountName = account.name?.toUpperCase() || "";
    const accountType = account.type?.toUpperCase() || "";
    const accountCategory = account.category?.toUpperCase() || "";

    return (
      accountName.includes("A/R") ||
      accountName.includes("ACCOUNTS RECEIVABLE") ||
      accountType.includes("RECEIVABLE") ||
      accountCategory === "ACCOUNTS_RECEIVABLE"
    );
  };

  // Helper function to check if account is specifically A/P (Accounts Payable)
  const isAPAccount = (accountCode) => {
    if (!accountCode) return false;
    const account = accounts.find((acc) => acc.code === accountCode);
    if (!account) return false;

    const accountName = account.name?.toUpperCase() || "";
    const accountType = account.type?.toUpperCase() || "";
    const accountCategory = account.category?.toUpperCase() || "";

    return (
      accountName.includes("A/P") ||
      accountName.includes("ACCOUNTS PAYABLE") ||
      accountType.includes("PAYABLE") ||
      accountCategory === "ACCOUNTS_PAYABLE"
    );
  };

  // Helper function to get filtered options based on account type
  const getFilteredOptions = (accountCode) => {
    if (!accountCode || names.length === 0) return names;

    if (isARAccount(accountCode)) {
      // For A/R accounts, show only customers
      return names.filter((item) => item.type?.toLowerCase() === "customer");
    } else if (isAPAccount(accountCode)) {
      // For A/P accounts, show only suppliers
      return names.filter((item) => item.type?.toLowerCase() === "supplier");
    }

    // For other accounts, show all options
    return names;
  };

  const updateLineAccount = (index, accountCode) => {
    const account = accounts.find((acc) => acc.code === accountCode);
    const newLines = [...lines];
    newLines[index].account_code = accountCode;
    if (account) {
      newLines[index].account_name = account.name;
    }
    // Clear supplier/customer if account is not A/R or A/P
    if (!isARorAPAccount(accountCode)) {
      newLines[index].number_id = null;
      newLines[index].supplier_customer_name = "";
      newLines[index].supplier_customer_type = "";
    }
    setLines(newLines);
  };

  const calculateTotals = () => {
    let totalDebit = 0;
    let totalCredit = 0;

    lines.forEach((line) => {
      // Parse values by removing commas
      const debitParsed = parseNumberFromFormatted(line.debit);
      const creditParsed = parseNumberFromFormatted(line.credit);

      const debitValue =
        debitParsed === "" || debitParsed === "0"
          ? 0
          : parseFloat(debitParsed) || 0;
      const creditValue =
        creditParsed === "" || creditParsed === "0"
          ? 0
          : parseFloat(creditParsed) || 0;
      totalDebit += debitValue;
      totalCredit += creditValue;
    });

    return {
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      difference: (totalDebit - totalCredit).toFixed(2),
      balanced: Math.abs(totalDebit - totalCredit) < 0.01,
    };
  };

  const validateForm = () => {
    const newErrors = [];

    if (!formData.reference_number) {
      newErrors.push({
        field: "reference_number",
        message: "Reference number is required",
      });
    }

    if (!formData.entry_date) {
      newErrors.push({
        field: "entry_date",
        message: "Entry date is required",
      });
    } else {
      const entryDateErr = validatePostingDateClient(formData.entry_date, {
        field: "Entry date",
      });
      if (entryDateErr) {
        newErrors.push({ field: "entry_date", message: entryDateErr });
      }
    }

    if (!formData.notes || formData.notes.trim() === "") {
      newErrors.push({
        field: "notes",
        message: "Notes/Narration is required",
      });
    }

    lines.forEach((line, index) => {
      if (!line.account_code) {
        newErrors.push({
          field: `lines[${index}].account_code`,
          message: `Line ${index + 1}: Account code is required`,
        });
      }

      if (!line.line_date || String(line.line_date).trim() === "") {
        newErrors.push({
          field: `lines[${index}].line_date`,
          message: `Line ${index + 1}: Line date is required`,
        });
      } else {
        const lineDateErr = validatePostingDateClient(line.line_date, {
          field: `Line ${index + 1} date`,
        });
        if (lineDateErr) {
          newErrors.push({
            field: `lines[${index}].line_date`,
            message: lineDateErr,
          });
        }
      }

      // If A/R or A/P, require Supplier/Customer
      if (isARorAPAccount(line.account_code) && !line.number_id) {
        newErrors.push({
          field: `lines[${index}].number_id`,
          message: `Line ${
            index + 1
          }: Supplier/Customer is required for A/R or A/P accounts`,
        });
      }

      // Parse values by removing commas
      const debitParsed = parseNumberFromFormatted(line.debit);
      const creditParsed = parseNumberFromFormatted(line.credit);

      const debit = debitParsed === "" ? 0 : parseFloat(debitParsed) || 0;
      const credit = creditParsed === "" ? 0 : parseFloat(creditParsed) || 0;

      if (debit === 0 && credit === 0) {
        newErrors.push({
          field: `lines[${index}]`,
          message: `Line ${
            index + 1
          }: Either debit or credit must be greater than 0`,
        });
      }

      if (debit > 0 && credit > 0) {
        newErrors.push({
          field: `lines[${index}]`,
          message: `Line ${index + 1}: Cannot have both debit and credit`,
        });
      }
    });

    const totals = calculateTotals();
    // For normal journals, entry must be balanced; for opening balance we allow a single-sided line
    if (!totals.balanced && !isOpeningBalance) {
      newErrors.push({
        field: "balance",
        message: "Journal entry is not balanced. Debits must equal credits.",
      });
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors before submitting");
      return;
    }

    setLoading(true);

    // Normalize user_role to lowercase for consistency
    const normalizedUserRole = (userRole || "admin").toLowerCase().trim();

    console.log("Submitting journal entry with role:", {
      originalRole: userRole,
      normalizedRole: normalizedUserRole,
      userId,
      facilityId,
    });

    // Build normalized lines array
    const normalizedLines = lines.map((line) => {
      // Parse values by removing commas before sending to API
      const debitParsed = parseNumberFromFormatted(line.debit);
      const creditParsed = parseNumberFromFormatted(line.credit);

      return {
        ...line,
        debit: debitParsed === "" ? 0 : parseFloat(debitParsed) || 0,
        credit: creditParsed === "" ? 0 : parseFloat(creditParsed) || 0,
        number_id: line.number_id || null,
        supplier_customer_id: line.number_id || null, // Keep for backward compatibility
        supplier_customer_name: line.supplier_customer_name || "",
        supplier_customer_type:
          line.supplier_customer_type || line.type || "",
        type: line.supplier_customer_type || line.type || "", // Also send as 'type' for compatibility
        line_date: line.line_date,
        line_description: line.line_description || "",
      };
    });

    let finalLines = normalizedLines;

    // If this is an opening balance entry, automatically create the balancing line
    if (isOpeningBalance) {
      if (!activeBusiness?.opening_balance_equity) {
        toast.error(
          "Opening balance equity account is not set in business settings."
        );
        setLoading(false);
        return;
      }

      const obAccountCode = String(activeBusiness.opening_balance_equity);
      const obAccountExists =
        accounts.length === 0
          ? true // allow submit while accounts still loading
          : accounts.some((acc) => acc.code === obAccountCode);
      if (!obAccountExists) {
        toast.error(
          `Opening balance equity account code (${obAccountCode}) was not found in Chart of Accounts.`
        );
        setLoading(false);
        return;
      }

      if (normalizedLines.length !== 1) {
        toast.error("Opening balance entry must contain exactly one line.");
        setLoading(false);
        return;
      }

      const primaryLine = normalizedLines[0];

      const debitValue = primaryLine.debit || 0;
      const creditValue = primaryLine.credit || 0;

      if (debitValue === 0 && creditValue === 0) {
        toast.error(
          "Opening balance line must have either a debit or a credit amount."
        );
        setLoading(false);
        return;
      }

      const obLine = {
        account_code: obAccountCode,
        account_name:
          accounts.find((acc) => acc.code === obAccountCode)?.name ||
          "Opening Balance Equity",
        debit: creditValue, // opposite of primary line
        credit: debitValue,
        number_id: null,
        supplier_customer_id: null,
        supplier_customer_name: "",
        supplier_customer_type: "",
        type: "",
        line_date: primaryLine.line_date,
        line_description: "Opening balance (auto-balance to equity)",
      };

      finalLines = [primaryLine, obLine];
    }

    const payload = {
      ...formData,
      facility_id: facilityId,
      opening_balance_equity: activeBusiness?.opening_balance_equity || "",
      user_id: userId,
      user_role: normalizedUserRole,
      lines: finalLines,
    };

    console.log("Submitting journal entry:", payload);

    if (isEdit) {
      // Update existing entry using PUT
      _postApi(
        `/api/journals/${transaction_ref}`,
        payload,
        (resp) => {
          setLoading(false);
          if (resp.success) {
            toast.success("Journal entry updated successfully");
            navigate("/app/account/journal-entries");
          } else {
            toast.error(resp.message || "Failed to update journal entry");
          }
        },
        (err) => {
          setLoading(false);
          console.error("Error updating journal entry:", err);

          if (err.errors) {
            setErrors(
              Array.isArray(err.errors)
                ? err.errors
                : [{ field: "general", message: err.message }]
            );
          }

          toast.error(err.message || "Failed to update journal entry");
        },
        "PUT"
      );
    } else {
      // Create new entry using POST
      _postApi(
        `/api/journals`,
        payload,
        (resp) => {
          setLoading(false);
          console.log("Create response:", resp);
          if (resp.success) {
            toast.success("Journal entry created successfully");
            navigate("/app/account/journal-entries");
          } else {
            toast.error(resp.message || "Failed to create journal entry");
          }
        },
        (err) => {
          setLoading(false);
          console.error("Error creating journal entry:", err);

          if (err.errors) {
            setErrors(
              Array.isArray(err.errors)
                ? err.errors
                : [{ field: "general", message: err.message }]
            );
          }

          toast.error(err.message || "Failed to create journal entry");
        },
        "POST"
      );
    }
  };

  const totals = calculateTotals();
  const displayBalanced = isOpeningBalance ? true : totals.balanced;
  const primaryColor = activeBusiness?.primary_color || "#4267B2";
  const fieldClass =
    "h-9 border-slate-200 bg-white text-sm focus-visible:border-[#4267B2] focus-visible:ring-[#4267B2]/20";
  const labelClass = "mb-1.5 text-xs font-medium text-slate-600";

  return (
    <div className="min-h-[70vh] px-3 py-4 sm:px-4 lg:px-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
            <BookOpen className="h-5 w-5" style={{ color: primaryColor }} />
            {isEdit ? "Edit Journal Entry" : "New Journal Entry"}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Post balanced debit and credit lines from your Chart of Accounts
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          onClick={() => navigate("/app/account/journal-entries")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-medium text-slate-800">Entry details</p>
          </div>
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="reference_number" className={labelClass}>
                  Reference number <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="reference_number"
                    value={formData.reference_number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        reference_number: e.target.value,
                      })
                    }
                    placeholder="Auto-generated…"
                    required
                    readOnly={!isEdit}
                    className={`${fieldClass} ${!isEdit ? "bg-slate-50" : ""}`}
                  />
                  {!isEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0 border-slate-200 px-2.5 text-slate-600"
                      onClick={generateReferenceNumber}
                      title="Regenerate reference number"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {!isEdit && (
                  <p className="mt-1 text-xs text-slate-500">
                    Auto-generated (JE prefix)
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="currency" className={labelClass}>
                  Currency
                </Label>
                <UISelect
                  value={formData.currency}
                  disabled
                  onValueChange={(value) =>
                    setFormData({ ...formData, currency: value })
                  }
                >
                  <SelectTrigger className={fieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NGN">NGN (₦)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </UISelect>
              </div>
            </div>

            <div>
              <Label htmlFor="notes" className={labelClass}>
                Notes / narration <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional notes / narration…"
                rows={3}
                className="border-slate-200 bg-white text-sm focus-visible:border-[#4267B2] focus-visible:ring-[#4267B2]/20"
              />
            </div>

            {isEdit && formData.reference_number && (
              <div className="rounded-lg border border-[#4267B2]/20 bg-[var(--aa-sidebar-active,#eff4fb)] p-3">
                <p
                  className="mb-2 text-xs font-semibold"
                  style={{ color: primaryColor }}
                >
                  Journal entry summary
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div>
                    <span className="text-xs text-slate-500">Reference</span>
                    <p className="font-medium text-slate-800">
                      {formData.reference_number}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Status</span>
                    <p className="font-medium capitalize text-slate-800">
                      {formData.status || "Draft"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Total debit</span>
                    <p className="font-medium tabular-nums text-slate-800">
                      ₦{totals.totalDebit}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Total credit</span>
                    <p className="font-medium tabular-nums text-slate-800">
                      ₦{totals.totalCredit}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
            <div>
              <p className="text-sm font-medium text-slate-800">Line items</p>
              {accounts.length > 0 ? (
                <p className="mt-0.5 text-xs text-slate-500">
                  {accounts.length} accounts loaded from Chart of Accounts
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-amber-600">
                  Loading Chart of Accounts…
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <Checkbox
                  checked={isOpeningBalance}
                  onCheckedChange={(checked) => {
                    const on = Boolean(checked);
                    setIsOpeningBalance(on);
                    if (on && lines.length > 1) {
                      setLines([lines[0]]);
                    }
                  }}
                />
                <span className="font-medium">
                  Opening balance (auto-balance to equity)
                </span>
              </label>
              {isOpeningBalance && (
                <p className="text-xs text-slate-500">
                  Equity code:{" "}
                  <span className="font-semibold text-slate-700">
                    {activeBusiness?.opening_balance_equity
                      ? String(activeBusiness.opening_balance_equity)
                      : "Not set"}
                  </span>
                  {activeBusiness?.opening_balance_equity &&
                    accounts.length > 0 &&
                    !accounts.some(
                      (acc) =>
                        acc.code ===
                        String(activeBusiness.opening_balance_equity),
                    ) && (
                      <span className="ml-1 text-amber-600">
                        (not found in CoA)
                      </span>
                    )}
                </p>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addLine}
                disabled={isOpeningBalance}
                className="h-8 gap-1.5 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                Add line
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto p-3">
            <table className="w-full min-w-[960px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {[
                    ["w-[140px]", "Line date *"],
                    ["w-[280px]", "Account code (from CoA) *"],
                    ["w-[220px]", "Description"],
                    ["w-[130px]", "Debit (₦)"],
                    ["w-[130px]", "Credit (₦)"],
                    ["w-[200px]", "Supplier / customer"],
                    ["w-[48px]", ""],
                  ].map(([w, label]) => (
                    <th
                      key={label || "actions"}
                      className={`px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 ${w}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr
                    key={index}
                    className="border-b border-slate-100 align-top hover:bg-slate-50/70"
                  >
                    <td className="p-2">
                      <Input
                        type="date"
                        value={line.line_date || ""}
                        min={POSTING_DATE_MIN}
                        max={getPostingDateMax()}
                        onChange={(e) =>
                          updateLine(index, "line_date", e.target.value)
                        }
                        className={fieldClass}
                      />
                    </td>
                    <td className="p-2">
                      {accounts.length > 0 ? (
                        <Select
                          options={accounts.map((account) => ({
                            value: account.code,
                            label: `${account.code} - ${account.name}`,
                            account_type: account.type,
                            category: account.category,
                            ...account,
                          }))}
                          value={
                            line.account_code
                              ? {
                                  value: line.account_code,
                                  label: `${line.account_code} - ${
                                    line.account_name ||
                                    accounts.find(
                                      (acc) => acc.code === line.account_code,
                                    )?.name ||
                                    ""
                                  }`,
                                  account_type: accounts.find(
                                    (acc) => acc.code === line.account_code,
                                  )?.type,
                                  category: accounts.find(
                                    (acc) => acc.code === line.account_code,
                                  )?.category,
                                }
                              : null
                          }
                          onChange={(option) => {
                            if (option) {
                              updateLineAccount(index, option.value);
                            } else {
                              updateLine(index, "account_code", "");
                              updateLine(index, "account_name", "");
                            }
                          }}
                          formatOptionLabel={({
                            label,
                            account_type,
                            category,
                          }) => (
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm font-medium text-slate-800">
                                  {label}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {account_type}
                                  {category ? ` · ${category}` : ""}
                                </div>
                              </div>
                            </div>
                          )}
                          placeholder="Search accounts…"
                          isClearable
                          isSearchable
                          styles={customSelectStyles}
                          menuPortalTarget={document.body}
                          menuPosition="fixed"
                        />
                      ) : (
                        <div>
                          <Input
                            value={line.account_code}
                            onChange={(e) =>
                              updateLine(index, "account_code", e.target.value)
                            }
                            placeholder="Account code"
                            className={fieldClass}
                          />
                          <p className="mt-1 text-xs text-red-500">
                            No accounts found. Set up Chart of Accounts first.
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      <Input
                        type="text"
                        value={line.line_description || ""}
                        onChange={(e) =>
                          updateLine(index, "line_description", e.target.value)
                        }
                        placeholder="Optional"
                        className={fieldClass}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="text"
                        value={line.debit}
                        onChange={(e) =>
                          updateLine(index, "debit", e.target.value)
                        }
                        placeholder="0.00"
                        className={`${fieldClass} text-right tabular-nums`}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="text"
                        value={line.credit}
                        onChange={(e) =>
                          updateLine(index, "credit", e.target.value)
                        }
                        placeholder="0.00"
                        className={`${fieldClass} text-right tabular-nums`}
                      />
                    </td>
                    <td className="p-2">
                      {names.length > 0 ? (
                        <Select
                          options={getFilteredOptions(line.account_code)}
                          value={
                            line.number_id
                              ? getFilteredOptions(line.account_code).find(
                                  (item) => item.value === line.number_id,
                                ) || null
                              : null
                          }
                          onChange={(option) => {
                            const newLines = [...lines];
                            if (option) {
                              newLines[index].number_id = option.value;
                              newLines[index].supplier_customer_name =
                                option.name;
                              newLines[index].supplier_customer_type =
                                option.type;
                            } else {
                              newLines[index].number_id = null;
                              newLines[index].supplier_customer_name = "";
                              newLines[index].supplier_customer_type = "";
                            }
                            setLines(newLines);
                          }}
                          formatOptionLabel={({ label, type }) => (
                            <div className="text-sm font-medium text-slate-800">
                              {label} ({type})
                            </div>
                          )}
                          placeholder={
                            isARAccount(line.account_code)
                              ? "Select customer…"
                              : isAPAccount(line.account_code)
                                ? "Select supplier…"
                                : "Supplier / customer…"
                          }
                          isClearable
                          isSearchable
                          styles={customSelectStyles}
                          menuPortalTarget={document.body}
                          menuPosition="fixed"
                          isDisabled={!isARorAPAccount(line.account_code)}
                        />
                      ) : (
                        <Input
                          value=""
                          placeholder="Loading…"
                          className={`${fieldClass} bg-slate-50`}
                          disabled
                        />
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        onClick={() => removeLine(index)}
                        disabled={lines.length === 2 || isOpeningBalance}
                        title="Remove line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className={`mx-3 mb-3 rounded-lg border px-4 py-3 ${
              displayBalanced
                ? "border-[#4267B2]/20 bg-[var(--aa-sidebar-active,#eff4fb)]"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="text-center md:text-left">
                <div className="text-xs text-slate-500">Total debit</div>
                <div className="text-lg font-semibold tabular-nums text-slate-900">
                  ₦{totals.totalDebit}
                </div>
              </div>
              <div className="text-center md:text-left">
                <div className="text-xs text-slate-500">Total credit</div>
                <div className="text-lg font-semibold tabular-nums text-slate-900">
                  ₦{totals.totalCredit}
                </div>
              </div>
              <div className="text-center md:text-left">
                <div className="text-xs text-slate-500">Difference</div>
                <div
                  className={`text-lg font-semibold tabular-nums ${
                    displayBalanced ? "text-[#4267B2]" : "text-red-600"
                  }`}
                >
                  ₦{totals.difference}
                </div>
                <div
                  className={`mt-0.5 text-xs font-medium ${
                    displayBalanced ? "text-[#4267B2]" : "text-red-600"
                  }`}
                >
                  {displayBalanced ? "Balanced" : "Not balanced"}
                </div>
              </div>
            </div>
            {!displayBalanced && (
              <div className="mt-3 flex items-center gap-2 border-t border-red-200 pt-3 text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="text-xs font-medium">
                  Debits must equal credits before saving.
                </span>
              </div>
            )}
          </div>
        </div>

        {errors.length > 0 &&
          (!totals.balanced ||
            errors.some(
              (err) =>
                err.field === "reference_number" ||
                err.field === "entry_date" ||
                err.field === "notes" ||
                err.field?.includes("account_code"),
            )) && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <h4 className="mb-2 text-sm font-semibold text-red-800">
                Please fix the following errors:
              </h4>
              <ul className="list-inside list-disc space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="text-sm text-red-700">
                    {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-slate-200 bg-white text-slate-700"
            onClick={() => navigate("/app/account/journal-entries")}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={loading || (!totals.balanced && !isOpeningBalance)}
            className="h-8 gap-2 border-0 bg-[var(--aa-navy,#0f2744)] text-white shadow-none hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {loading ? "Saving…" : isEdit ? "Update" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default JournalEntryForm;
