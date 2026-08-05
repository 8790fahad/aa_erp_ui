/* eslint-disable no-unused-vars */
import {
  SYNC_STARTED,
  SET_PURCHASED_ITEMS_LIST,
  LOADING_PURCHASES,
  GET_PURCHASES,
  LOADING_PENDING_PURCHASES,
  GET_PENDING_PURCHASES,
  SET_ITEM_LIST,
} from "./actionTypes";
import { v4 as UUIDV4 } from "uuid";
import store from "../store";
// import purchaseLocal, { remotePurchase,purchaseOrderLocal, } from "../../pouchdb/purchase_db";
// import { pullPurchaseOrderChanges, pushPurchaseOrderChanges } from "./db_sync";
import { _fetchApi, _postApi } from "./api";
import CustomSuccessAlert from "@/common/Custom/CustomSuccessAlert";
import { toast } from "sonner";

export function getPurchaseList() {
  return (dispatch) => {
    dispatch({ type: LOADING_PURCHASES });
    _fetchApi(
      `/purchase/list`,
      ({ results }) => {
        dispatch({ type: LOADING_PURCHASES });
        dispatch({ type: GET_PURCHASES, payload: results });
      },
      (err) => {
        console.log(err);
        dispatch({ type: LOADING_PURCHASES });
      }
    );
  };
}
export function getSupplierStatement(id, dateFrom, dateTo) {
  return (dispatch) => {
    // dispatch({ type: LOADING_PURCHASES });
    _fetchApi(
      `/account/get/supplier/statement/${id}/${dateFrom}/${dateTo}`,
      ({ results }) => {
        // dispatch({ type: LOADING_PURCHASES });
        dispatch({ type: "GET_SUPPLIER_STATEMENT", payload: results });
      },
      (err) => {
        console.log(err);
        dispatch({ type: LOADING_PURCHASES });
      }
    );
  };
}

// export function getSuppliers(id) {
//   return (dispatch) => {
//     _fetchApi(
//       `/drugs/supplier/all/${id}`,
//       (data) => {
//         dispatch({
//           type: MY_SUPPLIERS,
//           payload: data.results,
//         });
//       },
//       (err) => {
//         console.log(err);
//         dispatch({ type: LOADING_PURCHASES });
//       }
//     );
//   };
// }

export function getPendingPurchase(cb) {
  return (dispatch) => {
    dispatch({ type: LOADING_PENDING_PURCHASES });
    _fetchApi(
      `/purchase/pending`,
      ({ results }) => {
        dispatch({ type: LOADING_PENDING_PURCHASES });
        dispatch({ type: GET_PENDING_PURCHASES, payload: results });
        cb(results);
      },
      (err) => {
        console.log(err);
        dispatch({ type: LOADING_PENDING_PURCHASES });
      }
    );
  };
}

// export const saveReturnItem = (
//   list = [],
//   callback = (f) => f,
//   error = (f) => f
// ) => {
//   const user = store.getState().auth.user;
//   const facilityId = store.getState().auth.activeBusiness.id;
//   let finalList = [];
//   let currTime = new Date().toISOString();
//   list.forEach((i) => {
//     finalList.push({
//       ...i,
//       createdAt: currTime,
//       facilityID: facilityId,
//       userId: user.id,
//     });
//   });
//   purchaseLocal.bulkDocs(finalList, (err, resp) => {
//     if (err) {
//       return error(err);
//     } else {
//     }
//   });
// };

