import { Input, Modal } from "antd";
import { toast } from "sonner";
import {
  MoreVerticalIcon,
  Upload,
  Plus,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  Package,
  DollarSign,
  ImageIcon,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import ProductsUpload from "./ProductsUpload";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiURL } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";

const ONLINE_ELIGIBLE_ITEM_TYPES = [
  "Resalable",
  "Service",
  "Finished Good",
  "By-Product",
];

/** Goods = stocked sellable items (Resalable / Finished Good / By-Product) */
const isGoodsItemType = (itemType) =>
  ["Resalable", "Finished Good", "By-Product"].includes(itemType);

/** Products & Services list: Goods + Service only (hide Raw Material / WIP types). */
const isProductListItemType = (itemType) =>
  isGoodsItemType(itemType) || itemType === "Service";

const resolveProductImageUrl = (src) => {
  if (!src) return "";
  const trimmed = String(src).trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:"))
    return trimmed;

  const uploadsIndex = trimmed.indexOf("/public/uploads/");
  if (uploadsIndex !== -1) {
    const uploadPath = trimmed.slice(uploadsIndex);
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const stored = new URL(trimmed);
        const api = new URL(apiURL);
        if (
          stored.host === api.host ||
          stored.hostname === "localhost" ||
          stored.hostname === "127.0.0.1"
        ) {
          return `${api.origin}${api.pathname.replace(/\/$/, "")}${uploadPath}`;
        }
      } catch {
        return trimmed;
      }
    }
    return `${apiURL}${uploadPath}`;
  }

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const apiOrigin = apiURL.replace(
    /\/(flowbooks|inventria_new|flowbooks_api|aa_erp_api)\/?$/,
    "",
  );

  if (
    trimmed.startsWith("/flowbooks/") ||
    trimmed.startsWith("/flowbooks/") ||
    trimmed.startsWith("/flowbooks_api/") ||
    trimmed.startsWith("/aa_erp_api/")
  ) {
    return `${apiOrigin}${trimmed}`;
  }

  if (trimmed.startsWith("/")) {
    return `${apiURL}${trimmed}`;
  }

  return trimmed;
};

const isOnlineEligible = (itemType) =>
  ONLINE_ELIGIBLE_ITEM_TYPES.includes(itemType);

