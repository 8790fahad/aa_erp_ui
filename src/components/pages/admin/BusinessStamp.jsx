// components/BusinessSealModal.jsx

import React, { useState, useEffect } from "react";
import { X, Upload, AlertCircle } from "lucide-react";
import CustomButton from "@/common/Custom/CustomButton";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";
import { useDispatch } from "react-redux";
import { resizeSeal, validateImageFile, getImageDimensions, validateImageDimensions } from "@/utils/imageUtils";

const BusinessStampModal = ({ isOpen, onClose, business, onUpdateSuccess }) => {
  const [stamp, setStamp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [imageInfo, setImageInfo] = useState(null);
  const dispatch = useDispatch();

  useEffect(() => {
    if (isOpen) {
      setStamp(null);
      setImageInfo(null);
    }
  }, [isOpen]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type and size
    const fileValidation = validateImageFile(file, {
      maxSizeInMB: 5,
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    });

    if (!fileValidation.isValid) {
      toast.error(fileValidation.errors[0]);
      return;
    }

    setProcessingImage(true);

    try {
      // Get original dimensions
      const dimensions = await getImageDimensions(file);
      
      // Validate image dimensions
      const dimensionValidation = validateImageDimensions(dimensions, {
        maxWidth: 200,
        maxHeight: 200,
        minWidth: 10,
        minHeight: 10
      });

      if (!dimensionValidation.isValid) {
        toast.error(dimensionValidation.errors[0]);
        return;
      }
      
      // Resize the image
      const resizedImage = await resizeSeal(file);
      
      setStamp(resizedImage);
      setImageInfo({
        originalSize: (file.size / 1024).toFixed(1) + ' KB',
        originalDimensions: `${dimensions.width}x${dimensions.height}`,
        fileName: file.name
      });

      toast.success('Image processed successfully!');
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to process image. Please try again.');
    } finally {
      setProcessingImage(false);
    }
  };

  const handleSubmit = () => {
    if (!business?.id) {
      toast.error("No business selected.");
      return;
    }

    if (!stamp) {
      toast.error("Please upload a stamp image.");
      return;
    }

    setLoading(true);

    _postApi(
      `/account/update-stamp/${business.id}`,
      {
        stamp,
        store: business.business_name,
      },
      (resp) => {
        if (resp.success) {
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: {
              business: {
                ...business,
                stamp: stamp,
              },
            },
          });

          toast.success("Business stamp updated successfully!");
          onClose();
        } else {
          toast.error(resp.message || "Failed to update stamp.");
        }
        setLoading(false);
      },
      (err) => {
        console.error("stamp uploaStaff Signatured error:", err);
        setLoading(false);
        toast.error("Network error. Could not upload stamp.");
      }
    );
  };


  return (
    isOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {business.stamp ? "Update" : "Add"} Business stamp
              </h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className=" max-h-[400px] overflow-y-auto">
              <div className="mb-6">
                {/* Business Info */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium">
                      {business.business_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {business.business_name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Business ID: {business.id}
                    </p>
                  </div>
                </div>

                {/* stamp Upload */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">
                    Upload Business stamp/Logo
                  </label>
                  
                  {/* Upload Guidelines */}
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-blue-800">
                        <p className="font-medium mb-1">Upload Guidelines:</p>
                        <ul className="space-y-1">
                          <li>• Recommended size: 200x200 pixels or smaller</li>
                          <li>• Supported formats: PNG, JPG, JPEG, WebP</li>
                          <li>• Maximum file size: 5MB</li>
                          <li>• PNG recommended for transparent backgrounds</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <input
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

                  {/* Processing Indicator */}
                  {processingImage && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--aa-accent)]"></div>
                      Processing image...
                    </div>
                  )}

                  {/* Image Info */}
                  {imageInfo && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-2">
                      <div className="text-xs text-green-800">
                        <p><strong>File:</strong> {imageInfo.fileName}</p>
                        <p><strong>Original:</strong> {imageInfo.originalDimensions} ({imageInfo.originalSize})</p>
                        <p><strong>Optimized:</strong> Max 200x200px, PNG format</p>
                      </div>
                    </div>
                  )}

                  {/* Preview */}
                  {(stamp || business.stamp) && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">Preview:</p>
                      <div className="flex items-center gap-3">
                        <img
                          src={stamp || business.stamp}
                          alt="Business stamp"
                          className="w-20 h-20 object-contain border border-gray-300 rounded-md bg-gray-50"
                        />
                        <div className="flex-1">
                          <p className="text-xs text-gray-600 mb-2">
                            This is how your stamp will appear on documents
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setStamp(null);
                              setImageInfo(null);
                            }}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Remove Image
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-3 mt-3">
              <button
                onClick={onClose}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition-colors font-medium"
              >
                Cancel
              </button>
              <CustomButton
                onClick={handleSubmit}
                className="flex-1 text-white py-2 px-4 rounded-md transition-colors font-medium"
              >
                {business.stamp ? "Update" : "Add"} stamp
              </CustomButton>
            </div>
          </div>
        </div>
      </div>
    )
  );
};

export default BusinessStampModal;
