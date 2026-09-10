import React from "react";
import moment from "moment";

/** @typedef {'text' | 'logo'} DocumentHeaderStyle */

/**
 * Resolve which document header layout the business selected.
 * @param {object|null|undefined} business
 * @returns {DocumentHeaderStyle}
 */
export function getDocumentHeaderStyle(business) {
  const raw = String(business?.document_header_style || "text")
    .trim()
    .toLowerCase();
  return raw === "logo" ? "logo" : "text";
}

/** Receipts/invoices print in color when this business setting is on. */
export function getDocumentPrintInColor(business) {
  return Boolean(business?.sales_invoice_print_in_color);
}

function companyBits(business = {}) {
  return {
    name: business.business_name || business.name || "Company",
    rc: business.rc || business.registration_number || "",
    description: business.description || "",
    address: business.business_address || business.address || "",
    phone: business.business_phone || business.phone || "",
    fax: business.fax || "",
    email: business.business_email || business.email || "",
    logo: business.business_logo || "",
  };
}

/**
 * Shared HTML document/print header used across receipts, invoices, and reports.
 * Style is chosen in Settings → Header Settings (`document_header_style`: text | logo).
 * Print ink is chosen there too (`sales_invoice_print_in_color`): color | black and white.
 * Color comes from CSS `--aa-doc-header` (defaults to `--aa-navy`) so one token controls the system.
 */
