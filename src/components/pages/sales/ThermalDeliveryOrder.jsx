import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import QRCode from "qrcode";
import {
  captureThermalNode,
  printThermalCanvases,
} from "./ThermalReceipt";

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

/** Compact black bitmap label — thermal printers often skip CSS fills / white text. */
function buildFeedbackLabelDataUrl() {
  const width = 360;
  const height = 160;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 28px 'Courier New', Courier, monospace";
  ctx.fillText("Scan for feedback", width / 2, height / 2 - 18);
  ctx.font = "bold 22px 'Courier New', Courier, monospace";
  ctx.fillText("ashiru-ali.com", width / 2, height / 2 + 20);
  return canvas.toDataURL("image/png");
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
  const [feedbackQr, setFeedbackQr] = useState("");
  const [feedbackLabelImg, setFeedbackLabelImg] = useState("");

  const isGoodsIssue =
    String(documentType || "")
      .toLowerCase()
      .replace(/-/g, "_") === "goods_issue_note";

  const saleCode = useMemo(() => {
    if (!invoiceData) return "";
    return String(
      invoiceData.sale_code ||
        invoiceData.transaction?.id ||
        invoiceData.invoice_ref ||
        "",
    );
  }, [invoiceData]);

  const feedbackUrl = useMemo(() => {
    if (!isGoodsIssue) return "";
    const businessId =
      business?.id ||
      invoiceData?.business?.id ||
      invoiceData?.facility_id ||
      invoiceData?.facilityId ||
      "";
    if (!businessId) return "";
    const params = new URLSearchParams();
    params.set("businessId", String(businessId));
    if (saleCode) params.set("sale_code", saleCode);
    const custNo = customer?.customerNo || customer?.account_no || "";
    const custName =
      customer?.customer_name || customer?.name || customer?.fullname || "";
    if (custNo) params.set("customerNo", String(custNo));
    if (custName) params.set("customerName", String(custName));
    return `https://ashiru-ali.com/feedback?${params.toString()}`;
  }, [isGoodsIssue, business, invoiceData, saleCode, customer]);

  useEffect(() => {
    let cancelled = false;
    if (!feedbackUrl) {
      setFeedbackQr("");
      setFeedbackLabelImg("");
      return undefined;
    }
    // Render label as a black bitmap — thermal printers drop CSS black fills,
    // so white-on-black HTML text vanishes; an image prints like the QR.
    setFeedbackLabelImg(buildFeedbackLabelDataUrl());
    QRCode.toDataURL(feedbackUrl, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setFeedbackQr(url);
      })
      .catch(() => {
        if (!cancelled) setFeedbackQr("");
      });
    return () => {
      cancelled = true;
    };
  }, [feedbackUrl]);

  if (!invoiceData) return null;

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
  const docNumber = `${docPrefix}-${saleCode || "—"}`;
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
          color: #000 !important;
          background: #fff !important;
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .thermal-do-root .tr-center { text-align: center; }
        .thermal-do-root .tr-bold { font-weight: 700; color: #000; }
        .thermal-do-root .tr-divider {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .thermal-do-root .tr-muted {
          font-size: 12px;
          color: #000;
          opacity: 1;
        }
        .thermal-do-root .tr-business-name {
          font-size: 15px;
          font-weight: 700;
          line-height: 1.2;
          color: #000;
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
          color: #000;
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
          color: #000;
        }
        .thermal-do-root .tr-note {
          font-size: 11px;
          margin-top: 4px;
          line-height: 1.35;
          font-style: italic;
          text-align: center;
          color: #000;
        }
        /* Compact feedback strip — QR + label, no tall empty box */
        .thermal-do-root .tr-feedback {
          margin-top: 4px;
          display: flex;
          flex-direction: row;
          align-items: stretch;
          width: 100%;
          height: 28mm;
          max-height: 28mm;
          gap: 0;
          padding: 0;
          overflow: hidden;
          background: #fff;
          border: 1.5px solid #000;
          box-sizing: border-box;
          line-height: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .thermal-do-root .tr-feedback-qr {
          flex: 0 0 28mm;
          width: 28mm;
          height: 28mm;
          margin: 0;
          padding: 0;
          background: #fff;
          border-right: 1.5px solid #000;
          box-sizing: border-box;
          line-height: 0;
        }
        .thermal-do-root .tr-feedback-qr img {
          display: block;
          width: 26mm;
          height: 26mm;
          margin: 1mm;
          padding: 0;
          border: 0;
          object-fit: contain;
          vertical-align: top;
        }
        .thermal-do-root .tr-feedback-label {
          flex: 1 1 auto;
          min-width: 0;
          height: 28mm;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          background: #fff;
          line-height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .thermal-do-root .tr-feedback-label img {
          display: block;
          width: 100%;
          height: 22mm;
          max-height: 22mm;
          margin: 0;
          padding: 0;
          border: 0;
          object-fit: contain;
        }
      `}</style>

      <div
        className={`thermal-do-root thermal-delivery-order-root${
          preview ? " thermal-do-preview" : ""
        }`}
        data-receipt-variant={
          isGoodsIssue ? "goods-issue-note" : "delivery-order"
        }
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
          ).format("DD/MM/YYYY hh:mm A")}
        </div>
        {warehouse ? <div>Warehouse: {warehouse}</div> : null}
        <div>Invoice: {saleCode || "—"}</div>

        <div className="tr-divider" />

        <div className="tr-bold">
          {isGoodsIssue ? "Issue To" : "Deliver To"}
        </div>
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
            <div className="tr-divider" />
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

        {isGoodsIssue && feedbackQr ? (
          <div className="tr-feedback">
            <div className="tr-feedback-qr">
              <img src={feedbackQr} alt="Feedback QR code" />
            </div>
            {feedbackLabelImg ? (
              <div className="tr-feedback-label">
                <img
                  src={feedbackLabelImg}
                  alt="Scan for feedback — ashiru-ali.com"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const THERMAL_WIDTH_MM = 72;

const THERMAL_DO_IFRAME_CSS = `
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: ${THERMAL_WIDTH_MM}mm !important;
    max-width: ${THERMAL_WIDTH_MM}mm !important;
    height: auto !important;
    min-height: 0 !important;
    background: #fff !important;
    color: #000 !important;
    overflow: hidden !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body {
    font-family: "Courier New", Courier, monospace;
    font-size: 15px;
    font-weight: 400;
    line-height: 1.25;
  }
  * {
    color: #000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .thermal-do-root, .thermal-delivery-order-root {
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
  .tr-bold { font-weight: 700; color: #000 !important; }
  .tr-divider { border-top: 1px dashed #000; margin: 4px 0; }
  .tr-muted { font-size: 12px; color: #000 !important; opacity: 1; }
  .tr-business-name { font-size: 15px; font-weight: 700; line-height: 1.2; color: #000 !important; }
  .tr-items { width: 100%; border-collapse: collapse; }
  .tr-items th, .tr-items td { padding: 1px 0; vertical-align: top; font-size: 14px; color: #000 !important; }
  .tr-items th { border-bottom: 1px solid #000; font-size: 12px; }
  .tr-items .tr-qty { width: 22%; text-align: right; }
  .tr-line { border-bottom: 1px solid #000; min-height: 16px; margin: 2px 0 6px; }
  .tr-field { margin-top: 4px; color: #000 !important; }
  .tr-note {
    font-size: 11px;
    margin-top: 4px;
    line-height: 1.35;
    font-style: italic;
    text-align: center;
    color: #000 !important;
  }
  .tr-feedback {
    margin-top: 4px;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    width: 100%;
    height: 28mm;
    max-height: 28mm;
    gap: 0;
    padding: 0;
    overflow: hidden;
    background: #fff !important;
    border: 1.5px solid #000 !important;
    box-sizing: border-box;
    line-height: 0;
  }
  .tr-feedback-qr {
    flex: 0 0 28mm;
    width: 28mm;
    height: 28mm;
    margin: 0;
    padding: 0;
    background: #fff !important;
    border-right: 1.5px solid #000 !important;
    box-sizing: border-box;
    line-height: 0;
  }
  .tr-feedback-qr img {
    display: block;
    width: 26mm;
    height: 26mm;
    margin: 1mm;
    padding: 0;
    border: 0;
    object-fit: contain;
  }
  .tr-feedback-label {
    flex: 1 1 auto;
    min-width: 0;
    height: 28mm;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    background: #fff !important;
    line-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tr-feedback-label img {
    display: block;
    width: 100%;
    height: 22mm;
    max-height: 22mm;
    margin: 0;
    padding: 0;
    border: 0;
    object-fit: contain;
  }
`;

function waitForImages(root) {
  const imgs = Array.from(root.querySelectorAll("img"));
  if (imgs.length === 0) return Promise.resolve();
  return Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          }),
    ),
  );
}

function cleanupDoPrintFrame(frame) {
  if (!frame) return;
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
}

/** Print on-page thermal Delivery Order / Goods Issue Note slip(s). */
export function printThermalDeliveryOrder() {
  const nodes = Array.from(
    document.querySelectorAll(".thermal-delivery-order-root, .thermal-do-root"),
  ).filter((el, idx, arr) => arr.indexOf(el) === idx);
  if (!nodes.length) {
    window.print();
    return;
  }

  const run = async () => {
    let frame = document.getElementById("thermal-print-frame");
    if (frame) frame.remove();
    frame = document.createElement("iframe");
    frame.id = "thermal-print-frame";
    frame.setAttribute("title", "Thermal dispatch print");
    document.body.appendChild(frame);
    frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${THERMAL_WIDTH_MM}mm;height:auto;min-height:0;border:0;opacity:1;pointer-events:none;z-index:-1;`;

    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Dispatch Slip</title><style>${THERMAL_DO_IFRAME_CSS}</style></head><body></body></html>`,
    );
    doc.close();

    const clones = nodes.map((node) => {
      const clone = node.cloneNode(true);
      clone.classList.remove("thermal-do-preview");
      clone.style.cssText = `display:block;width:${THERMAL_WIDTH_MM}mm;max-width:${THERMAL_WIDTH_MM}mm;margin:0;padding:1mm 1mm 0;background:#fff;box-sizing:border-box;height:auto;min-height:0;font-family:"Courier New",Courier,monospace;font-size:15px;line-height:1.25;color:#000;`;
      doc.body.appendChild(clone);
      return clone;
    });

    await Promise.all(clones.map((clone) => waitForImages(clone)));
    await new Promise((r) => setTimeout(r, 350));

    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvases = [];
      for (const clone of clones) {
        canvases.push(await captureThermalNode(clone, html2canvas));
      }
      await printThermalCanvases(canvases);
      cleanupDoPrintFrame(frame);
    } catch (err) {
      console.warn("thermal DO capture failed, HTML print:", err);
      const mmHeights = clones.map((clone) =>
        Math.max(35, Math.ceil((clone.scrollHeight * 25.4) / 96) + 2),
      );
      const pageH = Math.max(...mmHeights);
      const pageStyle = doc.createElement("style");
      pageStyle.textContent = `@page { size: ${THERMAL_WIDTH_MM}mm ${pageH}mm; margin: 0; }
        html, body { margin: 0; padding: 0; height: auto; }`;
      doc.head.appendChild(pageStyle);
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => cleanupDoPrintFrame(frame), 1500);
    }
  };

  void run();
}
