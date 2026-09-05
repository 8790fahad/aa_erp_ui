import { toast } from "sonner";
import { apiURL } from "@/redux/actions/api";
import { PurchaseRequisitionAPI } from "@/components/pages/purchase/purchaseRequisitionApi";

export function formatCloudinaryFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** Signed view/download URL for a Cloudinary file (same opener as purchase orders). */
export function cloudinaryDocumentHref(doc, { download = false } = {}) {
  const path = [doc?.file_path, doc?.url, doc?.preview].find(
    (value) => value && /^https?:\/\/res\.cloudinary\.com\//i.test(value),
  );
  if (path) {
    const token = localStorage.getItem("@@__token") || "";
    const qs = new URLSearchParams({
      file_path: path,
      filename:
        doc.document_name || doc.original_name || doc.name || "document",
      ...(download ? { download: "1" } : {}),
      ...(token ? { access_token: token } : {}),
    });
    return `${apiURL}/account/purchase-order-documents/open?${qs.toString()}`;
  }
  if (doc?.url && /api\.cloudinary\.com\//i.test(doc.url)) return doc.url;
  const fallback = doc?.url || doc?.file_path || doc?.preview;
  if (!fallback) return null;
  if (/^https?:\/\//i.test(fallback)) return fallback;
  return `${apiURL}/public/uploads/${fallback}`;
}

export function stageCloudinaryDocument(file, kind) {
  return PurchaseRequisitionAPI.stagePurchaseOrderDocument(file, { kind });
}

/**
 * Validate, upload each file to Cloudinary, and append staged records to state.
 */
export async function pickAndStageCloudinaryFiles({
  picked = [],
  kind,
  setItems,
  allowedTypes,
  maxBytes,
}) {
  const valid = [];
  for (const file of picked) {
    if (allowedTypes && !allowedTypes.has(file.type)) {
      toast.error(`${file.name}: only PDF, PNG, JPG, or DOCX`);
      continue;
    }
    if (maxBytes && file.size > maxBytes) {
      toast.error(`${file.name}: exceeds 25MB limit`);
      continue;
    }
    valid.push(file);
  }
  if (!valid.length) return;

  const pending = valid.map((file) => ({
    clientId: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
    name: file.name,
    original_name: file.name,
    document_name: file.name,
    size: file.size,
    file_size: file.size,
    mime_type: file.type,
    uploading: true,
    file,
  }));
  setItems((prev) => [...prev, ...pending]);

  await Promise.all(
    pending.map(async (item) => {
      try {
        const response = await stageCloudinaryDocument(item.file, kind);
        const doc = (response.data || [])[0];
        if (!doc?.file_path) {
          throw new Error("Upload failed");
        }
        setItems((prev) =>
          prev.map((row) =>
            row.clientId === item.clientId
              ? {
                  ...doc,
                  clientId: item.clientId,
                  name: doc.original_name || item.name,
                  original_name: doc.original_name || item.name,
                  document_name: doc.document_name || item.name,
                  url: doc.url || doc.file_path,
                  file_path: doc.file_path,
                  file_size: doc.file_size || item.file_size,
                  size: doc.file_size || item.size,
                  mime_type: doc.mime_type || item.mime_type,
                  uploading: false,
                }
              : row,
          ),
        );
        toast.success(`${item.name} uploaded`);
      } catch (error) {
        setItems((prev) => prev.filter((row) => row.clientId !== item.clientId));
        toast.error(`${item.name}: ${error.message || "Failed to upload"}`);
      }
    }),
  );
}