export const saveNewPurchase = (
  list = [],
  callback = (f) => f,
  error = (f) => f
) => {
  const user = store.getState().auth.user;
  const facilityId = store.getState().auth.activeBusiness.id;
  let currTime = new Date().toISOString();
  const totalAmount = list.length
    ? list.reduce((a, b) => a + parseFloat(b.cost), 0)
    : 0;

  let obj = {
    _id: UUIDV4(),
    tableData: list,
    description: "Items Purchased",
    userId: user.id,
    createdAt: currTime,
    facilityID: facilityId,
    supplierId: list[0]?.supplier_code,
    totalAmount,
    client: "",
    supplier_code: list[0]?.supplier_code,
    truckNo: list[0]?.truckNo,
    waybillNo: list[0]?.waybillNo,
    otherDetails: list[0]?.otherDetails,
    formTitle: {
      date: currTime,
      type: "",
      vendor: list[0]?.supplier_code,
      total: totalAmount,
      exchange_type: "-",
      exchange_rate: "0",
      supplier_code: list[0]?.supplier_code,
      process_by: user.id,
      reference_no: "",
      truckNo: list[0]?.truckNo,
      waybillNo: list[0]?.waybillNo,
      otherDetails: list[0]?.otherDetails,
      supplierTotalAmt: list[0]?.supplierTotalAmt,
    },
  };
  _postApi(
    `/account/add/purchase-order`,
    obj,
    (data) => {
      getPurchasedItems(user.busName);
      CustomSuccessAlert("submitted");
      callback(data);
      // alert(JSON.stringify(user));
    },
    (err) => {
      toast.error("Failed ");
      error(err);
    }
  );
};

// export const saveNewPurchaseToCache = (
//   list = [],
//   callback = (f) => f,
//   error = (f) => f
// ) => {
//   const user = store.getState().auth.user;
//   const facilityId = store.getState().auth.activeBusiness.id;
//   let finalList = [];
//   let exisitingList = [];
//   let currTime = new Date().toISOString();
//   list.forEach((i) => {
//     let itemIsNew = i.saveAsNewItem || !i.exisitingId;
//     if (itemIsNew) {
//       finalList.push({
//         ...i,
//         createdAt: currTime,
//         facilityID: facilityId,
//         userId: user.id,
//       });
//     } else {
//       exisitingList.push({
//         ...i,
//         createdAt: currTime,
//         facilityID: facilityId,
//         userId: user.id,
//       });
//     }
//   });

//   purchaseLocal.bulkDocs(finalList, (err, resp) => {
//     // console.log(err, 'err', resp, 'resp')
//     if (err) {
//       return error(err);
//     } else {
//       for (let e = 0; e < exisitingList.length; e++) {
//         let currItem = exisitingList[e];
//         // console.log(currItem, "============newItem==========");
//         purchaseLocal
//           .get(currItem.exisitingId)
//           .then((doc) => {
//             // console.log(doc, "============existingItem==========");
//             let newQuantity =
//               parseInt(currItem.quantity) + parseInt(doc.quantity);
//             let newObj = {
//               ...doc,
//               ...currItem,
//               quantity: newQuantity,
//               _id: doc._id,
//             };
//             console.log(newQuantity);
//             console.log(newObj);
//             purchaseLocal
//               .put(newObj)
//               .then((resp) => {
//                 console.log("Successfully updated item info", resp);
//                 callback();
//               })
//               .catch((err) => toast.error("Error Occured"));
//           })
//           .catch((err) => console.log(err));

//         // updatePurchase(currItem.exisitingId, currItem)
//         // purchaseLocal.get(e.exisitingId).then()
//       }
//       // console.log(exisitingList, 'LFJFIJKKJJJJJJJJJJJJ')
//       purchaseOrderLocal
//         .put({
//           _id: UUIDV4(),
//           items: [...finalList, ...exisitingList],
//           description: "purchase order items",
//           userId: user.id,
//           createdAt: currTime,
//           facilityID: facilityId,
//           supplierId: finalList.length ? finalList[0].supplierId : "",
//           totalAmount: finalList.length
//             ? finalList.reduce((a, b) => a + parseFloat(b.cost), 0)
//             : "",
//           client: "",
//           supplier_code: finalList[0]?.supplier_code,
//           truckNo: finalList[0]?.truckNo,
//           waybillNo: finalList[0]?.waybillNo,
//           otherDetails: finalList[0]?.otherDetails,
//         })
//         .then((docs) => {
//           console.log(resp);
//           console.log("Purchases list saved successfully");
//           callback();
//           pushPurchaseOrderChanges(() => pullPurchaseOrderChanges());
//         })
//         .catch((err) => {
//           console.log("Error saving purchase order list", err);
//         });
//     }
//   });
// };

