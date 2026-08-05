// components/ImageLightbox.jsx
import React from "react";
import { X } from "lucide-react";

const ImageLightbox = ({ isOpen, onClose, src, title = "Preview" }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="relative bg-white p-4 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 bg-white rounded-full p-1"
          type="button"
          aria-label="Close preview"
        >
          <X size={24} />
        </button>
        <p className="text-center text-gray-800 font-semibold mb-3 pr-8">{title}</p>
        <img
          src={src}
          alt={title}
          className="max-w-full max-h-[70vh] object-contain rounded mx-auto block"
        />
      </div>
    </div>
  );
};

export default ImageLightbox;