import React, { useRef, useState } from "react";
import { useSelector } from "react-redux";
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const VALID_STATUSES = ["Present", "Absent", "Late", "Half Day", "On Leave"];

const normalizeEmployeeCode = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const formatExcelDate = (value) => {
  if (value == null || value === "") return "";
  if (typeof value === "number" && XLSX.SSF?.parse_date_code) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const y = parsed.y;
      const m = String(parsed.m).padStart(2, "0");
      const d = String(parsed.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  const str = String(value).trim();
  const slash = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (slash) {
    return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
  }
  return str;
};

const AttendanceBulkUpload = () => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId;
  const primaryColor = activeBusiness?.primary_color || "#4267B2";
  const secondaryColor =
    activeBusiness?.secondary_color &&
    String(activeBusiness.secondary_color).toLowerCase() !== "#ffffff"
      ? activeBusiness.secondary_color
      : primaryColor;
  const appColorStyle = {
    ["--app-primary"]: primaryColor,
    ["--app-secondary"]: secondaryColor,
  };
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadErrors, setUploadErrors] = useState([]);
  const dragCounter = useRef(0);
  const fileInputRef = useRef(null);
  const employeeCodesRef = useRef(new Set());

  const fetchEmployeeCodes = async () => {
    if (!facilityId) return new Set();
    try {
      const response = await fetch(
        `/api/hr/employees?facilityId=${facilityId}&limit=5000`
      );
      const data = await response.json();
      const list = data?.data?.employees || data?.data || [];
      const codes = new Set(
        (Array.isArray(list) ? list : [])
          .map((e) => normalizeEmployeeCode(e.employeeId))
          .filter(Boolean)
      );
      employeeCodesRef.current = codes;
      return codes;
    } catch (err) {
      console.error("Failed to load employees for validation:", err);
      return employeeCodesRef.current;
    }
  };

  const downloadTemplate = async () => {
    let sampleId = "EMP-0001";
    const codes = await fetchEmployeeCodes();
    if (codes.size > 0) {
      sampleId = [...codes][0];
    }
    const today = new Date().toISOString().split("T")[0];
    const template = [
      {
        employeeId: sampleId,
        date: today,
        clockInTime: "08:00:00",
        clockOutTime: "17:00:00",
        status: "Present",
        remarks: "Regular day",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AttendanceTemplate");
    XLSX.writeFile(wb, "Attendance_Bulk_Template.xlsx");
    toast.success(`Template ready — sample Employee ID: ${sampleId}`);
  };

  const isAcceptedFile = (selectedFile) => {
    const name = (selectedFile?.name || "").toLowerCase();
    return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  };

  const validateRows = (jsonData, employeeCodes) => {
    return jsonData.map((raw, index) => {
      const employeeId = String(raw.employeeId ?? "").trim();
      const date = formatExcelDate(raw.date);
      const status = raw.status ? String(raw.status).trim() : "";
      const rowErrors = [];

      if (!employeeId) {
        rowErrors.push("Employee ID is missing");
      } else if (
        employeeCodes.size > 0 &&
        !employeeCodes.has(normalizeEmployeeCode(employeeId))
      ) {
        rowErrors.push(
          `Employee "${employeeId}" not found. Use ID from Employees (e.g. EMP-0001)`
        );
      }

      if (!date) rowErrors.push("Date is missing");
      if (status && !VALID_STATUSES.includes(status)) {
        rowErrors.push("Invalid status");
      }

      return {
        employeeId,
        date,
        clockInTime: raw.clockInTime ?? "",
        clockOutTime: raw.clockOutTime ?? "",
        status: status || "Present",
        remarks: raw.remarks ?? "",
        rowErrors,
        id: index,
      };
    });
  };

  const processFile = async (selectedFile) => {
    if (!selectedFile) return;

    if (!isAcceptedFile(selectedFile)) {
      toast.error("Please upload a CSV, XLSX, or XLS file");
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error("File is too large (max 5MB)");
      return;
    }

    setFile(selectedFile);
    setLoading(true);
    setErrors([]);
    setUploadErrors([]);

    try {
      const employeeCodes = await fetchEmployeeCodes();
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = () => reject(new Error("Could not read file"));
        if (selectedFile.name.toLowerCase().endsWith(".csv")) {
          reader.readAsText(selectedFile);
        } else {
          reader.readAsBinaryString(selectedFile);
        }
      });

      let jsonData = [];
      if (selectedFile.name.toLowerCase().endsWith(".csv")) {
        const results = Papa.parse(data, {
          header: true,
          skipEmptyLines: true,
        });
        jsonData = results.data;
      } else {
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        jsonData = XLSX.utils.sheet_to_json(worksheet);
      }

      const validatedData = validateRows(jsonData, employeeCodes);
      setPreviewData(validatedData);
      const allErrors = validatedData.filter((r) => r.rowErrors.length > 0);
      setErrors(allErrors);

      if (allErrors.length > 0) {
        toast.error(
          `Found errors in ${allErrors.length} row(s). Fix Employee IDs before upload.`,
          { duration: 7000 }
        );
      } else if (validatedData.length === 0) {
        toast.error("No attendance rows found in the file");
      } else {
        toast.success(
          `File ready — ${validatedData.length} row(s) matched your employee list`
        );
      }
    } catch (err) {
      console.error("Error parsing file:", err);
      toast.error("Failed to parse file. Please check the format.");
      setFile(null);
      setPreviewData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    processFile(e.target.files?.[0]);
    if (e.target) e.target.value = "";
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) processFile(dropped);
  };

  const handleUpload = async () => {
    if (previewData.length === 0) return;
    if (errors.length > 0) {
      toast.error(
        "Fix the Employee ID / row errors shown below before uploading"
      );
      return;
    }

    setIsUploading(true);
    setUploadErrors([]);
    try {
      if (!facilityId || !user?.id) {
        toast.error("Missing business or user session. Please sign in again.");
        return;
      }

      const response = await fetch("/api/hr/attendance/bulk-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attendanceRecords: previewData.map(
            ({ rowErrors, id, ...row }) => row
          ),
          facilityId,
          createdBy: user?.id,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        if (data.errors?.length) {
          setUploadErrors(data.errors);
          setPreviewData((prev) =>
            prev.map((row) => {
              const match = data.errors.find((e) => e.row === row.id + 1);
              if (!match) return row;
              return {
                ...row,
                rowErrors: [...(row.rowErrors || []), match.error],
              };
            })
          );
        } else {
          setPreviewData([]);
          setFile(null);
        }
        window.dispatchEvent(new CustomEvent("attendanceUpdated"));
      } else {
        const detailErrors = Array.isArray(data.errors) ? data.errors : [];
        setUploadErrors(detailErrors);
        if (detailErrors.length) {
          setPreviewData((prev) =>
            prev.map((row) => {
              const match = detailErrors.find((e) => e.row === row.id + 1);
              if (!match) return row;
              return {
                ...row,
                rowErrors: [match.error],
              };
            })
          );
          setErrors(
            detailErrors.map((e, i) => ({
              id: (e.row || i + 1) - 1,
              rowErrors: [e.error],
            }))
          );
        }
        toast.error(data.message || detailErrors[0]?.error || "Upload failed", {
          duration: 8000,
        });
      }
    } catch (err) {
      console.error("Error uploading attendance:", err);
      toast.error(err.message || "An error occurred during upload");
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreviewData([]);
    setErrors([]);
    setUploadErrors([]);
    setIsDragging(false);
    dragCounter.current = 0;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6" style={appColorStyle}>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Manual Attendance Upload</CardTitle>
              <CardDescription>
                Employee ID must exist in Employees. The same staff can be
                uploaded again — existing same-day records are updated; new
                dates are created.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${
              isDragging
                ? "border-[color:var(--app-primary)] bg-[color:var(--app-primary)]/10"
                : "border-slate-200 bg-transparent hover:border-slate-300"
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => {
              if (!file && !loading) fileInputRef.current?.click();
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !file && !loading) {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
            />
            {!file ? (
              <div className="space-y-4 pointer-events-none">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                    isDragging ? "bg-[color:var(--app-primary)]/15" : "bg-slate-50"
                  }`}
                >
                  {loading ? (
                    <Loader2 className="h-8 w-8 text-[color:var(--app-primary)] animate-spin" />
                  ) : (
                    <Upload
                      className={`h-8 w-8 ${
                        isDragging ? "text-[color:var(--app-primary)]" : "text-slate-400"
                      }`}
                    />
                  )}
                </div>
                <div>
                  <p className="text-sm">
                    <span className="text-[color:var(--app-primary)] font-semibold">
                      {isDragging ? "Drop file to upload" : "Click to upload"}
                    </span>
                    {!isDragging && (
                      <span className="text-slate-500"> or drag and drop</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    CSV, XLSX or XLS (max. 5MB)
                  </p>
                </div>
              </div>
            ) : (
              <div
                className="flex items-center justify-between bg-slate-50 p-4 rounded-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-[color:var(--app-primary)]" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-800">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB
                      {loading ? " · Validating…" : ""}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {previewData.length > 0 && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Preview Data</CardTitle>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-500">
                {previewData.length} Records found
                {errors.length > 0 ? (
                  <span className="text-red-600">
                    {" "}
                    · {errors.length} with errors
                  </span>
                ) : null}
              </span>
              <Button
                onClick={handleUpload}
                disabled={isUploading || errors.length > 0}
                className="gap-2"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Confirm & Upload
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {uploadErrors.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  Upload could not complete — fix these issues and try again
                </div>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  {uploadErrors.slice(0, 10).map((err, i) => (
                    <li key={i}>
                      {err.row ? `Row ${err.row}: ` : ""}
                      {err.employeeId ? `[${err.employeeId}] ` : ""}
                      {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {errors.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-red-700 text-sm">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    {errors.length} row(s) need fixing before upload
                  </p>
                  <p className="text-xs mt-1 text-red-600/90">
                    Use the exact Employee ID from the Employees page (e.g.{" "}
                    <strong>EMP-0001</strong>). Codes like EMP001 from an old
                    template will not match.
                  </p>
                </div>
              </div>
            )}

            <div className="max-h-[400px] overflow-auto rounded-md border border-slate-100">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Status/Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.slice(0, 50).map((row) => (
                    <TableRow
                      key={row.id}
                      className={
                        row.rowErrors.length > 0 ? "bg-red-50/50" : ""
                      }
                    >
                      <TableCell className="text-xs font-mono text-slate-400">
                        {row.id + 1}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {row.employeeId}
                      </TableCell>
                      <TableCell className="text-sm">{row.date}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {row.clockInTime || "--:--"}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {row.clockOutTime || "--:--"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.status || "Present"}
                      </TableCell>
                      <TableCell>
                        {row.rowErrors.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {row.rowErrors.map((err, i) => (
                              <span
                                key={i}
                                className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded flex items-center gap-1"
                              >
                                <AlertCircle className="h-3 w-3" /> {err}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {previewData.length > 50 && (
                <div className="p-4 text-center text-sm text-slate-500 bg-slate-50 border-t">
                  Showing first 50 of {previewData.length} records
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AttendanceBulkUpload;
