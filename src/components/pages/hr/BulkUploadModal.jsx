import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { X, Upload, FileSpreadsheet, Download, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";

/**
 * Generic bulk-upload modal.
 *
 * Props:
 *  - open          : boolean
 *  - onClose       : () => void
 *  - onSuccess     : () => void   — called after a successful import
 *  - title         : string
 *  - templateCols  : { key, label, example }[]  — defines the Excel template columns
 *  - exampleRows   : object[] (optional) — extra sample rows keyed by column key (overrides single example)
 *  - mapRow        : (rawRow) => object          — maps a parsed Excel row to the API payload row
 *  - apiEndpoint   : string                      — POST endpoint for bulk import
 *  - payloadKey    : string                      — key name in the POST body (e.g. "employees")
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
  apiEndpoint,
  payloadKey,
  facilityId,
  createdBy,
  primaryColor = "#4267B2",
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef(null);
  const dragCounter = useRef(0);

  const shadeColor = (hex, percent) => {
    // percent: -100..100 (negative = darker, positive = lighter)
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

  if (!open) return null;

  // ── Download template ──────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const headers = templateCols.map((c) => c.label);
    const sampleRows =
      Array.isArray(exampleRows) && exampleRows.length > 0
        ? exampleRows.map((row) =>
            templateCols.map((c) => {
              if (row[c.key] !== undefined && row[c.key] !== null) return row[c.key];
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

  // ── Parse uploaded file ────────────────────────────────────────────────────
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
        setPreview(raw.slice(0, 5));
      } catch (err) {
        toast.error("Could not read file: " + err.message);
        setFile(null);
        setPreview([]);
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

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) { toast.error("Please select a file first"); return; }
    setUploading(true);
    setResult(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const rows = raw.map((r) => (mapRow ? mapRow(r) : r));

        _postApi(
          apiEndpoint,
          { [payloadKey]: rows, facilityId, createdBy },
          (data) => {
            if (data?.success) {
              setResult(data.data);
              toast.success(data.message);
              if (data.data?.failed === 0) {
                onSuccess?.();
              }
            } else {
              if (data?.data?.errors?.length) {
                setResult(data.data);
              }
              toast.error(data?.message || "Upload failed — no records were imported");
            }
            setUploading(false);
          },
          (err) => {
            toast.error(
              err?.message ||
                "Upload failed — check that the API is reachable and the bulk endpoint is deployed.",
            );
            setUploading(false);
          },
        );
      } catch (err) {
        toast.error("Error processing file: " + err.message);
        setUploading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setResult(null);
    setIsDragging(false);
    dragCounter.current = 0;
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[150]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

        {/* Header */}
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
            <p className="text-slate-400 text-xs mt-0.5 font-medium">Download the template, fill it in, then upload</p>
          </div>
          <button onClick={handleClose} className="p-1.5 hover:bg-white/10 rounded-full transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Step 1 — Download template */}
          <div className="border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Step 1 — Get Template</p>
                <p className="text-xs text-slate-500 mt-0.5">Download the Excel template with the required columns</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2 text-xs font-bold">
                <Download size={14} />
                Download Template
              </Button>
            </div>
            {/* Column reference */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {templateCols.map((c) => (
                <span key={c.key} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                  {c.label}
                </span>
              ))}
            </div>
          </div>

          {/* Step 2 — Upload */}
          <div className="border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3">Step 2 — Upload Filled File</p>
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
                  isDragging ? "text-[color:var(--app-primary)]" : file ? "text-emerald-500" : "text-slate-400"
                }`}
              />
              {isDragging ? (
                <p className="text-sm font-bold text-[color:var(--app-primary)]">Drop your file here</p>
              ) : file ? (
                <>
                  <p className="text-sm font-bold text-slate-700">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-1">Click or drag another file to replace</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-700">
                    Drag and drop your file here
                  </p>
                  <p className="text-xs text-slate-500 mt-1">or click to select .xlsx / .xls</p>
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

          {/* Preview */}
          {preview.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Preview (first {preview.length} rows)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100">
                      {Object.keys(preview[0]).map((k) => (
                        <th key={k} className="px-3 py-2 text-left font-bold text-slate-600 whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-xl p-4 border ${result.failed === 0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.failed === 0
                  ? <CheckCircle className="h-4 w-4 text-emerald-600" />
                  : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                <p className="text-xs font-black text-slate-700">
                  {result.transactional && result.failed > 0
                    ? "Import rejected — no records saved"
                    : `${result.created} created · ${result.failed} failed`}
                </p>
              </div>
              {result.errors?.length > 0 && (
                <ul className="space-y-1 mt-2">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-[10px] text-red-700 font-medium">
                      {e.row != null ? `Row ${e.row}: ` : ""}{e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex gap-3">
          <Button variant="outline" className="flex-1 h-11 rounded-xl text-xs font-bold" onClick={handleClose}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              className="flex-1 h-11 rounded-xl text-xs font-black shadow-lg shadow-slate-200 hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed text-white"
              disabled={!file || uploading}
              onClick={handleUpload}
              style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
            >
              {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</> : <><Upload className="h-4 w-4 mr-2" />Import Records</>}
            </Button>
          )}
          {result && result.failed > 0 && (
            <Button
              className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-black text-xs font-black"
              onClick={() => { setFile(null); setPreview([]); setResult(null); fileRef.current && (fileRef.current.value = ""); }}
            >
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
