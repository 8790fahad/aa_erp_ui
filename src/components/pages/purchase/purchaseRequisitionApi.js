import { _fetchApi, _postApi } from "@/redux/actions/api";

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
   * Submit purchase requisition
   * @param {Object} requisitionData - Purchase requisition data
   * @param {string} requisitionData.date - Date
   * @param {string} requisitionData.requisitor - Requisitor name
   * @param {string} requisitionData.branch - Branch name
   * @param {string} requisitionData.branch_id - Branch ID
   * @param {string} requisitionData.reason - Reason for purchase
   * @param {Array} requisitionData.expenses - Expense items
   * @param {string} requisitionData.prefix - Business prefix
   * @param {string} requisitionData.user_id - User ID
   * @param {number} requisitionData.total - Total amount
   * @param {string} requisitionData.supplier_name - Supplier name (optional)
   * @param {string} requisitionData.supplier_code - Supplier code (optional)
   * @param {string} requisitionData.account_code - Account code (optional)
   * @returns {Promise} API response
   */
  static submitPurchaseRequisition(requisitionData) {
    return new Promise((resolve, reject) => {
      const payload = {
        ...requisitionData,
        query_type: "insert",
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
              // data: res.results
            });
          } else {
            reject(new Error(res.message || "Failed to submit purchase requisition"));
          }
        },
        (err) => {
          console.error("Submit Purchase Requisition Error:", err);
          reject(new Error("Error occurred while submitting purchase requisition"));
        }
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
