import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import CreditSaleInvoiceImproved from "./CreditSaleInvoiceImproved";
import ThermalReceipt, {
  printThermalReceipt,
  printAllThermalReceipts,
} from "./ThermalReceipt";
import ThermalDeliveryOrder, {
  printThermalDeliveryOrder,
} from "./ThermalDeliveryOrder";
import useQuery from "@/hooks/useQuery";
import { useSelector } from "react-redux";
import { _fetchApi } from "@/redux/actions/api";
import { Button } from "reactstrap";
import { Printer } from "lucide-react";

/** Prefer live facility phone/address over stale invoice snapshot. */
function resolvePrintBusiness(invoiceBusiness, activeBusiness, facilityId) {
  if (invoiceBusiness?.business_name) {
    return {
      ...invoiceBusiness,
      id: invoiceBusiness.id || facilityId || activeBusiness?.id,
      business_phone:
        activeBusiness?.business_phone || invoiceBusiness.business_phone,
      business_address:
        activeBusiness?.business_address || invoiceBusiness.business_address,
    };
  }
  return activeBusiness;
}

function buildBranchInvoiceView(
  invoiceData,
  branchIdFilter,
  packCode,
  branchName = null,
  packLines = null,
) {
  if (!invoiceData) return null;

  let items = Array.isArray(invoiceData.items) ? [...invoiceData.items] : [];
  const filterBid = parseInt(branchIdFilter, 10);
  const lines = Array.isArray(packLines) ? packLines : null;
  const hasPackLines = Boolean(lines?.length);

  if (hasPackLines) {
    const remaining = [...items];
    items = lines.map((line) => {
      const pid = String(line.product_id || "").trim();
      const name = String(line.item_name || "").trim().toLowerCase();
      const qty = Number(line.qty || 0);
      const idx = remaining.findIndex((it) => {
        const sku = String(it.link_id || it.sku || it.item_code || "").trim();
        if (pid && sku && sku === pid) return true;
        const desc = String(it.description || it.item_name || "")
          .trim()
          .toLowerCase();
        return Boolean(name && desc && desc === name);
      });
      if (idx >= 0) {
        const [match] = remaining.splice(idx, 1);
        const baseQty = Number(match.quantity ?? match.qty ?? 1) || 1;
        const unitAmount =
          match.amount != null
            ? Number(match.amount) / baseQty
            : Number(match.price || match.unit_price || 0);
        return {
          ...match,
          quantity: qty,
          qty,
          amount: unitAmount * qty,
          branch_id: Number.isFinite(filterBid) ? filterBid : match.branch_id,
          branchId: Number.isFinite(filterBid) ? filterBid : match.branchId,
        };
      }
      return {
        description: line.item_name || line.product_id || "Item",
        link_id: line.product_id,
        quantity: qty,
        qty,
        amount: 0,
        price: 0,
        branch_id: Number.isFinite(filterBid) ? filterBid : 0,
        branchId: Number.isFinite(filterBid) ? filterBid : 0,
      };
    });
  } else {
    const hasBranchMeta = items.some(
      (it) => it.branch_id != null || it.branchId != null,
    );
    const isBranchPack = Number.isFinite(filterBid) && hasBranchMeta;

    if (Number.isFinite(filterBid) && isBranchPack) {
      items = items.filter((it) => {
        const bid = parseInt(it.branch_id ?? it.branchId, 10);
        return Number.isFinite(bid) && bid === filterBid;
      });
    }
  }

  const taxes = Array.isArray(invoiceData.taxes) ? invoiceData.taxes : [];
  const discounts = Array.isArray(invoiceData.discounts)
    ? invoiceData.discounts
    : [];
  const packSubtotal = items.reduce((sum, item) => {
    const qty = Number(
      item.quantity_sold ?? item.quantity ?? item.qty ?? 0,
    );
    const line =
      item.amount != null
        ? Number(item.amount)
        : Number(item.selling_price || item.price || 0) * qty;
    return sum + (Number.isFinite(line) ? line : 0);
  }, 0);
  const fullSubtotal = Number(
    invoiceData.subtotal ??
      (Array.isArray(invoiceData.items)
        ? invoiceData.items.reduce((sum, item) => {
            const qty = Number(
              item.quantity_sold ?? item.quantity ?? item.qty ?? 0,
            );
            const line =
              item.amount != null
                ? Number(item.amount)
                : Number(item.selling_price || item.price || 0) * qty;
            return sum + (Number.isFinite(line) ? line : 0);
          }, 0)
        : 0),
  );
  const usePackTotals =
    (hasPackLines || (Number.isFinite(filterBid) && items.length > 0)) &&
    (hasPackLines ||
      items.some((it) => it.branch_id != null || it.branchId != null));

  // Keep VAT/discount on branch packs — scale by pack share of the sale
  const packRatio =
    usePackTotals && fullSubtotal > 0
      ? Math.min(1, Math.max(0, packSubtotal / fullSubtotal))
      : 1;
  const fullTax = Number(invoiceData.totalTax ?? 0);
  const fullDiscount = Number(
    invoiceData.discountAmount ?? invoiceData.discount_amount ?? 0,
  );
  const packTaxes = usePackTotals
    ? taxes.map((tax) => {
        const amount = Number(tax.amount || tax.cost || 0) * packRatio;
        return { ...tax, amount, cost: amount };
      })
    : taxes;
  const packTaxTotal = usePackTotals
    ? packTaxes.reduce((sum, tax) => sum + Number(tax.amount || 0), 0)
    : fullTax;
  const packDiscountTotal = usePackTotals
    ? fullDiscount * packRatio
    : fullDiscount;
  const packGrandTotal = usePackTotals
    ? packSubtotal + packTaxTotal - packDiscountTotal
    : Number(invoiceData.totalAmount ?? invoiceData.total_amount ?? 0);

  return {
    ...invoiceData,
    items: items.map((item) => {
      // Invoice UI reads quantity_sold — pack mapping may only set qty/quantity
      const qty = Number(
        item.quantity_sold ?? item.quantity ?? item.qty ?? 0,
      );
      return {
        ...item,
        quantity_sold: qty || Number(item.quantity_sold) || 0,
      };
    }),
    deliveryItems: usePackTotals ? items : invoiceData.deliveryItems || items,
    taxes: packTaxes,
    discounts: usePackTotals
      ? packDiscountTotal > 0
        ? discounts.map((d) => ({
            ...d,
            amount: Number(d.amount || 0) * packRatio,
          }))
        : []
      : discounts,
    discount: usePackTotals
      ? packDiscountTotal > 0
        ? {
            ...(invoiceData.discount || discounts[0] || {}),
            amount: packDiscountTotal,
            value: packDiscountTotal,
            discount_type: "Fixed",
            type: "fixed",
          }
        : null
      : invoiceData.discount || discounts[0] || null,
    business: invoiceData.business || {},
    customer: invoiceData.customer || {},
    customerCopyEnabled: false,
    customerCopyPrices: {},
    customerCopyTaxes: packTaxes,
    customerCopyDiscount: null,
    customerCopyItems: [],
    subtotal: usePackTotals ? packSubtotal : Number(invoiceData.subtotal ?? 0),
    totalTax: usePackTotals ? packTaxTotal : fullTax,
    totalAmount: usePackTotals
      ? packGrandTotal
      : Number(invoiceData.totalAmount ?? invoiceData.total_amount ?? 0),
    discountAmount: usePackTotals ? packDiscountTotal : fullDiscount,
    discount_amount: usePackTotals ? packDiscountTotal : fullDiscount,
    pack_code: packCode || null,
    branch_pack_id: Number.isFinite(filterBid) ? filterBid : null,
    branch_name: branchName || null,
    warehouse: branchName || invoiceData.warehouse || null,
    warehouse_name: branchName || invoiceData.warehouse_name || null,
    mode_of_payment:
      invoiceData.mode_of_payment ||
      invoiceData.transaction?.mode_of_payment ||
      null,
    amount_paid:
      invoiceData.amount_paid ?? invoiceData.transaction?.amount_paid ?? 0,
    cash_paid:
      invoiceData.cash_paid ?? invoiceData.transaction?.cash_paid ?? 0,
    transfer_paid:
      invoiceData.transfer_paid ?? invoiceData.transaction?.transfer_paid ?? 0,
    transfer_banks:
      invoiceData.transfer_banks ||
      invoiceData.transaction?.transfer_banks ||
      [],
    payment_breakdown:
      invoiceData.payment_breakdown ||
      invoiceData.transaction?.payment_breakdown ||
      [],
    invoice_total_amount: Number(
      invoiceData.totalAmount ?? invoiceData.total_amount ?? 0,
    ),
  };
}

