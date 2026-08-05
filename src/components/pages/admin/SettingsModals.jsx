import React from "react";
import { X, Loader2 } from "lucide-react";
import BusinessLogoModal from "./BusinessLogo";
import BusinessSealModal from "./BusinessSeal";
import BusinessStampModal from "./BusinessStamp";
import ImageLightbox from "./ImageLightbox";
import MarketplaceTinyLinkModal from "./MarketplaceTinyLinkModal";
import MarketplaceSocialMediaModal from "./MarketplaceSocialMediaModal";

export default function SettingsModals({
  showLogoModal,
  setShowLogoModal,
  showLinkUserModal,
  setShowLinkUserModal,
  showTinyLinkModal,
  setShowTinyLinkModal,
  showSocialMediaModal,
  setShowSocialMediaModal,
  showSealModal,
  setShowSealModal,
  showStampModal,
  setShowStampModal,
  lightboxPreview,
  closeImagePreview,
  activeBusiness,
  linkUserInput,
  setLinkUserInput,
  linkUserChecking,
  linkUserAvailable,
  setLinkUserAvailable,
  checkLinkUserAvailability,
  sanitizeLinkUserInput,
  marketplaceLinkLoading,
  saveStorefrontHandle,
  getMarketplaceStorefrontLink,
  MARKETPLACE_BASE_URL,
}) {
  return (
    <>
      <BusinessLogoModal
        isOpen={showLogoModal}
        onClose={() => setShowLogoModal(false)}
        business={activeBusiness}
      />

      {showLinkUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {activeBusiness.link_user
                    ? "Edit Storefront Handle"
                    : "Set Up Storefront Handle"}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowLinkUserModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-muted mb-3">
                Your public store URL will be{" "}
                <span className="font-monospace">
                  {MARKETPLACE_BASE_URL}/i/
                  {sanitizeLinkUserInput(linkUserInput) || "your-handle"}
                </span>
              </p>
              <label className="form-label fw-semibold" htmlFor="linkUserInput">
                Storefront Handle
              </label>
              <input
                id="linkUserInput"
                type="text"
                className="form-control font-monospace mb-1"
                placeholder="e.g. aafoods"
                value={linkUserInput}
                onChange={(e) => {
                  const next = sanitizeLinkUserInput(e.target.value);
                  setLinkUserInput(next);
                  if (next.length >= 3) {
                    checkLinkUserAvailability(next);
                  } else {
                    setLinkUserAvailable(null);
                  }
                }}
                autoFocus
              />
              <div className="mb-4" style={{ minHeight: "1.25rem" }}>
                {linkUserChecking ? (
                  <small className="text-muted">Checking availability...</small>
                ) : linkUserInput.length >= 3 && linkUserAvailable === true ? (
                  <small className="text-success">
                    Storefront handle is available
                  </small>
                ) : linkUserInput.length >= 3 && linkUserAvailable === false ? (
                  <small className="text-danger">
                    This storefront handle is already taken
                  </small>
                ) : (
                  <small className="text-muted">
                    At least 3 characters — letters, numbers, underscore or hyphen
                  </small>
                )}
              </div>
              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowLinkUserModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={
                    marketplaceLinkLoading ||
                    linkUserChecking ||
                    sanitizeLinkUserInput(linkUserInput).length < 3 ||
                    linkUserAvailable === false
                  }
                  onClick={saveStorefrontHandle}
                >
                  {marketplaceLinkLoading ? (
                    <>
                      <Loader2 size={14} className="me-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Handle"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <MarketplaceTinyLinkModal
        isOpen={showTinyLinkModal}
        onClose={() => setShowTinyLinkModal(false)}
        business={activeBusiness}
        longUrl={getMarketplaceStorefrontLink()}
      />

      <MarketplaceSocialMediaModal
        isOpen={showSocialMediaModal}
        onClose={() => setShowSocialMediaModal(false)}
        business={activeBusiness}
      />

      <BusinessSealModal
        isOpen={showSealModal}
        onClose={() => setShowSealModal(false)}
        business={activeBusiness}
      />

      <BusinessStampModal
        isOpen={showStampModal}
        onClose={() => setShowStampModal(false)}
        business={activeBusiness}
      />

      <ImageLightbox
        isOpen={lightboxPreview.open}
        onClose={closeImagePreview}
        src={lightboxPreview.src}
        title={lightboxPreview.title}
      />
    </>
  );
}
