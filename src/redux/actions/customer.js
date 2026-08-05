/* eslint-disable no-unused-vars */
import { v4 as UUIDV4 } from "uuid";
import { SET_NEW_CUSTOMER } from "./actionTypes";
import store from "../store.js";
// import customersLocal, { remoteCustomersDB } from "../../pouchdb/customers";
// import { pushTransactionChanges, saveTransaction } from "./transactions";
// import { getDataFromCache, saveDataToCache } from "./reports";
import { _fetchApi, _postApi } from "./api";


export const saveNewCustomer = (obj, callback, error) => {
  const { activeBusiness, user } = store.getState().auth;
  obj._id = UUIDV4();
  obj.createdAt = new Date().toISOString();
  obj.facId = activeBusiness.id;
  obj.userId = user.id;
  console.error({ obj });
  const data = {
    source: obj.source,
    description: obj.description || "Customer Deposit",
    business_name: activeBusiness.business_name,
    createdAt: obj.createdAt,
    userId: obj.userId,
    accountType: obj.customerCategory || "",
    facilityId: obj.facId,
    customerName: obj.customerName,
    version_id: Date.now(),
    depositAmount: obj.amount,
    store_name: obj.store || activeBusiness.business_name,
    narration: obj.narration,
    receiptNo: obj.receiptNo,
    bank_name: obj.bank_name,
    bank_code: obj.bank_code,
    bank_chart_code: obj.bank_chart_code,
    clientAccount: obj.clientAccount,
    customerId: obj.customerId,
    customerHead: obj.customerHead,
    customerSubHead: obj.customerSubHead,
    transaction_type: obj.transaction_type,
    ...obj,
  };
  const url2 = `/client/new`;
  const url = obj.deposite ? `/v1/customer/deposit` : url2;
  if (data.name !== "") {
    _postApi(
      url,
      data,
      () => {
        callback();
      },
      (err) => {
        console.log(err);
        error(err);
      }
    );
  }
};

// export const saveNewCustomerCache = (
//   obj = {},
//   callback = (f) => f,
//   error = (f) => f
// ) => {
//   const { activeBusiness, user } = store.getState().auth;
//   // const user = store.getState().auth.user;
//   obj._id = UUIDV4();
//   obj.createdAt = new Date().toISOString();
//   obj.facId = activeBusiness.id;
//   obj.userId = user.id;

//   // customersLocal.get('customers')
//   // .then((doc) => {
//   customersLocal
//     .put(obj)
//     .then(() => {
//       // console.log('New Customer')
//       let receiptNo = moment().format("YYMDhms");
//       let txn = [];
//       if (parseFloat(obj.amount) > 0) {
//         txn.push({
//           _id: UUIDV4(),
//           source: "CASH",
//           product_code: "",
//           amount: obj.amount,
//           destination: "PAYABLE",
//           quantity: 0,
//           description: obj.customerName,
//           receiptNo,
//           narration: "CUSTOMER DEPOSIT",
//           modeOfPayment: "Cash",
//           customerId: obj._id,
//           transaction_type: "CUSTOMER_DEPOSIT",
//         });
//       }
//       saveTransaction(
//         txn,
//         () => {
//           callback();
//           pushCustomersDBChanges();
//         },
//         (err) => {
//           console.log(err);
//           callback();
//         },
//         TRANSACTION_TYPES.CUSTOMER_DEPOSIT
//       );
//     })
//     .catch((err) => {
//       console.log(err);
//       error();
//     });
//   // })
//   // .catch((err) => {
//   //   console.log(err)
//   //   db.put({ _id, customers: [obj] })
//   //     .then(() => console.log('new Customer'))
//   //     .catch((_err) => {
//   //       error(err)
//   //       console.log(_err)
//   //     })
//   // })
//   // })
// };

export const getCustomerById = (
  query_type,
  id,
  storeName = "Show All Stores",
  cd = (f) => f,
  error = (f) => f
) => {
  // const user = store.getState().auth.user;
  _fetchApi(
    `/account/customer-details?query_type=${query_type}&customer=${id}&storeName=${storeName}`,
    (data) => {
      // console.log(data.results)
      if (data && data.results && data.results.length) {
        cd(data.results);
      }
    },
    (error) => {
      console.error(error);
    }
  );
};

// export const getCustomerByIdsCache = (
//   id,
//   callback = (f) => f,
//   error = (f) => f
// ) => {
//   // const user = store.getState().auth.user;
//   // const facilityId = store.getState().auth.activeBusiness.id
//   customersLocal
//     .get(id)
//     .then((resp) => {
//       // let data = resp.docs;
//       // console.log(resp, '======================================================')
//       callback(resp);
//     })
//     .catch((err) => {
//       error(err);
//       console.log(err);
//     });
// };

