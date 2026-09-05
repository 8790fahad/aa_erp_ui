/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import moment from "moment";
import { _fetchApi, _postApi, apiURL } from "@/redux/actions/api";
import { toast } from "sonner";
import { FileText, Loader2, Paperclip, Plus, Trash2, Upload, X, ExternalLink } from "lucide-react";
import { formatNumber1 } from "@/components/router/utilities";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  cloudinaryDocumentHref,
  formatCloudinaryFileSize,
  pickAndStageCloudinaryFiles,
} from "@/utils/cloudinaryDocuments";

const inputClass =
  "h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[var(--aa-navy,#0f2744)] focus:ring-1 focus:ring-[var(--aa-navy,#0f2744)]";

const MEMO_FILE_MAX_BYTES = 25 * 1024 * 1024;
const MEMO_FILE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const emptyLine = () => ({
  item_name: "",
  unit_cost: "",
  quantity: "1",
  description: "",
});

const emptyForm = (raiseBy = "", branch = "General") => ({
  date: moment().format("YYYY-MM-DD"),
  priority: "Medium",
  recipient: "Managing Director",
  from_name: branch,
  raise_by: raiseBy,
  subject: "",
  purpose: "",
});

/**
 * Full Internal Memo create/edit modal (matches preview fields + line items).
 */
