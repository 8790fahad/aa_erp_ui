/* eslint-disable no-prototype-builtins */
/* eslint-disable no-unused-vars */
// import { remoteDB, localDB } from '../../pouchdb'
import { SYNC_STARTED } from "./actionTypes";
import { v4 as UUIDV4 } from "uuid";
import { SET_SUPPLIER_LIST } from "./actionTypes";
import store from "../store.js";
// import suppliersLocal, { remoteSuppliers } from "../../pouchdb/suppliers";
import { apiURL, _fetchApi, _postApi } from "./api";
// import { saveDataToCache, getDataFromCache } from "./reports";
import { DATA_KEYS } from "../../constants";
import moment from "moment";
const TAG = "CHECK";

export const groupData = (data, groupingKey) => {
  let requiredFormat = {};
  for (let i; i < data.length; i++) {
    let item = data[i];

    if (Object.keys(requiredFormat).includes(item[groupingKey])) {
      requiredFormat[item[groupingKey]] = [
        ...requiredFormat[item[groupingKey]],
        item,
      ];
    } else {
      requiredFormat[item[groupingKey]] = [item];
    }
  }

  // data.forEach((item) => {
  //   if (Object.keys(requiredFormat).includes(item[groupingKey])) {
  //     requiredFormat[item[groupingKey]] = [
  //       ...requiredFormat[item[groupingKey]],
  //       item,
  //     ]
  //   } else {
  //     requiredFormat[item[groupingKey]] = [item]
  //   }
  // })

  return requiredFormat;
};

export const getSupplierStatment = (
  supplierId = "",
  from = "",
  to = "",
  callback = (f) => f,
  _id
) => {
  const showWayBill = store.getState().reports.showWayBill;
  const facilityId = store.getState().auth.activeBusiness.id;
  const dataKey = `${DATA_KEYS.SUPPLIER_STATEMENT}:${supplierId}:${facilityId}`;

  // alert('asdf')
  _fetchApi(
    `/supplier/get-supplier-statement?facilityId=${facilityId}&supplierId=${supplierId}&from=${from}&to=${to}`,
    (data) => {
      let groupingKey = "truckNo";
      // callback(data.results)
      let requiredFormat = {};
      // let formattedData = groupData(data.results, 'created_at')
      if (showWayBill) {
        data.results.forEach((item) => {
          if (Object.keys(requiredFormat).includes(item[groupingKey])) {
            requiredFormat[item[groupingKey]] = [
              ...requiredFormat[item[groupingKey]],
              item,
            ];
          } else {
            requiredFormat[item[groupingKey]] = [item];
          }
        });
      } else {
        data.results.forEach((item) => {
          if (Object.keys(requiredFormat).length) {
            requiredFormat["-"] = [...requiredFormat["-"], item];
          } else {
            requiredFormat["-"] = [item];
          }
        });
      }

      // saveDataToCache(dataKey, requiredFormat);
      callback(requiredFormat);
    },
    (err) => {
      console.log(err);
    }
  );
};

export const getItemHistory = (
  item = "",
  _store = "",
  from = "",
  to = "",
  callback = (f) => f
) => {
  const facilityId = store.getState().auth.activeBusiness.id;
  const query_type = "report";
  const dataKey = `${DATA_KEYS.ITEM_HISTORY}:${item}:${query_type}:${facilityId}`;

  // getDataFromCache(dataKey, (data) => {
  //   callback(data);
  // });

  _fetchApi(
    `/inventory/get-item-history?item_name=${item}&store=${_store}&facilityId=${facilityId}&from=${from}&to=${to}&query_type=${query_type}`,
    (data) => {
      let groupingKey = "item_name";
      // callback(data.results)
      let requiredFormat = {};
      // let formattedData = groupData(data.results, 'created_at')
      data.results.forEach((item) => {
        if (Object.keys(requiredFormat).includes(item[groupingKey])) {
          requiredFormat[item[groupingKey]] = [
            ...requiredFormat[item[groupingKey]],
            item,
            console.log(data, "LLLLLLLPPPPPPPP"),
          ];
        } else {
          requiredFormat[item[groupingKey]] = [item];
        }
      });

      // saveDataToCache(dataKey, requiredFormat);

      callback(requiredFormat);
    },
    (err) => {
      console.log(err);
    }
  );
};

