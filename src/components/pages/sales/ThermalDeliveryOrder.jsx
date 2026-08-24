import moment from "moment";

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

function getDeliveryItems(invoiceData) {
  const source =
    Array.isArray(invoiceData?.deliveryItems) &&
    invoiceData.deliveryItems.length > 0
      ? invoiceData.deliveryItems
      : Array.isArray(invoiceData?.items)
        ? invoiceData.items
        : [];

  return source.filter((item) => {
    const type = String(item?.type || "").toLowerCase();
    const itemType = String(item?.item_type || "").toLowerCase();
    const label = String(
      item?.item_name || item?.description || item?.name || "",
    ).toLowerCase();
    if (type.includes("service") || itemType === "service") return false;
    if (label.includes("delivery charge")) return false;
    return true;
  });
}

/**
 * 80mm thermal Delivery Order / Goods Issue Note (qty only — no prices).
 */
export default function ThermalDeliveryOrder({
  invoiceData,
  business = {},
  customer = {},
  preview = false,
  documentType = "delivery_order",
  importantNote = "",
  preparedBy = "",
}) {
  if (!invoiceData) return null;

  const isGoodsIssue =
    String(documentType || "")
      .toLowerCase()
      .replace(/-/g, "_") === "goods_issue_note";
  const docTitle = isGoodsIssue ? "GOODS ISSUE NOTE" : "DELIVERY ORDER";
  const docPrefix = isGoodsIssue ? "GIN" : "DO";
  const DEFAULT_GIN_NOTE =
    "Thank you for patronizing us. We look forward to your return and to continuing to do business with you.";
  const noteText = String(
    importantNote !== undefined && importantNote !== null
      ? importantNote
      : DEFAULT_GIN_NOTE,
  ).trim();
  const showNote = isGoodsIssue && noteText.length > 0;
  const preparedByName =
    String(preparedBy || "").trim() ||
    invoiceData?.user?.name ||
    [invoiceData?.user?.firstname, invoiceData?.user?.lastname]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "—";

  const items = getDeliveryItems(invoiceData);
  const totalQty = items.reduce(
    (sum, item) =>
      sum + Number(item.quantity_sold ?? item.qty ?? item.quantity ?? 0),
    0,
  );
  const saleCode =
    invoiceData.sale_code ||
    invoiceData.transaction?.id ||
    invoiceData.invoice_ref ||
    "—";
  const docNumber = `${docPrefix}-${saleCode}`;
  const warehouse =
    invoiceData.branch_name ||
    invoiceData.warehouse_name ||
    invoiceData.store_name ||
    "";

  return (
    <div
      className={`thermal-do-set${preview ? " thermal-do-set-preview" : ""}`}
    >
      <style>{`
        .thermal-do-set { display: none; }
        .thermal-do-set.thermal-do-set-preview {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .thermal-do-root {
          display: none;
        }
        .thermal-do-root.thermal-do-preview {
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
        .thermal-do-root .tr-center { text-align: center; }
        .thermal-do-root .tr-bold { font-weight: 700; }
        .thermal-do-root .tr-divider {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .thermal-do-root .tr-muted {
          font-size: 12px;
          opacity: 0.9;
        }
        .thermal-do-root .tr-business-name {
          font-size: 15px;
          font-weight: 700;
          line-height: 1.2;
        }
        .thermal-do-root .tr-items {
          width: 100%;
          border-collapse: collapse;
        }
        .thermal-do-root .tr-items th,
        .thermal-do-root .tr-items td {
          padding: 2px 0;
          vertical-align: top;
          font-size: 14px;
        }
        .thermal-do-root .tr-items th {
          border-bottom: 1px solid #000;
          font-size: 12px;
        }
        .thermal-do-root .tr-items .tr-qty {
          width: 22%;
          text-align: right;
        }
        .thermal-do-root .tr-line {
          border-bottom: 1px solid #000;
          min-height: 14px;
          margin: 1px 0 8px;
        }
        .thermal-do-root .tr-field {
          margin-top: 6px;
        }
        .thermal-do-root .tr-note {
          font-size: 11px;
          margin-top: 4px;
          line-height: 1.35;
          font-style: italic;
          text-align: center;
        }
      `}</style>

      <div
        className={`thermal-do-root thermal-delivery-order-root${
          preview ? " thermal-do-preview" : ""
        }`}
        data-receipt-variant={isGoodsIssue ? "goods-issue-note" : "delivery-order"}
      >
        <div className="tr-center tr-bold tr-business-name">
          {business.business_name || docTitle}
        </div>
        {business.business_address && (
          <div className="tr-center tr-muted">{business.business_address}</div>
        )}
        {business.business_phone && (
          <div className="tr-center tr-muted">
            Tel: {business.business_phone}
          </div>
        )}

        <div className="tr-divider" />

        <div className="tr-center tr-bold">{docTitle}</div>
        <div>No: {docNumber}</div>
        <div>
          Date:{" "}
          {moment(
            invoiceData.date || invoiceData.transaction_date || undefined,
          ).format("DD/MM/YYYY HH:mm")}
        </div>
        {warehouse ? <div>Warehouse: {warehouse}</div> : null}
        <div>Invoice: {saleCode}</div>

        <div className="tr-divider" />

        <div className="tr-bold">{isGoodsIssue ? "Issue To" : "Deliver To"}</div>
        <div>{customer.customer_name || customer.fullname || "Walk-in"}</div>
        {customer.customerNo || customer.account_no ? (
          <div className="tr-muted">
            Acct: {customer.customerNo || customer.account_no}
          </div>
        ) : null}
        {customer.phone ? <div>{customer.phone}</div> : null}
        {customer.address ? (
          <div className="tr-muted">{customer.address}</div>
        ) : null}

        <div className="tr-divider" />

        <table className="tr-items">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Item</th>
              <th className="tr-qty">Qty</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id ?? item.entry_id ?? idx}>
                <td>
                  {item.item_name ||
                    item.description ||
                    item.name ||
                    item.product_name ||
                    "Item"}
                </td>
                <td className="tr-qty">
                  {formatThermalNumber(
                    item.quantity_sold ?? item.qty ?? item.quantity ?? 0,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="tr-divider" />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span className="tr-bold">Total Qty</span>
          <span className="tr-bold">{formatThermalNumber(totalQty)}</span>
        </div>

        <div className="tr-divider" />

        {!isGoodsIssue ? (
          <>
            <div className="tr-field">
              <div className="tr-muted">Vehicle No</div>
              <div className="tr-line" />
            </div>
            <div className="tr-field">
              <div className="tr-muted">Driver&apos;s Name</div>
              <div className="tr-line" />
            </div>
            <div className="tr-field">
              <div className="tr-muted">Received By (Name / Sign)</div>
              <div className="tr-line" />
              <div className="tr-line" />
            </div>
          </>
        ) : (
          <>
            <div className="tr-bold">Approval Details</div>
            <div className="tr-field">
              <div>
                Prepared: <span className="tr-bold">{preparedByName}</span>
              </div>
            </div>
          </>
        )}

        {showNote ? (
          <>
            <div className="tr-divider" />
            <div className="tr-note tr-center">{noteText}</div>
          </>
        ) : null}
      </div>
    </div>
  );
}

const THERMAL_WIDTH_MM = 72;

function ensureThermalPrintFrame() {
  let frame = document.getElementById("thermal-print-frame");
  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = "thermal-print-frame";
    frame.setAttribute(
      "style",
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;",
    );
    document.body.appendChild(frame);
  }
  return frame;
}

