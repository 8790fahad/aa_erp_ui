import React, { useEffect, useMemo, useState } from "react";
import { Share2, X, Loader2, Plus, Trash2 } from "lucide-react";
import {
  FaInstagram,
  FaFacebook,
  FaXTwitter,
  FaLinkedin,
  FaWhatsapp,
  FaTelegram,
} from "react-icons/fa6";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";
import { useDispatch, useSelector } from "react-redux";

export const SOCIAL_MEDIA_PLATFORMS = [
  {
    key: "instagram",
    label: "Instagram",
    baseUrl: "https://www.instagram.com/",
    placeholder: "8790fahad",
    Icon: FaInstagram,
    color: "#E4405F",
  },
  {
    key: "facebook",
    label: "Facebook",
    baseUrl: "https://www.facebook.com/",
    placeholder: "yourpage",
    Icon: FaFacebook,
    color: "#1877F2",
  },
  {
    key: "x",
    label: "X",
    baseUrl: "https://x.com/",
    placeholder: "yourhandle",
    Icon: FaXTwitter,
    color: "#000000",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    baseUrl: "https://www.linkedin.com/in/",
    placeholder: "your-profile",
    Icon: FaLinkedin,
    color: "#0A66C2",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    baseUrl: "https://wa.me/",
    placeholder: "2348012345678",
    Icon: FaWhatsapp,
    color: "#25D366",
  },
  {
    key: "telegram",
    label: "Telegram",
    baseUrl: "https://t.me/",
    placeholder: "yourchannel",
    Icon: FaTelegram,
    color: "#0088CC",
  },
];

const EMPTY_SOCIAL_MEDIA = {
  instagram: [],
  facebook: [],
  x: [],
  linkedin: [],
  whatsapp: [],
  telegram: [],
};

