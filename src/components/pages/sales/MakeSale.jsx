/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Col, Label, Row, Container, Card, CardBody } from "reactstrap";
import { toast } from "sonner";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { v4 as UUIDV4 } from "uuid";
import moment from "moment";

/** Remaining sales-limit qty for a product (facility-wide). null = unlimited. */
function getSalesLimitRemaining(product) {
  if (!product) return null;
  if (
    product.sales_limit_remaining == null ||
    product.sales_limit_remaining === ""
  ) {
    return null;
  }
  const n = Number(product.sales_limit_remaining);
  return Number.isFinite(n) ? n : null;
}

function isSalesStopped(product) {
  if (!product) return false;
  return (
    product.sales_stopped === true ||
    product.sales_stopped === 1 ||
    product.sales_stopped === "1"
  );
}

function salesLimitPeriodLabel(period) {
  if (period === "daily") return "daily";
  if (period === "weekly") return "weekly";
  if (period === "monthly") return "monthly";
  return "sales";
}

function cartQtyForSku(cart, sku, excludeId) {
  if (!sku) return 0;
  return (cart || [])
    .filter(
      (item) =>
        item.id !== excludeId &&
        String(item.product_id) === String(sku),
    )
    .reduce((sum, item) => sum + parseFloat(item.quantity_sold || item.quantity || 0), 0);
}

/** Max qty allowed on a cart line after sales target (+ optional stock). null = no cap. */
function getMaxQtyForLine(item, cart, { allowWithoutStock = true, catalog = [] } = {}) {
  if (!item) return null;
  const sku = item.product_id || item.sku;
  let remaining = getSalesLimitRemaining(item);
  let period = item.sales_limit_period ?? null;
  if (remaining == null && sku && catalog.length) {
    const match = catalog.find(
      (p) =>
        String(p.product_id || p.sku || "") === String(sku) ||
        String(p.id) === String(item.id),
    );
    if (match) {
      remaining = getSalesLimitRemaining(match);
      period = match.sales_limit_period ?? period;
    }
  }

  let max = Infinity;
  if (remaining != null) {
    const other = cartQtyForSku(cart, sku, item.id);
    max = Math.min(max, Math.max(0, remaining - other));
  }

  if (!allowWithoutStock && item.item_type !== "Service") {
    const stock = parseFloat(item.balance);
    if (Number.isFinite(stock)) {
      const otherSameBatch = (cart || [])
        .filter(
          (c) =>
            c.id !== item.id &&
            String(c.product_id) === String(sku) &&
            c.expiry_date === item.expiry_date,
        )
        .reduce(
          (sum, c) => sum + parseFloat(c.quantity_sold || c.quantity || 0),
          0,
        );
      max = Math.min(max, Math.max(0, stock - otherSameBatch));
    }
  }

  if (!Number.isFinite(max) || max === Infinity) {
    return { max: null, remaining, period };
  }
  return { max, remaining, period };
}

// Components
import CartList from "./make-sales/CartList";
import ItemSelection from "./make-sales/ItemSelection";

// Redux Actions
import { getStoresList } from "@/redux/actions/stores";
import { getPurchasedItems } from "@/redux/actions/purchase";
import { saveTransaction } from "@/redux/actions/transactions";
import { saveNewCustomer, getCustomers } from "@/redux/actions/customer";

// API and Utils
import { _fetchApi, _postApi } from "@/redux/actions/api";
import {
  CASH,
  MODES_OF_PAYMENT,
  PAYABLE,
  STORE,
  TRANSACTION_TYPES,
} from "@/constants";
import { formatNumber1 } from "@/components/router/utilities";
import {
  PrinterIcon,
  Check,
  X,
  Package,
  Tag,
  Search,
  Plus,
  Minus,
  ChevronUp,
  ChevronDown,
  Trash2,
  ShoppingCart,
  User,
  CheckCircle,
  Edit,
  AlertCircle,
  Info,
  DollarSign,
  Loader,
  ScanLine,
  FileText,
} from "lucide-react";
import useScanDetection from "@/hooks/useScanDetection";
import { Button, Table } from "reactstrap";
import { Typeahead } from "react-bootstrap-typeahead";
import SearchCustomerInput from "@/components/pages/customer/components/SearchCustomerInput";
import CustomerRegistartion from "@/components/pages/customer/CustomerRegistration";
import CreditSaleInvoicePDFViewer from "./CreditSaleInvoicePDF";
import CreditSaleInvoiceImproved from "./CreditSaleInvoiceImproved";
import CreditSaleTaxDiscountPanel from "./CreditSaleTaxDiscountPanel";

/** Normalize tax inclusive/exclusive flags (DB may vary in casing). */
function isTaxInclusive(tax, vatPolicy = "vat_exclusive") {
  const inc = String(tax?.inclusive_type || "").toLowerCase();
  const typ = String(tax?.tax_type || "").toLowerCase();
  if (inc === "inclusive") return true;
  if (inc === "exclusive") return false;
  if (typ === "inclusive") return true;
  if (typ === "exclusive") return false;
  return vatPolicy === "vat_inclusive";
}

function isOutputVatTax(tax) {
  const description = (tax?.description || "").toLowerCase();
  return (
    description.includes("vat") ||
    description.includes("output vat") ||
    description.includes("value added tax")
  );
}
import { useAdvancePaymentAccounts } from "@/components/common/useAdvancePaymentAccounts";
// import DepartmentSelect from "@/components/common/DepartmentSelect";

const normalizeScannedCode = (value) =>
  String(value ?? "")
    .replace(/[\r\n\t]/g, "")
    .trim();

const productMatchesScanCode = (item, code) => {
  if (!code || !item) return false;
  const normalized = code.toLowerCase();
  const candidates = [
    item.sku,
    item.item_code,
    item.product_id,
    item.id,
    item.barcode,
    item.name,
    item.item_name,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());
  return candidates.includes(normalized);
};

/**
 * True when the user is actively typing into a text field (search, qty, rate,
 * customer, etc). In that case the global scan-detection should stay out of the
 * way — no auto-add and no "incomplete scan" toast.
 */
const isMakeSaleTypingTarget = (element = document.activeElement) => {
  if (!element) return false;
  const tag = element.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const type = (element.getAttribute("type") || "text").toLowerCase();
    return !["checkbox", "radio", "button", "submit", "file"].includes(type);
  }
  return element.isContentEditable === true;
};

// Skeleton Card Component
function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border-2 border-transparent animate-pulse">
      <div className="bg-gray-200 p-6 h-32"></div>
      <div className="p-4">
        <div className="h-4 bg-gray-200 rounded mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-6 bg-gray-200 rounded w-3/4 mt-3"></div>
        <div className="h-3 bg-gray-200 rounded w-1/3 mt-2"></div>
      </div>
    </div>
  );
}