export const getCustomers = (
  storeName = "Show All Stores",
  callback = (f) => f,
  error = (f) => f
) => {
  return (dispatch) => {
    // const user = store.getState().auth.user;
    const facilityId = store.getState().auth.activeBusiness.id;
    _fetchApi(
      `/account/customer-details?query_type=customers&customer=${facilityId}&storeName=${storeName}`,
      (data) => {
        // console.log(data.results)
        if (data && data.results && data.results.length) {
          callback();
          dispatch({ type: SET_NEW_CUSTOMER, payload: data.results });
        }
      },
      (err) => {
        console.error(err);
        error();
      }
    );
  };
};

// export const getCustomersCache = (callback = (f) => f, error = (f) => f) => {
//   return (dispatch) => {
//     // const user = store.getState().auth.user;
//     const facilityId = store.getState().auth.activeBusiness.id;
//     customersLocal
//       .createIndex({ index: { fields: ["facilityID", "createdAt"] } })
//       .then(() => {
//         return customersLocal.find({
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
//         // console.log(data, '======================================================')
//         callback(data);
//         dispatch({ type: SET_NEW_CUSTOMER, payload: data });
//       })
//       .catch((err) => {
//         error(err);
//         console.log(err);
//       });
//   };
// };

// add deposit amount to cache customer data
// export const fundCustomer = (
//   _id = "",
//   amt = 0,
//   callback = (f) => f,
//   error = (f) => f
// ) => {
//   console.log("funding amount ===>", amt);
//   customersLocal
//     .get(_id)
//     .then((doc) => {
//       let initialBalance = doc.amount || 0;
//       doc.amount = parseFloat(initialBalance) + parseFloat(amt);
//       customersLocal.put(doc);
//       pushTransactionChanges(() => {
//         callback();
//         pushCustomersDBChanges();
//       });
//     })
//     .catch((e) => error(e));
// };

// {"acct": "0ca6411a-76b1-4cfe-8736-6bb4307bdfaa", "createdAt": "2021-07-10T02:22:55.000Z",
// "credit": 0, "debit": 2000, "description": "Customer Deposit", "reference_no": "2171022252"}

// deduct service amount from cache
// export const chargeCustomer = (
//   _id,
//   amt,
//   callback = (f) => f,
//   error = (f) => f
// ) => {
//   console.log("deducting amount ===>", amt);
//   customersLocal
//     .get(_id)
//     .then((doc) => {
//       let initialBalance = doc.amount || 0;
//       doc.amount = parseFloat(initialBalance) - parseFloat(amt);

//       customersLocal.put(doc);
//       callback();
//     })
//     .catch((e) => error(e));
// };

// save customer service txn to cache
// export const saveCustomerTxnToCache = (client = {}, data = [], total = 0) => {
//   console.log("saving transaction to cache");
//   const facilityId = store.getState().auth.user.facilityId;

//   let statement = `stmt_${client._id}_${facilityId}`;
//   let stmtTotal = `stmt_total_${client._id}_${facilityId}`;
//   let stmtBal = `stmt_bal_${client._id}_${facilityId}`;
//   let txn = "daily_sales_report";

//   getDataFromCache(txn, (txnData) => {
//     let newTxnList = [];
//     data.forEach((item) => {
//       newTxnList.push({
//         createdAt: new Date().toISOString(),
//         credit: item.amount,
//         description: item.item_name,
//         receiptDateSN: item.receiptNo,
//       });
//     });

//     let finalTxn = [...newTxnList, ...txnData];
//     saveDataToCache(txn, finalTxn);
//   });

//   getDataFromCache(statement, (clientStatement) => {
//     getDataFromCache(stmtTotal, (statementTotal) => {
//       getDataFromCache(stmtBal, (statementBal) => {
//         let newStmtList = [];

//         data.forEach((item) => {
//           newStmtList.push({
//             acct: client._id,
//             createdAt: new Date().toISOString(),
//             credit: item.amount,
//             debit: 0,
//             description: item.item_name,
//             reference_no: item.receiptNo,
//           });
//           // newTxnList.push({
//           //   createdAt: new Date().toISOString(),
//           //   credit: item.amount,
//           //   description: item.description,
//           //   receiptDateSN: item.receiptNo,
//           // })
//         });
//         let finalStatementList = [...newStmtList, ...clientStatement];
//         let finalTotal = parseInt(statementTotal) + parseInt(total);
//         let finalBal = parseInt(statementBal) + parseInt(total);
//         saveDataToCache(statement, finalStatementList);
//         saveDataToCache(stmtTotal, finalTotal);
//         saveDataToCache(stmtBal, finalBal);
//       });
//     });
//   });
// };

