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

function buildBranchInvoiceView(invoiceData, branchIdFilter, packCode) {
  if (!invoiceData) return null;

  let items = Array.isArray(invoiceData.items) ? [...invoiceData.items] : [];
  const filterBid = parseInt(branchIdFilter, 10);
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

  const taxes = Array.isArray(invoiceData.taxes) ? invoiceData.taxes : [];
  const discounts = Array.isArray(invoiceData.discounts)
    ? invoiceData.discounts
    : [];
  const packSubtotal = items.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const usePackTotals =
    Number.isFinite(filterBid) && isBranchPack && items.length > 0;

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
  };
}

function InvoicePreview() {
  const navigate = useNavigate();
  const query = useQuery();
  const saleCode = query.get("sale_code");
  const branchIdFilter = query.get("branch_id");
  const packCode = query.get("pack_code");
  const printAll = query.get("print_all") === "1" || query.get("print_all") === "true";
  const autoPrint = query.get("auto_print") === "1" || query.get("auto_print") === "true";
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const facilityId = activeBusiness?.id;
  const [invoiceData, setInvoiceData] = useState(null);
  const [packs, setPacks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [didAutoPrint, setDidAutoPrint] = useState(false);

  const fetchInvoice = useCallback(() => {
    if (!saleCode || !facilityId) {
      return;
    }

    setIsLoading(true);
    setHasError(false);
    _fetchApi(
      `/api/v1/transactions/get-sale?sale_code=${saleCode}&facility_id=${facilityId}`,
      (response) => {
        if (response.success) {
          setInvoiceData(response.data);
          if (printAll) {
            const params = new URLSearchParams({
              facilityId,
              saleCode,
            });
            _fetchApi(
              `/api/v1/sale-workflows/fulfillments?${params.toString()}`,
              (packRes) => {
                setIsLoading(false);
                if (packRes.success) {
                  setPacks(packRes.results || []);
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
  }, [saleCode, facilityId, printAll]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  useEffect(() => {
    if (!saleCode && !isLoading) {
      toast.error("Sale code is required to preview the invoice.");
    }
  }, [saleCode, isLoading]);

  const resolvedInvoiceData = useMemo(
    () => buildBranchInvoiceView(invoiceData, branchIdFilter, packCode),
    [invoiceData, branchIdFilter, packCode],
  );

  const printAllCopies = useMemo(() => {
    if (!printAll || !invoiceData || !packs.length) return [];
    return packs.map((pack) => ({
      pack,
      data: buildBranchInvoiceView(
        invoiceData,
        pack.branch_id,
        pack.pack_code,
      ),
    }));
  }, [printAll, invoiceData, packs]);

  useEffect(() => {
    if (!autoPrint || didAutoPrint || isLoading) return;
    if (printAll && printAllCopies.length === 0) return;
    if (!printAll && !resolvedInvoiceData) return;
    setDidAutoPrint(true);
    const t = setTimeout(() => {
      window.print();
    }, 600);
    return () => clearTimeout(t);
  }, [
    autoPrint,
    didAutoPrint,
    isLoading,
    printAll,
    printAllCopies.length,
    resolvedInvoiceData,
  ]);

  const receiptType =
    activeBusiness?.default_receipt_type ||
    resolvedInvoiceData?.business?.default_receipt_type ||
    "pdf";
  const isTerminalReceipt = receiptType === "terminal" && !printAll;

  const handleCancel = () => {
    if (printAll || packCode || branchIdFilter) {
      navigate(-1);
      return;
    }
    toast.info("Sale saved. Redirecting to pending sales...");
    navigate(-1);
  };

  const handlePrintAll = () => {
    window.print();
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
      <div className="min-h-screen bg-gray-50 py-6">
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .branch-invoice-copy {
              break-after: page;
              page-break-after: always;
            }
            .branch-invoice-copy:last-child {
              break-after: auto;
              page-break-after: auto;
            }
            body { background: white !important; }
          }
        `}</style>
        <div className="no-print max-w-4xl mx-auto px-4 mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-md border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 flex-1">
            <strong>Print all branch copies</strong>
            <span className="block text-xs text-violet-700 mt-0.5">
              {printAllCopies.length} invoice cop
              {printAllCopies.length === 1 ? "y" : "ies"} for {saleCode} — each
              page is one branch.
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
        ) : (
          printAllCopies.map(({ pack, data }, idx) => (
            <div key={pack.id} className="branch-invoice-copy mb-8">
              <div className="no-print max-w-4xl mx-auto px-4 mb-2">
                <div className="text-sm font-medium text-violet-900">
                  Copy {idx + 1} of {printAllCopies.length} ·{" "}
                  {pack.branch_name || `Warehouse ${pack.branch_id}`} ·{" "}
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
                    copyLabel=""
                    showCustomerCopyActions={false}
                    enableInlineCustomerCopyPreview={false}
                    onCancel={handleCancel}
                  />
                </div>
              ) : null}
            </div>
          ))
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
        <div className="max-w-4xl mx-auto px-4 mb-4">
          <div className="rounded-md border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
            <strong>Warehouse invoice copy</strong>
            {packCode ? ` · ${packCode}` : ""}
            {resolvedInvoiceData.branch_pack_id != null
              ? ` · Branch #${resolvedInvoiceData.branch_pack_id}`
              : ""}
            <span className="block text-xs text-violet-700 mt-0.5">
              Only items for this warehouse branch (same invoice number, split
              by branch).
            </span>
          </div>
        </div>
      ) : null}
      {isTerminalReceipt && (
        <div className="invoice-print-section max-w-4xl mx-auto px-4">
          <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Thermal receipt preview
              </h2>
              <p className="text-sm text-gray-500">
                Terminal / thermal (80mm) — review before printing
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button color="primary" onClick={() => printThermalReceipt()}>
                <Printer className="inline w-4 h-4 mr-2" />
                Print receipt
              </Button>
              <Button color="secondary" outline onClick={handleCancel}>
                Close
              </Button>
            </div>
          </div>

          <div className="flex justify-center pb-8">
            <div className="rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50 px-3 py-1 text-center">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  80mm thermal slip
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
            copyLabel=""
            showCustomerCopyActions={!packCode && !branchIdFilter}
            enableInlineCustomerCopyPreview={false}
            onCancel={handleCancel}
            onCustomerCopySaved={fetchInvoice}
          />
        </div>
      )}
    </div>
  );
}

export default InvoicePreview;
