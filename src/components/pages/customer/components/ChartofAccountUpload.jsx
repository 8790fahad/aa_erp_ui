import React, { useState } from "react";
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
  ChevronLeft,
} from "lucide-react";
import * as XLSX from "xlsx";
import axios from "axios";
import { apiURL } from "@/redux/actions/api";
import { toast } from "sonner";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import CustomTable1 from "@/common/Custom/CustomTable1";

/** Column headers for help text (matches public/chart_of_accounts_template.xlsx). */
const CHART_OF_ACCOUNTS_TEMPLATE_HEADERS = [
  "Nature",
  "Account Type",
  "Sub Category",
  "Code",
  "Parent Code",
  "Account Description",
  "Opening Balance",
  "Opening Balance Date",
  "Status",
  "Display",
  "Level",
];

const ACCOUNT_TAXONOMY = {
  assets: {
    current_assets: [
      "cash_and_cash_equivalents",
      "inventory",
      "receivables",
      "prepayments",
      "short_term_investments",
      "assets_held_for_sale",
      "other_current_assets",
    ],
    non_current_assets: [
      "property_plant_equipment",
      "investment_property",
      "intangible_assets",
      "investments",
      "right_of_use_assets",
      "biological_assets",
      "long_term_receivables",
      "other_non_current_assets",
    ],
  },
  liabilities: {
    current_liabilities: [
      "trade_payables",
      "accruals",
      "contract_liabilities_deferred_revenue",
      "tax_payable",
      "interest_payable",
      "dividends_payable",
      "short_term_loans",
      "customer_deposits",
      "refund_liabilities",
      "other_current_liabilities",
    ],
    non_current_liabilities: [
      "loans",
      "deferred_tax",
      "provisions",
      "lease_liabilities",
      "employee_benefits",
      "other_non_current_liabilities",
    ],
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
    operating_revenue: [
      "sales",
      "service_income",
      "subscription_income",
      "rental_income",
      "project_revenue",
      "commission_income",
      "grant_income",
      "other_operating_revenue",
    ],
    non_operating_revenue: [
      "interest_income",
      "gain_on_disposal",
      "foreign_exchange_gain",
      "dividend_income",
      "other_income",
    ],
  },
  expenses: {
    cost_of_sales: [
      "direct_materials",
      "direct_labor",
      "production_overhead",
      "freight_in",
      "import_duties",
      "factory_utilities",
      "subcontractor_costs",
      "royalties",
      "packaging_costs",
      "quality_control_costs",
    ],
    operating_expenses: [
      "admin_expenses",
      "selling_expenses",
      "salaries",
      "staff_welfare",
      "rent_expense",
      "utilities",
      "depreciation_expense",
      "amortization_expense",
      "marketing_expenses",
      "repair_and_maintenance",
      "insurance_expense",
      "travel_and_transport",
      "professional_fees",
      "training_and_development",
      "it_and_software_subscriptions",
      "bad_debt_expense",
      "research_and_development",
      "regulatory_fees_and_levies",
      "other_operating_expenses",
    ],
    non_operating_expenses: [
      "interest_payable",
      "bank_charges",
      "loan_processing_fees",
      "impairment_loss",
      "foreign_exchange_loss",
      "loss_on_disposal",
      "write_off_losses",
      "penalties_and_fines",
    ],
    taxes: [
      "income_tax",
      "deferred_tax",
      "withholding_tax",
      "education_tax",
      "vat_expense",
      "capital_gains_tax",
      "other_taxes",
    ],
  },
};

const TYPE_ALIASES = {
  "non-op expenses": "non_operating_expenses",
  "non-op expense": "non_operating_expenses",
  "non operating expenses": "non_operating_expenses",
  "non-operating expenses": "non_operating_expenses",
  "non operating revenue": "non_operating_revenue",
  "non-operating revenue": "non_operating_revenue",
  "current assets": "current_assets",
  "non-current assets": "non_current_assets",
  "non current assets": "non_current_assets",
  "current liabilities": "current_liabilities",
  "non-current liabilities": "non_current_liabilities",
  "non current liabilities": "non_current_liabilities",
  "operating revenue": "operating_revenue",
  "operating expenses": "operating_expenses",
  taxes: "taxes",
  "cost of sales": "cost_of_sales",
};

