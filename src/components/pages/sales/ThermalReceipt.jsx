import moment from "moment";
import Barcode from "react-barcode";
import { formatNumber1 } from "@/components/router/utilities";

function isTaxableItem(item) {
  const flag = String(item?.taxable || "").toLowerCase();
  return flag === "taxable" || flag === "yes" || flag === "true" || flag === "1";
}

/**
 * Allocate invoice-level tax across lines proportionally by taxable amount.
 * Returns items enriched with `lineVat` plus totals.
 */
export function buildThermalLineItems(invoiceData) {
  const items = Array.isArray(invoiceData?.items) ? invoiceData.items : [];
  const taxes = Array.isArray(invoiceData?.taxes) ? invoiceData.taxes : [];
  const subtotal = Number(invoiceData?.subtotal ?? 0);
  const totalTax = Number(
    invoiceData?.totalTax ??
      taxes.reduce((sum, t) => sum + Number(t.amount || 0), 0)
  );
  const discountAmount = Number(invoiceData?.discountAmount ?? 0);
  const totalAmount = Number(
    invoiceData?.totalAmount ??
      invoiceData?.total_amount ??
      subtotal + totalTax - discountAmount
  );

  const normalized = items.map((item) => {
    const qty = Number(item.quantity_sold ?? item.qty ?? 1);
    const price = Number(item.selling_price ?? item.price ?? 0);
    const lineTotal = Number(item.amount ?? qty * price);
    return {
      ...item,
      qty,
      price,
      lineTotal,
      taxable: isTaxableItem(item),
    };
  });

  const taxableSubtotal = normalized.reduce(
    (sum, item) => (item.taxable ? sum + item.lineTotal : sum),
    0
  );
  // If no item is flagged taxable but invoice has tax, spread across all lines.
  const vatBase =
    taxableSubtotal > 0
      ? taxableSubtotal
      : normalized.reduce((sum, item) => sum + item.lineTotal, 0);
  const allocateToAll = taxableSubtotal <= 0 && vatBase > 0 && totalTax > 0;

  const withVat = normalized.map((item) => {
    let lineVat = 0;
    const include =
      allocateToAll || (item.taxable && taxableSubtotal > 0 && totalTax > 0);
    if (include && vatBase > 0 && totalTax > 0) {
      lineVat = (item.lineTotal / vatBase) * totalTax;
    }
    return { ...item, lineVat };
  });

  return {
    items: withVat,
    taxes,
    subtotal,
    totalTax,
    discountAmount,
    totalAmount,
    taxableSubtotal,
  };
}

