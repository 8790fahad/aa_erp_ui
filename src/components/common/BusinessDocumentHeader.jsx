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

/** Last word on its own line for letterhead names like "ALH ALI MUHAMMAD YAMMUSA". */
function splitLetterheadName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 3) {
    return { primary: parts.join(" "), secondary: "" };
  }
  const secondary = parts.pop();
  return { primary: parts.join(" "), secondary };
}

/**
 * Shared HTML document/print header used across receipts, invoices, and reports.
 * Style is chosen in Settings → Header Settings (`document_header_style`: text | logo).
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
  className = "",
  compact = false,
}) {
  const style = forceStyle || getDocumentHeaderStyle(business);
  const c = companyBits(business);
  const showLogo = style === "logo" && Boolean(c.logo);
  const { primary: namePrimary, secondary: nameSecondary } = splitLetterheadName(
    c.name,
  );
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

  return (
    <div className="border-2 border-[var(--aa-navy,#1a2d5e)] p-[3px] mb-1.5">
      <div
        className={`bg-[var(--aa-doc-header,var(--aa-navy,#1a2d5e))] text-white ${pad} border-2 border-[var(--aa-accent,#e8a317)] overflow-hidden print:bg-[var(--aa-doc-header,var(--aa-navy,#1a2d5e))] ${className}`}
      >
        <div
          className={`flex flex-row items-stretch justify-between ${
            compact ? "gap-2" : "gap-4"
          }`}
        >
          <div
            className={`min-w-0 flex-1 ${
              showLogo ? "flex items-start" : ""
            } ${compact ? "gap-2" : "gap-3"}`}
          >
            {showLogo && (
              <div
                className={`shrink-0 overflow-hidden border-2 border-white bg-white ${
                  compact ? "p-0.5" : "p-1"
                }`}
              >
                <img
                  src={c.logo}
                  alt=""
                  className={
                    compact
                      ? "h-16 w-16 object-contain"
                      : "h-[5.5rem] w-[5.5rem] object-contain"
                  }
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1
                className={`font-bold uppercase tracking-wide leading-[1.05] ${
                  compact ? "text-sm" : "text-[1.65rem] sm:text-[1.85rem]"
                }`}
              >
                {namePrimary || c.name}
              </h1>
              {nameSecondary ? (
                <h2
                  className={`font-bold uppercase tracking-wide leading-tight ${
                    compact ? "text-xs mt-0" : "text-xl mt-0.5"
                  }`}
                >
                  {nameSecondary}
                </h2>
              ) : null}
              {c.rc ? (
                <p
                  className={`font-semibold text-white/90 ${
                    compact ? "text-[10px] mt-0.5" : "text-sm mt-1"
                  }`}
                >
                  RC. {c.rc}
                </p>
              ) : null}
              {c.description ? (
                <p
                  className={`italic text-white/85 ${
                    compact
                      ? "text-[9px] leading-snug mt-0.5 line-clamp-2"
                      : "text-[13px] mt-1"
                  }`}
                >
                  {c.description}
                </p>
              ) : null}
              {c.address ? (
                <p
                  className={`text-white/80 ${
                    compact ? "text-[9px] leading-snug mt-0.5" : "text-[13px] mt-1"
                  }`}
                >
                  {c.address}
                </p>
              ) : null}
              {telLine ? (
                <p
                  className={`text-white/80 ${
                    compact ? "text-[8px] leading-snug mt-0.5" : "text-[12px] mt-1"
                  }`}
                >
                  {telLine}
                </p>
              ) : null}
              {faxEmailLine ? (
                <p
                  className={`text-white/80 ${
                    compact ? "text-[8px] leading-snug" : "text-[12px]"
                  }`}
                >
                  {faxEmailLine}
                </p>
              ) : null}
            </div>
          </div>

          <div
            className={`flex flex-col items-stretch shrink-0 ${
              compact ? "w-[38%] min-w-[7.5rem] gap-1" : "w-[13.5rem] sm:w-[15rem] gap-1.5"
            }`}
          >
            <div
              className={`w-full text-center border-2 border-white/35 bg-white/10 ${
                compact ? "px-1.5 py-2" : "px-2.5 py-3"
              }`}
            >
              <p
                className={`font-bold uppercase text-white leading-tight ${
                  compact
                    ? "text-sm tracking-[0.14em]"
                    : "text-[1.35rem] tracking-[0.14em]"
                }`}
              >
                {title}
              </p>
              {numberLabel ? (
                <p
                  className={`font-bold leading-tight text-white ${
                    compact ? "text-xs mt-1" : "text-base mt-1.5"
                  }`}
                >
                  {numberLabel}
                </p>
              ) : null}
              {warehouseText ? (
                <p
                  className={`text-white leading-tight ${
                    compact ? "text-[9px] mt-1" : "text-[13px] mt-1.5"
                  }`}
                >
                  <span className="font-semibold text-white/75">Warehouse: </span>
                  <span className="font-bold">{warehouseText}</span>
                </p>
              ) : null}
              {extraLine && !warehouseText ? (
                <p
                  className={`text-white/90 ${
                    compact ? "text-[9px] mt-1" : "text-[13px] mt-1.5"
                  }`}
                >
                  {extraLine}
                </p>
              ) : null}
            </div>
            <p
              className={`text-right font-semibold text-white ${
                compact ? "text-[10px]" : "text-sm"
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
export function DocumentHeaderPreview({ style, business }) {
  return (
    <div className="pointer-events-none select-none scale-[0.92] origin-top-left w-[108%]">
      <BusinessDocumentHeader
        business={business}
        forceStyle={style}
        title={style === "logo" ? "PAYMENT RECEIPT" : "PAYMENT RECEIPT"}
        numberLabel="No: PR-EXAMPLE"
        date={new Date()}
        compact
      />
    </div>
  );
}