const COL_MAP = {
  nature: ["nature", "category"],
  account_type: ["account_type", "accounttype", "account type", "type"],
  sub_class_category: [
    "sub_category",
    "sub category",
    "sub category",
    "subcategory",
    "sub category",
  ],
  code: ["code", "account_code", "account code"],
  parent_code: ["parent_code", "parentcode", "parent code"],
  description: ["description", "account_description", "account description"],
  opening_balance: ["opening_balance", "opening balance", "opening balan"],
  opening_balance_date: [
    "opening_balance_date",
    "opening balance date",
    "opening_balance date",
  ],
  status: ["status"],
  display: ["display"],
  detail_type: ["detail_type", "detail type", "detail"],
  level: ["level"],
};

/**
 * Prefer sheet "Chart of Accounts"; find the row whose first cell is "Nature" (header row).
 */
function extractKeyedRowsFromWorkbook(workbook) {
  const preferred = workbook.SheetNames.find((n) =>
    /chart\s+of\s+accounts/i.test(String(n)),
  );
  const sheetName = preferred || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error("Workbook has no sheets");

  const aoa = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  let headerIdx = -1;
  for (let i = 0; i < Math.min(aoa.length, 120); i++) {
    const row = aoa[i] || [];
    const first = String(row[0] ?? "")
      .trim()
      .toLowerCase();
    if (first === "nature") {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx < 0) {
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    if (jsonData.length === 0) throw new Error("Sheet is empty");
    return { jsonData, sampleRow: jsonData[0] };
  }

  const headers = (aoa[headerIdx] || []).map((h) => String(h ?? "").trim());
  const jsonData = [];
  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const vals = aoa[r] || [];
    const allEmpty = vals.every((v) => {
      if (v === "" || v === null || v === undefined) return true;
      if (typeof v === "string" && !String(v).trim()) return true;
      return false;
    });
    if (allEmpty) continue;
    const obj = {};
    headers.forEach((h, j) => {
      const key = h || `Column_${j}`;
      obj[key] = vals[j] ?? "";
    });
    jsonData.push(obj);
  }
  if (jsonData.length === 0)
    throw new Error("No data rows under the header row");
  return { jsonData, sampleRow: jsonData[0] };
}

// Valid categories (case-insensitive match)
const VALID_CATEGORIES = [
  "Assets",
  "Liabilities",
  "Equity",
  "Revenue",
  "Expenses",
];
const VALID_CATEGORIES_LOWER = VALID_CATEGORIES.map((c) => c.toLowerCase());

function normalizeCategory(category) {
  if (!category) return null;
  const c = String(category).trim().toLowerCase();
  const idx = VALID_CATEGORIES_LOWER.indexOf(c);
  return idx >= 0 ? VALID_CATEGORIES[idx] : null;
}

function inferAccountNature(category) {
  const normalized = normalizeCategory(category);
  if (!normalized) return null;
  const map = {
    Assets: "ASSET",
    Liabilities: "LIABILITY",
    Equity: "EQUITY",
    Revenue: "REVENUE",
    Expenses: "EXPENSE",
  };
  return map[normalized] || null;
}

/** Nature / Category: Assets, ASSET, 1–5, etc. */
function normalizeNatureOrCategory(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const fromList = normalizeCategory(trimmed);
  if (fromList) return fromList;
  const upper = trimmed.toUpperCase();
  const enumMap = {
    ASSET: "Assets",
    LIABILITY: "Liabilities",
    EQUITY: "Equity",
    REVENUE: "Revenue",
    EXPENSE: "Expenses",
  };
  if (enumMap[upper]) return enumMap[upper];
  if (/^[1-5]$/.test(trimmed)) {
    const digitMap = {
      1: "Assets",
      2: "Liabilities",
      3: "Equity",
      4: "Revenue",
      5: "Expenses",
    };
    return digitMap[trimmed] || null;
  }
  const lower = trimmed.toLowerCase();
  if (lower === "asset") return "Assets";
  if (lower === "liability") return "Liabilities";
  if (lower === "expense") return "Expenses";
  return null;
}

