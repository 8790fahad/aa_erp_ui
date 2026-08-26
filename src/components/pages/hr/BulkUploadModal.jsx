import { useMemo, useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";
import { AA_NAVY } from "@/lib/aaBrand";

/**
 * Generic bulk-upload modal.
 *
 * Props:
 *  - open          : boolean
 *  - onClose       : () => void
 *  - onSuccess     : () => void   — called after a successful import
 *  - title         : string
 *  - templateCols  : { key, label, example, required? }[]
 *  - exampleRows   : object[] (optional)
 *  - mapRow        : (rawRow) => object
 *  - requiredKeys  : string[] (optional) — defaults to all templateCols except status
 *  - apiEndpoint   : string
 *  - payloadKey    : string
 *  - facilityId    : string
 *  - createdBy     : string
 */
export default function BulkUploadModal({
  open,
  onClose,
  onSuccess,
  title = "Bulk Upload",
  templateCols = [],
  exampleRows,
  mapRow,
  requiredKeys,
  apiEndpoint,
  payloadKey,
  facilityId,
  createdBy,
  primaryColor = AA_NAVY,
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef(null);
  const dragCounter = useRef(0);

  const resolvedRequiredKeys = useMemo(() => {
    if (Array.isArray(requiredKeys) && requiredKeys.length > 0) {
      return requiredKeys;
    }
    return templateCols
      .filter((c) => {
        if (c.required === false) return false;
        if (c.required === true) return true;
        const k = String(c.key || "")
          .trim()
          .toLowerCase();
        return k !== "status";
      })
      .map((c) => c.key);
  }, [requiredKeys, templateCols]);

  const isStatusColumn = (key) =>
    String(key || "")
      .trim()
      .toLowerCase() === "status";

  const statusBadgeClass = (value) => {
    const s = String(value || "")
      .trim()
      .toLowerCase();
    if (s === "verified" || s === "active") {
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }
    if (s === "pending") {
      return "bg-amber-100 text-amber-800 border-amber-200";
    }
    if (s === "suspended" || s === "inactive") {
      return "bg-red-100 text-red-800 border-red-200";
    }
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const shadeColor = (hex, percent) => {
    const h = hex.replace("#", "").trim();
    if (![3, 6].includes(h.length)) return hex;
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const num = parseInt(full, 16);
    const amt = Math.round(2.55 * percent);
    const r = Math.min(255, Math.max(0, (num >> 16) + amt));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };

  const labelForKey = (key) => {
    const col = templateCols.find((c) => c.key === key);
    return col?.label || key;
  };

  const getMissingRequired = (mapped) => {
    const missing = [];
    for (const key of resolvedRequiredKeys) {
      const val = mapped?.[key];
      if (val == null || String(val).trim() === "") {
        missing.push(labelForKey(key));
      }
    }
    return missing;
  };

  const isCompletelyBlank = (mapped) => {
    if (!mapped || typeof mapped !== "object") return true;
    return Object.values(mapped).every(
      (v) => v == null || String(v).trim() === "",
    );
  };

  const classifiedPreview = useMemo(() => {
    const valid = [];
    const incomplete = [];

    preview.forEach((raw, index) => {
      const mapped = mapRow ? mapRow(raw) : raw;
      const excelRow = index + 2; // header is row 1
      if (isCompletelyBlank(mapped)) return;

      const missing = getMissingRequired(mapped);
      if (missing.length > 0) {
        incomplete.push({
          excelRow,
          raw,
          mapped,
          missing,
        });
      } else {
        valid.push({
          excelRow,
          raw,
          mapped,
        });
      }
    });

    return { valid, incomplete };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, mapRow, resolvedRequiredKeys, templateCols]);

  const resultGroups = useMemo(() => {
    const errors = Array.isArray(result?.errors) ? result.errors : [];
    const missingRequired = [];
    const other = [];
    for (const e of errors) {
      const msg = String(e?.message || "").toLowerCase();
      if (
        msg.includes("required") ||
        msg.includes("missing") ||
        msg.includes("are required")
      ) {
        missingRequired.push(e);
      } else {
        other.push(e);
      }
    }
    return { missingRequired, other };
  }, [result]);

  if (!open) return null;

  const handleDownloadTemplate = () => {
    const headers = templateCols.map((c) => c.label);
    const sampleRows =
      Array.isArray(exampleRows) && exampleRows.length > 0
        ? exampleRows.map((row) =>
            templateCols.map((c) => {
              if (row[c.key] !== undefined && row[c.key] !== null)
                return row[c.key];
              return c.example ?? "";
            }),
          )
        : [templateCols.map((c) => c.example ?? "")];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    ws["!cols"] = templateCols.map((c) => ({
      wch: Math.max(14, String(c.label || "").length + 2),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${title.replace(/\s+/g, "_")}_Template.xlsx`);
    toast.success("Template downloaded");
  };

  const processFile = (f) => {
    if (!f) return;
    const name = f.name?.toLowerCase() || "";
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      toast.error("Please upload an .xlsx or .xls file");
      return;
    }
    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });
        setPreviewTotal(raw.length);
        setPreview(raw);
      } catch (err) {
        toast.error("Could not read file: " + err.message);
        setFile(null);
        setPreview([]);
        setPreviewTotal(0);
      }
    };
    reader.readAsBinaryString(f);
  };

  const handleFileChange = (e) => {
    processFile(e.target.files?.[0]);
    if (e.target) e.target.value = "";
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) processFile(dropped);
  };

  const applyResultPayload = (payload) => {
    setResult({
      created: payload.created ?? 0,
      failed: payload.failed ?? payload.errors?.length ?? 0,
      errors: payload.errors || [],
      roles_created: payload.roles_created,
      branches_created: payload.branches_created,
      transactional: payload.transactional,
    });
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    const { valid, incomplete } = classifiedPreview;
    if (valid.length === 0) {
      toast.error(
        incomplete.length
          ? "No complete rows to import — fix missing required fields first"
          : "No data rows found in the file",
      );
      return;
    }

    if (incomplete.length > 0) {
      toast.message(
        `Importing ${valid.length} complete row(s). ${incomplete.length} incomplete row(s) will be skipped.`,
      );
    }

    setUploading(true);
    setResult(null);

    const rows = valid.map((r) => r.mapped);

    _postApi(
      apiEndpoint,
      { [payloadKey]: rows, facilityId, createdBy },
      (data) => {
        if (data?.success) {
          const payload = data.data || {};
          const failed = Number(payload.failed) || 0;
          const created = Number(payload.created) || 0;
          toast.success(data.message || "Upload complete");

          if (failed === 0 && created > 0 && incomplete.length === 0) {
            setFile(null);
            setPreview([]);
            setPreviewTotal(0);
            setResult(null);
            setUploading(false);
            onSuccess?.();
            return;
          }

          applyResultPayload({
            ...payload,
            created,
            failed,
            errors: [
              ...(payload.errors || []),
              ...incomplete.map((row) => ({
                row: row.excelRow,
                message: `Missing required: ${row.missing.join(", ")} (skipped)`,
              })),
            ],
          });
          setUploading(false);
          if (created > 0) onSuccess?.();
          return;
        }

        const payload = data?.data || data;
        if (payload?.errors?.length || payload?.failed > 0) {
          applyResultPayload({
            ...payload,
            errors: [
              ...(payload.errors || []),
              ...incomplete.map((row) => ({
                row: row.excelRow,
                message: `Missing required: ${row.missing.join(", ")} (skipped)`,
              })),
            ],
          });
        }
        toast.error(data?.message || "Upload failed — no records were imported");
        setUploading(false);
      },
      (err) => {
        const payload = err?.data || err;
        const errors = Array.isArray(payload?.errors) ? payload.errors : [];
        if (errors.length || payload?.failed > 0 || payload?.created != null) {
          applyResultPayload({
            ...payload,
            errors: [
              ...errors,
              ...incomplete.map((row) => ({
                row: row.excelRow,
                message: `Missing required: ${row.missing.join(", ")} (skipped)`,
              })),
            ],
          });
        }
        toast.error(
          err?.message ||
            "Upload failed — check that the API is reachable and the bulk endpoint is deployed.",
        );
        setUploading(false);
      },
    );
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setPreviewTotal(0);
    setResult(null);
    setIsDragging(false);
    dragCounter.current = 0;
    onClose();
  };

  const renderRawTable = (rows, emptyLabel) => {
    if (!rows.length) {
      return (
        <p className="px-4 py-3 text-xs text-slate-500">{emptyLabel}</p>
      );
    }
    const keys = Object.keys(rows[0].raw || rows[0] || {});
    return (
      <div className="max-h-52 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-[1]">
            <tr className="bg-slate-100">
              <th className="px-3 py-2 text-left font-bold text-slate-600 whitespace-nowrap">
                Excel Row
              </th>
              {keys.map((k) => (
                <th
                  key={k}
                  className="px-3 py-2 text-left font-bold text-slate-600 whitespace-nowrap"
                >
                  {k}
                </th>
              ))}
              {rows[0].missing ? (
                <th className="px-3 py-2 text-left font-bold text-slate-600 whitespace-nowrap">
                  Missing
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.excelRow}
                className="border-t border-slate-100"
              >
                <td className="px-3 py-1.5 font-semibold text-slate-500">
                  {row.excelRow}
                </td>
                {keys.map((k) => {
                  const v = row.raw?.[k];
                  return (
                    <td
                      key={k}
                      className="px-3 py-1.5 text-slate-700 whitespace-nowrap"
                    >
                      {isStatusColumn(k) ? (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${statusBadgeClass(
                            v,
                          )}`}
                        >
                          {String(v || "").trim() || "—"}
                        </span>
                      ) : (
                        String(v ?? "")
                      )}
                    </td>
                  );
                })}
                {row.missing ? (
                  <td className="px-3 py-1.5 text-red-700 font-medium whitespace-nowrap">
                    {row.missing.join(", ")}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[150]"
      style={{ ["--app-primary"]: primaryColor }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div
          className="text-white p-5 flex justify-between items-center"
          style={{
            background: `linear-gradient(to right, ${primaryColor}, ${shadeColor(
              primaryColor,
              -12,
            )})`,
          }}
        >
          <div>
            <h3 className="text-lg font-black">{title}</h3>
            <p className="text-white/80 text-xs mt-0.5 font-medium">
              Download the template, fill it in, then upload
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-slate-700 uppercase tracking-widest">
                  Step 1 — Get Template
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Download the Excel template with the required columns
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="gap-2 text-xs font-bold"
                style={{ borderColor: primaryColor, color: primaryColor }}
              >
                <Download size={14} />
                Download Template
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {templateCols.map((c) => {
                const req = resolvedRequiredKeys.includes(c.key);
                return (
                  <span
                    key={c.key}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      req
                        ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                        : "bg-slate-100 text-slate-600"
                    }`}
                    title={c.hint || undefined}
                  >
                    {c.label}
                    {req ? " *" : ""}
                  </span>
                );
              })}
            </div>
            {templateCols.some((c) => c.hint) ? (
              <ul className="mt-2 space-y-0.5">
                {templateCols
                  .filter((c) => c.hint)
                  .map((c) => (
                    <li
                      key={`hint-${c.key}`}
                      className="text-[11px] text-slate-500"
                    >
                      <span className="font-semibold text-slate-600">
                        {c.label}:
                      </span>{" "}
                      {c.hint}
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>

          <div className="border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3">
              Step 2 — Upload Filled File
            </p>
            <div
              role="button"
              tabIndex={0}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-[color:var(--app-primary)] bg-[color:var(--app-primary)]/10 ring-2 ring-[color:var(--app-primary)]/30"
                  : file
                    ? "border-emerald-300 bg-emerald-50/40 hover:border-emerald-400"
                    : "border-slate-200 hover:border-[color:var(--app-primary)] hover:bg-[color:var(--app-primary)]/5"
              }`}
              onClick={() => fileRef.current?.click()}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
              }}
            >
              <FileSpreadsheet
                className={`h-8 w-8 mx-auto mb-2 ${
                  isDragging
                    ? "text-[color:var(--app-primary)]"
                    : file
                      ? "text-emerald-500"
                      : "text-slate-400"
                }`}
              />
              {isDragging ? (
                <p className="text-sm font-bold text-[color:var(--app-primary)]">
                  Drop your file here
                </p>
              ) : file ? (
                <>
                  <p className="text-sm font-bold text-slate-700">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Click or drag another file to replace
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-700">
                    Drag and drop your file here
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    or click to select .xlsx / .xls
                  </p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {preview.length > 0 && (
            <>
              <div className="border border-emerald-200 rounded-xl overflow-hidden">
                <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-200 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">
                    Ready to import ({classifiedPreview.valid.length} row
                    {classifiedPreview.valid.length === 1 ? "" : "s"})
                  </p>
                  <p className="text-[10px] text-emerald-700">
                    {previewTotal} total in file
                  </p>
                </div>
                {renderRawTable(
                  classifiedPreview.valid,
                  "No complete rows found",
                )}
              </div>

              <div className="border border-amber-200 rounded-xl overflow-hidden">
                <div className="bg-amber-50 px-4 py-2 border-b border-amber-200 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">
                    Missing required fields (
                    {classifiedPreview.incomplete.length} row
                    {classifiedPreview.incomplete.length === 1 ? "" : "s"})
                  </p>
                  <p className="text-[10px] text-amber-800">
                    These will not be imported
                  </p>
                </div>
                {renderRawTable(
                  classifiedPreview.incomplete,
                  "All rows have the required fields",
                )}
              </div>
            </>
          )}

          {result && (
            <div
              className={`rounded-xl p-4 border ${
                result.failed === 0 && resultGroups.missingRequired.length === 0
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-start gap-2 mb-2">
                {result.failed === 0 &&
                resultGroups.missingRequired.length === 0 ? (
                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-800">
                    {result.transactional && result.failed > 0
                      ? "Import rejected — no records saved"
                      : result.created > 0
                        ? `${result.created} created · ${result.failed} failed`
                        : "Upload failed — no records were imported"}
                  </p>
                  {(result.failed > 0 ||
                    resultGroups.missingRequired.length > 0) && (
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Review the tables below, fix the file, and try again.
                    </p>
                  )}
                </div>
              </div>

              {resultGroups.missingRequired.length > 0 && (
                <div className="mt-3 border border-amber-200 rounded-lg overflow-hidden bg-white">
                  <div className="bg-amber-50 px-3 py-1.5 border-b border-amber-200">
                    <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">
                      Missing required input (
                      {resultGroups.missingRequired.length})
                    </p>
                  </div>
                  <div className="max-h-36 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-amber-50/80">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-bold text-amber-900">
                            Excel Row
                          </th>
                          <th className="px-3 py-1.5 text-left font-bold text-amber-900">
                            Issue
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultGroups.missingRequired.map((e, i) => (
                          <tr
                            key={`miss-${i}`}
                            className="border-t border-amber-100"
                          >
                            <td className="px-3 py-1.5 font-semibold text-amber-800">
                              {e.row ?? "—"}
                            </td>
                            <td className="px-3 py-1.5 text-amber-900">
                              {e.message}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {resultGroups.other.length > 0 && (
                <div className="mt-3 border border-red-200 rounded-lg overflow-hidden bg-white">
                  <div className="bg-red-50 px-3 py-1.5 border-b border-red-200">
                    <p className="text-[10px] font-black text-red-900 uppercase tracking-widest">
                      Other errors ({resultGroups.other.length})
                    </p>
                  </div>
                  <div className="max-h-36 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-red-50/80">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-bold text-red-900">
                            Excel Row
                          </th>
                          <th className="px-3 py-1.5 text-left font-bold text-red-900">
                            Issue
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultGroups.other.map((e, i) => (
                          <tr
                            key={`other-${i}`}
                            className="border-t border-red-100"
                          >
                            <td className="px-3 py-1.5 font-semibold text-red-800">
                              {e.row ?? "—"}
                            </td>
                            <td className="px-3 py-1.5 text-red-800">
                              {e.message}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-slate-50 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-11 rounded-xl text-xs font-bold"
            onClick={handleClose}
          >
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              className="flex-1 h-11 rounded-xl text-xs font-black shadow-lg shadow-slate-200 hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed text-white"
              disabled={
                !file || uploading || classifiedPreview.valid.length === 0
              }
              onClick={handleUpload}
              style={{
                backgroundColor: primaryColor,
                borderColor: primaryColor,
              }}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import{" "}
                  {classifiedPreview.valid.length > 0
                    ? `${classifiedPreview.valid.length} Record${
                        classifiedPreview.valid.length === 1 ? "" : "s"
                      }`
                    : "Records"}
                </>
              )}
            </Button>
          )}
          {result &&
            (result.failed > 0 ||
              resultGroups.missingRequired.length > 0) && (
              <Button
                className="flex-1 h-11 rounded-xl text-xs font-black text-white hover:brightness-95"
                style={{
                  backgroundColor: primaryColor,
                  borderColor: primaryColor,
                }}
                onClick={() => {
                  setFile(null);
                  setPreview([]);
                  setPreviewTotal(0);
                  setResult(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                Try Again
              </Button>
            )}
        </div>
      </div>
    </div>
  );
}
