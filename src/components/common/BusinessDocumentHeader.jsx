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
  const pad = compact ? "px-2 py-1.5" : "p-2.5";
  const dateText = date
    ? moment(date).isValid()
      ? moment(date).format(dateFormat)
      : String(date)
    : moment().format(dateFormat);

  const contactLine = [
    c.phone ? `Tel: ${c.phone}` : null,
    c.fax ? `Fax: ${c.fax}` : null,
    c.email ? `Email: ${c.email}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const warehouseText = String(warehouse || "").trim();

  // A5 / compact previews are often < sm breakpoint — always keep side-by-side.
  const rowClass = compact
    ? "flex flex-row items-start justify-between gap-2"
    : "flex flex-col gap-3 md:flex-row md:items-start md:justify-between";

  return (
    <div
      className={`bg-[var(--aa-doc-header,var(--aa-navy,#1a2d5e))] text-white ${pad} mb-1.5 shadow-md print:bg-[var(--aa-doc-header,var(--aa-navy,#1a2d5e))] ${className}`}
    >
      <div className={rowClass}>
        <div
          className={`min-w-0 ${compact ? "flex-[1.4]" : "flex-1"} ${
            showLogo ? "flex gap-2 items-start" : ""
          }`}
        >
          {showLogo && (
            <div
              className={`shrink-0 bg-white rounded-md shadow-sm ${
                compact ? "p-0.5" : "p-1.5"
              }`}
            >
              <img
                src={c.logo}
                alt=""
                className={
                  compact ? "h-9 w-9 object-contain" : "h-16 w-16 object-contain"
                }
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
              <h1
                className={`font-bold uppercase tracking-wide leading-tight ${
                  compact ? "text-[11px] sm:text-sm" : "text-xl sm:text-2xl"
                }`}
              >
                {c.name}
              </h1>
              {c.rc ? (
                <span
                  className={`font-semibold text-white/85 whitespace-nowrap ${
                    compact ? "text-[9px]" : "text-sm"
                  }`}
                >
                  RC. {c.rc}
                </span>
              ) : null}
            </div>
            {c.description ? (
              <p
                className={`italic text-white/80 ${
                  compact
                    ? "text-[9px] leading-snug mt-0.5 line-clamp-2"
                    : "text-sm mt-0.5"
                }`}
              >
                {c.description}
              </p>
            ) : null}
            {c.address ? (
              <p
                className={`text-white/75 ${
                  compact
                    ? "text-[8px] leading-snug mt-0.5"
                    : "text-xs mt-1"
                }`}
              >
                {c.address}
              </p>
            ) : null}
            {contactLine ? (
              <p
                className={`text-white/75 ${
                  compact
                    ? "text-[8px] leading-snug mt-0.5"
                    : "text-xs mt-0.5"
                }`}
              >
                {contactLine}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className={`flex flex-col items-end shrink-0 text-right ${
            compact ? "w-[38%] min-w-[7.5rem] gap-1" : "md:min-w-[200px] gap-1.5"
          }`}
        >
          <div
            className={`w-full rounded-sm bg-white/15 text-center border border-white/20 ${
              compact ? "px-1.5 py-1.5" : "px-2 py-2"
            }`}
          >
            <p
              className={`font-bold uppercase text-white ${
                compact
                  ? "text-[10px] tracking-[0.12em] leading-tight"
                  : "text-xs tracking-[0.2em]"
              }`}
            >
              {title}
            </p>
            {numberLabel ? (
              <p
                className={`mt-1 font-bold leading-tight text-white ${
                  compact ? "text-xs" : "text-lg"
                }`}
              >
                {numberLabel}
              </p>
            ) : null}
            {warehouseText ? (
              <p
                className={`mt-1 text-white/90 leading-tight ${
                  compact ? "text-[9px]" : "text-sm"
                }`}
              >
                <span className="font-semibold text-white/70">Warehouse:</span>{" "}
                <span className="font-semibold">{warehouseText}</span>
              </p>
            ) : null}
            {extraLine && !warehouseText ? (
              <p
                className={`mt-1 text-white/85 ${
                  compact ? "text-[9px]" : "text-sm"
                }`}
              >
                {extraLine}
              </p>
            ) : null}
          </div>
          <p
            className={`font-semibold text-white/90 ${
              compact ? "text-[9px]" : "text-sm"
            }`}
          >
            Date: {dateText}
          </p>
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
