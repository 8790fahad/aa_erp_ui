import moment from "moment";
import Barcode from "react-barcode";

/** Compact money/qty for 80mm: hide .00 when whole (2.00 → 2, 128,000.00 → 128,000). */
function formatThermalNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 0.0005;
  return rounded.toLocaleString("en-NG", {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  });
}

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
                <td className="tr-qty">{formatThermalNumber(item.qty)}</td>
                <td className="tr-amt">₦{formatThermalNumber(displayAmt)}</td>
                {showLineVat && (
                  <td className="tr-vat">
                    {item.lineVat > 0.0001
                      ? `₦${formatThermalNumber(item.lineVat)}`
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
          ₦{formatThermalNumber(isCustomerCopy ? customerSubtotal : subtotal)}
        </span>
      </div>
      {discountAmount > 0 && (
        <div className="tr-row">
          <span>Discount</span>
          <span>-₦{formatThermalNumber(discountAmount)}</span>
        </div>
      )}
      {showTaxSummary &&
        taxes.map((tax, i) => (
          <div className="tr-row" key={i}>
            <span>{tax.name || tax.description || "Tax"}</span>
            <span>₦{formatThermalNumber(tax.amount || 0)}</span>
          </div>
        ))}
      {showTaxSummary && totalTax > 0 && taxes.length === 0 && (
        <div className="tr-row">
          <span>Tax</span>
          <span>₦{formatThermalNumber(totalTax)}</span>
        </div>
      )}
      <div className="tr-row tr-bold tr-total">
        <span>TOTAL</span>
        <span>₦{formatThermalNumber(totalAmount)}</span>
      </div>

      <div className="tr-divider" />
      {showDualSign ? (
        <div className="tr-dual-sign">
          <div className="tr-sign-block">
            <div className="tr-muted">
              Released by (
              {invoiceData.branch_name ||
                invoiceData.warehouse_name ||
                invoiceData.store_name ||
                "Warehouse"}
              )
            </div>
            <div className="tr-sign-line" />
          </div>
          <div className="tr-sign-block">
            <div className="tr-muted">
              Received by (
              {customer.customer_name ||
                customer.fullname ||
                invoiceData.customer_name ||
                "Customer"}
              )
            </div>
            <div className="tr-sign-line" />
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
            width={1.6}
            height={36}
            displayValue
            fontSize={14}
            fontOptions="bold"
            margin={0}
            marginTop={10}
            marginBottom={0}
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
          gap: 12px;
        }
        .thermal-receipt-root {
          display: none;
        }
        .thermal-receipt-root.thermal-receipt-preview {
          display: block;
          width: 80mm;
          max-width: 80mm;
          margin: 0 auto;
          padding: 1mm 1mm 0;
          font-family: "Courier New", Courier, monospace;
          font-size: 15px;
          font-weight: 400;
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
          /* Fallback only; single print uses measured text height */
          @page {
            size: 72mm auto;
            margin: 0;
          }
          html, body {
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body.thermal-print-active .thermal-receipt-set {
            display: block !important;
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body.thermal-print-active .thermal-receipt-set.thermal-branch-pack {
            /* Continuous roll: soft gap + cut mark, not a full page break */
            page-break-after: avoid;
            break-after: avoid;
            margin-bottom: 2mm !important;
            padding-bottom: 2mm !important;
            border-bottom: 1px dashed #000;
          }
          body.thermal-print-active .thermal-receipt-set.thermal-branch-pack-last {
            page-break-after: auto;
            break-after: auto;
            border-bottom: none;
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
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
            margin: 0 !important;
            padding: 1mm 1mm 0 !important;
            font-family: "Courier New", Courier, monospace;
            font-size: 15px;
            font-weight: 400;
            line-height: 1.25;
            color: #000 !important;
            background: #fff;
            box-shadow: none;
          }
        }
        .thermal-receipt-root .tr-center { text-align: center; }
        .thermal-receipt-root .tr-bold { font-weight: 700; }
        .thermal-receipt-root .tr-divider {
          border-top: 1px dashed #000;
          margin: 8px 0;
        }
        .thermal-receipt-root .tr-row {
          display: flex;
          justify-content: space-between;
          gap: 2px;
          font-weight: 400;
        }
        .thermal-receipt-root .tr-items th,
        .thermal-receipt-root .tr-items td {
          font-size: 14px;
          font-weight: 400;
          padding: 1px 0;
          vertical-align: top;
        }
        .thermal-receipt-root .tr-items th {
          font-weight: 700;
        }
        .thermal-receipt-root .tr-items {
          width: 100%;
          border-collapse: collapse;
        }
        .thermal-receipt-root .tr-items .tr-qty { width: 14%; text-align: center; }
        .thermal-receipt-root .tr-items .tr-amt { width: 28%; text-align: right; }
        .thermal-receipt-root .tr-items .tr-vat { width: 22%; text-align: right; }
        .thermal-receipt-root .tr-business-name {
          font-size: 17px;
          font-weight: 700;
        }
        .thermal-receipt-root .tr-muted {
          font-size: 12px;
          font-weight: 400;
          opacity: 1;
        }
        .thermal-receipt-root .tr-copy-label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          margin-bottom: 0;
        }
        .thermal-receipt-root .tr-sku { font-size: 11px; font-weight: 400; opacity: 0.85; }
        .thermal-receipt-root .tr-total { margin-top: 2px; font-size: 16px; font-weight: 700; }
        .thermal-receipt-root .tr-footer {
          font-size: 12px;
          font-weight: 400;
          margin: 8px 0 0;
        }
        .thermal-receipt-root .tr-barcode {
          display: flex;
          justify-content: center;
          margin: 10px 0 0;
          padding: 0;
          overflow: hidden;
        }
        .thermal-receipt-root .tr-barcode-footer {
          margin: 12px 0 0;
          padding-bottom: 0;
        }
        .thermal-receipt-root .tr-barcode svg {
          max-width: 100%;
          height: auto;
          display: block;
        }
        .thermal-receipt-root .tr-dual-sign {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin: 6px 0 4px;
        }
        .thermal-receipt-root .tr-sign-block {
          text-align: center;
          font-weight: 400;
        }
        .thermal-receipt-root .tr-sign-line {
          border-bottom: 1px solid #000;
          height: 18px;
          margin-top: 2px;
          margin-bottom: 0;
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

const THERMAL_WIDTH_MM = 72;

const THERMAL_IFRAME_CSS = `
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: ${THERMAL_WIDTH_MM}mm !important;
    max-width: ${THERMAL_WIDTH_MM}mm !important;
    height: auto !important;
    min-height: 0 !important;
    background: #fff !important;
    overflow: hidden !important;
  }
  body {
    font-family: "Courier New", Courier, monospace;
    font-size: 15px;
    font-weight: 400;
    line-height: 1.25;
    color: #000;
  }
  .thermal-receipt-root,
  .thermal-receipt-copy {
    display: block !important;
    width: ${THERMAL_WIDTH_MM}mm !important;
    max-width: ${THERMAL_WIDTH_MM}mm !important;
    margin: 0 !important;
    padding: 1mm 1mm 0 !important;
    box-sizing: border-box;
    background: #fff;
    height: auto !important;
    min-height: 0 !important;
  }
  .tr-center { text-align: center; }
  .tr-bold { font-weight: 700; }
  .tr-divider { border-top: 1px dashed #000; margin: 8px 0; }
  .tr-row { display: flex; justify-content: space-between; gap: 2px; font-weight: 400; }
  .tr-items { width: 100%; border-collapse: collapse; }
  .tr-items th, .tr-items td { font-size: 14px; font-weight: 400; padding: 1px 0; vertical-align: top; }
  .tr-items th { font-weight: 700; }
  .tr-qty { width: 14%; text-align: center !important; }
  .tr-amt { width: 28%; text-align: right; }
  .tr-vat { width: 22%; text-align: right; }
  .tr-business-name { font-size: 17px; font-weight: 700; }
  .tr-muted { font-size: 12px; font-weight: 400; }
  .tr-copy-label { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; }
  .tr-sku { font-size: 11px; font-weight: 400; }
  .tr-total { margin-top: 2px; font-size: 16px; font-weight: 700; }
  .tr-footer { font-size: 12px; font-weight: 400; margin: 8px 0 0; }
  .tr-barcode { display: flex; justify-content: center; margin: 10px 0 0; padding: 0; overflow: hidden; }
  .tr-barcode-footer { margin: 12px 0 0; padding-bottom: 0 !important; }
  .tr-barcode svg { max-width: 100%; height: auto; display: block; }
  .tr-dual-sign { display: flex; flex-direction: column; gap: 14px; margin: 6px 0 4px; }
  .tr-sign-block { text-align: center; font-weight: 400; }
  .tr-sign-line { border-bottom: 1px solid #000; height: 18px; margin-top: 2px; }
`;

/** Height of visible text/nodes only (ignores empty container padding). */
function measureReceiptHeightPx(root) {
  const rootRect = root.getBoundingClientRect();
  let bottom = rootRect.top;
  const nodes = root.querySelectorAll("*");
  nodes.forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const style = root.ownerDocument.defaultView?.getComputedStyle(el);
    if (!style || style.display === "none" || style.visibility === "hidden") {
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.height > 0) bottom = Math.max(bottom, r.bottom);
  });
  const px = Math.ceil(bottom - rootRect.top);
  return Math.max(px, Math.ceil(root.scrollHeight || 0));
}

function pxToMm(px) {
  return (px * 25.4) / 96;
}

/** Drop trailing white rows so page height follows ink/text only. */
function trimCanvasWhiteBottom(canvas, whiteMin = 248) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  let y = height - 1;
  for (; y >= 0; y -= 1) {
    let rowHasInk = false;
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      if (
        data[i] < whiteMin ||
        data[i + 1] < whiteMin ||
        data[i + 2] < whiteMin
      ) {
        rowHasInk = true;
        break;
      }
    }
    if (rowHasInk) break;
  }
  const trimH = Math.min(height, y + 8);
  if (trimH >= height - 2) return canvas;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = Math.max(1, trimH);
  out.getContext("2d").drawImage(canvas, 0, 0, width, trimH, 0, 0, width, trimH);
  return out;
}

function cleanupThermalFrame(frame) {
  if (!frame) return;
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
}

/** POS-80t default ticket height in the Mac driver (causes blank if we ignore it). */
const THERMAL_TICKET_MM = 210;

/**
 * Build and print a PDF: one page per receipt canvas, height = that receipt only.
 * Never slices through a receipt (avoids “Released by” on page 1 / “Received by” on page 2).
 */
async function printThermalCanvases(canvases) {
  const list = (Array.isArray(canvases) ? canvases : [canvases]).filter(
    Boolean,
  );
  if (list.length === 0) return;

  const { jsPDF } = await import("jspdf");
  const pageW = THERMAL_WIDTH_MM;
  let pdf = null;

  list.forEach((canvas, i) => {
    const mmH = Math.max(35, (canvas.height * pageW) / canvas.width);
    // Page box = exact receipt height (do not use 210mm — that forces mid-splits)
    const pageH = mmH;
    const img = canvas.toDataURL("image/png");

    if (i === 0) {
      pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pageW, pageH],
        compress: true,
      });
    } else {
      pdf.addPage([pageW, pageH], "portrait");
    }
    pdf.addImage(img, "PNG", 0, 0, pageW, mmH, undefined, "FAST");
  });

  pdf.autoPrint();
  const url = URL.createObjectURL(pdf.output("blob"));

  // Hidden iframe only — do not open a new browser tab
  let frame = document.getElementById("thermal-print-frame");
  if (frame) frame.remove();
  frame = document.createElement("iframe");
  frame.id = "thermal-print-frame";
  frame.setAttribute("title", "Thermal receipt print");
  document.body.appendChild(frame);
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch (_) {
      /* ignore */
    }
    setTimeout(() => {
      URL.revokeObjectURL(url);
      cleanupThermalFrame(frame);
    }, 60_000);
  };
  frame.src = url;
}

