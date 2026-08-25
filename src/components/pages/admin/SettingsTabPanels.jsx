import React, { useEffect, useState } from "react";
import { Col, Row } from "reactstrap";
import { Copy, Trash2, Loader2, Save } from "lucide-react";
import moment from "moment";
import { toast } from "sonner";
import { TabsContent } from "@/components/ui/tabs";
import { _postApi } from "@/redux/actions/api";
import CustomButton from "@/common/Custom/CustomButton";
import PayableSettings from "./PayableSettings";
import TripleSelectSettings from "./TripleSelectSettings";
import InventoryValMethod from "./InventoryValMethod";
import CostingMethodSelector from "./CostingMethodSelector";
import DepreciationMethodSelector from "./DepreciationMethodSelector";
import DefaultCostOrValuationSelector from "./DefaultCostOrValuationSelector";
import CostingTemplate from "./CostingTemplate";
import UserRole from "./userRole";
import ProductMultiplier from "./ProductMultiplier";
import VATPolicySelector from "./VATPolicySelector";
import InvoiceClosingSettings from "./InvoiceClosingSettings";
import CustomerType from "./CustomerType";
import BankListSettings from "./BankListSettings";
import PriceSetup from "./PriceSetup";
import TeamTable from "./TeamTable";
import RateTable from "./RateTable";
import DiscountTable from "./DiscountTable";
import BankSetup from "./BankSetup";
import TaxSetup from "./TaxSetup";
import PAYESettings from "./PAYESettings";
import ManageStores from "./ManageStores";
import BranchMgm from "../../BranchMgm";
import InvoiceCorrection from "./InvoiceCorrection";
import JournalCorrection from "./JournalCorrection";
import MaterialRequisitionSettings from "./MaterialRequisitionSettings";
import ProductionCorrectionSettings from "./ProductionCorrectionSettings";
import SessionSettings from "./SessionSettings";
import { getConfiguredSocialCount } from "./MarketplaceSocialMediaModal";
import BusinessDocumentHeader, {
  DocumentHeaderPreview,
  getDocumentHeaderStyle,
} from "@/components/common/BusinessDocumentHeader";

function InvoiceNotesSettingsPanel({ activeBusiness, dispatch }) {
  const DEFAULT_IMPORTANT_NOTE =
    "Thank you for patronizing us. We look forward to your return and to continuing to do business with you.";

  const [customerNotes, setCustomerNotes] = useState(
    () => activeBusiness?.customer_notes || "Thanks for your business.",
  );
  const [termsConditions, setTermsConditions] = useState(
    () => activeBusiness?.terms_conditions || DEFAULT_IMPORTANT_NOTE,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCustomerNotes(
      activeBusiness?.customer_notes || "Thanks for your business.",
    );
    setTermsConditions(
      activeBusiness?.terms_conditions || DEFAULT_IMPORTANT_NOTE,
    );
  }, [
    activeBusiness?.id,
    activeBusiness?.customer_notes,
    activeBusiness?.terms_conditions,
  ]);

  const dirty =
    customerNotes !==
      (activeBusiness?.customer_notes || "Thanks for your business.") ||
    termsConditions !==
      (activeBusiness?.terms_conditions || DEFAULT_IMPORTANT_NOTE);

  const save = () => {
    if (!activeBusiness?.id || saving || !dirty) return;
    setSaving(true);
    _postApi(
      `/account/update-invoice-notes/${activeBusiness.id}`,
      {
        customer_notes: customerNotes,
        terms_conditions: termsConditions,
      },
      (resp) => {
        setSaving(false);
        if (resp?.success) {
          toast.success("Invoice notes saved");
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: {
              business: {
                id: activeBusiness.id,
                customer_notes: customerNotes,
                terms_conditions: termsConditions,
              },
            },
          });
        } else {
          toast.error(resp?.message || "Failed to save invoice notes");
        }
      },
      (err) => {
        console.error(err);
        setSaving(false);
        toast.error("Network error. Could not save invoice notes");
      },
    );
  };

  return (
    <div className="card shadow-sm border-0 h-100">
      <div className="card-header bg-white border-0 d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-2">
          <span style={{ fontSize: "1.5rem" }}>📝</span>
          <div>
            <h5 className="mb-0 fw-bold">Invoice Notes</h5>
            <small className="text-muted">
              Customer notes and the Important Note printed on Sales Invoice
            </small>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
          disabled={!dirty || saving}
          onClick={save}
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Save
        </button>
      </div>
      <div className="card-body">
        <div className="mb-3">
          <label className="form-label fw-semibold">Customer Notes</label>
          <textarea
            className="form-control"
            rows={3}
            value={customerNotes}
            onChange={(e) => setCustomerNotes(e.target.value)}
            placeholder="Thanks for your business."
          />
        </div>
        <div>
          <label className="form-label fw-semibold">
            Important Note (printed on invoice)
          </label>
          <textarea
            className="form-control"
            rows={4}
            value={termsConditions}
            onChange={(e) => setTermsConditions(e.target.value)}
            placeholder={DEFAULT_IMPORTANT_NOTE}
          />
          <small className="text-muted">
            Shown in the yellow Important Note box on the Sales Invoice. Leave
            blank to hide the note.
          </small>
        </div>
      </div>
    </div>
  );
}