export const getItemBalance = (item = "", callback = (f) => f) => {
  const facilityId = store.getState().auth.activeBusiness.id;
  const query_type = "balance";
  const dataKey = `${DATA_KEYS.ITEM_HISTORY}:${item}:${query_type}:${facilityId}`;

  // getDataFromCache(dataKey, (data) => {
  //   callback(data);
  // });

  _fetchApi(
    `/inventory/get-item-history?facilityId=${facilityId}&item_name=${item}&query_type=${query_type}`,
    (data) => {
      // console.log(data)
      if (data && data.results && data.results.length) {
        let balance = data.results[0].balance;
        callback(balance);
        // saveDataToCache(dataKey, balance);
      }
    },
    (err) => {
      console.log(err);
    }
  );
};

export const saveNewSupplier = (
  obj = {},
  callback = (f) => f,
  error = (f) => f
) => {
  const user = store.getState().auth.user;
  const facilityId = store.getState().auth.activeBusiness.id;
  let uuid = UUIDV4();
  obj._id = obj.supplier_code ? obj.supplier_code : uuid;
  obj.createdAt = new Date().toISOString();
  obj.facilityID = facilityId;
  obj.userId = user.id;
  obj._rev = moment().format("mmDDssMMmsYY");

  _postApi(
    ` `,
    obj,
    (data) => {
      console.log(data);
      callback();
    },
    (err) => {
      console.log(err);
      error(err);
    }
  );
};

// export const saveNewSupplierToCache = (
//   obj = {},
//   callback = (f) => f,
//   error = (f) => f
// ) => {
//   const user = store.getState().auth.user;
//   const facilityId = store.getState().auth.activeBusiness.id;
//   let uuid = UUIDV4();
//   obj._id = uuid;
//   obj.createdAt = new Date().toISOString();
//   obj.facilityID = facilityId;
//   obj.userId = user.id;

//   suppliersLocal
//     .put(obj)
//     .then((resp) => {
//       console.log("Supplier created successfully");
//       pushSuppliersChanges(() => pullSuppliersChanges());
//       callback();
//     })
//     .catch((err) => {
//       console.log("Error: ", err);
//       error(err);
//     });
// };

export const getSuppliers = (callback = (f) => f, error = (f) => f) => {
  return (dispatch) => {
    const facilityId = store.getState().auth.activeBusiness.id;

    // Use new supplier API endpoint with pagination support
    _fetchApi(
      `/api/suppliers?facilityId=${facilityId}&limit=1000`,
      (data) => {
        console.log("Suppliers API Response:", data);
        // New API returns data in data.data.suppliers format
        if (data && data.success && data.data && data.data.suppliers) {
          callback(data.data.suppliers);
          dispatch({ type: SET_SUPPLIER_LIST, payload: data.data.suppliers });
        } else if (data && data.results) {
          // Fallback for old API format
          callback(data.results);
          dispatch({ type: SET_SUPPLIER_LIST, payload: data.results });
        }
      },
      (err) => {
        console.log("Error fetching suppliers:", err);
        error(err);
      }
    );
  };
};

// export const getSuppliersFromCache = (
//   callback = (f) => f,
//   error = (f) => f
// ) => {
//   return (dispatch) => {
//     const facilityId = store.getState().auth.activeBusiness.id;
//     suppliersLocal
//       .createIndex({ index: { fields: ["facilityID", "createdAt"] } })
//       .then(() => {
//         return suppliersLocal.find({
//           selector: {
//             facilityID: {
//               $eq: facilityId,
//             },
//             createdAt: {
//               $gt: null,
//             },
//           },
//         });
//       })
//       .then((resp) => {
//         let data = resp.docs;
//         callback(data);
//         dispatch({ type: SET_SUPPLIER_LIST, payload: data });
//       })
//       .catch((err) => {
//         error(err);
//         console.log(err);
//       });
//     // suppliersLocal
//     //   .allDocs({ include_docs: true })
//     //   .then((d) => console.log(d.rows[0]))
//     //   .catch((err) => console.log('err'))
//   };
// };