// export const updateItemImage = (
//   image,
//   item,
//   callback = (f) => f,
//   error = (f) => f
// ) => {
//   // let splittedName = image.fileName.split('.')
//   // let fileExt = splittedName[splittedName.length - 1]
//   let _attachments = {
//     [item.item_name]: {
//       content_type: image.type,
//       data: image.base64,
//     },
//   };
//   item._attachments = _attachments;
//   // console.log(item)
//   purchaseLocal
//     .put(item)
//     .then((resp) => {
//       console.log("Successfully updated item info", resp);
//       callback();
//     })
//     .catch((err) => error(err));
// };

// export const updatePurchase = (
//   id = "",
//   data = {},
//   callback = (f) => f,
//   error = (f) => f
// ) => {
//   console.log(id, data);

//   purchaseLocal
//     .get(id)
//     .then((doc) => {
//       purchaseLocal
//         .put({
//           ...doc,
//           ...data,
//         })
//         .then((resp) => {
//           console.log("Successfully updated item info", resp);
//           callback();
//         })
//         .catch((err) => console.log(err));
//     })
//     .catch((err) => {
//       error(err);
//     });
// };

export const getPurchasedItems = (
  storeName = "Show All Stores",
  callback = (f) => f,
  error = (f) => f
) => {
  return function (dispatch) {
    const activeBusiness = store.getState().auth.activeBusiness;
    if (!activeBusiness) {
      console.error("activeBusiness is undefined");
      return;
    }
    // const storeName = "Show All Stores"
    const facilityId = activeBusiness.id;

    _fetchApi(
      `/get/branch/location/${storeName}/${facilityId}`,
      (data) => {
        // alert(JSON.stringify("Outside: ", data.results));
        if (data && data.results) {
          // alert(JSON.stringify(data.results));
          dispatch({
            type: SET_PURCHASED_ITEMS_LIST,
            payload: data.results,
          });
          callback(data.results);
        }
      },
      (err) => {
        console.log(err);
        error(err);
      }
    );
  };
};

// export const getPurchasedItemsFromCache = (
//   callback = (f) => f,
//   error = (f) => f
// ) => {
//   return (dispatch) => {
//     // const user = store.getState().auth.user;
//     const facilityId = store.getState().auth.activeBusiness.id;
//     //   .allDocs({ include_docs: true })
//     //   .then((d) => console.log(d.rows[0]))
//     // console.log(user.facilityId)
//     purchaseLocal
//       .createIndex({ index: { fields: ["facilityId", "createdAt"] } })
//       .then(() => {
//         return purchaseLocal.find({
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
//         console.log(data, "DSSSSSSSSSSSSSSSSSSSSSSSSS");
//         let itemBySupply = {};
//         let itemByItems = {};

//         data.forEach((item) => {
//           if (Object.keys(itemByItems).includes(item["item_name"])) {
//             itemByItems[item["item_name"]] = [
//               ...itemByItems[item["item_name"]],
//               item,
//             ];
//           } else {
//             itemByItems[item["item_name"]] = [item];
//           }
//         });
//         data.forEach((item) => {
//           if (Object.keys(itemBySupply).includes(item["supplierName"])) {
//             itemBySupply[item["supplierName"]] = [
//               ...itemBySupply[item["supplierName"]],
//               item,
//             ];
//           } else {
//             itemBySupply[item["supplierName"]] = [item];
//           }
//         });

//         dispatch({
//           type: SET_PURCHASED_ITEMS_LIST,
//           payload: data,
//         });
//         dispatch({
//           type: SET_PURCHASED_BY_SUPPLIER,
//           payload: itemBySupply,
//         });
//         dispatch({
//           type: SET_PURCHASED_ITEMS_GROUP,
//           payload: itemByItems,
//         });
//         callback(data);
//       })
//       .catch((err) => {
//         console.log("Error: ", err);
//         error(err);
//       });
//   };
// };