// save customer deposit txn to cache
export const saveCustomerDeposit = (client, data = [], total = 0) => {
  const facilityId = store.getState().auth.activeBusiness.id;

  let statement = `stmt_${client._id}_${facilityId}`;
  let stmtTotal = `stmt_total_${client._id}_${facilityId}`;
  let stmtBal = `stmt_bal_${client._id}_${facilityId}`;
  let url = "/transactions/deposit";
  _postApi(
    url,
    data,
    () => {},
    (error) => {
      console.log(error);
    }
  );
};

// export const saveCustomerDepositTxnToCache = (client, data = [], total = 0) => {
//   const facilityId = store.getState().auth.activeBusiness.id;

//   let statement = `stmt_${client._id}_${facilityId}`;
//   let stmtTotal = `stmt_total_${client._id}_${facilityId}`;
//   let stmtBal = `stmt_bal_${client._id}_${facilityId}`;
//   // let txn = 'daily_sales_report'

//   getDataFromCache(statement, (clientStatement) => {
//     getDataFromCache(stmtTotal, (statementTotal) => {
//       getDataFromCache(stmtBal, (statementBal) => {
//         // getDataFromCache(txn, (txnData) => {
//         let newStmtList = [];
//         // let newTxnList = []

//         data.forEach((item) => {
//           newStmtList.push({
//             acct: client._id,
//             createdAt: new Date().toISOString(),
//             credit: 0,
//             debit: item.amount,
//             description: "Customer Depost",
//             reference_no: item.receiptNo,
//           });
//         });
//         let finalStatementList = [...newStmtList, ...clientStatement];
//         let finalTotal = parseInt(statementTotal) + parseInt(total);
//         let finalBal = parseInt(statementBal) - parseInt(total);
//         saveDataToCache(statement, finalStatementList);
//         saveDataToCache(stmtTotal, finalTotal);
//         saveDataToCache(stmtBal, finalBal);
//         // })
//       });
//     });
//   });
// };

// export const deleteCustomer = (id, callback) => {
//   customersLocal
//     .get(id)
//     .then((doc) => {
//       doc._deleted = true;
//       return customersLocal.put(doc);
//     })
//     .then(() => callback())
//     .catch(() => console.log("Error when deleting purchase document"));
// };

// export const updateCustomer = (
//   id = "",
//   data = {},
//   callback = (f) => f,
//   error = (f) => f
// ) => {
//   customersLocal
//     .get("customers")
//     .then((doc) => {
//       customersLocal
//         .put({
//           _id,
//           _rev: doc._rev,
//           customers: [...doc.customers, data],
//         })
//         .then(() => {
//           console.log("new Customer");
//           callback();
//         })
//         .catch((err) => console.log(err));
//     })
//     .catch((err) => {
//       console.log(err);
//       customersLocal
//         .put({ _id, customers: [data] })
//         .then(() => console.log("new Customer"))
//         .catch((_err) => console.log(_err));
//       error(err);
//     });
// };
const TAG = "CHECK";

// export function syncCustomersDB() {
//   return (dispatch) => {
//     dispatch({ type: SYNC_STARTED });

//     let opts = { live: true, retry: true };

//     const onSyncChange = (info) => {
//       console.log(TAG, "CustomerDB sync onChange", info);
//     };

//     const onSyncPaused = (err) => {
//       console.log(TAG, "CustomerDB sync onPaused", err);
//     };

//     const onSyncError = (err) => {
//       console.log(TAG, "CustomerDB sync onError", err);
//     };

//     // do one way, one-off sync from the server until completion
//     customersLocal.replicate
//       .from(remoteCustomersDB)
//       .on("complete", function (info) {
//         console.log("one way replication completed", info);
//         // then two-way, continuous, retriable sync
//         customersLocal
//           .sync(remoteCustomersDB, opts)
//           .on("change", onSyncChange)
//           .on("paused", onSyncPaused)
//           .on("error", onSyncError);
//       })
//       .on("error", onSyncError);
//   };
// }

// export const pushCustomersDBChanges = (onComplete = (f) => f) => {
//   console.log("start pushing CustomersDB updates");
//   customersLocal.replicate
//     .to(remoteCustomersDB)
//     .on("complete", (info) => {
//       console.log("pushed changes to CustomersDB");
//       console.log(info);
//       onComplete();
//     })
//     .on("error", (err) => {
//       console.log("error pushing changes to CustomersDB db", err);
//     });
// };

// export const pullCustomersDBChanges = (onComplete = (f) => f) => {
//   console.log("start pulling CustomersDB updates");
//   customersLocal.replicate
//     .from(remoteCustomersDB)
//     .on("complete", (info) => {
//       console.log("pushed changes to CustomersDB");
//       console.log(info);
//       onComplete();
//     })
//     .on("error", (err) => {
//       console.log("error pushing changes to CustomersDB db", err);
//     });
// };
