import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Eye,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import PropTypes from "prop-types";
import { formatNumber1 } from "@/components/router/utilities";
import {
  normalizeNigerianPhone,
  isValidNigerianPhone,
  NIGERIAN_PHONE_HINT,
} from "@/lib/nigerianPhone";

const CustomersUpload = ({ open, onClose, onUploadSuccess }) => {
  const { activeBusiness } = useSelector((state) => state.auth);
  const { user } = useSelector((state) => state.auth);
  const primaryColor = activeBusiness?.primary_color || "#1a2d5e";
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [branches, setBranches] = useState([]);
  const inputRef = React.createRef();

  useEffect(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/account/get/branches?facilityId=${activeBusiness.id}`,
      (res) => {
        if (res.success) setBranches(res.results || []);
      },
      (err) => console.error("Error fetching warehouses:", err)
    );
  }, [activeBusiness?.id]);

  // Resolve a branch name (from the uploaded file) to a branch id.
  const resolveBranchId = (branchName) => {
    if (!branchName) return null;
    const normalized = String(branchName).toLowerCase().trim();
    const match = branches.find(
      (b) => String(b.branch_name || "").toLowerCase().trim() === normalized
    );
    return match ? match.id : null;
  };

  const extractApiErrorMessage = (err) => {
    if (!err) return "An error occurred during upload!";
    if (typeof err === "string") return err;
    if (typeof err?.message === "string" && err.message.trim()) {
      return err.message;
    }
    if (typeof err?.error === "string" && err.error.trim()) {
      return err.error;
    }
    if (Array.isArray(err?.errors) && err.errors.length > 0) {
      return err.errors.join(", ");
    }
    return "An error occurred during upload!";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;

    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // Helper function to convert Excel serial date to YYYY-MM-DD format
  const convertExcelDate = (value) => {
    if (!value && value !== 0) return "";

    // If it's a Date object, format it directly
    if (value instanceof Date) {
      if (!isNaN(value.getTime())) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, "0");
        const day = String(value.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
      return "";
    }

    // If it's already a string in date format, try to parse it
    if (typeof value === "string") {
      // Check if it's already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return value.trim();
      }
      // Try to parse as date string
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
      // If it's a numeric string (Excel serial date as string), convert it
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue > 0) {
        return convertExcelSerialDate(numValue);
      }
      return value; // Return as-is if can't parse
    }

    // If it's a number (Excel serial date), convert it
    if (typeof value === "number" && value > 0) {
      return convertExcelSerialDate(value);
    }

    return "";
  };

  // Helper function to convert Excel serial date number to YYYY-MM-DD
  const convertExcelSerialDate = (serialDate) => {
    // Excel serial date starts from January 1, 1900
    // But Excel incorrectly treats 1900 as a leap year, so we need to adjust
    // Excel epoch is December 30, 1899
    const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
    const date = new Date(
      excelEpoch.getTime() + serialDate * 24 * 60 * 60 * 1000
    );

    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    return "";
  };

  // Get expected template columns for customers
  const getTemplateColumns = () => {
    return [
      "fullname",
      "address",
      "phone",
      "email",
      "branch",
      "receivable_code",
      "unearned_deposits_receivable_code",
      "credit_limit",
      "opening_balance",
      "opening_balance_date",
    ];
  };

  // Normalize column names (handle spaces, case differences)
  const normalizeColumnName = (name) => {
    if (!name) return name;
    return name
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  };

  // Column mapping with aliases (for data extraction)
  const getColumnMapping = () => {
    return {
      fullname: ["fullname", "full name", "name", "customer name"],
      address: ["address"],
      phone: ["phone", "phone number", "mobile", "contact"],
      email: ["email", "e-mail", "email address"],
      branch: [
        "branch",
        "branch_name",
        "branch name",
        "location",
        "warehouse",
        "branch/location",
      ],
      receivable_code: [
        "receivable_code",
        "receivable code",
        "receivable",
      ],
      unearned_deposits_receivable_code: [
        "unearned_deposits_receivable",
        "unearned deposits receivable",
        "unearned_deposits_receivable_code",
        "unearned deposits receivable code",
      ],
      credit_limit: ["credit_limit", "credit limit", "credit"],
      opening_balance: ["opening_balance", "opening balance", "opening"],
      opening_balance_date: [
        "opening_balance_date",
        "opening balance date",
        "opening date",
        "balance date",
      ],
    };
  };

  // Validate that uploaded file has correct columns matching template
  const validateFileColumns = (fileColumns, expectedColumns) => {
    // Remove empty columns
    const cleanedFileColumns = fileColumns.filter(
      (col) => col && col.trim() !== ""
    );

    const normalizedFileColumns = cleanedFileColumns.map((col) =>
      normalizeColumnName(col)
    );
    const columnMapping = getColumnMapping();

    const missingColumns = [];
    const extraColumns = [];
    const duplicateColumns = [];

    // Check for duplicate columns in uploaded file
    const columnCount = {};
    cleanedFileColumns.forEach((col, index) => {
      const normalized = normalizeColumnName(col);
      if (!columnCount[normalized]) {
        columnCount[normalized] = [];
      }
      columnCount[normalized].push({ original: col, index });
    });

    // Find duplicates
    Object.keys(columnCount).forEach((normalized) => {
      if (columnCount[normalized].length > 1) {
        duplicateColumns.push(
          `${columnCount[normalized][0].original} (appears ${columnCount[normalized].length} times)`
        );
      }
    });

    // Check for missing required columns (using alias mapping)
    const foundColumns = new Set();
    expectedColumns.forEach((expectedCol) => {
      const aliases = columnMapping[expectedCol] || [expectedCol];
      const found = normalizedFileColumns.some((fileCol) =>
        aliases.some((alias) => normalizeColumnName(alias) === fileCol)
      );
      if (!found) {
        missingColumns.push(expectedCol);
      } else {
        foundColumns.add(expectedCol);
      }
    });

    // Check for extra columns (columns not matching any expected column or alias)
    normalizedFileColumns.forEach((fileCol, index) => {
      let isExpected = false;
      for (const [target, aliases] of Object.entries(columnMapping)) {
        if (aliases.some((alias) => normalizeColumnName(alias) === fileCol)) {
          isExpected = true;
          break;
        }
      }
      if (!isExpected) {
        extraColumns.push(cleanedFileColumns[index]);
      }
    });

    // Check if we have the exact count of unique expected columns
    const uniqueFileColumns = [...new Set(normalizedFileColumns)];
    const hasExactColumnCount =
      foundColumns.size === expectedColumns.length &&
      uniqueFileColumns.length === expectedColumns.length;

    return {
      isValid:
        missingColumns.length === 0 &&
        duplicateColumns.length === 0 &&
        hasExactColumnCount,
      missingColumns,
      extraColumns,
      duplicateColumns,
      hasExactColumnCount,
    };
  };

  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {
            type: "array",
            cellDates: true, // Parse dates as JavaScript Date objects
            dateNF: "yyyy-mm-dd", // Date number format
          });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // Get headers first to validate columns
          const headerRow = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
          })[0];

          if (!headerRow || headerRow.length === 0) {
            throw new Error("Excel file has no header row");
          }

          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            raw: false, // Convert all values to strings/numbers
            defval: "", // Default value for empty cells
          });

          if (jsonData.length === 0) {
            throw new Error("Excel file is empty (no data rows)");
          }

          const expectedColumns = getTemplateColumns();

          // Validate columns match template
          const columnValidation = validateFileColumns(
            headerRow,
            expectedColumns
          );

          if (!columnValidation.isValid) {
            let errorMessage = `File columns do not match the template!\n\n`;

            if (columnValidation.missingColumns.length > 0) {
              errorMessage += `Missing required columns: ${columnValidation.missingColumns.join(
                ", "
              )}\n\n`;
            }

            if (columnValidation.duplicateColumns.length > 0) {
              errorMessage += `Duplicate columns found: ${columnValidation.duplicateColumns.join(
                ", "
              )}\n\n`;
            }

            if (columnValidation.extraColumns.length > 0) {
              errorMessage += `Extra columns found: ${columnValidation.extraColumns.join(
                ", "
              )}\n\n`;
            }

            if (!columnValidation.hasExactColumnCount) {
              errorMessage += `Column count mismatch. Expected ${
                expectedColumns.length
              } columns, found ${
                [
                  ...new Set(
                    headerRow.filter((col) => col && col.trim() !== "")
                  ),
                ].length
              } unique columns.\n\n`;
            }

            errorMessage += `Expected columns (${
              expectedColumns.length
            }):\n${expectedColumns.join(", ")}\n\n`;
            errorMessage += `Please download the correct template for customers and ensure columns match exactly.`;

            throw new Error(errorMessage);
          }

          // Map column names to normalized format (use the same mapping function)
          const columnMapping = getColumnMapping();

          // Normalize the data - only map known columns, ignore others
          const normalizedData = jsonData.map((row) => {
            const normalizedRow = {};
            const usedColumns = new Set();

            Object.keys(row).forEach((key) => {
              const normalizedKey = normalizeColumnName(key);
              // Find matching column in mapping - must be exact match
              let targetColumn = null;
              for (const [target, aliases] of Object.entries(columnMapping)) {
                if (
                  !usedColumns.has(target) &&
                  aliases.some(
                    (alias) => normalizeColumnName(alias) === normalizedKey
                  )
                ) {
                  targetColumn = target;
                  usedColumns.add(target);
                  break;
                }
              }
              // Only add mapped columns to normalizedRow
              // Ignore unmapped columns (like "active", "status", etc.)
              if (targetColumn) {
                let value = row[key];

                // Filter out "active" and other invalid values for numeric fields
                if (targetColumn === "credit_limit") {
                  const stringValue = String(value || "")
                    .toLowerCase()
                    .trim();
                  // Credit limit must be positive, so if value is "active" or other non-numeric text, set to 0
                  if (
                    stringValue === "active" ||
                    stringValue === "" ||
                    isNaN(parseFloat(value))
                  ) {
                    value = 0;
                  } else if (typeof value === "string") {
                    // Try to parse as number (credit limit should be positive)
                    const parsed = parseFloat(value);
                    value = isNaN(parsed) ? 0 : Math.max(0, parsed); // Ensure non-negative
                  }
                } else if (targetColumn === "opening_balance") {
                  const stringValue = String(value || "")
                    .toLowerCase()
                    .trim();
                  // Opening balance can be negative (customer owes you = positive, advance received = negative)
                  if (stringValue === "active" || stringValue === "") {
                    value = 0;
                  } else if (typeof value === "string") {
                    // Try to parse as number (allowing negative values)
                    const parsed = parseFloat(value);
                    value = isNaN(parsed) ? 0 : parsed; // Allow negative values
                  } else if (typeof value === "number") {
                    // Already a number, keep it (including negative)
                    value = isNaN(value) ? 0 : value;
                  }
                }

                // Convert Excel serial date to YYYY-MM-DD format for opening_balance_date
                if (targetColumn === "opening_balance_date") {
                  value = convertExcelDate(value);
                }

                // Map unearned_deposits_receivable_code to unearned_deposits_receivable for internal use
                if (targetColumn === "unearned_deposits_receivable_code") {
                  normalizedRow["unearned_deposits_receivable"] = value;
                } else {
                  normalizedRow[targetColumn] = value;
                }
              }
            });
            return normalizedRow;
          });

          // Check for required columns (customize as needed)
          const sampleRow = normalizedData[0];
          console.log("Original row keys:", Object.keys(jsonData[0]));
          console.log("Normalized sample row:", sampleRow);
          console.log("All normalized data:", normalizedData);

          // Debug: Check if 'active' appears in any field
          normalizedData.forEach((row, idx) => {
            Object.keys(row).forEach((key) => {
              if (String(row[key]).toLowerCase().includes("active")) {
                console.warn(
                  `Row ${
                    idx + 1
                  }: Found "active" in field "${key}" with value:`,
                  row[key]
                );
              }
            });
          });

          const requiredFields = ["fullname"];
          const missingFields = requiredFields.filter(
            (field) => !(field in sampleRow)
          );

          if (missingFields.length > 0) {
            throw new Error(
              `Missing required fields: ${missingFields.join(", ")}`
            );
          }
          resolve(normalizedData);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileUpload = async (file) => {
    setError(null);
    setUploadResult(null);
    setIsProcessing(true);
    setUploadProgress(0);

    try {
      // Step 1: Parse the Excel file
      setUploadProgress(20);
      const customers = await parseExcelFile(file);

      // Step 2: Validate data — fullname + valid Nigerian phone required
      setUploadProgress(40);
      const validCustomers = customers.filter(
        (customer) =>
          customer.fullname &&
          customer.fullname.trim() !== "" &&
          isValidNigerianPhone(customer.phone),
      );

      const invalidCount = customers.length - validCustomers.length;

      // Step 3: Enrich valid customers with business defaults
      const enrichedCustomers = validCustomers.map((customer) => ({
        ...customer,
        address: customer.address || null,
        email: customer.email || null,
        phone: normalizeNigerianPhone(customer.phone),
        branch: customer.branch || null,
        branch_id: resolveBranchId(customer.branch),
        receivable_code:
          customer.receivable_code || activeBusiness?.receivable_code,
        unearned_deposits_receivable:
          customer.unearned_deposits_receivable_code ||
          customer.unearned_deposits_receivable ||
          activeBusiness?.unearned_deposits_receivable,
        opening_balance_equity: activeBusiness?.opening_balance_equity,
      }));

      // Step 4: Show preview instead of uploading immediately
      setPreviewData({
        customers: enrichedCustomers,
        totalCustomers: customers.length,
        validCustomers: validCustomers.length,
        invalidCustomers: invalidCount,
        invalidRows: customers.filter(
          (customer) =>
            !customer.fullname ||
            customer.fullname.trim() === "" ||
            !isValidNigerianPhone(customer.phone),
        ),
        phoneHint: NIGERIAN_PHONE_HINT,
      });
      setShowPreview(true);
      setIsProcessing(false);
      setUploadProgress(0);
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || err.message || "Failed to process file";

      setIsProcessing(false);
      setUploadProgress(0);
      setError(null); // Clear any previous errors
      setPreviewData(null); // Clear preview data
      setShowPreview(false); // Hide preview

      // Show alert for column validation errors
      if (errorMessage.includes("columns do not match")) {
        // Extract the detailed message
        const lines = errorMessage.split("\n");
        const detailedMessage = lines.join("\n");

        // Show alert dialog
        alert(
          "❌ COLUMN VALIDATION FAILED\n\n" +
            detailedMessage +
            "\n\nPlease download the correct template and try again."
        );

        // Also show toast for visibility
        toast.error("Column validation failed. Please check the alert message.", {
          duration: 6000,
        });
      } else {
        // For other errors, show toast
        toast.error(errorMessage);
        setError(errorMessage);
      }

      // Clear file input
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleConfirmUpload = () => {
    if (!previewData) return;

    setIsProcessing(true);
    setUploadProgress(0);
    setShowPreview(false);

    // Step 3: Send to API
    setUploadProgress(60);

    _postApi(
      `/create-customer-upload`,

      {
        customers: previewData.customers.map((item) => ({
          fullname: item.fullname,
          address:
            item.address && item.address.trim() !== "" ? item.address : null,
          phone:
            item.phone && item.phone.trim() !== ""
              ? normalizeNigerianPhone(item.phone)
              : null,
          email: item.email && item.email.trim() !== "" ? item.email : null,
          branch_id: item.branch_id ?? resolveBranchId(item.branch),
          credit_limit: item.credit_limit || 0,
          opening_balance: item.opening_balance || 0,
          obdate: item.opening_balance_date || "",
          receivable_code: item.receivable_code,
          deposit_code: item.unearned_deposits_receivable,
          opening_balance_equity: activeBusiness?.opening_balance_equity,
        })),
        opening_balance_equity: activeBusiness?.opening_balance_equity,
        facilityId: activeBusiness?.id,
        created_by: user?.id,
      },
      (res) => {
        if (!res.success) {
          const errorMessage = extractApiErrorMessage(res);
          setError(errorMessage);
          toast.error(errorMessage);
          setIsProcessing(false);
          return;
        } else {
          toast.success("Customers uploaded successfully");
          setUploadResult({
            totalCustomers: previewData.totalCustomers,
            importedCustomers: previewData.validCustomers,
            invalidCustomers: previewData.invalidCustomers,
            errors:
              previewData.invalidCustomers > 0
                ? [
                    `${previewData.invalidCustomers} customers were skipped due to missing required fields`,
                  ]
                : [],
          });
          setPreviewData(null);
          // Call onUploadSuccess callback to reload customer table
          if (onUploadSuccess) {
            onUploadSuccess();
          }
          onClose();
        }
        setUploadProgress(100);
        setIsProcessing(false);
      },
      (err) => {
        const errorMessage = extractApiErrorMessage(err);
        console.error("Customer upload failed:", err);
        setError(errorMessage);
        toast.error(errorMessage);
        setIsProcessing(false);
      }
    );
  };

  const handleCancelPreview = () => {
    setPreviewData(null);
    setShowPreview(false);
    setError(null);
    setUploadProgress(0);
    // Reset file input
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const clearResults = () => {
    setUploadResult(null);
    setError(null);
    setUploadProgress(0);
    setPreviewData(null);
    setShowPreview(false);
    setCurrentPage(1);
    // Reset file input
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    if (onClose) onClose();
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-[var(--aa-navy)] text-white p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    {showPreview ? (
                      <>
                        <Eye className="h-5 w-5" />
                        Preview Customers
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5" />
                        Upload Customers
                      </>
                    )}
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">
                    {showPreview
                      ? "Review customer data before uploading"
                      : "Upload customer data from Excel or CSV file"}
                  </p>
                </div>
                <button
                  onClick={clearResults}
                  className="p-1.5 hover:bg-white/20 rounded transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-6 flex-1 overflow-y-auto">
                {!showPreview && (
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragging
                        ? "border-[var(--aa-accent)] bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <FileText className="h-12 w-12 text-gray-400" />
                      </div>

                      <div>
                        <h3 className="text-lg font-medium">
                          Upload your customer data
                        </h3>
                        <p className="text-gray-500 mt-1">
                          Drag and drop your Excel file here, or click to browse
                        </p>
                        <p className="text-sm text-gray-400 mt-2">
                          Supports Excel files (.xlsx, .xls, .csv)
                        </p>
                      </div>

                      <div className="flex justify-center ">
                        <label className="cursor-pointer">
                          <Button
                            className="flex items-center gap-2"
                            onClick={() => inputRef.current.click()}
                            style={{
                              backgroundColor: primaryColor,
                              color: "#ffffff",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                primaryColor + "DD")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                primaryColor)
                            }
                          >
                            <Upload className="h-4 w-4" />
                            Choose File
                          </Button>
                          <input
                            type="file"
                            ref={inputRef}
                            className="hidden"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileInputChange}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview Section */}
                {showPreview && previewData && (
                  <div className="mt-4 space-y-4">
                    <Alert>
                      <Eye className="h-4 w-4" />
                      <AlertDescription>
                        Review the customer data before uploading.{" "}
                        {previewData.validCustomers} valid customer(s) will be
                        imported from {previewData.totalCustomers} total row(s).
                        {previewData.invalidCustomers > 0 && (
                          <span className="block mt-1 text-orange-600">
                            {previewData.invalidCustomers} row(s) will be
                            skipped due to missing required fields.
                          </span>
                        )}
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {previewData.validCustomers}
                            </div>
                            <div className="text-sm text-gray-600">
                              Valid Customers
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {previewData.totalCustomers}
                            </div>
                            <div className="text-sm text-gray-600">
                              Total Records
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">
                              {previewData.invalidCustomers}
                            </div>
                            <div className="text-sm text-gray-600">
                              Will Be Skipped
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Preview Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                        <h4 className="font-semibold text-sm">Preview Data</h4>
                        <span className="text-xs text-gray-600">
                          Total: {previewData.customers.length} customers
                        </span>
                      </div>
                      <div className="overflow-x-auto max-h-96">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>Full Name</TableHead>
                              <TableHead>Address</TableHead>
                              <TableHead>Phone</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Warehouse</TableHead>
                              <TableHead>Receivable Code</TableHead>
                              <TableHead>
                                Unearned Deposits Receivable
                              </TableHead>
                              <TableHead>Credit Limit</TableHead>
                              <TableHead>Opening Balance</TableHead>
                              <TableHead>Opening Balance Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewData.customers
                              .slice(
                                (currentPage - 1) * itemsPerPage,
                                currentPage * itemsPerPage
                              )
                              .map((customer, index) => {
                                const globalIndex =
                                  (currentPage - 1) * itemsPerPage + index;
                                return (
                                  <TableRow key={globalIndex}>
                                    <TableCell className="font-medium">
                                      {globalIndex + 1}
                                    </TableCell>
                                    <TableCell>
                                      {customer.fullname || "-"}
                                    </TableCell>
                                    <TableCell>
                                      {customer.address || "-"}
                                    </TableCell>
                                    <TableCell>
                                      {customer.phone || "-"}
                                    </TableCell>
                                    <TableCell>
                                      {customer.email || "-"}
                                    </TableCell>
                                    <TableCell
                                      className={
                                        customer.branch && !customer.branch_id
                                          ? "text-orange-600"
                                          : ""
                                      }
                                    >
                                      {customer.branch || "-"}
                                    </TableCell>
                                    <TableCell>
                                      {customer.receivable_code || "-"}
                                    </TableCell>
                                    <TableCell>
                                      {customer.unearned_deposits_receivable ||
                                        "-"}
                                    </TableCell>
                                    <TableCell>
                                      {formatNumber1(customer.credit_limit)}
                                    </TableCell>
                                    <TableCell>
                                      {formatNumber1(customer.opening_balance)}
                                    </TableCell>
                                    <TableCell>
                                      {customer.opening_balance_date || "-"}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </div>
                      {/* Pagination Controls */}
                      {previewData.customers.length > itemsPerPage && (
                        <div className="bg-gray-50 px-4 py-3 border-t flex justify-between items-center">
                          <div className="text-sm text-gray-600">
                            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                            {Math.min(
                              currentPage * itemsPerPage,
                              previewData.customers.length
                            )}{" "}
                            of {previewData.customers.length} customers
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setCurrentPage((prev) => Math.max(1, prev - 1))
                              }
                              disabled={currentPage === 1}
                              style={{
                                borderColor: primaryColor,
                                color: primaryColor,
                              }}
                              onMouseEnter={(e) => {
                                if (currentPage !== 1) {
                                  e.currentTarget.style.backgroundColor =
                                    primaryColor + "15";
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                              }}
                            >
                              <ChevronLeft className="h-4 w-4" />
                              Previous
                            </Button>
                            <span className="text-sm text-gray-600 px-2">
                              Page {currentPage} of{" "}
                              {Math.ceil(
                                previewData.customers.length / itemsPerPage
                              )}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setCurrentPage((prev) =>
                                  Math.min(
                                    Math.ceil(
                                      previewData.customers.length /
                                        itemsPerPage
                                    ),
                                    prev + 1
                                  )
                                )
                              }
                              disabled={
                                currentPage >=
                                Math.ceil(
                                  previewData.customers.length / itemsPerPage
                                )
                              }
                              style={{
                                borderColor: primaryColor,
                                color: primaryColor,
                              }}
                              onMouseEnter={(e) => {
                                if (
                                  currentPage <
                                  Math.ceil(
                                    previewData.customers.length / itemsPerPage
                                  )
                                ) {
                                  e.currentTarget.style.backgroundColor =
                                    primaryColor + "15";
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                              }}
                            >
                              Next
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Invalid Rows (if any) */}
                    {previewData.invalidRows.length > 0 && (
                      <div className="border rounded-lg overflow-hidden border-orange-200">
                        <div className="bg-orange-50 px-4 py-2 border-b border-orange-200">
                          <h4 className="font-semibold text-sm text-orange-800">
                            Invalid Rows (Will Be Skipped)
                          </h4>
                        </div>
                        <div className="overflow-x-auto max-h-48">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>Full Name</TableHead>
                                <TableHead>Address</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Warehouse</TableHead>
                                <TableHead>Receivable Code</TableHead>
                                <TableHead>
                                  Unearned Deposits Receivable
                                </TableHead>
                                <TableHead>Credit Limit</TableHead>
                                <TableHead>Opening Balance</TableHead>
                                <TableHead>Opening Balance Date</TableHead>
                                <TableHead>Issue</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {previewData.invalidRows
                                .slice(0, 5)
                                .map((customer, index) => {
                                  const issues = [];
                                  if (
                                    !customer.fullname ||
                                    customer.fullname.trim() === ""
                                  )
                                    issues.push("Missing name");
                                  return (
                                    <TableRow key={index}>
                                      <TableCell className="font-medium">
                                        {index + 1}
                                      </TableCell>
                                      <TableCell
                                        className={
                                          !customer.fullname
                                            ? "text-red-600"
                                            : ""
                                        }
                                      >
                                        {customer.fullname || "-"}
                                      </TableCell>
                                      <TableCell>
                                        {customer.address || "-"}
                                      </TableCell>
                                      <TableCell
                                        className={
                                          !customer.phone ? "text-red-600" : ""
                                        }
                                      >
                                        {customer.phone || "-"}
                                      </TableCell>
                                      <TableCell
                                        className={
                                          !customer.email ? "text-red-600" : ""
                                        }
                                      >
                                        {customer.email || "-"}
                                      </TableCell>
                                      <TableCell>
                                        {customer.branch || "-"}
                                      </TableCell>
                                      <TableCell>
                                        {customer.receivable_code || "-"}
                                      </TableCell>
                                      <TableCell>
                                        {customer.unearned_deposits_receivable ||
                                          "-"}
                                      </TableCell>
                                      <TableCell>
                                        {formatNumber1(customer.credit_limit)}
                                      </TableCell>
                                      <TableCell>
                                        {formatNumber1(
                                          customer.opening_balance
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {customer.opening_balance_date || "-"}
                                      </TableCell>
                                      <TableCell className="text-red-600 text-sm">
                                        {issues.join(", ")}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                        </div>
                        {previewData.invalidRows.length > 5 && (
                          <div className="bg-orange-50 px-4 py-2 text-sm text-orange-700 text-center border-t border-orange-200">
                            Showing first 5 of {previewData.invalidRows.length}{" "}
                            invalid rows
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button variant="outline" onClick={handleCancelPreview}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        onClick={handleConfirmUpload}
                        style={{
                          backgroundColor: primaryColor,
                          color: "#ffffff",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            primaryColor + "DD")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = primaryColor)
                        }
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Confirm & Upload
                      </Button>
                    </div>
                  </div>
                )}

                {/* Upload Progress */}
                {isProcessing && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Processing file...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress
                      value={uploadProgress}
                      className="w-full"
                      color={primaryColor}
                    />
                  </div>
                )}

                {/* Error Display - Only show non-column validation errors */}
                {error && !error.includes("columns do not match") && (
                  <Alert className="mt-4" variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="whitespace-pre-line font-medium">
                        {error}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Success Results */}
                {uploadResult && (
                  <div className="mt-4 space-y-4">
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        File processed successfully! Imported{" "}
                        {uploadResult.importedCustomers} customers from{" "}
                        {uploadResult.totalCustomers} rows.
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {uploadResult.importedCustomers}
                            </div>
                            <div className="text-sm text-gray-600">
                              Customers Imported
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {uploadResult.totalCustomers}
                            </div>
                            <div className="text-sm text-gray-600">
                              Total Records
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">
                              {uploadResult.invalidCustomers}
                            </div>
                            <div className="text-sm text-gray-600">Skipped</div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {uploadResult.errors.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium text-red-600 mb-2">
                          Processing Notices:
                        </h4>
                        <div className="bg-red-50 rounded p-3 max-h-32 overflow-y-auto">
                          {uploadResult.errors.map((error, index) => (
                            <div key={index} className="text-sm text-red-700">
                              {error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={clearResults}
                        className="flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Close
                      </Button>
                      <Button
                        onClick={clearResults}
                        style={{
                          backgroundColor: primaryColor,
                          color: "#ffffff",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            primaryColor + "DD")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = primaryColor)
                        }
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                )}
                <div className="text-center mt-4">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        const baseUrl = (import.meta.env.BASE_URL || "/").replace(
                          /\/?$/,
                          "/"
                        );
                        const templatePath = `${baseUrl}templates/customers-template.csv`;
                        const response = await fetch(templatePath);

                        let csvContent;
                        if (response.ok) {
                          csvContent = await response.text();
                        } else {
                          // Fallback: generate template from expected columns
                          const cols = getTemplateColumns();
                          csvContent = [
                            cols.join(","),
                            "Test Customer,No 12 Zaria Road Kano,07012345678,customer@gmail.com,Main Warehouse,1205101,1205100,500000,150000,2025-01-01",
                          ].join("\n");
                        }

                        const blob = new Blob([csvContent], {
                          type: "text/csv;charset=utf-8;",
                        });
                        const link = document.createElement("a");
                        const url = URL.createObjectURL(blob);
                        link.href = url;
                        link.download = "customers-template.csv";
                        link.style.display = "none";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        toast.success("Template downloaded");
                      } catch (error) {
                        console.error("Error downloading template:", error);
                        // Fallback: generate minimal template
                        try {
                          const cols = getTemplateColumns();
                          const csvContent = [
                            cols.join(","),
                            "Test Customer,No 12 Zaria Road Kano,07012345678,customer@gmail.com,Main Warehouse,1205101,1205100,500000,150000,2025-01-01",
                          ].join("\n");
                          const blob = new Blob([csvContent], {
                            type: "text/csv;charset=utf-8;",
                          });
                          const link = document.createElement("a");
                          link.href = URL.createObjectURL(blob);
                          link.download = "customers-template.csv";
                          link.click();
                          URL.revokeObjectURL(link.href);
                          toast.success("Template downloaded");
                        } catch {
                          toast.error("Failed to download template file");
                        }
                      }
                    }}
                    style={{
                      borderColor: primaryColor,
                      color: primaryColor,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        primaryColor + "15";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    Download Template
                  </Button>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="border-t bg-gray-50 p-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={clearResults}
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
                  disabled={isProcessing}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

CustomersUpload.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onUploadSuccess: PropTypes.func,
};
export default CustomersUpload;