function InvoicePreview() {
  const navigate = useNavigate();
  const query = useQuery();
  const saleCode = query.get("sale_code");
  const branchIdFilter = query.get("branch_id");
  const packCode = query.get("pack_code");
  const branchNameParam = query.get("branch_name");
  const printAll = query.get("print_all") === "1" || query.get("print_all") === "true";
  const autoPrint = query.get("auto_print") === "1" || query.get("auto_print") === "true";
  const forceThermal =
    query.get("thermal") === "1" ||
    query.get("thermal") === "true" ||
    query.get("receipt") === "terminal";
  const isCollectionReceipt =
    query.get("collect") === "1" ||
    query.get("collect") === "true" ||
    query.get("collection") === "1";
  const docParam = String(query.get("doc") || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  // Verification Points → invoice; Invoice Separation → gin/dispatch
  const isDispatchDoc =
    docParam === "gin" ||
    docParam === "dispatch" ||
    docParam === "goods_issue" ||
    docParam === "goods_issue_note" ||
    docParam === "delivery_order" ||
    (!docParam &&
      !isCollectionReceipt &&
      Boolean(packCode || printAll || branchIdFilter));
  const isInvoiceDoc = !isDispatchDoc;
  const documentMode = isDispatchDoc ? "dispatch" : "invoice";
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const facilityId = activeBusiness?.id;
  const [invoiceData, setInvoiceData] = useState(null);
  const [packs, setPacks] = useState([]);
  const [activePack, setActivePack] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [didAutoPrint, setDidAutoPrint] = useState(false);

  const fetchInvoice = useCallback(() => {
    if (!saleCode || !facilityId) {
      return;
    }

    setIsLoading(true);
    setHasError(false);
    setActivePack(null);
    _fetchApi(
      `/api/v1/transactions/get-sale?sale_code=${saleCode}&facility_id=${facilityId}`,
      (response) => {
        if (response.success) {
          setInvoiceData(response.data);
          const loadPacks = printAll || Boolean(packCode);
          if (loadPacks) {
            const params = new URLSearchParams({
              facilityId,
              saleCode,
            });
            _fetchApi(
              `/api/v1/sale-workflows/fulfillments?${params.toString()}`,
              (packRes) => {
                setIsLoading(false);
                if (packRes.success) {
                  const list = packRes.results || [];
                  setPacks(list);
                  if (packCode) {
                    const match =
                      list.find((p) => p.pack_code === packCode) ||
                      list.find(
                        (p) =>
                          String(p.branch_id) === String(branchIdFilter),
                      ) ||
                      null;
                    setActivePack(match);
                  }
                } else {
                  setPacks([]);
                }
              },
              () => {
                setIsLoading(false);
                setPacks([]);
              },
            );
          } else {
            setIsLoading(false);
          }
        } else {
          setIsLoading(false);
          setHasError(true);
          toast.error(response.message || "Failed to fetch invoice data");
        }
      },
      (error) => {
        setIsLoading(false);
        setHasError(true);
        console.error("Error fetching invoice data:", error);
        toast.error("Failed to fetch invoice data");
      },
    );
  }, [saleCode, facilityId, printAll, packCode, branchIdFilter]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  useEffect(() => {
    if (!saleCode && !isLoading) {
      toast.error("Sale code is required to preview the invoice.");
    }
  }, [saleCode, isLoading]);

  const resolvedInvoiceData = useMemo(() => {
    const base = buildBranchInvoiceView(
      invoiceData,
      branchIdFilter,
      packCode,
      branchNameParam || activePack?.branch_name,
      activePack?.lines || null,
    );
    if (!base) return null;
    if (!isCollectionReceipt) return base;
    return {
      ...base,
      collection_receipt: true,
      collected_at: base.collected_at || new Date().toISOString(),
    };
  }, [
    invoiceData,
    branchIdFilter,
    packCode,
    branchNameParam,
    activePack,
    isCollectionReceipt,
  ]);

  const printAllCopies = useMemo(() => {
    if (!printAll || !invoiceData || !packs.length) return [];
    return packs.map((pack) => ({
      pack,
      data: buildBranchInvoiceView(
        invoiceData,
        pack.branch_id,
        pack.pack_code,
        pack.branch_name || null,
        pack.lines || null,
      ),
    }));
  }, [printAll, invoiceData, packs]);

  // Respect business system setting: PDF/A4, A5, or Terminal/thermal.
  // Prefer live invoice business over stale Redux session when present.
  // Collection receipts always use thermal. Do not let thermal=1 override A5/PDF settings.
  const receiptType = String(
    invoiceData?.business?.default_receipt_type ||
      activeBusiness?.default_receipt_type ||
      "pdf",
  )
    .trim()
    .toLowerCase();
  const isTerminalReceipt =
    isCollectionReceipt ||
    receiptType === "terminal" ||
    (forceThermal && receiptType !== "a5" && receiptType !== "pdf");
  const paperSize = receiptType === "a5" ? "a5" : "a4";
  const paperLabel = paperSize === "a5" ? "A5" : "A4";

  const printDeliveryOrderRaw = [
    invoiceData?.business?.print_delivery_order,
    activeBusiness?.print_delivery_order,
  ].find((v) => v !== undefined && v !== null);
  const deliveryOrderEnabled =
    printDeliveryOrderRaw === undefined || printDeliveryOrderRaw === null
      ? true
      : !!printDeliveryOrderRaw;
  const deliveryOrderFormat = String(
    invoiceData?.business?.delivery_order_format ||
      activeBusiness?.delivery_order_format ||
      "match",
  )
    .trim()
    .toLowerCase();
  const deliveryDocumentType = String(
    invoiceData?.business?.delivery_document_type ||
      activeBusiness?.delivery_document_type ||
      "delivery_order",
  )
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  const isGoodsIssueNote = deliveryDocumentType === "goods_issue_note";
  const dispatchDocLabel = isGoodsIssueNote
    ? "Goods Issue Note"
    : "Delivery Order";
  const showThermalDeliveryOrder =
    isDispatchDoc &&
    !isCollectionReceipt &&
    deliveryOrderEnabled &&
    deliveryOrderFormat === "thermal";
  const showMatchDispatchOnly =
    isDispatchDoc &&
    !isCollectionReceipt &&
    deliveryOrderEnabled &&
    deliveryOrderFormat !== "thermal";
  const showSalesInvoice = isInvoiceDoc && !isTerminalReceipt;
  const showMatchDispatchDocument = showMatchDispatchOnly;
  const showTerminalSalesReceipt =
    isTerminalReceipt && !showThermalDeliveryOrder && !showMatchDispatchDocument;

  const importantNoteText = (() => {
    const configured = [
      invoiceData?.business?.terms_conditions,
      activeBusiness?.terms_conditions,
    ].find((v) => v !== undefined && v !== null);
    if (configured === undefined) {
      return "Thank you for patronizing us. We look forward to your return and to continuing to do business with you.";
    }
    return String(configured).trim();
  })();

  const handlePrintThermalDeliveryOrder = () => {
    toast.message("Printing slip to content height", {
      description: `Set Scale to Actual size / 100%. Paper size should match the short ${dispatchDocLabel} — not 72 × 210 mm.`,
      duration: 6000,
    });
    printThermalDeliveryOrder();
  };

  useEffect(() => {
    if (!autoPrint || didAutoPrint || isLoading) return;
    if (printAll && printAllCopies.length === 0) return;
    if (!printAll && !resolvedInvoiceData) return;
    setDidAutoPrint(true);
    const t = setTimeout(() => {
      if (showThermalDeliveryOrder) {
        printThermalDeliveryOrder();
      } else if (isTerminalReceipt && printAll) {
        printAllThermalReceipts();
      } else if (isTerminalReceipt) {
        printThermalReceipt("both");
      } else {
        window.print();
      }
    }, 800);
    return () => clearTimeout(t);
  }, [
    autoPrint,
    didAutoPrint,
    isLoading,
    isTerminalReceipt,
    printAll,
    printAllCopies.length,
    resolvedInvoiceData,
    showThermalDeliveryOrder,
  ]);

  const handleCancel = () => {
    if (printAll || packCode || branchIdFilter) {
      navigate(-1);
      return;
    }
    toast.info("Sale saved. Redirecting to pending sales...");
    navigate(-1);
  };

  const handlePrintAll = () => {
    if (showThermalDeliveryOrder) {
      toast.message("Printing slip to content height", {
        description: `Set Scale to Actual size / 100%. Paper size should match the short ${dispatchDocLabel} — not 72 × 210 mm.`,
        duration: 6000,
      });
      printThermalDeliveryOrder();
      return;
    }
    if (isTerminalReceipt) {
      toast.message("One complete receipt per sheet", {
        description:
          "Each warehouse copy is its own page (no mid-cut). Set Scale to Actual size / 100%. Paper may still show 72×210 — that only adds blank under each copy.",
        duration: 7000,
      });
      printAllThermalReceipts();
      return;
    }
    window.print();
  };

  const handlePrintThermal = () => {
    toast.message("Check Paper size in the print dialog", {
      description:
        "If it says 72 × 210 mm you will get blank space. Choose the shorter size matching the receipt (or create Custom 72 × 120 mm). Use Actual size / 100%.",
      duration: 8000,
    });
    printThermalReceipt("both");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading invoice preview…</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white border border-red-200 rounded-md px-4 py-3 shadow-sm text-center">
          <p className="text-sm text-red-600 font-semibold">
            Unable to load invoice details.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Please verify the sale code or try again later.
          </p>
        </div>
      </div>
    );
  }

  if (printAll) {
    if (!invoiceData) return null;
    return (
      <div className="min-h-screen bg-gray-50 py-6 print-all-root">
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; margin: 0 !important; }
            aside, nav, header, [data-sidebar], .app-sidebar, .sidebar {
              display: none !important;
            }
            .print-all-root {
              background: white !important;
              min-height: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            ${
              isTerminalReceipt
                ? `
            /* Backup only — thermal print-all uses printAllThermalReceipts() */
            @page { size: 72mm auto; margin: 0; }
            html, body {
              width: 72mm !important;
              max-width: 72mm !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            body * { display: none !important; }
            .print-all-thermal-list,
            .print-all-thermal-list * {
              display: revert !important;
              visibility: visible !important;
            }
            .print-all-thermal-list {
              display: block !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: 72mm !important;
              max-width: 72mm !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .no-print,
            .no-print * {
              display: none !important;
            }
            .branch-invoice-copy {
              display: block !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 72mm !important;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .thermal-cut-mark {
              display: block !important;
              width: 72mm !important;
              margin: 2mm 0 3mm !important;
              text-align: center;
              font-family: "Courier New", Courier, monospace;
              font-size: 10px;
            }
            .thermal-cut-mark::before {
              content: "- - - - - cut here - - - - -";
              display: block;
            }
            .print-receipt-only,
            .print-receipt-frame,
            .thermal-receipt-set {
              display: block !important;
              width: 72mm !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              overflow: visible !important;
            }
            .thermal-receipt-root,
            .thermal-receipt-root.thermal-receipt-preview {
              display: block !important;
              width: 72mm !important;
              max-width: 72mm !important;
              margin: 0 !important;
              padding: 1mm 1mm 0 !important;
              box-shadow: none !important;
              border: none !important;
              background: white !important;
              color: #000 !important;
              font-family: "Courier New", Courier, monospace !important;
            }
            `
                : `
            @page { size: ${paperLabel} portrait; margin: 8mm; }
            .branch-invoice-copy {
              break-after: page;
              page-break-after: always;
            }
            .branch-invoice-copy:last-child {
              break-after: auto;
              page-break-after: auto;
            }
            `
            }
          }
          .print-all-thermal-list .print-receipt-frame {
            display: inline-block;
            width: 80mm;
            max-width: 80mm;
            height: auto !important;
            min-height: 0 !important;
          }
          .print-all-thermal-list .print-receipt-only {
            height: auto !important;
            min-height: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
        `}</style>
        <div className="no-print max-w-4xl mx-auto px-4 mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-md border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 flex-1">
            <strong>
              {isDispatchDoc
                ? `Print all ${dispatchDocLabel}s`
                : "Print all branch copies"}
            </strong>
            <span className="block text-xs text-violet-700 mt-0.5">
              {printAllCopies.length}{" "}
              {isDispatchDoc
                ? `${dispatchDocLabel.toLowerCase()}${printAllCopies.length === 1 ? "" : "s"}`
                : `branch cop${printAllCopies.length === 1 ? "y" : "ies"}`}{" "}
              for {saleCode} —{" "}
              {showThermalDeliveryOrder
                ? "continuous 80mm roll with cut marks between stores"
                : isTerminalReceipt
                  ? "continuous 80mm roll with cut marks between copies"
                  : `one ${paperLabel} page per warehouse`}
            </span>
          </div>
          <div className="flex gap-2">
            <Button color="primary" onClick={handlePrintAll}>
              <Printer className="inline w-4 h-4 mr-2" />
              Print all
            </Button>
            <Button color="secondary" outline onClick={handleCancel}>
              Close
            </Button>
          </div>
        </div>

        {printAllCopies.length === 0 ? (
          <div className="max-w-4xl mx-auto px-4 text-sm text-gray-500">
            No branch copies found for this invoice.
          </div>
        ) : showThermalDeliveryOrder ? (
          <div className="print-all-thermal-list max-w-4xl mx-auto px-4 space-y-4">
            {printAllCopies.map(({ pack, data }, idx) => {
              const branchLabel =
                pack.branch_name || `Warehouse ${pack.branch_id}`;
              const isLast = idx === printAllCopies.length - 1;
              return (
                <div key={pack.id} className="branch-invoice-copy mb-4">
                  <div className="no-print mb-2 text-center">
                    <div className="text-sm font-medium text-violet-900">
                      Copy {idx + 1} of {printAllCopies.length} · {branchLabel}{" "}
                      · <span className="font-mono">{pack.pack_code}</span>
                    </div>
                  </div>
                  {data ? (
                    <div className="flex justify-center">
                      <div className="rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden print-receipt-frame w-[80mm]">
                        <div className="no-print border-b border-gray-100 bg-gray-50 px-3 py-1 text-center">
                          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            80mm · {dispatchDocLabel} · {branchLabel}
                          </span>
                        </div>
                        <div className="print-receipt-only bg-white">
                          <ThermalDeliveryOrder
                            preview
                            documentType={deliveryDocumentType}
                            importantNote={importantNoteText}
                            preparedBy={
                              data?.user?.name ||
                              [data?.user?.firstname, data?.user?.lastname]
                                .filter(Boolean)
                                .join(" ") ||
                              activeBusiness?.business_admin_name ||
                              ""
                            }
                            invoiceData={data}
                            business={resolvePrintBusiness(
                              data.business,
                              activeBusiness,
                              data.facility_id,
                            )}
                            customer={data.customer}
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {!isLast ? (
                    <div className="thermal-cut-mark" aria-hidden="true" />
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : isTerminalReceipt ? (
          <div className="print-all-thermal-list max-w-4xl mx-auto px-4 space-y-4">
            {printAllCopies.map(({ pack, data }, idx) => {
              const branchLabel =
                pack.branch_name || `Warehouse ${pack.branch_id}`;
              const isLast = idx === printAllCopies.length - 1;
              return (
                <div key={pack.id} className="branch-invoice-copy mb-4">
                  <div className="no-print mb-2 text-center">
                    <div className="text-sm font-medium text-violet-900">
                      Copy {idx + 1} of {printAllCopies.length} · {branchLabel}{" "}
                      · <span className="font-mono">{pack.pack_code}</span>
                    </div>
                  </div>
                  {data ? (
                    <div className="flex justify-center">
                      <div className="rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden print-receipt-frame w-[80mm]">
                        <div className="no-print border-b border-gray-100 bg-gray-50 px-3 py-1 text-center">
                          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            80mm · {branchLabel} · Customer copy
                          </span>
                        </div>
                        <div className="print-receipt-only bg-white">
                          <ThermalReceipt
                            preview
                            invoiceData={data}
                            business={resolvePrintBusiness(
                              data.business,
                              activeBusiness,
                              data.facility_id,
                            )}
                            customer={data.customer}
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {!isLast ? (
                    <div className="thermal-cut-mark" aria-hidden="true" />
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          printAllCopies.map(({ pack, data }, idx) => {
            const branchLabel =
              pack.branch_name || `Warehouse ${pack.branch_id}`;
            return (
              <div key={pack.id} className="branch-invoice-copy mb-8">
                <div className="no-print max-w-4xl mx-auto px-4 mb-2 text-center">
                  <div className="text-sm font-medium text-violet-900">
                    Copy {idx + 1} of {printAllCopies.length} · {branchLabel} ·{" "}
                    <span className="font-mono">{pack.pack_code}</span>
                  </div>
                </div>
                {data ? (
                  <div className="invoice-print-section">
                    <CreditSaleInvoiceImproved
                      invoiceData={data}
                      business={data.business}
                      customer={data.customer}
                      date={data.date}
                      customPricing={data.customPricing}
                      customPrices={data.customPrices}
                      customerCopyEnabled={false}
                      customerCopyPrices={{}}
                      setCustomerCopyPrices={() => {}}
                      taxes={data.taxes}
                      discount={data.discount}
                      copyLabel={branchLabel}
                      showCustomerCopyActions={false}
                      enableInlineCustomerCopyPreview={false}
                      warehouseDualSignature
                      documentMode={documentMode}
                      paperSize={paperSize}
                      onCancel={handleCancel}
                    />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    );
  }

  if (!resolvedInvoiceData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      {packCode || resolvedInvoiceData.branch_pack_id != null ? (
        <div className="max-w-4xl mx-auto px-4 mb-4 no-print">
          <div
            className={`rounded-md border px-4 py-3 text-sm ${
              isCollectionReceipt
                ? "border-orange-200 bg-orange-50 text-orange-900"
                : "border-violet-200 bg-violet-50 text-violet-900"
            }`}
          >
            <strong>
              {isCollectionReceipt
                ? "Warehouse collection receipt"
                : isDispatchDoc
                  ? `${dispatchDocLabel} · warehouse copy`
                  : "Warehouse invoice copy"}
            </strong>
            {resolvedInvoiceData.branch_name
              ? ` · ${resolvedInvoiceData.branch_name}`
              : ""}
            {packCode ? ` · ${packCode}` : ""}
            <span
              className={`block text-xs mt-0.5 ${
                isCollectionReceipt ? "text-orange-700" : "text-violet-700"
              }`}
            >
              {isCollectionReceipt
                ? isTerminalReceipt
                  ? "Thermal (80mm) collection slip — warehouse release + customer receive signatures."
                  : `${paperLabel} collection slip — warehouse release + customer receive signatures.`
                : isDispatchDoc
                  ? showThermalDeliveryOrder
                    ? `Thermal (80mm) ${dispatchDocLabel} for this warehouse — print at Invoice Separation.`
                    : `${paperLabel} ${dispatchDocLabel} for this warehouse — print at Invoice Separation.`
                  : isTerminalReceipt
                    ? "Thermal (80mm) from system settings — one customer copy for this branch."
                    : `${paperLabel} / PDF from system settings — full invoice for this warehouse branch.`}
            </span>
          </div>
        </div>
      ) : null}
      {showTerminalSalesReceipt && (
        <div className="invoice-print-section max-w-4xl mx-auto px-4">
          <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isCollectionReceipt
                  ? "Collection receipt preview"
                  : "Thermal receipt preview"}
              </h2>
              <p className="text-sm text-gray-500">
                {isCollectionReceipt
                  ? "Terminal / thermal (80mm) — warehouse collection copy"
                  : "Terminal / thermal (80mm) — review before printing"}
              </p>
              <p className="text-xs text-amber-700 mt-1 max-w-md">
                To avoid blank paper: in the print dialog set Paper size away from
                fixed <strong>72 × 210 mm</strong> (use the short custom size or
                create 72 × 120 mm). Scale = Actual size.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button color="primary" onClick={handlePrintThermal}>
                <Printer className="inline w-4 h-4 mr-2" />
                {isCollectionReceipt
                  ? "Print collection receipt"
                  : "Print receipt"}
              </Button>
              <Button color="secondary" outline onClick={handleCancel}>
                Close
              </Button>
            </div>
          </div>

          <div
            className={`mb-3 rounded-md border px-4 py-3 text-sm ${
              isCollectionReceipt
                ? "border-orange-200 bg-orange-50 text-orange-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            <strong>
              {isCollectionReceipt ? "Collection copy" : "Customer copy"}
            </strong>
            <span
              className={`block text-xs mt-0.5 ${
                isCollectionReceipt ? "text-orange-800" : "text-emerald-800"
              }`}
            >
              {isCollectionReceipt
                ? "Goods collection receipt with dual signatures and pack barcode."
                : "One thermal receipt (VAT included in Amt)."}
            </span>
          </div>

          <div className="flex justify-center pb-8">
            <div className="rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50 px-3 py-1 text-center">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {isCollectionReceipt
                    ? "80mm · Collection receipt"
                    : "80mm · Customer copy"}
                </span>
              </div>
              <div className="p-0.5 bg-gray-100">
                <ThermalReceipt
                  preview
                  invoiceData={resolvedInvoiceData}
                  business={resolvePrintBusiness(
                    resolvedInvoiceData.business,
                    activeBusiness,
                    resolvedInvoiceData.facility_id,
                  )}
                  customer={resolvedInvoiceData.customer}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {(showSalesInvoice || showMatchDispatchDocument) && (
        <div className="invoice-print-section">
          <CreditSaleInvoiceImproved
            invoiceData={resolvedInvoiceData}
            business={resolvedInvoiceData.business}
            customer={resolvedInvoiceData.customer}
            date={resolvedInvoiceData.date}
            customPricing={resolvedInvoiceData.customPricing}
            customPrices={resolvedInvoiceData.customPrices}
            customerCopyEnabled={false}
            customerCopyPrices={resolvedInvoiceData.customerCopyPrices}
            customerCopyTaxesData={resolvedInvoiceData.customerCopyTaxes}
            customerCopyDiscountData={resolvedInvoiceData.customerCopyDiscount}
            setCustomerCopyPrices={() => {}}
            taxes={resolvedInvoiceData.taxes}
            discount={resolvedInvoiceData.discount}
            copyLabel={
              resolvedInvoiceData.branch_name ||
              (packCode ? `Pack ${packCode}` : "")
            }
            showCustomerCopyActions={
              showSalesInvoice && !packCode && !branchIdFilter
            }
            enableInlineCustomerCopyPreview={false}
            warehouseDualSignature={Boolean(packCode || branchIdFilter)}
            documentMode={documentMode}
            paperSize={paperSize}
            onCancel={handleCancel}
            onCustomerCopySaved={fetchInvoice}
          />
        </div>
      )}

      {showThermalDeliveryOrder && resolvedInvoiceData ? (
        <div className="max-w-4xl mx-auto px-4 pt-2 pb-10">
          <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Thermal {dispatchDocLabel}
              </h2>
              <p className="text-sm text-gray-500">
                80mm {dispatchDocLabel} — print at Invoice Separation (Sales
                Invoice is printed at Verification Points)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button color="primary" onClick={handlePrintThermalDeliveryOrder}>
                <Printer className="inline w-4 h-4 mr-2" />
                Print {dispatchDocLabel}
              </Button>
              <Button color="secondary" outline onClick={handleCancel}>
                Close
              </Button>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50 px-3 py-1 text-center">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  80mm · {dispatchDocLabel}
                </span>
              </div>
              <div className="p-0.5 bg-gray-100">
                <ThermalDeliveryOrder
                  preview
                  documentType={deliveryDocumentType}
                  importantNote={importantNoteText}
                  preparedBy={
                    resolvedInvoiceData?.user?.name ||
                    [
                      resolvedInvoiceData?.user?.firstname,
                      resolvedInvoiceData?.user?.lastname,
                    ]
                      .filter(Boolean)
                      .join(" ") ||
                    activeBusiness?.business_admin_name ||
                    ""
                  }
                  invoiceData={resolvedInvoiceData}
                  business={resolvePrintBusiness(
                    resolvedInvoiceData.business,
                    activeBusiness,
                    resolvedInvoiceData.facility_id,
                  )}
                  customer={resolvedInvoiceData.customer}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default InvoicePreview;
