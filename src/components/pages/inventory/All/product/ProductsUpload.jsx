import React, { useState, useEffect, useCallback } from "react";
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
  Package,
  Wrench,
  Box,
  Cog,
  Recycle,
  Eye,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { _postApi, _fetchApi } from "@/redux/actions/api";
import { toast } from "sonner";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { formatNumber1 } from "@/components/router/utilities";
import { normalizeTaxableStatus, TAXABLE_STATUS_VALUES } from "@/utils/taxableStatus";

const PRODUCT_TYPES = {
  FINISHED_GOOD: "Finished Good",
  RESALABLE: "Resalable",
  SERVICE: "Service",
  RAW_MATERIAL: "Raw Material",
  WIP: "WIP",
  BY_PRODUCT: "By-Product",
};

const ProductsUpload = ({ open, onClose, getInventory, onUploadSuccess }) => {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [selectedProductType, setSelectedProductType] = useState(null);
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
  const primaryColor =
    activeBusiness?.primary_color || "var(--aa-navy, #1a2d5e)";

  const getBranches = useCallback(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/account/get/branches?facilityId=${activeBusiness.id}`,
      (res) => {
        if (res.success) setBranches(res.results || []);
      },
      (err) => console.error("Error fetching warehouses:", err)
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    if (open) getBranches();
  }, [open, getBranches]);

  const branchRequiresId = (type) =>
    type === PRODUCT_TYPES.FINISHED_GOOD ||
    type === PRODUCT_TYPES.RESALABLE ||
    type === PRODUCT_TYPES.BY_PRODUCT;

  const isValidBranchId = (branchId) => {
    const id = parseInt(branchId, 10);
    if (!id) return false;
    return branches.some((b) => Number(b.id) === id);
  };

  const goodsTemplateColumns = [
    "sku",
    "Product Name",
    "Category",
    "Sales Description",
    "Selling Price",
    "Revenue Account",
    "Sales Limit Period",
    "Sales Limit Quantity",
    "Purchase Description",
    "Cost Price",
    "COGS Account",
    "Stock Quantity",
    "Warehouse ID",
    "Opening Balance Date",
    "Reorder Level",
    "Expiry Date",
    "Inventory Account",
    "Unit of Measurement",
    "UOM Category",
    "Taxable",
    "Status",
    "Supplier ID",
    "Notes",
  ];

  const mapSalesLimitsFromRow = (period, quantity) => {
    const result = {
      daily_sales_limit: null,
      weekly_sales_limit: null,
      monthly_sales_limit: null,
    };
    const p = String(period || "")
      .trim()
      .toLowerCase();
    const q = parseInt(String(quantity || "").replace(/,/g, ""), 10);
    if (!p || p === "none" || p === "unlimited" || !q || q <= 0) {
      return result;
    }
    if (p === "daily") result.daily_sales_limit = q;
    else if (p === "weekly") result.weekly_sales_limit = q;
    else if (p === "monthly") result.monthly_sales_limit = q;
    return result;
  };

  // Template columns for each product type
  const getTemplateColumns = (type) => {
    switch (type) {
      case PRODUCT_TYPES.FINISHED_GOOD:
        return [...goodsTemplateColumns, "Group ID"];
      case PRODUCT_TYPES.RESALABLE:
      case PRODUCT_TYPES.BY_PRODUCT:
        return goodsTemplateColumns;
      case PRODUCT_TYPES.SERVICE:
        return [
          "sku",
          "Service Name",
          "Sales Description",
          "Selling Price",
          "Revenue Account",
          "Sales Limit Period",
          "Sales Limit Quantity",
          "Purchase Description",
          "Cost Price",
          "Expense Account",
          "Taxable",
          "Status",
          "Unit of Measurement",
          "Tags",
          "Notes",
        ];
      case PRODUCT_TYPES.RAW_MATERIAL:
        return [
          "sku",
          "Product Name",
          "Cost Price",
          "COGS Account",
          "Stock Quantity",
          "Opening Balance Date",
          "Reorder Level",
          "Expiry Date",
          "Inventory Account",
          "Unit of Measurement",
          "Taxable",
        ];
      case PRODUCT_TYPES.WIP:
        return [
          "sku",
          "Product Name",
          "cost_price",
          "quantity",
          "opening_balance_date",
        ];
      default:
        return [];
    }
  };

  // Get template filename based on product type
  const getTemplateFilename = (type) => {
    switch (type) {
      case PRODUCT_TYPES.FINISHED_GOOD:
        return "finished-good-template.csv";
      case PRODUCT_TYPES.RESALABLE:
        return "resalable-template.csv";
      case PRODUCT_TYPES.SERVICE:
        return "service-template.csv";
      case PRODUCT_TYPES.RAW_MATERIAL:
        return "raw-material-template.csv";
      case PRODUCT_TYPES.WIP:
        return "wip-template.csv";
      case PRODUCT_TYPES.BY_PRODUCT:
        return "by-product-template.csv";
      default:
        return "products-template.csv";
    }
  };

  // Download CSV template from templates folder (fallback: generate from expected columns)
  const generateTemplate = async (type) => {
    try {
      const filename = getTemplateFilename(type);
      let csvContent = "";
      try {
        const response = await fetch(`/templates/${filename}`);
        if (response.ok) {
          csvContent = await response.text();
        }
      } catch {
        /* use generated fallback */
      }
      if (!csvContent.trim()) {
        const cols = getTemplateColumns(type);
        csvContent = `${cols.join(",")}\n`;
      }

      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Template downloaded");
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.error("Failed to download template file");
    }
  };

  const handleProductTypeSelect = (type) => {
    setSelectedProductType(type);
    setError(null);
    setUploadResult(null);
  };

  const handleBackToSelection = () => {
    setSelectedProductType(null);
    setError(null);
    setUploadResult(null);
    setUploadProgress(0);
    if (inputRef.current) {
      inputRef.current.value = "";
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
    if (!selectedProductType) {
      toast.error("Please select a product type first");
      return;
    }
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (!selectedProductType) {
      toast.error("Please select a product type first");
      return;
    }
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // Helper function to convert Excel serial date to YYYY-MM-DD format
  const convertExcelDate = (value) => {
    if (!value && value !== 0) return "";

    if (value instanceof Date) {
      if (!isNaN(value.getTime())) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, "0");
        const day = String(value.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
      return "";
    }

    if (typeof value === "string") {
      const trimmedValue = value.trim();

      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
        return trimmedValue;
      }

      const ddmmyyyyMatch = trimmedValue.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
      );
      if (ddmmyyyyMatch) {
        const day = ddmmyyyyMatch[1].padStart(2, "0");
        const month = ddmmyyyyMatch[2].padStart(2, "0");
        const year = ddmmyyyyMatch[3];
        const date = new Date(`${year}-${month}-${day}`);
        if (
          !isNaN(date.getTime()) &&
          date.getFullYear() == year &&
          String(date.getMonth() + 1).padStart(2, "0") == month &&
          String(date.getDate()).padStart(2, "0") == day
        ) {
          return `${year}-${month}-${day}`;
        }
      }

      const date = new Date(trimmedValue);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        if (year >= 1900 && year <= 2100) {
          return `${year}-${month}-${day}`;
        }
      }

      const numValue = parseFloat(trimmedValue);
      if (!isNaN(numValue) && numValue > 0) {
        return convertExcelSerialDate(numValue);
      }
      return "";
    }

    if (typeof value === "number" && value > 0) {
      return convertExcelSerialDate(value);
    }

    return "";
  };

  const convertExcelSerialDate = (serialDate) => {
    const excelEpoch = new Date(1899, 11, 30);
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

  const normalizeColumnName = (name) => {
    if (!name) return name;
    return name
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
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
    const normalizedExpectedColumns = expectedColumns.map((col) =>
      normalizeColumnName(col)
    );

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

    // Check for missing required columns
    normalizedExpectedColumns.forEach((expectedCol, index) => {
      if (!normalizedFileColumns.includes(expectedCol)) {
        missingColumns.push(expectedColumns[index]); // Use original column name
      }
    });

    // Check for extra columns (columns not in expected list)
    normalizedFileColumns.forEach((fileCol, index) => {
      if (!normalizedExpectedColumns.includes(fileCol)) {
        extraColumns.push(cleanedFileColumns[index]); // Use original column name
      }
    });

    // Also check if we have the exact count of unique columns
    const uniqueFileColumns = [...new Set(normalizedFileColumns)];
    const hasExactColumnCount =
      uniqueFileColumns.length === normalizedExpectedColumns.length;

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
            cellDates: true,
            dateNF: "yyyy-mm-dd",
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
            raw: false,
            defval: "",
          });

          if (jsonData.length === 0) {
            throw new Error("Excel file is empty (no data rows)");
          }

          const expectedColumns = getTemplateColumns(selectedProductType);

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
            errorMessage += `Please download the correct template for ${selectedProductType} products and ensure columns match exactly.`;

            throw new Error(errorMessage);
          }

          // Warn about extra columns (but don't fail)
          if (columnValidation.extraColumns.length > 0) {
            console.warn(
              "Extra columns found (will be ignored):",
              columnValidation.extraColumns.join(", ")
            );
          }

          const columnMapping = {};
          expectedColumns.forEach((col) => {
            const normalized = normalizeColumnName(col);
            columnMapping[normalized] = col;
          });

          const normalizedData = jsonData.map((row) => {
            const normalizedRow = {};
            Object.keys(row).forEach((key) => {
              const normalizedKey = normalizeColumnName(key);
              if (columnMapping[normalizedKey]) {
                let value = row[key];
                // Handle date fields
                if (
                  normalizedKey.includes("date") ||
                  normalizedKey.includes("expiry")
                ) {
                  value = convertExcelDate(value);
                }
                // Handle numeric fields
                if (
                  normalizedKey.includes("price") ||
                  normalizedKey === "cost" ||
                  normalizedKey.includes("quantity") ||
                  normalizedKey.includes("level") ||
                  normalizedKey === "quantity"
                ) {
                  if (value === "" || value === null || value === undefined) {
                    value = "";
                  } else {
                    const numValue = parseFloat(value);
                    value = isNaN(numValue) ? "" : numValue;
                  }
                }
                normalizedRow[columnMapping[normalizedKey]] = value;
              }
            });
            return normalizedRow;
          });

          resolve(normalizedData);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  const getApiEndpoint = (type) => {
    switch (type) {
      case PRODUCT_TYPES.FINISHED_GOOD:
        return "/create-product-upload-finished-good";
      case PRODUCT_TYPES.RESALABLE:
        return "/create-product-upload-resalable";
      case PRODUCT_TYPES.SERVICE:
        return "/create-product-upload-service";
      case PRODUCT_TYPES.RAW_MATERIAL:
        return "/create-product-upload-raw-material";
      case PRODUCT_TYPES.WIP:
        return "/create-product-upload-wip";
      case PRODUCT_TYPES.BY_PRODUCT:
        return "/api/products/bulk-create-finished-good-and-resalable";
      default:
        return "/create-product-upload";
    }
  };

  const getUpdateApiEndpoint = (type) => {
    switch (type) {
      case PRODUCT_TYPES.FINISHED_GOOD:
        return "/update-product-upload-finished-good";
      case PRODUCT_TYPES.RESALABLE:
        return "/update-product-upload-resalable";
      case PRODUCT_TYPES.SERVICE:
        return "/update-product-upload-service";
      case PRODUCT_TYPES.RAW_MATERIAL:
        return "/update-product-upload-raw-material";
      case PRODUCT_TYPES.WIP:
        return "/update-product-upload-wip";
      case PRODUCT_TYPES.BY_PRODUCT:
        return "/update-product-upload-by-product";
      default:
        return "/update-product-upload";
    }
  };

  const getRowIssues = (product, type) => {
    const issues = [];
    const badColumns = new Set();

    if (!product.sku) {
      issues.push("Missing SKU");
      badColumns.add("sku");
    }

    if (type === PRODUCT_TYPES.SERVICE) {
      if (!(product["Service Name"] || product["Service Description"])) {
        issues.push("Missing Service Name");
        badColumns.add("Service Name");
        badColumns.add("Service Description");
      }
      if (product["Selling Price"] === "" && product["Cost"] === "") {
        issues.push("Missing Selling Price");
        badColumns.add("Selling Price");
      }
    } else if (!product["Product Name"]) {
      issues.push("Missing Product Name");
      badColumns.add("Product Name");
    }

    if (
      (type === PRODUCT_TYPES.FINISHED_GOOD ||
        type === PRODUCT_TYPES.RESALABLE ||
        type === PRODUCT_TYPES.BY_PRODUCT) &&
      product["Selling Price"] === ""
    ) {
      issues.push("Missing Selling Price");
      badColumns.add("Selling Price");
    }

    if (
      (type === PRODUCT_TYPES.FINISHED_GOOD ||
        type === PRODUCT_TYPES.RESALABLE ||
        type === PRODUCT_TYPES.RAW_MATERIAL ||
        type === PRODUCT_TYPES.BY_PRODUCT) &&
      product["Cost Price"] === ""
    ) {
      issues.push("Missing Cost Price");
      badColumns.add("Cost Price");
    }

    if (type === PRODUCT_TYPES.WIP && product.quantity === "") {
      issues.push("Missing Quantity");
      badColumns.add("quantity");
    }

    if (type !== PRODUCT_TYPES.WIP) {
      if (!product["Taxable"]) {
        issues.push("Missing Taxable");
        badColumns.add("Taxable");
      } else {
        const normalized = normalizeTaxableStatus(product["Taxable"], "");
        if (!TAXABLE_STATUS_VALUES.includes(normalized)) {
          issues.push(
            'Taxable must be Taxable, Non-Taxable, Exempted, or Zero Rated'
          );
          badColumns.add("Taxable");
        } else {
          product["Taxable"] = normalized;
        }
      }
    }

    if (branchRequiresId(type)) {
      const stockQty = parseFloat(product["Stock Quantity"]) || 0;
      if (stockQty > 0) {
        {
          const whId = product["Warehouse ID"] || product["Branch ID"];
          if (!whId) {
            issues.push("Missing Warehouse ID (required when stock qty > 0)");
            badColumns.add("Warehouse ID");
          } else if (!isValidBranchId(whId)) {
            issues.push(
              `Invalid Warehouse ID "${whId}" — not found in your warehouses`
            );
            badColumns.add("Warehouse ID");
          }
        }
      }
    }

    return { issues, badColumns };
  };

  const validateProduct = (product, type) => {
    if (
      type !== PRODUCT_TYPES.FINISHED_GOOD &&
      type !== PRODUCT_TYPES.RESALABLE &&
      type !== PRODUCT_TYPES.BY_PRODUCT &&
      type !== PRODUCT_TYPES.SERVICE &&
      type !== PRODUCT_TYPES.RAW_MATERIAL &&
      type !== PRODUCT_TYPES.WIP
    ) {
      return false;
    }
    return getRowIssues(product, type).issues.length === 0;
  };

  // Map product data for preview/API
  const mapProductData = (products) => {
    return products.map((item) => {
      const mapped = {
        item_type: selectedProductType,
        facilityId: activeBusiness?.id,
        created_by: user?.id,
      };

      // Map fields based on product type
      if (
        selectedProductType === PRODUCT_TYPES.FINISHED_GOOD ||
        selectedProductType === PRODUCT_TYPES.RESALABLE ||
        selectedProductType === PRODUCT_TYPES.BY_PRODUCT
      ) {
        const salesLimits = mapSalesLimitsFromRow(
          item["Sales Limit Period"],
          item["Sales Limit Quantity"]
        );
        mapped.sku = item.sku || "";
        mapped.item_name = item["Product Name"] || "";
        mapped.sales_description = item["Sales Description"] || "";
        mapped.selling_price = item["Selling Price"] || 0;
        mapped.revenue_account = item["Revenue Account"] || "";
        mapped.purchase_description = item["Purchase Description"] || "";
        mapped.cost_price = item["Cost Price"] || 0;
        mapped.cogs_account = item["COGS Account"] || "";
        mapped.stock_quantity = item["Stock Quantity"] || 0;
        mapped.branch_id = item["Warehouse ID"] ?? item["Branch ID"] ?? "";
        mapped.opening_balance_date = item["Opening Balance Date"] || "";
        mapped.reorder_level = item["Reorder Level"] || 0;
        mapped.expiry_date = item["Expiry Date"] || "";
        mapped.inventory_account = item["Inventory Account"] || "";
        mapped.unit_of_measure = item["Unit of Measurement"] || "";
        mapped.category =
          item["Category"] ||
          item["category"] ||
          item["Tags"] ||
          item["UOM Category"] ||
          "";
        mapped.taxable = item["Taxable"] ? normalizeTaxableStatus(item["Taxable"], "Taxable") : "";
        mapped.status = item["Status"] || "Active";
        mapped.supplier_id = item["Supplier ID"] || "";
        mapped.tags = "";
        mapped.notes = item["Notes"] || "";
        mapped.daily_sales_limit = salesLimits.daily_sales_limit;
        mapped.weekly_sales_limit = salesLimits.weekly_sales_limit;
        mapped.monthly_sales_limit = salesLimits.monthly_sales_limit;
        if (selectedProductType === PRODUCT_TYPES.FINISHED_GOOD) {
          mapped.group_id = item["Group ID"] || "";
        }
      } else if (selectedProductType === PRODUCT_TYPES.SERVICE) {
        const salesLimits = mapSalesLimitsFromRow(
          item["Sales Limit Period"],
          item["Sales Limit Quantity"]
        );
        mapped.sku = item.sku || "";
        mapped.item_name =
          item["Service Name"] || item["Service Description"] || "";
        mapped.sales_description = item["Sales Description"] || "";
        mapped.selling_price =
          item["Selling Price"] !== undefined && item["Selling Price"] !== ""
            ? item["Selling Price"]
            : item["Cost"] || 0;
        mapped.revenue_account = item["Revenue Account"] || "";
        mapped.purchase_description = item["Purchase Description"] || "";
        mapped.cost_price = item["Cost Price"] || 0;
        mapped.cogs_account = item["Expense Account"] || "";
        mapped.taxable = item["Taxable"] ? normalizeTaxableStatus(item["Taxable"], "Taxable") : "";
        mapped.status = item["Status"] || "Active";
        mapped.unit_of_measure = item["Unit of Measurement"] || "";
        mapped.tags = item["Tags"] || "";
        mapped.notes = item["Notes"] || "";
        mapped.daily_sales_limit = salesLimits.daily_sales_limit;
        mapped.weekly_sales_limit = salesLimits.weekly_sales_limit;
        mapped.monthly_sales_limit = salesLimits.monthly_sales_limit;
      } else if (selectedProductType === PRODUCT_TYPES.RAW_MATERIAL) {
        mapped.sku = item.sku || "";
        mapped.item_name = item["Product Name"] || "";
        mapped.cost_price = item["Cost Price"] || 0;
        mapped.cogs_account = item["COGS Account"] || "";
        mapped.cogs_head = item["COGS Account"] || ""; // Backend expects cogs_head
        mapped.stock_quantity = item["Stock Quantity"] || 0;
        mapped.quantity = item["Stock Quantity"] || 0; // Backend expects quantity
        mapped.opening_balance_date = item["Opening Balance Date"] || "";
        mapped.as_of_date = item["Opening Balance Date"] || ""; // Backend expects as_of_date
        mapped.reorder_level = item["Reorder Level"] || 0;
        mapped.expiry_date = item["Expiry Date"] || "";
        mapped.inventory_account = item["Inventory Account"] || "";
        mapped.unit_of_measure = item["Unit of Measurement"] || "";
        mapped.unit = item["Unit of Measurement"] || ""; // Backend expects unit
        mapped.taxable = item["Taxable"] ? normalizeTaxableStatus(item["Taxable"], "Taxable") : "";
      } else if (selectedProductType === PRODUCT_TYPES.WIP) {
        mapped.sku = item.sku || "";
        mapped.item_name = item["Product Name"] || "";
        mapped.cost_price = item.cost_price || item["cost_price"] || 0;
        mapped.quantity = item.quantity || 0;
        mapped.opening_balance_date =
          item.opening_balance_date || item["opening_balance_date"] || "";
      }

      return mapped;
    });
  };

  const handleFileUpload = async (file) => {
    if (!selectedProductType) {
      toast.error("Please select a product type first");
      return;
    }

    setError(null);
    setUploadResult(null);
    setIsProcessing(true);
    setUploadProgress(0);

    try {
      setUploadProgress(20);
      const products = await parseExcelFile(file);

      setUploadProgress(40);
      const validProducts = products.filter((product) =>
        validateProduct(product, selectedProductType)
      );

      const invalidCount = products.length - validProducts.length;
      const invalidRows = products
        .map((product, index) => ({ ...product, __rowNumber: index + 1 }))
        .filter(
          (product) => !validateProduct(product, selectedProductType)
        );

      // Map products for preview
      const mappedProducts = mapProductData(validProducts);

      // Show preview instead of uploading immediately
      setPreviewData({
        products: mappedProducts,
        totalProducts: products.length,
        validProducts: validProducts.length,
        invalidProducts: invalidCount,
        invalidRows: invalidRows,
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
        toast.error(
          "Column validation failed. Please check the alert message.",
          {
            duration: 6000,
          }
        );
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

  // Step-by-step handler for Raw Material upload
  const handleUploadRawMaterial = () => {
    // Step 1: Validate preview data exists
    if (
      !previewData ||
      !previewData.products ||
      previewData.products.length === 0
    ) {
      toast.error("No products to upload");
      return;
    }

    // Step 2: Initialize processing state
    setIsProcessing(true);
    setUploadProgress(0);
    setShowPreview(false);
    setUploadProgress(20);

    // Step 3: Get required business data
    const facilityId = activeBusiness?.id;
    const userId = user?.id;
    const openingBalanceEquity = activeBusiness?.opening_balance_equity || "";

    if (!facilityId || !userId) {
      toast.error("Missing facility ID or user ID");
      setIsProcessing(false);
      return;
    }

    setUploadProgress(40);

    // Step 4: Format raw material data according to backend API expectations
    const rawMaterials = previewData.products.map((product) => {
      // Parse numeric values
      const costPrice = parseFloat(product.cost_price) || 0;
      const quantity =
        parseFloat(product.quantity || product.stock_quantity) || 0;
      const reorderLevel = parseFloat(product.reorder_level) || 0;

      // Get date values
      const openingBalanceDate = product.opening_balance_date || "";
      const asOfDate =
        product.as_of_date ||
        openingBalanceDate ||
        new Date().toISOString().split("T")[0];

      // Build raw material object matching backend schema
      return {
        item_name: product.item_name || "",
        sku: product.sku || "",
        cost_price: costPrice,
        cogs_head: product.cogs_head || product.cogs_account || "",
        quantity: quantity,
        reorder_level: reorderLevel,
        inventory_account: product.inventory_account || "",
        expiry_date: product.expiry_date || null,
        unit: product.unit || product.unit_of_measure || "",
        opening_balance_date: openingBalanceDate,
        opening_balance_equity: openingBalanceEquity,
        facility_id: facilityId,
        user_id: userId,
        as_of_date: asOfDate,
        taxable: product.taxable || "",
      };
    });

    setUploadProgress(60);

    // Step 5: Define API endpoint
    const apiEndpoint = "/create-product-upload-raw-material";

    setUploadProgress(70);

    // Step 6: Call API with formatted data
    _postApi(
      apiEndpoint,
      rawMaterials, // Backend expects array directly, not wrapped
      (res) => {
        // Step 7: Handle successful response
        setUploadProgress(90);

        if (!res.success) {
          toast.error(res.message || "Upload failed");
          setIsProcessing(false);
          setUploadProgress(0);
          return;
        }

        // Step 8: Extract success/failure counts from response
        const successCount =
          res.data?.summary?.successful ||
          res.data?.successful?.length ||
          previewData.validProducts;
        const failedCount =
          res.data?.summary?.failed || res.data?.failed?.length || 0;

        // Step 9: Show success message
        toast.success(
          `${successCount} raw material(s) uploaded successfully${
            failedCount > 0 ? `, ${failedCount} failed` : ""
          }`
        );

        // Step 10: Set upload result for display
        setUploadResult({
          totalProducts: previewData.totalProducts,
          importedProducts: successCount,
          invalidProducts: failedCount + previewData.invalidProducts,
          errors:
            res.data?.failed?.map(
              (item) => `Row ${item.index}: ${item.error}`
            ) ||
            (previewData.invalidProducts > 0
              ? [
                  `${previewData.invalidProducts} products were skipped due to missing required fields`,
                ]
              : []),
        });

        // Step 11: Clean up and refresh
        setPreviewData(null);
        setUploadProgress(100);

        // Step 12: Refresh inventory list
        if (getInventory) getInventory();
        if (onUploadSuccess) onUploadSuccess();

        setIsProcessing(false);
      },
      (err) => {
        // Step 13: Handle error response
        console.error("Raw Material Upload Error:", err);
        toast.error(err.message || "An error occurred during upload!");
        setIsProcessing(false);
        setUploadProgress(0);
      },
      "POST"
    );
  };

  // Handler for WIP upload
  const handleUploadWip = () => {
    if (
      !previewData ||
      !previewData.products ||
      previewData.products.length === 0
    ) {
      toast.error("No products to upload");
      return;
    }

    setIsProcessing(true);
    setUploadProgress(0);
    setShowPreview(false);
    setUploadProgress(20);

    const facilityId = activeBusiness?.id;
    const userId = user?.id;

    if (!facilityId || !userId) {
      toast.error("Missing facility ID or user ID");
      setIsProcessing(false);
      return;
    }

    setUploadProgress(40);

    // Format WIP data - backend expects array directly with facility_id and user_id in first item
    const openingBalanceEquity = activeBusiness?.opening_balance_equity || "";

    const wipItems = previewData.products.map((product, index) => {
      const quantity = parseFloat(product.quantity) || 0;
      const costPrice = parseFloat(product.cost_price) || 0;

      const item = {
        sku: product.sku || "",
        quantity: quantity,
        cost_price: costPrice,
        opening_balance_date:
          product.opening_balance_date ||
          new Date().toISOString().split("T")[0],
        wip_account: product.wip_account || activeBusiness?.wip || "",
      };

      // Add facility_id, user_id, and opening_balance_equity to first item
      if (index === 0) {
        item.facility_id = facilityId;
        item.user_id = userId;
        if (openingBalanceEquity) {
          item.opening_balance_equity = openingBalanceEquity;
        }
      }

      return item;
    });

    setUploadProgress(70);

    // Backend expects array directly, not wrapped in object
    _postApi(
      "/create-product-upload-wip",
      wipItems,
      (res) => {
        setUploadProgress(90);
        if (!res.success) {
          toast.error(res.message || "Upload failed");
          setIsProcessing(false);
          setUploadProgress(0);
          return;
        }

        const successCount =
          res.data?.summary?.successful ||
          res.data?.successful?.length ||
          previewData.validProducts;
        const failedCount =
          res.data?.summary?.failed || res.data?.failed?.length || 0;

        toast.success(
          `${successCount} WIP product(s) uploaded successfully${
            failedCount > 0 ? `, ${failedCount} failed` : ""
          }`
        );

        setUploadResult({
          totalProducts: previewData.totalProducts,
          importedProducts: successCount,
          invalidProducts: failedCount,
          errors:
            res.data?.failed?.map((f) => f.error) ||
            (failedCount > 0 ? ["Some products failed to upload"] : []),
        });

        setPreviewData(null);
        if (onUploadSuccess) {
          onUploadSuccess();
        }
        setUploadProgress(100);
        setIsProcessing(false);
        onClose();
      },
      (err) => {
        console.error("Error uploading WIP products:", err);
        toast.error("An error occurred during upload!");
        setIsProcessing(false);
        setUploadProgress(0);
      },
      "POST"
    );
  };

  // Handler for Finished Good and Resalable upload
  const handleUploadFinishedGoodAndResalable = () => {
    if (
      !previewData ||
      !previewData.products ||
      previewData.products.length === 0
    ) {
      toast.error("No products to upload");
      return;
    }

    setIsProcessing(true);
    setUploadProgress(0);
    setShowPreview(false);
    setUploadProgress(20);

    const facilityId = activeBusiness?.id;
    const userId = user?.id;
    const openingBalanceEquity = activeBusiness?.opening_balance_equity || "";

    if (!facilityId || !userId) {
      toast.error("Missing facility ID or user ID");
      setIsProcessing(false);
      return;
    }

    setUploadProgress(40);

    // Format Finished Good/Resalable data according to backend API expectations
    const products = previewData.products.map((product) => {
      // Parse numeric values
      const costPrice = parseFloat(product.cost_price) || 0;
      const sellingPrice = parseFloat(product.selling_price) || 0;
      const quantity = parseFloat(product.stock_quantity) || 0;
      const reorderLevel = parseFloat(product.reorder_level) || 0;

      // Get date values
      const openingBalanceDate = product.opening_balance_date || "";
      const asOfDate =
        openingBalanceDate || new Date().toISOString().split("T")[0];

      // Build product object matching backend schema
      return {
        item_name: product.item_name || "",
        sku: product.sku || "",
        item_type: selectedProductType, // "Finished Good" or "Resalable"
        facility_id: facilityId,
        user_id: userId,
        selling_price: sellingPrice,
        sales_description: product.sales_description || "",
        revenue_account: product.revenue_account || "",
        cost_price: costPrice,
        purchase_description: product.purchase_description || "",
        quantity: quantity,
        branch_id: parseInt(product.branch_id, 10) || 0,
        reorder_level: reorderLevel,
        inventory_account: product.inventory_account || "",
        cogs_head: product.cogs_account || "", // Backend expects cogs_head
        expiry_date: product.expiry_date || null,
        unit: product.unit_of_measure || "pcs",
        as_of_date: asOfDate,
        opening_balance_equity: openingBalanceEquity,
        status: product.status || "Active",
        taxable: product.taxable || "",
        tags: product.tags || "",
        group_id: product.group_id || "",
        notes: product.notes || "",
        supplier_id: product.supplier_id || "",
        warehouse_id: "",
        category: product.category || "",
        line_of_business: "",
        deposit_liability_account: "",
        batch_number: null,
        image_url: "",
        daily_sales_limit: product.daily_sales_limit ?? null,
        weekly_sales_limit: product.weekly_sales_limit ?? null,
        monthly_sales_limit: product.monthly_sales_limit ?? null,
      };
    });

    setUploadProgress(60);

    // Step 5: Define API endpoint
    const apiEndpoint = "/api/products/bulk-create-finished-good-and-resalable";

    setUploadProgress(70);

    // Step 6: Call API with formatted data
    _postApi(
      apiEndpoint,
      products, // Backend expects array directly
      (res) => {
        // Step 7: Handle successful response
        setUploadProgress(90);

        if (!res.success) {
          toast.error(res.message || "Upload failed");
          setIsProcessing(false);
          setUploadProgress(0);
          return;
        }

        // Step 8: Extract success/failure counts from response
        const successCount =
          res.data?.summary?.created ||
          res.data?.created?.length ||
          res.summary?.created ||
          previewData.validProducts;
        const failedCount =
          res.data?.summary?.failed ||
          res.data?.failed?.length ||
          res.summary?.failed ||
          0;

        // Step 9: Show success message
        toast.success(
          `${successCount} product(s) uploaded successfully${
            failedCount > 0 ? `, ${failedCount} failed` : ""
          }`
        );

        // Step 10: Set upload result for display
        setUploadResult({
          totalProducts: previewData.totalProducts,
          importedProducts: successCount,
          invalidProducts: failedCount + previewData.invalidProducts,
          errors:
            res.data?.failed?.map(
              (item) => `Row ${item.index}: ${item.error}`
            ) ||
            res.data?.failed?.map((f) => f.error) ||
            (previewData.invalidProducts > 0
              ? [
                  `${previewData.invalidProducts} products were skipped due to missing required fields`,
                ]
              : []),
        });

        // Step 11: Clean up and refresh
        setPreviewData(null);
        setUploadProgress(100);

        // Step 12: Refresh inventory list
        if (getInventory) getInventory();
        if (onUploadSuccess) onUploadSuccess();

        setIsProcessing(false);
        onClose();
      },
      (err) => {
        // Step 13: Handle error response
        console.error("Finished Good/Resalable Upload Error:", err);
        toast.error(err.message || "An error occurred during upload!");
        setIsProcessing(false);
        setUploadProgress(0);
      },
      "POST"
    );
  };

  // Handler for Service upload
  const handleUploadService = () => {
    if (
      !previewData ||
      !previewData.products ||
      previewData.products.length === 0
    ) {
      toast.error("No products to upload");
      return;
    }

    setIsProcessing(true);
    setUploadProgress(0);
    setShowPreview(false);
    setUploadProgress(20);

    const facilityId = activeBusiness?.id;
    const userId = user?.id;

    if (!facilityId || !userId) {
      toast.error("Missing facility ID or user ID");
      setIsProcessing(false);
      return;
    }

    setUploadProgress(40);

    // Format service data - backend expects array directly
    const serviceItems = previewData.products.map((product, index) => {
      const item = {
        sku: product.sku || "",
        item_name: product.item_name || "",
        selling_price: parseFloat(product.selling_price) || 0,
        sales_description: product.sales_description || "",
        revenue_account: product.revenue_account || "",
        purchase_description: product.purchase_description || "",
        cost_price: parseFloat(product.cost_price) || 0,
        cogs_head: product.cogs_account || "",
        taxable: product.taxable || "",
        status: product.status || "Active",
        unit: product.unit_of_measure || "",
        tags: product.tags || "",
        notes: product.notes || "",
        daily_sales_limit: product.daily_sales_limit ?? null,
        weekly_sales_limit: product.weekly_sales_limit ?? null,
        monthly_sales_limit: product.monthly_sales_limit ?? null,
      };

      // Add facilityId and created_by to first item
      if (index === 0) {
        item.facilityId = facilityId;
        item.created_by = userId;
      }

      return item;
    });

    setUploadProgress(70);

    // Backend expects array directly, not wrapped in object
    _postApi(
      "/create-product-upload-service",
      serviceItems,
      (res) => {
        setUploadProgress(90);
        if (!res.success) {
          toast.error(res.message || "Upload failed");
          setIsProcessing(false);
          setUploadProgress(0);
          return;
        }

        const successCount =
          res.data?.summary?.successful ||
          res.data?.successful?.length ||
          previewData.validProducts;
        const failedCount =
          res.data?.summary?.failed || res.data?.failed?.length || 0;

        toast.success(
          `${successCount} service product(s) uploaded successfully${
            failedCount > 0 ? `, ${failedCount} failed` : ""
          }`
        );

        setUploadResult({
          totalProducts: previewData.totalProducts,
          importedProducts: successCount,
          invalidProducts: failedCount + previewData.invalidProducts,
          errors:
            res.data?.failed?.map(
              (item) => `Row ${item.index}: ${item.error}`
            ) ||
            (previewData.invalidProducts > 0
              ? [
                  `${previewData.invalidProducts} products were skipped due to missing required fields`,
                ]
              : []),
        });

        setPreviewData(null);
        if (getInventory) getInventory();
        if (onUploadSuccess) {
          onUploadSuccess();
        }
        setUploadProgress(100);
        setIsProcessing(false);
        onClose();
      },
      (err) => {
        console.error("Error uploading service products:", err);
        toast.error(err.message || "An error occurred during upload!");
        setIsProcessing(false);
        setUploadProgress(0);
      },
      "POST"
    );
  };

  // Generic handler for other product types
  const handleConfirmUpload = () => {
    if (!previewData) return;

    // Use Finished Good/Resalable/By-Product handler
    if (
      selectedProductType === PRODUCT_TYPES.FINISHED_GOOD ||
      selectedProductType === PRODUCT_TYPES.RESALABLE ||
      selectedProductType === PRODUCT_TYPES.BY_PRODUCT
    ) {
      return handleUploadFinishedGoodAndResalable();
    }

    // Use raw material handler if product type is raw material
    if (selectedProductType === PRODUCT_TYPES.RAW_MATERIAL) {
      return handleUploadRawMaterial();
    }

    // Use WIP handler if product type is WIP
    if (selectedProductType === PRODUCT_TYPES.WIP) {
      return handleUploadWip();
    }

    // Use service handler if product type is service
    if (selectedProductType === PRODUCT_TYPES.SERVICE) {
      return handleUploadService();
    }

    // Handle other product types here if needed
    toast.error("Upload handler for this product type is not implemented yet");
  };

  const handleCancelPreview = () => {
    setPreviewData(null);
    setShowPreview(false);
    setError(null);
    setUploadProgress(0);
    setCurrentPage(1);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const clearResults = () => {
    setSelectedProductType(null);
    setUploadResult(null);
    setError(null);
    setUploadProgress(0);
    setPreviewData(null);
    setShowPreview(false);
    setCurrentPage(1);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    if (onClose) onClose();
  };

  const getProductTypeIcon = (type) => {
    switch (type) {
      case PRODUCT_TYPES.FINISHED_GOOD:
      case PRODUCT_TYPES.RESALABLE:
        return <Package className="h-5 w-5" />;
      case PRODUCT_TYPES.SERVICE:
        return <Wrench className="h-5 w-5" />;
      case PRODUCT_TYPES.RAW_MATERIAL:
        return <Box className="h-5 w-5" />;
      case PRODUCT_TYPES.WIP:
        return <Cog className="h-5 w-5" />;
      case PRODUCT_TYPES.BY_PRODUCT:
        return <Recycle className="h-5 w-5" />;
      default:
        return <Package className="h-5 w-5" />;
    }
  };

  return (
    <Sheet
      open={!!open}
      onOpenChange={(isOpen) => {
        if (!isOpen) clearResults();
      }}
    >
      <SheetContent
        side="right"
        className="!inset-y-0 !right-0 !left-auto flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l border-slate-200 p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:!max-w-xl md:!max-w-2xl lg:!max-w-3xl [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:bg-white/10 [&>button]:hover:opacity-100"
      >
        <SheetHeader className="shrink-0 space-y-1 border-b border-slate-200 bg-[var(--aa-doc-header,var(--aa-navy,#1a2d5e))] px-5 py-4 pr-12 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-white/10 p-2">
              <Upload className="h-4 w-4 text-white/90" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-lg font-semibold leading-tight text-white">
                Upload Products
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-xs text-white/70">
                {showPreview
                  ? "Review product data before uploading"
                  : selectedProductType
                    ? `Upload ${selectedProductType} products`
                    : "Select product type to upload"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {showPreview && previewData ? (
                  // Preview Section
                  <div className="space-y-4">
                    <Alert>
                      <Eye className="h-4 w-4" />
                      <AlertDescription>
                        Review the product data before uploading.{" "}
                        {previewData.validProducts} valid product(s) will be
                        imported from {previewData.totalProducts} total row(s).
                        {previewData.invalidProducts > 0 && (
                          <span className="block mt-1 text-orange-600">
                            {previewData.invalidProducts} row(s) will be skipped
                            due to validation errors.
                          </span>
                        )}
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {previewData.validProducts}
                            </div>
                            <div className="text-sm text-gray-600">
                              Valid Products
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {previewData.totalProducts}
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
                              {previewData.invalidProducts}
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
                          Total: {previewData.products.length} products
                        </span>
                      </div>
                      <div className="overflow-x-auto max-h-96">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">#</TableHead>
                              {getTemplateColumns(selectedProductType).map(
                                (col) => (
                                  <TableHead key={col}>{col}</TableHead>
                                )
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewData.products
                              .slice(
                                (currentPage - 1) * itemsPerPage,
                                currentPage * itemsPerPage
                              )
                              .map((product, index) => {
                                const globalIndex =
                                  (currentPage - 1) * itemsPerPage + index;
                                return (
                                  <TableRow key={globalIndex}>
                                    <TableCell className="font-medium">
                                      {globalIndex + 1}
                                    </TableCell>
                                    {getTemplateColumns(
                                      selectedProductType
                                    ).map((col) => {
                                      const normalizedCol =
                                        normalizeColumnName(col);
                                      let value = "";
                                      if (normalizedCol === "sku") {
                                        value = product.sku || "-";
                                      } else if (
                                        normalizedCol === "product_name" ||
                                        normalizedCol ===
                                          "productservicedescription" ||
                                        normalizedCol === "service_description"
                                      ) {
                                        value = product.item_name || "-";
                                      } else if (
                                        normalizedCol === "selling_price" ||
                                        normalizedCol === "cost"
                                      ) {
                                        value = formatNumber1(
                                          product.selling_price || 0
                                        );
                                      } else if (
                                        normalizedCol === "revenue_account"
                                      ) {
                                        value = product.revenue_account || "-";
                                      } else if (
                                        normalizedCol === "cost_price"
                                      ) {
                                        value = formatNumber1(
                                          product.cost_price || 0
                                        );
                                      } else if (
                                        normalizedCol === "cogs_account"
                                      ) {
                                        value = product.cogs_account || "-";
                                      } else if (
                                        normalizedCol === "stock_quantity"
                                      ) {
                                        value = formatNumber1(
                                          product.stock_quantity || 0
                                        );
                                      } else if (
                                        normalizedCol === "branch_id"
                                      ) {
                                        value = product.branch_id || "-";
                                      } else if (
                                        normalizedCol.includes("date")
                                      ) {
                                        value =
                                          product.opening_balance_date ||
                                          product.expiry_date ||
                                          "-";
                                      } else if (
                                        normalizedCol === "reorder_level"
                                      ) {
                                        value = formatNumber1(
                                          product.reorder_level || 0
                                        );
                                      } else if (
                                        normalizedCol === "inventory_account"
                                      ) {
                                        value =
                                          product.inventory_account || "-";
                                      } else if (
                                        normalizedCol === "unit_of_measurement"
                                      ) {
                                        value = product.unit_of_measure || "-";
                                      } else if (normalizedCol === "taxable") {
                                        value = product.taxable || "-";
                                      } else if (normalizedCol === "quantity") {
                                        value = formatNumber1(
                                          product.quantity || 0
                                        );
                                      } else if (normalizedCol === "group_id") {
                                        value = product.group_id || "-";
                                      } else if (normalizedCol === "notes") {
                                        value = product.notes || "-";
                                      } else {
                                        value = "-";
                                      }
                                      return (
                                        <TableCell key={col}>{value}</TableCell>
                                      );
                                    })}
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </div>
                      {/* Pagination Controls */}
                      {previewData.products.length > itemsPerPage && (
                        <div className="bg-gray-50 px-4 py-3 border-t flex justify-between items-center">
                          <div className="text-sm text-gray-600">
                            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                            {Math.min(
                              currentPage * itemsPerPage,
                              previewData.products.length
                            )}{" "}
                            of {previewData.products.length} products
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
                                previewData.products.length / itemsPerPage
                              )}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setCurrentPage((prev) =>
                                  Math.min(
                                    Math.ceil(
                                      previewData.products.length / itemsPerPage
                                    ),
                                    prev + 1
                                  )
                                )
                              }
                              disabled={
                                currentPage >=
                                Math.ceil(
                                  previewData.products.length / itemsPerPage
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
                                    previewData.products.length / itemsPerPage
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
                        <div className="bg-orange-50 px-4 py-2 border-b border-orange-200 flex justify-between items-center gap-2">
                          <h4 className="font-semibold text-sm text-orange-800">
                            Invalid Rows (Will Be Skipped)
                          </h4>
                          <span className="text-xs text-orange-700 font-medium shrink-0">
                            {previewData.invalidRows.length} of{" "}
                            {previewData.invalidProducts} shown
                          </span>
                        </div>
                        <div className="overflow-auto max-h-80">
                          <table className="w-full caption-bottom text-sm">
                            <thead className="sticky top-0 bg-orange-50 z-10">
                              <tr className="border-b">
                                <th className="h-10 px-2 text-left align-middle font-medium text-slate-500 w-12">
                                  #
                                </th>
                                {getTemplateColumns(selectedProductType).map(
                                  (col) => (
                                    <th
                                      key={col}
                                      className="h-10 px-2 text-left align-middle font-medium text-slate-500 whitespace-nowrap"
                                    >
                                      {col}
                                    </th>
                                  )
                                )}
                                <th className="h-10 px-2 text-left align-middle font-medium text-slate-500">
                                  Issue
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewData.invalidRows.map((product, index) => {
                                const { issues, badColumns } = getRowIssues(
                                  product,
                                  selectedProductType
                                );
                                return (
                                  <tr
                                    key={`invalid-${index}-${product.sku || "row"}`}
                                    className="border-b"
                                  >
                                    <td className="p-2 align-middle font-medium">
                                      {product.__rowNumber || index + 1}
                                    </td>
                                    {getTemplateColumns(
                                      selectedProductType
                                    ).map((col) => {
                                      const value = product[col];
                                      const display =
                                        value === "" ||
                                        value === null ||
                                        value === undefined
                                          ? "-"
                                          : typeof value === "number"
                                            ? formatNumber1(value)
                                            : value;
                                      return (
                                        <td
                                          key={col}
                                          className={`p-2 align-middle whitespace-nowrap ${
                                            badColumns.has(col)
                                              ? "bg-orange-100 text-orange-900 font-medium"
                                              : ""
                                          }`}
                                        >
                                          {display}
                                        </td>
                                      );
                                    })}
                                    <td className="p-2 align-middle text-red-600 text-sm whitespace-normal min-w-[14rem]">
                                      {issues.join(", ") || "Invalid row"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : !selectedProductType ? (
                  // Product Type Selection
                  <div className="space-y-4">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Please select the product type you want to upload. Each
                        type has a different template format.
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Goods (Resalable) */}
                      <Card
                        className="cursor-pointer hover:border-[var(--aa-accent)] hover:shadow-md transition-all"
                        onClick={() =>
                          handleProductTypeSelect(PRODUCT_TYPES.RESALABLE)
                        }
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            {getProductTypeIcon(PRODUCT_TYPES.RESALABLE)}
                            <div>
                              <h3 className="font-semibold">Goods</h3>
                              <p className="text-sm text-gray-500">
                                Physical items for sale (Resalable)
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Service */}
                      <Card
                        className="cursor-pointer hover:border-[var(--aa-accent)] hover:shadow-md transition-all"
                        onClick={() =>
                          handleProductTypeSelect(PRODUCT_TYPES.SERVICE)
                        }
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            {getProductTypeIcon(PRODUCT_TYPES.SERVICE)}
                            <div>
                              <h3 className="font-semibold">Service</h3>
                              <p className="text-sm text-gray-500">
                                Services offered to customers
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  // Upload Section
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">
                          Upload {selectedProductType}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Download the template, fill it with your data, then
                          upload
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleBackToSelection}
                        className="flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Change Type
                      </Button>
                    </div>

                    <div className="flex justify-center">
                      <Button
                        onClick={() => generateTemplate(selectedProductType)}
                        className="flex items-center gap-2 bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)]"
                      >
                        <Download className="h-4 w-4" />
                        Download Template
                      </Button>
                    </div>

                    {branchRequiresId(selectedProductType) && (
                      <Alert>
                        <AlertDescription>
                          When stock quantity is greater than 0, include a valid{" "}
                          <strong>Warehouse ID</strong> from your business warehouses.
                          {branches.length > 0 ? (
                            <span className="block mt-1 text-sm">
                              Available warehouses:{" "}
                              {branches
                                .map((b) => `${b.id} (${b.branch_name})`)
                                .join(", ")}
                            </span>
                          ) : (
                            <span className="block mt-1 text-sm text-orange-600">
                              No warehouses found — create a warehouse before uploading
                              stock.
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

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
                            Upload your {selectedProductType} data
                          </h3>
                          <p className="text-gray-500 mt-1">
                            Drag and drop your Excel file here, or click to
                            browse
                          </p>
                          <p className="text-sm text-gray-400 mt-2">
                            Supported Excel files (.xlsx, .xls, .csv)
                          </p>
                        </div>

                        <div className="flex justify-center">
                          <label className="cursor-pointer">
                            <Button
                              className="flex items-center gap-2 bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)]"
                              onClick={() => inputRef.current.click()}
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

                    {/* Upload Progress */}
                    {isProcessing && !showPreview && (
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Processing file...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <Progress
                          value={uploadProgress}
                          className="w-full"
                          style={{ color: primaryColor }}
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
                    {uploadResult && !showPreview && (
                      <div className="mt-4 space-y-4">
                        <Alert>
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription>
                            File processed successfully! Imported{" "}
                            {uploadResult.importedProducts} products from{" "}
                            {uploadResult.totalProducts} rows.
                          </AlertDescription>
                        </Alert>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Card>
                            <CardContent className="pt-4">
                              <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">
                                  {uploadResult.importedProducts}
                                </div>
                                <div className="text-sm text-gray-600">
                                  Products Imported
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="pt-4">
                              <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">
                                  {uploadResult.totalProducts}
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
                                  {uploadResult.invalidProducts}
                                </div>
                                <div className="text-sm text-gray-600">
                                  Skipped
                                </div>
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
                                <div
                                  key={index}
                                  className="text-sm text-red-700"
                                >
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
                            className="bg-[var(--aa-navy,#1a2d5e)] hover:bg-[var(--aa-navy-hover,#243a73)]"
                          >
                            Done
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="shrink-0 border-t bg-gray-50 p-4 flex justify-end gap-3">
                {showPreview && previewData ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleCancelPreview}
                      className="flex items-center gap-2"
                      disabled={isProcessing}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Cancel
                    </Button>
                    <Button
                      onClick={handleConfirmUpload}
                      disabled={
                        isProcessing || previewData.validProducts === 0
                      }
                      style={{
                        backgroundColor:
                          previewData.validProducts === 0
                            ? "#9ca3af"
                            : primaryColor,
                        color: "#ffffff",
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirm & Upload
                      {previewData.validProducts > 0
                        ? ` (${previewData.validProducts})`
                        : ""}
                    </Button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={clearResults}
                    className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
                    disabled={isProcessing}
                  >
                    Close
                  </button>
                )}
              </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

ProductsUpload.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  getInventory: PropTypes.func,
  onUploadSuccess: PropTypes.func,
};

export default ProductsUpload;
