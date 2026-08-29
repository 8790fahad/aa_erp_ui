import { useState, useEffect } from "react";
import { Collapse } from "reactstrap";
import moment from "moment";
import PropTypes from "prop-types";
import { formatNumber1 } from "@/components/router/utilities";
import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  Package,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiURL } from "@/redux/actions/api";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const inputClass =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[var(--aa-navy)] focus:ring-2 focus:ring-[var(--aa-accent)]/20";
const textareaClass =
  "min-h-[88px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--aa-navy)] focus:ring-2 focus:ring-[var(--aa-accent)]/20";
const labelClass = "mb-1.5 block text-xs font-medium text-slate-600";
const thClass =
  "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500";
const tdClass = "border-b border-slate-100 px-3 py-2.5 text-sm text-slate-700";
const trClass = "bg-white transition-colors hover:bg-slate-50/80";

function attachmentHref(doc) {
  const path = doc?.url || doc?.file_path;
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiURL}/public/uploads/${path}`;
}

function attachmentDownloadHref(doc) {
  if (doc?.download_url) return doc.download_url;
  return attachmentHref(doc);
}

function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const DetailItem = ({ label, value, className = "" }) => (
  <div className={className}>
    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      {label}
    </dt>
    <dd className="mt-1 text-sm font-medium text-slate-900">{value || "—"}</dd>
  </div>
);

DetailItem.propTypes = {
  label: PropTypes.string,
  value: PropTypes.node,
  className: PropTypes.string,
};

const CustomRequisitionModal = ({
  isOpen,
  toggle,
  header,
  itemList: initialItems,
  items,
  activeBusiness,
  cancel,
  approveMemo,
  reject,
  remark,
  setRemark,
  amount,
  setAmount,
  logs = [],
  mode,
  form,
  handleChange,
  handleEdit,
  loading2,
  waybillNumber,
  truckNumber,
  setWaybillNumber,
  setTruckNumber,
  attachments = [],
}) => {
  const [isOpen3, setIsOpen3] = useState(false);
  const [itemList, setItemList] = useState([]);

  const toggleMemoLog = () => setIsOpen3(!isOpen3);

  const handleFormSubmit = () => {
    if (approveMemo) {
      approveMemo(itemList, remark);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const updatedItems = (initialItems || []).map((item, i) => {
        const cost = parseFloat(item.est_cost) || 0;
        const additionalCost = parseFloat(item.additionalCostValue) || 0;
        const requestedQty = parseFloat(item.quantity) || 0;
        const approvedQty =
          item.approved_qty != null && item.approved_qty !== ""
            ? parseFloat(item.approved_qty)
            : requestedQty;
        const receivedQty =
          parseInt(item.receivedQuantity || item.quantity) || 0;
        const averageCostPerUom =
          receivedQty > 0 ? (cost + additionalCost) / receivedQty : 0;

        return {
          ...item,
          rowId: i + 1,
          approved_qty: approvedQty,
          approved: true,
          rejected: false,
          unit: item.unit_measure || "KG",
          item_category: item.unit_category || "General",
          additionalCostItem: item.additionalCostItem || "",
          additionalCostValue: item.additionalCostValue || 0,
          averageCostPerUom,
        };
      });
      setItemList(updatedItems);
    }
  }, [isOpen, initialItems]);

  const modeSubtitle = {
    receive: "Review and approve goods receive note",
    review: "Review purchase requisition",
    approve: "Approve purchase requisition",
    preview: "Preview requisition details",
    review_rejected: "Review rejected requisition",
  };

  const modeBadge = {
    receive: "Goods receive",
    review: "Pending approval",
    approve: "Final approval",
    preview: "Preview",
    review_rejected: "Rejected",
  };

  const documentTitle =
    mode === "receive"
      ? "Goods Received Note"
      : mode === "review"
        ? "Requisition Approval"
        : "Review";

  const renderReviewRejectedContent = () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className={labelClass}>From</label>
        <input
          className={`${inputClass} bg-slate-50`}
          type="text"
          name="from"
          value={items?.from_name || ""}
          disabled
        />
      </div>
      <div>
        <label className={labelClass}>Date</label>
        <input
          className={`${inputClass} bg-slate-50`}
          type="date"
          name="date"
          value={form?.date || moment().format("YYYY-MM-DD")}
          disabled
        />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>Purpose</label>
        <textarea
          className={textareaClass}
          name="purpose"
          value={form?.purpose || ""}
          onChange={handleChange}
        />
      </div>
      <div className="sm:col-span-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleMemoLog}
          className="mb-2 border-slate-200"
        >
          {isOpen3 ? "Hide" : "Show"} memo log
        </Button>
        <Collapse isOpen={isOpen3}>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className={thClass}>S/N</th>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Activity</th>
                  <th className={thClass}>User</th>
                  <th className={thClass}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {(logs || []).map((log, idx) => (
                  <tr key={idx}>
                    <td className={tdClass}>{idx + 1}</td>
                    <td className={tdClass}>{log.date}</td>
                    <td className={tdClass}>{log.activity}</td>
                    <td className={tdClass}>{log.user}</td>
                    <td className={tdClass}>{log.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Collapse>
      </div>
    </div>
  );

  const renderHeaderSection = () => (
    <section className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <Building2 className="h-3.5 w-3.5 text-[var(--aa-navy)]" />
            {activeBusiness?.business_name || "Business"}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            {documentTitle}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {items?.pr_no ? (
            <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-800">
              {items.pr_no}
            </span>
          ) : null}
          <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200/80">
            {modeBadge[mode] || "Review"}
          </span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
        <DetailItem
          label="Date"
          value={
            items?.date ? moment(items.date).format("DD MMM YYYY") : "—"
          }
        />
        <DetailItem label="PR No." value={items?.pr_no} />
        <DetailItem label="From warehouse" value={items?.branch} />
        {mode === "receive" ? (
          <DetailItem label="PO No." value={items?.po_no} />
        ) : null}
        {mode !== "review" ? (
          <DetailItem label="Raised by" value={items?.requisitor} />
        ) : null}
        <DetailItem label="Reason" value={items?.reason} />
        <DetailItem
          className="col-span-2 border-t border-slate-100 pt-4"
          label="Supplier"
          value={
            items?.supplier_name
              ? `${items.supplier_name}${
                  items?.supplier_code ? ` (${items.supplier_code})` : ""
                }`
              : "—"
          }
        />
      </dl>
    </section>
  );

  const renderReceiveModeContent = () => (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Truck Number</label>
          <input
            className={inputClass}
            type="text"
            value={truckNumber || ""}
            onChange={(e) => setTruckNumber(e.target.value)}
            placeholder="Enter truck number"
          />
        </div>
        <div>
          <label className={labelClass}>Waybill Number</label>
          <input
            className={inputClass}
            type="text"
            value={waybillNumber || ""}
            onChange={(e) => setWaybillNumber(e.target.value)}
            placeholder="Enter waybill number"
          />
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Package className="h-3.5 w-3.5" />
          Goods detail
        </p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {itemList.length} item{itemList.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className={thClass} colSpan={2}>
                Order
              </th>
              <th className={thClass} colSpan={5}>
                Receive
              </th>
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className={thClass}>Description</th>
              <th className={`${thClass} text-right`}>P. Qty</th>
              <th className={thClass}>UoM</th>
              <th className={`${thClass} text-right`}>S. Qty</th>
              <th className={`${thClass} text-right`}>Cost (₦)</th>
              <th className={`${thClass} text-right`}>Avg cost / UoM</th>
              <th className={thClass}>Expiry</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {itemList.map((item) => (
              <tr
                key={item.item_list_id || item.rowId || item.id}
                className={trClass}
              >
                <td className={tdClass}>
                  <div className="font-medium text-slate-800">
                    {item.item_name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatNumber1(item.quantity)} {item.unit_measure}
                  </div>
                </td>
                <td className={`${tdClass} text-right`}>
                  <input
                    type="number"
                    className={`${inputClass} ml-auto w-20 text-center`}
                    value={item.quantity || 0}
                    onChange={(e) => {
                      const purchaseQty = parseInt(e.target.value) || 0;
                      setItemList((prev) =>
                        prev.map((listItem) => {
                          if (listItem.rowId !== item.rowId) return listItem;
                          const cost = parseFloat(listItem.est_cost) || 0;
                          const additionalCost =
                            parseFloat(listItem.additionalCostValue) || 0;
                          const receivedQty =
                            listItem.receivedQuantity || purchaseQty;
                          const averageCostPerUom =
                            receivedQty > 0
                              ? ((cost + additionalCost) * listItem.quantity) /
                                receivedQty
                              : 0;
                          return {
                            ...listItem,
                            quantity: purchaseQty,
                            averageCostPerUom,
                            averageCostPerUomAmount:
                              averageCostPerUom * listItem.receivedQuantity,
                          };
                        }),
                      );
                    }}
                  />
                </td>
                <td className={tdClass}>{item.unit_measure}</td>
                <td className={`${tdClass} text-right`}>
                  <input
                    type="number"
                    className={`${inputClass} ml-auto w-20 text-center`}
                    value={item.receivedQuantity ?? ""}
                    onChange={(e) => {
                      let receivedQty = parseInt(e.target.value) || 0;
                      if (receivedQty > item.quantity) {
                        receivedQty = item.quantity;
                      }
                      setItemList((prev) =>
                        prev.map((listItem) => {
                          if (listItem.rowId !== item.rowId) return listItem;
                          const cost = parseFloat(listItem.est_cost) || 0;
                          const additionalCost =
                            parseFloat(listItem.additionalCostValue) || 0;
                          const averageCostPerUom =
                            receivedQty > 0
                              ? ((cost + additionalCost) * listItem.quantity) /
                                receivedQty
                              : 0;
                          return {
                            ...listItem,
                            receivedQuantity: receivedQty,
                            averageCostPerUom,
                            averageCostPerUomAmount:
                              averageCostPerUom * receivedQty,
                          };
                        }),
                      );
                    }}
                  />
                </td>
                <td className={`${tdClass} text-right`}>
                  <input
                    type="number"
                    step="0.01"
                    className={`${inputClass} ml-auto w-24 text-right`}
                    value={item.est_cost || 0}
                    onChange={(e) => {
                      const cost = parseFloat(e.target.value) || 0;
                      setItemList((prev) =>
                        prev.map((listItem) => {
                          if (listItem.rowId !== item.rowId) return listItem;
                          const additionalCost =
                            parseFloat(listItem.additionalCostValue) || 0;
                          const receivedQty = listItem.receivedQuantity || 0;
                          const averageCostPerUom =
                            receivedQty > 0
                              ? ((cost + additionalCost) * listItem.quantity) /
                                receivedQty
                              : 0;
                          return {
                            ...listItem,
                            est_cost: cost,
                            averageCostPerUom,
                            averageCostPerUomAmount:
                              averageCostPerUom * receivedQty,
                          };
                        }),
                      );
                    }}
                  />
                </td>
                <td
                  className={`${tdClass} text-right font-mono font-medium text-[var(--aa-navy)]`}
                >
                  {formatNumber1(item.averageCostPerUom || 0)}
                </td>
                <td className={tdClass}>
                  <input
                    type="date"
                    className={inputClass}
                    value={item.expiryDate || ""}
                    onChange={(e) => {
                      setItemList((prev) =>
                        prev.map((listItem) =>
                          listItem.rowId === item.rowId
                            ? { ...listItem, expiryDate: e.target.value }
                            : listItem,
                        ),
                      );
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <div>
          <span className="text-slate-500">Supplier payment: </span>
          <span className="font-mono font-semibold text-slate-900">
            ₦
            {formatNumber1(
              itemList
                .filter((item) => item.approved)
                .reduce((sum, item) => {
                  const totalQty = parseInt(item.quantity) || 0;
                  const cost = parseFloat(item.est_cost) || 0;
                  return sum + totalQty * cost;
                }, 0),
            )}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Inventory value: </span>
          <span className="font-mono font-semibold text-slate-900">
            ₦
            {formatNumber1(
              itemList
                .filter((item) => item.approved)
                .reduce(
                  (sum, item) => sum + (item.averageCostPerUomAmount || 0),
                  0,
                ),
            )}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <label className={labelClass}>Remark</label>
        <textarea
          className={textareaClass}
          value={remark}
          onChange={({ target: { value } }) => setRemark(value)}
        />
      </div>
    </>
  );

  const renderAttachments = () => (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Paperclip className="h-3.5 w-3.5" />
          Attachments
        </p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {attachments.length} file{attachments.length !== 1 ? "s" : ""}
        </span>
      </div>
      {attachments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          No documents attached to this requisition
        </p>
      ) : (
        <ul className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-2">
          {attachments.map((doc, idx) => {
            const href = attachmentHref(doc);
            const downloadHref = attachmentDownloadHref(doc);
            const label =
              doc.document_name ||
              doc.original_name ||
              doc.name ||
              `Document ${idx + 1}`;
            const sizeLabel = formatFileSize(doc.file_size || doc.size);
            return (
              <li
                key={doc.id || doc.file_path || `${label}-${idx}`}
                className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--aa-accent)]" />
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate font-medium text-[var(--aa-accent)] hover:text-[var(--aa-navy)] hover:underline"
                    >
                      {label}
                    </a>
                  ) : (
                    <span className="truncate">{label}</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-400">
                  {sizeLabel ? <span className="mr-1">{sizeLabel}</span> : null}
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View"
                      aria-label={`View ${label}`}
                      className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-[var(--aa-navy)]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  {downloadHref ? (
                    <a
                      href={downloadHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={label}
                      title="Download"
                      aria-label={`Download ${label}`}
                      className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-[var(--aa-navy)]"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const renderDefaultContent = () => (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Package className="h-3.5 w-3.5" />
          Line items
        </p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {itemList.length} item{itemList.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className={`${thClass} w-12`}>S/N</th>
              <th className={thClass}>Item code</th>
              <th className={thClass}>Item name</th>
              <th className={thClass}>UoM</th>
              <th className={`${thClass} text-right`}>Qty</th>
              {mode === "review" && (
                <th className={`${thClass} text-right`}>Approved qty</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white">
            {itemList.map((item, idx) => (
              <tr
                key={item.id || item.item_list_id || item.rowId || idx}
                className={trClass}
              >
                <td className={`${tdClass} text-slate-400`}>{idx + 1}</td>
                <td
                  className={`${tdClass} font-mono text-[12px] font-medium text-slate-600`}
                >
                  {item.item_code}
                </td>
                <td className={`${tdClass} font-medium text-slate-900`}>
                  {item.item_name}
                </td>
                <td className={`${tdClass} text-slate-500`}>
                  {item.unit_measure}
                </td>
                <td
                  className={`${tdClass} text-right font-mono tabular-nums text-slate-700`}
                >
                  {formatNumber1(item.quantity)}
                </td>
                {mode === "review" && (
                  <td className={`${tdClass} text-right`}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`${inputClass} ml-auto w-[5.5rem] bg-white text-right tabular-nums`}
                      value={item.approved_qty ?? ""}
                      onChange={(e) => {
                        const requestedQty = parseFloat(item.quantity) || 0;
                        let approvedQty = parseFloat(e.target.value);
                        if (!Number.isFinite(approvedQty)) approvedQty = 0;
                        if (approvedQty > requestedQty)
                          approvedQty = requestedQty;
                        if (approvedQty < 0) approvedQty = 0;
                        setItemList((prev) =>
                          prev.map((listItem) =>
                            listItem.rowId === item.rowId
                              ? { ...listItem, approved_qty: approvedQty }
                              : listItem,
                          ),
                        );
                      }}
                    />
                  </td>
                )}
              </tr>
            ))}
            {itemList.length === 0 && (
              <tr className="bg-white">
                <td
                  colSpan={mode === "review" ? 6 : 5}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  No line items on this requisition
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderReviewApproveContent = () => (
    <div className="mt-6 space-y-3 border-t border-slate-200 pt-5">
      {mode === "approve" && (
        <div>
          <label className={labelClass}>
            Approve amount{" "}
            <span className="font-mono text-slate-800">
              (₦{formatNumber1(amount)})
            </span>
          </label>
          <input
            className={inputClass}
            name="amount"
            value={amount}
            type="number"
            onChange={({ target: { value } }) => setAmount(value)}
          />
        </div>
      )}
      <div>
        <label className={labelClass}>
          Remark <span className="text-rose-500">*</span>
        </label>
        <textarea
          className={textareaClass}
          value={remark}
          onChange={({ target: { value } }) => setRemark(value)}
          placeholder="Add an approval remark…"
        />
        {mode === "review" && !remark ? (
          <p className="mt-1.5 text-[11px] text-slate-500">
            A remark is required before you can approve.
          </p>
        ) : null}
      </div>
    </div>
  );

  return (
    <Sheet
      open={!!isOpen}
      onOpenChange={(open) => {
        if (!open) toggle?.();
      }}
    >
      <SheetContent
        side="right"
        className="!inset-y-0 !right-0 !left-auto flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l border-slate-200 p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:!max-w-xl md:!max-w-2xl lg:!max-w-3xl [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:bg-white/10 [&>button]:hover:opacity-100"
      >
        <SheetHeader className="shrink-0 space-y-1 border-b border-slate-200 bg-[var(--aa-navy)] px-5 py-4 pr-12 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-white/10 p-2">
              <ClipboardCheck className="h-4 w-4 text-[var(--aa-accent)]" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-lg font-semibold leading-tight text-white">
                {header}
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-xs text-white/70">
                {modeSubtitle[mode] || "Review requisition"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-5 md:px-6">
          {mode === "review_rejected" ? (
            renderReviewRejectedContent()
          ) : (
            <div>
              {renderHeaderSection()}

              {mode === "receive"
                ? renderReceiveModeContent()
                : renderDefaultContent()}

              {(mode === "review" || mode === "approve") &&
                renderReviewApproveContent()}

              {mode !== "receive" ? renderAttachments() : null}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/90 px-5 py-3.5">
          <div className="hidden text-xs text-slate-500 sm:block">
            {itemList.length > 0
              ? `${itemList.length} line item${itemList.length !== 1 ? "s" : ""}`
              : null}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {(mode === "preview" || mode === "receive") && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={cancel}
                  disabled={loading2}
                  className="border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleFormSubmit}
                  disabled={loading2}
                  className="gap-1.5 border-0 bg-[var(--aa-navy)] text-white hover:bg-[var(--aa-navy)]/90"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Submit
                </Button>
              </>
            )}
            {mode === "review" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggle}
                  className="border-slate-200"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleFormSubmit}
                  disabled={remark === ""}
                  className="gap-1.5 border-0 bg-[var(--aa-navy)] text-white hover:bg-[var(--aa-navy)]/90 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve
                </Button>
              </>
            )}
            {mode === "approve" && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={reject}
                  disabled={remark === ""}
                  className="border-rose-200 text-rose-700 hover:bg-rose-50"
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={approveMemo}
                  disabled={amount === ""}
                  className="gap-1.5 border-0 bg-[var(--aa-navy)] text-white hover:bg-[var(--aa-navy)]/90 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Submit
                </Button>
              </>
            )}
            {mode === "review_rejected" && (
              <Button
                type="button"
                size="sm"
                onClick={handleEdit}
                disabled={loading2}
                className="border-0 bg-[var(--aa-navy)] text-white hover:bg-[var(--aa-navy)]/90"
              >
                {loading2 ? "Submitting…" : "Submit"}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

CustomRequisitionModal.propTypes = {
  isOpen: PropTypes.bool,
  toggle: PropTypes.func,
  header: PropTypes.string,
  itemList: PropTypes.array,
  items: PropTypes.object,
  activeBusiness: PropTypes.object,
  cancel: PropTypes.func,
  approveMemo: PropTypes.func,
  reject: PropTypes.func,
  remark: PropTypes.string,
  setRemark: PropTypes.func,
  amount: PropTypes.any,
  setAmount: PropTypes.func,
  logs: PropTypes.array,
  mode: PropTypes.string,
  form: PropTypes.object,
  handleChange: PropTypes.func,
  handleEdit: PropTypes.func,
  loading2: PropTypes.bool,
  waybillNumber: PropTypes.string,
  truckNumber: PropTypes.string,
  setWaybillNumber: PropTypes.func,
  setTruckNumber: PropTypes.func,
  attachments: PropTypes.array,
};

export default CustomRequisitionModal;
