import React, { useEffect, useRef, useState } from "react";
import { Globe, Link2, Pencil, Send, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";
import { useDispatch, useSelector } from "react-redux";

const TINYURL_DOMAINS = ["tinyurl.com"];

const sanitizeAlias = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 30);

export default function MarketplaceTinyLinkModal({
  isOpen,
  onClose,
  business,
  longUrl,
  onSuccess,
}) {
  const dispatch = useDispatch();
  const authUserId = useSelector((state) => state.auth.user?.id);
  const aliasInputRef = useRef(null);
  const [domain, setDomain] = useState("tinyurl.com");
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDomain("tinyurl.com");
      setAlias(sanitizeAlias(business?.link_user || ""));
      setLoading(false);
      requestAnimationFrame(() => {
        aliasInputRef.current?.focus();
        aliasInputRef.current?.select();
      });
    }
  }, [isOpen, business?.link_user]);

  if (!isOpen || !business?.id) return null;

  const primaryColor = business?.primary_color || "#4267B2";

  const handleSubmit = () => {
    if (!longUrl) {
      toast.error("Storefront URL is required");
      return;
    }

    const normalizedAlias = sanitizeAlias(alias) || sanitizeAlias(business?.link_user);
    if (normalizedAlias && normalizedAlias.length < 5) {
      toast.error("Alias must be at least 5 characters");
      return;
    }

    setLoading(true);
    const userId = business.business_admin || authUserId || "system";
    _postApi(
      `/account/generate-marketplace-tiny-link/${business.id}/${userId}`,
      {
        url: longUrl,
        domain,
        alias: normalizedAlias || undefined,
        force: true,
      },
      (resp) => {
        setLoading(false);
        if (resp?.success) {
          toast.success("Tiny link created");
          if (resp.results) {
            dispatch({
              type: "UPDATE_BUSINESS_SETTINGS",
              payload: { business: resp.results },
            });
          }
          onSuccess?.(resp.tinyLink);
          onClose();
        } else {
          toast.error(resp?.message || "Failed to create tiny link");
        }
      },
      (err) => {
        console.error("Tiny link error:", err);
        setLoading(false);
        toast.error(
          err?.message || err?.error || "Network error. Could not create tiny link"
        );
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
        style={{ border: "1px solid #e5e7eb" }}
      >
        <div
          className="d-flex align-items-center gap-2 px-4 py-3 text-white fw-semibold"
          style={{ background: primaryColor }}
        >
          <Link2 size={18} />
          <span>Shorten a Link</span>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-link text-white ms-auto p-0"
            style={{ textDecoration: "none" }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <div className="row g-2 mb-3">
            <div className="col-5">
              <label className="form-label fw-semibold d-flex align-items-center gap-2 mb-2">
                <Globe size={16} className="text-muted" />
                Domain
              </label>
              <select
                className="form-select"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              >
                {TINYURL_DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-1 d-flex align-items-end justify-content-center pb-2 text-muted fw-bold">
              /
            </div>
            <div className="col-6">
              <label className="form-label fw-semibold d-flex align-items-center gap-2 mb-2">
                <Pencil size={16} className="text-muted" />
                Alias
                <span className="text-muted fw-normal">(optional)</span>
              </label>
              <input
                ref={aliasInputRef}
                type="text"
                className="form-control font-monospace"
                placeholder={business?.link_user || "Add alias here"}
                value={alias}
                onChange={(e) => setAlias(sanitizeAlias(e.target.value))}
              />
            </div>
          </div>
          <small className="text-muted d-block mb-3">
            Pre-filled from your storefront handle
            {business?.link_user ? (
              <>
                {" "}
                (<span className="font-monospace">{business.link_user}</span>
                ). Must be at least 5 characters.
              </>
            ) : (
              " — must be at least 5 characters."
            )}
          </small>

          <label className="form-label fw-semibold d-flex align-items-center gap-2 mb-2 text-muted">
            <Send size={16} />
            Long URL
          </label>
          <input
            type="url"
            className="form-control mb-4 font-monospace small bg-light"
            readOnly
            value={longUrl}
          />

          <button
            type="button"
            className="btn btn-primary w-100 fw-semibold"
            style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? (
              <span className="d-flex justify-content-center align-items-center w-100">
                <Loader2 size={20} className="animate-spin" />
              </span>
            ) : (
              "Shorten Link"
            )}
          </button>

          <p className="text-muted text-center mt-3 mb-0" style={{ fontSize: "0.75rem" }}>
            Powered by TinyURL — short link redirects to your storefront.
          </p>
        </div>
      </div>
    </div>
  );
}