function parseCellBool(v, defaultVal = true) {
  if (v === undefined || v === null || v === "") return defaultVal;
  const s = String(v).trim().toLowerCase();
  if (["0", "false", "no", "inactive", "n", "off"].includes(s)) return false;
  if (["1", "true", "yes", "active", "y", "on"].includes(s)) return true;
  const n = Number(v);
  if (!Number.isNaN(n)) return n !== 0;
  return defaultVal;
}

function findCol(sampleRow, keys) {
  const lower = Object.keys(sampleRow || {}).map((k) =>
    String(k ?? "")
      .toLowerCase()
      .replace(/\s/g, "_"),
  );
  for (const key of keys) {
    const k = key.toLowerCase().replace(/\s/g, "_");
    const idx = lower.indexOf(k);
    if (idx >= 0) return Object.keys(sampleRow)[idx];
  }
  return null;
}

function getVal(row, keys, sampleRow) {
  const col = findCol(sampleRow, keys);
  return col ? (row[col] ?? "").toString().trim() : "";
}

function normKey(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeTypeKey(raw) {
  const direct = normKey(raw);
  if (!direct) return "";
  return TYPE_ALIASES[direct] || direct;
}

function normalizeSubcategoryKey(raw) {
  return normKey(raw);
}

const ChartofAccountUpload = ({ open, onClose, getAcc }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const uploadCancelledRef = React.useRef(false);
  const inputRef = React.createRef();

  const { activeBusiness, user } = useSelector((state) => state.auth);
  const primaryColor = activeBusiness?.primary_color || "#4267B2";
  const isUploading = isProcessing && previewData;
  const openingBalanceEquityDisplay =
    activeBusiness?.opening_balance_equity || "Not set";

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

  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const { jsonData, sampleRow } =
            extractKeyedRowsFromWorkbook(workbook);
          const hasNature = findCol(sampleRow, COL_MAP.nature);
          const hasCode = findCol(sampleRow, COL_MAP.code);
          const hasDesc = findCol(sampleRow, COL_MAP.description);
          if (!hasNature || !hasCode || !hasDesc) {
            throw new Error(
              "Missing required columns: Nature (or Category), Code (or Account Code), Account Description. Download the template for the correct format.",
            );
          }

          const isGuidanceRow = (label) => {
            const c = String(label || "").toLowerCase();
            return (
              c.startsWith("instructions") ||
              c.startsWith("=== guide") ||
              c.startsWith("=== sample") ||
              c.startsWith("category ") ||
              c.startsWith("category:") ||
              c.startsWith("nature ") ||
              c.startsWith("nature:") ||
              c.startsWith("account code ") ||
              c.startsWith("account code:") ||
              c.startsWith("code ") ||
              c.startsWith("code:") ||
              c.startsWith("description ") ||
              c.startsWith("description:") ||
              c.startsWith("type ") ||
              c.startsWith("type:") ||
              c.startsWith("detail type ") ||
              c.startsWith("detail type:") ||
              c.startsWith("#")
            );
          };

          const normalized = jsonData
            .filter((row) => {
              const label = getVal(row, COL_MAP.nature, sampleRow);
              return !isGuidanceRow(label);
            })
            .map((row) => {
              const categoryRaw = getVal(row, COL_MAP.nature, sampleRow);
              const category = normalizeNatureOrCategory(categoryRaw);
              let account_code = getVal(row, COL_MAP.code, sampleRow);
              if (
                account_code === "-" ||
                account_code === "—" ||
                account_code === "–"
              ) {
                account_code = "";
              }
              let parent_code = getVal(row, COL_MAP.parent_code, sampleRow);
              if (
                parent_code === "-" ||
                parent_code === "—" ||
                parent_code === "–" ||
                parent_code === "0"
              ) {
                parent_code = "";
              }
              const levelVal = getVal(row, COL_MAP.level, sampleRow);
              const description = getVal(row, COL_MAP.description, sampleRow);
              const type = getVal(row, COL_MAP.account_type, sampleRow);
              const sub_class_category = getVal(
                row,
                COL_MAP.sub_class_category,
                sampleRow,
              );
              const detail_type = getVal(row, COL_MAP.detail_type, sampleRow);
              const obStr = getVal(row, COL_MAP.opening_balance, sampleRow);
              let opening_balance = 0;
              if (obStr !== "") {
                const n = parseFloat(String(obStr).replace(/,/g, ""));
                opening_balance = Number.isFinite(n) ? n : 0;
              }
              const opening_balance_date = getVal(
                row,
                COL_MAP.opening_balance_date,
                sampleRow,
              );
              const statusVal = getVal(row, COL_MAP.status, sampleRow);
              const displayVal = getVal(row, COL_MAP.display, sampleRow);
              const isActive = parseCellBool(
                statusVal === "" ? undefined : statusVal,
                true,
              );
              const display = parseCellBool(
                displayVal === "" ? undefined : displayVal,
                true,
              );
              const account_nature = category
                ? inferAccountNature(category)
                : null;
              const natureKey = String(category || "").toLowerCase();
              const typeKey = normalizeTypeKey(type);
              const subcategoryKey =
                normalizeSubcategoryKey(sub_class_category);

              return {
                category,
                categoryRaw: categoryRaw || "",
                account_code: account_code ? account_code.trim() : null,
                parent_code: parent_code ? parent_code.trim() : "",
                description,
                type: type || null,
                typeKey: typeKey || null,
                sub_class_category: sub_class_category || null,
                subcategoryKey: subcategoryKey || null,
                detail_type: detail_type || sub_class_category || null,
                opening_balance,
                opening_balance_date,
                status: statusVal || null,
                display,
                isActive,
                account_nature,
                natureKey,
                level: levelVal || null,
              };
            });

          resolve({ rows: normalized, file });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileUpload = async (file) => {
    setError(null);
    setUploadResult(null);
    setPreviewData(null);
    setIsProcessing(true);
    setUploadProgress(20);

    try {
      const { rows } = await parseExcelFile(file);
      setUploadProgress(100);

      // Account code uniqueness: when provided, must be unique (dash/empty allowed)
      const codeCounts = {};
      const duplicateCodes = new Set();
      rows.forEach((r) => {
        const code = r.account_code?.toString().trim();
        if (code) {
          codeCounts[code] = (codeCounts[code] || 0) + 1;
          if (codeCounts[code] > 1) duplicateCodes.add(code);
        }
      });

      const invalidRows = [];
      const validRows = rows.filter((r) => {
        if (!r.category || !r.description || !r.account_nature) {
          let reason = "Missing required fields";
          if (!r.category)
            reason = r.categoryRaw ? "Invalid nature" : "Nature required";
          else if (!r.description) reason = "Description required";
          invalidRows.push({ ...r, skipReason: reason });
          return false;
        }
        // display=0 rows are structural header/grouping accounts — Account Type
        // and Sub Category are intentionally blank, so skip those checks entirely.
        if (r.display !== false) {
          const branch = ACCOUNT_TAXONOMY[r.natureKey] || null;
          if (!branch) {
            invalidRows.push({
              ...r,
              skipReason: "Invalid nature for taxonomy",
            });
            return false;
          }
          if (
            !r.typeKey ||
            !Object.prototype.hasOwnProperty.call(branch, r.typeKey)
          ) {
            invalidRows.push({
              ...r,
              skipReason: "Invalid Account Type for selected Nature",
            });
            return false;
          }
          const validSubcats = Array.isArray(branch[r.typeKey])
            ? branch[r.typeKey]
            : [];
          if (validSubcats.length > 0 && !r.subcategoryKey) {
            invalidRows.push({
              ...r,
              skipReason: "Sub Category is required for this Account Type",
            });
            return false;
          }
          if (
            r.subcategoryKey &&
            validSubcats.length > 0 &&
            !validSubcats.includes(r.subcategoryKey)
          ) {
            invalidRows.push({
              ...r,
              skipReason:
                "Invalid Sub Category for selected Nature/Account Type",
            });
            return false;
          }
        }
        const code = r.account_code?.toString().trim();
        if (code && duplicateCodes.has(code)) {
          invalidRows.push({
            ...r,
            skipReason: `Duplicate account code (${code})`,
          });
          return false;
        }
        return true;
      });
      const invalidCount = invalidRows.length;

      if (invalidCount > 0) {
        toast.warning(
          `${invalidCount} row(s) skipped. See skipped records below.`,
        );
      }

      setPreviewData({
        rows: validRows,
        invalidRows,
        total: rows.length,
        valid: validRows.length,
        invalid: invalidCount,
      });
    } catch (err) {
      setError(err.message || "Failed to process file");
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!previewData?.rows?.length || !activeBusiness?.id) return;

    const payload = previewData.rows.map((r) => ({
      nature: r.categoryRaw,
      category: r.category,
      code: r.account_code || "",
      account_code: r.account_code || "",
      parent_code: r.parent_code || "",
      description: r.description,
      account_type: r.type || "",
      type: r.type || "",
      sub_class_category: r.sub_class_category || "",
      detail_type: r.detail_type || "",
      opening_balance: r.opening_balance ?? 0,
      opening_balance_date: r.opening_balance_date || "",
      isActive: r.isActive,
      display: r.display,
    }));

    const hasOb = payload.some(
      (r) =>
        Number(r.opening_balance) !== 0 &&
        Number.isFinite(Number(r.opening_balance)),
    );
    if (hasOb && !activeBusiness.opening_balance_equity) {
      toast.error(
        "Set Opening Balance Equity on the business before importing rows with a non-zero opening balance.",
      );
      return;
    }

    setUploadProgress(10);
    setIsProcessing(true);
    uploadCancelledRef.current = false;

    const createdBy = user?.id ?? user?.user_id ?? user?.email ?? "system";

    try {
      const token = localStorage.getItem("@@__token");
      const { data: res } = await axios.post(
        `${apiURL}/account/account-category-upload`,
        {
          accounts: payload,
          facilityId: activeBusiness.id,
          openingBalanceEquity: activeBusiness.opening_balance_equity || "",
          created_by: createdBy,
        },
        {
          headers: {
            "Content-Type": "application/json",
            authorization: token,
          },
          onUploadProgress: (progressEvent) => {
            const total = progressEvent.total || 0;
            const loaded = progressEvent.loaded || 0;
            if (total > 0) {
              const percent = Math.min(
                95,
                Math.max(10, Math.round((loaded * 100) / total)),
              );
              setUploadProgress(percent);
            }
          },
        },
      );

      if (uploadCancelledRef.current) {
        setIsProcessing(false);
        setPreviewData(null);
        uploadCancelledRef.current = false;
        toast.info("Upload cancelled");
        return;
      }

      setIsProcessing(false);
      setUploadProgress(100);
      if (!res?.success) {
        toast.error(res?.message || "Upload failed");
        return;
      }
      toast.success(res.message || "Accounts uploaded successfully");
      setUploadResult({
        totalAccounts: previewData.total,
        importedAccounts: res.imported ?? previewData.valid,
        invalidAccounts:
          previewData.invalid + (previewData.valid - (res.imported ?? 0)),
        errors: [
          ...(res.errors?.map((e) => e.message || e) || []),
          ...(previewData.invalid > 0
            ? [
                `${previewData.invalid} rows skipped due to missing required fields`,
              ]
            : []),
        ],
      });
      setPreviewData(null);
      getAcc?.();
    } catch (err) {
      if (uploadCancelledRef.current) {
        setIsProcessing(false);
        uploadCancelledRef.current = false;
        return;
      }
      setIsProcessing(false);
      toast.error(err?.response?.data?.message || "Upload failed");
    }
  };

  const handleCancelUpload = () => {
    uploadCancelledRef.current = true;
    toast.info("Cancelling upload...");
  };

  const handleBackToUpload = () => {
    setPreviewData(null);
    setError(null);
  };

  const clearResults = () => {
    setUploadResult(null);
    setError(null);
    setPreviewData(null);
    setUploadProgress(0);
    if (inputRef.current) inputRef.current.value = "";
    onClose?.();
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}chart_of_accounts_template.xlsx`,
      );
      if (!res.ok) throw new Error("Not found");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "chart_of_accounts_template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      toast.success("Template downloaded");
    } catch {
      toast.error("Could not download the template file.");
    }
  };

  const handleClose = () => {
    if (isUploading) {
      toast.warning("Please wait for upload to complete or cancel it first");
      return;
    }
    onClose?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                {previewData ? (
                  <>
                    <Eye className="h-5 w-5" />
                    Preview Chart of Accounts
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    Upload Chart of Accounts
                  </>
                )}
              </h3>
              <p className="text-blue-100 text-sm mt-1">
                {previewData
                  ? "Review account data before uploading"
                  : "Upload chart of accounts from Excel or CSV file"}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-white/20 rounded transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <p className="font-medium mb-1">
                Row 1 — use these headers exactly (columns A–K):
              </p>
              <ol className="list-decimal list-inside space-y-0.5 text-xs font-mono mt-1">
                {CHART_OF_ACCOUNTS_TEMPLATE_HEADERS.map((h, i) => (
                  <li key={h}>
                    <span className="font-sans font-normal">
                      {String.fromCharCode(65 + i)}
                    </span>{" "}
                    {h}
                  </li>
                ))}
              </ol>
            </div>

            {/* Step indicator */}
            <div className="flex items-start w-full mb-4">
              <div className="flex flex-col items-center flex-1">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                    !previewData
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  1
                </span>
                <span className="text-sm font-medium mt-1.5">Select File</span>
              </div>
              <div className="h-px flex-1 bg-gray-200 mx-2 mt-3.5 shrink-0 min-w-[20px]" />
              <div className="flex flex-col items-center flex-1">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                    previewData
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  2
                </span>
                <span className="text-sm font-medium mt-1.5">
                  Preview & Confirm
                </span>
              </div>
            </div>

            {!previewData ? (
              <>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isProcessing
                      ? "border-gray-200 bg-gray-50 opacity-75 pointer-events-none"
                      : isDragging
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
                        Upload your chart of accounts data
                      </h3>
                      <p className="text-gray-500 mt-1">
                        Drag and drop your Excel file here, or click to browse
                      </p>
                      <p className="text-sm text-gray-400 mt-2">
                        Supports Excel (.xlsx, .xls) and CSV. Row 1 headers:{" "}
                        {CHART_OF_ACCOUNTS_TEMPLATE_HEADERS.join(", ")}
                      </p>
                    </div>
                    <div className="flex justify-center">
                      <label
                        className={
                          isProcessing ? "cursor-not-allowed" : "cursor-pointer"
                        }
                      >
                        <Button
                          className="flex items-center gap-2"
                          onClick={() =>
                            !isProcessing && inputRef.current?.click()
                          }
                          disabled={isProcessing}
                          style={
                            !isProcessing
                              ? {
                                  backgroundColor: primaryColor,
                                  color: "#ffffff",
                                }
                              : undefined
                          }
                          onMouseEnter={(e) =>
                            !isProcessing &&
                            (e.currentTarget.style.backgroundColor =
                              primaryColor + "DD")
                          }
                          onMouseLeave={(e) =>
                            !isProcessing &&
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
                          disabled={isProcessing}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {isProcessing && (
                  <div className="mt-4 space-y-2">
                    <Progress value={uploadProgress} className="w-full" />
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Processing file...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                  </div>
                )}

                {error && (
                  <Alert className="mt-4" variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="mt-4 flex justify-center">
                  <Button variant="outline" onClick={handleDownloadTemplate}>
                    Download Template
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToUpload}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back to file selection
                  </Button>
                  <h4 className="font-medium flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Preview before upload ({previewData.valid} records to import
                    {previewData.invalid > 0 &&
                      `, ${previewData.invalid} skipped`}
                    )
                  </h4>
                </div>

                <p className="text-sm text-gray-600 mb-3">
                  Review the data below. Click &quot;Import&quot; to upload, or
                  &quot;Back&quot; to choose a different file.
                </p>
                <p className="text-xs text-slate-600 mb-3">
                  Opening Balance Equity:{" "}
                  <span className="font-semibold">
                    {openingBalanceEquityDisplay}
                  </span>
                </p>

                <div className="border rounded-lg overflow-hidden mb-4">
                  <div className="bg-slate-800 text-white text-center text-xs font-semibold tracking-wide py-1">
                    CHART OF ACCOUNTS
                  </div>
                  <CustomTable1
                    data={previewData.rows}
                    fields={[
                      {
                        value: "categoryRaw",
                        title: "Nature",
                        className: "text-left",
                      },
                      {
                        value: "type",
                        title: "Account Type",
                        className: "text-left",
                        custom: true,
                        component: (item) => (
                          <span className="text-sm">{item.type || "—"}</span>
                        ),
                      },
                      {
                        value: "sub_category",
                        title: "Sub  Category",
                        className: "text-left",
                        custom: true,
                        component: (item) => (
                          <span className="text-sm">
                            {item.sub_class_category || "—"}
                          </span>
                        ),
                      },
                      {
                        value: "account_code",
                        title: "Code",
                        className: "text-left",
                        custom: true,
                        component: (item) => (
                          <span className="text-sm">
                            {item.account_code || "—"}
                          </span>
                        ),
                      },
                      {
                        value: "parent_code",
                        title: "Parent Code",
                        className: "text-left",
                        custom: true,
                        component: (item) => (
                          <span className="text-sm">
                            {item.parent_code || "—"}
                          </span>
                        ),
                      },
                      {
                        value: "description",
                        title: "Account Description",
                        className: "text-left",
                      },
                      {
                        value: "opening_balance",
                        title: "Opening Balance",
                        className: "text-left",
                      },
                      {
                        value: "opening_balance_date",
                        title: "Opening Balance Date",
                        className: "text-left",
                      },
                      {
                        value: "opening_balance_equity",
                        title: "Opening Balance Equity",
                        className: "text-left",
                        custom: true,
                        component: () => (
                          <span className="text-sm">
                            {openingBalanceEquityDisplay}
                          </span>
                        ),
                      },
                      {
                        value: "isActive",
                        title: "Status",
                        className: "text-left",
                        custom: true,
                        component: (item) => (
                          <span className="text-sm">
                            {item.isActive ? "active" : "inactive"}
                          </span>
                        ),
                      },
                      {
                        value: "display",
                        title: "Display",
                        className: "text-left",
                        custom: true,
                        component: (item) => (
                          <span className="text-sm">
                            {item.display ? "1" : "0"}
                          </span>
                        ),
                      },
                      {
                        value: "level",
                        title: "Level",
                        className: "text-left",
                        custom: true,
                        component: (item) => (
                          <span className="text-sm">{item.level ?? "—"}</span>
                        ),
                      },
                    ]}
                    pageSize={25}
                    message="No preview data"
                  />
                </div>

                {previewData.invalidRows?.length > 0 && (
                  <div className="border border-amber-200 rounded-lg overflow-hidden bg-amber-50/50 mb-4">
                    <div className="px-4 py-2 bg-amber-100 border-b border-amber-200 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-700" />
                      <span className="font-medium text-amber-800">
                        Skipped records ({previewData.invalidRows.length})
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <CustomTable1
                        data={previewData.invalidRows}
                        fields={[
                          {
                            value: "categoryRaw",
                            title: "Nature",
                            className: "text-left",
                          },
                          {
                            value: "type",
                            title: "Account Type",
                            className: "text-left",
                            custom: true,
                            component: (item) => (
                              <span className="text-sm">
                                {item.type || "—"}
                              </span>
                            ),
                          },
                          {
                            value: "sub_category",
                            title: "Sub Category",
                            className: "text-left",
                            custom: true,
                            component: (item) => (
                              <span className="text-sm">
                                {item.sub_class_category || "—"}
                              </span>
                            ),
                          },
                          {
                            value: "account_code",
                            title: "Code",
                            className: "text-left",
                            custom: true,
                            component: (item) => (
                              <span className="text-sm">
                                {item.account_code || "—"}
                              </span>
                            ),
                          },
                          {
                            value: "parent_code",
                            title: "Parent Code",
                            className: "text-left",
                            custom: true,
                            component: (item) => (
                              <span className="text-sm">
                                {item.parent_code || "—"}
                              </span>
                            ),
                          },
                          {
                            value: "description",
                            title: "Account Description",
                            className: "text-left",
                          },
                          {
                            value: "opening_balance",
                            title: "Opening Balance",
                            className: "text-left",
                          },
                          {
                            value: "opening_balance_date",
                            title: "Opening Balance Date",
                            className: "text-left",
                          },
                          {
                            value: "opening_balance_equity",
                            title: "Opening Balance Equity",
                            className: "text-left",
                            custom: true,
                            component: () => (
                              <span className="text-sm">
                                {openingBalanceEquityDisplay}
                              </span>
                            ),
                          },
                          {
                            value: "isActive",
                            title: "Status",
                            className: "text-left",
                            custom: true,
                            component: (item) => (
                              <span className="text-sm">
                                {item.isActive ? "active" : "inactive"}
                              </span>
                            ),
                          },
                          {
                            value: "display",
                            title: "Display",
                            className: "text-left",
                            custom: true,
                            component: (item) => (
                              <span className="text-sm">
                                {item.display ? "1" : "0"}
                              </span>
                            ),
                          },
                          {
                            value: "level",
                            title: "Level",
                            className: "text-left",
                            custom: true,
                            component: (item) => (
                              <span className="text-sm">
                                {item.level ?? "—"}
                              </span>
                            ),
                          },
                          {
                            value: "skipReason",
                            title: "Reason skipped",
                            className: "text-left",
                            custom: true,
                            component: (item) => (
                              <span className="text-sm font-medium text-amber-800">
                                {item.skipReason}
                              </span>
                            ),
                          },
                        ]}
                        pageSize={10}
                        message="No skipped records"
                      />
                    </div>
                  </div>
                )}

                {isUploading && (
                  <div className="mt-4 space-y-2">
                    <Progress value={uploadProgress} className="w-full" />
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Importing accounts...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                  {isUploading ? (
                    <Button
                      variant="outline"
                      onClick={handleCancelUpload}
                      className="text-orange-600 border-orange-300 hover:bg-orange-50"
                    >
                      Cancel Upload
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={handleBackToUpload}>
                        Choose Different File
                      </Button>
                      <Button
                        onClick={handleConfirmUpload}
                        disabled={previewData.valid === 0}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Import {previewData.valid} Accounts
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}

            {uploadResult && (
              <div className="mt-4 space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    File processed successfully! Imported{" "}
                    {uploadResult.importedAccounts} chart of accounts from{" "}
                    {uploadResult.totalAccounts} rows.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {uploadResult.importedAccounts}
                        </div>
                        <div className="text-sm text-gray-600">
                          Chart of Accounts Imported
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {uploadResult.totalAccounts}
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
                          {uploadResult.invalidAccounts}
                        </div>
                        <div className="text-sm text-gray-600">Skipped</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {uploadResult.errors?.length > 0 && (
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
                  <Button variant="outline" onClick={clearResults}>
                    <X className="h-4 w-4 mr-1" />
                    Close
                  </Button>
                  <Button onClick={clearResults}>Done</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

ChartofAccountUpload.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  getAcc: PropTypes.func,
};

export default ChartofAccountUpload;
