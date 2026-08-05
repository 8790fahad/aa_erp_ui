// components/BusinessLogoModal.jsx

import React, { useState, useEffect, useRef } from "react";
import { X, AlertCircle, ImageIcon } from "lucide-react";
import CustomButton from "@/common/Custom/CustomButton";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";
import { useDispatch } from "react-redux";
import {
  resizeSeal,
  validateImageFile,
  getImageDimensions,
} from "@/utils/imageUtils";

const BusinessLogoModal = ({ isOpen, onClose, business, onUpdateSuccess }) => {
  const [logo, setLogo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [imageInfo, setImageInfo] = useState(null);
  const fileInputRef = useRef(null);
  const objectUrlRef = useRef(null);
  const dispatch = useDispatch();

  const clearObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const resetSelection = () => {
    clearObjectUrl();
    setLogo(null);
    setPreviewUrl(null);
    setImageInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    if (isOpen) {
      resetSelection();
    }
    return () => clearObjectUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileValidation = validateImageFile(file, {
      maxSizeInMB: 5,
      allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    });

    if (!fileValidation.isValid) {
      toast.error(fileValidation.errors[0]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Instant local preview before upload
    clearObjectUrl();
    const localPreview = URL.createObjectURL(file);
    objectUrlRef.current = localPreview;
    setPreviewUrl(localPreview);
    setLogo(null);
    setImageInfo({
      fileName: file.name,
      originalSize: (file.size / 1024).toFixed(1) + " KB",
    });

    setProcessingImage(true);

    try {
      const dimensions = await getImageDimensions(file);

      if (dimensions.width < 50 || dimensions.height < 50) {
        toast.error("Image is too small. Minimum size is 50×50 pixels.");
        resetSelection();
        return;
      }

      // Resize for upload (no hard max rejection — we optimize down)
      const resizedImage = await resizeSeal(file);

      setLogo(resizedImage);
      setPreviewUrl(resizedImage);
      clearObjectUrl();
      setImageInfo({
        originalSize: (file.size / 1024).toFixed(1) + " KB",
        originalDimensions: `${dimensions.width}×${dimensions.height}`,
        fileName: file.name,
      });
    } catch (error) {
      console.error("Error processing image:", error);
      toast.error("Failed to process image. Please try again.");
      resetSelection();
    } finally {
      setProcessingImage(false);
    }
  };

  const handleSubmit = () => {
    if (!business?.id) {
      toast.error("No business selected.");
      return;
    }

    if (!logo) {
      toast.error(
        processingImage
          ? "Please wait for the image to finish processing."
          : "Please choose a logo image first.",
      );
      return;
    }

    setLoading(true);

    _postApi(
      `/account/update-logo/${business.id}`,
      {
        business_logo: logo,
        store: business.business_name,
      },
      (resp) => {
        if (resp.success) {
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: {
              business: {
                ...business,
                business_logo: logo,
              },
            },
          });

          toast.success("Business logo updated successfully!");
          onUpdateSuccess?.({ ...business, business_logo: logo });
          onClose();
        } else {
          toast.error(resp.message || "Failed to update logo.");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Logo upload error:", err);
        setLoading(false);
        toast.error("Network error. Could not upload logo.");
      },
    );
  };

  const displayPreview =
    previewUrl || logo || business?.business_logo || null;

  return (
    isOpen && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {business.business_logo ? "Update" : "Add"} Business Logo
              </h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                <span className="text-blue-600 font-medium">
                  {business.business_name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-gray-900 truncate">
                  {business.business_name}
                </h3>
                <p className="text-xs text-gray-500 truncate">
                  {business.id}
                </p>
              </div>
            </div>

            {/* Preview — always visible before upload */}
            <div className="mb-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500 mb-3 text-center">
                Preview
              </p>
              <div className="flex justify-center">
                {displayPreview ? (
                  <img
                    src={displayPreview}
                    alt="Logo preview"
                    className="max-h-40 max-w-full w-auto object-contain rounded-lg bg-white border border-slate-200 shadow-sm p-2"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-36 w-full text-slate-400">
                    <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-xs">Choose a file to preview</p>
                  </div>
                )}
              </div>
              {processingImage && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  Optimizing image…
                </div>
              )}
              {imageInfo && !processingImage && (
                <div className="mt-3 text-center text-xs text-slate-500 space-y-0.5">
                  <p className="font-medium text-slate-700 truncate px-2">
                    {imageInfo.fileName}
                  </p>
                  {imageInfo.originalDimensions && (
                    <p>
                      {imageInfo.originalDimensions}
                      {imageInfo.originalSize
                        ? ` · ${imageInfo.originalSize}`
                        : ""}
                    </p>
                  )}
                  {logo && (
                    <button
                      type="button"
                      onClick={resetSelection}
                      className="mt-1 text-red-500 hover:text-red-700 font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium mb-1">Upload Guidelines:</p>
                  <ul className="space-y-1">
                    <li>• Recommended size: 200×200 to 500×500 pixels</li>
                    <li>• Supported formats: PNG, JPG, JPEG, WebP</li>
                    <li>• Maximum file size: 5MB</li>
                    <li>• Larger images are auto-resized before upload</li>
                  </ul>
                </div>
              </div>
            </div>

            <label className="text-sm font-medium text-gray-700 block mb-2">
              Upload Business Logo
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleFileChange}
              disabled={processingImage}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-medium
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex gap-3 p-6 pt-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition-colors font-medium"
            >
              Cancel
            </button>
            <CustomButton
              onClick={handleSubmit}
              className="flex-1 text-white py-2 px-4 rounded-md transition-colors font-medium"
              disabled={loading || processingImage || !logo}
            >
              {loading
                ? "Updating..."
                : business.business_logo
                  ? "Update"
                  : "Add"}{" "}
              Logo
            </CustomButton>
          </div>
        </div>
      </div>
    )
  );
};

export default BusinessLogoModal;