/** Print on-page thermal Delivery Order / Goods Issue Note slip(s). */
export function printThermalDeliveryOrder() {
  const nodes = Array.from(
    document.querySelectorAll(
      ".thermal-delivery-order-root, .thermal-do-root",
    ),
  ).filter((el, idx, arr) => arr.indexOf(el) === idx);
  if (!nodes.length) {
    window.print();
    return;
  }

  const frame = ensureThermalPrintFrame();
  const doc = frame.contentDocument || frame.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(`<!doctype html><html><head><title>Dispatch Slip</title>
    <style>
      @page { size: ${THERMAL_WIDTH_MM}mm auto; margin: 0; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: ${THERMAL_WIDTH_MM}mm !important;
        background: #fff !important;
      }
      .tr-center { text-align: center; }
      .tr-bold { font-weight: 700; }
      .tr-divider { border-top: 1px dashed #000; margin: 4px 0; }
      .tr-muted { font-size: 12px; opacity: 0.9; }
      .tr-business-name { font-size: 15px; font-weight: 700; line-height: 1.2; }
      .tr-items { width: 100%; border-collapse: collapse; }
      .tr-items th, .tr-items td { padding: 1px 0; vertical-align: top; font-size: 14px; }
      .tr-items th { border-bottom: 1px solid #000; font-size: 12px; }
      .tr-items .tr-qty { width: 22%; text-align: right; }
      .tr-line { border-bottom: 1px solid #000; min-height: 16px; margin: 2px 0 6px; }
      .tr-field { margin-top: 4px; }
      .tr-note {
        font-size: 11px;
        margin-top: 4px;
        line-height: 1.35;
        font-style: italic;
        text-align: center;
      }
      .thermal-cut-mark {
        display: block;
        width: ${THERMAL_WIDTH_MM}mm;
        margin: 2mm 0 3mm;
        text-align: center;
        font-family: "Courier New", Courier, monospace;
        font-size: 10px;
      }
      .thermal-cut-mark::before {
        content: "- - - - - cut here - - - - -";
        display: block;
      }
    </style></head><body></body></html>`);
  doc.close();

  nodes.forEach((node, idx) => {
    const clone = node.cloneNode(true);
    clone.classList.remove("thermal-do-preview");
    clone.style.display = "block";
    clone.style.width = `${THERMAL_WIDTH_MM}mm`;
    clone.style.maxWidth = `${THERMAL_WIDTH_MM}mm`;
    clone.style.margin = "0";
    clone.style.padding = "1mm";
    clone.style.fontFamily = '"Courier New", Courier, monospace';
    clone.style.fontSize = "15px";
    clone.style.lineHeight = "1.25";
    clone.style.color = "#000";
    clone.style.background = "#fff";
    clone.style.boxSizing = "border-box";
    doc.body.appendChild(clone);
    if (idx < nodes.length - 1) {
      const cut = doc.createElement("div");
      cut.className = "thermal-cut-mark";
      cut.setAttribute("aria-hidden", "true");
      doc.body.appendChild(cut);
    }
  });

  setTimeout(() => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch (err) {
      console.warn("thermal DO print failed:", err);
      window.print();
    }
  }, 250);
}
