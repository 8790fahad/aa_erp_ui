import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Upload,
  QrCode,
  Download,
  Save,
  X,
  Check,
  Loader2,
  Package,
  DollarSign,
  ShoppingCart,
  Settings,
  Image as ImageIcon,
  ArrowLeft,
  Briefcase,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { _postApi, _fetchApi, _putApi } from "@/redux/actions/api";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import moment from "moment";
import ProductsUpload from "./ProductsUpload";
import { Skeleton } from "@/components/ui/skeleton";

// Custom styles for React Select to match form inputs
const customSelectStyles = {
  control: (provided, state) => ({
    ...provided,
    minHeight: "42px",
    borderColor: state.isFocused ? "#3b82f6" : "#d1d5db",
    borderWidth: "1px",
    borderRadius: "0.5rem",
    boxShadow: state.isFocused ? "0 0 0 3px rgb(59 130 246 / 0.5)" : "none",
    backgroundColor: "white",
    fontSize: "14px",
    "&:hover": {
      borderColor: state.isFocused ? "#3b82f6" : "#d1d5db",
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
      ? "#eff6ff"
      : state.isFocused
        ? "#f3f4f6"
        : "white",
    color: state.isSelected ? "#1e40af" : "#374151",
    fontSize: "14px",
    padding: "10px 12px",
    cursor: "pointer",
    "&:active": {
      backgroundColor: "#eff6ff",
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
  menuPortal: (provided) => ({
    ...provided,
    zIndex: 9999,
  }),
};

const ProductServiceForm = () => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId || "";
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const isEditMode = Boolean(id) && location.pathname.includes("/edit/");
  const isViewMode = Boolean(id) && location.pathname.includes("/view/");

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [currentStockQty, setCurrentStockQty] = useState(null);
  const [imageUploadOpen, setImageUploadOpen] = useState(false);
  const [draftImagePreview, setDraftImagePreview] = useState(null);
  const [imageDragOver, setImageDragOver] = useState(false);
  const imageInputRef = useRef(null);
  const [newSupplierDialog, setNewSupplierDialog] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // State for dropdown data
  const [accounts, setAccounts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);

  // Branch ids assigned to the logged-in user (multi-branch aware).
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

  // Only show branches assigned to the user. Fall back to all facility branches
  // when the user has no assignment, or when the filter would leave the list empty
  // (common for owners/admins whose branchIds don't match).
  const visibleBranches = useMemo(() => {
    if (!branches.length) return [];
    if (!userBranchIds.length) return branches;
    const filtered = branches.filter((b) =>
      userBranchIds.includes(Number(b.id)),
    );
    return filtered.length ? filtered : branches;
  }, [branches, userBranchIds]);
  const [selectedRevenueAccount, setSelectedRevenueAccount] = useState(null);
  const [selectedExpenseAccount, setSelectedExpenseAccount] = useState(null);
  /** Rows from GET /inventory/get-all-measure/:facilityId */
  const [allMeasures, setAllMeasures] = useState([]);
  const [creatingUom, setCreatingUom] = useState(false);
  const dataLoadedRef = useRef(false);
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      sku: "",
      itemType: "Resalable",
      imageUrl: "",
      sales: {
        price: "",
        revenueAccount: "",
        description: "",
        limitPeriod: "none",
        limitQuantity: "",
      },
      purchase: {
        isPurchased: false,
        description: "",
        costPrice: "",
        cogs_head: "",
      },
      inventory: {
        quantity: "",
        reorderLevel: "",
        inventoryAccount: "",
        expiryDate: "",
        batchNumber: "",
        asOfDate: moment().format("YYYY-MM-DD"),
      },
      returnableAssets: {
        depositAmount: "",
        depositLiabilityAccount: "",
        assetAccount: "",
      },
      settings: {
        status: "Active",
        taxable: "",
        tags: "",
        notes: "",
        supplierId: "",
        warehouseId: "",
        branchId: "",
        category: "",
        unit: "",
      },
    },
  });

  const watchedItemType = watch("itemType");
  const watchedSalesLimitPeriod = watch("sales.limitPeriod");
  const isServicePurchaseEnabled = watch("purchase.isPurchased");
  const watchedBranchId = watch("settings.branchId");

  // Retail YAMMUSA GLOBAL FARMS & AGRO ALLIED SERVICES: only Goods (Resalable) and Service
  useEffect(() => {
    if (watchedItemType !== "Resalable" && watchedItemType !== "Service") {
      setValue("itemType", "Resalable");
    }
  }, [watchedItemType, setValue]);

  // Branch only applies to sellable, stock-tracked goods.
  const showBranchSetting =
    watchedItemType === "Finished Good" || watchedItemType === "Resalable";

  // Default the branch to the user's primary/assigned branch once loaded.
  useEffect(() => {
    if (!showBranchSetting || !visibleBranches.length || watchedBranchId) return;
    const isDefaultBranch = (b) =>
      b?.is_default === 1 || b?.is_default === "1" || b?.is_default === true;
    const target =
      visibleBranches.find(isDefaultBranch) || visibleBranches[0];
    if (target) setValue("settings.branchId", String(target.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBranchSetting, visibleBranches, watchedBranchId]);

  // Format number with commas (same as JournalEntryForm)
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

  // Load accounts
  const loadAccounts = useCallback(() => {
    if (!activeBusiness?.business_name) return;
    _postApi(
      `/account/chart-of-account?query_type=select`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          console.log(resp.results);
          setAccounts(resp.results || []);
        } else {
          console.error("Failed to load accounts:", resp.message);
          setAccounts([]);
        }
      },
      (err) => {
        console.error("API Error:", err);
        setAccounts([]);
      },
    );
  }, [activeBusiness.business_name]);

  // Load suppliers
  const loadSuppliers = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/inventory/suppliers-info?facilityId=${facilityId}`,
      (response) => {
        if (response.success) {
          // Transform the data to match the expected format
          const transformedSuppliers = response.results.map((supplier) => ({
            id: supplier.supplier_number,
            name: supplier.supplier_name,
            contact: supplier.phone,
            email: supplier.email,
            address: supplier.address,
            status: supplier.status,
          }));
          setSuppliers(transformedSuppliers);
        }
      },
      (error) => {
        console.error("Error loading suppliers:", error);
        // Fallback to mock data
        setSuppliers([]);
      },
    );
  }, [facilityId]);

  // Load branches (used by Finished Good / Resalable additional settings)
  const loadBranches = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/account/get/branches?facilityId=${facilityId}`,
      (response) => {
        const list =
          (response?.success && (response.results || response.data)) ||
          (Array.isArray(response) ? response : null) ||
          [];
        setBranches(Array.isArray(list) ? list : []);
      },
      (error) => {
        console.error("Error loading branches:", error);
        setBranches([]);
      },
    );
  }, [facilityId]);

  // Always fetch branches when facility is ready (don't rely on Promise.all timing)
  useEffect(() => {
    if (facilityId) loadBranches();
  }, [facilityId, loadBranches]);

  const loadAllMeasures = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/inventory/get-all-measure/${facilityId}`,
      (response) => {
        if (response.success) {
          setAllMeasures(response.results || []);
        }
      },
      (error) => {
        console.error("Error loading units of measure:", error);
        setAllMeasures([]);
      },
    );
  }, [facilityId]);

  const measureOptions = useMemo(() => {
    return (allMeasures || [])
      .filter((m) => !m.status || String(m.status).toLowerCase() === "active")
      .map((m) => ({
        value:
          m.id != null && m.id !== ""
            ? String(m.id)
            : `${m.unit}::${m.category}`,
        label: `${m.unit} (${m.category})`,
        unit: m.unit,
        category: m.category,
      }));
  }, [allMeasures]);

  const currentUomUnit = watch("settings.unit");
  const currentUomCategory = watch("settings.category");

  const selectedUomOption = useMemo(() => {
    if (!currentUomUnit) return null;
    const match = measureOptions.find(
      (o) => o.unit === currentUomUnit && o.category === currentUomCategory,
    );
    if (match) return match;
    const byUnit = measureOptions.find((o) => o.unit === currentUomUnit);
    if (byUnit) return byUnit;
    return {
      value: `custom-${currentUomUnit}`,
      label: currentUomCategory
        ? `${currentUomUnit} (${currentUomCategory})`
        : currentUomUnit,
      unit: currentUomUnit,
      category: currentUomCategory || "",
    };
  }, [currentUomUnit, currentUomCategory, measureOptions]);

  const handleCreateUom = useCallback(
    (inputValue) => {
      const trimmed = String(inputValue || "").trim();
      if (!trimmed) {
        toast.error("Enter a unit name");
        return;
      }
      if (!facilityId) {
        toast.error("Facility is required");
        return;
      }
      setCreatingUom(true);
      _postApi(
        `/inventory/unit-of-measure`,
        {
          facilityId,
          query_type: "insert",
          items: [{ category: "General", unit: trimmed, status: "active" }],
        },
        (resp) => {
          setCreatingUom(false);
          if (resp.success) {
            toast.success("Unit of measurement added");
            loadAllMeasures();
            setValue("settings.unit", trimmed);
            setValue("settings.category", "General");
          } else {
            toast.error(resp.message || "Failed to add unit");
          }
        },
        () => {
          setCreatingUom(false);
          toast.error("Failed to add unit of measurement");
        },
      );
    },
    [facilityId, loadAllMeasures, setValue],
  );

  // Load product data for edit/view mode
  const loadProductData = useCallback(() => {
    if (!facilityId || !id) return;
    setInitialLoading(true);
    _fetchApi(
      `/api/products/${facilityId}/${id}`,
      (resp) => {
        setInitialLoading(false);
        if (!resp?.success || !resp.data) {
          toast.error(resp?.message || "Product not found");
          navigate("/app/inventory/product-list");
          return;
        }
        const p = resp.data;
        const stockBal =
          p.quantity_on_hand != null ? Number(p.quantity_on_hand) : null;
        setCurrentStockQty(
          Number.isFinite(stockBal) ? stockBal : null,
        );
        let limitPeriod = "none";
        let limitQuantity = "";
        if (p.daily_sales_limit) {
          limitPeriod = "daily";
          limitQuantity = formatNumberWithCommas(String(p.daily_sales_limit));
        } else if (p.weekly_sales_limit) {
          limitPeriod = "weekly";
          limitQuantity = formatNumberWithCommas(String(p.weekly_sales_limit));
        } else if (p.monthly_sales_limit) {
          limitPeriod = "monthly";
          limitQuantity = formatNumberWithCommas(String(p.monthly_sales_limit));
        }

        const itemType =
          p.item_type === "Finished Good" ? "Resalable" : p.item_type || "Resalable";

        reset({
          name: p.name || "",
          sku: p.sku || "",
          itemType,
          imageUrl: p.image_url || "",
          sales: {
            price:
              p.selling_price != null
                ? formatNumberWithCommas(String(p.selling_price))
                : "",
            revenueAccount: p.revenue_account || "",
            description: p.sales_description || "",
            limitPeriod,
            limitQuantity,
          },
          purchase: {
            isPurchased: !!p.is_purchased,
            description: p.purchase_description || "",
            costPrice:
              p.cost_price != null
                ? formatNumberWithCommas(String(p.cost_price))
                : "",
            cogs_head: p.cogs_head || "",
          },
          inventory: {
            quantity: "",
            reorderLevel:
              p.reorder_level != null
                ? formatNumberWithCommas(String(p.reorder_level))
                : "",
            inventoryAccount: p.inventory_account || "",
            expiryDate: "",
            batchNumber: "",
            asOfDate: moment().format("YYYY-MM-DD"),
          },
          returnableAssets: {
            depositAmount: "",
            depositLiabilityAccount: p.deposit_liability_account || "",
            assetAccount: "",
          },
          settings: {
            status: p.status || "Active",
            taxable: p.taxable || "",
            tags: p.tags || "",
            notes: p.notes || "",
            supplierId: p.supplier_id || "",
            warehouseId: p.warehouse_id || "",
            branchId: "",
            category: p.category || "",
            unit: p.unit_of_measure || "",
          },
        });

        if (p.image_url) setImagePreview(p.image_url);
        dataLoadedRef.current = true;
      },
      (err) => {
        setInitialLoading(false);
        console.error("Error loading product:", err);
        toast.error("Failed to load product");
        navigate("/app/inventory/product-list");
      },
    );
  }, [facilityId, id, navigate, reset]);

  // Load initial data - wait until facilityId is available
  useEffect(() => {
    if (!facilityId) return;

    const loadAllData = async () => {
      setInitialLoading(true);
      try {
        loadAccounts();
        loadSuppliers();
        loadAllMeasures();
        loadBranches();
        if ((isEditMode || isViewMode) && id) {
          loadProductData();
        } else {
          dataLoadedRef.current = true;
          setInitialLoading(false);
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
        setInitialLoading(false);
      }
    };

    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, id, isEditMode, isViewMode]);

  // After accounts load, sync selected revenue/expense for edit form
  useEffect(() => {
    if (!(isEditMode || isViewMode) || !accounts.length) return;
    const revHead = watch("sales.revenueAccount");
    const cogsHead = watch("purchase.cogs_head");
    if (revHead) {
      const acc = accounts.find((a) => a.head === revHead);
      if (acc) setSelectedRevenueAccount(acc);
    }
    if (cogsHead) {
      const acc = accounts.find((a) => a.head === cogsHead);
      if (acc) setSelectedExpenseAccount(acc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, isEditMode, isViewMode]);

  // Generate SKU number using numberGen service

  const generateSKU = (facilityId) => {
    return new Promise((resolve, reject) => {
      if (!facilityId) {
        return reject(new Error("facilityId is required"));
      }

      _fetchApi(
        `/get-and-update/PRODUCT/${facilityId}`,
        (resp) => {
          if (resp.success) {
            const randomNum = `${resp.results}`.padStart(5, "0");
            const sku = `PROD-${randomNum}`;
            resolve(sku);
          } else {
            console.error("API Error:", resp.message);
            // Fallback: timestamp-based SKU
            const fallback = `PROD-${Date.now()}`;
            resolve(fallback);
          }
        },
        (err) => {
          console.error("Error generating SKU:", err);
          // Fallback: timestamp-based SKU
          const fallback = `PROD-${Date.now()}`;
          resolve(fallback);
        },
      );
    });
  };

  const handleGenerateSKU = async () => {
    try {
      const newSKU = await generateSKU(facilityId); // <-- pass facilityId
      setValue("sku", newSKU);
      toast.success(`New SKU generated: ${newSKU}`);
    } catch (error) {
      console.error("Error generating SKU:", error);
      toast.error("Failed to generate SKU");
    }
  };
  // Auto-generate SKU when name changes (create mode only)
  useEffect(() => {
    if (isEditMode || isViewMode) return;
    const subscription = watch(async (value, { name }) => {
      if (name === "name" && value.name && !value.sku) {
        const sku = await generateSKU(facilityId);
        setValue("sku", sku);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, setValue, facilityId, isEditMode, isViewMode]);

  // Handle image upload and convert to base64
  const readImageFile = (file) => {
    if (!file) return;
    if (!file?.type?.startsWith("image/")) {
      toast.error("Please select a valid image file (JPG, PNG, or WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (result) setDraftImagePreview(result);
    };
    reader.onerror = () => toast.error("Error reading image file");
    reader.readAsDataURL(file);
  };

  const openImageUploadModal = () => {
    setDraftImagePreview(imagePreview);
    setImageDragOver(false);
    setImageUploadOpen(true);
  };

  const applyImageFromModal = () => {
    setImagePreview(draftImagePreview);
    setValue("imageUrl", draftImagePreview || "");
    setImageUploadOpen(false);
    if (draftImagePreview) toast.success("Image added");
  };

  const clearDraftImage = () => {
    setDraftImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeCommittedImage = () => {
    setImagePreview(null);
    setDraftImagePreview(null);
    setValue("imageUrl", "");
    if (imageInputRef.current) imageInputRef.current.value = "";
    setImageUploadOpen(false);
    toast.success("Image removed");
  };

  // Generate QR Code (mock implementation)
  const generateQRCode = () => {
    const sku = watch("sku");
    if (sku) {
      toast.success(`QR Code generated for SKU: ${sku}`);
    }
  };

  // Generate new SKU
  // const handleGenerateSKU = async () => {
  //   try {
  //     const newSKU = await generateSKU();
  //     setValue("sku", newSKU);
  //     toast.success(`New SKU generated: ${newSKU}`);
  //   } catch (error) {
  //     console.error("Error generating SKU:", error);
  //     toast.error("Failed to generate SKU");
  //   }
  // };

  // Add new supplier
  const addNewSupplier = (supplierData) => {
    const payload = {
      facilityId,
      supplier_name: supplierData.name,
      address: supplierData.address || "",
      phone: supplierData.contact || "",
      supplier_code: "502001", // Default supplier code
      supplier_subhead: "502", // Default supplier subhead
      status: "active",
      email: supplierData.email || "",
    };

    _postApi(
      "/inventory/suppliers-info",
      payload,
      (response) => {
        if (response.success) {
          toast.success("Supplier added successfully");
          loadSuppliers();
        } else {
          toast.error(response.message || "Error adding supplier");
        }
      },
      (error) => {
        toast.error("Error adding supplier");
        console.error(error);
      },
    );
    setNewSupplierDialog(false);
  };
  const onInputValidation = (data) => {
    if (
      (data.itemType === "Raw Material" ||
        data.itemType === "Semi Finished") &&
      (data.inventory?.inventoryAccount === "" ||
        data.purchase?.cogs_head === "")
    ) {
      toast.error(
        "Revenue account, inventory account, and COGS account are required",
      );
      return false;
    }
    if (
      data.itemType === "Finished Good" &&
      (data.sales?.revenueAccount === "" ||
        data.inventory?.inventoryAccount === "" ||
        data.purchase?.cogs_head === "")
    ) {
      toast.error(
        "Revenue account, inventory account, and COGS account are required",
      );
      return false;
    }
    if (
      (data.itemType === "Resalable" || data.itemType === "By-Product") &&
      (data.sales?.revenueAccount === "" ||
        data.inventory?.inventoryAccount === "" ||
        data.purchase?.cogs_head === "")
    ) {
      toast.error(
        "Revenue account, inventory account, and COGS account are required",
      );
      return false;
    }
    if (data.itemType === "Service" && data.sales?.revenueAccount === "") {
      toast.error("Revenue account is required");
      return false;
    }
    // Parse formatted values for validation
    const quantityParsed = parseNumberFromFormatted(
      data.inventory?.quantity || "",
    );
    const costPriceParsed = parseNumberFromFormatted(
      data.purchase?.costPrice || "",
    );
    const sellingPriceParsed = parseNumberFromFormatted(
      data.sales?.price || "",
    );
    const quantityValue =
      quantityParsed === "" ? 0 : parseFloat(quantityParsed) || 0;
    const costPriceValue =
      costPriceParsed === "" ? 0 : parseFloat(costPriceParsed) || 0;
    const sellingPriceValue =
      sellingPriceParsed === "" ? 0 : parseFloat(sellingPriceParsed) || 0;

    // Stock quantity / opening balance are create-only (disabled on edit)
    if (!isEditMode) {
      if (quantityValue > 0 && costPriceValue <= 0) {
        toast.error(
          "Cost price must be greater than 0 when quantity is provided",
        );
        return false;
      }
      if (quantityValue > 0 && !data.inventory?.asOfDate) {
        toast.error(
          "Opening balance date is required when quantity is provided",
        );
        return false;
      }
      if (data.purchase?.cogs_head === "" && quantityValue > 0) {
        toast.error("COGS account is required when quantity is provided");
        return false;
      }
    }
    // Validate cost price when selling price is provided (skip for services)
    if (
      data.itemType !== "Service" &&
      sellingPriceValue > 0 &&
      costPriceValue <= 0
    ) {
      toast.error(
        "Cost price must be greater than 0 when selling price is provided",
      );
      return false;
    }
    return true;
  };
  // Form submission
  const onSubmit = (data) => {
    console.log("=== FORM SUBMISSION ===");
    console.log("Form Data:", JSON.stringify(data, null, 2));
    console.log("Selected Revenue Account:", selectedRevenueAccount);
    console.log("Selected Expense Account:", selectedExpenseAccount);
    console.log("======================");
    if (!onInputValidation(data)) {
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");

    // Transform form data to match database schema
    const payload = {
      // Basic info
      item_name: data.name,
      sku: data.sku,
      item_type: data.itemType,
      image_url: data.imageUrl || "",
      facility_id: facilityId,
      // Sales info - parse formatted values
      selling_price: data.sales?.price
        ? parseFloat(parseNumberFromFormatted(data.sales.price)) || 0
        : 0,
      sales_description: data.sales?.description || "",
      revenue_account: data.sales?.revenueAccount || "",
      daily_sales_limit: null,
      weekly_sales_limit: null,
      monthly_sales_limit: null,
      // Purchase info - parse formatted values
      cost_price: data.purchase?.costPrice
        ? parseFloat(parseNumberFromFormatted(data.purchase.costPrice)) || 0
        : 0,
      purchase_description: data.purchase?.description || "",
      is_purchased: !!data.purchase?.isPurchased,
      cogs_head: data.purchase?.cogs_head || "",
      // Inventory info - parse formatted values
      quantity: data.inventory?.quantity
        ? parseFloat(parseNumberFromFormatted(data.inventory.quantity)) || 0
        : 0,
      // opening_balance_date
      reorder_level: data.inventory?.reorderLevel
        ? parseFloat(parseNumberFromFormatted(data.inventory.reorderLevel)) || 0
        : 0,
      inventory_account: data.inventory?.inventoryAccount || "",
      expiry_date: data.inventory?.expiryDate || null,
      batch_number: data.inventory?.batchNumber || null,
      // Returnable Assets info - parse formatted values
      deposit_amount: data.returnableAssets?.depositAmount
        ? parseFloat(
            parseNumberFromFormatted(data.returnableAssets.depositAmount),
          ) || 0
        : 0,
      deposit_liability_account:
        data.returnableAssets?.depositLiabilityAccount || "",
      liability_account: data.returnableAssets?.depositLiabilityAccount || "",
      asset_account: data.returnableAssets?.assetAccount || "",
      // Settings
      status: data.settings?.status || "Active",
      taxable: data.settings?.taxable || "",
      tags: data.settings?.tags || "",
      notes: data.settings?.notes || "",
      supplier_id: data.settings?.supplierId || "",
      warehouse_id: data.settings?.warehouseId || "",
      branch_id:
        data.itemType === "Finished Good" || data.itemType === "Resalable"
          ? data.settings?.branchId || null
          : null,
      category: data.settings?.category || "",
      unit: data.settings?.unit || "",
      // Line of business - set to false by default
      line_of_business: false,
      // API fields
      query_type: isEditMode ? "update" : "insert",
      user_id: user?.id,
      opening_balance_equity: activeBusiness?.opening_balance_equity,

      as_of_date: data.inventory?.asOfDate || moment().format("YYYY-MM-DD"),
    };

    const limitPeriod = data.sales?.limitPeriod || "none";
    const limitQty = data.sales?.limitQuantity
      ? parseInt(
          parseNumberFromFormatted(String(data.sales.limitQuantity)),
          10,
        )
      : null;
    if (limitPeriod !== "none" && limitQty && limitQty > 0) {
      if (limitPeriod === "daily") payload.daily_sales_limit = limitQty;
      if (limitPeriod === "weekly") payload.weekly_sales_limit = limitQty;
      if (limitPeriod === "monthly") payload.monthly_sales_limit = limitQty;
    }

    console.log("Payload created:", payload);

    if (isEditMode && id) {
      const updateBody = {
        name: payload.item_name,
        sku: payload.sku,
        item_type: payload.item_type,
        image_url: payload.image_url,
        selling_price: payload.selling_price,
        sales_description: payload.sales_description,
        revenue_account: payload.revenue_account,
        daily_sales_limit: payload.daily_sales_limit,
        weekly_sales_limit: payload.weekly_sales_limit,
        monthly_sales_limit: payload.monthly_sales_limit,
        cost_price: payload.cost_price,
        purchase_description: payload.purchase_description,
        is_purchased: payload.is_purchased,
        cogs_head: payload.cogs_head,
        reorder_level: payload.reorder_level,
        inventory_account: payload.inventory_account,
        deposit_liability_account: payload.deposit_liability_account,
        status: payload.status,
        taxable: payload.taxable,
        tags: payload.tags,
        notes: payload.notes,
        supplier_id: payload.supplier_id,
        warehouse_id: payload.warehouse_id,
        category: payload.category,
        unit_of_measure: payload.unit,
        // Stock is not editable on update — only set at create time
        quantity: 0,
        as_of_date: null,
        branch_id: payload.branch_id,
        expiry_date: payload.expiry_date,
        batch_number: payload.batch_number,
        opening_balance_equity: payload.opening_balance_equity,
        user_id: payload.user_id,
      };
      _putApi(
        `/api/products/${facilityId}/${id}`,
        updateBody,
        (response) => {
          if (response.success) {
            toast.success("Product updated successfully!");
            navigate("/app/inventory/product-list");
          } else {
            setError(response.message || "Failed to update product");
            toast.error(response.message || "Failed to update product");
          }
          setLoading(false);
        },
        (error) => {
          console.error("API Request Error:", error);
          setError(`Error updating product: ${error.message}`);
          toast.error("Error updating product");
          setLoading(false);
        },
      );
      return;
    }

    console.log(
      "Sending POST request to /api/products/create with payload:",
      payload,
    );
    _postApi(
      "/api/products/create",
      payload,
      (response) => {
        console.log("API Response:", response);
        if (response.success) {
          const message = response.data.inventoryBatch
            ? "Product and inventory batch created successfully!"
            : "Product created successfully!";
          setSuccess(message);
          toast.success(message);

          // Always redirect to list after successful creation
          navigate("/app/inventory/product-list");
        } else {
          console.error("API Error Response:", response);
          setError(response.message || "Failed to create product");
          toast.error(response.message || "Failed to create product");
        }
        setLoading(false);
      },
      (error) => {
        console.error("API Request Error:", error);
        setError(`Error creating product: ${error.message}`);
        toast.error("Error creating product");
        setLoading(false);
      },
    );
  };

  // Bulk import - open ProductsUpload modal
  const handleBulkImport = () => {
    setShowBulkUpload(true);
  };

  // Handle upload success - refresh or redirect
  const handleUploadSuccess = () => {
    navigate("/app/inventory/product-list");
  };

  // Show skeleton while initial data is being loaded
  if (initialLoading) {
    return (
      <div className="space-y-6 p-1">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-20 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className="rounded-lg border bg-white p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-4 w-44" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[180px_1fr]">
            <Skeleton className="h-40 w-full rounded-xl" />
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Sales Information */}
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-44" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        {/* Purchase / Inventory / Settings placeholders */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-white p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-6 w-48" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}

        <div className="flex justify-end gap-3 border-t pt-6">
          <Skeleton className="h-12 w-28 rounded-lg" />
          <Skeleton className="h-12 w-48 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!facilityId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg">
              <CardTitle className="text-2xl font-semibold flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-5 h-5" />
                </div>
                Facility Required
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ImageIcon className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">
                No Facility Selected
              </h3>
              <p className="text-slate-600 mb-6">
                Please ensure you have selected a facility/business to create
                products.
              </p>
              <Button
                onClick={() => window.location.reload()}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-6 py-3 rounded-xl shadow-none"
              >
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/app/inventory/product-list")}
            className="flex items-center border border-[var(--aa-navy)]/25 p-2 text-[var(--aa-navy)] shadow-none hover:bg-[var(--aa-sidebar-active)]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditMode
                ? "Edit Product/Service"
                : isViewMode
                  ? "View Product/Service"
                  : "Product/Service Registration"}
            </h1>
            <p className="text-gray-600 mt-1">
              {isEditMode
                ? "Update product details and sales limits"
                : isViewMode
                  ? "Product details"
                  : "Create and manage your products and services"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isEditMode && !isViewMode && (
          <Button
            variant="outline"
            onClick={handleBulkImport}
            className="flex items-center gap-2 border-[var(--aa-navy)]/25 text-[var(--aa-navy)] shadow-none hover:bg-[var(--aa-sidebar-active)]"
          >
            <Download className="w-4 h-4" />
            Bulk Import
          </Button>
          )}
        </div>
      </div>
      {/* Success/Error Messages */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {success}
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <X className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {/* Debug Section - Form Data Display */}
      {/* <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <details className="cursor-pointer">
          <summary className="font-semibold text-gray-700 mb-2">
            🔍 Debug: Form Data (Click to expand)
          </summary>
          <pre className="bg-white p-4 rounded border border-gray-300 overflow-auto max-h-96 text-xs">
            {JSON.stringify(formValues, null, 2)}
          </pre>
        </details>
      </div> */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Form fields */}
        <fieldset disabled={isViewMode}>
          <Accordion
            type="multiple"
            defaultValue={[
              "basic-info",
              "sales-info",
              "purchase-info",
              "inventory-info",
              "returnable-assets-info",
              "settings",
            ]}
            className="space-y-4"
          >
            {/* Basic Information */}
            <AccordionItem value="basic-info" className="border rounded-lg">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span className="text-lg font-semibold">
                    Basic Information
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-700">
                      What are you adding?{" "}
                      <span className="text-red-500">*</span>
                    </p>
                    <Controller
                      name="itemType"
                      control={control}
                      rules={{ required: "Item type is required" }}
                      render={({ field }) => (
                        <div
                          role="radiogroup"
                          aria-label="Item type"
                          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                        >
                          {[
                            {
                              value: "Resalable",
                              label: "Goods",
                              hint: "Physical items you buy, stock, and sell",
                              Icon: ShoppingBag,
                            },
                            {
                              value: "Service",
                              label: "Service",
                              hint: "Work or offerings sold without stock tracking",
                              Icon: Briefcase,
                            },
                          ].map(({ value, label, hint, Icon }) => {
                            const selected = field.value === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => field.onChange(value)}
                                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                                  selected
                                    ? "border-[var(--aa-accent,#2563eb)] bg-blue-50 shadow-sm ring-1 ring-[var(--aa-accent,#2563eb)]"
                                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                                }`}
                              >
                                <span
                                  className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg ${
                                    selected
                                      ? "bg-[var(--aa-accent,#2563eb)] text-white"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  <Icon className="size-5" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-semibold text-gray-900">
                                    {label}
                                  </span>
                                  <span className="mt-0.5 block text-xs leading-snug text-gray-500">
                                    {hint}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    />
                    {errors.itemType && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.itemType.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[7.5rem_1fr]">
                    <div>
                      <p className="mb-2 text-sm font-medium text-gray-700">
                        Image
                      </p>
                      <button
                        type="button"
                        onClick={openImageUploadModal}
                        className="group relative flex size-[7.5rem] items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-[var(--aa-accent,#2563eb)] hover:shadow"
                        title={
                          imagePreview ? "Change product image" : "Add product image"
                        }
                      >
                        {imagePreview ? (
                          <>
                            <img
                              src={imagePreview}
                              alt="Product"
                              className="size-full object-cover"
                            />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">
                              <span className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-gray-900">
                                Change
                              </span>
                            </span>
                          </>
                        ) : (
                          <span className="flex flex-col items-center gap-1.5 px-2 text-center text-slate-400 group-hover:text-[var(--aa-accent,#2563eb)]">
                            <ImageIcon className="size-7" />
                            <span className="text-[11px] font-medium leading-tight">
                              Add photo
                            </span>
                          </span>
                        )}
                      </button>
                      {imagePreview && (
                        <button
                          type="button"
                          onClick={removeCommittedImage}
                          className="mt-2 text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div className="sm:col-span-2 md:col-span-1">
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          {watchedItemType === "Service" ? "Service" : "Product"}{" "}
                          name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          {...register("name", { required: "Name is required" })}
                          placeholder={
                            watchedItemType === "Service"
                              ? "e.g. Consulting, Delivery"
                              : "e.g. Rice 50kg, Soft drink"
                          }
                          className={`h-10 w-full rounded-lg border px-3 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 ${
                            errors.name ? "border-red-500" : "border-gray-300"
                          }`}
                        />
                        {errors.name && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.name.message}
                          </p>
                        )}
                      </div>

                      <div className="sm:col-span-2 md:col-span-1">
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          SKU / Code
                        </label>
                        <div className="flex h-10 gap-2">
                          <input
                            type="text"
                            {...register("sku")}
                            placeholder="Auto-generated if empty"
                            className="h-full min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateSKU}
                            className="h-full shrink-0 px-2.5 shadow-none"
                            title="Generate SKU"
                          >
                            <Plus className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={generateQRCode}
                            className="h-full shrink-0 px-2.5 shadow-none"
                            title="Generate QR code"
                          >
                            <QrCode className="size-4" />
                          </Button>
                        </div>
                        <p className="mt-1.5 text-xs text-gray-500">
                          Optional. Leave blank to generate automatically.
                        </p>
                      </div>

                      <div className="sm:col-span-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={openImageUploadModal}
                          className="h-9 shadow-none"
                        >
                          <Upload className="mr-2 size-4" />
                          {imagePreview ? "Change image" : "Upload image"}
                        </Button>
                        <p className="mt-1.5 text-xs text-gray-500">
                          JPG, PNG or WebP · up to 5MB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Sales Information - Show for item types that are sold */}
            {watchedItemType !== "Raw Material" &&
              watchedItemType !== "Semi Finished" && (
              <AccordionItem value="sales-info" className="border rounded-lg">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <span className="text-lg font-semibold">
                      Sales Information
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        {...register("sales.description")}
                        placeholder="Describe this item for sales documents and invoices"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[80px]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {watchedItemType === "Returnable Assets"
                          ? "Deposit price"
                          : "Selling Price"}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <Controller
                        name="sales.price"
                        control={control}
                        rules={{
                          required: "Selling price is required",
                          validate: (value) => {
                            const parsed = parseNumberFromFormatted(
                              value || "",
                            );
                            const numValue =
                              parsed === "" ? 0 : parseFloat(parsed) || 0;
                            if (numValue < 0) {
                              return "Price must be positive";
                            }
                            return true;
                          },
                        }}
                        render={({ field }) => (
                          <>
                            <input
                              type="text"
                              value={field.value || ""}
                              onChange={(e) => {
                                // Remove commas first, then sanitize
                                const withoutCommas = e.target.value.replace(
                                  /,/g,
                                  "",
                                );
                                const sanitizedValue = withoutCommas.replace(
                                  /[^0-9.,]/g,
                                  "",
                                );

                                // Prevent multiple decimal points
                                const parts = sanitizedValue.split(".");
                                const numericValue =
                                  parts.length > 2
                                    ? parts[0] + "." + parts.slice(1).join("")
                                    : sanitizedValue;

                                // Format with commas for display
                                const formattedValue =
                                  formatNumberWithCommas(numericValue);

                                // Update the form value with formatted value
                                field.onChange(formattedValue);
                              }}
                              onBlur={field.onBlur}
                              placeholder="0.00"
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent  ${
                                errors.sales?.price
                                  ? "border-red-500"
                                  : "border-gray-300"
                              }`}
                            />
                            {errors.sales?.price && (
                              <p className="text-sm text-red-600 mt-1">
                                {errors.sales.price.message}
                              </p>
                            )}
                          </>
                        )}
                      />
                    </div>

                    {/* <div className="typeahead-container">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tax Rate
                      </label>
                      <TypeaheadCustom
                        options={taxes || []}
                        placeholder="Select tax rate"
                        labelKey={(tax) =>
                          `${tax.description} ${tax.rate}% (${tax.tax_type})`
                        }
                        onChange={(selectedItems) => {
                          const selectedTaxItem =
                            selectedItems.length > 0 ? selectedItems[0] : null;
                          setSelectedTax(selectedTaxItem);
                          setValue("sales.taxId", selectedTaxItem?.id || null);
                          setValue(
                            "sales.taxRate",
                            selectedTaxItem
                              ? `${selectedTaxItem.description}(${selectedTaxItem.tax_type}) ${selectedTaxItem.rate}%`
                              : "None"
                          );
                        }}
                        selected={selectedTax ? [selectedTax] : []}
                      />
                    </div> */}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Default Sales Account{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <Controller
                        name="sales.revenueAccount"
                        control={control}
                        rules={{ required: "Revenue account is required" }}
                        render={({ field }) => (
                          <Select
                            options={
                              accounts?.map((account) => ({
                                value: account.head,
                                label: `${account.head} ${account.description} `,
                                account_type: account.type,
                                ...account,
                              })) || []
                            }
                            value={
                              selectedRevenueAccount
                                ? {
                                    value: selectedRevenueAccount.head,
                                    label: `${selectedRevenueAccount.description} - (${selectedRevenueAccount.head})`,
                                  }
                                : null
                            }
                            formatOptionLabel={({ label, account_type }) => (
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <span>{label}</span>
                                <span
                                  style={{
                                    color: "#6b7280",
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  {account_type || ""}
                                </span>
                              </div>
                            )}
                            onChange={(option) => {
                              const selectedAccount = option
                                ? accounts.find(
                                    (acc) => acc.head === option.value,
                                  )
                                : null;
                              setSelectedRevenueAccount(selectedAccount);
                              field.onChange(selectedAccount?.head || "");
                            }}
                            placeholder="Select revenue account"
                            isClearable
                            isSearchable
                            styles={customSelectStyles}
                            menuPortalTarget={document.body}
                            menuPosition="fixed"
                          />
                        )}
                      />
                      {errors.sales?.revenueAccount && (
                        <p className="text-sm text-red-600 mt-1">
                          {errors.sales.revenueAccount.message}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Sales Target / Limit Control
                      </p>
                      <p className="text-xs text-gray-500 mb-3">
                        Choose one period and set a quantity. Example: Daily 100,
                        or Weekly 2900. Leave as Unlimited to allow any quantity.
                        When the limit is reached, further sales are blocked even
                        if stock remains.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Limit period
                          </label>
                          <Controller
                            name="sales.limitPeriod"
                            control={control}
                            render={({ field }) => (
                              <Select
                                options={[
                                  { value: "none", label: "Unlimited" },
                                  {
                                    value: "daily",
                                    label: "Daily (e.g. 100)",
                                  },
                                  {
                                    value: "weekly",
                                    label: "Weekly (e.g. 2900)",
                                  },
                                  {
                                    value: "monthly",
                                    label: "Monthly (e.g. 10000)",
                                  },
                                ]}
                                value={
                                  [
                                    { value: "none", label: "Unlimited" },
                                    {
                                      value: "daily",
                                      label: "Daily (e.g. 100)",
                                    },
                                    {
                                      value: "weekly",
                                      label: "Weekly (e.g. 2900)",
                                    },
                                    {
                                      value: "monthly",
                                      label: "Monthly (e.g. 10000)",
                                    },
                                  ].find((o) => o.value === field.value) ||
                                  null
                                }
                                onChange={(option) => {
                                  field.onChange(option?.value || "none");
                                  if (!option || option.value === "none") {
                                    setValue("sales.limitQuantity", "");
                                  }
                                }}
                                placeholder="Select period"
                                isSearchable={false}
                                styles={customSelectStyles}
                                menuPortalTarget={document.body}
                                menuPosition="fixed"
                              />
                            )}
                          />
                        </div>
                        {watchedSalesLimitPeriod &&
                          watchedSalesLimitPeriod !== "none" && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                {watchedSalesLimitPeriod === "daily" &&
                                  "Daily limit quantity"}
                                {watchedSalesLimitPeriod === "weekly" &&
                                  "Weekly limit quantity"}
                                {watchedSalesLimitPeriod === "monthly" &&
                                  "Monthly limit quantity"}{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <Controller
                                name="sales.limitQuantity"
                                control={control}
                                rules={{
                                  validate: (value) => {
                                    const period = watch("sales.limitPeriod");
                                    if (!period || period === "none")
                                      return true;
                                    if (value === "" || value == null) {
                                      return "Enter a limit quantity";
                                    }
                                    const parsed = parseNumberFromFormatted(
                                      value || "",
                                    );
                                    const n =
                                      parsed === ""
                                        ? NaN
                                        : parseInt(parsed, 10);
                                    if (!Number.isInteger(n) || n < 1) {
                                      return "Enter a whole number ≥ 1";
                                    }
                                    return true;
                                  },
                                }}
                                render={({ field }) => (
                                  <>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={field.value || ""}
                                      onChange={(e) => {
                                        const withoutCommas =
                                          e.target.value.replace(/,/g, "");
                                        // Whole units only (no decimals)
                                        const numericValue =
                                          withoutCommas.replace(/[^0-9]/g, "");
                                        field.onChange(
                                          formatNumberWithCommas(numericValue),
                                        );
                                      }}
                                      onBlur={field.onBlur}
                                      placeholder={
                                        watchedSalesLimitPeriod === "daily"
                                          ? "e.g. 100"
                                          : watchedSalesLimitPeriod === "weekly"
                                            ? "e.g. 2,900"
                                            : "e.g. 10,000"
                                      }
                                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                        errors.sales?.limitQuantity
                                          ? "border-red-500"
                                          : "border-gray-300"
                                      }`}
                                    />
                                    {errors.sales?.limitQuantity && (
                                      <p className="text-sm text-red-600 mt-1">
                                        {errors.sales.limitQuantity.message}
                                      </p>
                                    )}
                                  </>
                                )}
                              />
                            </div>
                          )}
                      </div>
                    </div>

                    {watchedItemType === "Returnable Assets" && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Deposit Liability Account{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <Controller
                            name="returnableAssets.depositLiabilityAccount"
                            control={control}
                            rules={{
                              required: "Deposit liability account is required",
                            }}
                            render={({ field }) => (
                              <Select
                                options={
                                  accounts?.map((account) => ({
                                    value: account.head,
                                    label: `${account.description} - (${account.head})`,
                                    ...account,
                                  })) || []
                                }
                                value={
                                  field.value
                                    ? {
                                        value: field.value,
                                        label: accounts.find(
                                          (acc) => acc.head === field.value,
                                        )
                                          ? `${
                                              accounts.find(
                                                (acc) =>
                                                  acc.head === field.value,
                                              ).description
                                            } - (${
                                              accounts.find(
                                                (acc) =>
                                                  acc.head === field.value,
                                              ).head
                                            })`
                                          : "",
                                      }
                                    : null
                                }
                                onChange={(option) => {
                                  field.onChange(option?.value || "");
                                }}
                                placeholder="Select deposit liability account"
                                isClearable
                                isSearchable
                                styles={customSelectStyles}
                                menuPortalTarget={document.body}
                                menuPosition="fixed"
                              />
                            )}
                          />
                          {errors.returnableAssets?.depositLiabilityAccount && (
                            <p className="text-sm text-red-600 mt-1">
                              {
                                errors.returnableAssets.depositLiabilityAccount
                                  .message
                              }
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Liability account to track customer deposits
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Stock Quantity
                            <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            {...register("inventory.quantity", {
                              min: {
                                value: 0,
                                message: "Quantity must be positive",
                              },
                            })}
                            placeholder="0"
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                              errors.inventory?.quantity
                                ? "border-red-500"
                                : "border-gray-300"
                            }`}
                          />
                          {errors.inventory?.quantity && (
                            <p className="text-sm text-red-600 mt-1">
                              {errors.inventory.quantity.message}
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    {/* <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Default Receivable Account
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Controller
                            name="sales.receivableAccount"
                            control={control}
                            render={({ field }) => (
                              <TypeaheadCustom
                                options={accounts || []}
                                placeholder="Select receivable account"
                                labelKey={(account) =>
                                  `${account.description} - (${account.head})`
                                }
                                onChange={(selectedItems) => {
                                  const selectedAccount =
                                    selectedItems.length > 0
                                      ? selectedItems[0]
                                      : null;
                                  field.onChange(selectedAccount?.id || "");
                                }}
                                selected={
                                  field.value
                                    ? [
                                        accounts.find(
                                          (acc) => acc.id === field.value
                                        ),
                                      ].filter(Boolean)
                                    : []
                                }
                                maxResults={50}
                                minLength={0}
                                open={undefined}
                                flip={false}
                                dropup={false}
                                style={{ zIndex: 1000 }}
                              />
                            )}
                          />
                        </div>
                      </div>
                    </div> */}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Purchase Information - Inventory-type items */}
            {watchedItemType !== "Service" &&
              watchedItemType !== "Returnable Assets" && (
                <AccordionItem
                  value="purchase-info"
                  className="border rounded-lg"
                >
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <ShoppingCart className="w-5 h-5 text-orange-600" />
                      <span className="text-lg font-semibold">
                        Purchase Information
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description
                        </label>
                        <textarea
                          {...register("purchase.description")}
                          placeholder="Describe this item for purchase orders and bills"
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[80px]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Cost Price
                        </label>
                        <Controller
                          name="purchase.costPrice"
                          control={control}
                          rules={{
                            validate: (value) => {
                              const parsed = parseNumberFromFormatted(
                                value || "",
                              );
                              const numValue =
                                parsed === "" ? 0 : parseFloat(parsed) || 0;
                              if (numValue < 0) {
                                return "Cost must be positive";
                              }
                              return true;
                            },
                          }}
                          render={({ field }) => (
                            <>
                              <input
                                type="text"
                                value={field.value || ""}
                                onChange={(e) => {
                                  // Remove commas first, then sanitize
                                  const withoutCommas = e.target.value.replace(
                                    /,/g,
                                    "",
                                  );
                                  const sanitizedValue = withoutCommas.replace(
                                    /[^0-9.,]/g,
                                    "",
                                  );

                                  // Prevent multiple decimal points
                                  const parts = sanitizedValue.split(".");
                                  const numericValue =
                                    parts.length > 2
                                      ? parts[0] + "." + parts.slice(1).join("")
                                      : sanitizedValue;

                                  // Format with commas for display
                                  const formattedValue =
                                    formatNumberWithCommas(numericValue);

                                  // Update the form value with formatted value
                                  field.onChange(formattedValue);
                                }}
                                onBlur={field.onBlur}
                                placeholder="0.00"
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent  ${
                                  errors.purchase?.costPrice
                                    ? "border-red-500"
                                    : "border-gray-300"
                                }`}
                              />
                              {errors.purchase?.costPrice && (
                                <p className="text-sm text-red-600 mt-1">
                                  {errors.purchase.costPrice.message}
                                </p>
                              )}
                            </>
                          )}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          COGS Account <span className="text-red-500">*</span>
                        </label>
                        <Controller
                          name="purchase.cogs_head"
                          control={control}
                          rules={{ required: "COGS account is required" }}
                          render={({ field }) => (
                            <Select
                              options={
                                accounts
                                  // .filter((account) => account.show === 1)
                                  ?.map((account) => ({
                                    value: account.head,
                                    label: `${account.head} ${account.description}`,
                                    account_type: account.type,
                                    ...account,
                                  })) || []
                              }
                              formatOptionLabel={({ label, account_type }) => (
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <span>{label}</span>
                                  <span
                                    style={{
                                      color: "#6b7280",
                                      fontSize: "0.875rem",
                                    }}
                                  >
                                    {account_type || ""}
                                  </span>
                                </div>
                              )}
                              value={
                                selectedExpenseAccount
                                  ? {
                                      value: selectedExpenseAccount.head,
                                      label: `${selectedExpenseAccount.head} ${selectedExpenseAccount.description}`,
                                      account_type:
                                        selectedExpenseAccount.account_type,
                                    }
                                  : null
                              }
                              onChange={(option) => {
                                const selectedAccount = option
                                  ? accounts.find(
                                      (acc) => acc.head === option.value,
                                    )
                                  : null;
                                setSelectedExpenseAccount(selectedAccount);
                                field.onChange(selectedAccount?.head || "");
                              }}
                              placeholder="Select COGS account"
                              isClearable
                              isSearchable
                              styles={customSelectStyles}
                              menuPortalTarget={document.body}
                              menuPosition="fixed"
                            />
                          )}
                        />
                        {errors.purchase?.cogs_head && (
                          <p className="text-sm text-red-600 mt-1">
                            {errors.purchase.cogs_head.message}
                          </p>
                        )}
                      </div>

                      {/* <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Default COGS Account
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Controller
                            name="purchase.cogsAccount"
                            control={control}
                            render={({ field }) => (
                              <TypeaheadCustom
                                options={accounts || []}
                                placeholder="Select COGS account"
                                labelKey={(account) =>
                                  `${account.description} - (${account.head})`
                                }
                                onChange={(selectedItems) => {
                                  const selectedAccount =
                                    selectedItems.length > 0
                                      ? selectedItems[0]
                                      : null;
                                  field.onChange(selectedAccount?.id || "");
                                }}
                                selected={
                                  field.value
                                    ? [
                                        accounts.find(
                                          (acc) => acc.id === field.value
                                        ),
                                      ].filter(Boolean)
                                    : []
                                }
                                maxResults={50}
                                minLength={0}
                                open={undefined}
                                flip={false}
                                dropup={false}
                                style={{ zIndex: 1000 }}
                              />
                            )}
                          />
                        </div>
                      </div>
                    </div> */}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

            {/* Purchasing section for Service items */}
            {watchedItemType === "Service" && (
              <AccordionItem
                value="service-purchase-info"
                className="border rounded-lg"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-5 h-5 text-orange-600" />
                    <span className="text-lg font-semibold">Purchasing</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <div className="space-y-4">
                    <label className="flex items-start gap-3 text-sm text-gray-700">
                      <Controller
                        name="purchase.isPurchased"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="checkbox"
                            checked={field.value || false}
                            onChange={(e) => field.onChange(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        )}
                      />
                      <span className="font-medium">
                        I purchase this service from a vendor
                      </span>
                    </label>

                    {isServicePurchaseEnabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description
                          </label>
                          <textarea
                            {...register("purchase.description")}
                            placeholder="Describe this service for purchase documents and bills"
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[80px]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Purchase cost{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <Controller
                            name="purchase.costPrice"
                            control={control}
                            rules={{
                              validate: (value) => {
                                if (!isServicePurchaseEnabled) return true;
                                const parsed = parseNumberFromFormatted(
                                  value || "",
                                );
                                const numValue =
                                  parsed === "" ? 0 : parseFloat(parsed) || 0;
                                // Allow zero, only reject negative values
                                if (numValue < 0) {
                                  return "Cost must be positive";
                                }
                                return true;
                              },
                            }}
                            render={({ field }) => (
                              <>
                                <input
                                  type="text"
                                  value={field.value || ""}
                                  onChange={(e) => {
                                    // Remove commas first, then sanitize
                                    const withoutCommas =
                                      e.target.value.replace(/,/g, "");
                                    const sanitizedValue =
                                      withoutCommas.replace(/[^0-9.,]/g, "");

                                    // Prevent multiple decimal points
                                    const parts = sanitizedValue.split(".");
                                    const numericValue =
                                      parts.length > 2
                                        ? parts[0] +
                                          "." +
                                          parts.slice(1).join("")
                                        : sanitizedValue;

                                    // Format with commas for display
                                    const formattedValue =
                                      formatNumberWithCommas(numericValue);

                                    // Update the form value with formatted value
                                    field.onChange(formattedValue);
                                  }}
                                  onBlur={field.onBlur}
                                  placeholder="0.00"
                                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent  ${
                                    errors.purchase?.costPrice
                                      ? "border-red-500"
                                      : "border-gray-300"
                                  }`}
                                />
                                {errors.purchase?.costPrice && (
                                  <p className="text-sm text-red-600 mt-1">
                                    {errors.purchase.costPrice.message}
                                  </p>
                                )}
                              </>
                            )}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Expense account{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <Controller
                            name="purchase.cogs_head"
                            control={control}
                            rules={{
                              validate: (value) => {
                                if (!isServicePurchaseEnabled) return true;
                                if (!value) {
                                  return "Expense account is required";
                                }
                                return true;
                              },
                            }}
                            render={({ field }) => (
                              <Select
                                options={
                                  accounts?.map((account) => ({
                                    value: account.head,
                                    label: `${account.head} ${account.description}`,
                                    account_type: account.type,
                                    ...account,
                                  })) || []
                                }
                                formatOptionLabel={({
                                  label,
                                  account_type,
                                }) => (
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                    }}
                                  >
                                    <span>{label}</span>
                                    <span
                                      style={{
                                        color: "#6b7280",
                                        fontSize: "0.875rem",
                                      }}
                                    >
                                      {account_type || ""}
                                    </span>
                                  </div>
                                )}
                                value={
                                  field.value
                                    ? {
                                        value: field.value,
                                        label: accounts.find(
                                          (acc) => acc.head === field.value,
                                        )
                                          ? `${
                                              accounts.find(
                                                (acc) =>
                                                  acc.head === field.value,
                                              ).description
                                            } - (${
                                              accounts.find(
                                                (acc) =>
                                                  acc.head === field.value,
                                              ).head
                                            })`
                                          : "",
                                      }
                                    : null
                                }
                                onChange={(option) => {
                                  field.onChange(option?.value || "");
                                }}
                                placeholder="Select expense account"
                                isClearable
                                isSearchable
                                styles={customSelectStyles}
                                menuPortalTarget={document.body}
                                menuPosition="fixed"
                              />
                            )}
                          />
                          {errors.purchase?.cogs_head && (
                            <p className="text-sm text-red-600 mt-1">
                              {errors.purchase.cogs_head.message}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Returnable Assets / Reusable Containers - Only for Returnable Assets type */}
            {/* {watchedItemType === "Returnable Assets" && (
              <AccordionItem
                value="returnable-assets-info"
                className="border rounded-lg"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-teal-600" />
                    <span className="text-lg font-semibold">
                      Deposit & Asset Information (Returnable Containers)
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Deposit Amount <span className="text-red-500">*</span>
                      </label>
                      <Controller
                        name="returnableAssets.depositAmount"
                        control={control}
                        rules={{
                          required: "Deposit amount is required",
                          validate: (value) => {
                            const parsed = parseNumberFromFormatted(
                              value || ""
                            );
                            const numValue =
                              parsed === "" ? 0 : parseFloat(parsed) || 0;
                            if (numValue < 0) {
                              return "Amount must be positive";
                            }
                            return true;
                          },
                        }}
                        render={({ field }) => (
                          <>
                            <input
                              type="text"
                              value={field.value || ""}
                              onChange={(e) => {
                                // Remove commas first, then sanitize
                                const withoutCommas = e.target.value.replace(/,/g, "");
                                const sanitizedValue = withoutCommas.replace(/[^0-9.,]/g, "");

                                // Prevent multiple decimal points
                                const parts = sanitizedValue.split(".");
                                const numericValue =
                                  parts.length > 2
                                    ? parts[0] + "." + parts.slice(1).join("")
                                    : sanitizedValue;

                                // Format with commas for display
                                const formattedValue = formatNumberWithCommas(numericValue);

                                // Update the form value with formatted value
                                field.onChange(formattedValue);
                              }}
                              onBlur={field.onBlur}
                        placeholder="0.00"
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent  ${
                          errors.returnableAssets?.depositAmount
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                      />
                      {errors.returnableAssets?.depositAmount && (
                        <p className="text-sm text-red-600 mt-1">
                          {errors.returnableAssets.depositAmount.message}
                        </p>
                      )}
                          </>
                        )}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Amount charged to customer as refundable deposit
                      </p>
                    </div>



                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Revenue Account <span className="text-red-500">*</span>
                      </label>
                      <Controller
                        name="returnableAssets.revenueAccount"
                        control={control}
                        rules={{ required: "Revenue account is required" }}
                        render={({ field }) => (
                          <Select
                            options={
                              accounts?.map((account) => ({
                                value: account.head,
                                label: `${account.description} - (${account.head})`,
                                ...account,
                              })) || []
                            }
                            value={
                              field.value
                                ? {
                                    value: field.value,
                                    label: accounts.find(
                                      (acc) => acc.head === field.value
                                    )
                                      ? `${
                                          accounts.find(
                                            (acc) => acc.head === field.value
                                          ).description
                                        } - (${
                                          accounts.find(
                                            (acc) => acc.head === field.value
                                          ).head
                                        })`
                                      : "",
                                  }
                                : null
                            }
                            onChange={(option) => {
                              field.onChange(option?.value || "");
                            }}
                            placeholder="Select revenue account"
                            isClearable
                            isSearchable
                            styles={customSelectStyles}
                            menuPortalTarget={document.body}
                            menuPosition="fixed"
                          />
                        )}
                      />
                      {errors.returnableAssets?.assetAccount && (
                        <p className="text-sm text-red-600 mt-1">
                          {errors.returnableAssets.assetAccount.message}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Asset account to track the physical containers/assets
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )} */}

            {/* Inventory Information - Only show for inventory items */}
            {[
              "Raw Material",
              "Semi Finished",
              "Finished Good",
              "Resalable",
              "By-Product",
            ].includes(watchedItemType) && (
              <AccordionItem
                value="inventory-info"
                className="border rounded-lg"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-purple-600" />
                    <span className="text-lg font-semibold">
                      Inventory Information
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Stock Quantity
                      </label>
                      <Controller
                        name="inventory.quantity"
                        control={control}
                        rules={{
                          validate: (value) => {
                            if (isEditMode) return true;
                            const parsed = parseNumberFromFormatted(
                              value || "",
                            );
                            const numValue =
                              parsed === "" ? 0 : parseFloat(parsed) || 0;
                            if (numValue < 0) {
                              return "Quantity must be positive";
                            }
                            return true;
                          },
                        }}
                        render={({ field }) => (
                          <>
                            <input
                              type="text"
                              value={
                                isEditMode
                                  ? formatNumberWithCommas(
                                      String(
                                        currentStockQty != null
                                          ? currentStockQty
                                          : field.value || "0",
                                      ),
                                    )
                                  : field.value || ""
                              }
                              onChange={(e) => {
                                if (isEditMode) return;
                                const withoutCommas = e.target.value.replace(
                                  /,/g,
                                  "",
                                );
                                const sanitizedValue = withoutCommas.replace(
                                  /[^0-9.,]/g,
                                  "",
                                );
                                const parts = sanitizedValue.split(".");
                                const numericValue =
                                  parts.length > 2
                                    ? parts[0] + "." + parts.slice(1).join("")
                                    : sanitizedValue;
                                field.onChange(
                                  formatNumberWithCommas(numericValue),
                                );
                              }}
                              onBlur={field.onBlur}
                              disabled={isEditMode}
                              readOnly={isEditMode}
                              placeholder="0"
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                isEditMode
                                  ? "cursor-not-allowed bg-gray-100 text-gray-500"
                                  : ""
                              } ${
                                errors.inventory?.quantity
                                  ? "border-red-500"
                                  : "border-gray-300"
                              }`}
                            />
                            {errors.inventory?.quantity && (
                              <p className="text-sm text-red-600 mt-1">
                                {errors.inventory.quantity.message}
                              </p>
                            )}
                            {isEditMode && (
                              <p className="text-xs text-gray-500 mt-1">
                                Stock quantity cannot be changed here. Use
                                Goods Transfer or purchases to adjust stock.
                              </p>
                            )}
                          </>
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Opening Balance Date
                        {!isEditMode &&
                          Number(
                            parseNumberFromFormatted(
                              watch("inventory.quantity") || "",
                            ) || 0,
                          ) > 0 && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="date"
                        {...register("inventory.asOfDate")}
                        disabled={isEditMode}
                        readOnly={isEditMode}
                        placeholder="Select opening balance date"
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          isEditMode
                            ? "cursor-not-allowed bg-gray-100 text-gray-500"
                            : ""
                        }`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {isEditMode
                          ? "Opening balance date is set at product creation."
                          : "Required when adding stock quantity."}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reorder Level
                      </label>
                      <Controller
                        name="inventory.reorderLevel"
                        control={control}
                        rules={{
                          validate: (value) => {
                            const parsed = parseNumberFromFormatted(
                              value || "",
                            );
                            const numValue =
                              parsed === "" ? 0 : parseFloat(parsed) || 0;
                            if (numValue < 0) {
                              return "Reorder level must be positive";
                            }
                            return true;
                          },
                        }}
                        render={({ field }) => (
                          <>
                            <input
                              type="text"
                              value={field.value || ""}
                              onChange={(e) => {
                                // Remove commas first, then sanitize
                                const withoutCommas = e.target.value.replace(
                                  /,/g,
                                  "",
                                );
                                const sanitizedValue = withoutCommas.replace(
                                  /[^0-9.,]/g,
                                  "",
                                );

                                // Prevent multiple decimal points
                                const parts = sanitizedValue.split(".");
                                const numericValue =
                                  parts.length > 2
                                    ? parts[0] + "." + parts.slice(1).join("")
                                    : sanitizedValue;

                                // Format with commas for display
                                const formattedValue =
                                  formatNumberWithCommas(numericValue);

                                // Update the form value with formatted value
                                field.onChange(formattedValue);
                              }}
                              onBlur={field.onBlur}
                              placeholder="0"
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right ${
                                errors.inventory?.reorderLevel
                                  ? "border-red-500"
                                  : "border-gray-300"
                              }`}
                            />
                            {errors.inventory?.reorderLevel && (
                              <p className="text-sm text-red-600 mt-1">
                                {errors.inventory.reorderLevel.message}
                              </p>
                            )}
                          </>
                        )}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        {...register("inventory.expiryDate")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Optional: Set expiry date for perishable items
                      </p>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Default Inventory Account{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <Controller
                        name="inventory.inventoryAccount"
                        control={control}
                        rules={{ required: "Inventory account is required" }}
                        render={({ field }) => (
                          <Select
                            options={
                              accounts?.map((account) => ({
                                value: account.head,
                                label: ` ${account.head}  ${account.description} `,
                                account_type: account.type,
                                ...account,
                              })) || []
                            }
                            formatOptionLabel={({ label, account_type }) => (
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <span>{label}</span>
                                <span
                                  style={{
                                    color: "#6b7280",
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  {account_type || ""}
                                </span>
                              </div>
                            )}
                            value={
                              field.value
                                ? {
                                    value: field.value,
                                    label: accounts.find(
                                      (acc) => acc.head === field.value,
                                    )
                                      ? `${
                                          accounts.find(
                                            (acc) => acc.head === field.value,
                                          ).description
                                        } - (${
                                          accounts.find(
                                            (acc) => acc.head === field.value,
                                          ).head
                                        })`
                                      : "",
                                  }
                                : null
                            }
                            onChange={(option) => {
                              field.onChange(option?.value || "");
                            }}
                            placeholder="Select inventory account"
                            isClearable
                            isSearchable
                            styles={customSelectStyles}
                            menuPortalTarget={document.body}
                            menuPosition="fixed"
                          />
                        )}
                      />
                      {errors.inventory?.inventoryAccount && (
                        <p className="text-sm text-red-600 mt-1">
                          {errors.inventory.inventoryAccount.message}
                        </p>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Additional Settings - Hide for Returnable Assets */}
            {watchedItemType !== "Returnable Assets" && (
              <AccordionItem value="settings" className="border rounded-lg">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-gray-600" />
                    <span className="text-lg font-semibold">
                      Additional Settings
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {showBranchSetting && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Warehouse
                        </label>
                        <Controller
                          name="settings.branchId"
                          control={control}
                          render={({ field }) => (
                            <select
                              value={field.value}
                              onChange={field.onChange}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            >
                              <option value="">Select warehouse...</option>
                              {visibleBranches.map((b) => (
                                <option key={b.id} value={String(b.id)}>
                                  {b.branch_name ||
                                    b.storeName ||
                                    b.name ||
                                    `Warehouse ${b.id}`}
                                </option>
                              ))}
                            </select>
                          )}
                        />
                        {!visibleBranches.length && (
                          <p className="text-xs text-amber-600 mt-1">
                            No warehouses found for this business. Add a branch
                            under Admin first.
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          The warehouse this item belongs to.
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <Controller
                        name="settings.status"
                        control={control}
                        render={({ field }) => (
                          <select
                            value={field.value}
                            onChange={field.onChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </select>
                        )}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Taxable <span className="text-red-500">*</span>
                      </label>
                      <Controller
                        name="settings.taxable"
                        control={control}
                        rules={{ required: "Taxable status is required" }}
                        render={({ field }) => (
                          <select
                            value={field.value}
                            onChange={field.onChange}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white ${
                              errors.settings?.taxable
                                ? "border-red-500"
                                : "border-gray-300"
                            }`}
                          >
                            <option value="">Select Taxable Status</option>
                            <option value="Taxable">Taxable</option>
                            <option value="Not Taxable">Not Taxable</option>
                          </select>
                        )}
                      />
                      {errors.settings?.taxable && (
                        <p className="text-sm text-red-600 mt-1">
                          {errors.settings.taxable.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Default Supplier
                      </label>
                      <div className="flex gap-2">
                        <Controller
                          name="settings.supplierId"
                          control={control}
                          render={({ field }) => (
                            <select
                              value={field.value}
                              onChange={field.onChange}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            >
                              <option value="">Select supplier</option>
                              {suppliers?.map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>
                                  {supplier.name}
                                </option>
                              )) || []}
                            </select>
                          )}
                        />
                        <Dialog
                          open={newSupplierDialog}
                          onOpenChange={setNewSupplierDialog}
                        >
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add New Supplier</DialogTitle>
                            </DialogHeader>
                            <NewSupplierForm onSubmit={addNewSupplier} />
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unit of Measurement
                      </label>
                      <Controller
                        name="settings.unit"
                        control={control}
                        render={({ field }) => (
                          <CreatableSelect
                            inputId="product-uom"
                            isClearable
                            isSearchable
                            isDisabled={creatingUom}
                            isLoading={creatingUom}
                            options={measureOptions}
                            value={selectedUomOption}
                            onChange={(opt) => {
                              if (!opt) {
                                field.onChange("");
                                setValue("settings.category", "");
                                return;
                              }
                              field.onChange(opt.unit);
                              setValue("settings.category", opt.category || "");
                            }}
                            onCreateOption={handleCreateUom}
                            formatCreateLabel={(input) =>
                              `Add unit "${input.trim()}"`
                            }
                            placeholder="Select a unit or type a new one…"
                            noOptionsMessage={() => "Type to add a new unit"}
                            styles={customSelectStyles}
                            menuPortalTarget={
                              typeof document !== "undefined"
                                ? document.body
                                : null
                            }
                            menuPosition="fixed"
                          />
                        )}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Choose an existing unit or type a new one and confirm to
                        save it for this facility.
                      </p>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tags/Categories
                      </label>
                      <input
                        type="text"
                        {...register("settings.tags")}
                        placeholder="e.g. electronics, gadgets, office"
                        onChange={(e) => {
                          const value = e.target.value;
                          // const tagsArray = value
                          //   ? value
                          //       .split(",")
                          //       .map((tag) => tag.trim())
                          //       .filter((tag) => tag)
                          //   : [];
                          setValue("settings.tags", value);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notes
                      </label>
                      <textarea
                        {...register("settings.notes")}
                        placeholder="Additional notes about this product/service"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </fieldset>

        {/* Action Buttons */}
        {!isViewMode && (
          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t mt-6 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              disabled={loading}
              className="order-2 flex w-full items-center justify-center gap-2 rounded-lg border-[var(--aa-navy)]/25 px-6 py-3 font-medium text-[var(--aa-navy)] shadow-none hover:bg-[var(--aa-sidebar-active)] sm:order-1 sm:w-auto"
            >
              <X className="w-5 h-5" />
              <span>Cancel</span>
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="order-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--aa-navy)] px-6 py-3 font-medium text-white shadow-none hover:bg-[var(--aa-navy-hover)] sm:order-2 sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>
                    {isEditMode
                      ? "Update Product/Service"
                      : "Save Product/Service"}
                  </span>
                </>
              )}
            </Button>
          </div>
        )}
      </form>

      {/* Product image upload modal */}
      <Dialog open={imageUploadOpen} onOpenChange={setImageUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Upload{" "}
              {watchedItemType === "Service" ? "service" : "product"} image
            </DialogTitle>
          </DialogHeader>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              readImageFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          {draftImagePreview ? (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border bg-slate-50">
                <img
                  src={draftImagePreview}
                  alt="Preview"
                  className="mx-auto max-h-72 w-full object-contain p-2"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shadow-none"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 size-4" />
                  Choose another
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shadow-none text-red-600 hover:text-red-700"
                  onClick={clearDraftImage}
                >
                  <Trash2 className="mr-1.5 size-4" />
                  Clear
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                setImageDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setImageDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setImageDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setImageDragOver(false);
                readImageFile(e.dataTransfer.files?.[0]);
              }}
              className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
                imageDragOver
                  ? "border-[var(--aa-accent,#2563eb)] bg-blue-50"
                  : "border-gray-300 bg-slate-50 hover:border-gray-400 hover:bg-slate-100/80"
              }`}
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-white border shadow-sm">
                <ImageIcon className="size-6 text-slate-500" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900">
                  Drag & drop an image here
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  or click to browse · JPG, PNG, WebP · max 5MB
                </span>
              </span>
            </button>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {imagePreview && (
              <Button
                type="button"
                variant="ghost"
                className="sm:mr-auto text-red-600 hover:text-red-700"
                onClick={removeCommittedImage}
              >
                Remove image
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="shadow-none"
              onClick={() => setImageUploadOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={applyImageFromModal}
              disabled={!draftImagePreview}
              className="bg-[var(--aa-navy)] text-white shadow-none hover:bg-[var(--aa-navy-hover)]"
            >
              Use image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Modal */}
      <ProductsUpload
        open={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        getInventory={null} // Not needed for this context
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
};

// Helper Components for Inline Creation
const NewAccountForm = ({ onSubmit }) => {
  const [formData, setFormData] = useState({ code: "", name: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.code && formData.name) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Account Code
        </label>
        <input
          type="text"
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
          placeholder="e.g., 4003"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Account Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., New Revenue Account"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <Button type="submit" className="w-full shadow-none">
        Add Account
      </Button>
    </form>
  );
};

const NewSupplierForm = () => {
  return <></>;
};

// PropTypes for helper components
NewAccountForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
};

export default ProductServiceForm;