export default function BusinessDocumentHeader({
  business,
  title = "DOCUMENT",
  numberLabel,
  date,
  dateFormat = "DD MMM, YYYY",
  extraLine,
  warehouse,
  forceStyle,
  forcePrintInColor,
  className = "",
  compact = false,
}) {
  const style = forceStyle || getDocumentHeaderStyle(business);
  const inColor =
    typeof forcePrintInColor === "boolean"
      ? forcePrintInColor
      : getDocumentPrintInColor(business);
  const c = companyBits(business);
  const showLogo = style === "logo" && Boolean(c.logo);
  const pad = compact ? "px-2 py-1.5" : "px-3 py-3";
  const dateText = date
    ? moment(date).isValid()
      ? moment(date).format(dateFormat)
      : String(date)
    : moment().format(dateFormat);

  const telLine = c.phone ? `Tel: ${c.phone}` : "";
  const faxEmailLine = [c.fax ? `Fax: ${c.fax}` : null, c.email ? `Email: ${c.email}` : null]
    .filter(Boolean)
    .join(" | ");

  const warehouseText = String(warehouse || "").trim();
  const muted = inColor ? "text-white/80" : "text-black/75";
  const strong = inColor ? "text-white" : "text-black";
  const box = inColor
    ? "border-white/35 bg-white/10"
    : "border-black bg-transparent";
  const logoFrame = inColor ? "border-white" : "border-black";

  return (
    <div
      className={`border-2 p-[3px] mb-1.5 ${
        inColor
          ? "border-[var(--aa-navy,#1a2d5e)]"
          : "border-black doc-header-bw"
      }`}
    >
      <div
        className={`${
          inColor
            ? "bg-[var(--aa-doc-header,var(--aa-navy,#1a2d5e))] text-white border-[var(--aa-accent,#e8a317)] print:bg-[var(--aa-doc-header,var(--aa-navy,#1a2d5e))]"
            : "bg-white text-black border-black print:bg-white"
        } ${pad} border-2 overflow-hidden ${className}`}
      >
        <div
          className={`flex flex-row items-stretch justify-between ${
            compact ? "gap-1.5" : "gap-2.5"
          }`}
        >
          <div
            className={`min-w-0 flex-1 ${
              showLogo ? "flex items-start" : ""
            } ${compact ? "gap-2" : "gap-3"}`}
          >
            {showLogo && (
              <div
                className={`shrink-0 overflow-hidden border-2 bg-white ${logoFrame} ${
                  compact ? "p-0.5" : "p-1"
                }`}
              >
                <img
                  src={c.logo}
                  alt=""
                  className={`${
                    compact
                      ? "h-[4.5rem] w-[4.5rem] object-contain"
                      : "h-[6.25rem] w-[6.25rem] object-contain"
                  }${inColor ? "" : " grayscale contrast-125"}`}
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div
                className={`flex flex-nowrap items-start ${
                  compact ? "gap-x-1" : "gap-x-1.5"
                }`}
              >
                <h1
                  className={`font-bold uppercase tracking-wide leading-[1.05] ${
                    compact ? "text-base" : "text-2xl sm:text-[1.7rem]"
                  }`}
                >
                  {c.name}
                </h1>
                {c.rc ? (
                  <p
                    className={`font-semibold ${muted} whitespace-nowrap align-top ${
                      compact ? "text-[7px] mt-0.5" : "text-[9px] mt-1"
                    }`}
                  >
                    RC. {c.rc}
                  </p>
                ) : null}
              </div>
              {c.description ? (
                <p
                  className={`italic ${muted} ${
                    compact
                      ? "text-[11px] leading-snug mt-0.5 line-clamp-2"
                      : "text-base mt-1"
                  }`}
                >
                  {c.description}
                </p>
              ) : null}
              {c.address ? (
                <p
                  className={`${muted} ${
                    compact ? "text-[11px] leading-snug mt-0.5" : "text-base mt-1"
                  }`}
                >
                  {c.address}
                </p>
              ) : null}
              {telLine ? (
                <p
                  className={`${muted} ${
                    compact ? "text-[10px] leading-snug mt-0.5" : "text-[15px] mt-1"
                  }`}
                >
                  {telLine}
                </p>
              ) : null}
              {faxEmailLine ? (
                <p
                  className={`${muted} ${
                    compact ? "text-[10px] leading-snug" : "text-[15px]"
                  }`}
                >
                  {faxEmailLine}
                </p>
              ) : null}
            </div>
          </div>

          <div
            className={`flex flex-col items-stretch shrink-0 ${
              compact
                ? "w-[22%] min-w-[4.75rem] max-w-[6rem] gap-0.5"
                : "w-[7rem] sm:w-[7.75rem] gap-0.5"
            }`}
          >
            <div
              className={`w-full text-center border-2 ${box} ${
                compact ? "px-0.5 py-0.5" : "px-1 py-1"
              }`}
            >
              <p
                className={`font-bold uppercase ${strong} leading-[1.1] text-balance ${
                  compact ? "text-[9px] tracking-wide" : "text-xs tracking-wide"
                }`}
              >
                {title}
              </p>
              {numberLabel ? (
                <p
                  className={`font-bold leading-tight ${strong} ${
                    compact ? "text-[8px] mt-0.5" : "text-[11px] mt-0.5"
                  }`}
                >
                  {numberLabel}
                </p>
              ) : null}
              {warehouseText ? (
                <p
                  className={`${strong} leading-tight break-words ${
                    compact ? "text-[7px] mt-0.5" : "text-[9px] mt-0.5"
                  }`}
                >
                  <span className={`font-semibold ${muted}`}>Warehouse: </span>
                  <span className="font-bold">{warehouseText}</span>
                </p>
              ) : null}
              {extraLine && !warehouseText ? (
                <p
                  className={`${inColor ? "text-white/90" : "text-black/80"} leading-tight ${
                    compact ? "text-[7px] mt-0.5" : "text-[9px] mt-0.5"
                  }`}
                >
                  {extraLine}
                </p>
              ) : null}
            </div>
            <p
              className={`text-right font-semibold ${strong} ${
                compact ? "text-[9px]" : "text-xs"
              }`}
            >
              Date: {dateText}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact preview cards for Header Settings. */
export function DocumentHeaderPreview({ style, business, printInColor }) {
  return (
    <div className="pointer-events-none select-none scale-[0.92] origin-top-left w-[108%]">
      <BusinessDocumentHeader
        business={business}
        forceStyle={style}
        forcePrintInColor={printInColor}
        title="PAYMENT RECEIPT"
        numberLabel="No: PR-EXAMPLE"
        date={new Date()}
        compact
      />
    </div>
  );
}

/** 80mm thermal receipt header preview (Header Settings). */
export function ThermalDocumentHeaderPreview({
  business,
  showLogo = false,
  printInColor = false,
}) {
  const c = companyBits(business);
  const telLine = c.phone ? `Tel: ${c.phone}` : "";
  const faxEmailLine = [c.fax ? `Fax: ${c.fax}` : null, c.email ? `Email: ${c.email}` : null]
    .filter(Boolean)
    .join(" | ");
  const dateText = moment().format("DD/MM/YYYY HH:mm");

  return (
    <div
      className="mx-auto bg-white text-black"
      style={{
        width: "80mm",
        maxWidth: "100%",
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "13px",
        lineHeight: 1.25,
        padding: "6px 8px 8px",
        boxSizing: "border-box",
      }}
    >
      {showLogo && c.logo ? (
        <div className="mb-1 flex justify-center">
          <img
            src={c.logo}
            alt=""
            className={`h-12 w-12 object-contain ${
              printInColor ? "" : "grayscale contrast-125"
            }`}
          />
        </div>
      ) : null}
      <div className="text-center text-[15px] font-bold uppercase leading-tight">
        {c.name}
      </div>
      {c.rc ? (
        <div className="text-center text-[10px] opacity-80">RC. {c.rc}</div>
      ) : null}
      {c.description ? (
        <div className="text-center text-[11px] italic opacity-90">
          {c.description}
        </div>
      ) : null}
      {c.address ? (
        <div className="text-center text-[11px] opacity-90">{c.address}</div>
      ) : null}
      {telLine ? (
        <div className="text-center text-[11px] opacity-90">{telLine}</div>
      ) : null}
      {faxEmailLine ? (
        <div className="text-center text-[10px] opacity-90">{faxEmailLine}</div>
      ) : null}
      <div
        className="my-1.5"
        style={{ borderTop: "1px dashed #111" }}
      />
      <div className="text-center text-[12px] font-bold">PAYMENT RECEIPT</div>
      <div className="text-[11px]">No: PR-EXAMPLE</div>
      <div className="text-[11px]">Date: {dateText}</div>
      <div
        className="my-1.5"
        style={{ borderTop: "1px dashed #111" }}
      />
      <div className="flex justify-between text-[11px]">
        <span>Rice 50kg × 2</span>
        <span>99,000.00</span>
      </div>
      <div className="mt-1 flex justify-between text-[13px] font-bold">
        <span>Total</span>
        <span>99,000.00</span>
      </div>
      <div
        className="my-1.5"
        style={{ borderTop: "1px dashed #111" }}
      />
      <div className="text-center text-[11px] opacity-80">Thank you</div>
    </div>
  );
}