function ThermalReceiptCopy({
  invoiceData,
  business = {},
  customer = {},
  variant = "customer",
  preview = false,
}) {
  if (!invoiceData) return null;

  const { items, taxes, subtotal, totalTax, discountAmount, totalAmount } =
    buildThermalLineItems(invoiceData);

  const saleCode =
    invoiceData.sale_code ||
    invoiceData.transaction?.id ||
    invoiceData.invoice_ref ||
    "—";
  const barcodeValue = String(
    invoiceData.pack_code || saleCode || "",
  ).trim();
  const isWarehouseCopy = Boolean(
    invoiceData.pack_code || invoiceData.branch_name || invoiceData.branch_id,
  );
  const isCollectionReceipt = Boolean(invoiceData.collection_receipt);

  const isCustomerCopy = variant === "customer";
  const copyTitle = isCollectionReceipt
    ? "COLLECTION RECEIPT"
    : isWarehouseCopy
      ? "WAREHOUSE COPY"
      : "CUSTOMER COPY";
  const docTitle = isCollectionReceipt
    ? "GOODS COLLECTION"
    : "SALES RECEIPT";
  // Customer copy: fold VAT into Amt, no VAT column / Output VAT line.
  const showLineVat = !isCustomerCopy;
  const showTaxSummary = !isCustomerCopy;
  const showDualSign = isWarehouseCopy || isCollectionReceipt;

  const customerSubtotal = items.reduce(
    (sum, item) => sum + item.lineTotal + item.lineVat,
    0
  );

  return (
    <div
      className={`thermal-receipt-root thermal-receipt-copy thermal-receipt-copy--${variant}${
        preview ? " thermal-receipt-preview" : ""
      }`}
      data-receipt-variant={variant}
    >
      <div className="tr-center tr-bold tr-business-name">
        {business.business_name || "Receipt"}
      </div>
      {business.business_address && (
        <div className="tr-center tr-muted">{business.business_address}</div>
      )}
      {business.business_phone && (
        <div className="tr-center tr-muted">Tel: {business.business_phone}</div>
      )}

      <div className="tr-divider" />

      <div className="tr-center tr-bold">{docTitle}</div>
      <div className="tr-center tr-muted tr-copy-label">{copyTitle}</div>
      {(invoiceData.branch_name || invoiceData.pack_code) && (
        <div className="tr-center tr-muted">
          {[invoiceData.branch_name, invoiceData.pack_code]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}
      <div>Ref: {saleCode}</div>
      <div>
        Date:{" "}
        {moment(
          invoiceData.collected_at ||
            invoiceData.date ||
            invoiceData.transaction_date,
        ).format("DD/MM/YYYY HH:mm")}
      </div>
      {isCollectionReceipt ? (
        <div className="tr-muted">
          Collected:{" "}
          {invoiceData.collected_at
            ? moment(invoiceData.collected_at).format("DD/MM/YYYY HH:mm")
            : moment().format("DD/MM/YYYY HH:mm")}
        </div>
      ) : null}

      <div className="tr-divider" />

      <div className="tr-bold">Customer</div>
      <div>{customer.customer_name || customer.fullname || "Walk-in"}</div>
      {customer.phone && <div>{customer.phone}</div>}

      <div className="tr-divider" />

      <table className="tr-items">
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Item</th>
            <th className="tr-qty">Qty</th>
            <th className="tr-amt">Amt</th>
            {showLineVat && <th className="tr-vat">VAT</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const displayAmt = isCustomerCopy
              ? item.lineTotal + item.lineVat
              : item.lineTotal;
            return (
              <tr key={idx}>
                <td>
                  {item.item_name || item.name || item.product_name || "Item"}
                  {(item.product_id || item.sku) && (
                    <div className="tr-sku">{item.product_id || item.sku}</div>
                  )}
                </td>
                <td className="tr-qty">{formatNumber1(item.qty)}</td>
                <td className="tr-amt">₦{formatNumber1(displayAmt)}</td>
                {showLineVat && (
                  <td className="tr-vat">
                    {item.lineVat > 0.0001
                      ? `₦${formatNumber1(item.lineVat)}`
                      : "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="tr-divider" />

      <div className="tr-row">
        <span>Subtotal</span>
        <span>
          ₦{formatNumber1(isCustomerCopy ? customerSubtotal : subtotal)}
        </span>
      </div>
      {discountAmount > 0 && (
        <div className="tr-row">
          <span>Discount</span>
          <span>-₦{formatNumber1(discountAmount)}</span>
        </div>
      )}
      {showTaxSummary &&
        taxes.map((tax, i) => (
          <div className="tr-row" key={i}>
            <span>{tax.name || tax.description || "Tax"}</span>
            <span>₦{formatNumber1(tax.amount || 0)}</span>
          </div>
        ))}
      {showTaxSummary && totalTax > 0 && taxes.length === 0 && (
        <div className="tr-row">
          <span>Tax</span>
          <span>₦{formatNumber1(totalTax)}</span>
        </div>
      )}
      <div className="tr-row tr-bold tr-total">
        <span>TOTAL</span>
        <span>₦{formatNumber1(totalAmount)}</span>
      </div>

      <div className="tr-divider" />
      {showDualSign ? (
        <div className="tr-dual-sign">
          <div className="tr-sign-block">
            <div className="tr-sign-line" />
            <div className="tr-muted">Released by (Warehouse)</div>
          </div>
          <div className="tr-sign-block">
            <div className="tr-sign-line" />
            <div className="tr-muted">Received by (Customer)</div>
          </div>
        </div>
      ) : null}
      <div className="tr-center tr-footer">
        {isCollectionReceipt
          ? "Goods collected — thank you!"
          : "Thank you for your business!"}
      </div>
      {barcodeValue && barcodeValue !== "—" ? (
        <div className="tr-barcode tr-barcode-footer">
          <Barcode
            value={barcodeValue}
            width={1.2}
            height={36}
            displayValue
            fontSize={11}
            margin={2}
            background="#ffffff"
            lineColor="#000000"
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * 80mm thermal receipt layout.
 * Renders one Customer copy (VAT folded into Amt).
 */
export default function ThermalReceipt({
  invoiceData,
  business = {},
  customer = {},
  preview = false,
  className = "",
}) {
  if (!invoiceData) return null;

  return (
    <div
      className={`thermal-receipt-set${preview ? " thermal-receipt-set-preview" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      <style>{`
        .thermal-receipt-set {
          display: none;
        }
        .thermal-receipt-set.thermal-receipt-set-preview {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .thermal-receipt-root {
          display: none;
        }
        .thermal-receipt-root.thermal-receipt-preview {
          display: block;
          width: 80mm;
          max-width: 80mm;
          margin: 0 auto;
          padding: 2mm 1.5mm;
          font-family: "Courier New", Courier, monospace;
          font-size: 13px;
          line-height: 1.25;
          color: #000;
          background: #fff;
          box-sizing: border-box;
        }
        @media print {
          body.thermal-print-active * {
            visibility: hidden !important;
          }
          body.thermal-print-active .thermal-receipt-set,
          body.thermal-print-active .thermal-receipt-set * {
            visibility: visible !important;
          }
          body.thermal-print-active .thermal-receipt-set {
            display: block !important;
            position: relative;
            left: 0;
            top: 0;
            width: 80mm;
          }
          body.thermal-print-active .thermal-receipt-set.thermal-branch-pack {
            page-break-after: always;
            break-after: page;
          }
          body.thermal-print-active .thermal-receipt-set.thermal-branch-pack-last {
            page-break-after: auto;
            break-after: auto;
          }
          body.thermal-print-active .thermal-receipt-root {
            display: none !important;
          }
          body.thermal-print-active.thermal-print-customer .thermal-receipt-copy--customer,
          body.thermal-print-active.thermal-print-both .thermal-receipt-copy--customer {
            display: block !important;
            visibility: visible !important;
            position: relative;
            left: 0;
            top: 0;
            width: 80mm;
            max-width: 80mm;
            padding: 2mm 1.5mm;
            font-family: "Courier New", Courier, monospace;
            font-size: 13px;
            line-height: 1.25;
            color: #000;
            background: #fff;
            box-shadow: none;
          }
          @page {
            size: portrait;
            margin: 2mm;
          }
        }
        .thermal-receipt-root .tr-center { text-align: center; }
        .thermal-receipt-root .tr-bold { font-weight: 700; }
        .thermal-receipt-root .tr-divider {
          border-top: 1px dashed #000;
          margin: 3px 0;
        }
        .thermal-receipt-root .tr-row {
          display: flex;
          justify-content: space-between;
          gap: 2px;
        }
        .thermal-receipt-root .tr-items th,
        .thermal-receipt-root .tr-items td {
          font-size: 11px;
          padding: 1px 0;
          vertical-align: top;
        }
        .thermal-receipt-root .tr-items {
          width: 100%;
          border-collapse: collapse;
        }
        .thermal-receipt-root .tr-items .tr-qty { width: 12%; text-align: right; }
        .thermal-receipt-root .tr-items .tr-amt { width: 28%; text-align: right; }
        .thermal-receipt-root .tr-items .tr-vat { width: 22%; text-align: right; }
        .thermal-receipt-root .tr-business-name { font-size: 15px; }
        .thermal-receipt-root .tr-muted { font-size: 12px; }
        .thermal-receipt-root .tr-copy-label {
          font-size: 11px;
          letter-spacing: 0.04em;
          margin-bottom: 2px;
        }
        .thermal-receipt-root .tr-sku { font-size: 10px; opacity: 0.85; }
        .thermal-receipt-root .tr-total { margin-top: 2px; font-size: 14px; }
        .thermal-receipt-root .tr-footer { font-size: 12px; }
        .thermal-receipt-root .tr-barcode {
          display: flex;
          justify-content: center;
          margin: 4px 0 2px;
          overflow: hidden;
        }
        .thermal-receipt-root .tr-barcode-footer {
          margin: 8px 0 0;
        }
        .thermal-receipt-root .tr-barcode svg {
          max-width: 100%;
          height: auto;
        }
        .thermal-receipt-root .tr-dual-sign {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin: 6px 0 4px;
        }
        .thermal-receipt-root .tr-sign-block {
          text-align: center;
        }
        .thermal-receipt-root .tr-sign-line {
          border-bottom: 1px solid #000;
          height: 18px;
          margin-bottom: 2px;
        }
      `}</style>

      <ThermalReceiptCopy
        preview={preview}
        invoiceData={invoiceData}
        business={business}
        customer={customer}
        variant="customer"
      />
    </div>
  );
}

const PRINT_MODE_CLASSES = [
  "thermal-print-vat",
  "thermal-print-customer",
  "thermal-print-both",
];

/**
 * Prints one Customer copy (VAT included in amounts).
 */
export function printThermalReceipt(_mode = "both") {
  document.body.classList.add("thermal-print-active");
  PRINT_MODE_CLASSES.forEach((cls) => document.body.classList.remove(cls));
  document.body.classList.add("thermal-print-both");

  const cleanup = () => {
    document.body.classList.remove("thermal-print-active");
    PRINT_MODE_CLASSES.forEach((cls) => document.body.classList.remove(cls));
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  setTimeout(() => window.print(), 100);
}
