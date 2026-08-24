/* eslint-disable react/prop-types */
/**
 * Shared tax + discount controls for credit sale (card sidebar and lines view below table).
 */

import { Link } from "react-router-dom";

/** In-app routes for setup (see AppNavigation: Admin) */
const PATH_ADMIN_TAX = "/app/admin/tax";
const PATH_ADMIN_DISCOUNT_TABLE = "/app/admin/discount-table";
const PATH_ADMIN_SETTINGS = "/app/admin/settings";

function inlineSetupLink(to, children) {
  return (
    <Link
      to={to}
      className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
    >
      {children}
    </Link>
  );
}

function formatDiscountOptionLabel(discount) {
  const name = (discount.discount_name || "Discount").trim();
  const raw = parseFloat(discount.value);
  const num = Number.isFinite(raw) ? raw : 0;
  const isPercentage =
    discount.discount_type === "Percentage" ||
    String(discount.discount_type || "").toLowerCase() === "percentage";
  if (isPercentage) {
    return `${name} (${num}%)`;
  }
  const money = num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${name} (₦${money})`;
}

export default function CreditSaleTaxDiscountPanel({
  activeBusiness,
  filteredSalesTaxes,
  filteredOutputVATTaxes,
  selectedTaxes,
  setSelectedTaxes,
  selectedOutputVAT,
  setSelectedOutputVAT,
  availableDiscounts,
  selectedDiscount,
  handleDiscountSelect,
  clearDiscount,
  compact = false,
  /** Lines footer: `taxesOnly` | `discountOnly` in separate columns; `combined` = tax + discount grid */
  compactVariant = "combined",
}) {
  const regularTaxesForUi = filteredSalesTaxes.filter((tax) => {
    const description = (tax.description || "").toLowerCase();
    return !(
      description.includes("vat") ||
      description.includes("output vat") ||
      description.includes("value added tax")
    );
  });
  const hasTaxRows =
    regularTaxesForUi.length > 0 || filteredOutputVATTaxes.length > 0;
  const activeDiscounts = (availableDiscounts || []).filter(
    (d) => d.status === "active",
  );
  const taxesMainTitle =
    filteredOutputVATTaxes.length > 0 && regularTaxesForUi.length === 0
      ? "Output VAT"
      : "VAT";

  const discountEmptyOnly = activeDiscounts.length === 0;

  const wrap = compact
    ? "rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
    : "border-b border-blue-100";

  const taxesBlock = (
      <div
        className={`bg-gradient-to-r from-blue-50 to-indigo-50/80 ${wrap} ${
          compact
            ? hasTaxRows
              ? "min-w-0 px-4 py-3"
              : "min-w-0 px-3 py-2.5"
            : "px-4 py-2"
        }`}
      >
        <div className={compact ? (hasTaxRows ? "space-y-3" : "space-y-0") : "mb-1"}>
          <div
            className={
              compact
                ? "flex flex-col gap-3 w-full min-w-0"
                : "contents"
            }
          >
          {!hasTaxRows && (
            <div
              className="rounded-lg border border-amber-200/90 bg-amber-50/95 p-2.5 text-xs text-amber-950 shadow-sm"
              role="status"
            >
              <p className="mb-1 font-semibold text-amber-900 leading-tight">
                No taxes configured
              </p>
              <p className="leading-snug text-amber-900/95">
                Create taxes with category{" "}
                <strong className="font-semibold">Sales</strong> (and output VAT
                if you use it) in {inlineSetupLink(PATH_ADMIN_TAX, "Admin → Tax")}
                . How VAT is shown (inclusive vs exclusive) is controlled in{" "}
                {inlineSetupLink(
                  PATH_ADMIN_SETTINGS,
                  "Admin → Settings",
                )}
                .
              </p>
            </div>
          )}
          {hasTaxRows && (
            <h3 className="mb-2 border-b border-slate-200/80 pb-2 text-sm font-semibold text-slate-800">
              {taxesMainTitle}
            </h3>
          )}
          {regularTaxesForUi.length > 0 && (
            <div
              className={
                compact ? "space-y-3 w-full" : "mb-2 space-y-2"
              }
            >
              {filteredOutputVATTaxes.length > 0 && (
                <p className="text-xs font-medium text-slate-600">
                  Regular taxes
                </p>
              )}
              {regularTaxesForUi.map((tax) => {
                  const isSelected = selectedTaxes.some((t) => t.id === tax.id);
                  return (
                    <div
                      key={tax.id}
                      className={`flex items-center justify-between gap-3 bg-white rounded-lg border border-gray-200 ${
                        compact ? "px-3 py-2.5 w-full min-w-0" : "p-2"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                          {tax.description} ({tax.rate}%)
                          {tax.inclusive_type && (
                            <span
                              className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${
                                tax.inclusive_type === "inclusive"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {tax.inclusive_type === "inclusive"
                                ? "Inclusive"
                                : "Exclusive"}
                            </span>
                          )}
                        </label>
                        <p className="text-xs text-gray-500">
                          {tax.inclusive_type === "inclusive"
                            ? "VAT included in price - will extract and display"
                            : tax.inclusive_type === "exclusive"
                              ? "VAT will be added to taxable items"
                              : tax.tax_type === "inclusive"
                                ? "VAT included in price"
                                : "VAT will be added to taxable items"}
                        </p>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTaxes((prev) => [...prev, tax]);
                            } else {
                              setSelectedTaxes((prev) =>
                                prev.filter((t) => t.id !== tax.id),
                              );
                            }
                          }}
                          className="sr-only"
                        />
                        <div
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTaxes((prev) =>
                                prev.filter((t) => t.id !== tax.id),
                              );
                            } else {
                              setSelectedTaxes((prev) => [...prev, tax]);
                            }
                          }}
                          className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                            isSelected ? "bg-green-600" : "bg-gray-300"
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                              isSelected ? "transform translate-x-6" : ""
                            }`}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {filteredOutputVATTaxes.length > 0 && (
            <div
              className={
                compact ? "space-y-3 w-full" : "mb-2 space-y-2"
              }
            >
              {regularTaxesForUi.length > 0 && (
                <p className="text-xs font-medium text-slate-600">
                  Output VAT
                </p>
              )}
              {filteredOutputVATTaxes.map((vatTax) => {
                const isSelected = selectedOutputVAT.includes(vatTax.id);
                return (
                  <div
                    key={vatTax.id}
                    className={`flex items-center justify-between gap-3 bg-white rounded-lg border border-gray-200 ${
                      compact ? "px-3 py-2.5 w-full min-w-0" : "p-2"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                        {vatTax.description} ({vatTax.rate}%)
                        {vatTax.inclusive_type && (
                          <span
                            className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${
                              vatTax.inclusive_type === "inclusive"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {vatTax.inclusive_type === "inclusive"
                              ? "Inclusive"
                              : "Exclusive"}
                          </span>
                        )}
                      </label>
                      <p className="text-xs text-gray-500">
                        {vatTax.inclusive_type === "inclusive" ||
                        (vatTax.inclusive_type === undefined &&
                          activeBusiness?.vat_policy === "vat_inclusive")
                          ? "VAT included in price - will extract and display"
                          : "VAT will be added to taxable items"}
                      </p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOutputVAT((prev) => [...prev, vatTax.id]);
                          } else {
                            setSelectedOutputVAT((prev) =>
                              prev.filter((id) => id !== vatTax.id),
                            );
                          }
                        }}
                        className="sr-only"
                      />
                      <div
                        onClick={() => {
                          if (isSelected) {
                            setSelectedOutputVAT((prev) =>
                              prev.filter((id) => id !== vatTax.id),
                            );
                          } else {
                            setSelectedOutputVAT((prev) => [...prev, vatTax.id]);
                          }
                        }}
                        className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                          isSelected ? "bg-green-600" : "bg-gray-300"
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            isSelected ? "transform translate-x-6" : ""
                          }`}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </div>
  );

  const discountBlock = (
      <div
        className={`bg-yellow-50 ${
          compact
            ? discountEmptyOnly
              ? "h-fit rounded-xl border border-amber-200 px-3 py-2.5"
              : "h-fit rounded-xl border border-amber-200 px-4 py-3"
            : discountEmptyOnly
              ? "border-b px-4 py-2.5 mt-3"
              : "border-b px-4 py-2 mt-3"
        }`}
      >
        <div>
          <div
            className={`flex items-center justify-between ${
              discountEmptyOnly ? "mb-1.5" : "mb-2"
            }`}
          >
            <label className="block text-sm font-medium text-gray-700">
              Discount
            </label>
            <div className="flex gap-2">
              {selectedDiscount && (
                <button
                  type="button"
                  onClick={clearDiscount}
                  className="px-1.5 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          {discountEmptyOnly ? (
            <div
              className="rounded-lg border border-amber-200/90 bg-amber-50/95 p-2.5 text-xs text-amber-950 shadow-sm"
              role="status"
            >
              <p className="mb-1 font-semibold text-amber-900 leading-tight">
                No active discounts
              </p>
              <p className="leading-snug text-amber-900/95">
                Add or activate a discount in{" "}
                {inlineSetupLink(
                  PATH_ADMIN_DISCOUNT_TABLE,
                  "Admin → Discount table",
                )}
                .
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <select
                value={selectedDiscount?.discount_id || ""}
                onChange={(e) => {
                  const selectedValue = e.target.value;
                  if (!selectedValue) {
                    handleDiscountSelect(null);
                    return;
                  }
                  const discount = availableDiscounts.find(
                    (d) => String(d.discount_id) === String(selectedValue),
                  );
                  handleDiscountSelect(discount || null);
                }}
                className={`w-full rounded border border-gray-300 text-xs focus:border-transparent focus:ring-2 focus:ring-yellow-500 ${
                  compact ? "bg-white px-2 py-2" : "px-2 py-0.5"
                }`}
              >
                <option value="">Select a discount...</option>
                {activeDiscounts.map((discount) => (
                  <option
                    key={discount.discount_id}
                    value={discount.discount_id}
                  >
                    {formatDiscountOptionLabel(discount)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
  );

  if (compact) {
    if (compactVariant === "taxesOnly") {
      return <div className="w-full min-w-0">{taxesBlock}</div>;
    }
    if (compactVariant === "discountOnly") {
      return <div className="w-full min-w-0">{discountBlock}</div>;
    }
    return (
      <div className="grid w-full min-w-0 grid-cols-1 items-stretch gap-3 md:grid-cols-2 md:gap-4">
        <div className="min-w-0">{taxesBlock}</div>
        <div className="min-w-0">{discountBlock}</div>
      </div>
    );
  }

  return (
    <>
      {taxesBlock}
      {discountBlock}
    </>
  );
}
