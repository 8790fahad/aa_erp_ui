/**
 * Image utility functions for handling signature and seal uploads
 * with proper resizing and optimization
 */

/**
 * Resize and optimize an image file
 * @param {File} file - The image file to process
 * @param {Object} options - Resize options
 * @param {number} options.maxWidth - Maximum width in pixels
 * @param {number} options.maxHeight - Maximum height in pixels
 * @param {number} options.quality - JPEG quality (0-1)
 * @param {string} options.outputFormat - Output format ('jpeg', 'png', 'webp')
 * @returns {Promise<string>} - Base64 encoded image
 */
export const resizeImage = (file, options = {}) => {
  const {
    maxWidth = 300,
    maxHeight = 400,
    quality = 0.8,
    outputFormat = 'jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;
      
      if (width > maxWidth || height > maxHeight) {
        const aspectRatio = width / height;
        
        if (width > height) {
          width = Math.min(width, maxWidth);
          height = width / aspectRatio;
        } else {
          height = Math.min(height, maxHeight);
          width = height * aspectRatio;
        }
      }

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Clear canvas with white background for JPEG
      if (outputFormat === 'jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }

      // Draw and resize image
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to base64
      const mimeType = `image/${outputFormat}`;
      const base64 = canvas.toDataURL(mimeType, quality);
      
      resolve(base64);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Create object URL for the file
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Resize signature image with optimal settings
 * @param {File} file - The signature image file
 * @returns {Promise<string>} - Optimized base64 signature
 */
export const resizeSignature = (file) => {
  return resizeImage(file, {
    maxWidth: 300,
    maxHeight: 150,
    quality: 0.9,
    outputFormat: 'png' // PNG for transparency support
  });
};

/**
 * Resize seal/logo image with optimal settings
 * @param {File} file - The seal/logo image file
 * @returns {Promise<string>} - Optimized base64 seal
 */
export const resizeSeal = (file) => {
  return resizeImage(file, {
    maxWidth: 200,
    maxHeight: 200,
    quality: 0.9,
    outputFormat: 'png' // PNG for transparency support
  });
};

/**
 * Validate image file
 * @param {File} file - The file to validate
 * @param {Object} options - Validation options
 * @returns {Object} - Validation result
 */
export const validateImageFile = (file, options = {}) => {
  const {
    maxSizeInMB = 5,
    allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  } = options;

  const errors = [];

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }

  // Check file size
  const fileSizeInMB = file.size / (1024 * 1024);
  if (fileSizeInMB > maxSizeInMB) {
    errors.push(`File size (${fileSizeInMB.toFixed(2)}MB) exceeds maximum allowed size of ${maxSizeInMB}MB`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate image dimensions
 * @param {Object} dimensions - The image dimensions {width, height}
 * @param {Object} options - Validation options
 * @param {number} options.maxWidth - Maximum allowed width
 * @param {number} options.maxHeight - Maximum allowed height
 * @param {number} options.minWidth - Minimum required width
 * @param {number} options.minHeight - Minimum required height
 * @returns {Object} - Validation result
 */
export const validateImageDimensions = (dimensions, options = {}) => {
  const {
    maxWidth = 300,
    maxHeight = 150,
    minWidth = 10,
    minHeight = 10
  } = options;

  const errors = [];

  // Check minimum dimensions
  if (dimensions.width < minWidth) {
    errors.push(`Image width (${dimensions.width}px) is less than minimum required width of ${minWidth}px`);
  }
  
  if (dimensions.height < minHeight) {
    errors.push(`Image height (${dimensions.height}px) is less than minimum required height of ${minHeight}px`);
  }

  // Check maximum dimensions
  if (dimensions.width > maxWidth) {
    errors.push(`Image width (${dimensions.width}px) exceeds maximum allowed width of ${maxWidth}px`);
  }
  
  if (dimensions.height > maxHeight) {
    errors.push(`Image height (${dimensions.height}px) exceeds maximum allowed height of ${maxHeight}px`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Get image dimensions
 * @param {File} file - The image file
 * @returns {Promise<Object>} - Image dimensions
 */
export const getImageDimensions = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
};

/**
 * Create a preview URL for an image file
 * @param {File} file - The image file
 * @returns {string} - Object URL for preview
 */
export const createPreviewUrl = (file) => {
  return URL.createObjectURL(file);
};

/**
 * Cleanup preview URL
 * @param {string} url - The object URL to cleanup
 */
export const cleanupPreviewUrl = (url) => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  };
};