export default function ProductList() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromUrl = Math.max(
    1,
    parseInt(searchParams.get("page") || "1", 10),
  );
  const pageSizeFromUrl = Math.max(
    1,
    Math.min(100, parseInt(searchParams.get("pageSize") || "10", 10)),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [itemTypeFilter, setItemTypeFilter] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showGrouping, setShowGrouping] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    productId: null,
    productName: "",
  });
  const [deleting, setDeleting] = useState(false);
  const [priceModal, setPriceModal] = useState({
    open: false,
    productId: null,
    productName: "",
    sellingPrice: "",
  });
  const [savingPrice, setSavingPrice] = useState(false);
  const [imagesModal, setImagesModal] = useState({
    open: false,
    productId: null,
    productName: "",
    images: [],
  });
  const [savingImages, setSavingImages] = useState(false);
  const [descriptionModal, setDescriptionModal] = useState({
    open: false,
    productId: null,
    productName: "",
    description: "",
  });
  const [savingDescription, setSavingDescription] = useState(false);

  const handlePageChange = useCallback(
    (page) => {
      setSearchParams(
        (prev) => {
          const currentPage = Math.max(
            1,
            parseInt(prev.get("page") || "1", 10),
          );
          if (page === currentPage) return prev;
          const next = new URLSearchParams(prev);
          next.set("page", String(page));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handlePageSizeChange = useCallback(
    (size) => {
      setSearchParams(
        (prev) => {
          const currentSize = Math.max(
            1,
            Math.min(100, parseInt(prev.get("pageSize") || "10", 10)),
          );
          if (size === currentSize) return prev;
          const next = new URLSearchParams(prev);
          next.set("pageSize", String(size));
          next.set("page", "1");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    const next = new URLSearchParams(searchParams);
    next.set("page", "1");
    setSearchParams(next, { replace: true });
  };

  const getProductImages = (item) => {
    if (Array.isArray(item?.product_images)) {
      return item.product_images.filter(Boolean);
    }
    if (
      typeof item?.product_images === "string" &&
      item.product_images.trim()
    ) {
      try {
        const parsed = JSON.parse(item.product_images);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        return [item.product_images];
      }
    }
    return item?.image_url ? [item.image_url] : [];
  };

  const getPrimaryImage = (item) => {
    const images = getProductImages(item);
    return item?.image_url || images[0] || null;
  };

  const getInventory = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);

    // Use the ORM-based products API
    fetch(`${apiURL}/api/products?facilityId=${activeBusiness.id}`)
      .then((response) => response.json())
      .then((resp) => {
        if (resp.success) {
          setData(resp.data || []);
        } else {
          toast.error("Failed to load products.");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
        setLoading(false);
      });
  }, [activeBusiness?.id]);

  const updateTaxableStatus = async (productId, currentTaxable) => {
    if (!activeBusiness?.id) return;

    const newTaxable = currentTaxable === "Taxable" ? "Not Taxable" : "Taxable";

    try {
      const response = await fetch(
        `${apiURL}/api/products/${productId}/taxable`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            taxable: newTaxable,
            facilityId: activeBusiness.id,
          }),
        },
      );

      const resp = await response.json();

      if (resp.success) {
        // Update the local state
        setData((prevData) =>
          prevData.map((item) =>
            item.id === productId ? { ...item, taxable: newTaxable } : item,
          ),
        );
        toast.success(`Product marked as ${newTaxable}`);
      } else {
        toast.error(resp.message || "Failed to update taxable status");
      }
    } catch (err) {
      console.error("API Error:", err);
      toast.error("Something went wrong while updating taxable status");
    }
  };

  const updateOnlineStatus = async (productId, currentOnline, itemType) => {
    if (!activeBusiness?.id) return;

    const newOnline = !(
      currentOnline === true ||
      currentOnline === "true" ||
      currentOnline === 1
    );

    if (newOnline && !isOnlineEligible(itemType)) {
      toast.error("Online is only available for Goods and Service items");
      return;
    }

    try {
      const response = await fetch(
        `${apiURL}/api/products/${productId}/online`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            online_enabled: newOnline,
            facilityId: activeBusiness.id,
          }),
        },
      );

      const resp = await response.json();

      if (resp.success) {
        setData((prevData) =>
          prevData.map((item) =>
            item.id === productId
              ? { ...item, online_enabled: newOnline }
              : item,
          ),
        );
        toast.success(`Product marked ${newOnline ? "Online" : "Offline"}`);
      } else {
        toast.error(resp.message || "Failed to update online status");
      }
    } catch (err) {
      console.error("API Error:", err);
      toast.error("Something went wrong while updating online status");
    }
  };

  const toggleProductStatus = async (productId, currentStatus) => {
    if (!activeBusiness?.id) return;
    try {
      const response = await fetch(
        `${apiURL}/api/products/${productId}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ facilityId: activeBusiness.id }),
        },
      );
      const resp = await response.json();
      if (resp.success) {
        const newStatus = resp.data.status;
        setData((prev) =>
          prev.map((item) =>
            item.id === productId ? { ...item, status: newStatus } : item,
          ),
        );
        toast.success(`Product marked as ${newStatus}`);
      } else {
        toast.error(resp.message || "Failed to update status");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while updating status");
    }
  };

  const openDeleteModal = (productId, productName) => {
    setDeleteModal({ open: true, productId, productName });
  };

  const openPriceModal = (item) => {
    setPriceModal({
      open: true,
      productId: item.id,
      productName: item.name,
      sellingPrice:
        item.selling_price != null && item.selling_price !== ""
          ? String(item.selling_price)
          : "",
    });
  };

  const saveProductPrice = async () => {
    const { productId, sellingPrice } = priceModal;
    if (!activeBusiness?.id || !productId) return;

    const price = parseFloat(String(sellingPrice).replace(/,/g, ""));
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setSavingPrice(true);
    try {
      const response = await fetch(
        `${apiURL}/api/products/${productId}/price`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            facilityId: activeBusiness.id,
            selling_price: price,
          }),
        },
      );
      const resp = await response.json();
      if (resp.success) {
        setData((prev) =>
          prev.map((item) =>
            item.id === productId ? { ...item, selling_price: price } : item,
          ),
        );
        toast.success("Product price updated");
        setPriceModal({
          open: false,
          productId: null,
          productName: "",
          sellingPrice: "",
        });
      } else {
        toast.error(resp.message || "Failed to update price");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while updating price");
    } finally {
      setSavingPrice(false);
    }
  };

  const openImagesModal = (item) => {
    setImagesModal({
      open: true,
      productId: item.id,
      productName: item.name,
      images: getProductImages(item),
    });
  };

  const handleAddProductImages = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const validFiles = files.filter((file) => {
      if (!file.type?.startsWith("image/")) {
        toast.error(`${file.name} is not a valid image`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5MB limit`);
        return false;
      }
      return true;
    });

    if (!validFiles.length) return;

    Promise.all(
      validFiles.map(
        (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }),
      ),
    )
      .then((newImages) => {
        setImagesModal((prev) => ({
          ...prev,
          images: [...prev.images, ...newImages.filter(Boolean)],
        }));
        toast.success(
          `${newImages.filter(Boolean).length} image${newImages.filter(Boolean).length === 1 ? "" : "s"} added`,
        );
      })
      .catch(() => toast.error("Failed to read image files"));
  };

  const removeProductImage = (index) => {
    setImagesModal((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const saveProductImages = async () => {
    const { productId, images } = imagesModal;
    if (!activeBusiness?.id || !productId) return;

    setSavingImages(true);
    try {
      const response = await fetch(
        `${apiURL}/api/products/${productId}/images`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            facilityId: activeBusiness.id,
            product_images: images,
            image_url: images[0] || null,
          }),
        },
      );
      const resp = await response.json();
      if (resp.success) {
        const updatedImages = resp.data?.product_images || images;
        const primaryImage = resp.data?.image_url || updatedImages[0] || null;
        setData((prev) =>
          prev.map((item) =>
            item.id === productId
              ? {
                  ...item,
                  product_images: updatedImages,
                  image_url: primaryImage,
                }
              : item,
          ),
        );
        toast.success("Product images updated");
        setImagesModal({
          open: false,
          productId: null,
          productName: "",
          images: [],
        });
      } else {
        toast.error(resp.message || "Failed to update images");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while updating images");
    } finally {
      setSavingImages(false);
    }
  };

  const openDescriptionModal = (item) => {
    setDescriptionModal({
      open: true,
      productId: item.id,
      productName: item.name,
      description: item.marketplace_description || "",
    });
  };

  const saveProductDescription = async () => {
    const { productId, description } = descriptionModal;
    if (!activeBusiness?.id || !productId) return;

    setSavingDescription(true);
    try {
      const response = await fetch(
        `${apiURL}/api/products/${productId}/description`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            facilityId: activeBusiness.id,
            marketplace_description: description,
          }),
        },
      );
      const resp = await response.json();
      if (resp.success) {
        const updatedDescription = resp.data?.marketplace_description || "";
        setData((prev) =>
          prev.map((item) =>
            item.id === productId
              ? { ...item, marketplace_description: updatedDescription }
              : item,
          ),
        );
        toast.success("Product description updated");
        setDescriptionModal({
          open: false,
          productId: null,
          productName: "",
          description: "",
        });
      } else {
        toast.error(resp.message || "Failed to update description");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while updating description");
    } finally {
      setSavingDescription(false);
    }
  };

  const confirmDeleteProduct = async () => {
    const { productId } = deleteModal;
    if (!activeBusiness?.id || !productId) return;
    setDeleting(true);
    try {
      const response = await fetch(
        `${apiURL}/api/products/${productId}?facilityId=${activeBusiness.id}`,
        { method: "DELETE" },
      );
      const resp = await response.json();
      if (resp.success) {
        setData((prev) => prev.filter((item) => item.id !== productId));
        toast.success("Product deleted successfully");
        setDeleteModal({ open: false, productId: null, productName: "" });
      } else {
        toast.error(resp.message || "Failed to delete product");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while deleting product");
    } finally {
      setDeleting(false);
    }
  };

  const createProductGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    if (selectedProducts.length === 0) {
      toast.error("Please select at least one product");
      return;
    }

    try {
      const response = await fetch(`${apiURL}/api/product-groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          facilityId: activeBusiness.id,
          name: groupName,
          productIds: selectedProducts,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Product group created successfully");
        setGroupModalOpen(false);
        setGroupName("");
        setSelectedProducts([]);
        setShowGrouping(false);
        getInventory(); // Refresh the data
      } else {
        toast.error(result.message || "Failed to create product group");
      }
    } catch (error) {
      console.error("Error creating product group:", error);
      toast.error("Something went wrong while creating product group");
    }
  };

  const handleProductSelection = (productId, isSelected) => {
    if (isSelected) {
      setSelectedProducts((prev) => [...prev, productId]);
    } else {
      setSelectedProducts((prev) => prev.filter((id) => id !== productId));
    }
  };

  const toggleSelectAll = () => {
    const finishedGoods = filteredData.filter(
      (item) => item.item_type === "Finished Good",
    );
    if (selectedProducts.length === finishedGoods.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(finishedGoods.map((item) => item.id));
    }
  };

  useEffect(() => {
    getInventory();
  }, [getInventory]);

  const catalogData = useMemo(
    () => data.filter((item) => isProductListItemType(item.item_type)),
    [data],
  );

  const displayItemType = (itemType) => {
    if (itemType === "Service") return "Service";
    if (isGoodsItemType(itemType)) return "Goods";
    return itemType || "—";
  };

  const filteredData = catalogData.filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    const typeLabel = displayItemType(item.item_type);
    const matchesSearch =
      item.name?.toLowerCase().includes(searchLower) ||
      item.sku?.toLowerCase().includes(searchLower) ||
      item.category?.toLowerCase().includes(searchLower) ||
      item.item_type?.toLowerCase().includes(searchLower) ||
      typeLabel?.toLowerCase().includes(searchLower);

    const matchesItemType =
      !itemTypeFilter || item.item_type === itemTypeFilter;

    return matchesSearch && matchesItemType;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredData.length / pageSizeFromUrl),
  );

  useEffect(() => {
    if (pageFromUrl > totalPages) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("page", String(totalPages));
          return next;
        },
        { replace: true },
      );
    }
  }, [pageFromUrl, totalPages, setSearchParams]);

  const pageItems = useMemo(() => {
    const startIdx = (pageFromUrl - 1) * pageSizeFromUrl;
    return filteredData.slice(startIdx, startIdx + pageSizeFromUrl);
  }, [filteredData, pageFromUrl, pageSizeFromUrl]);

  const renderRowActions = (item) => (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(`/app/inventory/product-list/view/${item.id}`)}
        className="h-8 w-8 p-0 text-[var(--aa-accent)] hover:bg-[var(--aa-sidebar-active)] hover:text-[var(--aa-accent-hover)]"
        title="View"
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(`/app/inventory/product-list/edit/${item.id}`)}
        className="h-8 w-8 p-0 text-[var(--aa-navy)] hover:bg-[var(--aa-sidebar-active)]"
        title="Edit"
      >
        <Edit className="h-4 w-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-500 hover:bg-[var(--aa-sidebar-active)] hover:text-[var(--aa-navy)]"
            title="More"
          >
            <MoreVerticalIcon className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() => openPriceModal(item)}
            className="flex items-center gap-2"
          >
            <DollarSign className="h-4 w-4" />
            Set Price
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openImagesModal(item)}
            className="flex items-center gap-2"
          >
            <ImageIcon className="h-4 w-4" />
            Product Images
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openDescriptionModal(item)}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Add Description
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => toggleProductStatus(item.id, item.status)}
            className="flex items-center gap-2"
          >
            <div
              className={`h-2 w-2 rounded-full ${
                item.status === "Active" ? "bg-emerald-500" : "bg-slate-400"
              }`}
            />
            {item.status === "Active" ? "Mark Inactive" : "Mark Active"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => openDeleteModal(item.id, item.name)}
            className="flex items-center gap-2 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
            Delete Product
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <>
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Product & Service Inventory
            </h1>
            <p className="text-gray-600">
              Manage your products, services, and inventory levels
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => navigate(`/app/inventory/product-list/new`)}
              className="flex items-center gap-2 bg-[var(--aa-navy)] px-6 py-2 font-medium text-white shadow-none transition-colors hover:bg-[var(--aa-navy-hover)]"
            >
              <Plus className="h-4 w-4" />
              Add Product/Service
            </Button>
            <Button
              variant="outline"
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 rounded-lg border-[var(--aa-navy)]/25 bg-white px-6 py-2 font-medium text-[var(--aa-navy)] shadow-none transition-colors hover:border-[var(--aa-navy)]/40 hover:bg-[var(--aa-sidebar-active)] hover:text-[var(--aa-navy)]"
            >
              <Upload className="h-4 w-4" />
              Bulk Upload
            </Button>
          </div>
        </div>
      </div>
      {/* Search and Filter Section */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-2">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <Input.Search
              placeholder="Search by name, SKU, category, or type..."
              onChange={(e) => handleSearchChange(e.target.value)}
              size="large"
              className="w-full"
              allowClear
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => getInventory()}
              className="flex items-center gap-2 border-[var(--aa-navy)]/25 text-[var(--aa-navy)] shadow-none hover:border-[var(--aa-navy)]/40 hover:bg-[var(--aa-sidebar-active)] hover:text-[var(--aa-navy)]"
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="rounded-lg border border-[var(--aa-accent)]/20 bg-[var(--aa-sidebar-active)] p-3">
            <div className="text-sm font-medium text-[var(--aa-accent)]">
              Goods
            </div>
            <div className="text-2xl font-bold text-[var(--aa-navy)]">
              {data.filter((item) => isGoodsItemType(item.item_type)).length}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--aa-navy)]/15 bg-white p-3">
            <div className="text-sm font-medium text-[var(--aa-navy)]">
              Service
            </div>
            <div className="text-2xl font-bold text-[var(--aa-navy)]">
              {data.filter((item) => item.item_type === "Service").length}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--aa-navy)]/20 bg-[var(--aa-navy)] p-3">
            <div className="text-sm font-medium text-white/80">
              Total Products
            </div>
            <div className="text-2xl font-bold text-white">
              {catalogData.length}
            </div>
          </div>
        </div>
      </div>

      <ProductsUpload
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        getInventory={getInventory}
      />

      {/* Products Table Section */}
      <div className="">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading products...</p>
            </div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchTerm ? "No products found" : "No products yet"}
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {searchTerm
                ? "No products match your search criteria. Try searching by name, SKU, category, or type."
                : "Get started by adding your first product or service to manage your inventory."}
            </p>
            {!searchTerm && (
              <Button
                onClick={() => navigate(`/app/inventory/product-list/new`)}
                className="mx-auto flex items-center gap-2 rounded-lg bg-[var(--aa-navy)] px-6 py-2 font-medium text-white shadow-none hover:bg-[var(--aa-navy-hover)]"
              >
                <Plus className="h-4 w-4" />
                Add Your First Product/Service
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--aa-navy)]/10 bg-[var(--aa-navy)] text-white">
                    <th className="w-12 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/70">
                      #
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                      Product
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                      Type
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                      Unit
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                      Selling Price
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                      Tax
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item, idx) => {
                    const primaryImage = getPrimaryImage(item);
                    const isTaxable =
                      item.taxable === "Taxable" || item.taxable === true;
                    const typeLabel = displayItemType(item.item_type);
                    const rowNum =
                      (pageFromUrl - 1) * pageSizeFromUrl + idx + 1;

                    return (
                      <tr
                        key={item.id || item.sku || rowNum}
                        className="border-b border-slate-100 transition-colors last:border-0 hover:bg-[var(--aa-sidebar-active)]/60"
                      >
                        <td className="px-4 py-3 align-middle text-slate-400">
                          {rowNum}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-3">
                            {primaryImage ? (
                              <img
                                src={resolveProductImageUrl(primaryImage)}
                                alt={item.name}
                                className="h-10 w-10 rounded-lg border border-slate-200 object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--aa-sidebar-bg)]">
                                <Package className="h-4 w-4 text-slate-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="truncate font-medium text-[var(--aa-navy)]">
                                {item.name}
                              </div>
                              <div className="truncate text-xs text-slate-500">
                                {item.sku || "No SKU"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                              typeLabel === "Service"
                                ? "bg-[var(--aa-sidebar-bg)] text-[var(--aa-navy)]"
                                : "bg-[var(--aa-sidebar-active)] text-[var(--aa-accent)]"
                            }`}
                          >
                            {typeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle text-slate-600">
                          {item.unit_of_measure || "—"}
                        </td>
                        <td className="px-4 py-3 align-middle text-right font-medium text-[var(--aa-navy)]">
                          {item.selling_price != null &&
                          item.selling_price !== ""
                            ? formatNumber1(Number(item.selling_price))
                            : "—"}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <button
                            type="button"
                            onClick={() =>
                              toggleProductStatus(item.id, item.status)
                            }
                            title="Click to toggle status"
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                              item.status === "Active"
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {item.status || "Active"}
                          </button>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <button
                            type="button"
                            onClick={() =>
                              updateTaxableStatus(item.id, item.taxable)
                            }
                            title="Click to toggle tax"
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                              isTaxable
                                ? "bg-[var(--aa-sidebar-active)] text-[var(--aa-accent)] hover:bg-[var(--aa-accent)]/15"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {isTaxable ? "Taxable" : "Not taxable"}
                          </button>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {renderRowActions(item)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-[var(--aa-sidebar-bg)]/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Showing{" "}
                <span className="font-medium text-slate-700">
                  {filteredData.length === 0
                    ? 0
                    : (pageFromUrl - 1) * pageSizeFromUrl + 1}
                  –
                  {Math.min(pageFromUrl * pageSizeFromUrl, filteredData.length)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-slate-700">
                  {filteredData.length}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Rows</span>
                  <Select
                    value={String(pageSizeFromUrl)}
                    onValueChange={(v) => handlePageSizeChange(Number(v))}
                  >
                    <SelectTrigger className="h-8 w-[72px] border-slate-200 bg-white text-xs shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 30, 50].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 border-[var(--aa-navy)]/20 p-0 text-[var(--aa-navy)] shadow-none hover:bg-[var(--aa-sidebar-active)]"
                    disabled={pageFromUrl <= 1}
                    onClick={() => handlePageChange(1)}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 border-[var(--aa-navy)]/20 p-0 text-[var(--aa-navy)] shadow-none hover:bg-[var(--aa-sidebar-active)]"
                    disabled={pageFromUrl <= 1}
                    onClick={() => handlePageChange(pageFromUrl - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[4.5rem] text-center text-xs text-slate-600">
                    {pageFromUrl} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 border-[var(--aa-navy)]/20 p-0 text-[var(--aa-navy)] shadow-none hover:bg-[var(--aa-sidebar-active)]"
                    disabled={pageFromUrl >= totalPages}
                    onClick={() => handlePageChange(pageFromUrl + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 border-[var(--aa-navy)]/20 p-0 text-[var(--aa-navy)] shadow-none hover:bg-[var(--aa-sidebar-active)]"
                    disabled={pageFromUrl >= totalPages}
                    onClick={() => handlePageChange(totalPages)}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              <span>Delete Product</span>
            </div>
          }
          open={deleteModal.open}
          onCancel={() =>
            setDeleteModal({ open: false, productId: null, productName: "" })
          }
          onOk={confirmDeleteProduct}
          okText="Delete"
          cancelText="Cancel"
          okButtonProps={{
            danger: true,
            loading: deleting,
          }}
          centered
        >
          <p className="text-gray-700">
            Are you sure you want to delete{" "}
            <strong>"{deleteModal.productName}"</strong>?
          </p>
          <p className="text-sm text-gray-500 mt-1">
            This action cannot be undone. Products with existing stock cannot be
            deleted.
          </p>
        </Modal>

        {/* Set Price Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <span>Set Price</span>
            </div>
          }
          open={priceModal.open}
          onCancel={() =>
            setPriceModal({
              open: false,
              productId: null,
              productName: "",
              sellingPrice: "",
            })
          }
          onOk={saveProductPrice}
          okText="Save Price"
          cancelText="Cancel"
          confirmLoading={savingPrice}
          centered
        >
          <p className="text-gray-600 mb-4">
            Set selling price for <strong>{priceModal.productName}</strong>
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selling Price (₦)
          </label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={priceModal.sellingPrice}
            onChange={(e) =>
              setPriceModal((prev) => ({
                ...prev,
                sellingPrice: e.target.value,
              }))
            }
            placeholder="Enter selling price"
            size="large"
            prefix="₦"
          />
        </Modal>

        {/* Product Images Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-blue-600" />
              <span>Product Images</span>
            </div>
          }
          open={imagesModal.open}
          onCancel={() =>
            setImagesModal({
              open: false,
              productId: null,
              productName: "",
              images: [],
            })
          }
          onOk={saveProductImages}
          okText="Save Images"
          cancelText="Cancel"
          confirmLoading={savingImages}
          centered
          width={640}
        >
          <p className="text-gray-600 mb-4">
            Manage images for <strong>{imagesModal.productName}</strong>. The
            first image is used as the primary product image.
          </p>

          <div className="mb-4">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleAddProductImages}
              className="hidden"
              id="product-list-images-upload"
            />
            <label
              htmlFor="product-list-images-upload"
              className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Add Images
            </label>
            <p className="text-xs text-gray-500 mt-2">
              PNG, JPG, or GIF. Max 5MB per image. You can select multiple
              files.
            </p>
          </div>

          {imagesModal.images.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
              <ImageIcon className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p>No images yet. Upload one or more product images.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-72 overflow-y-auto">
              {imagesModal.images.map((src, index) => (
                <div key={`${index}-${src.slice(0, 24)}`} className="relative">
                  <img
                    src={resolveProductImageUrl(src)}
                    alt={`Product ${index + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border bg-gray-50"
                  />
                  {index === 0 && (
                    <span className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeProductImage(index)}
                    className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 shadow-sm transition-colors hover:bg-red-50 hover:text-red-700"
                    title="Delete image"
                    aria-label={`Delete image ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>

        {/* Product Description Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              <span>Product Description</span>
            </div>
          }
          open={descriptionModal.open}
          onCancel={() =>
            setDescriptionModal({
              open: false,
              productId: null,
              productName: "",
              description: "",
            })
          }
          onOk={saveProductDescription}
          okText="Save Description"
          cancelText="Cancel"
          confirmLoading={savingDescription}
          centered
          width={560}
        >
          <p className="text-gray-600 mb-4">
            Add a description for{" "}
            <strong>{descriptionModal.productName}</strong>. Shown when the item
            is Online for customers.
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <Input.TextArea
            rows={6}
            value={descriptionModal.description}
            onChange={(e) =>
              setDescriptionModal((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
            placeholder="Describe this item for Online customers..."
            maxLength={2000}
            showCount
          />
        </Modal>

        {/* Create Group Modal */}
        <Modal
          title="Create Product Group"
          open={groupModalOpen}
          onOk={createProductGroup}
          onCancel={() => {
            setGroupModalOpen(false);
            setGroupName("");
          }}
          okText="Create Group"
          cancelText="Cancel"
        >
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Group Name
            </label>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name..."
              className="w-full"
            />
          </div>
          <div className="text-sm text-gray-600 mb-2">
            Selected products: {selectedProducts.length}
          </div>
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full divide-y divide-gray-200 border rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                    #
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                    Product
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                    SKU
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                    Category
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {data
                  .filter((item) => selectedProducts.includes(item.id))
                  .map((item, idx) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-center">{idx + 1}</td>
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2">{item.sku}</td>
                      <td className="px-3 py-2">{item.category}</td>
                      <td className="px-3 py-2">{item.item_type}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Modal>
      </div>
    </>
  );
}
