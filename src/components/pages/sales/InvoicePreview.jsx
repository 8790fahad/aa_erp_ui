import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import CreditSaleInvoiceImproved from "./CreditSaleInvoiceImproved";
import ThermalReceipt, { printThermalReceipt } from "./ThermalReceipt";
import useQuery from "@/hooks/useQuery";
import { useSelector } from "react-redux";
import { _fetchApi } from "@/redux/actions/api";
import { Button } from "reactstrap";
import { Printer } from "lucide-react";

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
  const packSubtotal = items.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const usePackTotals =
    (hasPackLines || (Number.isFinite(filterBid) && items.length > 0)) &&
    (hasPackLines ||
      items.some((it) => it.branch_id != null || it.branchId != null));

  return {
    ...invoiceData,
    items,
    deliveryItems: usePackTotals ? items : invoiceData.deliveryItems || items,
    taxes: usePackTotals ? [] : taxes,
    discounts: usePackTotals ? [] : discounts,
    discount: usePackTotals
      ? null
      : invoiceData.discount || discounts[0] || null,
    business: invoiceData.business || {},
    customer: invoiceData.customer || {},
    customerCopyEnabled: false,
    customerCopyPrices: {},
    customerCopyTaxes: usePackTotals ? [] : taxes,
    customerCopyDiscount: null,
    customerCopyItems: [],
    subtotal: usePackTotals ? packSubtotal : Number(invoiceData.subtotal ?? 0),
    totalTax: usePackTotals ? 0 : Number(invoiceData.totalTax ?? 0),
    totalAmount: usePackTotals
      ? packSubtotal
      : Number(invoiceData.totalAmount ?? invoiceData.total_amount ?? 0),
    discountAmount: usePackTotals
      ? 0
      : Number(invoiceData.discountAmount ?? 0),
    pack_code: packCode || null,
    branch_pack_id: Number.isFinite(filterBid) ? filterBid : null,
    branch_name: branchName || null,
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
  const isCollectionReceipt =
    query.get("collect") === "1" ||
    query.get("collect") === "true" ||
    query.get("collection") === "1";
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

  // Respect business system setting: PDF/A4 or Terminal/thermal.
  // Collection receipts always use thermal layout (dual signatures + barcode).
  const receiptType =
    activeBusiness?.default_receipt_type ||
    invoiceData?.business?.default_receipt_type ||
    "pdf";
  const isTerminalReceipt =
    receiptType === "terminal" || isCollectionReceipt;

  useEffect(() => {
    if (!autoPrint || didAutoPrint || isLoading) return;
    if (printAll && printAllCopies.length === 0) return;
    if (!printAll && !resolvedInvoiceData) return;
    setDidAutoPrint(true);
    const t = setTimeout(() => {
      // Single thermal invoice preview uses thermal print helper.
      // print_all uses the page @media print CSS (window.print).
      if (isTerminalReceipt && !printAll) {
        printThermalReceipt("both");
      } else {
        window.print();
      }
    }, 600);
    return () => clearTimeout(t);
  }, [
    autoPrint,
    didAutoPrint,
    isLoading,
    isTerminalReceipt,
    printAll,
    printAllCopies.length,
    resolvedInvoiceData,
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
    // print_all page has its own @media print CSS (A4 or thermal).
    // Do not use printThermalReceipt here — its visibility hack breaks multi-branch layout.
    window.print();
  };

  const handlePrintThermal = () => {
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
            /* Hide app chrome (sidebar / top bar) while printing branch copies */
            aside, nav, header, [data-sidebar], .app-sidebar, .sidebar {
              display: none !important;
            }
            .print-all-root {
              background: white !important;
              min-height: 0 !important;
              padding: 0 !important;
            }
            ${
              isTerminalReceipt
                ? `
            @page { size: portrait; margin: 4mm; }
            /* Hide everything except the thermal receipts */
            body * { visibility: hidden !important; }
            .print-receipt-only,
            .print-receipt-only * {
              visibility: visible !important;
            }
            .print-all-root,
            .print-all-thermal-list,
            .branch-invoice-copy,
            .print-receipt-frame,
            .print-receipt-only,
            .print-receipt-only * {
              visibility: visible !important;
            }
            .no-print,
            .no-print * {
              display: none !important;
              visibility: hidden !important;
            }
            aside, nav, header, [data-sidebar], .app-sidebar, .sidebar,
            aside *, nav *, header * {
              display: none !important;
              visibility: hidden !important;
            }
            .print-all-thermal-list {
              display: block !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .branch-invoice-copy {
              display: block !important;
              break-after: page;
              page-break-after: always;
              break-inside: avoid;
              page-break-inside: avoid;
              margin: 0 !important;
              padding: 0 !important;
            }
            .branch-invoice-copy:last-child {
              break-after: auto;
              page-break-after: auto;
            }
            .print-receipt-only {
              display: block !important;
              width: 80mm !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              overflow: visible !important;
            }
            .print-receipt-frame {
              border: none !important;
              box-shadow: none !important;
              background: transparent !important;
              overflow: visible !important;
            }
            .thermal-receipt-set {
              display: block !important;
              width: 80mm !important;
              margin: 0 !important;
            }
            .thermal-receipt-root,
            .thermal-receipt-root.thermal-receipt-preview {
              display: block !important;
              visibility: visible !important;
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 2mm 1.5mm !important;
              box-shadow: none !important;
              border: none !important;
              background: white !important;
              color: #000 !important;
            }
            `
                : `
            @page { size: A4 portrait; margin: 10mm; }
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
        `}</style>
        <div className="no-print max-w-4xl mx-auto px-4 mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-md border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 flex-1">
            <strong>Print all branch copies</strong>
            <span className="block text-xs text-violet-700 mt-0.5">
              {printAllCopies.length} branch cop
              {printAllCopies.length === 1 ? "y" : "ies"} for {saleCode} — one
              per warehouse ·{" "}
              {isTerminalReceipt
                ? "Thermal (80mm) from system settings — 1 customer copy each"
                : "A4 / PDF from system settings"}
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
        ) : isTerminalReceipt ? (
          <div className="print-all-thermal-list max-w-4xl mx-auto px-4 space-y-8">
            {printAllCopies.map(({ pack, data }, idx) => {
              const branchLabel =
                pack.branch_name || `Warehouse ${pack.branch_id}`;
              return (
                <div key={pack.id} className="branch-invoice-copy mb-8">
                  <div className="no-print mb-2 text-center">
                    <div className="text-sm font-medium text-violet-900">
                      Copy {idx + 1} of {printAllCopies.length} · {branchLabel}{" "}
                      · <span className="font-mono">{pack.pack_code}</span>
                    </div>
                  </div>
                  {data ? (
                    <div className="flex justify-center">
                      <div className="rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden print-receipt-frame">
                        <div className="no-print border-b border-gray-100 bg-gray-50 px-3 py-1 text-center">
                          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            80mm · {branchLabel} · Customer copy
                          </span>
                        </div>
                        <div className="print-receipt-only p-1.5 bg-gray-100">
                          <ThermalReceipt
                            preview
                            invoiceData={data}
                            business={
                              data.business?.business_name
                                ? data.business
                                : activeBusiness
                            }
                            customer={data.customer}
                          />
                        </div>
                      </div>
                    </div>
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
                  : "A4 collection slip — warehouse release + customer receive signatures."
                : isTerminalReceipt
                  ? "Thermal (80mm) from system settings — one customer copy for this branch."
                  : "A4 / PDF from system settings — full invoice for this warehouse branch."}
            </span>
          </div>
        </div>
      ) : null}
      {isTerminalReceipt && (
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
              <div className="p-1.5 bg-gray-100">
                <ThermalReceipt
                  preview
                  invoiceData={resolvedInvoiceData}
                  business={
                    resolvedInvoiceData.business?.business_name
                      ? resolvedInvoiceData.business
                      : activeBusiness
                  }
                  customer={resolvedInvoiceData.customer}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {!isTerminalReceipt && (
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
            showCustomerCopyActions={!packCode && !branchIdFilter}
            enableInlineCustomerCopyPreview={false}
            warehouseDualSignature={Boolean(packCode || branchIdFilter)}
            onCancel={handleCancel}
            onCustomerCopySaved={fetchInvoice}
          />
        </div>
      )}
    </div>
  );
}

export default InvoicePreview;