export default function MemoFormModal({
  open,
  onOpenChange,
  memoId = null,
  onSuccess,
}) {
  const { user = {}, activeBusiness = {} } = useSelector((state) => state.auth);
  const isEditMode = Boolean(memoId);

  const raiseByDefault =
    [user.firstname, user.lastname].filter(Boolean).join(" ") ||
    user.fullname ||
    user.username ||
    "User";

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(() => emptyForm(raiseByDefault));
  const [lines, setLines] = useState([emptyLine()]);
  const [draft, setDraft] = useState(emptyLine());
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);
  const attachmentUploading = files.some((doc) => doc.uploading);

  const grandTotal = useMemo(
    () =>
      lines.reduce(
        (sum, row) =>
          sum + (Number(row.unit_cost) || 0) * (Number(row.quantity) || 0),
        0
      ),
    [lines]
  );

  const resetAll = useCallback(
    (branch) => {
      setForm(emptyForm(raiseByDefault, branch || branches[0] || "General"));
      setLines([]);
      setDraft(emptyLine());
      setFiles([]);
      setErrors({});
    },
    [branches, raiseByDefault]
  );

  const handleChange = ({ target: { name, value } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleDraftChange = ({ target: { name, value } }) => {
    setDraft((prev) => ({ ...prev, [name]: value }));
  };

  const addLine = () => {
    if (!draft.item_name.trim()) {
      toast.error("Item name is required");
      return;
    }
    if (!draft.unit_cost || Number(draft.unit_cost) <= 0) {
      toast.error("Unit cost must be greater than 0");
      return;
    }
    if (!draft.quantity || Number(draft.quantity) <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        item_name: draft.item_name.trim(),
        unit_cost: Number(draft.unit_cost),
        quantity: Number(draft.quantity),
        description: draft.description.trim() || draft.item_name.trim(),
      },
    ]);
    setDraft(emptyLine());
    setErrors((prev) => ({ ...prev, lines: "" }));
  };

  const removeLine = (index) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    const next = {};
    if (!form.subject.trim()) next.subject = "Subject is required";
    if (!form.purpose.trim()) next.purpose = "Description is required";
    if (!form.from_name.trim()) next.from_name = "From branch is required";
    if (!form.recipient.trim()) next.recipient = "Recipient is required";
    if (!form.raise_by.trim()) next.raise_by = "Raised by is required";
    if (!form.priority) next.priority = "Priority is required";
    if (lines.length === 0) next.lines = "Add at least one line item";
    if (grandTotal <= 0) next.lines = next.lines || "Total must be greater than 0";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const fetchBranches = useCallback(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/branches/get?facilityId=${activeBusiness.id}&query_type=list`,
      (data) => {
        const names = (data.results || [])
          .map((b) => b.storeName || b.branch_name || b.name)
          .filter(Boolean);
        setBranches(names.length ? names : ["General"]);
        setForm((prev) =>
          prev.from_name
            ? prev
            : { ...prev, from_name: names[0] || "General" }
        );
      },
      () => {
        setBranches(["General"]);
        setForm((prev) =>
          prev.from_name ? prev : { ...prev, from_name: "General" }
        );
      }
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    if (!open) return;
    fetchBranches();
    if (!isEditMode) {
      resetAll(branches[0] || "General");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when modal opens
  }, [open, isEditMode, fetchBranches]);

  useEffect(() => {
    if (!open || !isEditMode || !memoId || !activeBusiness?.id) return;
    setLoadingData(true);
    _fetchApi(
      `/account/get-memo-by-id/${activeBusiness.id}/returned?memo_id=${memoId}`,
      (response) => {
        const m = response.memo || response.results?.[0];
        if (!response.success || !m) {
          setLoadingData(false);
          toast.error("Failed to load memo");
          onOpenChange?.(false);
          return;
        }
        setForm({
          date: moment(m.date).format("YYYY-MM-DD"),
          priority: m.priority || "Medium",
          recipient: m.recipient || "Managing Director",
          from_name: m.from_name || "General",
          raise_by: m.raise_by || raiseByDefault,
          subject: m.subject || "",
          purpose: m.purpose || m.details || "",
        });

        _postApi(
          "/account/memo-item-list",
          {
            query_type: "select",
            memo_id: memoId,
            facilityId: activeBusiness.id,
            user_id: user.id,
            date: moment().format("YYYY-MM-DD"),
          },
          (res) => {
            setLoadingData(false);
            if (res.success) {
              setLines(
                (res.results || []).map((row) => ({
                  item_name: row.item_name || "",
                  unit_cost: Number(row.unit_cost) || 0,
                  quantity: Number(row.quantity) || 1,
                  description: row.description || row.item_name || "",
                }))
              );
            }
          },
          () => {
            setLoadingData(false);
            toast.error("Error loading memo items");
          }
        );
      },
      () => {
        setLoadingData(false);
        toast.error("Error loading memo");
        onOpenChange?.(false);
      }
    );
  }, [
    open,
    isEditMode,
    memoId,
    activeBusiness?.id,
    onOpenChange,
    raiseByDefault,
    user.id,
  ]);

  const handleSubmit = async () => {
    if (!validate()) return;
    if (files.some((doc) => doc.uploading)) {
      toast.error("Wait for document uploads to finish");
      return;
    }
    setLoading(true);

    const submitData = {
      date: form.date,
      from_name: form.from_name,
      subject: form.subject.trim(),
      purpose: form.purpose.trim(),
      details: form.purpose.trim(),
      recipient: form.recipient.trim(),
      raise_by: form.raise_by.trim(),
      priority: form.priority || "Medium",
      query_type: isEditMode ? "update" : "insert",
      prefix: activeBusiness.prefix,
      facilityId: activeBusiness.id,
      user_id: user.id,
      total: grandTotal,
      amount: 0,
      remark: "",
      description: form.purpose.trim(),
      pr_no: null,
      reference_number: "",
      status: "pending",
      supplier_name: "",
      supplier_code: "",
      supplier_number: "",
      account_code: "",
      expenses: lines.map((row) => ({
        item: row.item_name,
        description: row.description || row.item_name,
        unitCost: Number(row.unit_cost),
        quantity: Number(row.quantity) || 1,
        item_code: "",
        chart_code: "",
      })),
      justificationPoints: [],
      existing_document_ids: [],
      attachments: files
        .filter((doc) => doc.file_path && !doc.uploading)
        .map((doc) => ({
          file_path: doc.file_path,
          url: doc.url || doc.file_path,
          document_name: doc.document_name || doc.original_name || doc.name,
          original_name: doc.original_name || doc.name,
          file_size: doc.file_size || doc.size,
          mime_type: doc.mime_type,
        })),
    };

    if (isEditMode && memoId) submitData.memo_id = memoId;

    const endpoint = isEditMode
      ? "/account/update-memo"
      : "/account/insert-memo";

    const formData = new FormData();
    formData.append("memo_data", JSON.stringify(submitData));

    try {
      const response = await fetch(`${apiURL}${endpoint}`, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const res = await response.json();
      if (res.success) {
        const createdId = res.results?.[0]?.memo_id;
        toast.success(
          isEditMode
            ? "Memo updated"
            : createdId
              ? `Memo ${createdId} created`
              : "Memo submitted"
        );
        resetAll();
        onOpenChange?.(false);
        onSuccess?.(createdId || memoId);
      } else {
        toast.error(res.message || "Error occurred");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error Occurred");
    } finally {
      setLoading(false);
    }
  };

  const draftLineTotal =
    (Number(draft.unit_cost) || 0) * (Number(draft.quantity) || 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!inset-y-0 !right-0 !left-auto flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l border-slate-200 p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:!max-w-xl md:!max-w-2xl lg:!max-w-3xl [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:bg-white/10 [&>button]:hover:opacity-100"
      >
        <SheetHeader className="shrink-0 space-y-1 border-b border-slate-200 bg-[var(--aa-navy,#0f2744)] px-5 py-4 pr-12 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-white/10 p-2">
              <FileText className="h-4 w-4 text-white/90" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-lg font-semibold leading-tight text-white">
                {isEditMode ? "Edit Memo" : "Add new memo"}
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-xs text-white/70">
                Fill Internal Memo fields, add line items, then submit
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {loadingData ? (
          <div className="flex flex-1 items-center justify-center text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading memo…
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">
                    Date
                  </span>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">
                    Priority <span className="text-red-500">*</span>
                  </span>
                  <select
                    name="priority"
                    value={form.priority}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">
                    Memo No.
                  </span>
                  <input
                    value={isEditMode && memoId ? memoId : "Auto-generated"}
                    disabled
                    className={`${inputClass} bg-slate-50 text-slate-500`}
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">
                    Recipient <span className="text-red-500">*</span>
                  </span>
                  <input
                    name="recipient"
                    value={form.recipient}
                    onChange={handleChange}
                    placeholder="Managing Director"
                    className={inputClass}
                  />
                  {errors.recipient && (
                    <span className="text-xs text-red-500">
                      {errors.recipient}
                    </span>
                  )}
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">
                    From branch <span className="text-red-500">*</span>
                  </span>
                  <select
                    name="from_name"
                    value={form.from_name}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    {(branches.length ? branches : ["General"]).map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  {errors.from_name && (
                    <span className="text-xs text-red-500">
                      {errors.from_name}
                    </span>
                  )}
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">
                    Raised by <span className="text-red-500">*</span>
                  </span>
                  <input
                    name="raise_by"
                    value={form.raise_by}
                    onChange={handleChange}
                    className={inputClass}
                  />
                  {errors.raise_by && (
                    <span className="text-xs text-red-500">
                      {errors.raise_by}
                    </span>
                  )}
                </label>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Subject <span className="text-red-500">*</span>
                </span>
                <input
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  placeholder="e.g. Office supplies"
                  className={inputClass}
                />
                {errors.subject && (
                  <span className="text-xs text-red-500">{errors.subject}</span>
                )}
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Description <span className="text-red-500">*</span>
                </span>
                <textarea
                  name="purpose"
                  value={form.purpose}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Brief description / purpose"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--aa-navy,#0f2744)] focus:ring-1 focus:ring-[var(--aa-navy,#0f2744)]"
                />
                {errors.purpose && (
                  <span className="text-xs text-red-500">{errors.purpose}</span>
                )}
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold uppercase text-slate-800">
                    Details
                  </span>
                  <span className="text-sm font-semibold text-[var(--aa-navy,#0f2744)]">
                    Total: ₦{formatNumber1(grandTotal)}
                  </span>
                </div>
                {errors.lines && (
                  <p className="mb-2 text-xs text-red-500">{errors.lines}</p>
                )}

                <div className="mb-3 grid gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50/80 p-3 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <span className="mb-1 block text-xs font-medium text-slate-600">
                      Item name
                    </span>
                    <input
                      name="item_name"
                      value={draft.item_name}
                      onChange={handleDraftChange}
                      placeholder="e.g. Fuel"
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <span className="mb-1 block text-xs font-medium text-slate-600">
                      Unit cost (₦)
                    </span>
                    <input
                      type="number"
                      name="unit_cost"
                      min="0"
                      step="0.01"
                      value={draft.unit_cost}
                      onChange={handleDraftChange}
                      placeholder="0.00"
                      className={`${inputClass} text-right`}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-slate-600">
                      Qty
                    </span>
                    <input
                      type="number"
                      name="quantity"
                      min="1"
                      step="1"
                      value={draft.quantity}
                      onChange={handleDraftChange}
                      className={`${inputClass} text-center`}
                    />
                  </div>
                  <div className="flex items-end justify-between gap-2 sm:col-span-3">
                    <div className="min-w-0">
                      <span className="mb-1 block text-xs font-medium text-slate-600">
                        Line total
                      </span>
                      <p className="h-10 truncate leading-10 text-sm font-semibold text-slate-800">
                        ₦{formatNumber1(draftLineTotal)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addLine}
                      className="inline-flex h-10 shrink-0 items-center gap-1 rounded-md bg-[var(--aa-navy,#0f2744)] px-3 text-sm font-semibold text-white hover:bg-[var(--aa-navy-hover,#243a73)]"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                      <tr>
                        <th className="px-2 py-2 text-center">S/N</th>
                        <th className="px-2 py-2 text-left">Item Name</th>
                        <th className="px-2 py-2 text-right">Unit Cost (₦)</th>
                        <th className="px-2 py-2 text-center">Qty</th>
                        <th className="px-2 py-2 text-right">Total (₦)</th>
                        <th className="px-2 py-2 text-center"> </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-6 text-center text-sm text-slate-500"
                          >
                            No line items yet — add one above
                          </td>
                        </tr>
                      ) : (
                        lines.map((row, idx) => (
                          <tr key={idx} className="border-t border-slate-100">
                            <td className="px-2 py-2 text-center">{idx + 1}</td>
                            <td className="px-2 py-2">{row.item_name}</td>
                            <td className="px-2 py-2 text-right">
                              {formatNumber1(row.unit_cost)}
                            </td>
                            <td className="px-2 py-2 text-center">
                              {Number(row.quantity).toLocaleString()}
                            </td>
                            <td className="px-2 py-2 text-right">
                              {formatNumber1(
                                Number(row.unit_cost) * Number(row.quantity)
                              )}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeLine(idx)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50"
                                aria-label="Remove line"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td
                          colSpan={4}
                          className="px-2 py-2.5 text-right text-sm font-semibold"
                        >
                          TOTAL (₦):
                        </td>
                        <td className="px-2 py-2.5 text-right text-sm font-semibold text-[var(--aa-navy,#0f2744)]">
                          {formatNumber1(grandTotal)}
                        </td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Attachments
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Supporting documents (PDF, PNG, JPG, DOCX)
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">
                    {files.length} {files.length === 1 ? "file" : "files"}
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files || []);
                    e.target.value = "";
                    pickAndStageCloudinaryFiles({
                      picked,
                      kind: "memos",
                      setItems: setFiles,
                      allowedTypes: MEMO_FILE_TYPES,
                      maxBytes: MEMO_FILE_MAX_BYTES,
                    });
                  }}
                />
                <button
                  type="button"
                  disabled={loading || attachmentUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {attachmentUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {attachmentUploading ? "Uploading…" : "Upload documents"}
                </button>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Files upload to Cloudinary as soon as you select them. 25MB each.
                </p>
                {files.length > 0 ? (
                  <ul className="mt-3 space-y-1.5">
                    {files.map((file, idx) => {
                      const href = file.uploading
                        ? null
                        : cloudinaryDocumentHref(file);
                      const label =
                        file.document_name || file.original_name || file.name;
                      const sizeBytes = file.file_size || file.size;
                      return (
                        <li
                          key={file.clientId || `${label}-${idx}`}
                          className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                        >
                          <span className="flex min-w-0 items-center gap-1.5 truncate">
                            {file.uploading ? (
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--aa-accent)]" />
                            ) : (
                              <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--aa-accent)]" />
                            )}
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate text-[var(--aa-accent)] hover:text-[var(--aa-navy)] hover:underline"
                              >
                                {label}
                                {formatCloudinaryFileSize(sizeBytes) ? (
                                  <span className="text-slate-400">
                                    {" "}
                                    ({formatCloudinaryFileSize(sizeBytes)})
                                  </span>
                                ) : null}
                              </a>
                            ) : (
                              <span className="truncate">
                                {label}
                                {formatCloudinaryFileSize(sizeBytes) ? (
                                  <span className="text-slate-400">
                                    {" "}
                                    ({formatCloudinaryFileSize(sizeBytes)})
                                  </span>
                                ) : null}
                              </span>
                            )}
                            {href ? (
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                            ) : null}
                            {file.uploading ? (
                              <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                Uploading
                              </span>
                            ) : (
                              <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                Uploaded
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            disabled={loading || file.uploading}
                            onClick={() =>
                              setFiles((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                            className="shrink-0 text-red-600 hover:text-red-700"
                            title="Remove"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3">
              <div className="mb-2 flex justify-end text-sm font-semibold text-[var(--aa-navy,#0f2744)]">
                Total: ₦{formatNumber1(grandTotal)}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange?.(false)}
                  className="h-10 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading || attachmentUploading}
                  onClick={handleSubmit}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--aa-navy,#0f2744)] px-5 text-sm font-semibold text-white hover:bg-[var(--aa-navy-hover,#243a73)] disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isEditMode ? "Update" : "Submit"}
                </button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