// export const deleteSupplier = (id, callback = (f) => f) => {
//   suppliersLocal
//     .get(id)
//     .then((doc) => {
//       doc._deleted = true;
//       return suppliersLocal.put(doc);
//     })
//     .then(() => callback())
//     .catch((err) => console.log("Error when deleting supplier document", err));
// };

// export const updateSupplier = (
//   id = "",
//   data = {},
//   callback = (f) => f,
//   error = (f) => f
// ) => {
//   console.log(id, data);

//   suppliersLocal
//     .get(id)
//     .then((doc) => {
//       suppliersLocal
//         .put({
//           ...doc,
//           ...data,
//         })
//         .then((resp) => {
//           console.log("Successfully updated supplier info", resp);
//           callback();
//         })
//         .catch((err) => console.log(err));
//     })
//     .catch((err) => {
//       console.log("Error: ", err);

//       error(err);
//     });
// };

// export const syncSuppliers = (onComplete = (f) => f) => {
//   return (dispatch) => {
//     dispatch({ type: SYNC_STARTED });

//     let opts = { live: true, retry: true };

//     const onSyncChange = (info) => {
//       console.log(TAG, "SupplierDB sync onChange", info);
//     };

//     const onSyncPaused = (err) => {
//       console.log(TAG, "SupplierDB sync onPaused", err);
//     };

//     const onSyncError = (err) => {
//       console.log(TAG, "SupplierDB sync onError", err);
//     };

//     // do one way, one-off sync from the server until completion
//     suppliersLocal.replicate
//       .from(remoteSuppliers)
//       .on("complete", function (info) {
//         console.log("one way replication completed", info);
//         // then two-way, continuous, retriable sync
//         suppliersLocal
//           .sync(remoteSuppliers, opts)
//           .on("change", onSyncChange)
//           .on("paused", onSyncPaused)
//           .on("error", onSyncError);
//       })
//       .on("error", onSyncError);
//   };
// };

// export const pushSuppliersChanges = (onComplete = (f) => f) => {
//   console.log("start pushing Suppliers updates");
//   suppliersLocal.replicate
//     .to(remoteSuppliers)
//     .on("complete", (info) => {
//       console.log("pushed changes to Suppliers");
//       console.log(info);
//       onComplete();
//     })
//     .on("error", (err) => {
//       console.log("error pushing changes to Suppliers db", err);
//     });
// };

// export const pullSuppliersChanges = (onComplete = (f) => f) => {
//   console.log("start pulling Suppliers updates");
//   suppliersLocal.replicate
//     .from(remoteSuppliers)
//     .on("complete", (info) => {
//       console.log("pushed changes to Suppliers");
//       console.log(info);
//       onComplete();
//     })
//     .on("error", (err) => {
//       console.log("error pushing changes to Suppliers db", err);
//     });
// };

export function unflatten(arr) {
  var tree = [],
    mappedArr = {},
    arrElem,
    mappedElem;

  // First map the nodes of the array to an object -> create a hash table.
  for (var i = 0, len = arr.length; i < len; i++) {
    arrElem = arr[i];
    mappedArr[arrElem.head] = arrElem;
    mappedArr[arrElem.head]["items"] = [];
  }

  for (var head in mappedArr) {
    // console.log(head, mappedArr)
    if (mappedArr.hasOwnProperty(head)) {
      mappedElem = mappedArr[head];
      // If the element is not at the root level, add it to its parent array of items.
      if (mappedElem.subHead) {
        mappedArr[mappedElem["subHead"]]["items"].push(mappedElem);
      }
      // If the element is at the root level, add it to first level elements array.
      else {
        tree.push(mappedElem);
      }
    }
  }
  return tree;
}
