import { useState, useEffect } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

// Custom styles for React Select to match app colors (#4267B2)
const customSelectStyles = {
  control: (provided, state) => ({
    ...provided,
    minHeight: "42px",
    borderColor: state.isFocused ? "#4267B2" : "#d1d5db",
    borderWidth: "1px",
    borderRadius: "0.5rem",
    boxShadow: state.isFocused ? "0 0 0 3px rgb(66 103 178 / 0.2)" : "none",
    backgroundColor: "white",
    fontSize: "14px",
    "&:hover": {
      borderColor: state.isFocused ? "#4267B2" : "#d1d5db",
    },
  }),
  valueContainer: (provided) => ({
    ...provided,
    padding: "0.25rem 0.75rem",
  }),
  input: (provided) => ({
    ...provided,
    margin: "0",
    padding: "0",
    color: "#111827",
    fontSize: "14px",
  }),
  placeholder: (provided) => ({
    ...provided,
    color: "#9ca3af",
    fontSize: "14px",
  }),
  singleValue: (provided) => ({
    ...provided,
    color: "#111827",
    fontSize: "14px",
  }),
  menu: (provided) => ({
    ...provided,
    zIndex: 9999,
    borderRadius: "0.5rem",
    border: "1px solid #d1d5db",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    marginTop: "0.25rem",
  }),
  menuList: (provided) => ({
    ...provided,
    padding: "0.25rem",
    maxHeight: "300px",
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? "#e6f0ff"
      : state.isFocused
      ? "#f3f4f6"
      : "white",
    color: state.isSelected ? "#4267B2" : "#374151",
    fontSize: "14px",
    padding: "10px 12px",
    cursor: "pointer",
    "&:active": {
      backgroundColor: "#e6f0ff",
    },
  }),
  indicatorSeparator: (provided) => ({
    ...provided,
    backgroundColor: "#d1d5db",
  }),
  dropdownIndicator: (provided, state) => ({
    ...provided,
    color: state.isFocused ? "#6b7280" : "#9ca3af",
    "&:hover": {
      color: "#6b7280",
    },
  }),
  clearIndicator: (provided) => ({
    ...provided,
    color: "#9ca3af",
    "&:hover": {
      color: "#6b7280",
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

  return (
    <div className="">
      <div>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle
              className="flex items-center gap-2"
              style={{ color: primaryColor }}
            >
              <BookOpen className="h-6 w-6" style={{ color: primaryColor }} />
              {isEdit ? "Edit Journal Entry" : "New Journal Entry"}
            </CardTitle>
            <Button
              variant="outline"
              onClick={() => navigate("/app/account/journal-entries")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Header Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="reference_number">Reference Number *</Label>
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
                    placeholder="Auto-generated..."
                    required
                    readOnly={!isEdit}
                    className={!isEdit ? "bg-gray-50" : ""}
                  />
                  {!isEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generateReferenceNumber}
                      size="sm"
                      title="Regenerate reference number"
                    >
                      ↻
                    </Button>
                  )}
                </div>
                {!isEdit && (
                  <p className="text-xs text-gray-500 mt-1">
                    Auto-generated from number generator (JE prefix)
                  </p>
                )}
              </div>

              {/* <div>
                <Label htmlFor="entry_date">Date</Label>
                <Input
                  id="entry_date"
                  type="date"
                  value={formData.entry_date}
                  onChange={(e) =>
                    setFormData({ ...formData, entry_date: e.target.value })
                  }
                required
                />
              </div> */}

              <div>
                <Label htmlFor="currency">Currency</Label>
                <UISelect
                  value={formData.currency}
                  disabled
                  onValueChange={(value) =>
                    setFormData({ ...formData, currency: value })
                  }
                >
                  <SelectTrigger>
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
              <Label htmlFor="notes">
                Notes/Narration <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional notes/narration..."
                rows={3}
              />
            </div>

            {/* Journal Entry Summary - Display when editing */}
            {isEdit && formData.reference_number && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4
                  className="text-sm font-semibold mb-3"
                  style={{ color: primaryColor }}
                >
                  Journal Entry Summary
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Reference:</span>
                    <p className="font-medium">{formData.reference_number}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <p className="font-medium capitalize">
                      {formData.status || "Draft"}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Debit:</span>
                    <p className="font-medium">₦{totals.totalDebit}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Credit:</span>
                    <p className="font-medium">₦{totals.totalCredit}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Line Items */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3
                    className="text-lg font-semibold"
                    style={{ color: primaryColor }}
                  >
                    Line Items
                  </h3>
                  {accounts.length > 0 ? (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ {accounts.length} accounts loaded from Chart of Accounts
                    </p>
                  ) : (
                    <p className="text-xs text-orange-600 mt-1">
                      ⚠ Loading Chart of Accounts...
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={isOpeningBalance}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsOpeningBalance(checked);
                        if (checked && lines.length > 1) {
                          // For opening balance, keep only the first line
                          setLines([lines[0]]);
                        }
                      }}
                    />
                    <span className="font-medium">
                      Opening balance (auto-balance to equity)
                    </span>
                  </label>
                  {isOpeningBalance && (
                    <div className="text-xs text-gray-600">
                      Equity code:{" "}
                      <span className="font-semibold">
                        {activeBusiness?.opening_balance_equity
                          ? String(activeBusiness.opening_balance_equity)
                          : "Not set"}
                      </span>
                      {activeBusiness?.opening_balance_equity &&
                        accounts.length > 0 &&
                        !accounts.some(
                          (acc) =>
                            acc.code ===
                            String(activeBusiness.opening_balance_equity)
                        ) && (
                          <span className="ml-2 text-orange-600">
                            (not found in Chart of Accounts)
                          </span>
                        )}
                    </div>
                  )}
                  <Button
                    type="button"
                    onClick={addLine}
                    variant="outline"
                    size="sm"
                    disabled={isOpeningBalance}
                    style={{
                      borderColor: primaryColor,
                      color: primaryColor,
                    }}
                    className="hover:bg-opacity-10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Line
                  </Button>
                </div>
              </div>
              {/* {JSON.stringify(names)  } */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border rounded-lg">
                  <thead style={{ backgroundColor: `${primaryColor}15` }}>
                    <tr>
                      <th
                        className="text-left p-3 font-medium border-b w-[140px]"
                        style={{ color: primaryColor }}
                      >
                        Line Date *
                      </th>
                      <th
                        className="text-left p-3 font-medium border-b w-[280px]"
                        style={{ color: primaryColor }}
                      >
                        Account Code (from CoA) *
                      </th>
                      <th
                        className="text-left p-3 font-medium border-b w-[240px]"
                        style={{ color: primaryColor }}
                      >
                        Description
                      </th>

                      <th
                        className="text-left p-3 font-medium border-b w-[140px]"
                        style={{ color: primaryColor }}
                      >
                        Debit (₦)
                      </th>
                      <th
                        className="text-left p-3 font-medium border-b w-[140px]"
                        style={{ color: primaryColor }}
                      >
                        Credit (₦)
                      </th>
                      {/* Conditionally show Supplier/Customer column header if any line has A/R or A/P */}

                      <th
                        className="text-left p-3 font-medium border-b w-[200px]"
                        style={{ color: primaryColor }}
                      >
                        Supplier/Customer
                      </th>

                      <th
                        className="text-center p-3 font-medium border-b w-[50px]"
                        style={{ color: primaryColor }}
                      ></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <Input
                            type="date"
                            value={line.line_date || ""}
                            min={POSTING_DATE_MIN}
                            max={getPostingDateMax()}
                            onChange={(e) =>
                              updateLine(index, "line_date", e.target.value)
                            }
                            className="w-full"
                          />
                        </td>
                        <td className="p-3">
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
                                      label: `${line.account_code} - ${line.account_name}`,
                                      account_type: accounts.find(
                                        (acc) => acc.code === line.account_code
                                      )?.type,
                                      category: accounts.find(
                                        (acc) => acc.code === line.account_code
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
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <div>
                                    <div className="font-medium text-sm">
                                      {label}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {account_type}{" "}
                                      {category && `• ${category}`}
                                    </div>
                                  </div>
                                </div>
                              )}
                              placeholder="Type to search accounts..."
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
                                  updateLine(
                                    index,
                                    "account_code",
                                    e.target.value
                                  )
                                }
                                placeholder="Account code"
                                className="w-full"
                              />
                              <p className="text-xs text-red-500 mt-1">
                                ⚠ No accounts found. Set up Chart of Accounts
                                first.
                              </p>
                            </div>
                          )}
                        </td>

                        <td className="p-3">
                          <Input
                            type="text"
                            value={line.line_description || ""}
                            onChange={(e) =>
                              updateLine(
                                index,
                                "line_description",
                                e.target.value
                              )
                            }
                            placeholder="Description (optional)"
                            className="w-full"
                          />
                        </td>

                        <td className="p-3">
                          <Input
                            type="text"
                            value={line.debit}
                            onChange={(e) =>
                              updateLine(index, "debit", e.target.value)
                            }
                            placeholder="0.00"
                            className="w-full text-right"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="text"
                            value={line.credit}
                            onChange={(e) =>
                              updateLine(index, "credit", e.target.value)
                            }
                            placeholder="0.00"
                            className="w-full text-right"
                          />
                        </td>

                        {/* Conditionally show Supplier/Customer cell only if account is A/R or A/P */}

                        <td className="p-3">
                          {names.length > 0 ? (
                            <Select
                              options={getFilteredOptions(line.account_code)}
                              value={
                                line.number_id
                                  ? getFilteredOptions(line.account_code).find(
                                      (item) => item.value === line.number_id
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
                                <div>
                                  <div className="font-medium text-sm">
                                    {label} ({type})
                                  </div>
                                </div>
                              )}
                              placeholder={
                                isARAccount(line.account_code)
                                  ? "Select customer..."
                                  : isAPAccount(line.account_code)
                                  ? "Select supplier..."
                                  : "supplier/customer..."
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
                              placeholder="Loading suppliers/customers..."
                              className="w-full bg-gray-50"
                              disabled
                            />
                          )}
                        </td>

                        <td className="p-3 text-center">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => removeLine(index)}
                            disabled={lines.length === 2 || isOpeningBalance}
                            title="Remove line"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div
                className={`mt-4 p-6 rounded-lg border-2 ${
                  displayBalanced
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
                style={{
                  borderColor: totals.balanced ? "#10b981" : "#ef4444",
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-1">
                      Total Debit
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      ₦{totals.totalDebit}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-1">
                      Total Credit
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      ₦{totals.totalCredit}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-1">Difference</div>
                    <div
                      className={`text-2xl font-bold ${
                        displayBalanced ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      ₦{totals.difference}
                    </div>
                    <div
                      className={`text-sm mt-1 font-medium ${
                        displayBalanced ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {displayBalanced ? "✓ Balanced" : "✗ Not Balanced"}
                    </div>
                  </div>
                </div>
                {!displayBalanced && (
                  <div className="mt-4 pt-4 border-t border-red-200 flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      Entry is not balanced. Debits must equal credits before
                      saving.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Error Messages - Only show if form has errors and is not balanced/valid */}
            {errors.length > 0 &&
              (!totals.balanced ||
                errors.some(
                  (err) =>
                    err.field === "reference_number" ||
                    err.field === "entry_date" ||
                    err.field === "notes" ||
                    err.field?.includes("account_code")
                )) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="text-red-800 font-semibold mb-2">
                    Please fix the following errors:
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    {errors.map((error, index) => (
                      <li key={index} className="text-red-700 text-sm">
                        {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Submit Buttons */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/app/account/journal-entries")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || (!totals.balanced && !isOpeningBalance)}
                className="flex items-center gap-2"
                style={{
                  backgroundColor: primaryColor,
                  borderColor: primaryColor,
                }}
              >
                <Save className="h-4 w-4" />
                {loading ? "Saving..." : isEdit ? "Update" : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </div>
    </div>
  );
};

export default JournalEntryForm;