export const extractSocialHandle = (platformKey, raw) => {
  let value = String(raw || "").trim();
  if (!value) return "";

  if (/^https?:\/\//i.test(value)) {
    value = value.replace(/^https?:\/\/(www\.)?/i, "");
  }

  value = value.replace(/^@+/, "");

  switch (platformKey) {
    case "instagram":
      value = value.replace(/^instagram\.com\//i, "");
      break;
    case "facebook":
      value = value.replace(/^facebook\.com\//i, "");
      break;
    case "x":
      value = value.replace(/^(twitter\.com|x\.com)\//i, "");
      break;
    case "linkedin":
      value = value.replace(/^linkedin\.com\//i, "");
      value = value.replace(/^in\//i, "");
      value = value.replace(/^company\//i, "");
      break;
    case "whatsapp":
      value = value.replace(/^wa\.me\//i, "");
      value = value.replace(/\D/g, "");
      break;
    case "telegram":
      value = value.replace(/^t\.me\//i, "");
      break;
    default:
      break;
  }

  return value.replace(/\/+$/, "").trim();
};

const normalizeHandleList = (platformKey, raw) => {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const seen = new Set();

  return list
    .map((item) => extractSocialHandle(platformKey, item))
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
};

export const parseMarketplaceSocialMedia = (value) => {
  if (!value) return { ...EMPTY_SOCIAL_MEDIA };
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return { ...EMPTY_SOCIAL_MEDIA };
    }
  }

  const result = { ...EMPTY_SOCIAL_MEDIA };
  for (const platform of SOCIAL_MEDIA_PLATFORMS) {
    result[platform.key] = normalizeHandleList(
      platform.key,
      parsed?.[platform.key],
    );
  }
  return result;
};

export const getConfiguredSocialCount = (business) => {
  const social = parseMarketplaceSocialMedia(business?.marketplace_social_media);
  return SOCIAL_MEDIA_PLATFORMS.reduce(
    (total, platform) => total + (social[platform.key]?.length || 0),
    0,
  );
};

const getPlatformConfig = (key) =>
  SOCIAL_MEDIA_PLATFORMS.find((platform) => platform.key === key);

export default function MarketplaceSocialMediaModal({ isOpen, onClose, business }) {
  const dispatch = useDispatch();
  const authUserId = useSelector((state) => state.auth.user?.id);
  const [enableSocialMedia, setEnableSocialMedia] = useState(false);
  const [socialMediaInputs, setSocialMediaInputs] = useState(EMPTY_SOCIAL_MEDIA);
  const [selectedPlatform, setSelectedPlatform] = useState("instagram");
  const [draftHandle, setDraftHandle] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedPlatformConfig = useMemo(
    () => getPlatformConfig(selectedPlatform),
    [selectedPlatform],
  );

  const addedLinks = useMemo(() => {
    return SOCIAL_MEDIA_PLATFORMS.flatMap((platform) =>
      (socialMediaInputs[platform.key] || []).map((handle, index) => ({
        platformKey: platform.key,
        platformLabel: platform.label,
        baseUrl: platform.baseUrl,
        handle,
        index,
        Icon: platform.Icon,
        color: platform.color,
        url: `${platform.baseUrl}${handle}`,
      })),
    );
  }, [socialMediaInputs]);

  useEffect(() => {
    if (!isOpen || !business?.id) return;
    setEnableSocialMedia(!!business.enable_marketplace_social_media);
    setSocialMediaInputs(
      parseMarketplaceSocialMedia(business.marketplace_social_media),
    );
    setSelectedPlatform("instagram");
    setDraftHandle("");
    setLoading(false);
  }, [
    isOpen,
    business?.id,
    business?.enable_marketplace_social_media,
    business?.marketplace_social_media,
  ]);

  if (!isOpen || !business?.id) return null;

  const primaryColor = business?.primary_color || "#1a2d5e";
  const SelectedPlatformIcon = selectedPlatformConfig?.Icon;

  const addHandle = () => {
    const handle = extractSocialHandle(selectedPlatform, draftHandle);
    if (!handle) {
      toast.error("Enter a username or handle to add");
      return;
    }

    const existing = socialMediaInputs[selectedPlatform] || [];
    if (existing.includes(handle)) {
      toast.error("This handle is already added for this platform");
      return;
    }

    setSocialMediaInputs((prev) => ({
      ...prev,
      [selectedPlatform]: [...(prev[selectedPlatform] || []), handle],
    }));
    setDraftHandle("");
    toast.success(`${selectedPlatformConfig?.label || "Link"} added`);
  };

  const removeHandle = (platformKey, index) => {
    setSocialMediaInputs((prev) => ({
      ...prev,
      [platformKey]: (prev[platformKey] || []).filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = () => {
    if (loading) return;

    if (!business.enable_online_ordering) {
      toast.error("Enable Online Store before configuring social media handles");
      return;
    }

    const userId = business.business_admin || authUserId;
    if (!userId) {
      toast.error("Missing business admin user");
      return;
    }

    setLoading(true);
    _postApi(
      `/account/update-marketplace-social-media/${business.id}/${userId}`,
      {
        enable_marketplace_social_media: enableSocialMedia,
        marketplace_social_media: socialMediaInputs,
      },
      (resp) => {
        setLoading(false);
        if (resp?.success) {
          toast.success("Social media handles saved");
          if (resp.results) {
            dispatch({
              type: "UPDATE_BUSINESS_SETTINGS",
              payload: { business: resp.results },
            });
          }
          onClose();
        } else {
          toast.error(resp?.message || "Failed to save social media handles");
        }
      },
      (err) => {
        console.error("Error saving social media handles:", err);
        setLoading(false);
        toast.error("Network error. Could not save social media handles");
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden"
        style={{ border: "1px solid #e5e7eb" }}
      >
        <div
          className="d-flex align-items-center gap-2 px-4 py-3 text-white fw-semibold"
          style={{ background: primaryColor }}
        >
          <Share2 size={18} />
          <span>Social Media Handles</span>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-link text-white ms-auto p-0"
            style={{ textDecoration: "none" }}
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <div className="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom">
            <span className="fw-semibold">Enable Social Media Handles</span>
            <div className="form-check form-switch m-0">
              <input
                className="form-check-input"
                type="checkbox"
                id="enableMarketplaceSocialMediaModal"
                checked={enableSocialMedia}
                onChange={(e) => setEnableSocialMedia(e.target.checked)}
                disabled={loading}
              />
            </div>
          </div>

          {enableSocialMedia ? (
            <>
              <div className="mb-4">
                <label
                  className="form-label fw-semibold mb-2"
                  htmlFor="socialPlatformSelect"
                >
                  Select platform
                </label>
                <select
                  id="socialPlatformSelect"
                  className="form-select form-select-lg mb-3"
                  value={selectedPlatform}
                  onChange={(e) => {
                    setSelectedPlatform(e.target.value);
                    setDraftHandle("");
                  }}
                  disabled={loading}
                >
                  {SOCIAL_MEDIA_PLATFORMS.map((platform) => {
                    const Icon = platform.Icon;
                    return (
                      <option key={platform.key} value={platform.key}>
                        {platform.label}
                      </option>
                    );
                  })}
                </select>

                {selectedPlatformConfig && SelectedPlatformIcon ? (
                  <div>
                    <label
                      className="form-label fw-semibold mb-2 d-flex align-items-center gap-2"
                      htmlFor="socialDraftHandle"
                    >
                      <SelectedPlatformIcon
                        size={18}
                        style={{ color: selectedPlatformConfig.color }}
                      />
                      Add {selectedPlatformConfig.label} link
                    </label>
                    <div
                      className="d-flex align-items-stretch rounded-3 border border-2 overflow-hidden mb-3"
                      style={{
                        background: "#ffffff",
                        borderColor: "#cbd5e1",
                        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
                      }}
                    >
                      <div
                        className="d-flex align-items-center px-3 border-end bg-light flex-shrink-0"
                        style={{ minWidth: "52px" }}
                      >
                        <SelectedPlatformIcon
                          size={22}
                          style={{ color: selectedPlatformConfig.color }}
                        />
                      </div>
                      <div className="d-flex align-items-center flex-grow-1 min-w-0 px-3 py-2">
                        <span
                          className="text-secondary text-nowrap pe-2"
                          style={{
                            fontFamily: "monospace",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                          }}
                        >
                          {selectedPlatformConfig.baseUrl}
                        </span>
                        <input
                          id="socialDraftHandle"
                          type="text"
                          className="form-control form-control-lg border-0 shadow-none px-2"
                          style={{
                            fontFamily: "monospace",
                            fontSize: "1rem",
                            fontWeight: 600,
                            background: "transparent",
                            minWidth: "120px",
                          }}
                          placeholder={selectedPlatformConfig.placeholder}
                          value={draftHandle}
                          onChange={(e) =>
                            setDraftHandle(
                              extractSocialHandle(
                                selectedPlatform,
                                e.target.value,
                              ),
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addHandle();
                            }
                          }}
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2"
                      style={{
                        backgroundColor: primaryColor,
                        borderColor: primaryColor,
                        padding: "0.75rem 1rem",
                        fontWeight: 600,
                      }}
                      onClick={addHandle}
                      disabled={loading || !draftHandle.trim()}
                    >
                      <Plus size={18} />
                      Add {selectedPlatformConfig.label} Link
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="mb-4">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="fw-semibold">Added links</span>
                  <span className="badge rounded-pill text-bg-light border">
                    {addedLinks.length}
                  </span>
                </div>

                {addedLinks.length === 0 ? (
                  <div
                    className="rounded-3 border border-dashed text-center text-muted py-4 px-3"
                    style={{ background: "#f8fafc" }}
                  >
                    No links added yet. Select a platform above and click Add.
                  </div>
                ) : (
                  <div
                    className="d-flex flex-column gap-2"
                    style={{ maxHeight: "260px", overflowY: "auto" }}
                  >
                    {addedLinks.map((link) => {
                      const Icon = link.Icon;
                      return (
                        <div
                          key={`${link.platformKey}-${link.index}-${link.handle}`}
                          className="d-flex align-items-center gap-2 rounded-3 border border-2 px-3 py-2"
                          style={{
                            background: "#ffffff",
                            borderColor: "#dbeafe",
                          }}
                        >
                          <div
                            className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                            style={{
                              width: "36px",
                              height: "36px",
                              background: "#f8fafc",
                            }}
                          >
                            <Icon size={18} style={{ color: link.color }} />
                          </div>
                          <div className="flex-grow-1 min-w-0">
                            <div className="small fw-semibold text-secondary">
                              {link.platformLabel}
                            </div>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-decoration-none d-block text-truncate"
                              style={{
                                fontFamily: "monospace",
                                fontSize: "0.9rem",
                                fontWeight: 600,
                                color: primaryColor,
                              }}
                            >
                              {link.url}
                            </a>
                          </div>
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm flex-shrink-0"
                            onClick={() =>
                              removeHandle(link.platformKey, link.index)
                            }
                            disabled={loading}
                            title="Remove link"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-muted small mb-4">
              Turn on the switch above, then select a platform and add one or
              more links for Instagram, Facebook, X, LinkedIn, WhatsApp, or
              Telegram.
            </p>
          )}

          <div className="d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary fw-semibold"
              style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
              disabled={loading}
              onClick={handleSubmit}
            >
              {loading ? (
                <span className="d-flex align-items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save Social Handles"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