function HeaderSettingsPanel({ activeBusiness, dispatch }) {
  const savedStyle = getDocumentHeaderStyle(activeBusiness);
  const [draftStyle, setDraftStyle] = useState(savedStyle);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraftStyle(savedStyle);
  }, [savedStyle, activeBusiness?.id]);

  const dirty = draftStyle !== savedStyle;


  const handleSave = () => {
    if (!activeBusiness?.id || saving) return;
    if (draftStyle === "logo" && !activeBusiness?.business_logo) {
      toast.error("Upload a business logo under Branding first");
      return;
    }
    setSaving(true);
    _postApi(
      `/account/update-document-header-style/${activeBusiness.id}`,
      { document_header_style: draftStyle },
      (resp) => {
        setSaving(false);
        if (resp?.success) {
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: {
              business: {
                id: activeBusiness.id,
                document_header_style: draftStyle,
              },
            },
          });
          toast.success(
            draftStyle === "logo"
              ? "Logo header saved"
              : "Text header saved",
          );
        } else {
          toast.error(resp?.message || "Failed to save header settings");
        }
      },
      (err) => {
        console.error("Header settings save error:", err);
        setSaving(false);
        toast.error("Network error. Could not save header settings");
      },
    );
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            Document Header Settings
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Choose how company headers appear on receipts, invoices, payment
            vouchers, and reports. Click Save to apply across the app.
          </p>
        </div>
        <CustomButton
          type="button"
          handleSubmit={handleSave}
          disabled={saving || !dirty}
          loading={saving}
          className="gap-2 shrink-0 mb-0"
        >
          {!saving && <Save className="w-4 h-4" />}
          {saving ? "Saving..." : "Save Settings"}
        </CustomButton>
      </div>

      {!activeBusiness?.business_logo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Upload a business logo under{" "}
          <span className="font-semibold">Branding</span> to use the logo
          header style.
        </div>
      )}

      {dirty && (
        <p className="text-xs font-semibold text-amber-700">
          You have unsaved changes — click Save Settings to apply.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            value: "text",
            label: "Text header",
            hint: "Company name, RC, address — no logo",
          },
          {
            value: "logo",
            label: "Logo header",
            hint: "Shows your business logo beside company details",
          },
        ].map((opt) => {
          const selected = draftStyle === opt.value;
          const isSaved = savedStyle === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={
                opt.value === "logo" && !activeBusiness?.business_logo
              }
              onClick={() => setDraftStyle(opt.value)}
              className={`text-left rounded-xl border-2 p-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                selected
                  ? "border-[var(--aa-accent)] bg-[var(--aa-sidebar-active)] shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <p className="font-bold text-slate-800 text-sm">
                    {opt.label}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {opt.hint}
                  </p>
                </div>
                {selected ? (
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--aa-navy)] bg-[var(--aa-sidebar-active)] px-2 py-1 rounded-full">
                    {isSaved && !dirty ? "Active" : "Selected"}
                  </span>
                ) : null}
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
                <DocumentHeaderPreview
                  style={opt.value}
                  business={{
                    ...activeBusiness,
                    business_logo:
                      activeBusiness?.business_logo ||
                      "data:image/svg+xml," +
                        encodeURIComponent(
                          '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="#e2e8f0" width="64" height="64"/><text x="32" y="36" text-anchor="middle" font-size="10" fill="#64748b">LOGO</text></svg>',
                        ),
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
          Live preview
        </p>
        <BusinessDocumentHeader
          business={activeBusiness}
          forceStyle={draftStyle}
          title="PAYMENT RECEIPT"
          numberLabel="No: PR-EXAMPLE"
          date={new Date()}
        />
      </div>
    </div>
  );
}

export default function SettingsTabPanels({
  tabVisible,
  activeBusiness,
  chartOfAccount,
  onlineLoading,
  toggleOnlineOrdering,
  receiptLoading,
  updateDefaultReceiptType,
  deliveryOrderLoading,
  togglePrintDeliveryOrder,
  updateDeliveryOrderFormat,
  updateDeliveryDocumentType,
  getMarketplaceTinyLink,
  getMarketplaceStorefrontLink,
  openLinkUserModal,
  setShowTinyLinkModal,
  setShowSocialMediaModal,
  setShowLogoModal,
  setShowSealModal,
  setShowStampModal,
  openImagePreview,
  dispatch,
  imprestLoading,
  filteredImprestRows,
  imprestDateFrom,
  imprestDateTo,
  setImprestDateFrom,
  setImprestDateTo,
  dateDrafts,
  handleDateDraftChange,
  handleUpdateImprestDate,
  handleCopyImprestRef,
  handleDeleteImprest,
  updatingImprestId,
  deletingImprestId,
}) {
  return (
    <>
      {tabVisible("payable") && (
        <TabsContent value="payable" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <TripleSelectSettings
                title="Payable"
                description="Configure default payable, accrual and advance account"
                icon="💳"
                apiEndpoint="bank-configuration"
                primaryCode={activeBusiness.payable_code}
                secondaryCode={activeBusiness.payable_accural_code}
                tertiaryCode={activeBusiness.other_payable_code}
                primaryLabel="Payable"
                secondaryLabel="Advance to Payables"
                chartOfAccount={chartOfAccount}
              />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("receivable") && (
        <TabsContent value="receivable" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <TripleSelectSettings
                title="Receivable"
                description="Configure default receivable, accrual and advance account"
                icon="💳"
                apiEndpoint="bank-configuration"
                primaryCode={activeBusiness.receivable_code}
                secondaryCode={activeBusiness.receivable_accural_code}
                tertiaryCode={activeBusiness.other_receivable_code}
                primaryLabel="Receivable"
                secondaryLabel="Unearned Deposits Receivable"
                chartOfAccount={chartOfAccount}
              />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("cost-of-service") && (
        <TabsContent value="cost-of-service" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <PayableSettings
                title="Cost Of Service"
                code={activeBusiness.cost_of_sale}
                description="Configure cost of sales account"
                icon="📊"
              />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("sales-revenue") && (
        <TabsContent value="sales-revenue" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <PayableSettings
                title="Sales Revenue"
                code={activeBusiness.sale_revenue_code}
                description="Configure sales revenue account"
                icon="📈"
              />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("work-in-progress") && (
        <TabsContent value="work-in-progress" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <PayableSettings
                title="Work in Progress"
                code={activeBusiness.wip}
                description="Configure work in progress account"
                icon="🏭"
              />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("finished-goods") && (
        <TabsContent value="finished-goods" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <PayableSettings
                title="Finished Goods"
                code={activeBusiness.finished_goods_code}
                description="Configure finished goods account"
                icon="🏭"
              />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("abnormal-loss") && (
        <TabsContent value="abnormal-loss" className="mt-0">
          <Row className="g-4">
            <Col md={12} id="production-abnormal-loss-account">
              <PayableSettings
                title="Abnormal Loss"
                code={activeBusiness.abnormal_loss_account}
                description="Expense account for abnormal production waste (DR when completing a batch)"
                icon="⚠️"
              />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("scrap-inventory") && (
        <TabsContent value="scrap-inventory" className="mt-0">
          <Row className="g-4">
            <Col md={12} id="production-scrap-inventory-account">
              <PayableSettings
                title="Scrap Inventory"
                code={activeBusiness.scrap_inventory_account}
                description="Inventory / by-product account for recyclable waste (DR when completing a batch)"
                icon="♻️"
              />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("opening-balance-equity") && (
        <TabsContent value="opening-balance-equity" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <PayableSettings
                title="Opening Balance Equity"
                code={activeBusiness.opening_balance_equity}
                description="Configure opening balance equity account"
                icon="💰"
              />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("pro-bono") && (
        <TabsContent value="pro-bono" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <PayableSettings
                title="Pro Bono"
                code={activeBusiness.pro_bono_code}
                description="Configure pro bono account"
                icon="💰"
              />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("online-ordering") && (
        <TabsContent value="online-ordering" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <div className="card shadow-sm border-0 h-100">
                <div className="card-header bg-white border-0 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: "1.5rem" }}>📱</span>
                    <div>
                      <h5 className="mb-0 fw-bold">Online Ordering</h5>
                      <small className="text-muted">
                        Enable WhatsApp / online storefront for selected products
                      </small>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="fw-semibold text-gray-700">
                      Enable Online Store
                    </span>
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="enableOnlineOrdering"
                        checked={!!activeBusiness.enable_online_ordering}
                        onChange={toggleOnlineOrdering}
                        disabled={onlineLoading}
                      />
                    </div>
                  </div>
                  <p className="text-muted mb-2" style={{ fontSize: "0.85rem" }}>
                    When enabled, products marked as <strong>Online</strong> in
                    the inventory list can be exposed to WhatsApp ordering apps like
                    FlowSpace.
                  </p>
                  <p className="text-muted mb-0" style={{ fontSize: "0.8rem" }}>
                    Manage which products are online from{" "}
                    <strong>Inventory → Product &amp; Service Inventory</strong>.
                  </p>
                </div>
              </div>
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("default-receipt") && (
        <TabsContent value="default-receipt" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <div className="card shadow-sm border-0 h-100">
                <div className="card-header bg-white border-0 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: "1.5rem" }}>🧾</span>
                    <div>
                      <h5 className="mb-0 fw-bold">Default Receipt Type</h5>
                      <small className="text-muted">
                        Used after checkout on Make Sale and invoice preview
                      </small>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <p className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>
                    Choose how receipts are produced for this business after
                    checkout and on invoice preview.
                  </p>
                  <div className="d-flex flex-column gap-2">
                    <label
                      className={`d-flex align-items-start gap-2 p-2 rounded border ${
                        (activeBusiness.default_receipt_type || "pdf") === "pdf"
                          ? "border-primary bg-primary bg-opacity-10"
                          : "border-light"
                      } ${receiptLoading ? "opacity-50" : ""}`}
                    >
                      <input
                        type="radio"
                        name="defaultReceiptType"
                        className="mt-1"
                        checked={
                          (activeBusiness.default_receipt_type || "pdf") === "pdf"
                        }
                        disabled={receiptLoading}
                        onChange={() => updateDefaultReceiptType("pdf")}
                      />
                      <span>
                        <span className="fw-semibold d-block">PDF invoice (A4)</span>
                        <small className="text-muted">
                          Full A4-style invoice
                        </small>
                      </span>
                    </label>
                    <label
                      className={`d-flex align-items-start gap-2 p-2 rounded border ${
                        activeBusiness.default_receipt_type === "a5"
                          ? "border-primary bg-primary bg-opacity-10"
                          : "border-light"
                      } ${receiptLoading ? "opacity-50" : ""}`}
                    >
                      <input
                        type="radio"
                        name="defaultReceiptType"
                        className="mt-1"
                        checked={activeBusiness.default_receipt_type === "a5"}
                        disabled={receiptLoading}
                        onChange={() => updateDefaultReceiptType("a5")}
                      />
                      <span>
                        <span className="fw-semibold d-block">A5 invoice</span>
                        <small className="text-muted">
                          Compact A5 paper size (148 × 210 mm)
                        </small>
                      </span>
                    </label>
                    <label
                      className={`d-flex align-items-start gap-2 p-2 rounded border ${
                        activeBusiness.default_receipt_type === "terminal"
                          ? "border-primary bg-primary bg-opacity-10"
                          : "border-light"
                      } ${receiptLoading ? "opacity-50" : ""}`}
                    >
                      <input
                        type="radio"
                        name="defaultReceiptType"
                        className="mt-1"
                        checked={activeBusiness.default_receipt_type === "terminal"}
                        disabled={receiptLoading}
                        onChange={() => updateDefaultReceiptType("terminal")}
                      />
                      <span>
                        <span className="fw-semibold d-block">
                          Terminal / thermal (80mm)
                        </span>
                        <small className="text-muted">
                          Compact receipt for POS thermal printers
                        </small>
                      </span>
                    </label>
                  </div>
                  {receiptLoading && (
                    <p className="text-muted small mb-0 mt-2">Saving…</p>
                  )}
                </div>
              </div>
            </Col>
            <Col md={12}>
              <div className="card shadow-sm border-0 h-100">
                <div className="card-header bg-white border-0 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: "1.5rem" }}>🚚</span>
                    <div>
                      <h5 className="mb-0 fw-bold">Delivery Order</h5>
                      <small className="text-muted">
                        Include Delivery Order on invoice preview and print
                      </small>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="form-check form-switch mb-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="printDeliveryOrderSwitch"
                      checked={
                        activeBusiness.print_delivery_order === undefined ||
                        activeBusiness.print_delivery_order === null
                          ? true
                          : !!activeBusiness.print_delivery_order
                      }
                      disabled={deliveryOrderLoading}
                      onChange={togglePrintDeliveryOrder}
                    />
                    <label
                      className="form-check-label fw-semibold"
                      htmlFor="printDeliveryOrderSwitch"
                    >
                      Print Delivery Order with invoice
                    </label>
                  </div>

                  {(activeBusiness.print_delivery_order === undefined ||
                    activeBusiness.print_delivery_order === null ||
                    !!activeBusiness.print_delivery_order) && (
                    <div className="d-flex flex-column gap-2">
                      <p
                        className="text-muted mb-1"
                        style={{ fontSize: "0.85rem" }}
                      >
                        Delivery Order format
                      </p>
                      <label
                        className={`d-flex align-items-start gap-2 p-2 rounded border ${
                          (activeBusiness.delivery_order_format || "match") ===
                          "match"
                            ? "border-primary bg-primary bg-opacity-10"
                            : "border-light"
                        } ${deliveryOrderLoading ? "opacity-50" : ""}`}
                      >
                        <input
                          type="radio"
                          name="deliveryOrderFormat"
                          className="mt-1"
                          checked={
                            (activeBusiness.delivery_order_format ||
                              "match") === "match"
                          }
                          disabled={deliveryOrderLoading}
                          onChange={() => updateDeliveryOrderFormat("match")}
                        />
                        <span>
                          <span className="fw-semibold d-block">
                            Match invoice (A4 / A5)
                          </span>
                          <small className="text-muted">
                            Full Delivery Order section under the Sales Invoice
                          </small>
                        </span>
                      </label>
                      <label
                        className={`d-flex align-items-start gap-2 p-2 rounded border ${
                          activeBusiness.delivery_order_format === "thermal"
                            ? "border-primary bg-primary bg-opacity-10"
                            : "border-light"
                        } ${deliveryOrderLoading ? "opacity-50" : ""}`}
                      >
                        <input
                          type="radio"
                          name="deliveryOrderFormat"
                          className="mt-1"
                          checked={
                            activeBusiness.delivery_order_format === "thermal"
                          }
                          disabled={deliveryOrderLoading}
                          onChange={() => updateDeliveryOrderFormat("thermal")}
                        />
                        <span>
                          <span className="fw-semibold d-block">
                            Thermal (80mm)
                          </span>
                          <small className="text-muted">
                            Separate compact Delivery Order for POS thermal
                            printers
                          </small>
                        </span>
                      </label>

                      <p
                        className="text-muted mb-1 mt-3"
                        style={{ fontSize: "0.85rem" }}
                      >
                        Document type
                      </p>
                      <label
                        className={`d-flex align-items-start gap-2 p-2 rounded border ${
                          (activeBusiness.delivery_document_type ||
                            "delivery_order") === "delivery_order"
                            ? "border-primary bg-primary bg-opacity-10"
                            : "border-light"
                        } ${deliveryOrderLoading ? "opacity-50" : ""}`}
                      >
                        <input
                          type="radio"
                          name="deliveryDocumentType"
                          className="mt-1"
                          checked={
                            (activeBusiness.delivery_document_type ||
                              "delivery_order") === "delivery_order"
                          }
                          disabled={deliveryOrderLoading}
                          onChange={() =>
                            updateDeliveryDocumentType("delivery_order")
                          }
                        />
                        <span>
                          <span className="fw-semibold d-block">
                            Delivery Order
                          </span>
                          <small className="text-muted">
                            Includes Vehicle No and Driver&apos;s Name fields
                          </small>
                        </span>
                      </label>
                      <label
                        className={`d-flex align-items-start gap-2 p-2 rounded border ${
                          activeBusiness.delivery_document_type ===
                          "goods_issue_note"
                            ? "border-primary bg-primary bg-opacity-10"
                            : "border-light"
                        } ${deliveryOrderLoading ? "opacity-50" : ""}`}
                      >
                        <input
                          type="radio"
                          name="deliveryDocumentType"
                          className="mt-1"
                          checked={
                            activeBusiness.delivery_document_type ===
                            "goods_issue_note"
                          }
                          disabled={deliveryOrderLoading}
                          onChange={() =>
                            updateDeliveryDocumentType("goods_issue_note")
                          }
                        />
                        <span>
                          <span className="fw-semibold d-block">
                            Goods Issue Note
                          </span>
                          <small className="text-muted">
                            Same slip without Vehicle No or Driver&apos;s Name
                          </small>
                        </span>
                      </label>
                    </div>
                  )}

                  {deliveryOrderLoading && (
                    <p className="text-muted small mb-0 mt-2">Saving…</p>
                  )}
                </div>
              </div>
            </Col>
            <Col md={12}>
              <InvoiceNotesSettingsPanel
                activeBusiness={activeBusiness}
                dispatch={dispatch}
              />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("marketplace") && (
        <TabsContent value="marketplace" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <div className="card shadow-sm border-0 h-100">
                <div className="card-header bg-white border-0 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: "1.5rem" }}>🔗</span>
                    <div>
                      <h5 className="mb-0 fw-bold">Marketplace Space Link</h5>
                      <small className="text-muted">
                        Your unique storefront URL on YAMMUSA GLOBAL FARMS & AGRO ALLIED SERVICES Marketplace
                      </small>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <p className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>
                    Share this link to direct customers to your space on the
                    marketplace.
                  </p>
                  {activeBusiness?.id ? (
                    <div className="d-flex flex-column gap-3">
                      {!activeBusiness.enable_online_ordering ? (
                        <p className="text-muted mb-0 small">
                          Turn on <strong>Enable Online Store</strong> to set up
                          your marketplace link.
                        </p>
                      ) : !activeBusiness.link_user ? (
                        <>
                          <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>
                            Choose a unique storefront handle to create your public
                            store URL. Your link will appear here once it is set up.
                          </p>
                          <button
                            type="button"
                            className="btn btn-primary align-self-start"
                            onClick={openLinkUserModal}
                          >
                            Set Up Storefront
                          </button>
                        </>
                      ) : getMarketplaceTinyLink() ? (
                        <div>
                          <label className="form-label fw-semibold small mb-1">
                            Tiny Link
                          </label>
                          <div className="input-group mb-2">
                            <input
                              type="text"
                              className="form-control font-monospace small"
                              readOnly
                              value={getMarketplaceTinyLink()}
                              id="spaceLinkInput"
                            />
                            <button
                              className="btn btn-outline-primary"
                              type="button"
                              title="Copy tiny link"
                              onClick={() => {
                                const url = getMarketplaceTinyLink();
                                navigator.clipboard
                                  ?.writeText(url)
                                  .then(() =>
                                    toast.success("Tiny link copied to clipboard")
                                  )
                                  .catch(() => toast.error("Could not copy link"));
                              }}
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="form-label fw-semibold small mb-1">
                            Storefront Link
                          </label>
                          <div className="input-group mb-2">
                            <input
                              type="text"
                              className="form-control font-monospace small"
                              readOnly
                              value={getMarketplaceStorefrontLink()}
                              id="spaceLinkInput"
                            />
                            <button
                              className="btn btn-outline-primary"
                              type="button"
                              title="Copy storefront link"
                              onClick={() => {
                                const url = getMarketplaceStorefrontLink();
                                navigator.clipboard
                                  ?.writeText(url)
                                  .then(() =>
                                    toast.success("Storefront link copied")
                                  )
                                  .catch(() => toast.error("Could not copy link"));
                              }}
                            >
                              <Copy size={14} />
                            </button>
                          </div>

                          <p
                            className="text-muted mb-2"
                            style={{ fontSize: "0.8rem" }}
                          >
                            Create a shorter TinyURL for WhatsApp, SMS, and social
                            media.
                          </p>
                          <button
                            type="button"
                            className="btn btn-primary mb-2"
                            onClick={() => setShowTinyLinkModal(true)}
                          >
                            Shorten Link
                          </button>

                          <button
                            type="button"
                            className="btn btn-link btn-sm px-0 d-block"
                            onClick={openLinkUserModal}
                          >
                            Edit storefront handle
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted mb-0 small">No facility selected.</p>
                  )}
                </div>
              </div>
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("branding") && (
        <TabsContent value="branding" className="mt-0">
          <Row className="g-4">
            <Col md={12} lg={4}>
              <div className="space-y-3">
                <h6 className="font-medium text-gray-700">Business Logo</h6>
                <p className="text-sm text-gray-500">
                  Upload your business logo (appears on FlowSpace and documents).
                </p>

                {activeBusiness?.enable_online_ordering ? (
                  <div className="mb-3">
                    <button
                      type="button"
                      className="btn btn-link btn-sm px-0"
                      onClick={() => setShowSocialMediaModal(true)}
                    >
                      {activeBusiness.enable_marketplace_social_media
                        ? "Edit Social Handles"
                        : "Configure Social Media"}
                    </button>
                    {activeBusiness.enable_marketplace_social_media ? (
                      <p className="text-muted mb-0 small">
                        {getConfiguredSocialCount(activeBusiness) > 0
                          ? `${getConfiguredSocialCount(activeBusiness)} profile(s) linked`
                          : "Enabled — add your handles"}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {activeBusiness.business_logo ? (
                  <p className="text-sm text-muted mb-2">Logo uploaded</p>
                ) : (
                  <CustomButton onClick={() => setShowLogoModal(true)}>
                    Add Logo
                  </CustomButton>
                )}

                <div className="flex gap-2 flex-wrap">
                  {activeBusiness.business_logo && (
                    <CustomButton
                      size="sm"
                      color="primary"
                      outline
                      onClick={() =>
                        openImagePreview(
                          activeBusiness.business_logo,
                          "Business Logo",
                        )
                      }
                    >
                      View
                    </CustomButton>
                  )}
                  {activeBusiness.business_logo && (
                    <CustomButton
                      size="sm"
                      color="light"
                      outline
                      onClick={() => setShowLogoModal(true)}
                    >
                      Change
                    </CustomButton>
                  )}
                  {activeBusiness.business_logo && (
                    <CustomButton
                      size="sm"
                      color="danger"
                      outline
                      onClick={() => {
                        _postApi(
                          `/account/update-logo/${activeBusiness.id}`,
                          {
                            business_logo: null,
                            store: activeBusiness.business_name,
                          },
                          (resp) => {
                            if (resp.success) {
                              dispatch({
                                type: "UPDATE_BUSINESS_SETTINGS",
                                payload: {
                                  business: {
                                    ...activeBusiness,
                                    business_logo: null,
                                  },
                                },
                              });
                              toast.success("Business logo removed successfully!");
                            } else {
                              toast.error(resp.message || "Failed to remove logo.");
                            }
                          },
                          (err) => {
                            console.error("Logo removal error:", err);
                            toast.error("Network error. Could not remove logo.");
                          }
                        );
                      }}
                    >
                      Remove
                    </CustomButton>
                  )}
                </div>
              </div>
            </Col>

            <Col md={12} lg={4}>
              <div className="space-y-3">
                <h6 className="font-medium text-gray-700">Business Seal</h6>
                <p className="text-sm text-gray-500">Upload your business seal.</p>

                {activeBusiness.seal ? (
                  <div className="inline-block w-full">
                    <img
                      src={activeBusiness.seal}
                      alt="Business Seal"
                      className="w-full h-35 object-contain border-2 border-dashed border-gray-300 rounded-md p-2 bg-gray-50"
                    />
                  </div>
                ) : (
                  <CustomButton onClick={() => setShowSealModal(true)}>
                    Add Seal
                  </CustomButton>
                )}

                <div className="flex gap-2 flex-wrap">
                  {activeBusiness.seal && (
                    <CustomButton
                      size="sm"
                      color="primary"
                      outline
                      onClick={() =>
                        openImagePreview(activeBusiness.seal, "Business Seal")
                      }
                    >
                      View
                    </CustomButton>
                  )}
                  {activeBusiness.seal && (
                    <CustomButton
                      size="sm"
                      color="light"
                      outline
                      onClick={() => setShowSealModal(true)}
                    >
                      Change
                    </CustomButton>
                  )}
                  {activeBusiness.seal && (
                    <CustomButton
                      size="sm"
                      color="danger"
                      outline
                      onClick={() => {
                        _postApi(
                          `/account/update-seal/${activeBusiness.id}`,
                          {
                            seal: null,
                            store: activeBusiness.business_name,
                          },
                          (resp) => {
                            if (resp.success) {
                              dispatch({
                                type: "UPDATE_BUSINESS_SETTINGS",
                                payload: {
                                  business: { ...activeBusiness, seal: null },
                                },
                              });
                              toast.success("Business seal removed successfully!");
                            } else {
                              toast.error(resp.message || "Failed to remove seal.");
                            }
                          },
                          (err) => {
                            console.error("Seal removal error:", err);
                            toast.error("Network error. Could not remove seal.");
                          }
                        );
                      }}
                    >
                      Remove
                    </CustomButton>
                  )}
                </div>
              </div>
            </Col>

            <Col md={12} lg={4}>
              <div className="space-y-3">
                <h6 className="font-medium text-gray-700">Business Stamp</h6>
                <p className="text-sm text-gray-500">Upload your business stamp.</p>

                {activeBusiness.stamp ? (
                  <div className="inline-block w-full">
                    <img
                      src={activeBusiness.stamp}
                      alt="Business Stamp"
                      className="w-full h-35 object-contain border-2 border-dashed border-gray-300 rounded-md p-2 bg-gray-50"
                    />
                  </div>
                ) : (
                  <CustomButton onClick={() => setShowStampModal(true)}>
                    Add Stamp
                  </CustomButton>
                )}

                <div className="flex gap-2 flex-wrap">
                  {activeBusiness.stamp && (
                    <CustomButton
                      size="sm"
                      color="primary"
                      outline
                      onClick={() =>
                        openImagePreview(activeBusiness.stamp, "Business Stamp")
                      }
                    >
                      View
                    </CustomButton>
                  )}
                  {activeBusiness.stamp && (
                    <CustomButton
                      size="sm"
                      color="light"
                      outline
                      onClick={() => setShowStampModal(true)}
                    >
                      Change
                    </CustomButton>
                  )}
                  {activeBusiness.stamp && (
                    <CustomButton
                      size="sm"
                      color="danger"
                      outline
                      onClick={() => {
                        _postApi(
                          `/account/update-stamp/${activeBusiness.id}`,
                          {
                            stamp: null,
                            store: activeBusiness.business_name,
                          },
                          (resp) => {
                            if (resp.success) {
                              dispatch({
                                type: "UPDATE_BUSINESS_SETTINGS",
                                payload: {
                                  business: { ...activeBusiness, stamp: null },
                                },
                              });
                              toast.success("Business stamp removed successfully!");
                            } else {
                              toast.error(
                                resp.message || "Failed to remove stamp."
                              );
                            }
                          },
                          (err) => {
                            console.error("Stamp removal error:", err);
                            toast.error("Network error. Could not remove stamp.");
                          }
                        );
                      }}
                    >
                      Remove
                    </CustomButton>
                  )}
                </div>
              </div>
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("header-settings") && (
        <TabsContent value="header-settings" className="mt-0">
          <HeaderSettingsPanel
            activeBusiness={activeBusiness}
            dispatch={dispatch}
          />
        </TabsContent>
      )}

      {tabVisible("departments") && (
        <TabsContent value="departments" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <div id="manage-departments">
                <ManageStores embedded />
              </div>
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("branches") && (
        <TabsContent value="branches" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <div id="manage-branches">
                <BranchMgm />
              </div>
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("price-setup") && (
        <TabsContent value="price-setup" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <PriceSetup embedded />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("team-setup") && (
        <TabsContent value="team-setup" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <div id="team-setup">
                <TeamTable embedded />
              </div>
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("rate-setup") && (
        <TabsContent value="rate-setup" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <div id="rate-setup">
                <RateTable embedded />
              </div>
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("discount-setup") && (
        <TabsContent value="discount-setup" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <div id="discount-setup">
                <DiscountTable embedded />
              </div>
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("bank-setup") && (
        <TabsContent value="bank-setup" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <div id="bank-setup">
                <BankSetup embedded />
              </div>
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("tax-setup") && (
        <TabsContent value="tax-setup" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <div id="tax-setup">
                <TaxSetup embedded />
              </div>
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("paye-setup") && (
        <TabsContent value="paye-setup" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <div id="paye-setup">
                <PAYESettings embedded />
              </div>
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("costing-method") && (
        <TabsContent value="costing-method" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <CostingMethodSelector
                code={activeBusiness.costing_method}
                title="Costing Method"
                description="Select costing method for products or batches"
              />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("depreciation-method") && (
        <TabsContent value="depreciation-method" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <DepreciationMethodSelector
                code={
                  activeBusiness.depreciation_method || "Straight Line"
                }
                title="Depreciation Settings"
                description="Default method for new assets and optional auto-run schedule"
              />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("default-cost-valuation") && (
        <TabsContent value="default-cost-valuation" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <DefaultCostOrValuationSelector
                title="Default Cost or System Valuation"
                description="Use product default cost or system valuation method (method selected below)"
              />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("inventory-valuation") && (
        <TabsContent value="inventory-valuation" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <InventoryValMethod
                code={activeBusiness.inv_ev_m}
                title="Inventory Valuation"
              />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("vat-policy") && (
        <TabsContent value="vat-policy" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <VATPolicySelector
                code={activeBusiness.vat_policy}
                title="Company VAT Policy"
                description="Set whether VAT is exclusive or inclusive of prices"
              />
            </Col>
            <Col md={12}>
              <PayableSettings
                title="VAT Account"
                code={activeBusiness.vat_account_code}
                description="Default VAT account head — used on VAT Report as the amount you are supposed to pay"
                icon="🧾"
              />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("invoice-closing") && (
        <TabsContent value="invoice-closing" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <InvoiceClosingSettings />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("user-roles") && (
        <TabsContent value="user-roles" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <UserRole />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("customer-types") && (
        <TabsContent value="customer-types" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <CustomerType />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("bank-list") && (
        <TabsContent value="bank-list" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <BankListSettings />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("invoice-correction") && (
        <TabsContent value="invoice-correction" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <InvoiceCorrection />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("journal-correction") && (
        <TabsContent value="journal-correction" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <JournalCorrection />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("imprest-history") && (
        <TabsContent value="imprest-history" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <div className="card shadow-sm border-0">
                <div className="card-header bg-white border-0">
                  <h5 className="mb-0 fw-bold">Imprest History</h5>
                  <small className="text-muted">
                    Copy reference, update date, or delete imprest records.
                  </small>
                </div>
                <div className="card-body">
                  <div className="row g-2 mb-3">
                    <div className="col-md-3">
                      <label className="form-label mb-1 small text-muted">
                        Date From
                      </label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={imprestDateFrom}
                        onChange={(e) => setImprestDateFrom(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label mb-1 small text-muted">
                        Date To
                      </label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={imprestDateTo}
                        onChange={(e) => setImprestDateTo(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3 d-flex align-items-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                          setImprestDateFrom("");
                          setImprestDateTo("");
                        }}
                      >
                        Clear Dates
                      </button>
                    </div>
                  </div>
                  {imprestLoading && (
                    <p className="text-muted mb-0">Loading imprest records...</p>
                  )}
                  {!imprestLoading && filteredImprestRows.length === 0 && (
                    <p className="text-muted mb-0">No imprest records found.</p>
                  )}
                  {!imprestLoading && filteredImprestRows.length > 0 && (
                    <ul className="list-group">
                      {filteredImprestRows.map((row) => (
                        <li
                          key={row.id || row.ref_number}
                          className="list-group-item d-flex flex-wrap align-items-center justify-content-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="fw-semibold font-monospace">
                              {row.reference_display || row.ref_number}
                            </div>
                            <small className="text-muted">
                              {row.transaction_date
                                ? moment(row.transaction_date).format("DD MMM, YYYY")
                                : "—"}{" "}
                              · ₦{Number(row.total_payment || 0).toLocaleString()}
                            </small>
                          </div>
                          <div className="d-flex flex-wrap gap-2 align-items-center">
                            <input
                              type="date"
                              className="form-control form-control-sm"
                              style={{ width: 170 }}
                              value={dateDrafts[row.id] || ""}
                              onChange={(e) =>
                                handleDateDraftChange(row.id, e.target.value)
                              }
                            />
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => handleUpdateImprestDate(row)}
                              disabled={updatingImprestId === row.id}
                            >
                              {updatingImprestId === row.id ? "Saving..." : "Update Date"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                              onClick={() => handleCopyImprestRef(row)}
                            >
                              <Copy size={14} />
                              Copy
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                              onClick={() => handleDeleteImprest(row)}
                              disabled={deletingImprestId === row.id}
                            >
                              {deletingImprestId === row.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("product-multiplier") && (
        <TabsContent value="product-multiplier" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <ProductMultiplier />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("costing-template") && (
        <TabsContent value="costing-template" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <CostingTemplate />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("production-correction") && (
        <TabsContent value="production-correction" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <ProductionCorrectionSettings />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("material-requisition") && (
        <TabsContent value="material-requisition" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <MaterialRequisitionSettings />
            </Col>
          </Row>
        </TabsContent>
      )}

      {tabVisible("session") && (
        <TabsContent value="session" className="mt-0">
          <Row className="g-4">
            <Col md={12}>
              <SessionSettings />
            </Col>
          </Row>
        </TabsContent>
      )}
    </>
  );
}
