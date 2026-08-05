import moment from "moment";
import { formatNumber1 } from "@/components/router/utilities";

/**
 * 80mm thermal receipt layout.
 * With `preview`, renders on screen like a narrow receipt slip; otherwise hidden until print.
 */
export default function ThermalReceipt({
  invoiceData,
  business = {},
  customer = {},
  preview = false,
}) {
  if (!invoiceData) return null;

  const items = Array.isArray(invoiceData.items) ? invoiceData.items : [];
  const taxes = Array.isArray(invoiceData.taxes) ? invoiceData.taxes : [];
  const subtotal = Number(invoiceData.subtotal ?? 0);
  const totalTax = Number(invoiceData.totalTax ?? 0);
  const discountAmount = Number(invoiceData.discountAmount ?? 0);
  const totalAmount = Number(
    invoiceData.totalAmount ?? invoiceData.total_amount ?? subtotal + totalTax
  );
  const saleCode =
    invoiceData.sale_code ||
    invoiceData.transaction?.id ||
    invoiceData.invoice_ref ||
    "—";

  return (
    <div
      className={`thermal-receipt-root${preview ? " thermal-receipt-preview" : ""}`}
    >
      <style>{`
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
          body.thermal-print-active .thermal-receipt-root,
          body.thermal-print-active .thermal-receipt-root * {
            visibility: visible !important;
          }
          body.thermal-print-active .thermal-receipt-root {
            display: block !important;
            position: absolute;
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
            size: 80mm auto;
            margin: 1mm;
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
          font-size: 12px;
          padding: 1px 0;
          vertical-align: top;
        }
        .thermal-receipt-root .tr-items {
          width: 100%;
          border-collapse: collapse;
        }
        .thermal-receipt-root .tr-items .tr-qty { width: 12%; text-align: right; }
        .thermal-receipt-root .tr-items .tr-amt { width: 28%; text-align: right; }
        .thermal-receipt-root .tr-business-name { font-size: 15px; }
        .thermal-receipt-root .tr-muted { font-size: 12px; }
        .thermal-receipt-root .tr-sku { font-size: 10px; opacity: 0.85; }
        .thermal-receipt-root .tr-total { margin-top: 2px; font-size: 14px; }
        .thermal-receipt-root .tr-footer { font-size: 12px; }
      `}</style>

      <div className="tr-center tr-bold tr-business-name">
        {business.business_name || "Receipt"}
      </div>
      {business.business_address && (
        <div className="tr-center tr-muted">
          {business.business_address}
        </div>
      )}
      {business.business_phone && (
        <div className="tr-center tr-muted">
          Tel: {business.business_phone}
        </div>
      )}

      <div className="tr-divider" />

      <div className="tr-center tr-bold">SALES RECEIPT</div>
      <div>Ref: {saleCode}</div>
      <div>
        Date:{" "}
        {moment(invoiceData.date || invoiceData.transaction_date).format(
          "DD/MM/YYYY HH:mm"
        )}
      </div>

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
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const qty = Number(item.quantity_sold ?? item.qty ?? 1);
            const price = Number(item.selling_price ?? item.price ?? 0);
            const lineTotal = Number(item.amount ?? qty * price);
            return (
              <tr key={idx}>
                <td>
                  {item.item_name || item.name || item.product_name || "Item"}
                  {(item.product_id || item.sku) && (
                    <div className="tr-sku">
                      {item.product_id || item.sku}
                    </div>
                  )}
                </td>
                <td className="tr-qty">{formatNumber1(qty)}</td>
                <td className="tr-amt">₦{formatNumber1(lineTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="tr-divider" />

      <div className="tr-row">
        <span>Subtotal</span>
        <span>₦{formatNumber1(subtotal)}</span>
      </div>
      {discountAmount > 0 && (
        <div className="tr-row">
          <span>Discount</span>
          <span>-₦{formatNumber1(discountAmount)}</span>
        </div>
      )}
      {taxes.map((tax, i) => (
        <div className="tr-row" key={i}>
          <span>{tax.name || tax.description || "Tax"}</span>
          <span>₦{formatNumber1(tax.amount || 0)}</span>
        </div>
      ))}
      {totalTax > 0 && taxes.length === 0 && (
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
      <div className="tr-center tr-footer">
        Thank you for your business!
      </div>
    </div>
  );
}

/** Add body class, trigger print, remove class */
export function printThermalReceipt() {
  document.body.classList.add("thermal-print-active");
  const cleanup = () => {
    document.body.classList.remove("thermal-print-active");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  setTimeout(() => window.print(), 100);
}
