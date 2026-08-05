import React, { useRef, useState } from "react";
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
  Download,
  Eye,
  ArrowLeft,
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
import { apiURL } from "@/redux/actions/api";
import { toast } from "sonner";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { accountTypes } from "@/lib/utils";
import { formatNumber1 } from "@/components/router/utilities";

const TEMPLATE_COLUMNS = [
  "Bank Name",
  "Code",
  "Account Number",
  "Account Type",
  "Opening Balance",
  "Opening Balance Date",
];

const TEMPLATE_FILENAME = "bank-accounts-template.csv";

const stripBom = (value) =>
  String(value ?? "")
    .replace(/^\ufeff/, "")
    .trim();
const normalizeColumnName = (name) => {
  const cleaned = stripBom(name);
  if (!cleaned) return cleaned;
  return cleaned
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
};

// Accept either the account type code ("20") or title ("Current Account")
const resolveAccountTypeCode = (value) => {
  if (value === "" || value === null || value === undefined) return "";
  const str = String(value).trim();
  const byCode = accountTypes.find((t) => String(t.code) === str);
  if (byCode) return byCode.code;
  const byTitle = accountTypes.find(
    (t) => t.title.toLowerCase() === str.toLowerCase()
  );
  if (byTitle) return byTitle.code;
  return "";
};