// Invoice Preview Component
function InvoicePreviewComponent({
  invoiceData,
  onConfirm,
  onCancel,
  customPricing,
  setCustomPricing,
  customPrices,
  setCustomPrices,
  customerCopyEnabled,
  setCustomerCopyEnabled,
  customerCopyPrices,
  setCustomerCopyPrices,
}) {
  const {
    customer,
    items,
    subtotal,
    totalTax,
    totalAmount,
    taxes,
    business,
    date,
    discount,
  } = invoiceData;

  // Calculate customer copy totals
  const customerCopySubtotal = customerCopyEnabled
    ? items.reduce((sum, item) => {
        const price =
          customerCopyPrices[item.id] !== undefined
            ? customerCopyPrices[item.id]
            : item.selling_price;
        return sum + price * item.quantity_sold;
      }, 0)
    : subtotal;

  const customerCopyTotalTax = customerCopyEnabled
    ? (customerCopySubtotal *
        parseFloat(
          taxes?.reduce((sum, tax) => sum + parseFloat(tax.rate), 0) || 0,
        )) /
      100
    : totalTax;

  const customerCopyTotalAmount = customerCopyEnabled
    ? customerCopySubtotal + customerCopyTotalTax
    : totalAmount;

  return (
    <Container fluid className="p-3">
      {/* Print Styles */}
      <style>
        {`
          @media print {
            .no-print {
              display: none !important;
            }
            .invoice-container {
              padding: 20px;
            }
            @page {
              margin: 20mm;
            }
          }
        `}
      </style>

      {/* Action Buttons */}
      <div className="d-flex justify-content-between align-items-center mb-3 no-print">
        <div className="d-flex gap-2">
          <Button
            color={customerCopyEnabled ? "info" : "outline-info"}
            onClick={() => setCustomerCopyEnabled(!customerCopyEnabled)}
          >
            <Edit size={16} className="me-2" />
            {customerCopyEnabled ? "Hide Customer Copy" : "Customer Copy"}
          </Button>
        </div>
        <div className="d-flex gap-2">
          <Button color="secondary" onClick={onCancel}>
            <X size={16} className="me-2" />
            Cancel
          </Button>
          <Button color="primary" onClick={() => window.print()}>
            <PrinterIcon size={16} className="me-2" />
            Print
          </Button>
          <Button color="success" onClick={onConfirm}>
            <Check size={16} className="me-2" />
            Confirm Sale
          </Button>
        </div>
      </div>

      {/* Invoice Container */}
      <div className="invoice-container bg-white p-4 border rounded">
        {/* Invoice Title */}
        <div className="text-center mb-4">
          <h4 className="mb-0">CREDIT SALE INVOICE</h4>
          <p className="small mb-0">Invoice #: {invoiceData.transaction?.id}</p>
          <p className="small mb-0">
            Date: {moment(date).format("MMMM DD, YYYY hh:mm A")}
          </p>
        </div>

        {/* Customer Details */}
        <div className="row mb-4">
          <div className="col-md-6">
            <h6 className="mb-2">Bill To:</h6>
            <p className="mb-0">
              <strong>{customer?.customer_name || customer?.fullname}</strong>
            </p>
            {customer?.address && (
              <p className="mb-0 small">{customer.address}</p>
            )}
            {customer?.phone && (
              <p className="mb-0 small">Phone: {customer.phone}</p>
            )}
            {customer?.email && (
              <p className="mb-0 small">Email: {customer.email}</p>
            )}
            {customer?.customerNo && (
              <p className="mb-0 small">Customer #: {customer.customerNo}</p>
            )}
          </div>
          <div className="col-md-6 text-right">
            <h6 className="mb-2">Payment Terms:</h6>
            <p className="mb-0">
              <span className="badge badge-warning">CREDIT SALE</span>
            </p>
            <p className="mb-0 small text-muted">Payment on Account</p>
          </div>
        </div>

        {/* Items Table */}
        <Table bordered className="mb-4">
          <thead className="bg-light">
            <tr>
              <th>#</th>
              <th>Item Description</th>
              <th className="text-center">Qty</th>
              <th className="text-right">Unit Price</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, index) => {
              const displayPrice =
                customPricing && customPrices[item.id] !== undefined
                  ? customPrices[item.id]
                  : item.selling_price;
              const displayAmount = displayPrice * item.quantity_sold;

              const customerPrice =
                customerCopyEnabled && customerCopyPrices[item.id] !== undefined
                  ? customerCopyPrices[item.id]
                  : item.selling_price;
              const customerAmount = customerPrice * item.quantity_sold;

              return (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>
                      {item.item_name} {item.multiplier_type}
                    </strong>
                    <br />
                    <small className="text-muted">{item.uom_category}</small>
                  </td>
                  <td className="text-center">{item.quantity_sold}</td>
                  <td className="text-right">
                    {customerCopyEnabled ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={
                          customerCopyPrices[item.id] !== undefined
                            ? customerCopyPrices[item.id]
                            : item.selling_price
                        }
                        onChange={(e) => {
                          const newPrice = parseFloat(e.target.value) || 0;
                          setCustomerCopyPrices((prev) => ({
                            ...prev,
                            [item.id]: newPrice,
                          }));
                        }}
                        className="form-control form-control-sm text-end"
                        style={{ width: "100px" }}
                      />
                    ) : (
                      `₦${formatNumber1(item.selling_price)}`
                    )}
                  </td>
                  <td className="text-right">
                    ₦{formatNumber1(displayAmount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>

        {/* Totals */}
        <div className="row">
          <div className="col-md-6"></div>
          <div className="col-md-6">
            <Table borderless size="sm">
              <tbody>
                <tr>
                  <td className="text-right">
                    <strong>Subtotal:</strong>
                  </td>
                  <td className="text-right">
                    {customerCopyEnabled
                      ? `₦${formatNumber1(customerCopySubtotal)}`
                      : `₦${formatNumber1(subtotal)}`}
                  </td>
                </tr>

                {/* Discount */}
                {discount && discount.amount > 0 && (
                  <tr>
                    <td className="text-right">
                      <strong>
                        Discount {discount.name ? `(${discount.name})` : ""} (
                        {discount.type === "percentage"
                          ? `${discount.value}%`
                          : "Fixed"}
                        ):
                      </strong>
                    </td>
                    <td className="text-right text-danger">
                      -₦{formatNumber1(discount.amount)}
                    </td>
                  </tr>
                )}

                {/* Tax Details */}
                {taxes && taxes.length > 0 && (
                  <>
                    {taxes.map((tax) => (
                      <tr key={tax.id}>
                        <td className="text-right">
                          <strong>
                            {tax.description} ({tax.rate}% {tax.tax_type}):
                          </strong>
                        </td>
                        <td className="text-right">
                          ₦
                          {formatNumber1(
                            (subtotal * parseFloat(tax.rate)) / 100,
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="text-right">
                        <strong>Total VAT:</strong>
                      </td>
                      <td className="text-right">₦{formatNumber1(totalTax)}</td>
                    </tr>
                  </>
                )}

                <tr className="border-top">
                  <td className="text-right">
                    <h5 className="mb-0">Total Amount:</h5>
                  </td>
                  <td className="text-right">
                    <h5 className="mb-0">
                      {customerCopyEnabled
                        ? `₦${formatNumber1(customerCopyTotalAmount)}`
                        : `₦${formatNumber1(totalAmount)}`}
                    </h5>
                  </td>
                </tr>

                <tr className="bg-warning">
                  <td className="text-right">
                    <strong>Amount Due:</strong>
                  </td>
                  <td className="text-right">
                    <strong>
                      {customerCopyEnabled
                        ? `₦${formatNumber1(customerCopyTotalAmount)}`
                        : `₦${formatNumber1(totalAmount)}`}
                    </strong>
                  </td>
                </tr>
              </tbody>
            </Table>
          </div>
        </div>

        {/* Payment Information */}
        <div className="alert alert-warning mb-4">
          <h6 className="mb-2">Payment Information:</h6>
          <p className="mb-0">
            This is a <strong>CREDIT SALE</strong>. The total amount of{" "}
            <strong>₦{formatNumber1(totalAmount)}</strong>
            {discount && discount.amount > 0 && (
              <span>
                {" "}
                (after {discount.name ? `${discount.name} - ` : ""}
                {discount.type === "percentage"
                  ? `${discount.value}%`
                  : `₦${formatNumber1(discount.value)}`}{" "}
                discount)
              </span>
            )}{" "}
            has been added to the customer&apos;s account receivable balance.
            Payment is expected according to your agreed terms.
          </p>
          {customerCopyEnabled && (
            <p className="mb-0 mt-2">
              <strong>Note:</strong> Customer copy shows different pricing (₦
              {formatNumber1(customerCopyTotalAmount)}) for reference only.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-5 pt-4 border-top">
          <p className="mb-0 small text-muted">Thank you for your business!</p>
          <p className="mb-0 small text-muted">
            This is a computer-generated invoice and does not require a
            signature.
          </p>
          <p className="mb-0 small text-muted">
            Generated on {moment().format("MMMM DD, YYYY hh:mm:ss A")}
          </p>
        </div>
      </div>
    </Container>
  );
}

function MakeSale() {
  // Redux State
  const buz_id = useSelector(
    (state) => state.auth.activeBusiness.business_admin,
  );
  const user_id = useSelector((state) => state.auth.user);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const vatPolicy = activeBusiness?.vat_policy || "vat_exclusive";
  const allowSalesWithoutStock =
    activeBusiness?.allow_sales_without_stock || false;
  const check = parseInt(buz_id) === parseInt(user_id.id);
  const [activeStore, setActiveStore] = useState(user_id.branch_name);

  // Managerial roles that can select any branch
  const MANAGERIAL_ROLES = [
    "Admin",
    "admin",
    "Store Owner",
    "Manager",
    "manager",
    "Management",
    "super_admin",
    "superAdmin",
    "Super Administrator",
  ];

  const isManagerial = MANAGERIAL_ROLES.includes(user_id?.role);
  const isStoreKeeper = user_id?.role === "Store Keeper";
  const isRestricted = !isManagerial || isStoreKeeper;

  /** Branch ids assigned to the logged-in staff (multi). */
  const userBranchIds = useMemo(() => {
    if (Array.isArray(user_id?.branchIds) && user_id.branchIds.length > 0) {
      return user_id.branchIds.map(Number).filter(Boolean);
    }
    if (Array.isArray(user_id?.branches) && user_id.branches.length > 0) {
      return user_id.branches
        .map((b) => Number(b.id || b.branch_id))
        .filter(Boolean);
    }
    if (user_id?.branchId) return [Number(user_id.branchId)];
    return [];
  }, [user_id?.branchIds, user_id?.branches, user_id?.branchId]);

  const hasAssignedBranches = userBranchIds.length > 0;
  /**
   * The branch select only ever shows branches assigned to the user.
   * A user with a single assigned branch is locked to it; with several they
   * can switch between their own branches only.
   */
  const isBranchLocked = hasAssignedBranches && userBranchIds.length === 1;

  // Navigation
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Form State
  const initialForm = useMemo(
    () => ({
      item_name: "",
      quantity_sold: "1",
      store_name: activeStore,
      item_subhead: "",
    }),
    [activeStore],
  );

  // Refs
  const qttyRef = useRef();
  const itemNameRef = useRef();
  const searchInputRef = useRef(null);
  const resolveProductFromScanRef = useRef(null);
  // Guard flag to prevent duplicate checkout/save requests
  const isSavingRef = useRef(false);
  // Grand total is defined later via useMemo; checkout reads this at call time
  const totalRef = useRef(0);

  // Component State
  const [form, setForm] = useState(initialForm);
  const [cart, setCart] = useState([]);
  // In-progress text for invoice-line qty inputs, keyed by cart item id.
  // Lets a row's qty be cleared while typing; on blur it falls back to 1.
  const [lineQtyDrafts, setLineQtyDrafts] = useState({});
  const [readyForSalesItems, setReadyForSalesItems] = useState([]);
  // Multiple branches can be selected; one credit sale is created per branch.
  // The first selected branch is the "primary" one that drives stock loading,
  // item selection and the line/card display.
  const [selectedBranches, setSelectedBranches] = useState(
    hasAssignedBranches ? [String(userBranchIds[0])] : [],
  );
  const selectedBranch = selectedBranches[0] || "";
  const [branches, setBranches] = useState([]);

  // Strict branch access: a user only ever sees the branches assigned to them.
  const assignedBranches = useMemo(
    () => branches.filter((b) => userBranchIds.includes(Number(b.id))),
    [branches, userBranchIds],
  );

  const selectedBranchLocation = useMemo(() => {
    if (!selectedBranch || selectedBranch === "all") return "";
    const match = branches.find((b) => String(b.id) === String(selectedBranch));
    return String(
      match?.branch_name || match?.storeName || match?.branch_id || "",
    );
  }, [selectedBranch, branches]);

  const getItemBranchLocation = useCallback(
    (item) => {
      if (item?.location_name) return String(item.location_name);

      // Prefer resolving the real branch from the product's branch id.
      // The raw branch_name on sales rows can contain store-type text like
      // "for sales", so it is not reliable as a location label.
      const itemBranchId = item?.branchId || item?.branch_id;
      if (itemBranchId) {
        const match = branches.find(
          (b) => String(b.id) === String(itemBranchId),
        );
        if (match) {
          return String(
            match.branch_name || match.storeName || match.branch_id || "",
          );
        }
      }

      if (
        item?.branch_name &&
        String(item.branch_name).toLowerCase() !== "for sales"
      ) {
        return String(item.branch_name);
      }

      return selectedBranchLocation || "";
    },
    [branches, selectedBranchLocation],
  );

  const handleBranchesChange = (opts) => {
    let nextIds = (opts || []).map((o) => String(o.value));

    // A user with assigned branches may only pick their own branches.
    if (hasAssignedBranches) {
      const allowed = nextIds.filter((id) =>
        userBranchIds.includes(Number(id)),
      );
      if (allowed.length !== nextIds.length) {
        toast.error("You don't have access to one or more of those warehouses.");
      }
      nextIds = allowed;
    }

    // Items are fetched per selected branch, so dropping a branch invalidates
    // any cart lines that came from it. Keep the rest instead of clearing all.
    const allowedSet = new Set(nextIds.map((id) => Number(id)));
    setCart((prev) => {
      const kept = prev.filter(
        (it) => it.branchId == null || allowedSet.has(Number(it.branchId)),
      );
      if (kept.length !== prev.length) {
        toast.info("Removed cart items from de-selected warehouse(s).");
      }
      return kept;
    });
    setLineQtyDrafts({});

    setSelectedBranches(nextIds);
  };

  // Single-select wrapper for the Branch/Location dropdown.
  const handleSingleBranchChange = (value) => {
    handleBranchesChange(value ? [{ value: String(value) }] : []);
  };
  const [serviceProducts, setServiceProducts] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [selectedTaxes, setSelectedTaxes] = useState([]);
  const salesTaxes = useMemo(
    () =>
      (taxes || []).filter((tax) => {
        const category = (tax.tax_category || tax.category || "")
          .toString()
          .toLowerCase();
        return category === "sales" || category === "sale";
      }),
    [taxes],
  );

  // Filter Output VAT taxes (taxes with "VAT" or "Output VAT" in description)
  const outputVATTaxes = useMemo(
    () =>
      salesTaxes.filter((tax) => {
        const description = (tax.description || "").toLowerCase();
        return (
          description.includes("vat") ||
          description.includes("output vat") ||
          description.includes("value added tax")
        );
      }),
    [salesTaxes],
  );
  const [showServices, setShowServices] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [otherInfo, setOtherInfo] = useState({});
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);

  // Loading states
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingTaxes, setLoadingTaxes] = useState(true);
  const [processingCheckout, setProcessingCheckout] = useState(false);

  // New UI State
  const [activeTab, setActiveTab] = useState("products");
  const [searchTerm, setSearchTerm] = useState("");
  const [lastScanPreview, setLastScanPreview] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [quantityFormatted, setQuantityFormatted] = useState("1.0000");
  /** Always matches the quantity field so add-to-cart reads the latest value (avoids stale closure after first line item). */
  const quantityFormattedRef = useRef("1.0000");
  quantityFormattedRef.current = quantityFormatted;
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [discountType, setDiscountType] = useState("percentage"); // 'percentage' or 'fixed'
  const [discountValue, setDiscountValue] = useState(0);
  const [availableDiscounts, setAvailableDiscounts] = useState([]);
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  // const [customDiscount, setCustomDiscount] = useState(false);
  const [customPricing, setCustomPricing] = useState(false);
  const [customPrices, setCustomPrices] = useState({});
  const [customerCopyEnabled, setCustomerCopyEnabled] = useState(false);
  const [customerCopyPrices, setCustomerCopyPrices] = useState({});
  const [selectedOutputVAT, setSelectedOutputVAT] = useState([]); // Array of selected Output VAT tax IDs

  // Invoice view: default lines; use ?view=cards for card view
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search || "");
  const invoiceViewMode =
    searchParams.get("view") === "cards" ? "cards" : "lines";
  const [selectedLineItemId, setSelectedLineItemId] = useState("");
  // Invoice lines view: default 2 empty rows (Product + Service); extra rows when "+ Add Line" is clicked
  const [extraEmptyLineRows, setExtraEmptyLineRows] = useState(0);
  /** Per empty-row line type so Product vs Service can differ per row (lines view). */
  const [emptyRowLineTypes, setEmptyRowLineTypes] = useState([
    "products",
    "services",
  ]);

  // Transaction / invoice dates and terms
  const [transactionDate, setTransactionDate] = useState(
    moment().format("YYYY-MM-DD"),
  );
  const [invoiceTerms, setInvoiceTerms] = useState("Net 30");
  const [dueDate, setDueDate] = useState(
    moment().add(30, "days").format("YYYY-MM-DD"),
  );
  /** Paid now via cash, transfer, or both (split). */
  const [saleType, setSaleType] = useState("paid");
  const [payWithCash, setPayWithCash] = useState(true);
  const [payWithTransfer, setPayWithTransfer] = useState(false);
  const [cashPayAmount, setCashPayAmount] = useState("");
  const [transferPayAmount, setTransferPayAmount] = useState("");
  /** Mode of payment: cash | transfer | both | credit | credit_split | deposit */
  const [modeOfPayment, setModeOfPayment] = useState("cash");
  const [chequeNumber, setChequeNumber] = useState("");

  const applyPaymentMode = useCallback((mode) => {
    setModeOfPayment(mode);
    if (mode === "deposit") {
      // Create invoice like credit, then open Apply Deposit after save
      setSaleType("credit");
      setPayWithCash(false);
      setPayWithTransfer(false);
      return;
    }
    if (mode === "credit") {
      setSaleType("credit");
      setPayWithCash(false);
      setPayWithTransfer(false);
      return;
    }
    setSaleType("paid");
    if (mode === "cash") {
      setPayWithCash(true);
      setPayWithTransfer(false);
    } else if (mode === "transfer") {
      setPayWithCash(false);
      setPayWithTransfer(true);
    } else {
      // both | credit_split → cash + transfer at cashier
      setPayWithCash(true);
      setPayWithTransfer(true);
    }
  }, []);
  const [invoiceNumberDisplay] = useState(
    () => `INV-${moment().format("YYMMDD")}-DRAFT`,
  );
  // Zoho-style invoice extras — defaults come from business table
  const [customerNotes, setCustomerNotes] = useState(
    () =>
      activeBusiness?.customer_notes ||
      "Thanks for your business.",
  );
  const [termsConditions, setTermsConditions] = useState(
    () => activeBusiness?.terms_conditions || "",
  );
  const [zohoDiscountPercent, setZohoDiscountPercent] = useState("");
  const [zohoDiscountMode, setZohoDiscountMode] = useState("%");

  // Keep notes/terms in sync with the active business defaults.
  useEffect(() => {
    setCustomerNotes(
      activeBusiness?.customer_notes || "Thanks for your business.",
    );
    setTermsConditions(activeBusiness?.terms_conditions || "");
  }, [
    activeBusiness?.id,
    activeBusiness?.customer_notes,
    activeBusiness?.terms_conditions,
  ]);

  const isPaidSale = saleType === "paid";
  const cashPayAccounts = useAdvancePaymentAccounts(
    isPaidSale && payWithCash,
    activeBusiness?.id,
    "cash",
  );
  const transferPayAccounts = useAdvancePaymentAccounts(
    isPaidSale && payWithTransfer,
    activeBusiness?.id,
    "bank",
  );
  const accountHead = cashPayAccounts.accountHead;
  const setAccountHead = cashPayAccounts.setAccountHead;
  const bankAccount = transferPayAccounts.bankAccount;
  const setBankAccount = transferPayAccounts.setBankAccount;
  const accountList = transferPayAccounts.accountList;
  const headList = cashPayAccounts.headList;

  // Auto-pick default cash / bank accounts (Receive payment UI removed).
  useEffect(() => {
    if (!payWithCash || !headList.length) return;
    if (accountHead?.head) return;
    const row = headList[0];
    setAccountHead({
      head: row.head,
      description: row.description || "",
    });
  }, [payWithCash, headList, accountHead?.head, setAccountHead]);

  useEffect(() => {
    if (!payWithTransfer || !accountList.length) return;
    if (bankAccount?.id) return;
    setBankAccount(accountList[0]);
  }, [payWithTransfer, accountList, bankAccount?.id, setBankAccount]);

  useEffect(() => {
    if (modeOfPayment !== "cheque") setChequeNumber("");
  }, [modeOfPayment]);

  useEffect(() => {
    if (saleType === "paid") {
      setInvoiceTerms("Due on receipt");
      if (!payWithCash && !payWithTransfer) {
        setPayWithCash(true);
      }
    } else {
      setInvoiceTerms((prev) =>
        prev === "Due on receipt" ? "Net 30" : prev,
      );
    }
  }, [saleType]);

  /** Cart list above or below transaction date in the right sidebar (cards view). */
  const [cartAboveTransactionDate, setCartAboveTransactionDate] = useState(
    () => {
      try {
        return localStorage.getItem("makeSale_cartAboveDate") === "true";
      } catch {
        return false;
      }
    },
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        "makeSale_cartAboveDate",
        String(cartAboveTransactionDate),
      );
    } catch {
      /* ignore */
    }
  }, [cartAboveTransactionDate]);

  // Automatically derive due date from invoice date + terms (e.g. Net 30)
  useEffect(() => {
    const termDaysMap = {
      "Due on receipt": 0,
      "Net 15": 15,
      "Net 30": 30,
      "Net 60": 60,
    };

    const daysToAdd = termDaysMap[invoiceTerms] ?? 30;
    const baseDate = transactionDate || moment().format("YYYY-MM-DD");

    setDueDate(
      moment(baseDate, "YYYY-MM-DD")
        .add(daysToAdd, "days")
        .format("YYYY-MM-DD"),
    );
  }, [transactionDate, invoiceTerms]);

  // Keep empty-row type array length in sync with visible empty rows (2 + extra)
  useEffect(() => {
    const len = Math.max(0, 2 + extraEmptyLineRows);
    setEmptyRowLineTypes((prev) => {
      const next = prev.slice(0, len);
      while (next.length < len) next.push("products");
      return next;
    });
  }, [extraEmptyLineRows]);

  // Number formatting functions (same as JournalEntryForm)
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
    }
    if (endsWithDot) {
      // Preserve "." alone or "1,234." while typing decimals
      return integerPart ? `${formattedInteger}.` : ".";
    }
    return formattedInteger;
  };

  const parseNumberFromFormatted = (value) => {
    if (!value || value === "") return "";
    // Remove commas and keep only numbers and decimal point
    return value.replace(/,/g, "");
  };

  const handleNumericInput = (value) => {
    // Allow numbers, dots, and commas
    return value.replace(/[^0-9.,]/g, "");
  };

  // Format number with commas for quantity (4 decimal places)
  const formatNumberWithCommasQuantity = (value) => {
    if (!value || value === "") return "";

    // Remove all non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, "");

    // Check if the value ends with a decimal point (user is typing decimal)
    const endsWithDot = numericValue.endsWith(".");

    // Split into integer and decimal parts
    const parts = numericValue.split(".");
    const integerPart = parts[0] || "";
    let decimalPart = parts[1] || "";

    // Truncate decimal part to 4 places
    if (decimalPart.length > 4) {
      decimalPart = decimalPart.substring(0, 4);
    }

    // Add commas to integer part
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    // Combine with decimal part if exists, or preserve trailing dot
    if (decimalPart) {
      return `${formattedInteger}.${decimalPart}`;
    }
    if (endsWithDot) {
      return integerPart ? `${formattedInteger}.` : ".";
    }
    return formattedInteger;
  };

  // Debug: Log cart data whenever it changes
  useEffect(() => {
    console.log("=== CART DATA ===");
    console.log("Cart Items Count:", cart.length);
    console.log("Cart Data (Stringified):", JSON.stringify(cart, null, 2));
    console.log("Cart Data (Object):", cart);
    console.log("================");
  }, [cart]);

  // Fetch available discounts
  const fetchDiscounts = useCallback(() => {
    _postApi(
      `/v1/materials/getDiscountSetup`,
      {
        facilityId: activeBusiness?.id,
      },
      (res) => {
        if (res.success) {
          setAvailableDiscounts(res.results || []);
        }
      },
      (err) => {
        console.error("Error fetching discounts:", err);
      },
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    if (activeBusiness?.id) {
      fetchDiscounts();
    }
  }, [activeBusiness?.id, fetchDiscounts]);

  // Keep the selected branches valid: once branches load, drop any selection
  // that isn't one of the user's assigned branches (default to the first).
  useEffect(() => {
    if (assignedBranches.length === 0) return;
    const validIds = selectedBranches.filter((id) =>
      assignedBranches.some((b) => String(b.id) === String(id)),
    );
    if (validIds.length === 0) {
      setSelectedBranches([String(assignedBranches[0].id)]);
    } else if (validIds.length !== selectedBranches.length) {
      setSelectedBranches(validIds);
    }
  }, [assignedBranches, selectedBranches]);

  // Branch options + current selection for the multiselect.
  const branchOptions = useMemo(
    () =>
      assignedBranches.map((b) => ({
        value: String(b.id),
        label: b.branch_name,
      })),
    [assignedBranches],
  );

  // Chart of Accounts Data
  const [chartCode, setChartCode] = useState({});
  const [modeCodeData, setModeCodeData] = useState({});
  const [accountReceivable, setAccountReceivable] = useState({});
  const [finishedGoods, setFinishedGoods] = useState({});
  const [costOfGoodsSold, setCostOfGoodsSold] = useState({});

  // Data Fetching Functions
  const fetchBranches = useCallback(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/account/get/branches?facilityId=${activeBusiness.id}`,
      (res) => {
        if (res.success) setBranches(res.results || []);
      },
      (err) => console.error("Error fetching warehouses:", err),
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const getReadyForSalesItems = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoadingProducts(true);

    // Always load facility-wide stock with branch attached so the same SKU
    // can appear once per branch and lines can come from different branches.
    _fetchApi(
      `/account/get-ready-for-sales/${activeBusiness.id}?includeStopped=1`,
      (response) => {
        if (response.success) {
          // Show every branch's stock — same SKU can appear once per branch.
          // Do not filter by the user's assigned branchId (often stale / wrong).
          // includeStopped=1 lists sales-stopped products so they appear in
          // pickers; selecting them is blocked in addToCart / addToCartNew.
          const items = (response.results || [])
            .map((it) => {
              const bid = it.branchId ?? it.branch_id;
              const match =
                bid != null
                  ? branches.find((b) => String(b.id) === String(bid))
                  : null;
              const locationName =
                it.location_name ||
                (match
                  ? match.branch_name || match.storeName || String(bid)
                  : "") ||
                "";
              return {
                ...it,
                branchId: bid != null && bid !== "" ? Number(bid) : null,
                location_name: locationName,
                // Prefer real branch location over store-type text ("for sales")
                branch_name: locationName || it.branch_name || null,
                sales_stopped: isSalesStopped(it),
              };
            })
            .sort((a, b) => {
              const loc = String(a.location_name || "").localeCompare(
                String(b.location_name || ""),
              );
              if (loc !== 0) return loc;
              return String(a.item_name || "").localeCompare(
                String(b.item_name || ""),
              );
            });

          setReadyForSalesItems(items);
        }
        setLoadingProducts(false);
      },
      (err) => {
        console.error("Error fetching ready for sales items:", err);
        setLoadingProducts(false);
      },
    );
  }, [activeBusiness?.id, branches]);

  const getServiceProducts = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoadingServices(true);
    _fetchApi(
      `/account/get-service-products/${activeBusiness.id}?includeStopped=1`,
      (response) => {
        if (response.success) {
          setServiceProducts(
            (response.results || []).map((it) => ({
              ...it,
              sales_stopped: isSalesStopped(it),
            })),
          );
        }
        setLoadingServices(false);
      },
      (err) => {
        console.error("Error fetching service products:", err);
        setLoadingServices(false);
      },
    );
  }, [activeBusiness?.id]);

  const getTaxes = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoadingTaxes(true);
    const taxCategory = encodeURIComponent("sales");
    _fetchApi(
      `/api/get-taxes-by-category?facilityId=${activeBusiness.id}&tax_category=${taxCategory}`,
      (response) => {
        if (response.success) {
          setTaxes(response.results || []);
        }
        setLoadingTaxes(false);
      },
      (err) => {
        console.error("Error fetching taxes:", err);
        setLoadingTaxes(false);
      },
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    setSelectedTaxes((prev) => {
      const filtered = prev.filter((tax) =>
        salesTaxes.some((salesTax) => salesTax.id === tax.id),
      );
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [salesTaxes]);

  // Filter taxes based on vat_policy
  const filteredSalesTaxes = useMemo(() => {
    if (!salesTaxes || salesTaxes.length === 0) return [];

    // If vat_policy is "all", show all taxes
    if (vatPolicy === "all") {
      return salesTaxes;
    }

    // Filter based on vat_policy
    return salesTaxes.filter((tax) => {
      // If tax has inclusive_type, use it
      if (tax.inclusive_type) {
        if (vatPolicy === "vat_exclusive") {
          return tax.inclusive_type === "exclusive";
        } else if (vatPolicy === "vat_inclusive") {
          return tax.inclusive_type === "inclusive";
        }
      }

      // Fallback to tax_type if inclusive_type is not available
      if (tax.tax_type) {
        if (vatPolicy === "vat_exclusive") {
          return tax.tax_type === "exclusive";
        } else if (vatPolicy === "vat_inclusive") {
          return tax.tax_type === "inclusive";
        }
      }

      // If no type specified, don't show it
      return false;
    });
  }, [salesTaxes, vatPolicy]);

  // Filter Output VAT taxes based on vat_policy
  const filteredOutputVATTaxes = useMemo(() => {
    if (!outputVATTaxes || outputVATTaxes.length === 0) return [];

    // If vat_policy is "all", show all Output VAT taxes
    if (vatPolicy === "all") {
      return outputVATTaxes;
    }

    // Filter based on vat_policy
    return outputVATTaxes.filter((tax) => {
      // If tax has inclusive_type, use it
      if (tax.inclusive_type) {
        if (vatPolicy === "vat_exclusive") {
          return tax.inclusive_type === "exclusive";
        } else if (vatPolicy === "vat_inclusive") {
          return tax.inclusive_type === "inclusive";
        }
      }

      // Fallback to tax_type if inclusive_type is not available
      if (tax.tax_type) {
        if (vatPolicy === "vat_exclusive") {
          return tax.tax_type === "exclusive";
        } else if (vatPolicy === "vat_inclusive") {
          return tax.tax_type === "inclusive";
        }
      }

      // If no type specified, don't show it
      return false;
    });
  }, [outputVATTaxes, vatPolicy]);

  // Output VAT is controlled separately — keep it out of selectedTaxes
  useEffect(() => {
    setSelectedTaxes((prev) => {
      const next = prev.filter((tax) => !isOutputVatTax(tax));
      return next.length === prev.length ? prev : next;
    });
  }, [salesTaxes]);

  // Auto-enable Output VAT when available (so tax calculates without a manual toggle).
  // When vat_policy is "all", the catalog often has BOTH inclusive + exclusive Output VAT
  // rows — selecting both double-posts VAT and breaks the ledger. Prefer one (exclusive).
  useEffect(() => {
    if (!filteredOutputVATTaxes.length) return;
    setSelectedOutputVAT((prev) => {
      const validIds = prev.filter((id) =>
        filteredOutputVATTaxes.some((t) => t.id === id),
      );

      const pickOne = (ids) => {
        if (!ids.length) return [];
        if (ids.length === 1) return ids;
        const exclusive = filteredOutputVATTaxes.find(
          (t) =>
            ids.includes(t.id) && !isTaxInclusive(t, "vat_exclusive"),
        );
        if (exclusive) return [exclusive.id];
        return [ids[0]];
      };

      if (validIds.length > 0) {
        const next = pickOne(validIds);
        if (
          next.length === prev.length &&
          next.every((id, i) => id === prev[i])
        ) {
          return prev;
        }
        return next;
      }

      const preferred =
        filteredOutputVATTaxes.find(
          (t) => !isTaxInclusive(t, "vat_exclusive"),
        ) || filteredOutputVATTaxes[0];
      return preferred ? [preferred.id] : [];
    });
  }, [filteredOutputVATTaxes]);

  const lineTaxOptions = useMemo(() => {
    const map = new Map();
    [...(filteredSalesTaxes || []), ...(filteredOutputVATTaxes || [])].forEach(
      (t) => {
        if (t?.id != null) map.set(t.id, t);
      },
    );
    return Array.from(map.values());
  }, [filteredSalesTaxes, filteredOutputVATTaxes]);

  const defaultLineTaxId = useMemo(() => {
    if (selectedOutputVAT.length) return selectedOutputVAT[0];
    return lineTaxOptions[0]?.id ?? null;
  }, [selectedOutputVAT, lineTaxOptions]);

  const getChartOfAccounts = useCallback(() => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/account/chart-of-accounts/${activeBusiness.id}`,
      (response) => {
        if (response.success) {
          const accounts = response.results || [];

          // Find specific account codes
          const cashAccount = accounts.find((acc) =>
            acc.description?.toLowerCase().includes("cash"),
          );
          const accountReceivableAcc = accounts.find((acc) =>
            acc.description?.toLowerCase().includes("receivable"),
          );
          const finishedGoodsAcc = accounts.find((acc) =>
            acc.description?.toLowerCase().includes("finished goods"),
          );
          const costOfGoodsSoldAcc = accounts.find((acc) =>
            acc.description?.toLowerCase().includes("cost of goods sold"),
          );

          setChartCode({
            cash: cashAccount?.account_code || "1001001",
            accountReceivable: accountReceivableAcc?.account_code || "1002001",
            finishedGoods: finishedGoodsAcc?.account_code || "1003001",
            costOfGoodsSold: costOfGoodsSoldAcc?.account_code || "4001001",
          });

          setAccountReceivable(accountReceivableAcc || {});
          setFinishedGoods(finishedGoodsAcc || {});
          setCostOfGoodsSold(costOfGoodsSoldAcc || {});
        }
      },
      (err) => console.error("Error fetching chart of accounts:", err),
    );
  }, [activeBusiness?.id]);

  // Tax Calculation Functions
  const calculateTaxAmount = useCallback(
    (itemAmount, tax) => {
      if (!tax || !tax.rate) return 0;

      const rate = parseFloat(tax.rate);
      // Use tax's inclusive_type if available
      // If vat_policy is "all", always use tax's inclusive_type
      // Otherwise, fallback to vatPolicy if inclusive_type is not set
      const isInclusive =
        tax.inclusive_type === "inclusive" ||
        (tax.inclusive_type === undefined &&
          vatPolicy === "vat_inclusive" &&
          vatPolicy !== "all");

      if (isInclusive) {
        // For inclusive tax, extract tax from the base amount
        if (tax.rate_type === "percentage") {
          const rateDecimal = rate / 100;
          if (rateDecimal === 0) return 0;
          return itemAmount - itemAmount / (1 + rateDecimal);
        } else {
          return rate; // Fixed amount in inclusive mode
        }
      } else {
        // For exclusive tax, add tax on top
        if (tax.rate_type === "percentage") {
          return (itemAmount * rate) / 100;
        } else {
          return rate; // Fixed amount
        }
      }
    },
    [vatPolicy],
  );

  const calculateTotalTax = useCallback(() => {
    if (selectedTaxes.length === 0) return 0;

    const saleItems = cart.filter(
      (item) =>
        item.status === "for sale" &&
        item.taxable === "Taxable" &&
        !item.proBono, // Exclude Pro-bono items from tax calculation
    );
    let totalTax = 0;

    // Separate taxes by inclusive_type
    // If vat_policy is "all", use each tax's individual inclusive_type
    // Otherwise, use vatPolicy as fallback
    const exclusiveTaxes = selectedTaxes.filter((tax) => {
      if (vatPolicy === "all") {
        return (
          tax.inclusive_type === "exclusive" ||
          (tax.inclusive_type === undefined && tax.tax_type === "exclusive")
        );
      }
      return (
        tax.inclusive_type === "exclusive" ||
        (tax.inclusive_type === undefined && tax.tax_type === "exclusive") ||
        (tax.inclusive_type === undefined && vatPolicy === "vat_exclusive")
      );
    });
    const inclusiveTaxes = selectedTaxes.filter((tax) => {
      if (vatPolicy === "all") {
        return (
          tax.inclusive_type === "inclusive" ||
          (tax.inclusive_type === undefined && tax.tax_type === "inclusive")
        );
      }
      return (
        tax.inclusive_type === "inclusive" ||
        (tax.inclusive_type === undefined && tax.tax_type === "inclusive") ||
        (tax.inclusive_type === undefined && vatPolicy === "vat_inclusive")
      );
    });

    // Calculate exclusive taxes: add on top
    saleItems.forEach((item) => {
      exclusiveTaxes.forEach((tax) => {
        totalTax += calculateTaxAmount(item.amount, tax);
      });
    });

    // Calculate inclusive taxes: extract from subtotal
    if (inclusiveTaxes.length > 0) {
      const taxableSubtotal = saleItems.reduce(
        (sum, item) => sum + parseFloat(item.amount || 0),
        0,
      );

      const totalInclusiveRate = inclusiveTaxes.reduce((sum, tax) => {
        if (tax.rate_type === "percentage") {
          return sum + parseFloat(tax.rate || 0) / 100;
        }
        return sum;
      }, 0);

      if (totalInclusiveRate > 0) {
        const netAmount = taxableSubtotal / (1 + totalInclusiveRate);
        totalTax += taxableSubtotal - netAmount;
      }

      // Add fixed amount inclusive taxes
      inclusiveTaxes.forEach((tax) => {
        if (tax.rate_type === "fixed") {
          totalTax += parseFloat(tax.rate || 0) * saleItems.length;
        }
      });
    }

    return totalTax;
  }, [cart, selectedTaxes, calculateTaxAmount, vatPolicy]);

  const getTotalWithTax = useCallback(() => {
    const saleItems = cart.filter((item) => item.status === "for sale");
    const subtotal = saleItems.reduce(
      (sum, item) => sum + parseFloat(item.amount),
      0,
    );
    const totalTax = calculateTotalTax();

    // Check if all taxes are inclusive
    // If vat_policy is "all", check each tax's individual inclusive_type
    const allTaxesInclusive =
      selectedTaxes.length > 0 &&
      selectedTaxes.every((tax) => {
        if (vatPolicy === "all") {
          return (
            tax.inclusive_type === "inclusive" ||
            (tax.inclusive_type === undefined && tax.tax_type === "inclusive")
          );
        }
        return (
          tax.inclusive_type === "inclusive" ||
          (tax.inclusive_type === undefined && vatPolicy === "vat_inclusive")
        );
      });

    // If all taxes are inclusive, subtotal already includes tax
    return allTaxesInclusive ? subtotal : subtotal + totalTax;
  }, [cart, calculateTotalTax, selectedTaxes, vatPolicy]);

  // Cart Management Functions
  // Generate unique key for item based on item_code, selling_price, and expiry_date
  const getItemKey = useCallback((item) => {
    const itemCode = item.product_id || item.sku || item.item_code || item.id;
    const price = item.selling_price || 0;
    const expiry = item.expiry_date || "no-expiry";
    return `${itemCode}_${price}_${expiry}`;
  }, []);

  // Handle item selection
  const handleItemSelect = useCallback((item) => {
    console.log(item);
    setSelectedItem(item);
  }, []);

  const addToCart = useCallback(() => {
    if (!selectedItem) {
      toast.error("Please select an item first");
      return;
    }

    const quantity = parseFloat(form.quantity_sold) || 1;
    const sellingPrice = parseFloat(selectedItem.selling_price) || 0;

    if (sellingPrice <= 0) {
      toast.error("Please set a valid selling price for this item");
      return;
    }

    // Check stock availability for products (skip for services)
    if (selectedItem.item_type !== "Service") {
      const availableStock = parseFloat(selectedItem.balance) || 0;

      // Calculate quantity already in cart for this product
      const quantityInCart = cart
        .filter(
          (item) =>
            (item.product_id === selectedItem.product_id ||
              item.product_id === selectedItem.id) &&
            item.expiry_date === selectedItem.expiry_date &&
            String(item.branchId ?? item.branch_id ?? "") ===
              String(selectedItem.branchId ?? selectedItem.branch_id ?? ""),
        )
        .reduce((sum, item) => sum + parseFloat(item.quantity_sold || 0), 0);

      const totalQuantity = quantityInCart + quantity;

      // Only check stock if allow_sales_without_stock is disabled
      if (!allowSalesWithoutStock) {
        if (availableStock <= 0) {
          toast.error(`${selectedItem.item_name} is out of stock`);
          return;
        }

        if (totalQuantity > availableStock) {
          toast.error(
            `Insufficient stock! Available: ${formatNumber1(availableStock)}, ` +
              `In cart: ${formatNumber1(quantityInCart)}, ` +
              `Trying to add: ${formatNumber1(quantity)}`,
          );
          return;
        }
      } else {
        // When allow_sales_without_stock is enabled, warn but allow
        if (availableStock <= 0) {
          toast.warning(
            `${selectedItem.item_name} is out of stock, but sale is allowed due to settings`,
          );
        } else if (totalQuantity > availableStock) {
          toast.warning(
            `Insufficient stock! Available: ${formatNumber1(availableStock)}, ` +
              `In cart: ${formatNumber1(quantityInCart)}, ` +
              `Trying to add: ${formatNumber1(quantity)}. ` +
              `Sale will proceed due to settings.`,
          );
        }
      }
    }

    if (isSalesStopped(selectedItem)) {
      toast.error(
        `Sales are stopped for ${selectedItem.item_name}. This product cannot be sold.`,
      );
      return;
    }

    // Sales target / limit — block even when stock remains
    const limitRemaining = getSalesLimitRemaining(selectedItem);
    if (limitRemaining != null) {
      const sku = selectedItem.product_id || selectedItem.id;
      const qtyInCartForSku = cartQtyForSku(cart, sku);
      const totalForSku = qtyInCartForSku + quantity;
      if (limitRemaining <= 0) {
        toast.error(
          `Sales ${salesLimitPeriodLabel(selectedItem.sales_limit_period)} limit reached for ${
            selectedItem.item_name
          }. No more can be sold this period.`,
        );
        return;
      }
      if (totalForSku > limitRemaining) {
        toast.error(
          `Sales ${salesLimitPeriodLabel(selectedItem.sales_limit_period)} limit for ${
            selectedItem.item_name
          }. Remaining: ${formatNumber1(limitRemaining)}, in cart: ${formatNumber1(
            qtyInCartForSku,
          )}, trying to add: ${formatNumber1(quantity)}`,
        );
        return;
      }
    }

    const amount = sellingPrice * quantity;

    const cartItem = {
      id: UUIDV4(),
      product_id: selectedItem.product_id || selectedItem.id,
      item_name: selectedItem.item_name,
      multiplier_id: selectedItem.multiplier_id,
      multiplier_type: selectedItem.multiplier_type,
      category: selectedItem.category,
      unit_of_measure: selectedItem.unit_of_measure,
      quantity_sold: quantity,
      uom_category: selectedItem.uom_category,
      quantity: quantity, // For display in cart
      selling_price: sellingPrice,
      price: sellingPrice, // For display in cart
      amount: amount,
      balance: selectedItem.balance,
      item_type: selectedItem.item_type,
      expiry_date: selectedItem.expiry_date,
      taxable: selectedItem.taxable || "Taxable",
      proBono: false, // Default to false
      sales_stopped: isSalesStopped(selectedItem),
      sales_limit_period: selectedItem.sales_limit_period ?? null,
      sales_limit: selectedItem.sales_limit ?? null,
      sales_limit_remaining: selectedItem.sales_limit_remaining ?? null,
      branchId:
        selectedItem.branchId ||
        selectedItem.branch_id ||
        (selectedBranch ? Number(selectedBranch) : null),
      branch_name:
        selectedItem.location_name ||
        selectedItem.branch_name ||
        getItemBranchLocation(selectedItem) ||
        selectedBranchLocation ||
        null,
    };

    setCart((prev) => [...prev, cartItem]);
    setForm((prev) => ({ ...prev, quantity_sold: "1" }));
    setSelectedItem(null); // Clear selection after adding
    setSearchTerm(""); // Clear search term

    toast.success(`${selectedItem.item_name} added to cart`);

    // Focus back on search input
    setTimeout(() => {
      const searchInput = document.querySelector(
        'input[placeholder="Search by name..."]',
      );
      if (searchInput) searchInput.focus();
    }, 100);
  }, [
    selectedItem,
    form.quantity_sold,
    cart,
    selectedBranch,
    selectedBranchLocation,
  ]);

  const removeFromCart = useCallback((itemId) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const updateCartItem = useCallback((itemId, updates) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const newQuantity = parseFloat(
            (updates.quantity_sold ?? item.quantity_sold ?? item.quantity) || 0,
          );
          const newPrice = parseFloat(
            (updates.selling_price ?? item.selling_price ?? item.price) || 0,
          );
          // If Pro-bono, amount is always 0, otherwise calculate normally
          const newAmount =
            item.proBono || updates.proBono ? 0 : newQuantity * newPrice;

          return {
            ...item,
            ...updates,
            quantity: newQuantity, // Update display field
            price: newPrice, // Update display field
            amount: newAmount,
            proBono:
              updates.proBono !== undefined ? updates.proBono : item.proBono,
          };
        }
        return item;
      }),
    );
  }, []);

  // Calculate totals for UI (exclude Pro-bono items)
  const subtotal = useMemo(() => {
    return cart
      .filter((item) => item.status === "for sale" && !item.proBono)
      .reduce((sum, item) => sum + parseFloat(item.amount), 0);
  }, [cart]);

  // Calculate discount amount — editable value (% or NGN) drives the total;
  // selecting a catalog discount fills that value.
  const discountAmount = useMemo(() => {
    const n = parseFloat(String(zohoDiscountPercent).replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) return 0;
    if (zohoDiscountMode === "%") return (subtotal * n) / 100;
    return n;
  }, [subtotal, zohoDiscountPercent, zohoDiscountMode]);

  // Actual save function
  const saveSale = useCallback(
    (usePrepayment = false) => {
      // Hard guard: if a checkout/save is already in progress, ignore further calls
      if (isSavingRef.current || processingCheckout) {
        return;
      }

      const allSaleItems = cart.filter((item) => item.status === "for sale");
      if (allSaleItems.length === 0) {
        toast.error("No items to sell");
        return;
      }

      // Mark as processing immediately so repeated triggers are ignored
      isSavingRef.current = true;
      setProcessingCheckout(true);

      // Builds one transaction for a given set of items + branch. Used by both
      // the single-branch flow and the multi-branch (one sale per branch) flow.
      const buildEntry = (saleItems, totalDiscount, branchId) => {
        // Calculate discount amount (exclude Pro-bono items)
        const currentSubtotal = saleItems
          .filter((item) => !item.proBono)
          .reduce((sum, item) => sum + parseFloat(item.amount), 0);
        const totalAfterDiscount = currentSubtotal - totalDiscount;

        // Calculate taxable subtotal (only from taxable items, exclude Pro-bono)
        const taxableItems = saleItems.filter(
          (item) => item.taxable === "Taxable" && !item.proBono,
        );
        const taxableSubtotal = taxableItems.reduce(
          (sum, item) => sum + parseFloat(item.amount),
          0,
        );
        const vatPolicy = activeBusiness?.vat_policy || "vat_exclusive";

        // Proportional discount on taxable items
        const taxableDiscount =
          currentSubtotal > 0
            ? (totalDiscount * taxableSubtotal) / currentSubtotal
            : 0;
        const taxableAfterDiscount = taxableSubtotal - taxableDiscount;

        // Calculate tax based on each tax's inclusive_type
        let taxAmount = 0;
        if (selectedTaxes.length > 0) {
          // Separate taxes by inclusive_type
          // If vat_policy is "all", use each tax's individual inclusive_type
          const inclusiveTaxes = selectedTaxes.filter((tax) => {
            if (vatPolicy === "all") {
              return (
                tax.inclusive_type === "inclusive" ||
                (tax.inclusive_type === undefined &&
                  tax.tax_type === "inclusive")
              );
            }
            return (
              tax.inclusive_type === "inclusive" ||
              (tax.inclusive_type === undefined &&
                vatPolicy === "vat_inclusive")
            );
          });
          const exclusiveTaxes = selectedTaxes.filter((tax) => {
            if (vatPolicy === "all") {
              return (
                tax.inclusive_type === "exclusive" ||
                (tax.inclusive_type === undefined &&
                  tax.tax_type === "exclusive")
              );
            }
            return (
              tax.inclusive_type === "exclusive" ||
              (tax.inclusive_type === undefined &&
                vatPolicy === "vat_exclusive")
            );
          });

          // Calculate inclusive taxes: extract VAT from the taxable amount
          if (inclusiveTaxes.length > 0) {
            const totalInclusiveRate = inclusiveTaxes.reduce((sum, tax) => {
              if (tax.rate_type === "percentage") {
                return sum + parseFloat(tax.rate || 0) / 100;
              }
              return sum;
            }, 0);

            if (totalInclusiveRate > 0) {
              const netAmount = taxableAfterDiscount / (1 + totalInclusiveRate);
              taxAmount += taxableAfterDiscount - netAmount;
            }

            // Add fixed amount inclusive taxes
            inclusiveTaxes.forEach((tax) => {
              if (tax.rate_type === "fixed") {
                taxAmount += parseFloat(tax.rate || 0);
              }
            });
          }

          // Calculate exclusive taxes: add VAT to the taxable amount
          if (exclusiveTaxes.length > 0) {
            taxAmount += exclusiveTaxes.reduce((sum, tax) => {
              if (tax.rate_type === "percentage") {
                return (
                  sum + (taxableAfterDiscount * parseFloat(tax.rate || 0)) / 100
                );
              } else {
                return sum + parseFloat(tax.rate || 0);
              }
            }, 0);
          }
        }

        // Calculate Output VAT for taxable items (only if Output VAT taxes are selected and are inclusive)
        let outputVATAmountForSave = 0;
        if (selectedOutputVAT.length > 0) {
          const selectedOutputVATTaxes = outputVATTaxes.filter((tax) =>
            selectedOutputVAT.includes(tax.id),
          );

          // Filter for inclusive output VAT taxes
          const inclusiveOutputVATTaxes = selectedOutputVATTaxes.filter(
            (tax) =>
              tax.inclusive_type === "inclusive" ||
              (tax.inclusive_type === undefined &&
                vatPolicy === "vat_inclusive"),
          );

          if (inclusiveOutputVATTaxes.length > 0) {
            const totalRate = inclusiveOutputVATTaxes.reduce((sum, tax) => {
              if (tax.rate_type === "percentage") {
                return sum + parseFloat(tax.rate || 0) / 100;
              }
              return sum;
            }, 0);

            if (totalRate > 0) {
              const netAmount = taxableAfterDiscount / (1 + totalRate);
              outputVATAmountForSave = taxableAfterDiscount - netAmount;
            }
          }
        }

        // Calculate total with tax based on whether we have inclusive taxes
        // If vat_policy is "all", check each tax's individual inclusive_type
        const hasInclusiveTaxes = selectedTaxes.some((tax) => {
          if (vatPolicy === "all") {
            return (
              tax.inclusive_type === "inclusive" ||
              (tax.inclusive_type === undefined && tax.tax_type === "inclusive")
            );
          }
          return (
            tax.inclusive_type === "inclusive" ||
            (tax.inclusive_type === undefined && vatPolicy === "vat_inclusive")
          );
        });
        const allTaxesInclusive =
          selectedTaxes.length > 0 &&
          selectedTaxes.every((tax) => {
            if (vatPolicy === "all") {
              return (
                tax.inclusive_type === "inclusive" ||
                (tax.inclusive_type === undefined &&
                  tax.tax_type === "inclusive")
              );
            }
            return (
              tax.inclusive_type === "inclusive" ||
              (tax.inclusive_type === undefined &&
                vatPolicy === "vat_inclusive")
            );
          });

        const outputVATToAdd =
          selectedOutputVAT.length > 0
            ? (() => {
                const vatPolicy = activeBusiness?.vat_policy || "vat_exclusive";
                const exclusiveOutputVATTaxes = outputVATTaxes.filter(
                  (t) =>
                    selectedOutputVAT.includes(t.id) &&
                    (t.inclusive_type === "exclusive" ||
                      (t.inclusive_type === undefined &&
                        t.tax_type === "exclusive")),
                );
                if (vatPolicy === "vat_inclusive") return 0;
                return exclusiveOutputVATTaxes.reduce(
                  (sum, t) =>
                    sum +
                    taxableAfterDiscount * (parseFloat(t.rate || 0) / 100),
                  0,
                );
              })()
            : 0;

        const totalWithTax =
          allTaxesInclusive && outputVATToAdd === 0
            ? totalAfterDiscount
            : totalAfterDiscount + taxAmount + outputVATToAdd;

        // Advance is applied manually (Pay Bills / Apply Advance) — never auto here.
        const prepaymentAmount = 0;

        const transactionId = UUIDV4();
        const transactionEntry = {
          id: transactionId,
          receivable_code: activeBusiness.receivable_code,
          receivable_accural_code: activeBusiness.receivable_accural_code,
          cost_of_sale: activeBusiness.cost_of_sale,
          sale_revenue_code: activeBusiness.sale_revenue_code,
          finished_goods_code: activeBusiness.finished_goods_code,
          inventory_account: activeBusiness.inventory_account || null,
          items: saleItems.map((item) => ({
            ...item,
            type: item.proBono ? "Pro-bono" : "Regular",
            // GL uses product.sku from DB; product_id on each line must match that sku
            product_id: item.product_id || item.sku,
          })),
          pro_bono_code: activeBusiness.pro_bono_code,
          subtotal: currentSubtotal,
          discount_amount: totalDiscount,
          discount_info: selectedDiscount
            ? {
                discount_id: selectedDiscount.discount_id,
                discount_name: selectedDiscount.discount_name,
                discount_type: selectedDiscount.discount_type,
                value: parseFloat(selectedDiscount.value),
                customer_type: selectedDiscount.customer_type,
              }
            : null,
          tax_amount: taxAmount,
          total_amount: totalWithTax,
          amountPaid: prepaymentAmount, // Apply prepayment if available
          modeOfPayment: (() => {
            if (modeOfPayment === "deposit") return "deposit";
            if (modeOfPayment === "credit_split") return "credit_split";
            if (saleType !== "paid") return "CREDIT";
            if (payWithCash && payWithTransfer) return "split";
            if (payWithTransfer) return "bank";
            return "cash";
          })(),
          discount: totalDiscount,
          txn_type: saleType === "paid" ? "Cash Sale" : "Credit Sale",
          reference: transactionId,
          facilityId: activeBusiness.id,
          created_by: user_id.id,
          customer_id: selectedCustomer.customerNo,
          apply_prepayment: saleType !== "paid" && usePrepayment,
          transaction_date: transactionDate, // Add transaction date
          sale_branch_id: branchId,
          // Payment is collected at Verification Points, not on create.
          defer_payment: saleType === "paid",
          assigned_cashier_id: null,
          assigned_cashier_name: null,
          taxes: (() => {
            const mapped = [
              // Regular taxes
              ...(selectedTaxes.length > 0
                ? selectedTaxes.map((tax) => {
                    // Use tax's individual inclusive_type if available
                    // If vat_policy is "all", always use tax's inclusive_type
                    const isTaxInclusive =
                      tax.inclusive_type === "inclusive" ||
                      (tax.inclusive_type === undefined &&
                        tax.tax_type === "inclusive") ||
                      (tax.inclusive_type === undefined &&
                        tax.tax_type === undefined &&
                        vatPolicy === "vat_inclusive" &&
                        vatPolicy !== "all");

                    let taxAmountForTax = 0;

                    if (isTaxInclusive) {
                      // For inclusive VAT, calculate proportional tax amount
                      // Only calculate with other inclusive taxes
                      const inclusiveTaxes = selectedTaxes.filter((t) => {
                        if (vatPolicy === "all") {
                          return (
                            t.inclusive_type === "inclusive" ||
                            (t.inclusive_type === undefined &&
                              t.tax_type === "inclusive")
                          );
                        }
                        return (
                          t.inclusive_type === "inclusive" ||
                          (t.inclusive_type === undefined &&
                            vatPolicy === "vat_inclusive")
                        );
                      });

                      const totalRate = inclusiveTaxes.reduce((sum, t) => {
                        return sum + parseFloat(t.rate || 0) / 100;
                      }, 0);

                      if (totalRate > 0) {
                        const netAmount = taxableAfterDiscount / (1 + totalRate);
                        const totalVAT = taxableAfterDiscount - netAmount;
                        const taxRate = parseFloat(tax.rate || 0) / 100;
                        taxAmountForTax = (totalVAT * taxRate) / totalRate;
                      }
                    } else {
                      // For exclusive VAT
                      taxAmountForTax =
                        (taxableAfterDiscount * parseFloat(tax.rate || 0)) /
                        100;
                    }

                    return {
                      id: tax.id,
                      name: tax.description || tax.name,
                      description: tax.description,
                      rate: parseFloat(tax.rate),
                      head: tax.account_sub_head,
                      amount: taxAmountForTax,
                      tax_type: tax.tax_type || "exclusive",
                      rate_type: tax.rate_type || "percentage",
                      inclusive_type:
                        tax.inclusive_type ||
                        (tax.tax_type === "inclusive"
                          ? "inclusive"
                          : "exclusive") ||
                        "exclusive",
                    };
                  })
                : []),
              // Output VAT taxes (include if selected, regardless of policy - let backend handle it)
              ...(selectedOutputVAT.length > 0
                ? outputVATTaxes
                    .filter((tax) => selectedOutputVAT.includes(tax.id))
                    .map((vatTax) => {
                      const taxRate = parseFloat(vatTax.rate || 0) / 100;
                      const isInclusive =
                        vatTax.inclusive_type === "inclusive" ||
                        (vatTax.inclusive_type === undefined &&
                          vatTax.tax_type === "inclusive");
                      const taxAmountForTax =
                        taxRate > 0
                          ? isInclusive
                            ? taxableAfterDiscount -
                              taxableAfterDiscount / (1 + taxRate)
                            : taxableAfterDiscount * taxRate
                          : 0;

                      return {
                        id: vatTax.id,
                        name: vatTax.description || vatTax.name,
                        description: vatTax.description,
                        rate: parseFloat(vatTax.rate),
                        head: vatTax.account_sub_head,
                        amount: taxAmountForTax,
                        tax_type: vatTax.tax_type || "exclusive",
                        rate_type: vatTax.rate_type || "percentage",
                        inclusive_type:
                          vatTax.inclusive_type ||
                          (vatTax.tax_type === "inclusive"
                            ? "inclusive"
                            : "exclusive") ||
                          "exclusive",
                      };
                    })
                : []),
            ];
            // Dedupe by id (Output VAT must never appear twice)
            const seen = new Set();
            return mapped.filter((t) => {
              const key = String(t.id);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          })(),
        };

        return { entry: transactionEntry, totalWithTax };
      };

      // One invoice for the full cart (mixed branches stay on one sale_code).
      // Stock is written per line branch on the API; separation happens after payment.
      const primaryBranchId =
        selectedBranch && selectedBranch !== "all"
          ? parseInt(String(selectedBranch), 10) || 0
          : 0;

      let headerBranchId = primaryBranchId;
      for (const item of allSaleItems) {
        const bid = parseInt(String(item.branchId ?? item.branch_id ?? ""), 10);
        if (Number.isFinite(bid) && bid > 0) {
          headerBranchId = bid;
          break;
        }
      }

      const { entry, totalWithTax } = buildEntry(
        allSaleItems,
        discountAmount,
        headerBranchId,
      );

      const formTotal = Number(totalRef.current);
      if (Number.isFinite(formTotal) && formTotal > 0) {
        entry.total_amount = formTotal;
      }

      console.log("Transaction data:", entry);

      _postApi(
        "/api/v1/transactions/create-sale",
        entry,
        (response) => {
          setProcessingCheckout(false);
          isSavingRef.current = false;
          if (response.success) {
            const shownTotal =
              Number(entry.total_amount) || totalWithTax || 0;
            toast.success(
              `Sale of ₦${shownTotal.toFixed(2)} saved successfully!`,
            );
            if (response?.sale_code) {
              if (modeOfPayment === "deposit") {
                const params = new URLSearchParams();
                if (selectedCustomer?.customerNo) {
                  params.set("customerNo", selectedCustomer.customerNo);
                  const name =
                    selectedCustomer.name ||
                    selectedCustomer.fullname ||
                    selectedCustomer.company_name ||
                    "";
                  if (name) params.set("customerName", name);
                }
                params.set("sale_code", response.sale_code);
                toast.success(
                  `Invoice ${response.sale_code} created — apply deposit next`,
                );
                navigate(
                  `/app/payments/apply-advance?${params.toString()}`,
                );
              } else {
                const dest =
                  saleType === "credit"
                    ? `/app/sales/process?sale_code=${response.sale_code}`
                    : `/app/sales/process?sale_code=${response.sale_code}`;
                navigate(dest);
              }
            }
          } else {
            toast.error(response.message || "Failed to complete sale");
          }
        },
        (error) => {
          setProcessingCheckout(false);
          isSavingRef.current = false;
          console.error("Transaction save error:", error);
          toast.error(
            error?.message ||
              error?.error ||
              "Failed to complete sale. Please try again.",
          );
        },
      );
    },
    [
      cart,
      selectedCustomer,
      discountAmount,
      selectedTaxes,
      selectedDiscount,
      activeBusiness,
      user_id.id,
      navigate,
      selectedOutputVAT,
      outputVATTaxes,
      processingCheckout,
      selectedBranches,
      selectedBranch,
      selectedBranchLocation,
      branches,
      saleType,
      payWithCash,
      payWithTransfer,
      modeOfPayment,
      cashPayAmount,
      transferPayAmount,
      accountHead,
      bankAccount,
      transactionDate,
    ],
  );

  // Checkout Functions
  const checkout = useCallback(() => {
    console.log("Checkout process started...");

    // Hard guard: if already processing, ignore further clicks
    if (isSavingRef.current || processingCheckout) {
      return; // Prevent double submission
    }

    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (!selectedCustomer) {
      toast.error("Please select a customer");
      return;
    }

    // Branch comes from each line item (product stock per branch).
    // No form-level branch selection required.

    const saleItems = cart.filter((item) => item.status === "for sale");
    if (saleItems.length === 0) {
      toast.error("No items to sell");
      return;
    }

    // Client-side guard (API also enforces): stop sales + sales targets
    for (const item of saleItems) {
      if (isSalesStopped(item)) {
        toast.error(
          `Sales are stopped for ${item.item_name}. Remove it before saving.`,
        );
        return;
      }
      const limitRemaining = getSalesLimitRemaining(item);
      if (limitRemaining != null) {
        const qty = parseFloat(item.quantity_sold || item.quantity || 0) || 0;
        const sku = item.product_id;
        const otherQty = cartQtyForSku(saleItems, sku, item.id);
        if (qty + otherQty > limitRemaining) {
          toast.error(
            `Sales ${salesLimitPeriodLabel(item.sales_limit_period)} limit for ${
              item.item_name
            }. Remaining: ${formatNumber1(limitRemaining)}`,
          );
          return;
        }
      }
    }

    // Credit limit (credit / deposit / credit_split) — API re-checks on create-sale
    const needsCreditCheck =
      saleType !== "paid" ||
      modeOfPayment === "credit" ||
      modeOfPayment === "deposit" ||
      modeOfPayment === "credit_split";
    if (needsCreditCheck) {
      const creditLimit = parseFloat(selectedCustomer.credit_limit || 0);
      if (creditLimit > 0) {
        const outstanding =
          Math.max(
            0,
            parseFloat(
              selectedCustomer.balance ||
                selectedCustomer.outstanding_balance ||
                selectedCustomer.amount ||
                0,
            ) || 0,
          );
        const thisSale = saleItems
          .filter((item) => !item.proBono)
          .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        if (outstanding + thisSale > creditLimit + 0.01) {
          toast.error(
            `Credit limit exceeded. Limit: ${formatNumber1(
              creditLimit,
            )}, Outstanding: ${formatNumber1(
              outstanding,
            )}, This sale: ${formatNumber1(thisSale)}`,
          );
          return;
        }
      }
    }

    if (saleType === "paid") {
      if (!payWithCash && !payWithTransfer) {
        toast.error("Select Cash, Transfer, Cash + Transfer, or Credit + Cash + Transfer");
        return;
      }
      // Payment is collected at Verification Points — invoice only records the mode.
      saveSale(false);
      return;
    }

    // Credit sales — deposit application is handled on Apply Deposit page.
    saveSale(false);
  }, [
    cart,
    selectedCustomer,
    saveSale,
    processingCheckout,
    saleType,
    payWithCash,
    payWithTransfer,
    modeOfPayment,
    cashPayAmount,
    transferPayAmount,
    accountHead,
    bankAccount,
  ]);

  const handleConfirmSale = useCallback(() => {
    setShowInvoicePreview(false);
    setShowPDFPreview(true);
  }, []);

  const handleProcessSale = useCallback(() => {
    if (!invoiceData?.transaction) {
      toast.error("Invalid transaction data");
      return;
    }

    // Transaction already saved, just clear cart and navigate
    // Clear cart and reset form
    setCart([]);
    setSelectedCustomer(null);
    setSelectedTaxes([]);
    setOtherInfo({});
    setShowPDFPreview(false);
    setInvoiceData(null);
    setSelectedDiscount(null);
    setCustomPricing(false);
    setCustomPrices({});
    setCustomerCopyEnabled(false);
    setCustomerCopyPrices({});

    toast.success("Sale completed! Ready for next transaction.");

    // Navigate to sales list or overview
    navigate("/app/sales/pending-sales");
  }, [invoiceData, navigate]);

  const handleCancelPreview = useCallback(() => {
    // Since transaction is already saved, clear and go to pending sales
    setCart([]);
    setSelectedCustomer(null);
    setSelectedTaxes([]);
    setOtherInfo({});
    setShowInvoicePreview(false);
    setInvoiceData(null);
    setSelectedDiscount(null);
    setCustomPricing(false);
    setCustomPrices({});
    setCustomerCopyEnabled(false);
    setCustomerCopyPrices({});

    toast.info("Sale saved. Redirecting to pending sales...");
    navigate("/app/sales/pending-sales");
  }, [navigate]);

  const handleCancelPDFPreview = useCallback(() => {
    setShowPDFPreview(false);
    setShowInvoicePreview(true);
  }, []);

  const handleSubmit = useCallback(() => {
    // Guard: ignore if already processing
    if (isSavingRef.current || processingCheckout) {
      return;
    }
    if (selectedCustomer) {
      checkout();
    } else {
      setShowNewCustomerModal(true);
    }
  }, [selectedCustomer, checkout, processingCheckout]);

  const createCustomerAndCheckout = useCallback(
    (customerData) => {
      dispatch(saveNewCustomer(customerData))
        .then((response) => {
          if (response.success) {
            setSelectedCustomer(response.customer);
            setShowNewCustomerModal(false);

            // Proceed with checkout using new customer
            const checkoutData = {
              ...customerData,
              customer: response.customer,
              amountPaid: 0,
              modeOfPayment: "CREDIT",
            };

            checkout();
          } else {
            toast.error("Failed to create customer");
          }
        })
        .catch((error) => {
          console.error("Customer creation error:", error);
          toast.error("Failed to create customer");
        });
    },
    [dispatch, checkout],
  );

  // Form Handlers
  const handleFormChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Service Price Handler
  const handleServicePriceChange = useCallback(
    (serviceId, newPrice) => {
      // Update the service product in the state
      setServiceProducts((prev) =>
        prev.map((service) =>
          service.id === serviceId
            ? { ...service, selling_price: newPrice }
            : service,
        ),
      );

      // Update the service in the database
      if (activeBusiness?.id) {
        fetch(
          `/api/account/update-service-pricing/${activeBusiness.id}/${serviceId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ sellingPrice: newPrice }),
          },
        )
          .then((response) => response.json())
          .then((data) => {
            if (data.success) {
              console.log("Service price updated successfully");
              toast.success("Service price updated successfully");
            } else {
              console.error("Failed to update service price:", data.message);
              toast.error(data.message || "Failed to update service price");
            }
          })
          .catch((error) => {
            console.error("Error updating service price:", error);
            toast.error("Error updating service price");
          });
      }
    },
    [activeBusiness?.id],
  );

  // Effects
  useEffect(() => {
    getReadyForSalesItems();
    getServiceProducts();
    getTaxes();
    getChartOfAccounts();
    dispatch(getCustomers());
  }, [
    getReadyForSalesItems,
    getServiceProducts,
    getTaxes,
    getChartOfAccounts,
    dispatch,
  ]);

  // Memoized Values
  const itemListData = useMemo(() => {
    return showServices ? serviceProducts : readyForSalesItems;
  }, [showServices, serviceProducts, readyForSalesItems]);

  const totalItems = useMemo(() => {
    return itemListData.length;
  }, [itemListData]);

  // Mock data for the new UI (keeping existing data structure)
  const mockProducts = useMemo(
    () =>
      readyForSalesItems.map((item) => ({
        id: item.id,
        name: item.item_name,
        category: item.category || item.uom_category,
        price: parseFloat(item.selling_price) || 0,
        stock: item.balance || 0,
        image: "📦", // Default emoji for products
        sku: item.sku || item.item_code,
        ...item,
      })),
    [readyForSalesItems],
  );

  const mockServices = useMemo(
    () =>
      serviceProducts.map((item) => ({
        id: item.id,
        name: item.item_name,
        category: item.category || item.uom_category,
        price: parseFloat(item.selling_price) || 0, // Use existing selling price as default
        selling_price: parseFloat(item.selling_price) || 0,
        stock: 0, // Services don't have stock
        image: "🔧", // Default emoji for services
        sku: item.sku || item.item_code,
        ...item,
      })),
    [serviceProducts],
  );

  const allSellableItems = useMemo(
    () => [...mockProducts, ...mockServices],
    [mockProducts, mockServices],
  );

  const resolveProductFromScanCode = useCallback(
    (rawCode) => {
      const code = normalizeScannedCode(rawCode);
      if (!code) return null;

      const exact = allSellableItems.find((item) =>
        productMatchesScanCode(item, code),
      );
      if (exact) return exact;

      const q = code.toLowerCase();
      return (
        allSellableItems.find(
          (item) =>
            String(item.sku || "")
              .toLowerCase()
              .includes(q) ||
            String(item.item_code || "")
              .toLowerCase()
              .includes(q) ||
            String(item.product_id || "")
              .toLowerCase()
              .includes(q),
        ) || null
      );
    },
    [allSellableItems],
  );

  // Filtered items for new UI
  const filteredItems = useMemo(() => {
    const items = activeTab === "products" ? mockProducts : mockServices;
    const q = searchTerm.toLowerCase();
    return items.filter(
      (item) =>
        item.name?.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q) ||
        item.item_code?.toLowerCase().includes(q) ||
        String(item.product_id || "")
          .toLowerCase()
          .includes(q) ||
        String(item.barcode || "")
          .toLowerCase()
          .includes(q),
    );
  }, [activeTab, mockProducts, mockServices, searchTerm]);

  // Line-item Typeahead options — do not reuse the POS grid searchTerm.
  const filterItemsByTab = useCallback(
    (tab) => (tab === "products" ? mockProducts : mockServices),
    [mockProducts, mockServices],
  );

  // Check minimum order amount when subtotal changes
  useEffect(() => {
    if (
      selectedDiscount &&
      selectedDiscount.min_order_amount > 0 &&
      subtotal < selectedDiscount.min_order_amount
    ) {
      toast.warning(
        `Order amount (₦${formatNumber1(
          subtotal,
        )}) is below minimum required (₦${formatNumber1(
          selectedDiscount.min_order_amount,
        )}) for ${selectedDiscount.discount_name}`,
      );
      setSelectedDiscount(null);
      setZohoDiscountPercent("");
      setZohoDiscountMode("%");
    }
  }, [subtotal, selectedDiscount]);

  // Handle discount selection — fill editable value from the catalog entry
  const handleDiscountSelect = (discount) => {
    if (
      discount &&
      discount.min_order_amount > 0 &&
      subtotal < discount.min_order_amount
    ) {
      toast.warning(
        `Minimum order amount of ₦${formatNumber1(
          discount.min_order_amount,
        )} required for this discount`,
      );
      return;
    }
    setSelectedDiscount(discount);
    if (discount) {
      const raw = parseFloat(discount.value);
      setZohoDiscountPercent(
        Number.isFinite(raw) ? String(raw) : "",
      );
      const isPct =
        discount.discount_type === "Percentage" ||
        String(discount.discount_type || "").toLowerCase() === "percentage";
      setZohoDiscountMode(isPct ? "%" : "flat");
    } else {
      setZohoDiscountPercent("");
      setZohoDiscountMode("%");
    }
  };

  // Clear discount
  const clearDiscount = () => {
    setSelectedDiscount(null);
    setZohoDiscountPercent("");
    setZohoDiscountMode("%");
  };

  const activeDiscounts = useMemo(
    () =>
      (availableDiscounts || []).filter(
        (d) => String(d.status || "").toLowerCase() === "active",
      ),
    [availableDiscounts],
  );

  const formatDiscountOptionLabel = useCallback((discount) => {
    const name = (discount.discount_name || "Discount").trim();
    const raw = parseFloat(discount.value);
    const num = Number.isFinite(raw) ? raw : 0;
    const isPercentage =
      discount.discount_type === "Percentage" ||
      String(discount.discount_type || "").toLowerCase() === "percentage";
    if (isPercentage) return `${name} (${num}%)`;
    return `${name} (₦${formatNumber1(num)})`;
  }, []);

  // Calculate taxable subtotal (only from taxable items, exclude Pro-bono)
  const taxableSubtotal = useMemo(() => {
    const saleItems = cart.filter(
      (item) =>
        item.status === "for sale" &&
        item.taxable === "Taxable" &&
        !item.proBono, // Exclude Pro-bono items
    );
    return saleItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  }, [cart]);

  const nonTaxableSubtotal = useMemo(() => {
    const saleItems = cart.filter(
      (item) =>
        item.status === "for sale" &&
        item.taxable !== "Taxable" &&
        !item.proBono,
    );
    return saleItems.reduce(
      (sum, item) => sum + parseFloat(item.amount || 0),
      0,
    );
  }, [cart]);

  // Output VAT: Inclusive = extract from amount (2,581.40); Exclusive = rate × amount (2,775.00)
  const outputVATAmount = useMemo(() => {
    if (selectedOutputVAT.length === 0) return 0;

    const selectedOutputVATTaxes = outputVATTaxes.filter((tax) =>
      selectedOutputVAT.includes(tax.id),
    );
    if (selectedOutputVATTaxes.length === 0) return 0;

    const taxableAmount =
      taxableSubtotal - discountAmount * (taxableSubtotal / (subtotal || 1));

    const inclusiveTaxes = selectedOutputVATTaxes.filter((t) =>
      isTaxInclusive(t, activeBusiness?.vat_policy || "vat_exclusive"),
    );
    const exclusiveTaxes = selectedOutputVATTaxes.filter(
      (t) => !isTaxInclusive(t, activeBusiness?.vat_policy || "vat_exclusive"),
    );

    let total = 0;
    if (inclusiveTaxes.length > 0) {
      const totalRate = inclusiveTaxes.reduce(
        (sum, t) => sum + parseFloat(t.rate || 0) / 100,
        0,
      );
      if (totalRate > 0)
        total += taxableAmount - taxableAmount / (1 + totalRate);
    }
    if (exclusiveTaxes.length > 0) {
      total += exclusiveTaxes.reduce((sum, t) => {
        const rate = parseFloat(t.rate || 0) / 100;
        return sum + taxableAmount * rate;
      }, 0);
    }
    return total;
  }, [
    selectedOutputVAT,
    outputVATTaxes,
    taxableSubtotal,
    subtotal,
    discountAmount,
    activeBusiness?.vat_policy,
  ]);
  const outputVATAmountToAdd = useMemo(() => {
    const vatPolicy = activeBusiness?.vat_policy || "vat_exclusive";
    if (selectedOutputVAT.length === 0) return 0;

    const taxableAmount =
      taxableSubtotal - discountAmount * (taxableSubtotal / (subtotal || 1));
    const selected = outputVATTaxes.filter((t) =>
      selectedOutputVAT.includes(t.id),
    );
    const exclusiveTaxes = selected.filter((t) =>
      !isTaxInclusive(t, vatPolicy),
    );

    if (vatPolicy === "vat_exclusive") {
      return exclusiveTaxes.reduce(
        (sum, t) => sum + taxableAmount * (parseFloat(t.rate || 0) / 100),
        0,
      );
    }
    if (vatPolicy === "vat_inclusive") return 0;
    if (vatPolicy === "all")
      return exclusiveTaxes.reduce(
        (sum, t) => sum + taxableAmount * (parseFloat(t.rate || 0) / 100),
        0,
      );
    return 0;
  }, [
    activeBusiness?.vat_policy,
    selectedOutputVAT,
    outputVATTaxes,
    taxableSubtotal,
    subtotal,
    discountAmount,
  ]);

  const taxBreakdown = useMemo(() => {
    // Regular taxes (non-Output VAT): split inclusive extract vs exclusive add-on
    if (selectedTaxes.length === 0) {
      return { inclusive: 0, exclusive: 0, display: 0 };
    }

    const vatPolicy = activeBusiness?.vat_policy || "vat_exclusive";
    const taxableAmount =
      taxableSubtotal - discountAmount * (taxableSubtotal / (subtotal || 1));

    const inclusiveTaxes = selectedTaxes.filter((t) =>
      isTaxInclusive(t, vatPolicy),
    );
    const exclusiveTaxes = selectedTaxes.filter(
      (t) => !isTaxInclusive(t, vatPolicy),
    );

    let inclusive = 0;
    let exclusive = 0;
    if (inclusiveTaxes.length > 0) {
      const totalRate = inclusiveTaxes.reduce(
        (sum, taxItem) => sum + parseFloat(taxItem.rate || 0) / 100,
        0,
      );
      if (totalRate > 0) {
        inclusive = taxableAmount - taxableAmount / (1 + totalRate);
      }
    }
    if (exclusiveTaxes.length > 0) {
      exclusive = exclusiveTaxes.reduce((sum, taxItem) => {
        const rate = parseFloat(taxItem.rate) || 0;
        return sum + (taxableAmount * rate) / 100;
      }, 0);
    }
    return {
      inclusive,
      exclusive,
      display: inclusive + exclusive,
    };
  }, [
    taxableSubtotal,
    subtotal,
    discountAmount,
    selectedTaxes,
    activeBusiness?.vat_policy,
  ]);

  const tax = taxBreakdown.display;

  /** Display total tax (regular + Output VAT extract/add). */
  const displayTotalTax = useMemo(
    () => (tax || 0) + (outputVATAmount || 0),
    [tax, outputVATAmount],
  );

  const total = useMemo(() => {
    const afterDiscount = subtotal - discountAmount;
    // Inclusive tax is already in the price — only exclusive tax is added on top
    return (
      afterDiscount +
      (taxBreakdown.exclusive || 0) +
      (outputVATAmountToAdd || 0)
    );
  }, [
    subtotal,
    discountAmount,
    taxBreakdown.exclusive,
    outputVATAmountToAdd,
  ]);
  totalRef.current = total;

  useEffect(() => {
    if (saleType !== "paid") return;
    const due = Number(total) || 0;
    if (payWithCash && !payWithTransfer) {
      setCashPayAmount(due > 0 ? formatNumberWithCommas(String(due)) : "");
      setTransferPayAmount("");
    } else if (!payWithCash && payWithTransfer) {
      setTransferPayAmount(due > 0 ? formatNumberWithCommas(String(due)) : "");
      setCashPayAmount("");
    } else if (payWithCash && payWithTransfer) {
      // No split UI — put full amount on cash, remainder 0 on transfer.
      setCashPayAmount(due > 0 ? formatNumberWithCommas(String(due)) : "");
      setTransferPayAmount("0");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleType, payWithCash, payWithTransfer, total]);

  /** Per-line money for invoice-style columns (Discount / Tax / Amount). */
  const getLineMoneyBreakdown = useCallback(
    (item) => {
      const qty =
        parseFloat(item.quantity_sold ?? item.quantity ?? 0) || 0;
      const unit =
        parseFloat(item.selling_price ?? item.price ?? 0) || 0;
      const gross = item.proBono
        ? 0
        : parseFloat(item.amount || 0) || 0;
      const lineDiscount =
        !item.proBono && subtotal > 0
          ? (discountAmount * gross) / subtotal
          : 0;
      const afterDiscount = Math.max(0, gross - lineDiscount);
      let vatRate = 0;
      let lineVat = 0;
      const policy = activeBusiness?.vat_policy || "vat_exclusive";
      const lineTax =
        item.line_tax_id != null
          ? lineTaxOptions.find(
              (t) => String(t.id) === String(item.line_tax_id),
            ) ||
            outputVATTaxes.find(
              (t) => String(t.id) === String(item.line_tax_id),
            ) ||
            null
          : null;
      const appliedTaxes = lineTax
        ? [lineTax]
        : [
            ...(selectedTaxes || []),
            ...outputVATTaxes.filter((t) =>
              selectedOutputVAT.includes(t.id),
            ),
          ];
      if (
        !item.proBono &&
        item.taxable === "Taxable" &&
        appliedTaxes.length > 0
      ) {
        vatRate = appliedTaxes.reduce(
          (sum, t) => sum + (parseFloat(t.rate) || 0),
          0,
        );
        if (vatRate > 0) {
          const inclusiveTaxes = appliedTaxes.filter((t) =>
            isTaxInclusive(t, policy),
          );
          const exclusiveTaxes = appliedTaxes.filter(
            (t) => !isTaxInclusive(t, policy),
          );
          if (inclusiveTaxes.length > 0) {
            const r =
              inclusiveTaxes.reduce(
                (sum, t) => sum + (parseFloat(t.rate) || 0),
                0,
              ) / 100;
            if (r > 0) lineVat += afterDiscount - afterDiscount / (1 + r);
          }
          if (exclusiveTaxes.length > 0) {
            const r =
              exclusiveTaxes.reduce(
                (sum, t) => sum + (parseFloat(t.rate) || 0),
                0,
              ) / 100;
            lineVat += afterDiscount * r;
          }
        }
      }
      return {
        qty,
        unit,
        lineDiscount,
        vatRate,
        lineVat,
        lineTaxId: item.line_tax_id ?? null,
        /** Line amount = qty × rate (tax shown separately), Zoho-style */
        amount: afterDiscount,
        hsn:
          item.hsn_code ||
          item.hsn ||
          item.isic ||
          item.sku ||
          item.item_code ||
          item.product_id ||
          "",
      };
    },
    [
      subtotal,
      discountAmount,
      selectedTaxes,
      selectedOutputVAT,
      outputVATTaxes,
      lineTaxOptions,
      activeBusiness?.vat_policy,
    ],
  );

  /** VAT analysis rows for table footer (document-style). */
  const vatAnalysisRows = useMemo(() => {
    const policy = activeBusiness?.vat_policy || "vat_exclusive";
    const taxableAmount =
      taxableSubtotal -
      discountAmount * (taxableSubtotal / (subtotal || 1));
    const appliedTaxes = [
      ...(selectedTaxes || []),
      ...outputVATTaxes.filter((t) => selectedOutputVAT.includes(t.id)),
    ];
    if (!appliedTaxes.length) return [];

    return appliedTaxes.map((taxItem) => {
      const rate = parseFloat(taxItem.rate || 0);
      const inclusive = isTaxInclusive(taxItem, policy);
      const vat = inclusive
        ? rate > 0
          ? taxableAmount - taxableAmount / (1 + rate / 100)
          : 0
        : (taxableAmount * rate) / 100;
      return {
        id: taxItem.id,
        code: taxItem.description || `VAT ${rate}%`,
        goodsValue: taxableAmount,
        rate,
        vat,
      };
    });
  }, [
    selectedTaxes,
    selectedOutputVAT,
    outputVATTaxes,
    taxableSubtotal,
    discountAmount,
    subtotal,
    activeBusiness?.vat_policy,
  ]);

  /** Line amounts for table footer — mirrors cart sales-tax breakdown */
  const salesTaxFooterLines = useMemo(() => {
    if (!selectedTaxes?.length) return [];
    const vatPolicy = activeBusiness?.vat_policy || "vat_exclusive";
    const taxableAmount =
      taxableSubtotal - discountAmount * (taxableSubtotal / (subtotal || 1));

    if (vatPolicy === "vat_exclusive" || vatPolicy === "all") {
      return selectedTaxes.map((taxItem) => ({
        id: `sales-foot-${taxItem.id}`,
        label: `Sales tax · ${taxItem.description} (${taxItem.rate}%)`,
        amount: (taxableAmount * parseFloat(taxItem.rate || 0)) / 100,
      }));
    }

    if (vatPolicy === "vat_inclusive") {
      const totalRate = selectedTaxes.reduce(
        (sum, t) => sum + parseFloat(t.rate || 0) / 100,
        0,
      );
      if (totalRate <= 0) {
        return selectedTaxes.map((taxItem) => ({
          id: `sales-foot-${taxItem.id}`,
          label: `Sales tax · ${taxItem.description} (${taxItem.rate}%) · Inclusive`,
          amount: 0,
        }));
      }
      const netAmount = taxableSubtotal / (1 + totalRate);
      const totalVAT = taxableSubtotal - netAmount;
      return selectedTaxes.map((taxItem) => {
        const taxRate = parseFloat(taxItem.rate || 0) / 100;
        const taxAmountForDisplay =
          totalRate > 0 ? (totalVAT * taxRate) / totalRate : 0;
        return {
          id: `sales-foot-${taxItem.id}`,
          label: `Sales tax · ${taxItem.description} (${taxItem.rate}%) · Inclusive`,
          amount: taxAmountForDisplay,
        };
      });
    }

    return [];
  }, [
    selectedTaxes,
    activeBusiness?.vat_policy,
    taxableSubtotal,
    discountAmount,
    subtotal,
  ]);

  // New UI Functions
  const addToCartNew = useCallback(
    (product) => {
      if (!product) {
        toast.error("Please select a product or service first");
        return;
      }

      const rawQty = parseNumberFromFormatted(quantityFormattedRef.current);
      if (rawQty === "" || rawQty === ".") {
        toast.error("Enter a quantity");
        return;
      }
      const parsedQty = parseFloat(rawQty);
      if (!Number.isFinite(parsedQty)) {
        toast.error("Enter a valid quantity");
        return;
      }
      const quantityToAdd = parsedQty;

      if (quantityToAdd < 0.0001) {
        toast.error("Quantity must be at least 0.0001");
        return;
      }
      const sellingPrice =
        parseFloat(product.price) || parseFloat(product.selling_price) || 0;

      // Check stock availability for products (skip for services)
      if (product.item_type !== "Service") {
        const availableStock = parseFloat(product.balance) || 0;

        // Calculate quantity already in cart for this product
        const quantityInCart = cart
          .filter(
            (item) =>
              (item.product_id === product.product_id ||
                item.product_id === product.id) &&
              item.expiry_date === product.expiry_date &&
              String(item.branchId ?? item.branch_id ?? "") ===
                String(product.branchId ?? product.branch_id ?? ""),
          )
          .reduce((sum, item) => sum + parseFloat(item.quantity_sold || 0), 0);

        const totalQuantity = quantityInCart + quantityToAdd;

        // Only check stock if allow_sales_without_stock is disabled
        if (!allowSalesWithoutStock) {
          if (availableStock <= 0) {
            toast.error(`${product.name || product.item_name} is out of stock`);
            return;
          }

          if (totalQuantity > availableStock) {
            toast.error(
              `Insufficient stock! Available: ${formatNumber1(
                availableStock,
              )}, ` +
                `In cart: ${formatNumber1(quantityInCart)}, ` +
                `Trying to add: ${formatNumber1(quantityToAdd)}`,
            );
            return;
          }
        } else {
          // When allow_sales_without_stock is enabled, warn but allow
          if (availableStock <= 0) {
            toast.warning(
              `${product.name || product.item_name} is out of stock, but sale is allowed due to settings`,
            );
          } else if (totalQuantity > availableStock) {
            toast.warning(
              `Insufficient stock! Available: ${formatNumber1(
                availableStock,
              )}, ` +
                `In cart: ${formatNumber1(quantityInCart)}, ` +
                `Trying to add: ${formatNumber1(quantityToAdd)}. ` +
                `Sale will proceed due to settings.`,
            );
          }
        }
      }

      // Sales stopped — block even when stock remains
      if (isSalesStopped(product)) {
        toast.error(
          `Sales are stopped for ${
            product.name || product.item_name
          }. This product cannot be sold.`,
        );
        return;
      }

      // Sales target / limit — block even when stock remains (facility-wide by SKU)
      const catalog = [...readyForSalesItems, ...serviceProducts];
      let limitRemaining = getSalesLimitRemaining(product);
      let limitPeriod = product.sales_limit_period;
      if (limitRemaining == null) {
        const match = catalog.find(
          (p) =>
            String(p.product_id || p.sku || "") ===
            String(product.product_id || product.sku || product.id || ""),
        );
        if (match) {
          limitRemaining = getSalesLimitRemaining(match);
          limitPeriod = match.sales_limit_period ?? limitPeriod;
        }
      }
      if (limitRemaining != null) {
        const sku = product.product_id || product.sku || product.id;
        const qtyInCartForSku = cartQtyForSku(cart, sku);
        const totalForSku = qtyInCartForSku + quantityToAdd;
        if (limitRemaining <= 0) {
          toast.error(
            `Sales ${salesLimitPeriodLabel(limitPeriod)} limit reached for ${
              product.name || product.item_name
            }. No more can be sold this period.`,
          );
          return;
        }
        if (totalForSku > limitRemaining) {
          toast.error(
            `Sales ${salesLimitPeriodLabel(limitPeriod)} limit for ${
              product.name || product.item_name
            }. Remaining: ${formatNumber1(limitRemaining)}, in cart: ${formatNumber1(
              qtyInCartForSku,
            )}, trying to add: ${formatNumber1(quantityToAdd)}. Max you can add: ${formatNumber1(
              Math.max(0, limitRemaining - qtyInCartForSku),
            )}`,
          );
          return;
        }
      }

      const amount = sellingPrice * quantityToAdd;

      const cartItem = {
        id: UUIDV4(),
        product_id: product.product_id || product.id,
        item_name: product.name || product.item_name,
        multiplier_type: product.multiplier_type,
        multiplier_id: product.multiplier_id,
        category: product.category,
        unit_of_measure: product.unit_of_measure,
        quantity_sold: quantityToAdd,
        uom_category: product.uom_category,
        quantity: quantityToAdd,
        selling_price: sellingPrice,
        price: sellingPrice,
        amount: amount,
        status: "for sale",
        type: product.item_type === "Service" ? "service" : "sales",
        balance: product.balance,
        expiry_date: product.expiry_date,
        item_type: product.item_type,
        taxable: product.taxable || "Taxable",
        line_tax_id: defaultLineTaxId,
        proBono: false, // Default to false
        sales_stopped: isSalesStopped(product),
        sales_limit_period: limitPeriod ?? product.sales_limit_period ?? null,
        sales_limit: product.sales_limit ?? null,
        sales_limit_remaining:
          limitRemaining ?? product.sales_limit_remaining ?? null,
        branchId:
          product.branchId ||
          product.branch_id ||
          (selectedBranch ? Number(selectedBranch) : null),
        branch_name:
          product.location_name ||
          product.branch_name ||
          getItemBranchLocation(product) ||
          selectedBranchLocation ||
          null,
      };

      setCart((prev) => [...prev, cartItem]);
      setQuantity(1);
      setQuantityFormatted("1.0000");
      quantityFormattedRef.current = "1.0000";
      setSelectedProduct(null); // Clear selected product after adding
      setSelectedIndex(-1); // Clear selection index
      setSearchTerm(""); // Clear search term

      toast.success(`${product.name || product.item_name} added to cart`);

      setTimeout(() => {
        if (invoiceViewMode === "lines" && sellingPrice <= 0) {
          const el = document.getElementById(
            `invoice-line-rate-${cartItem.id}`,
          );
          if (el) {
            el.focus();
            el.select?.();
          }
        } else {
          const searchInput =
            searchInputRef.current ||
            document.getElementById("make-sale-search-input");
          if (searchInput) searchInput.focus();
        }
      }, 100);
    },
    [
      cart,
      parseNumberFromFormatted,
      allowSalesWithoutStock,
      formatNumber1,
      invoiceViewMode,
      selectedBranch,
      selectedBranchLocation,
      getItemBranchLocation,
      defaultLineTaxId,
      readyForSalesItems,
      serviceProducts,
    ],
  );

  const applyScannedProduct = useCallback(
    (rawCode) => {
      const product = resolveProductFromScanCode(rawCode);
      if (!product) {
        toast.error(`No product found for "${normalizeScannedCode(rawCode)}"`);
        return false;
      }

      setLastScanPreview(normalizeScannedCode(rawCode));
      setActiveTab(product.item_type === "Service" ? "services" : "products");
      setSearchTerm("");
      quantityFormattedRef.current = "1.0000";
      setQuantity(1);
      setQuantityFormatted("1.0000");
      addToCartNew(product);
      return true;
    },
    [resolveProductFromScanCode, addToCartNew],
  );

  resolveProductFromScanRef.current = applyScannedProduct;

  const handleBarcodeScan = useCallback(
    (code) => {
      if (
        document.activeElement === searchInputRef.current ||
        isMakeSaleTypingTarget()
      ) {
        return;
      }
      applyScannedProduct(code);
      requestAnimationFrame(() => searchInputRef.current?.focus());
    },
    [applyScannedProduct],
  );

  useScanDetection({
    onComplete: handleBarcodeScan,
    onError: () => {
      // Stay silent while the user is typing in any field (search, qty, rate…)
      if (isMakeSaleTypingTarget()) return;
      toast.error("Incomplete scan — scan the barcode again");
    },
    minLength: 2,
    averageWaitTime: 100,
    timeToEvaluate: 150,
  });

  const handleSearchInputKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && e.currentTarget.value.trim()) {
        e.preventDefault();
        const applied = applyScannedProduct(e.currentTarget.value);
        if (applied) {
          e.currentTarget.value = "";
          setSearchTerm("");
        }
      }
    },
    [applyScannedProduct],
  );

  // Keyboard navigation functions
  const handleKeyDown = useCallback(
    (e) => {
      const items = filteredItems;
      if (items.length === 0) return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev >= items.length - 1 ? 0 : prev + 1));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(0, prev - 1));
          break;
        case "ArrowRight":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < items.length) {
            const item = items[selectedIndex];
            // Ensure service has its default price when selected
            const priceValue =
              parseFloat(item.price) || parseFloat(item.selling_price) || 0;
            const productWithPrice = {
              ...item,
              price: priceValue,
              price_formatted:
                priceValue > 0
                  ? formatNumberWithCommas(priceValue.toString())
                  : "",
              selling_price: priceValue,
            };
            setSelectedProduct(productWithPrice);
            // Focus on appropriate input based on item type
            setTimeout(() => {
              if (item.item_type === "Service") {
                const sellingPriceInput = document.getElementById(
                  `selling-price-input-${item.id}`,
                );
                if (sellingPriceInput) sellingPriceInput.focus();
              } else {
                const quantityInput = document.getElementById("quantity-input");
                if (quantityInput) quantityInput.focus();
              }
            }, 100);
          }
          break;
        case "Escape":
          setSelectedIndex(-1);
          setSelectedProduct(null);
          break;
      }
    },
    [filteredItems, selectedIndex, addToCartNew],
  );

  // Sync selected row only when the highlighted index changes (not when filteredItems
  // gets a new reference while typing price/qty — that was resetting decimals mid-edit).
  const prevSyncedSelectionIndex = useRef(-2);
  useEffect(() => {
    if (selectedIndex < 0 || selectedIndex >= filteredItems.length) {
      prevSyncedSelectionIndex.current = selectedIndex;
      return;
    }
    if (prevSyncedSelectionIndex.current === selectedIndex) {
      return;
    }
    prevSyncedSelectionIndex.current = selectedIndex;
    const item = filteredItems[selectedIndex];
    const priceValue =
      parseFloat(item.price) || parseFloat(item.selling_price) || 0;
    setSelectedProduct({
      ...item,
      price: priceValue,
      price_formatted:
        priceValue > 0 ? formatNumberWithCommas(priceValue.toString()) : "",
      selling_price: priceValue,
    });
  }, [selectedIndex, filteredItems]);

  // Reset selected index when search term changes
  useEffect(() => {
    setSelectedIndex(-1);
    setSelectedProduct(null);
  }, [searchTerm, activeTab]);

  const removeFromCartNew = useCallback((itemId) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const moveCartItem = useCallback((itemId, direction) => {
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.id === itemId);
      if (idx < 0) return prev;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }, []);

  const updateQuantityNew = useCallback(
    (itemId, newQuantity) => {
      if (!Number.isFinite(newQuantity) || newQuantity < 0.0001) return;

      setCart((prev) => {
        const itemToUpdate = prev.find((item) => item.id === itemId);
        if (!itemToUpdate) return prev;

        if (isSalesStopped(itemToUpdate)) {
          toast.error(
            `Sales are stopped for ${itemToUpdate.item_name}. This product cannot be sold.`,
          );
          return prev;
        }

        const catalog = [...readyForSalesItems, ...serviceProducts];
        const { max, remaining, period } = getMaxQtyForLine(
          itemToUpdate,
          prev,
          {
            allowWithoutStock: !!allowSalesWithoutStock,
            catalog,
          },
        );

        let qty = newQuantity;
        if (max != null && qty > max + 1e-9) {
          const label = salesLimitPeriodLabel(
            period || itemToUpdate.sales_limit_period,
          );
          toast.error(
            remaining != null
              ? `Sales ${label} target for ${itemToUpdate.item_name}: max ${formatNumber1(
                  max,
                )} (remaining ${formatNumber1(remaining)})`
              : `Maximum quantity for ${itemToUpdate.item_name} is ${formatNumber1(
                  max,
                )}`,
          );
          if (max < 0.0001) return prev;
          qty = max;
        }

        return prev.map((item) => {
          if (item.id !== itemId) return item;
          const newAmount = item.proBono
            ? 0
            : parseFloat(item.selling_price) * qty;
          return {
            ...item,
            quantity_sold: qty,
            quantity: qty,
            amount: newAmount,
            sales_limit_remaining:
              item.sales_limit_remaining ?? remaining ?? null,
            sales_limit_period: item.sales_limit_period ?? period ?? null,
          };
        });
      });
    },
    [readyForSalesItems, serviceProducts, allowSalesWithoutStock],
  );

  /** Step price on product/service cards (±1) without replacing typed decimals. */
  const CARD_PRICE_STEP = 1;
  const adjustCardSellingPrice = useCallback(
    (item, stepDelta) => {
      const base =
        selectedProduct?.id === item.id
          ? parseFloat(selectedProduct.price) || 0
          : parseFloat(item.price) || parseFloat(item.selling_price) || 0;
      const next = Math.max(0, Math.round((base + stepDelta) * 100) / 100);
      const formattedValue = formatNumberWithCommas(next.toString());
      setSelectedProduct({
        ...item,
        price: next,
        price_formatted: formattedValue,
        selling_price: next,
      });
      if (activeTab === "services") {
        setServiceProducts((prev) =>
          prev.map((service) =>
            service.id === item.id
              ? { ...service, price: next, selling_price: next }
              : service,
          ),
        );
      } else {
        setReadyForSalesItems((prev) =>
          prev.map((product) =>
            product.id === item.id || product.product_id === item.id
              ? { ...product, selling_price: next }
              : product,
          ),
        );
      }
    },
    [activeTab, selectedProduct],
  );

  // Toggle Pro-bono status for a cart item
  const toggleProBono = useCallback((itemId) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const newProBono = !item.proBono;
          const qty = parseFloat(item.quantity_sold ?? item.quantity ?? 0);
          const price = parseFloat(item.selling_price ?? item.price ?? 0);
          return {
            ...item,
            proBono: newProBono,
            amount: newProBono ? 0 : qty * price,
          };
        }
        return item;
      }),
    );
  }, []);

  // Conditional rendering based on showPDFPreview
  if (showPDFPreview && invoiceData) {
    return (
      <div className="h-screen flex flex-col">
        {/* Action Buttons */}

        <div className="no-print bg-gray-100 p-2 flex justify-between items-center border-b">
          <button
            onClick={handleCancelPDFPreview}
            className="px-3 py-0.5 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            <X className="inline mr-1" size={14} />
            Back to Preview
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-0.5 text-sm bg-[var(--aa-navy)] text-white rounded hover:bg-[var(--aa-navy-hover)] transition-colors"
            >
              <PrinterIcon className="inline mr-1" size={14} />
              Print PDF
            </button>
            <button
              onClick={handleProcessSale}
              className="px-3 py-0.5 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              <Check className="inline mr-1" size={14} />
              Complete Sale
            </button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1">
          <CreditSaleInvoicePDFViewer
            invoiceData={invoiceData}
            business={activeBusiness}
            customer={selectedCustomer}
            date={form.date}
            customerCopyEnabled={customerCopyEnabled}
            customerCopyPrices={customerCopyPrices}
          />
        </div>
      </div>
    );
  }

  // Conditional rendering based on showInvoicePreview
  if (showInvoicePreview && invoiceData) {
    return (
      <CreditSaleInvoiceImproved
        invoiceData={invoiceData}
        business={activeBusiness}
        customer={selectedCustomer}
        date={moment().format("YYYY-MM-DD HH:mm:ss")}
        customPricing={customPricing}
        customPrices={customPrices}
        customerCopyEnabled={customerCopyEnabled}
        customerCopyPrices={customerCopyPrices}
        setCustomerCopyPrices={setCustomerCopyPrices}
        taxes={selectedTaxes}
        discount={selectedDiscount}
        onConfirm={handleConfirmSale}
        onCancel={handleCancelPreview}
      />
    );
  }

  return (
    <div
      className={`relative min-h-screen ${
        invoiceViewMode === "lines"
          ? "bg-white"
          : "bg-gradient-to-br from-gray-50 to-gray-100"
      }`}
    >
      {/* Processing Overlay */}
      {processingCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 shadow-2xl flex flex-col items-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[var(--aa-accent)] mb-4"></div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Processing Sale...
            </h3>
            <p className="text-sm text-gray-600">
              Please wait while we complete your transaction
            </p>
          </div>
        </div>
      )}

      <div
        className={`flex ${
          invoiceViewMode === "lines" ? "min-h-screen" : "h-screen"
        }`}
      >
        {/* Left Panel - Product Selection */}
        <div className="flex-1 flex flex-col bg-white min-w-0">
          {/* Header */}
          {invoiceViewMode === "lines" ? (
            <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FileText
                    className="size-6 text-[var(--aa-accent)]"
                    strokeWidth={1.75}
                  />
                  <div>
                    <h1 className="text-xl font-semibold text-slate-900">
                      New Invoice
                    </h1>
                    <p className="text-xs text-slate-500">
                      {modeOfPayment === "credit"
                        ? "Credit sale · goes to credit approval (no cashier)"
                        : modeOfPayment === "deposit"
                          ? "Apply Deposit · create invoice, then apply customer deposit"
                          : modeOfPayment === "credit_split"
                            ? "Sent to cashier · cash + transfer, remainder on credit"
                            : modeOfPayment === "both"
                              ? "Sent to cashier · cash and transfer"
                              : modeOfPayment === "transfer"
                                ? "Sent to cashier · transfer"
                                : "Sent to cashier · cash"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {allowSalesWithoutStock && (
                    <div
                      className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
                      title="This business allows selling products when on-hand stock is zero or negative."
                    >
                      <AlertCircle size={12} aria-hidden />
                      Sales Without Stock
                    </div>
                  )}
                </div>
              </div>
              {(!selectedCustomer || cart.length === 0) && (
                <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {!selectedCustomer && (
                    <span className="mr-3">Select a customer.</span>
                  )}
                  {cart.length === 0 && (
                    <span>Enter a valid item name or description.</span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[var(--aa-navy)] text-white px-4 py-1.5 shadow-lg">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold">
                    {modeOfPayment === "credit"
                      ? "Credit Sale"
                      : modeOfPayment === "credit_split"
                        ? "Credit + Cash + Transfer Sale"
                        : modeOfPayment === "both"
                          ? "Cash + Transfer Sale"
                          : modeOfPayment === "transfer"
                            ? "Transfer Sale"
                            : "Cash Sale"}
                  </h1>
                </div>
                {allowSalesWithoutStock && (
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-white bg-indigo-950/40 border border-white/25 shadow-sm"
                    title="This business allows selling products when on-hand stock is zero or negative."
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                      <AlertCircle
                        size={12}
                        className="text-white"
                        aria-hidden
                      />
                    </span>
                    <span>Sales Without Stock Enabled</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Invoice header form (lines view) */}
          {invoiceViewMode === "lines" && (
            <div className="shrink-0 space-y-4 border-b border-slate-100 bg-white px-6 py-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[9rem_minmax(0,28rem)] lg:items-center">
                <label className="text-sm font-medium text-slate-600 lg:text-right">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <div>
                  <SearchCustomerInput
                    size="sm"
                    selected={selectedCustomer ? [selectedCustomer] : []}
                    onChange={(customer) => {
                      setSelectedCustomer(customer);
                    }}
                    className="w-full"
                  />
                  {selectedCustomer?.customerNo && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Customer No:{" "}
                      <span className="font-medium">
                        {selectedCustomer.customerNo}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[9rem_minmax(0,28rem)] lg:items-center">
                <label className="text-sm font-medium text-slate-600 lg:text-right">
                  Invoice # <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={invoiceNumberDisplay}
                  className="h-9 w-full max-w-xs rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[9rem_minmax(0,1fr)] lg:items-start">
                <span className="pt-2 text-sm font-medium text-slate-600 lg:text-right">
                  Invoice Date <span className="text-red-500">*</span>
                </span>
                <div className="flex flex-wrap gap-3">
                  <input
                    type="date"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    max={moment().format("YYYY-MM-DD")}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                  />
                  {saleType === "credit" && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-600">Terms</label>
                        <select
                          value={invoiceTerms}
                          onChange={(e) => setInvoiceTerms(e.target.value)}
                          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                        >
                          <option value="Due on receipt">Due on Receipt</option>
                          <option value="Net 15">Net 15</option>
                          <option value="Net 30">Net 30</option>
                          <option value="Net 60">Net 60</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-600">
                          Due Date
                        </label>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[9rem_minmax(0,28rem)] lg:items-center">
                <label className="text-sm font-medium text-slate-600 lg:text-right">
                  Mode of Payment <span className="text-red-500">*</span>
                </label>
                <div className="w-full max-w-xs space-y-1">
                  <select
                    value={modeOfPayment}
                    onChange={(e) => applyPaymentMode(e.target.value)}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                  >
                    <option value="cash">Cash</option>
                    <option value="transfer">Transfer</option>
                    <option value="both">Cash + Transfer</option>
                    <option value="credit_split">Credit + Cash + Transfer</option>
                    <option value="credit">Credit</option>
                    <option value="deposit">Apply Deposit</option>
                  </select>
                  <p className="text-[11px] text-slate-500">
                    {modeOfPayment === "deposit"
                      ? "Invoice is created like credit, then you apply the customer deposit (not Credit Approval)."
                      : modeOfPayment === "credit"
                        ? "Credit invoice goes to Credit approval first, then Invoice Separation."
                        : modeOfPayment === "credit_split"
                          ? "Invoice is sent to Cashier for cash and transfer collection; unpaid remainder stays on credit."
                          : `Invoice is sent to Cashier for ${
                              modeOfPayment === "both"
                                ? "cash and transfer"
                                : modeOfPayment === "transfer"
                                  ? "transfer"
                                  : "cash"
                            } collection — payment is not taken here.`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[9rem_minmax(0,28rem)] lg:items-center">
                <label className="text-sm font-medium text-slate-600 lg:text-right">
                  Accounts Receivable
                </label>
                <input
                  type="text"
                  readOnly
                  value={
                    selectedCustomer?.receivable_code
                      ? `${selectedCustomer.receivable_code}${
                          selectedCustomer.fullname
                            ? ` · ${selectedCustomer.fullname}`
                            : ""
                        }`
                      : activeBusiness?.receivable_code ||
                        "Default receivable account"
                  }
                  className="h-9 w-full max-w-md rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 outline-none"
                />
              </div>
            </div>
          )}

          {invoiceViewMode === "cards" && (
            <>
              {/* Tab Switcher */}
              <div className="flex border-b border-gray-200 bg-white">
                <button
                  onClick={() => setActiveTab("products")}
                  className={`flex-1 py-1.5 px-4 text-sm font-semibold transition-all ${
                    activeTab === "products"
                      ? "text-blue-600 border-b-2 border-[var(--aa-accent)] bg-[var(--aa-sidebar-active)]"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Package className="inline mr-2" size={16} />
                  Products ({mockProducts?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab("services")}
                  className={`flex-1 py-1.5 px-4 text-sm font-semibold transition-all ${
                    activeTab === "services"
                      ? "text-blue-600 border-b-2 border-[var(--aa-accent)] bg-[var(--aa-sidebar-active)]"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Tag className="inline mr-2" size={16} />
                  Services ({mockServices?.length || 0})
                </button>
              </div>
              {/* {JSON.stringify(cart)} */}
              {/* Search and Filters */}
              <div className="px-4 py-2 bg-gray-50 border-b">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mode of Payment
                    </label>
                    <select
                      value={modeOfPayment}
                      onChange={(e) => applyPaymentMode(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                    >
                      <option value="cash">Cash</option>
                      <option value="transfer">Transfer</option>
                      <option value="both">Cash + Transfer</option>
                      <option value="credit_split">Credit + Cash + Transfer</option>
                      <option value="credit">Credit</option>
                      <option value="deposit">Apply Deposit</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      Search / Scan
                      <ScanLine
                        className="w-3.5 h-3.5 text-blue-500"
                        title="USB barcode scanner supported"
                      />
                    </label>
                    <div className="relative">
                      <Search
                        className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                        size={14}
                      />
                      <input
                        ref={searchInputRef}
                        id="make-sale-search-input"
                        type="text"
                        autoComplete="off"
                        placeholder="Name, SKU, or scan barcode..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleSearchInputKeyDown}
                        className="w-full pl-7 pr-2 py-0.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                      />
                    </div>
                    {lastScanPreview && (
                      <p className="text-[10px] text-green-700 mt-0.5">
                        Last scan: {lastScanPreview}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity
                      {selectedProduct &&
                        selectedProduct.item_type !== "Service" && (
                          <span className="ml-2 text-xs text-gray-500">
                            (Max: {formatNumber1(selectedProduct.balance || 0)})
                          </span>
                        )}
                      {selectedProduct &&
                        getSalesLimitRemaining(selectedProduct) != null && (
                          <span className="ml-2 text-xs text-rose-600">
                            (
                            {salesLimitPeriodLabel(
                              selectedProduct.sales_limit_period,
                            )}{" "}
                            limit left:{" "}
                            {formatNumber1(
                              getSalesLimitRemaining(selectedProduct),
                            )}
                            )
                          </span>
                        )}
                    </label>
                    <input
                      id="quantity-input"
                      data-scanner-ignore="true"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.0000"
                      value={quantityFormatted}
                      onChange={(e) => {
                        const withoutCommas = e.target.value.replace(/,/g, "");
                        const sanitizedValue =
                          handleNumericInput(withoutCommas);
                        const parts = sanitizedValue.split(".");
                        const numericValue =
                          parts.length > 2
                            ? parts[0] + "." + parts.slice(1).join("")
                            : sanitizedValue;
                        const formattedValue =
                          formatNumberWithCommasQuantity(numericValue);
                        const parsedValue =
                          parseNumberFromFormatted(formattedValue);
                        const newQty = (() => {
                          if (parsedValue === "" || parsedValue === ".") {
                            return 0;
                          }
                          const n = parseFloat(parsedValue);
                          return Number.isFinite(n) ? n : 0;
                        })();

                        if (
                          selectedProduct &&
                          selectedProduct.item_type !== "Service" &&
                          !allowSalesWithoutStock
                        ) {
                          const availableStock =
                            parseFloat(selectedProduct.balance) || 0;
                          const quantityInCart = cart
                            .filter(
                              (item) =>
                                (item.product_id ===
                                  selectedProduct.product_id ||
                                  item.product_id === selectedProduct.id) &&
                                item.expiry_date ===
                                  selectedProduct.expiry_date,
                            )
                            .reduce(
                              (sum, item) =>
                                sum + parseFloat(item.quantity_sold || 0),
                              0,
                            );

                          const maxAllowed = availableStock - quantityInCart;

                          if (newQty > maxAllowed) {
                            toast.warning(
                              `Maximum available quantity: ${formatNumber1(
                                maxAllowed,
                              )}`,
                            );
                            const maxQty = Math.max(0.0001, maxAllowed);
                            setQuantity(maxQty);
                            const clamped = formatNumberWithCommasQuantity(
                              maxQty.toString(),
                            );
                            setQuantityFormatted(clamped);
                            quantityFormattedRef.current = clamped;
                            return;
                          }
                        }

                        setQuantityFormatted(formattedValue);
                        setQuantity(newQty);
                        quantityFormattedRef.current = formattedValue;
                      }}
                      onBlur={() => {
                        // Allow the field to be cleared while typing, but when it
                        // loses focus with no valid number default it back to 1.
                        const raw = parseNumberFromFormatted(
                          quantityFormattedRef.current,
                        );
                        const parsed =
                          raw === "" || raw === "." ? NaN : parseFloat(raw);
                        if (!Number.isFinite(parsed) || parsed <= 0) {
                          const defaultQty =
                            formatNumberWithCommasQuantity("1");
                          setQuantity(1);
                          setQuantityFormatted(defaultQty);
                          quantityFormattedRef.current = defaultQty;
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && selectedProduct) {
                          e.preventDefault();
                          const raw = parseNumberFromFormatted(
                            quantityFormattedRef.current,
                          );
                          const parsedQty =
                            raw === "" || raw === "." ? NaN : parseFloat(raw);
                          if (
                            Number.isFinite(parsedQty) &&
                            parsedQty >= 0.0001
                          ) {
                            addToCartNew(selectedProduct);
                          } else {
                            toast.error("Quantity must be at least 0.0001");
                          }
                        }
                      }}
                      className={`w-full border border-gray-300 rounded-md px-2  focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] ${
                        selectedProduct &&
                        selectedProduct.item_type !== "Service" &&
                        !allowSalesWithoutStock &&
                        quantity > (selectedProduct.balance || 0)
                          ? "border-red-500 bg-red-50"
                          : selectedProduct &&
                              selectedProduct.item_type !== "Service" &&
                              allowSalesWithoutStock &&
                              quantity > (selectedProduct.balance || 0)
                            ? "border-orange-500 bg-orange-50"
                            : ""
                      }`}
                    />
                    {selectedProduct &&
                      selectedProduct.item_type !== "Service" &&
                      quantity > (selectedProduct.balance || 0) && (
                        <p
                          className={`text-xs mt-1 ${
                            allowSalesWithoutStock
                              ? "text-orange-600"
                              : "text-red-600"
                          }`}
                        >
                          {allowSalesWithoutStock
                            ? "⚠ Exceeds available stock (sale allowed due to settings)"
                            : "Exceeds available stock!"}
                        </p>
                      )}
                  </div>
                </div>
              </div>

              {/* Product Grid */}
              <div
                className="flex-1 overflow-y-auto p-0 m-0"
                tabIndex={0}
                onKeyDown={handleKeyDown}
              >
                {/* Show skeleton while loading */}
                {(activeTab === "products" && loadingProducts) ||
                (activeTab === "services" && loadingServices) ? (
                  <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 m-0">
                    {[...Array(6)].map((_, index) => (
                      <SkeletonCard key={index} />
                    ))}
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <Package size={64} className="text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">
                      No {activeTab === "products" ? "Products" : "Services"}{" "}
                      Found
                    </h3>
                    <p className="text-sm text-gray-500">
                      {searchTerm
                        ? `No results for "${searchTerm}"`
                        : `No ${activeTab} available for sale`}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 py-4 m-0">
                    {filteredItems.map((item, index) => {
                      const cardSellPrice =
                        selectedProduct?.id === item.id
                          ? parseFloat(selectedProduct.price) || 0
                          : parseFloat(item.price) ||
                            parseFloat(item.selling_price) ||
                            0;
                      const itemBranchLocation = getItemBranchLocation(item);
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedIndex(index);
                            // Ensure service has its default price when selected
                            const priceValue =
                              parseFloat(item.price) ||
                              parseFloat(item.selling_price) ||
                              0;
                            const productWithPrice = {
                              ...item,
                              price: priceValue,
                              price_formatted:
                                priceValue > 0
                                  ? formatNumberWithCommas(
                                      priceValue.toString(),
                                    )
                                  : "",
                              selling_price: priceValue,
                            };
                            setSelectedProduct(productWithPrice);
                            // Focus on appropriate input based on item type
                            setTimeout(() => {
                              if (item.item_type === "Service") {
                                const sellingPriceInput =
                                  document.getElementById(
                                    `selling-price-input-${item.id}`,
                                  );
                                if (sellingPriceInput)
                                  sellingPriceInput.focus();
                              } else {
                                const quantityInput =
                                  document.getElementById("quantity-input");
                                if (quantityInput) quantityInput.focus();
                              }
                            }, 100);
                          }}
                          className={`bg-white rounded-xl shadow-md hover:shadow-xl transition-all cursor-pointer overflow-hidden border-2 ${
                            selectedIndex === index
                              ? "border-[var(--aa-accent)] ring-2 ring-blue-200 bg-blue-50"
                              : selectedProduct?.id === item.id
                                ? "ring-1"
                                : "border-transparent"
                          }`}
                        >
                          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 flex items-center justify-center h-32 relative m-0">
                            <span className="text-6xl">
                              {item.name
                                .split(" ")
                                .slice(0, 2)
                                .map((word) => word.charAt(0).toUpperCase())
                                .join("")}
                            </span>
                            {selectedIndex === index && (
                              <div className="absolute top-2 right-2 bg-[var(--aa-navy)] text-white text-xs font-bold px-2 py-1 rounded-full">
                                {index + 1}
                              </div>
                            )}
                          </div>
                          <div className="p-4 m-0">
                            <h3 className="font-semibold text-gray-800 mb-1 truncate mx-0">
                              {item.name}
                              {item.multiplier_type && (
                                <span className="text-xs text-gray-500 ml-1">
                                  ({item.multiplier_type})
                                </span>
                              )}
                            </h3>
                            {isSalesStopped(item) ? (
                              <p className="mb-1">
                                <span className="rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                  Sales Stopped
                                </span>
                              </p>
                            ) : getSalesLimitRemaining(item) != null ? (
                              <p className="mb-1 text-[10px] font-semibold text-amber-700">
                                {salesLimitPeriodLabel(item.sales_limit_period)}{" "}
                                left:{" "}
                                {formatNumber1(getSalesLimitRemaining(item))}
                              </p>
                            ) : null}
                            {activeTab === "products" &&
                              (item.unit_of_measure || item.uom_category) && (
                                <p className="text-xs text-gray-600 mb-1 mx-0">
                                  UOM:{" "}
                                  {item.unit_of_measure ||
                                    item.uom_category ||
                                    "N/A"}
                                  {item.multiplier_type &&
                                    ` (${item.multiplier_type})`}
                                </p>
                              )}
                            {activeTab === "products" && itemBranchLocation && (
                              <p className="text-xs text-gray-600 mb-1 mx-0 flex items-center gap-1">
                                <span className="font-medium text-gray-700">
                                  Warehouse:
                                </span>
                                <span className="truncate">
                                  {itemBranchLocation}
                                </span>
                              </p>
                            )}
                            {activeTab === "products" && (
                              <p
                                className={`text-xs mb-1 mx-0 ${
                                  parseFloat(item.stock || item.balance || 0) <=
                                  0
                                    ? allowSalesWithoutStock
                                      ? "text-orange-600 font-medium"
                                      : "text-red-600 font-medium"
                                    : "text-gray-500"
                                }`}
                              >
                                Stock:{" "}
                                {formatNumber1(item.stock || item.balance || 0)}
                                {parseFloat(item.stock || item.balance || 0) <=
                                  0 &&
                                  allowSalesWithoutStock && (
                                    <span className="ml-1">(Sale allowed)</span>
                                  )}
                              </p>
                            )}
                            {activeTab === "products" ? (
                              <>
                                <div className="flex items-center gap-1 w-full">
                                  <button
                                    type="button"
                                    aria-label="Decrease price"
                                    disabled={cardSellPrice <= 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      adjustCardSellingPrice(
                                        item,
                                        -CARD_PRICE_STEP,
                                      );
                                    }}
                                    className="shrink-0 p-2 rounded-l-md border border-gray-300 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <input
                                    id={`selling-price-input-${item.id}`}
                                    data-scanner-ignore="true"
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    placeholder="0.00"
                                    value={
                                      selectedProduct?.id === item.id
                                        ? selectedProduct.price_formatted !==
                                          undefined
                                          ? selectedProduct.price_formatted
                                          : selectedProduct.price !== null &&
                                              selectedProduct.price !==
                                                undefined &&
                                              selectedProduct.price !== ""
                                            ? formatNumberWithCommas(
                                                selectedProduct.price.toString(),
                                              )
                                            : ""
                                        : item.price !== null &&
                                            item.price !== undefined &&
                                            item.price !== ""
                                          ? formatNumberWithCommas(
                                              item.price.toString(),
                                            )
                                          : ""
                                    }
                                    onChange={(e) => {
                                      const withoutCommas =
                                        e.target.value.replace(/,/g, "");
                                      const sanitizedValue =
                                        handleNumericInput(withoutCommas);
                                      const parts = sanitizedValue.split(".");
                                      const numericValue =
                                        parts.length > 2
                                          ? parts[0] +
                                            "." +
                                            parts.slice(1).join("")
                                          : sanitizedValue;
                                      const formattedValue =
                                        formatNumberWithCommas(numericValue);
                                      const parsedValue =
                                        parseNumberFromFormatted(
                                          formattedValue,
                                        );
                                      const newPrice =
                                        parsedValue === ""
                                          ? 0
                                          : parseFloat(parsedValue) || 0;

                                      setSelectedProduct({
                                        ...item,
                                        price: newPrice,
                                        price_formatted: formattedValue,
                                        selling_price: newPrice,
                                      });
                                      setReadyForSalesItems((prev) =>
                                        prev.map((product) =>
                                          product.id === item.id ||
                                          product.product_id === item.id
                                            ? {
                                                ...product,
                                                selling_price: newPrice,
                                              }
                                            : product,
                                        ),
                                      );
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        addToCartNew(selectedProduct || item);
                                      }
                                    }}
                                    className="flex-1 min-w-0 border border-gray-300 rounded-none px-2 py-2 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] m-0"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <button
                                    type="button"
                                    aria-label="Increase price"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      adjustCardSellingPrice(
                                        item,
                                        CARD_PRICE_STEP,
                                      );
                                    }}
                                    className="shrink-0 p-2 rounded-r-md border border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                                <p
                                  className={`text-xs mt-1 mx-0 ${
                                    parseFloat(item.stock || 0) <= 0
                                      ? allowSalesWithoutStock
                                        ? "text-orange-600 font-medium"
                                        : "text-red-600 font-medium"
                                      : "text-gray-500"
                                  }`}
                                >
                                  {formatNumber1(
                                    parseFloat(item.stock || 0).toFixed(4),
                                  )}{" "}
                                  in stock
                                  {parseFloat(item.stock || 0) <= 0 &&
                                    allowSalesWithoutStock && (
                                      <span className="ml-1">
                                        (Sale allowed)
                                      </span>
                                    )}
                                </p>
                                {item.expiry_date && (
                                  <p className="text-xs text-orange-600 mt-1 mx-0 font-medium">
                                    Expires:{" "}
                                    {moment(item.expiry_date).format(
                                      "MMM DD, YYYY",
                                    )}
                                  </p>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-1 w-full">
                                  <button
                                    type="button"
                                    aria-label="Decrease price"
                                    disabled={cardSellPrice <= 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      adjustCardSellingPrice(
                                        item,
                                        -CARD_PRICE_STEP,
                                      );
                                    }}
                                    className="shrink-0 p-2 rounded-l-md border border-gray-300 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <input
                                    id={`selling-price-input-${item.id}`}
                                    data-scanner-ignore="true"
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    placeholder="0.00"
                                    value={
                                      selectedProduct?.id === item.id
                                        ? selectedProduct.price_formatted !==
                                          undefined
                                          ? selectedProduct.price_formatted
                                          : selectedProduct.price !== null &&
                                              selectedProduct.price !==
                                                undefined &&
                                              selectedProduct.price !== ""
                                            ? formatNumberWithCommas(
                                                selectedProduct.price.toString(),
                                              )
                                            : ""
                                        : item.price !== null &&
                                            item.price !== undefined &&
                                            item.price !== ""
                                          ? formatNumberWithCommas(
                                              item.price.toString(),
                                            )
                                          : ""
                                    }
                                    onChange={(e) => {
                                      const withoutCommas =
                                        e.target.value.replace(/,/g, "");
                                      const sanitizedValue =
                                        handleNumericInput(withoutCommas);
                                      const parts = sanitizedValue.split(".");
                                      const numericValue =
                                        parts.length > 2
                                          ? parts[0] +
                                            "." +
                                            parts.slice(1).join("")
                                          : sanitizedValue;
                                      const formattedValue =
                                        formatNumberWithCommas(numericValue);
                                      const parsedValue =
                                        parseNumberFromFormatted(
                                          formattedValue,
                                        );
                                      const newPrice =
                                        parsedValue === ""
                                          ? 0
                                          : parseFloat(parsedValue) || 0;

                                      setSelectedProduct({
                                        ...item,
                                        price: newPrice,
                                        price_formatted: formattedValue,
                                        selling_price: newPrice,
                                      });
                                      setServiceProducts((prev) =>
                                        prev.map((service) =>
                                          service.id === item.id
                                            ? {
                                                ...service,
                                                price: newPrice,
                                                selling_price: newPrice,
                                              }
                                            : service,
                                        ),
                                      );
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        addToCartNew(selectedProduct);
                                      }
                                    }}
                                    className="flex-1 min-w-0 text-right border border-gray-300 rounded-none px-2 py-2 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] m-0"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <button
                                    type="button"
                                    aria-label="Increase price"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      adjustCardSellingPrice(
                                        item,
                                        CARD_PRICE_STEP,
                                      );
                                    }}
                                    className="shrink-0 p-2 rounded-r-md border border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                                {item.price > 0 && (
                                  <p className="text-xs text-green-600 mt-1 mx-0">
                                    Default: ₦{formatNumber1(item.price)}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Action Bar */}
              <div className="p-2 bg-white border-t border-gray-200 shadow-lg">
                <div className="flex gap-2">
                  <div className="flex gap-1">
                    <button className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">
                      ↑↓ Navigate
                    </button>
                    <button className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">
                      Enter add
                    </button>
                    <button className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">
                      Esc Clear
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      if (!selectedProduct) {
                        toast.error("Please select a product or service first");
                        return;
                      }
                      addToCartNew(selectedProduct);
                    }}
                    disabled={processingCheckout}
                    className="flex-1 px-3 py-0.5 text-sm bg-[var(--aa-navy)] text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold"
                  >
                    {processingCheckout
                      ? "Processing..."
                      : selectedIndex >= 0
                        ? `Add ${
                            selectedProduct?.item_type === "Service"
                              ? "Service"
                              : "Product"
                          } ${selectedIndex + 1} to Cart`
                        : "Select Item First"}
                  </button>
                </div>
              </div>
            </>
          )}

          {invoiceViewMode === "lines" && (
            <div className="flex w-full flex-col bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-6 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Item Table
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <ScanLine size={14} className="text-[var(--aa-accent)]" />
                    Scan Item
                  </span>
                </div>
              </div>
              <div className="w-full overflow-x-auto px-4 sm:px-6">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="min-w-[280px] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                        Item Details
                      </th>
                      <th className="w-24 px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                        Quantity
                      </th>
                      <th className="w-28 px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                        Selling Price
                      </th>
                      <th className="w-40 px-2 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                        VAT
                      </th>
                      <th className="w-32 px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                        Amount
                      </th>
                      <th className="w-10 px-1 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(() => {
                      const emptyRowCount = Math.max(0, 2 + extraEmptyLineRows);
                      const rows = [];
                      cart.forEach((item) => {
                        const money = getLineMoneyBreakdown(item);
                        const uom =
                          item.unit_of_measure ||
                          item.uom_category ||
                          "Each";
                        rows.push(
                          <tr
                            key={item.id}
                            className="bg-white hover:bg-slate-50/80"
                          >
                            <td className="px-3 py-3 align-top">
                              <div className="flex gap-2">
                                <select
                                  value={
                                    item.item_type === "Service"
                                      ? "services"
                                      : "products"
                                  }
                                  onChange={(e) => {
                                    const isService =
                                      e.target.value === "services";
                                    updateCartItem(item.id, {
                                      item_type: isService
                                        ? "Service"
                                        : "Goods",
                                    });
                                  }}
                                  className="mt-0.5 h-7 shrink-0 rounded border border-slate-200 bg-slate-50 px-1 text-[10px] font-medium text-slate-600"
                                  title="Line type"
                                >
                                  <option value="products">Product</option>
                                  <option value="services">Service</option>
                                </select>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-slate-900">
                                    {item.item_name}
                                    {!item.proBono && (
                                      <button
                                        type="button"
                                        title="Click to toggle taxable"
                                        onClick={() => {
                                          if (item.taxable === "Taxable") {
                                            updateCartItem(item.id, {
                                              taxable: "Not Taxable",
                                              line_tax_id: null,
                                            });
                                            return;
                                          }
                                          const fallbackTaxId =
                                            defaultLineTaxId ||
                                            lineTaxOptions[0]?.id ||
                                            null;
                                          updateCartItem(item.id, {
                                            taxable: "Taxable",
                                            line_tax_id:
                                              item.line_tax_id || fallbackTaxId,
                                          });
                                        }}
                                        className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                          item.taxable === "Taxable"
                                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        }`}
                                      >
                                        {item.taxable === "Taxable"
                                          ? "Taxable"
                                          : "Not taxable"}
                                      </button>
                                    )}
                                    {item.proBono && (
                                      <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                                        Pro-bono
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 text-xs text-slate-500">
                                    {formatNumber1(money.qty)} {uom}
                                    {money.hsn ? ` · ${money.hsn}` : ""}
                                    {(item.location_name ||
                                      item.branch_name ||
                                      getItemBranchLocation(item)) && (
                                      <span className="ml-1 text-slate-400">
                                        ·{" "}
                                        {item.location_name ||
                                          item.branch_name ||
                                          getItemBranchLocation(item)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-3 text-right align-top">
                              {(() => {
                                const catalog = [
                                  ...readyForSalesItems,
                                  ...serviceProducts,
                                ];
                                const { max, remaining, period } =
                                  getMaxQtyForLine(item, cart, {
                                    allowWithoutStock: !!allowSalesWithoutStock,
                                    catalog,
                                  });
                                return (
                                  <>
                              <input
                                id={`invoice-line-qty-${item.id}`}
                                data-scanner-ignore="true"
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder="1.00"
                                title={
                                  max != null
                                    ? `Max ${formatNumber1(max)}${
                                        remaining != null
                                          ? ` (${salesLimitPeriodLabel(
                                              period,
                                            )} target left: ${formatNumber1(
                                              remaining,
                                            )})`
                                          : ""
                                      }`
                                    : undefined
                                }
                                value={
                                  lineQtyDrafts[item.id] !== undefined
                                    ? lineQtyDrafts[item.id]
                                    : formatNumberWithCommasQuantity(
                                        String(
                                          item.quantity_sold ??
                                            item.quantity ??
                                            0,
                                        ),
                                      )
                                }
                                onChange={(e) => {
                                  const withoutCommas = e.target.value.replace(
                                    /,/g,
                                    "",
                                  );
                                  const sanitized =
                                    handleNumericInput(withoutCommas);
                                  const parts = sanitized.split(".");
                                  let numericValue =
                                    parts.length > 2
                                      ? parts[0] + "." + parts.slice(1).join("")
                                      : sanitized;

                                  // Allow empty / trailing decimal while typing
                                  if (
                                    numericValue === "" ||
                                    numericValue === "." ||
                                    numericValue.endsWith(".")
                                  ) {
                                    setLineQtyDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: numericValue,
                                    }));
                                    return;
                                  }

                                  const parsedValue =
                                    parseNumberFromFormatted(numericValue);
                                  let num = parseFloat(parsedValue);
                                  if (!Number.isFinite(num)) {
                                    setLineQtyDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: numericValue,
                                    }));
                                    return;
                                  }

                                  // Clamp to sales target / stock max
                                  if (max != null && num > max + 1e-9) {
                                    num = max;
                                    numericValue = String(max);
                                    toast.error(
                                      remaining != null
                                        ? `Sales ${salesLimitPeriodLabel(
                                            period,
                                          )} target max is ${formatNumber1(
                                            max,
                                          )} (left: ${formatNumber1(
                                            remaining,
                                          )})`
                                        : `Maximum quantity is ${formatNumber1(
                                            max,
                                          )}`,
                                    );
                                  }

                                  const formattedValue =
                                    formatNumberWithCommasQuantity(
                                      numericValue,
                                    );
                                  setLineQtyDrafts((prev) => ({
                                    ...prev,
                                    [item.id]: formattedValue,
                                  }));
                                  if (num >= 0.0001) {
                                    updateQuantityNew(item.id, num);
                                  }
                                }}
                                onBlur={() => {
                                  const draft = lineQtyDrafts[item.id];
                                  const parsed = parseNumberFromFormatted(
                                    String(draft ?? ""),
                                  );
                                  let num =
                                    parsed === "" || parsed === "."
                                      ? NaN
                                      : parseFloat(parsed);
                                  if (
                                    draft !== undefined &&
                                    (!Number.isFinite(num) || num < 0.0001)
                                  ) {
                                    num = max != null && max >= 0.0001
                                      ? Math.min(1, max)
                                      : 1;
                                  }
                                  if (
                                    max != null &&
                                    Number.isFinite(num) &&
                                    num > max
                                  ) {
                                    num = max >= 0.0001 ? max : 1;
                                    toast.error(
                                      `Quantity capped at ${formatNumber1(
                                        max,
                                      )} by sales target`,
                                    );
                                  }
                                  if (Number.isFinite(num) && num >= 0.0001) {
                                    updateQuantityNew(item.id, num);
                                  }
                                  setLineQtyDrafts((prev) => {
                                    const next = { ...prev };
                                    delete next[item.id];
                                    return next;
                                  });
                                }}
                                className="ml-auto w-20 rounded border border-slate-300 px-2 py-1.5 text-right text-sm"
                              />
                              {max != null && remaining != null ? (
                                <div className="mt-0.5 text-[10px] font-medium text-amber-700">
                                  Max {formatNumber1(max)} (
                                  {salesLimitPeriodLabel(period)} left{" "}
                                  {formatNumber1(remaining)})
                                </div>
                              ) : null}
                                  </>
                                );
                              })()}
                            </td>
                            <td className="px-2 py-3 text-right align-top">
                              {item.proBono ? (
                                <span className="text-slate-400">—</span>
                              ) : (
                                <>
                                  <input
                                    id={`invoice-line-rate-${item.id}`}
                                    data-scanner-ignore="true"
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    placeholder={
                                      money.unit <= 0 ? "Enter rate" : "0.00"
                                    }
                                    value={formatNumberWithCommas(
                                      String(
                                        item.selling_price ?? item.price ?? 0,
                                      ),
                                    )}
                                    onChange={(e) => {
                                      const withoutCommas =
                                        e.target.value.replace(/,/g, "");
                                      const sanitized =
                                        handleNumericInput(withoutCommas);
                                      const parts = sanitized.split(".");
                                      const numericValue =
                                        parts.length > 2
                                          ? parts[0] +
                                            "." +
                                            parts.slice(1).join("")
                                          : sanitized;
                                      const formattedValue =
                                        formatNumberWithCommas(numericValue);
                                      const parsedValue =
                                        parseNumberFromFormatted(
                                          formattedValue,
                                        );
                                      const num =
                                        parsedValue === ""
                                          ? 0
                                          : parseFloat(parsedValue) || 0;
                                      if (num >= 0) {
                                        updateCartItem(item.id, {
                                          selling_price: num,
                                        });
                                      }
                                    }}
                                    className={`ml-auto w-28 rounded border border-slate-300 bg-white px-2 py-1.5 text-right text-sm ${
                                      money.unit <= 0
                                        ? "ring-2 ring-amber-400 ring-offset-0"
                                        : ""
                                    }`}
                                  />
                                  {money.lineDiscount > 0 && (
                                    <div className="mt-1 text-[11px] text-slate-500">
                                      Disc −NGN{" "}
                                      {formatNumber1(money.lineDiscount)}
                                    </div>
                                  )}
                                </>
                              )}
                            </td>
                            <td className="px-2 py-3 align-top">
                              <select
                                value={item.line_tax_id ?? ""}
                                disabled={
                                  !!item.proBono || item.taxable !== "Taxable"
                                }
                                onChange={(e) => {
                                  const taxId = e.target.value || null;
                                  updateCartItem(item.id, {
                                    line_tax_id: taxId,
                                    taxable: taxId
                                      ? "Taxable"
                                      : "Not Taxable",
                                  });
                                  if (taxId) {
                                    const tax = lineTaxOptions.find(
                                      (t) => String(t.id) === String(taxId),
                                    );
                                    if (tax && isOutputVatTax(tax)) {
                                      // One Output VAT only — never stack inclusive + exclusive clones
                                      setSelectedOutputVAT([tax.id]);
                                    } else if (tax) {
                                      setSelectedTaxes((prev) =>
                                        prev.some((t) => t.id === tax.id)
                                          ? prev
                                          : [...prev, tax],
                                      );
                                    }
                                  }
                                }}
                                className="w-full min-w-[9rem] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-[var(--aa-accent)] disabled:bg-slate-50"
                              >
                                <option value="">Select VAT</option>
                                {lineTaxOptions.map((tax) => (
                                  <option key={tax.id} value={tax.id}>
                                    {tax.description} ({tax.rate}%)
                                  </option>
                                ))}
                              </select>
                              {!item.proBono &&
                                item.taxable === "Taxable" &&
                                money.lineVat > 0 && (
                                  <div className="mt-1 text-[11px] text-slate-500">
                                    NGN {formatNumber1(money.lineVat)}
                                  </div>
                                )}
                            </td>
                            <td className="px-2 py-3 text-right align-top text-sm font-semibold tabular-nums text-slate-900">
                              {item.proBono
                                ? "0.00"
                                : formatNumber1(money.amount)}
                            </td>
                            <td className="px-1 py-3 text-center align-top">
                              <button
                                type="button"
                                onClick={() => removeFromCartNew(item.id)}
                                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                title="Remove"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>,
                        );
                      });
                      for (let i = 0; i < emptyRowCount; i++) {
                        const rowTab = emptyRowLineTypes[i] ?? "products";
                        rows.push(
                          <tr
                            key={`empty-${i}`}
                            className="bg-white hover:bg-slate-50/60"
                          >
                            <td className="px-3 py-3">
                              <div className="flex gap-2">
                                <select
                                  value={rowTab}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setEmptyRowLineTypes((prev) => {
                                      const next = [...prev];
                                      next[i] = v;
                                      return next;
                                    });
                                    setActiveTab(v);
                                  }}
                                  className="h-9 shrink-0 rounded border border-slate-300 bg-white px-1.5 text-xs font-medium text-slate-700"
                                >
                                  <option value="products">Product</option>
                                  <option value="services">Service</option>
                                </select>
                                <Typeahead
                                  key={`invoice-line-account-${i}-${cart.length}-${rowTab}`}
                                  id={`invoice-line-account-${i}`}
                                  options={filterItemsByTab(rowTab)}
                                  labelKey={(opt) => {
                                    const loc =
                                      opt.location_name ||
                                      opt.branch_name ||
                                      getItemBranchLocation(opt);
                                    const stopped = isSalesStopped(opt)
                                      ? " · Sales Stopped"
                                      : "";
                                    const lim =
                                      getSalesLimitRemaining(opt) != null
                                        ? ` · ${salesLimitPeriodLabel(
                                            opt.sales_limit_period,
                                          )} left: ${formatNumber1(
                                            getSalesLimitRemaining(opt),
                                          )}`
                                        : "";
                                    return `${opt.name || opt.item_name}${
                                      opt.product_id || opt.sku
                                        ? ` (${opt.product_id || opt.sku})`
                                        : ""
                                    }${loc ? ` · ${loc}` : ""}${stopped}${lim}`;
                                  }}
                                  filterBy={(opt, props) => {
                                    const q = String(
                                      props.text || "",
                                    ).toLowerCase();
                                    if (!q) return true;
                                    const loc =
                                      opt.location_name ||
                                      opt.branch_name ||
                                      getItemBranchLocation(opt) ||
                                      "";
                                    return [
                                      opt.name,
                                      opt.item_name,
                                      opt.sku,
                                      opt.product_id,
                                      opt.item_code,
                                      loc,
                                      isSalesStopped(opt) ? "sales stopped" : "",
                                    ].some((v) =>
                                      String(v || "")
                                        .toLowerCase()
                                        .includes(q),
                                    );
                                  }}
                                  placeholder="Type or click to select an item"
                                  onChange={(selected) => {
                                    if (selected && selected.length > 0) {
                                      addToCartNew(selected[0]);
                                      setExtraEmptyLineRows((n) => n - 1);
                                    }
                                  }}
                                  selected={[]}
                                  size="sm"
                                  className="min-w-0 flex-1"
                                  inputProps={{
                                    className:
                                      "border border-slate-300 rounded px-2 py-1.5 text-sm w-full h-9",
                                  }}
                                  renderMenuItemChildren={(opt) => {
                                    const loc =
                                      opt.location_name ||
                                      opt.branch_name ||
                                      getItemBranchLocation(opt);
                                    const stopped = isSalesStopped(opt);
                                    const limitLeft = getSalesLimitRemaining(opt);
                                    return (
                                      <div
                                        className={`py-1 ${
                                          stopped ? "opacity-80" : ""
                                        }`}
                                      >
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span
                                            className={`text-sm font-medium ${
                                              stopped
                                                ? "text-slate-500"
                                                : "text-slate-800"
                                            }`}
                                          >
                                            {opt.name || opt.item_name}
                                          </span>
                                          {stopped ? (
                                            <span className="rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                              Sales Stopped
                                            </span>
                                          ) : null}
                                          {!stopped &&
                                          limitLeft != null &&
                                          limitLeft <= 0 ? (
                                            <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                              Target reached
                                            </span>
                                          ) : null}
                                        </div>
                                        <small className="text-xs text-slate-500">
                                          {opt.product_id || opt.sku}
                                          {loc && (
                                            <span className="ml-1 text-blue-600">
                                              · {loc}
                                            </span>
                                          )}
                                          {opt.item_type !== "Service" &&
                                            opt.balance != null && (
                                              <span className="ml-1 text-green-600">
                                                · Avail:{" "}
                                                {formatNumber1(opt.balance)}
                                              </span>
                                            )}
                                          {!stopped && limitLeft != null ? (
                                            <span className="ml-1 text-amber-700">
                                              ·{" "}
                                              {salesLimitPeriodLabel(
                                                opt.sales_limit_period,
                                              )}{" "}
                                              left: {formatNumber1(limitLeft)}
                                            </span>
                                          ) : null}
                                        </small>
                                      </div>
                                    );
                                  }}
                                />
                              </div>
                            </td>
                            <td className="px-2 py-3 text-right text-sm text-slate-300">
                              1.00
                            </td>
                            <td className="px-2 py-3 text-right text-sm text-slate-300">
                              0.00
                            </td>
                            <td className="px-2 py-3">
                              <select
                                disabled
                                className="w-full min-w-[9rem] rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-400"
                                defaultValue=""
                              >
                                <option value="">Select VAT</option>
                              </select>
                            </td>
                            <td className="px-2 py-3 text-right text-sm text-slate-400">
                              0.00
                            </td>
                            <td className="px-1 py-3 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setExtraEmptyLineRows((n) =>
                                    Math.max(-2, n - 1),
                                  )
                                }
                                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                title="Remove empty row"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>,
                        );
                      }
                      return rows;
                    })()}
                  </tbody>
                </table>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
                  <button
                    type="button"
                    onClick={() => setExtraEmptyLineRows((n) => n + 1)}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-[var(--aa-accent)] hover:bg-slate-50"
                  >
                    <Plus size={14} />
                    Add New Row
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCart([]);
                      setExtraEmptyLineRows(0);
                      setEmptyRowLineTypes(["products", "services"]);
                    }}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Clear all lines
                  </button>

                  <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    <span className="text-sm text-slate-600">Discount</span>
                    <select
                      value={selectedDiscount?.discount_id || ""}
                      onChange={(e) => {
                        const selectedValue = e.target.value;
                        if (!selectedValue) {
                          clearDiscount();
                          return;
                        }
                        const discount = availableDiscounts.find(
                          (d) =>
                            String(d.discount_id) === String(selectedValue),
                        );
                        handleDiscountSelect(discount || null);
                      }}
                      className="max-w-[12rem] rounded border border-slate-300 bg-white px-1.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                    >
                      <option value="">
                        {activeDiscounts.length === 0
                          ? "Custom discount"
                          : "Select or custom…"}
                      </option>
                      {activeDiscounts.map((discount) => (
                        <option
                          key={discount.discount_id}
                          value={discount.discount_id}
                        >
                          {formatDiscountOptionLabel(discount)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={zohoDiscountPercent}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d.]/g, "");
                        setZohoDiscountPercent(v);
                        if (selectedDiscount) setSelectedDiscount(null);
                      }}
                      className="w-14 rounded border border-slate-300 px-1.5 py-1.5 text-right text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                      placeholder="0"
                      title="Enter discount value"
                    />
                    <select
                      value={zohoDiscountMode === "%" ? "%" : "NGN"}
                      onChange={(e) => {
                        setZohoDiscountMode(
                          e.target.value === "%" ? "%" : "flat",
                        );
                        if (selectedDiscount) setSelectedDiscount(null);
                      }}
                      className="rounded border border-slate-300 px-1 py-1.5 text-xs text-slate-600 outline-none focus:border-[var(--aa-accent)]"
                    >
                      <option value="%">%</option>
                      <option value="NGN">NGN</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,22rem)]">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Customer Notes
                    </label>
                    <textarea
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Will be displayed on the invoice
                    </p>
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-600">Sub Total</span>
                      <span className="font-medium tabular-nums text-slate-900">
                        {formatNumber1(subtotal)}
                      </span>
                    </div>
                    {cart.length > 0 && (
                      <>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-600">Taxable</span>
                          <span className="tabular-nums text-emerald-700">
                            {formatNumber1(taxableSubtotal)}
                          </span>
                        </div>
                        {nonTaxableSubtotal > 0 && (
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-600">Not taxable</span>
                            <span className="tabular-nums text-slate-600">
                              {formatNumber1(nonTaxableSubtotal)}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    {discountAmount > 0 && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-600">Discount</span>
                        <span className="tabular-nums text-slate-700">
                          −{formatNumber1(discountAmount)}
                        </span>
                      </div>
                    )}
                    {displayTotalTax > 0 && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-600">VAT</span>
                        <span className="tabular-nums text-slate-900">
                          {formatNumber1(displayTotalTax)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3">
                      <span className="text-base font-semibold text-slate-900">
                        Total (NGN)
                      </span>
                      <span className="text-lg font-bold tabular-nums text-slate-900">
                        {formatNumber1(total)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pb-6">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Terms &amp; Conditions
                  </label>
                  <textarea
                    value={termsConditions}
                    onChange={(e) => setTermsConditions(e.target.value)}
                    rows={4}
                    placeholder="Enter the terms and conditions of your business to be displayed in your transaction"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                  />
                </div>
              </div>

              <div className="sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-[#f7f7f8] px-6 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={cart.length === 0 || processingCheckout}
                    onClick={handleSubmit}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    disabled={cart.length === 0 || processingCheckout}
                    onClick={handleSubmit}
                    className="inline-flex items-center gap-2 rounded-md bg-[var(--aa-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--aa-accent-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {processingCheckout ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                        Processing...
                      </>
                    ) : (
                      "Save and Send"
                    )}
                  </button>
                  <Link
                    to="/app/sales/invoices"
                    className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </Link>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold text-slate-900">
                    Total Amount:{" "}
                    <span className="text-slate-800">
                      NGN {formatNumber1(total)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Total Quantity:{" "}
                    {formatNumber1(
                      cart.reduce(
                        (sum, item) =>
                          sum + (parseFloat(item.quantity_sold) || 0),
                        0,
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {invoiceViewMode !== "lines" && (
          <div className="flex-2 min-w-[300px] bg-white border-l border-gray-200 flex flex-col shadow-none min-h-0">
            <CreditSaleTaxDiscountPanel
              activeBusiness={activeBusiness}
              filteredSalesTaxes={filteredSalesTaxes}
              filteredOutputVATTaxes={filteredOutputVATTaxes}
              selectedTaxes={selectedTaxes}
              setSelectedTaxes={setSelectedTaxes}
              selectedOutputVAT={selectedOutputVAT}
              setSelectedOutputVAT={setSelectedOutputVAT}
              availableDiscounts={availableDiscounts}
              selectedDiscount={selectedDiscount}
              handleDiscountSelect={handleDiscountSelect}
              clearDiscount={clearDiscount}
            />

            {/* Customer Selection */}
            <div className="px-4 py-2.5 bg-gray-50 border-b">
              <div className="relative">
                <SearchCustomerInput
                  size="sm"
                  label="Customer Name"
                  selected={selectedCustomer ? [selectedCustomer] : []}
                  onChange={(customer) => {
                    setSelectedCustomer(customer);
                  }}
                  className="w-full"
                />
              </div>
            </div>

            {/* Cart vs transaction date order (sidebar) */}
            <div className="px-4 py-1.5 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <span className="text-xs font-medium text-gray-700">
                Cart &amp; date order
              </span>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCartAboveTransactionDate(false)}
                  className={`px-2 py-1 text-xs transition-colors ${
                    !cartAboveTransactionDate
                      ? "bg-[var(--aa-navy)] text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Date above cart
                </button>
                <button
                  type="button"
                  onClick={() => setCartAboveTransactionDate(true)}
                  className={`px-2 py-1 text-xs border-l border-gray-200 transition-colors ${
                    cartAboveTransactionDate
                      ? "bg-[var(--aa-navy)] text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Cart above date
                </button>
              </div>
            </div>

            <div className="flex flex-col flex-1 min-h-0">
              {/* Transaction Date */}
              <div
                className={`px-4 py-2.5 bg-gray-50 border-b shrink-0 ${
                  cartAboveTransactionDate ? "order-2" : "order-1"
                }`}
              >
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  <i className="fa fa-calendar me-1"></i>
                  Transaction Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  max={moment().format("YYYY-MM-DD")}
                  className="w-full px-3 py-2 text-sm font-medium border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] bg-white hover:border-gray-400 transition-colors cursor-pointer"
                  required
                  title="Select the transaction date for this sale"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {moment(transactionDate).format("MMMM DD, YYYY")}
                </p>
              </div>

              {/* Cart Items (in lines view, show brief note; otherwise show cards) */}
              <div
                className={`flex-1 overflow-y-auto p-4 space-y-3 min-h-0 ${
                  cartAboveTransactionDate ? "order-1" : "order-2"
                }`}
              >
                {invoiceViewMode === "lines" ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-600">
                      {cart.length === 0
                        ? "Line items are in the table. Use Add Line to add products or services."
                        : `${cart.length} line item(s) · Edit in the table`}
                    </p>
                  </div>
                ) : cart.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart
                      size={64}
                      className="mx-auto text-gray-300 mb-4"
                    />
                    <p className="text-gray-500">Cart is empty</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Add items to get started
                    </p>
                  </div>
                ) : (
                  cart.map((item, cartIndex) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <div className="flex flex-col shrink-0 border border-gray-200 rounded-md overflow-hidden bg-gray-50">
                          <button
                            type="button"
                            onClick={() => moveCartItem(item.id, "up")}
                            disabled={cartIndex === 0}
                            className="p-1.5 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move line up"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveCartItem(item.id, "down")}
                            disabled={cartIndex === cart.length - 1}
                            className="p-1.5 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed border-t border-gray-200"
                            title="Move line down"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                        <div className="flex items-start justify-between flex-1 min-w-0">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-800 text-sm">
                                {item.item_name}
                                {item.multiplier_type && (
                                  <span className="text-xs text-gray-500 ml-1">
                                    ({item.multiplier_type})
                                  </span>
                                )}
                              </h4>
                              {item.taxable === "Taxable" && (
                                <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                                  Taxable
                                </span>
                              )}
                              {item.taxable !== "Taxable" && !item.proBono && (
                                <span className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                                  Not taxable
                                </span>
                              )}
                              {item.proBono && (
                                <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                                  Pro-bono
                                </span>
                              )}
                            </div>
                            {item.item_type !== "Service" && (
                              <>
                                {/* <p className="text-xs text-gray-600">
                            UOM:{" "}
                            {item.unit_of_measure ||
                              item.uom_category ||
                              "each"}
                            {item.unit_of_measure &&
                              item.uom_category &&
                              item.unit_of_measure !== item.uom_category && (
                                <span className="ml-1 text-gray-500">
                                  ({item.uom_category})
                                </span>
                              )}
                          </p> */}
                                <p className="text-xs text-gray-500">
                                  ₦{formatNumber1(item.selling_price)} per{" "}
                                  {
                                    // item.unit_of_measure ||
                                    item.uom_category || "unit"
                                  }
                                </p>
                                {item.expiry_date && (
                                  <p className="text-xs text-orange-600 mt-1 font-medium">
                                    Expires:{" "}
                                    {moment(item.expiry_date).format(
                                      "MMM DD, YYYY",
                                    )}
                                  </p>
                                )}
                              </>
                            )}
                            {item.item_type === "Service" && (
                              <p className="text-xs text-gray-500">
                                ₦{formatNumber1(item.selling_price)}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => removeFromCartNew(item.id)}
                            className="text-red-500 hover:text-red-700 transition-colors shrink-0"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg">
                            <button
                              onClick={() =>
                                updateQuantityNew(item.id, item.quantity - 1)
                              }
                              disabled={item.quantity <= 1}
                              className="p-2 hover:bg-gray-200 rounded-l-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="px-3 font-semibold">
                              {formatNumber1(item.quantity)}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantityNew(item.id, item.quantity + 1)
                              }
                              disabled={
                                item.item_type !== "Service" &&
                                !allowSalesWithoutStock &&
                                (() => {
                                  const quantityInCart = cart
                                    .filter(
                                      (cartItem) =>
                                        cartItem.id !== item.id &&
                                        cartItem.product_id ===
                                          item.product_id &&
                                        cartItem.expiry_date ===
                                          item.expiry_date,
                                    )
                                    .reduce(
                                      (sum, cartItem) =>
                                        sum +
                                        parseFloat(cartItem.quantity_sold || 0),
                                      0,
                                    );
                                  return (
                                    item.quantity + quantityInCart >=
                                    (item.balance || 0)
                                  );
                                })()
                              }
                              className="p-2 hover:bg-gray-200 rounded-r-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={
                                item.item_type !== "Service" &&
                                !allowSalesWithoutStock &&
                                (() => {
                                  const quantityInCart = cart
                                    .filter(
                                      (cartItem) =>
                                        cartItem.id !== item.id &&
                                        cartItem.product_id ===
                                          item.product_id &&
                                        cartItem.expiry_date ===
                                          item.expiry_date,
                                    )
                                    .reduce(
                                      (sum, cartItem) =>
                                        sum +
                                        parseFloat(cartItem.quantity_sold || 0),
                                      0,
                                    );
                                  return item.quantity + quantityInCart >=
                                    (item.balance || 0)
                                    ? `Maximum stock: ${formatNumber1(
                                        item.balance,
                                      )}`
                                    : "";
                                })()
                              }
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          {/* {item.item_type !== "Service" && (
                        <p className="text-xs text-gray-500 mt-1 text-center">
                          Stock: {formatNumber1(item.balance || 0)}
                        </p>
                      )} */}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {item.proBono ? (
                            <>
                              <span className="font-bold text-purple-600 line-through">
                                ₦
                                {formatNumber1(
                                  parseFloat(item.selling_price || 0) *
                                    parseFloat(
                                      item.quantity_sold || item.quantity || 0,
                                    ),
                                )}
                              </span>
                              <span className="text-xs text-purple-600 font-medium">
                                Free (₦0.00)
                              </span>
                            </>
                          ) : (
                            <span className="font-bold text-blue-600">
                              ₦{formatNumber1(item.amount)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pro-bono Toggle */}
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.proBono || false}
                            onChange={() => toggleProBono(item.id)}
                            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                          />
                          <span className="text-xs font-medium text-gray-700">
                            Mark as Pro-bono (Zero charge, no receivable, no
                            VAT)
                          </span>
                        </label>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Cart Summary */}
            <div className="px-4 pt-2 pb-4 bg-gray-50 border-t border-gray-200 shrink-0">
              <div className="space-y-1 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold">
                    ₦{formatNumber1(subtotal)}
                  </span>
                </div>
                {cart.length > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Taxable:</span>
                      <span className="font-semibold text-emerald-700">
                        ₦{formatNumber1(taxableSubtotal)}
                      </span>
                    </div>
                    {nonTaxableSubtotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Not taxable:</span>
                        <span className="font-semibold text-gray-600">
                          ₦{formatNumber1(nonTaxableSubtotal)}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Discount - Only show if discount is applied */}
                {discountAmount > 0 && selectedDiscount && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {selectedDiscount.discount_name} :
                    </span>
                    <span className="font-semibold text-red-600">
                      -₦{formatNumber1(discountAmount)}
                    </span>
                  </div>
                )}

                {/* Output VAT Display - Show when Output VAT is enabled (inclusive, exclusive, or all) */}
                {selectedOutputVAT.length > 0 && (
                  <>
                    {/* Show VAT calculation breakdown */}
                    {taxableSubtotal > 0 && (
                      <div className="mb-2 p-2 bg-blue-50 rounded border border-blue-200">
                        <div className="text-xs text-gray-600 mb-1">
                          <strong>VAT Calculation:</strong>
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          <div>
                            Taxable Subtotal: ₦{formatNumber1(taxableSubtotal)}
                          </div>
                          {discountAmount > 0 && (
                            <div>
                              Less Discount: -₦
                              {formatNumber1(
                                discountAmount *
                                  (taxableSubtotal / (subtotal || 1)),
                              )}
                            </div>
                          )}
                          <div className="font-medium text-blue-700">
                            Taxable Amount: ₦
                            {formatNumber1(
                              taxableSubtotal -
                                discountAmount *
                                  (taxableSubtotal / (subtotal || 1)),
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {outputVATTaxes
                      .filter((tax) => selectedOutputVAT.includes(tax.id))
                      .map((vatTax) => {
                        const taxableAmount =
                          taxableSubtotal -
                          discountAmount * (taxableSubtotal / (subtotal || 1));
                        const rateDecimal = parseFloat(vatTax.rate || 0) / 100;

                        // Inclusive: 37,000 includes 7.5% → extract = 2,581.40 | Exclusive: 7.5% on 37,000 = 2,775.00
                        const isInclusive =
                          vatTax.inclusive_type === "inclusive" ||
                          (vatTax.inclusive_type === undefined &&
                            vatTax.tax_type === "inclusive");
                        const taxAmountForDisplay =
                          rateDecimal > 0
                            ? isInclusive
                              ? taxableAmount -
                                taxableAmount / (1 + rateDecimal)
                              : taxableAmount * rateDecimal
                            : 0;

                        return (
                          <div
                            key={vatTax.id}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-gray-600">
                              {vatTax.description} ({vatTax.rate}%) [Output
                              VAT]:
                            </span>
                            <span className="font-semibold text-blue-600">
                              ₦{formatNumber1(taxAmountForDisplay)}
                            </span>
                          </div>
                        );
                      })}
                    {selectedOutputVAT.length > 1 && outputVATAmount > 0 && (
                      <div className="flex justify-between text-sm font-medium border-t pt-1">
                        <span className="text-gray-700">Total Output VAT:</span>
                        <span className="font-semibold text-blue-600">
                          ₦{formatNumber1(outputVATAmount)}
                        </span>
                      </div>
                    )}
                    {outputVATAmount === 0 && taxableSubtotal === 0 && (
                      <div className="text-xs text-gray-500 italic">
                        No VAT: No taxable items in cart
                      </div>
                    )}
                  </>
                )}

                {/* VAT/Tax Display - Show for regular taxes when Output VAT is enabled */}
                {selectedOutputVAT.length > 0 &&
                  (activeBusiness?.vat_policy === "vat_inclusive" ||
                    activeBusiness?.vat_policy === "all") &&
                  tax > 0 && (
                    <>
                      {selectedTaxes.map((taxItem) => {
                        const vatPolicy =
                          activeBusiness?.vat_policy || "vat_exclusive";
                        let taxAmountForDisplay = 0;

                        // Use tax's individual inclusive_type if vat_policy is "all"
                        const isTaxInclusive =
                          taxItem.inclusive_type === "inclusive" ||
                          (taxItem.inclusive_type === undefined &&
                            taxItem.tax_type === "inclusive") ||
                          (taxItem.inclusive_type === undefined &&
                            taxItem.tax_type === undefined &&
                            vatPolicy === "vat_inclusive" &&
                            vatPolicy !== "all");

                        if (isTaxInclusive) {
                          // Calculate only for inclusive taxes
                          const inclusiveTaxes = selectedTaxes.filter((t) => {
                            if (vatPolicy === "all") {
                              return (
                                t.inclusive_type === "inclusive" ||
                                (t.inclusive_type === undefined &&
                                  t.tax_type === "inclusive")
                              );
                            }
                            return (
                              t.inclusive_type === "inclusive" ||
                              (t.inclusive_type === undefined &&
                                vatPolicy === "vat_inclusive")
                            );
                          });
                          const totalRate = inclusiveTaxes.reduce((sum, t) => {
                            return sum + parseFloat(t.rate || 0) / 100;
                          }, 0);
                          if (totalRate > 0) {
                            const netAmount = taxableSubtotal / (1 + totalRate);
                            const totalVAT = taxableSubtotal - netAmount;
                            const taxRate = parseFloat(taxItem.rate || 0) / 100;
                            taxAmountForDisplay =
                              (totalVAT * taxRate) / totalRate;
                          }
                        } else {
                          taxAmountForDisplay =
                            (taxableSubtotal * parseFloat(taxItem.rate || 0)) /
                            100;
                        }

                        // Determine if this tax is inclusive or exclusive
                        const isInclusive =
                          taxItem.inclusive_type === "inclusive" ||
                          (taxItem.inclusive_type === undefined &&
                            taxItem.tax_type === "inclusive") ||
                          (taxItem.inclusive_type === undefined &&
                            taxItem.tax_type === undefined &&
                            vatPolicy === "vat_inclusive" &&
                            vatPolicy !== "all");

                        return (
                          <div
                            key={taxItem.id}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-gray-600">
                              {taxItem.description} ({taxItem.rate}%) [
                              {isInclusive ? "Inclusive" : "Exclusive"}]:
                            </span>
                            <span className="font-semibold">
                              ₦{formatNumber1(taxAmountForDisplay)}
                            </span>
                          </div>
                        );
                      })}
                      {selectedTaxes.length > 1 && (
                        <div className="flex justify-between text-sm font-medium border-t pt-1">
                          <span className="text-gray-700">
                            Total VAT (Inclusive):
                          </span>
                          <span className="font-semibold">
                            ₦{formatNumber1(tax)}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                {/* Individual Taxes - Show if taxes are selected and VAT is exclusive or all */}
                {(activeBusiness?.vat_policy === "vat_exclusive" ||
                  activeBusiness?.vat_policy === "all") &&
                  selectedTaxes.length > 0 && (
                    <>
                      {selectedTaxes.map((taxItem) => {
                        const taxableAmount =
                          taxableSubtotal -
                          discountAmount * (taxableSubtotal / (subtotal || 1));
                        const taxAmount =
                          (taxableAmount * parseFloat(taxItem.rate)) / 100;
                        return (
                          <div
                            key={taxItem.id}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-gray-600">
                              {taxItem.description} ({taxItem.rate}%):
                            </span>
                            <span className="font-semibold">
                              ₦{formatNumber1(taxAmount)}
                            </span>
                          </div>
                        );
                      })}
                      {selectedTaxes.length > 1 && (
                        <div className="flex justify-between text-sm font-medium border-t pt-1">
                          <span className="text-gray-700">Total VAT:</span>
                          <span className="font-semibold">
                            ₦{formatNumber1(tax)}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                <div className="flex justify-between text-md font-bold pt-2 border-t border-gray-300">
                  <span>Grand total:</span>
                  <span className="text-green-600">
                    ₦{formatNumber1(total)}
                  </span>
                </div>
              </div>

              <button
                disabled={cart.length === 0 || processingCheckout}
                onClick={handleSubmit}
                className="w-full py-0.5 px-3 text-sm bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-bold hover:from-green-700 hover:to-green-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center"
              >
                {processingCheckout ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2" size={16} />
                    Complete Paid Sale ₦
                    {formatNumber1(total)}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Customer Modal */}
      <CustomerRegistartion
        showModal={showNewCustomerModal}
        closeModal={() => setShowNewCustomerModal(false)}
        getList={() => {
          // Refresh customer list after creating a new customer
          dispatch(getCustomers());
        }}
        onSuccess={() => {
          // Refresh customer list and close modal
          dispatch(getCustomers());
          setShowNewCustomerModal(false);
        }}
      />
    </div>
  );
}

export default MakeSale;