async function printThermalCanvas(canvas) {
  return printThermalCanvases([canvas]);
}

/** Capture one DOM node to a trimmed canvas. */
async function captureThermalNode(node, html2canvas) {
  const contentPx = measureReceiptHeightPx(node);
  let canvas = await html2canvas(node, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
    scrollX: 0,
    scrollY: 0,
    height: contentPx,
    windowHeight: contentPx,
  });
  return trimCanvasWhiteBottom(canvas);
}

/**
 * Prints one Customer copy sized to receipt text height.
 */
export function printThermalReceipt(_mode = "both") {
  const source =
    document.querySelector(
      ".thermal-receipt-set .thermal-receipt-copy--customer",
    ) ||
    document.querySelector(".thermal-receipt-root.thermal-receipt-preview") ||
    document.querySelector(".thermal-receipt-root");

  if (!source) {
    document.body.classList.add("thermal-print-active", "thermal-print-both");
    const cleanup = () => {
      document.body.classList.remove(
        "thermal-print-active",
        ...PRINT_MODE_CLASSES,
      );
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 100);
    return;
  }

  const run = async () => {
    let frame = document.getElementById("thermal-print-frame");
    if (frame) frame.remove();
    frame = document.createElement("iframe");
    frame.id = "thermal-print-frame";
    frame.setAttribute("title", "Thermal receipt print");
    document.body.appendChild(frame);
    frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${THERMAL_WIDTH_MM}mm;height:auto;min-height:0;border:0;opacity:1;pointer-events:none;z-index:-1;`;

    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const clone = source.cloneNode(true);
    clone.classList.remove("thermal-receipt-preview");
    clone.style.cssText = `display:block;width:${THERMAL_WIDTH_MM}mm;max-width:${THERMAL_WIDTH_MM}mm;margin:0;padding:1mm 1mm 0;background:#fff;box-sizing:border-box;height:auto;min-height:0;`;

    doc.open();
    doc.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipt</title><style>${THERMAL_IFRAME_CSS}</style></head><body></body></html>`,
    );
    doc.close();
    doc.body.appendChild(clone);

    await new Promise((r) => setTimeout(r, 350));

    const mmFromText = Math.max(
      35,
      Math.ceil(pxToMm(measureReceiptHeightPx(clone)) + 2),
    );

    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await captureThermalNode(clone, html2canvas);
      await printThermalCanvases([canvas]);
      cleanupThermalFrame(frame);
    } catch (err) {
      console.warn("thermal capture failed, HTML print:", err);
      const pageStyle = doc.createElement("style");
      pageStyle.textContent = `@page { size: ${THERMAL_WIDTH_MM}mm ${mmFromText}mm; margin: 0; }`;
      doc.head.appendChild(pageStyle);
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => cleanupThermalFrame(frame), 1500);
    }
  };

  void run();
}

/**
 * Print-all thermal: clone every branch receipt into a clean strip (no app chrome).
 * Avoids top blank + mid-receipt page splits from visibility:hidden layout.
 */
export function printAllThermalReceipts() {
  const receipts = Array.from(
    document.querySelectorAll(
      ".print-all-thermal-list .thermal-receipt-copy--customer",
    ),
  );

  if (receipts.length === 0) {
    const fallback = Array.from(
      document.querySelectorAll(
        ".print-all-thermal-list .thermal-receipt-root",
      ),
    );
    if (fallback.length === 0) {
      window.print();
      return;
    }
    return printAllThermalReceiptsFromNodes(fallback);
  }

  return printAllThermalReceiptsFromNodes(receipts);
}

function printAllThermalReceiptsFromNodes(receipts) {
  const run = async () => {
    let frame = document.getElementById("thermal-print-frame");
    if (frame) frame.remove();
    frame = document.createElement("iframe");
    frame.id = "thermal-print-frame";
    frame.setAttribute("title", "Thermal print all");
    document.body.appendChild(frame);
    frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${THERMAL_WIDTH_MM}mm;height:auto;border:0;opacity:1;pointer-events:none;z-index:-1;`;

    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipts</title><style>${THERMAL_IFRAME_CSS}
        .thermal-strip { width: ${THERMAL_WIDTH_MM}mm; margin: 0; padding: 0; }
        .thermal-one {
          display: block;
          width: ${THERMAL_WIDTH_MM}mm;
          margin: 0 0 4mm;
          padding: 0;
          page-break-after: always;
          break-after: page;
        }
        .thermal-one:last-child {
          page-break-after: auto;
          break-after: auto;
          margin-bottom: 0;
        }
      </style></head><body><div class="thermal-strip" id="strip"></div></body></html>`,
    );
    doc.close();

    const strip = doc.getElementById("strip");
    const clones = receipts.map((src) => {
      const wrap = doc.createElement("div");
      wrap.className = "thermal-one";
      const clone = src.cloneNode(true);
      clone.classList.remove("thermal-receipt-preview");
      clone.style.cssText = `display:block;width:${THERMAL_WIDTH_MM}mm;max-width:${THERMAL_WIDTH_MM}mm;margin:0;padding:1mm 1mm 0;background:#fff;box-sizing:border-box;height:auto;min-height:0;`;
      wrap.appendChild(clone);
      strip.appendChild(wrap);
      return clone;
    });

    await new Promise((r) => setTimeout(r, 450));

    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvases = [];
      for (const clone of clones) {
        canvases.push(await captureThermalNode(clone, html2canvas));
      }
      await printThermalCanvases(canvases);
      cleanupThermalFrame(frame);
    } catch (err) {
      console.warn("thermal print-all capture failed:", err);
      const pageStyle = doc.createElement("style");
      // One ticket page per copy; content top-aligned (no mid-receipt split)
      pageStyle.textContent = `@page { size: ${THERMAL_WIDTH_MM}mm ${THERMAL_TICKET_MM}mm; margin: 0; }
        html, body { margin: 0; padding: 0; }`;
      doc.head.appendChild(pageStyle);
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => cleanupThermalFrame(frame), 1500);
    }
  };

  void run();
}