const BankAccountsUpload = ({ open, onClose, onUploadSuccess }) => {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const inputRef = useRef(null);
  const primaryColor = activeBusiness?.primary_color || "#4267B2";

  const convertExcelDate = (value) => {
    if (!value && value !== 0) return "";
    if (value instanceof Date && !isNaN(value.getTime())) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (ddmmyyyy) {
        return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, "0")}-${ddmmyyyy[1].padStart(2, "0")}`;
      }
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
      const num = parseFloat(trimmed);
      if (!isNaN(num) && num > 0) return convertExcelSerialDate(num);
      return "";
    }
    if (typeof value === "number" && value > 0) {
      return convertExcelSerialDate(value);
    }
    return "";
  };

  const convertExcelSerialDate = (serial) => {
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    return "";
  };

  const buildTemplateCsv = () =>
    [
      TEMPLATE_COLUMNS.join(","),
      "GTBank Main,10101,0123456789,Current Account,500000,2025-12-01",
      "Zenith Operations,10102,0987654321,Savings Account,250000,2025-12-01",
    ].join("\n");

  const downloadCsv = (csvContent, filename) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateTemplate = async () => {
    try {
      const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
      const response = await fetch(`${baseUrl}templates/${TEMPLATE_FILENAME}`);
      const csvContent = response.ok
        ? await response.text()
        : buildTemplateCsv();
      downloadCsv(csvContent, TEMPLATE_FILENAME);
      toast.success("Template downloaded");
    } catch (err) {
      console.error("Error downloading template:", err);
      try {
        downloadCsv(buildTemplateCsv(), TEMPLATE_FILENAME);
        toast.success("Template downloaded");
      } catch {
        toast.error("Failed to download template file");
      }
    }
  };

  const validateFileColumns = (fileColumns) => {
    const cleaned = fileColumns.filter((c) => c && c.trim() !== "");
    const normalizedFile = cleaned.map(normalizeColumnName);
    const normalizedExpected = TEMPLATE_COLUMNS.map(normalizeColumnName);

    const missingColumns = [];
    normalizedExpected.forEach((col, idx) => {
      if (!normalizedFile.includes(col)) missingColumns.push(TEMPLATE_COLUMNS[idx]);
    });

    return { isValid: missingColumns.length === 0, missingColumns };
  };

  const parseExcelFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {
            type: "array",
            cellDates: true,
            dateNF: "yyyy-mm-dd",
          });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const headerRow = (
            XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              defval: "",
            })[0] || []
          ).map(stripBom);

          if (!headerRow || headerRow.length === 0) {
            throw new Error("File has no header row");
          }

          const jsonData = XLSX.utils.sheet_to_json(sheet, {
            raw: false,
            defval: "",
          });

          if (jsonData.length === 0) {
            throw new Error("File is empty (no data rows)");
          }

          const columnValidation = validateFileColumns(headerRow);
          if (!columnValidation.isValid) {
            throw new Error(
              `File columns do not match the template!\n\nMissing required columns: ${columnValidation.missingColumns.join(
                ", "
              )}\n\nExpected columns:\n${TEMPLATE_COLUMNS.join(", ")}`
            );
          }

          const columnMapping = {};
          TEMPLATE_COLUMNS.forEach((col) => {
            columnMapping[normalizeColumnName(col)] = col;
          });

          const normalized = jsonData.map((row) => {
            const out = {};
            Object.keys(row).forEach((key) => {
              const nk = normalizeColumnName(stripBom(key));
              if (columnMapping[nk]) {
                let value = row[key];
                if (nk.includes("date")) value = convertExcelDate(value);
                if (nk === "opening_balance") {
                  if (value === "" || value === null || value === undefined) {
                    value = "";
                  } else {
                    const num = parseFloat(value);
                    value = isNaN(num) ? "" : num;
                  }
                }
                out[columnMapping[nk]] = value;
              }
            });
            return out;
          });

          resolve(normalized);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });

  const validateRow = (row) => {
    const obal = parseFloat(row["Opening Balance"]) || 0;
    const dateOk = obal !== 0 ? Boolean(row["Opening Balance Date"]) : true;
    return (
      row["Bank Name"] &&
      row["Code"] !== "" &&
      row["Code"] != null &&
      row["Account Number"] &&
      resolveAccountTypeCode(row["Account Type"]) &&
      dateOk
    );
  };

  const rowIssues = (row) => {
    const issues = [];
    if (!row["Bank Name"]) issues.push("Missing Bank Name");
    if (row["Code"] === "" || row["Code"] == null)
      issues.push("Missing Code");
    if (!row["Account Number"]) issues.push("Missing Account Number");
    if (!resolveAccountTypeCode(row["Account Type"]))
      issues.push("Invalid/Missing Account Type");
    if (
      (parseFloat(row["Opening Balance"]) || 0) !== 0 &&
      !row["Opening Balance Date"]
    ) {
      issues.push("Missing Opening Balance Date");
    }
    return issues;
  };

  const mapRow = (row) => ({
    account_name: row["Bank Name"] || "",
    bank_name: row["Bank Name"] || "",
    head: String(row["Code"] ?? "").trim(),
    account_number: String(row["Account Number"] ?? "").trim(),
    account_bank_type: resolveAccountTypeCode(row["Account Type"]),
    account_type_title:
      accountTypes.find(
        (t) => t.code === resolveAccountTypeCode(row["Account Type"])
      )?.title || row["Account Type"] || "",
    opening_balance: parseFloat(row["Opening Balance"]) || 0,
    opening_balance_date: row["Opening Balance Date"] || "",
  });

  const handleFileUpload = async (file) => {
    setError(null);
    setUploadResult(null);
    setIsProcessing(true);
    setUploadProgress(20);

    try {
      const rows = await parseExcelFile(file);
      setUploadProgress(40);

      const validRows = rows.filter(validateRow);
      const invalidRows = rows.filter((r) => !validateRow(r));

      setPreviewData({
        rows: validRows.map(mapRow),
        rawValidRows: validRows,
        totalRows: rows.length,
        validRows: validRows.length,
        invalidRows,
      });
      setShowPreview(true);
      setIsProcessing(false);
      setUploadProgress(0);
    } catch (err) {
      const message = err.message || "Failed to process file";
      setIsProcessing(false);
      setUploadProgress(0);
      setPreviewData(null);
      setShowPreview(false);

      if (message.includes("columns do not match")) {
        alert("❌ COLUMN VALIDATION FAILED\n\n" + message);
        toast.error("Column validation failed. Please check the alert message.");
      } else {
        toast.error(message);
        setError(message);
      }
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const extractApiErrorMessage = (err) => {
    if (!err) return "An error occurred during upload!";
    if (typeof err === "string") return err;
    if (typeof err?.message === "string" && err.message.trim()) return err.message;
    return "An error occurred during upload!";
  };

  const handleConfirmUpload = async () => {
    if (!previewData || previewData.rows.length === 0) {
      toast.error("No bank accounts to upload");
      return;
    }

    const facilityId = activeBusiness?.id;
    const userId = user?.id || user?.facilityId;
    if (!facilityId || !userId) {
      toast.error("Missing facility ID or user ID");
      return;
    }

    setIsProcessing(true);
    setShowPreview(false);
    setUploadProgress(40);

    const payload = previewData.rows.map((row) => ({
      account_name: row.account_name,
      bank_name: row.bank_name,
      head: row.head,
      account_number: row.account_number,
      account_bank_type: row.account_bank_type,
      bank_code: "",
      opening_balance: row.opening_balance,
      opening_balance_date: row.opening_balance_date,
      facilityId,
      user_id: userId,
      opening_balance_equity: activeBusiness?.opening_balance_equity,
      currency: "NGN",
    }));

    setUploadProgress(70);

    try {
      const token = localStorage.getItem("@@__token");
      const response = await fetch(`${apiURL}/api/bulk/bank-accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: token || "",
        },
        body: JSON.stringify(payload),
      });
      const res = await response.json();
      setUploadProgress(90);

      if (!response.ok || !res.success) {
        toast.error(res.message || "Upload failed");
        setIsProcessing(false);
        setUploadProgress(0);
        return;
      }

      const successCount = res.summary?.created ?? previewData.validRows;
      const failedCount = res.summary?.failed ?? 0;

      toast.success(
        `${successCount} bank account(s) uploaded successfully${
          failedCount > 0 ? `, ${failedCount} failed` : ""
        }`,
      );

      setUploadResult({
        totalRows: previewData.totalRows,
        imported: successCount,
        skipped: failedCount + previewData.invalidRows.length,
        errors:
          res.data?.failed?.map(
            (f) => `Row ${f.index} (${f.name}): ${f.error}`,
          ) ||
          (previewData.invalidRows.length > 0
            ? [
                `${previewData.invalidRows.length} row(s) skipped due to missing required fields`,
              ]
            : []),
      });

      setPreviewData(null);
      setUploadProgress(100);
      if (onUploadSuccess) onUploadSuccess();
      setIsProcessing(false);
    } catch (err) {
      console.error("Bank account upload error:", err);
      toast.error(extractApiErrorMessage(err));
      setIsProcessing(false);
      setUploadProgress(0);
    }
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
    if (files.length > 0) handleFileUpload(files[0]);
  };
  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) handleFileUpload(files[0]);
  };

  const handleCancelPreview = () => {
    setPreviewData(null);
    setShowPreview(false);
    setError(null);
    setUploadProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const clearResults = () => {
    setUploadResult(null);
    setError(null);
    setUploadProgress(0);
    setPreviewData(null);
    setShowPreview(false);
    if (inputRef.current) inputRef.current.value = "";
    if (onClose) onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Bank Accounts
              </h3>
              <p className="text-blue-100 text-sm mt-1">
                {showPreview
                  ? "Review bank account data before uploading"
                  : "Bulk import bank accounts with opening balances"}
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

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-6 flex-1 overflow-y-auto">
            {showPreview && previewData ? (
              <div className="space-y-4">
                <Alert>
                  <Eye className="h-4 w-4" />
                  <AlertDescription>
                    Review the data before uploading. {previewData.validRows}{" "}
                    valid account(s) will be imported from{" "}
                    {previewData.totalRows} total row(s).
                    {previewData.invalidRows.length > 0 && (
                      <span className="block mt-1 text-orange-600">
                        {previewData.invalidRows.length} row(s) will be skipped
                        due to missing required fields.
                      </span>
                    )}
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {previewData.validRows}
                        </div>
                        <div className="text-sm text-gray-600">
                          Valid Accounts
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {previewData.totalRows}
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
                          {previewData.invalidRows.length}
                        </div>
                        <div className="text-sm text-gray-600">
                          Will Be Skipped
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b">
                    <h4 className="font-semibold text-sm">Preview Data</h4>
                  </div>
                  <div className="overflow-x-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Bank Name</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Account Number</TableHead>
                          <TableHead>Account Type</TableHead>
                          <TableHead className="text-right">
                            Opening Balance
                          </TableHead>
                          <TableHead>Opening Balance Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.rows.map((row, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {index + 1}
                            </TableCell>
                            <TableCell>{row.account_name || "-"}</TableCell>
                            <TableCell>{row.head || "-"}</TableCell>
                            <TableCell>{row.account_number || "-"}</TableCell>
                            <TableCell>{row.account_type_title || "-"}</TableCell>
                            <TableCell className="text-right">
                              {formatNumber1(row.opening_balance || 0)}
                            </TableCell>
                            <TableCell>
                              {row.opening_balance_date || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

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
                            {TEMPLATE_COLUMNS.map((col) => (
                              <TableHead key={col}>{col}</TableHead>
                            ))}
                            <TableHead>Issue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.invalidRows
                            .slice(0, 5)
                            .map((row, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">
                                  {index + 1}
                                </TableCell>
                                {TEMPLATE_COLUMNS.map((col) => (
                                  <TableCell key={col}>
                                    {row[col] !== "" && row[col] != null
                                      ? String(row[col])
                                      : "-"}
                                  </TableCell>
                                ))}
                                <TableCell className="text-red-600 text-sm">
                                  {rowIssues(row).join(", ")}
                                </TableCell>
                              </TableRow>
                            ))}
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

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleCancelPreview}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmUpload}
                    style={{ backgroundColor: primaryColor, color: "#ffffff" }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm & Upload
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Download the template, fill it with your bank accounts, then
                    upload. The <strong>Code</strong> column is the GL Account
                    Head (chart-of-accounts code) the opening balance posts to.
                  </AlertDescription>
                </Alert>

                <div className="flex justify-center">
                  <Button
                    onClick={generateTemplate}
                    className="flex items-center gap-2 bg-[#4267B2] hover:bg-[#36549B]"
                  >
                    <Download className="h-4 w-4" />
                    Download Template
                  </Button>
                </div>

                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging
                      ? "border-blue-500 bg-blue-50"
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
                        Upload your bank accounts
                      </h3>
                      <p className="text-gray-500 mt-1">
                        Drag and drop your Excel file here, or click to browse
                      </p>
                      <p className="text-sm text-gray-400 mt-2">
                        Supported files (.xlsx, .xls, .csv)
                      </p>
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="file"
                        ref={inputRef}
                        className="hidden"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileInputChange}
                      />
                      <Button
                        type="button"
                        className="flex items-center gap-2 bg-[#4267B2] hover:bg-[#36549B]"
                        onClick={() => inputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        Choose File
                      </Button>
                    </div>
                  </div>
                </div>

                {isProcessing && !showPreview && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Processing file...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="w-full" />
                  </div>
                )}

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

                {uploadResult && !showPreview && (
                  <div className="mt-4 space-y-4">
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        File processed successfully! Imported{" "}
                        {uploadResult.imported} account(s) from{" "}
                        {uploadResult.totalRows} rows.
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {uploadResult.imported}
                            </div>
                            <div className="text-sm text-gray-600">
                              Imported
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {uploadResult.totalRows}
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
                              {uploadResult.skipped}
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
                          {uploadResult.errors.map((err, idx) => (
                            <div key={idx} className="text-sm text-red-700">
                              {err}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={clearResults}
                        className="bg-[#4267B2] hover:bg-[#36549B]"
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

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
  );
};

BankAccountsUpload.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onUploadSuccess: PropTypes.func,
};

export default BankAccountsUpload;
