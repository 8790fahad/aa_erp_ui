import { useState, useEffect } from "react";
import { Collapse } from "reactstrap";
import moment from "moment";
import PropTypes from "prop-types";
import { formatNumber1 } from "@/components/router/utilities";
import { X, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]";
const textareaClass =
  "min-h-[88px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]";
const labelClass = "mb-1.5 block text-xs font-medium text-slate-600";
const thClass =
  "border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500";
const tdClass =
  "border-b border-slate-100/80 bg-white px-4 py-2.5 text-sm text-slate-700";
const trClass = "bg-white hover:bg-slate-50/60";

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
          className="mb-2"
        >
          {isOpen3 ? "Hide" : "Show"} memo log
        </Button>
        <Collapse isOpen={isOpen3}>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full">
              <thead>
                <tr>
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
    <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-4 text-center">
      <h2 className="text-base font-semibold uppercase tracking-wide text-slate-900">
        {activeBusiness?.business_name}
      </h2>
      <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">
        {mode === "receive"
          ? "Goods Received Note"
          : mode === "review"
            ? "Requisition Approval"
            : "Review"}
      </p>
    </div>
  );

  const MetaRow = ({ label, value, align = "left" }) => (
    <div className={align === "right" ? "text-right" : ""}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <div className="mt-0.5 text-sm font-medium text-slate-800">
        {value || "—"}
      </div>
    </div>
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

      <p className="mb-2 text-sm font-semibold text-slate-800">Goods detail</p>

      <div className="overflow-x-auto rounded-lg border border-slate-200/80">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className={thClass} colSpan={2}>
                Order
              </th>
              <th className={thClass} colSpan={5}>
                Receive
              </th>
            </tr>
            <tr className="border-b border-slate-100 bg-slate-50/80">
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
                <td className={`${tdClass} text-right font-mono font-medium text-[var(--aa-accent)]`}>
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

      <div className="mt-3 flex flex-wrap justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
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

  const renderDefaultContent = () => (
    <div className="overflow-x-auto rounded-lg border border-slate-200/80">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80">
            <th className={thClass}>S/N</th>
            <th className={thClass}>Item Code</th>
            <th className={thClass}>Item Name</th>
            <th className={thClass}>Unit of Measure</th>
            <th className={`${thClass} text-right`}>Quantity</th>
            {mode === "review" && (
              <th className={`${thClass} text-right`}>Approved Qty</th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white">
          {itemList.map((item, idx) => (
            <tr
              key={item.id || item.item_list_id || item.rowId || idx}
              className={trClass}
            >
              <td className={tdClass}>{idx + 1}</td>
              <td className={`${tdClass} font-mono text-[13px] font-semibold text-slate-800`}>
                {item.item_code}
              </td>
              <td className={`${tdClass} font-medium text-slate-800`}>
                {item.item_name}
              </td>
              <td className={tdClass}>{item.unit_measure}</td>
              <td className={`${tdClass} text-right font-mono tabular-nums text-slate-600`}>
                {formatNumber1(item.quantity)}
              </td>
              {mode === "review" && (
                <td className={`${tdClass} text-right`}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={`${inputClass} ml-auto w-[90px] bg-white text-center`}
                    value={item.approved_qty ?? ""}
                    onChange={(e) => {
                      const requestedQty = parseFloat(item.quantity) || 0;
                      let approvedQty = parseFloat(e.target.value);
                      if (!Number.isFinite(approvedQty)) approvedQty = 0;
                      if (approvedQty > requestedQty) approvedQty = requestedQty;
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
                className="bg-white px-4 py-8 text-center text-sm text-slate-500"
              >
                No line items
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderReviewApproveContent = () => (
    <div className="mt-4 space-y-3">
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
        <label className={labelClass}>Remark</label>
        <textarea
          className={textareaClass}
          value={remark}
          onChange={({ target: { value } }) => setRemark(value)}
          placeholder="Add a remark to approve…"
        />
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-[var(--aa-navy)] px-5 py-4 pr-4 text-white">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-white/10 p-2">
              <ClipboardCheck className="h-4 w-4 text-[var(--aa-accent)]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold leading-tight">{header}</h3>
              <p className="mt-0.5 text-xs text-slate-300">
                {modeSubtitle[mode] || "Review requisition"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggle}
            className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          {mode === "review_rejected" ? (
            renderReviewRejectedContent()
          ) : (
            <div>
              {renderHeaderSection()}

              <div className="mb-5 grid gap-4 sm:grid-cols-2">
                <MetaRow
                  label="Date"
                  value={
                    items?.date
                      ? moment(items.date).format("DD-MMM-YYYY")
                      : "—"
                  }
                />
                <MetaRow label="PR No." value={items?.pr_no} align="right" />
                <MetaRow label="From branch" value={items?.branch} />
                {mode === "receive" && (
                  <MetaRow label="PO No." value={items?.po_no} align="right" />
                )}
                {mode !== "review" && (
                  <MetaRow label="Raised by" value={items?.requisitor} />
                )}
                <MetaRow
                  label="Reason"
                  value={items?.reason}
                  align={mode === "review" ? "right" : "left"}
                />
                <div className="sm:col-span-2">
                  <MetaRow
                    label="Supplier"
                    value={
                      items?.supplier_name
                        ? `${items.supplier_name}${
                            items?.supplier_code
                              ? ` (${items.supplier_code})`
                              : ""
                          }`
                        : "—"
                    }
                  />
                </div>
              </div>

              {mode === "receive"
                ? renderReceiveModeContent()
                : renderDefaultContent()}

              {(mode === "review" || mode === "approve") &&
                renderReviewApproveContent()}
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          {(mode === "preview" || mode === "receive") && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={cancel}
                disabled={loading2}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleFormSubmit}
                disabled={loading2}
                className="bg-[var(--aa-accent)] text-white hover:opacity-90"
              >
                Submit
              </Button>
            </>
          )}
          {mode === "review" && (
            <Button
              type="button"
              size="sm"
              onClick={handleFormSubmit}
              disabled={remark === ""}
              className="bg-[var(--aa-accent)] text-white hover:opacity-90 disabled:opacity-50"
            >
              Approve
            </Button>
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
                className="bg-[var(--aa-accent)] text-white hover:opacity-90 disabled:opacity-50"
              >
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
              className="bg-[var(--aa-accent)] text-white hover:opacity-90"
            >
              {loading2 ? "Submitting…" : "Submit"}
            </Button>
          )}
        </div>
      </div>
    </div>
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
};

export default CustomRequisitionModal;