export const getItemList = (
  category,
  callback = () => {},
  error = (err) => console.error(err)
) => {
  return (dispatch) => {
    const activeBusiness = store.getState().auth.activeBusiness;
    if (!activeBusiness) {
      console.error("activeBusiness is undefined");
      return;
    }

    const facilityId = activeBusiness.id;
    console.log(category);

    _postApi(
      `/inventory/register?query_type=select-item`,
      { facilityId: activeBusiness.id, category: category },
      (data) => {
        if (data && data.results) {
          dispatch({
            type: SET_ITEM_LIST,
            payload: data.results,
          });
          callback(data.results);
        }
      },
      (err) => {
        console.error(err);
        error(err);
      }
    );
  };
};

// export const deletePurchase = (id, callback) => {
//   purchaseLocal
//     .get(id)
//     .then((doc) => {
//       doc._deleted = true;
//       return purchaseLocal.put(doc);
//     })
//     .then(() => callback())
//     .catch(() => console.log("Error when deleting purchase document"));
// };

// export const sellItem = (list, success) => {
//   // console.log(list)
//   for (let k = 0; k < list.length; k++) {
//     let item = list[k];

//     purchaseLocal.get(item.item_id).then((doc) => {
//       let newDoc = { ...doc, quantity: doc.quantity - item.quantity };
//       // console.log(newDoc)
//       purchaseLocal.put(newDoc);
//     });

//     // if (k === list - 1) {

//     //   console.log('reached last')
//     // }
//   }
//   // list.forEach((item) => {
//   //   // console.log('item', item)

//   // })
//   success();
//   console.log("===============");
// };

// export const returnSellItem = (list, success) => {

//   _postApi(`/`)
// }

// export const returnSellItem = (list, success) => {
//   // console.log(list)
//   for (let k = 0; k < list.length; k++) {
//     let item = list[k];

//     purchaseLocal.get(item.item_id).then((doc) => {
//       let newDoc = {
//         ...doc,
//         quantity: parseInt(doc.quantity) + parseInt(item.quantity),
//       };
//       console.log(newDoc);
//       console.log(
//         "fahhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh"
//       );
//       purchaseLocal.put(newDoc);
//     });

//     // if (k === list - 1) {

//     //   console.log('reached last')
//     // }
//   }
//   // list.forEach((item) => {
//   //   // console.log('item', item)

//   // })
//   success();
//   console.log("===============");
// };

export const getExpiryAlerts = () => {
  return (dispatch) => {};
};

export const getReorderLevelAlerts = () => {
  return (dispatch) => {};
};

export const syncPurchaseDB = (onComplete = (f) => f) => {
  return (dispatch) => {
    dispatch({ type: SYNC_STARTED });

    // let opts = { live: true, retry: true };

    // do one way, one-off sync from the server until completion
    // oneWaySync(() => {
    //   purchaseLocal
    //       .sync(remotePurchase, opts)
    //       .on('change', onSyncChange)
    //       .on('paused', onSyncPaused)
    //       .on('error', onSyncError)
    //     })
  };
};

// export const pushPurchasesChanges = (onComplete = (f) => f) => {
//   console.log("start pushing Purchases updates");
//   purchaseLocal.replicate
//     .to(remotePurchase)
//     .on("complete", (info) => {
//       console.log("pushed changes to Purchasess");
//       console.log(info);
//       onComplete();
//     })
//     .on("error", (err) => {
//       console.log("error pushing changes to Purchases db", err);
//     });
// };

// export const pullPurchasesChanges = (onComplete = (f) => f) => {
//   console.log("start pulling Purchases updates");
//   purchaseLocal.replicate
//     .from(remotePurchase)
//     .on("complete", (info) => {
//       console.log("pushed changes to Purchasess");
//       console.log(info);
//       onComplete();
//     })
//     .on("error", (err) => {
//       console.log("error pushing changes to Purchases db", err);
//     });
// };
