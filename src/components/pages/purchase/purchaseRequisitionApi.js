import { _fetchApi, _postApi, apiURL } from "@/redux/actions/api";

/**
 * API service for Purchase Requisition management
 */
export class PurchaseRequisitionAPI {
  /**
   * Get product list for purchase requisition
   * @param {string} facilityId - Facility ID
   * @param {string} queryType - Query type (default: 'select')
   * @returns {Promise} API response
   */
  static getProductList(facilityId, queryType = 'select') {
    return new Promise((resolve, reject) => {
      _postApi(
        `/inventory/product-list-1?query_type=${queryType}`,
        { facilityId },
        (resp) => {
          if (resp.success) {
            const formattedItems = resp.results.map((item) => ({
              name: item.item_name,
              code: item.item_code,
              chart_code: item.chart_code,
              id: item.id,
              sku: item.sku,
              category: item.category,
              unit_of_measure: item.unit_of_measure,
              cost_price: item.cost_price,
              selling_price: item.selling_price,
            }));
            resolve({ success: true, data: formattedItems });
          } else {
            reject(new Error("Failed to load product list"));
          }
        },
        (err) => {
          console.error("Product List API Error:", err);
          reject(new Error("Something went wrong while fetching product data"));
        }
      );
    });
  }

  /**
   * Get branches/stores for a facility
   * @param {string} facilityId - Facility ID
   * @returns {Promise} API response
   */
  static getBranches(facilityId) {
    return new Promise((resolve, reject) => {
      _fetchApi(
        `/account/get/branches?facilityId=${facilityId}`,
        (data) => {
          if (data.success) {
            const formattedBranches = data.results.map((store) => ({
              branch_id: store.id,
              branch_name: store.storeName,
              address: store.address,
              phone: store.phone,
            }));
            resolve({ success: true, data: formattedBranches });
          } else {
            reject(new Error("Failed to load warehouses"));
          }
        },
        (err) => {
          console.error("Branches API Error:", err);
          reject(new Error("Something went wrong while fetching warehouses"));
        }
      );
    });
  }

  /**
   * Get categories for a facility
   * @param {string} facilityId - Facility ID
   * @returns {Promise} API response
   */
  static getCategories(facilityId) {
    return new Promise((resolve, reject) => {
      _fetchApi(
        `/inventory/get-category?facilityId=${facilityId}`,
        (data) => {
          if (data.success) {
            resolve({ success: true, data: data.results });
          } else {
            reject(new Error("Failed to load categories"));
          }
        },
        (err) => {
          console.error("Categories API Error:", err);
          reject(new Error("Something went wrong while fetching categories"));
        }
      );
    });
  }

  /**
   * Upload documents immediately (before the PO is created).
   * Returns file paths to link on submit.
   */
  static stagePurchaseOrderDocuments(files = []) {
    return new Promise((resolve, reject) => {
      if (!files.length) {
        reject(new Error("No files selected"));
        return;
      }
      const formData = new FormData();
      files.forEach((file) => formData.append("po_documents", file));

      const token = localStorage.getItem("@@__token");
      fetch(`${apiURL}/account/purchase-order-documents/stage`, {
        method: "POST",
        headers: { authorization: token || "" },
        body: formData,
      })
        .then(async (response) => {
          const res = await response.json().catch(() => ({}));
          if (!response.ok || res.success === false) {
            reject(new Error(res.message || "Upload failed"));
            return;
          }
          resolve({ success: true, data: res.results || [] });
        })
        .catch((err) =>
          reject(new Error(err?.message || "Upload failed")),
        );
    });
  }

  /**
   * Submit purchase requisition. Pass already-uploaded document records to link.
   * @param {Object} requisitionData - Purchase requisition data
   * @param {Array} [linkedDocuments] - Staged files `{ file_path, original_name, ... }`
   */
  static submitPurchaseRequisition(requisitionData, linkedDocuments = []) {
    return new Promise((resolve, reject) => {
      const payload = {
        ...requisitionData,
        query_type: "insert",
        linked_documents: (linkedDocuments || [])
          .filter((doc) => doc?.file_path)
          .map((doc) => ({
            file_path: doc.file_path,
            document_name: doc.document_name || doc.original_name || doc.name,
            original_name: doc.original_name || doc.name,
            file_size: doc.file_size || doc.size || null,
            mime_type: doc.mime_type || doc.type || null,
          })),
      };

      _postApi(
        "/account/purchase-requisition",
        payload,
        (res) => {
          if (res.success) {
            resolve({
              success: true,
              pr_no: res.pr_no,
              message: res.message,
            });
          } else {
            reject(
              new Error(
                res.message || "Failed to submit purchase requisition",
              ),
            );
          }
        },
        (err) => {
          console.error("Submit Purchase Requisition Error:", err);
          reject(
            new Error(
              err?.message ||
                "Error occurred while submitting purchase requisition",
            ),
          );
        },
      );
    });
  }

