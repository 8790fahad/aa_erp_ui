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
 */
export default function BusinessDocumentHeader({
  business,
  title = "DOCUMENT",
  numberLabel,
  date,
  dateFormat = "DD MMM, YYYY",
  extraLine,
  forceStyle,
  className = "",
  compact = false,
}) {
  const style = forceStyle || getDocumentHeaderStyle(business);
  const c = companyBits(business);
  const showLogo = style === "logo" && Boolean(c.logo);
  const pad = compact ? "p-2" : "p-2.5";
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

  return (
    <div
      className={`bg-blue-900 text-white ${pad} mb-1.5 shadow-md print:bg-blue-900 ${className}`}
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className={`flex-1 min-w-0 ${showLogo ? "flex gap-3 items-start" : ""}`}>
          {showLogo && (
            <div className="shrink-0 bg-white rounded-md p-1.5 shadow-sm">
              <img
                src={c.logo}
                alt=""
                className="h-16 w-16 object-contain"
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wide leading-tight">
                {c.name}
              </h1>
              {c.rc ? (
                <span className="text-blue-100 text-sm font-semibold">
                  RC. {c.rc}
                </span>
              ) : null}
            </div>
            {c.description ? (
              <p className="text-blue-100 text-sm italic mt-0.5">{c.description}</p>
            ) : null}
            {c.address ? (
              <p className="text-blue-100 text-xs mt-1">{c.address}</p>
            ) : null}
            {contactLine ? (
              <p className="text-blue-100 text-xs mt-0.5">{contactLine}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-1.5 text-right md:items-end shrink-0">
          <div className="bg-white/20 rounded-sm px-2 py-2 text-center md:min-w-[200px]">
            <p className="text-blue-100 text-xs uppercase tracking-[0.2em] font-semibold">
              {title}
            </p>
            {numberLabel ? (
              <p className="text-lg font-bold leading-tight mt-0.5">{numberLabel}</p>
            ) : null}
            {extraLine ? (
              <p className="text-sm text-blue-100 mt-1">{extraLine}</p>
            ) : null}
          </div>
          <p className="text-blue-100 text-sm font-semibold">Date: {dateText}</p>
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