  /**
   * List documents attached to a purchase order / requisition.
   */
  static getPurchaseOrderDocuments(facilityId, { pr_no, po_no } = {}) {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({ facilityId });
      if (pr_no) params.set("pr_no", pr_no);
      if (po_no) params.set("po_no", po_no);
      _fetchApi(
        `/account/purchase-order-documents?${params}`,
        (data) => {
          if (data.success) {
            resolve({ success: true, data: data.results || [] });
          } else {
            reject(new Error(data.message || "Failed to load documents"));
          }
        },
        (err) => {
          reject(
            new Error(err?.message || "Failed to load purchase order documents"),
          );
        },
      );
    });
  }

  /**
   * Upload additional documents to an existing PR/PO.
   */
  static uploadPurchaseOrderDocuments({
    facilityId,
    pr_no,
    po_no,
    uploaded_by,
    files = [],
  }) {
    return new Promise((resolve, reject) => {
      if (!files.length) {
        reject(new Error("No files selected"));
        return;
      }
      const formData = new FormData();
      formData.append("facilityId", facilityId);
      formData.append("pr_no", pr_no);
      if (po_no) formData.append("po_no", po_no);
      if (uploaded_by) formData.append("uploaded_by", uploaded_by);
      files.forEach((file) => formData.append("po_documents", file));

      const token = localStorage.getItem("@@__token");
      fetch(`${apiURL}/account/purchase-order-documents`, {
        method: "POST",
        headers: { authorization: token || "" },
        body: formData,
      })
        .then(async (response) => {
          const res = await response.json().catch(() => ({}));
          if (!response.ok || res.success === false) {
            reject(new Error(res.message || "Upload failed"));
            return;
          }
          resolve(res);
        })
        .catch((err) =>
          reject(new Error(err?.message || "Upload failed")),
        );
    });
  }

  /**
   * Get purchase requisition list
   * @param {string} facilityId - Facility ID
   * @param {Object} filters - Filter options
   * @returns {Promise} API response
   */
  static getPurchaseRequisitionList(facilityId, filters = {}) {
    return new Promise((resolve, reject) => {
      const queryParams = new URLSearchParams({
        facilityId,
        query_type: 'list',
        ...filters
      });

      _fetchApi(
        `/account/purchase-requisition?${queryParams}`,
        (data) => {
          if (data.success) {
            resolve({ success: true, data: data.results });
          } else {
            reject(new Error("Failed to load purchase requisition list"));
          }
        },
        (err) => {
          console.error("Purchase Requisition List API Error:", err);
          reject(new Error("Something went wrong while fetching purchase requisition list"));
        }
      );
    });
  }

  /**
   * Get single purchase requisition by ID
   * @param {string} requisitionId - Requisition ID
   * @param {string} facilityId - Facility ID
   * @returns {Promise} API response
   */
  static getPurchaseRequisitionById(requisitionId, facilityId) {
    return new Promise((resolve, reject) => {
      _fetchApi(
        `/account/purchase-requisition/${requisitionId}?facilityId=${facilityId}&query_type=single`,
        (data) => {
          if (data.success) {
            resolve({ success: true, data: data.results });
          } else {
            reject(new Error("Failed to load purchase requisition details"));
          }
        },
        (err) => {
          console.error("Purchase Requisition Details API Error:", err);
          reject(new Error("Something went wrong while fetching purchase requisition details"));
        }
      );
    });
  }

  /**
   * Update purchase requisition status
   * @param {string} requisitionId - Requisition ID
   * @param {string} status - New status
   * @param {string} facilityId - Facility ID
   * @param {string} userId - User ID
   * @returns {Promise} API response
   */
  static updatePurchaseRequisitionStatus(requisitionId, status, facilityId, userId) {
    return new Promise((resolve, reject) => {
      _postApi(
        `/account/purchase-requisition/${requisitionId}/status`,
        {
          status,
          facilityId,
          userId,
          query_type: 'update_status'
        },
        (res) => {
          if (res.success) {
            resolve({
              success: true,
              message: res.message,
              data: res.results
            });
          } else {
            reject(new Error(res.message || "Failed to update purchase requisition status"));
          }
        },
        (err) => {
          console.error("Update Status Error:", err);
          reject(new Error("Error occurred while updating purchase requisition status"));
        }
      );
    });
  }

  /**
   * Delete purchase requisition
   * @param {string} requisitionId - Requisition ID
   * @param {string} facilityId - Facility ID
   * @returns {Promise} API response
   */
  static deletePurchaseRequisition(requisitionId, facilityId) {
    return new Promise((resolve, reject) => {
      _postApi(
        `/account/purchase-requisition/${requisitionId}/delete`,
        {
          facilityId,
          query_type: 'delete'
        },
        (res) => {
          if (res.success) {
            resolve({
              success: true,
              message: res.message
            });
          } else {
            reject(new Error(res.message || "Failed to delete purchase requisition"));
          }
        },
        (err) => {
          console.error("Delete Purchase Requisition Error:", err);
          reject(new Error("Error occurred while deleting purchase requisition"));
        }
      );
    });
  }
}

export default PurchaseRequisitionAPI;
