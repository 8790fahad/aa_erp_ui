/* eslint-disable no-prototype-builtins */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
import { SYNC_STARTED, GET_REPRINT } from './actionTypes'
import { _fetchApi, _postApi } from './api'
import {
  CREATE_ACC_HEAD,
  GET_EXPENDITURE_ACC_REPORT,
  GET_ACC_HEAD,
  GET_REV_ACC_HEAD,
  GETTING_TOTAL_SALES_BY_USER,
  GET_TOTAL_SALES_BY_USER,
  GET_AMOUNT_RECEIVED,
  GET_AMOUNT_HANDEDOVER,
  GET_EXPENSES_ACC_HEAD,
  GET_GENERAL_ACC_REPORT_LOADING,
  GET_GENERAL_ACC_REPORT,
  GET_REVENUE_ACC_REPORT,
  GETTING_ACC_CHART,
  GET_ACC_CHART_TREE,
} from './actionTypes'

import store from '../store'
// import transactionsLocal, {
//   remoteTransactions,
// } from '../../pouchdb/transactions'
import {
  makeSale,
  newExpenses,
  newPurchase,
  returnAndReplace,
  saveDeposit,
  supplierPayment,
} from './transactionApi'
import { TRANSACTION_TYPES } from '../../constants'
import moment from 'moment'
import { toast } from 'sonner'

export const saveTransaction = (
  list = [],
  callback = (f) => f,
  error = (f) => f,
  query_type = '',
) => {
  console.log('Called transaction', list, query_type)
  console.log( query_type)
  if (list.length) {
    const user = store.getState().auth.user
    const facilityId = store.getState().auth.activeBusiness.id
    let finalList = []
    list.forEach((i) => {
      if (i.imeiImage) {
        let _attachments = {
          imei_image: {
            content_type: i.imeiImage.type,
            data: i.imeiImage.base64,
          },
        }
        finalList.push({
          ...i,
          createdAt: new Date().toISOString(),
          receive_date: moment().format('YYYY-MM-DD'),
          facilityID: facilityId,
          userId: user.id,
          userName: user.username,
          _attachments,
        })
      } else {
        finalList.push({
          ...i,
          createdAt: new Date().toISOString(),
          receive_date: moment().format('YYYY-MM-DD'),
          facilityID: facilityId,
          userId: user.id,
          userName: user.username,
        })
      }
    })
    let data = finalList[0]
    console.log('Saving the transactions', query_type)
    switch (query_type) {
      case TRANSACTION_TYPES.CUSTOMER_DEPOSIT:
        return saveDeposit(data, callback, error)
      case TRANSACTION_TYPES.NEW_SALE:
        return makeSale(finalList, callback, error)
      case TRANSACTION_TYPES.NEW_PURCHASE:
        return newPurchase()
      case TRANSACTION_TYPES.SUPPLIER_PAYMENT:
        return supplierPayment(data, callback, error)
      case TRANSACTION_TYPES.NEW_EXPENSES:
        return newExpenses(finalList, callback, error)
      case TRANSACTION_TYPES.RETURN_AND_REPLACE:
        return returnAndReplace(finalList, callback, error)
      default:
        return
    }
  }
}

// export const saveTransactionCache = (
//   list = [],
//   callback = (f) => f,
//   error = (f) => f,
// ) => {
//   const user = store.getState().auth.user
//   const facilityId = store.getState().auth.activeBusiness.id
//   // console.log(list)
//   let finalList = []
//   list.forEach((i) => {
//     if (i.imeiImage) {
//       let _attachments = {
//         imei_image: {
//           content_type: i.imeiImage.type,
//           data: i.imeiImage.base64,
//         },
//       }
//       finalList.push({
//         ...i,
//         createdAt: new Date().toISOString(),
//         facilityID: facilityId,
//         userId: user.id,
//         userName: user.username,
//         _attachments,
//       })
//     } else {
//       finalList.push({
//         ...i,
//         createdAt: new Date().toISOString(),
//         facilityID: facilityId,
//         userId: user.id,
//         userName: user.username,
//       })
//     }
//   })

//   console.log('finalList', finalList)

//   transactionsLocal.bulkDocs(finalList, (err, resp) => {
//     if (err) {
//       return error(err)
//     } else {
//       console.log(finalList)
//       console.log(resp)
//       console.log('Transaction documents saved successfully')
//       callback()
//       pushTransactionChanges()
//     }
//   })
// }

// export const saveReturnTransaction = (
//   list = [],
//   callback = (f) => f,
//   error = (f) => f,
// ) => {
//   const user = store.getState().auth.user
//   const facilityId = store.getState().auth.activeBusiness.id
//   // console.log(list)
//   let finalList = []
//   list.forEach((i) => {
//     finalList.push({
//       ...i,
//       createdAt: new Date().toISOString(),
//       facilityID: facilityId,
//       userId: user.id,
//       userName: user.username,
//     })
//   })
//   // console.log('vhgjkoiewfwenfuewfwehbfhrefbhrewbfrerbfhbher')
//   console.log(finalList)
//   // console.log('vhgjkoiewfwenfuewfwehbfhrefbhrewbfrerbfhbher')

//   transactionsLocal.bulkDocs(finalList, (err, resp) => {
//     if (err) {
//       return error(err)
//     } else {
//       console.log(finalList)
//       console.log(resp)
//       console.log('Transaction documents saved successfully=========')
//       callback()
//       pushTransactionChanges()
//     }
//   })
// }

export const searchTransactionByReceipt = (
  receiptNo,
  callback = (f) => f,
  error = (f) => f,
) => {
  // const user = store.getState().auth.user;
  const facilityId = store.getState().auth.activeBusiness.id

  _fetchApi(
    `/account/get/receipt/data/${receiptNo}/${facilityId}`,
    (data) => {
      if (data && data.results) {
        callback(data.results)
      }
    },
    (err) => {
      error(err)
      console.log(err)
    },
  )
  // transactionsLocal
  //   .createIndex({
  //     index: {
  //       fields: ['facilityId', 'receiptNo'],
  //     },
  //   })
  //   .then(() => {
  //     return transactionsLocal.find({
  //       selector: {
  //         facilityID: {
  //           $eq: facilityId,
  //         },
  //         receiptNo: {
  //           $eq: receiptNo,
  //         },
  //       },
  //     })
  //   })
  //   .then((resp) => {
  //     let data = resp.docs

  //     console.log(data, facilityId)
  //     callback(data)
  //   })
  //   .catch((err) => {
  //     error(err)
  //     console.log(err)
  //   })
}

// export const searchTransactionByReceiptFromCache = (
//   receiptNo,
//   callback = (f) => f,
//   error = (f) => f,
// ) => {
//   // const user = store.getState().auth.user;
//   const facilityId = store.getState().auth.activeBusiness.id
//   transactionsLocal
//     .createIndex({
//       index: {
//         fields: ['facilityId', 'receiptNo'],
//       },
//     })
//     .then(() => {
//       return transactionsLocal.find({
//         selector: {
//           facilityID: {
//             $eq: facilityId,
//           },
//           receiptNo: {
//             $eq: receiptNo,
//           },
//         },
//       })
//     })
//     .then((resp) => {
//       let data = resp.docs

//       console.log(data, facilityId)
//       callback(data)
//     })
//     .catch((err) => {
//       error(err)
//       console.log(err)
//     })
// }

// export const getAllTransactions = (cb = (f) => f) => {
//   transactionsLocal
//     .allDocs({ include_docs: true })
//     .then((d) => cb(d.rows))
//     .catch((err) => {
//       console.log(err)
//     })
// }

// export const getReprint = (callback = (f) => f, error = (f) => f) => {
//   return (dispatch) => {
//     const facilityId = store.getState().auth.activeBusiness.id
//     // const user = store.getState().auth.user;
//     transactionsLocal
//       .createIndex({ index: { fields: ['facilityId', 'createdAt'] } })
//       .then(() => {
//         return transactionsLocal.find({
//           selector: {
//             facilityID: {
//               $eq: facilityId,
//             },
//             createdAt: {
//               $gt: null,
//             },
//           },
//         })
//       })
//       .then((resp) => {
//         let data = resp.docs
//         let final = []
//         data.forEach((item) => {
//           let itemIndex = final.findIndex((i) => i.receiptNo === item.receiptNo)
//           if (itemIndex !== -1) {
//             let existingRec = final[itemIndex]
//             let newItemList = [
//               ...existingRec.itemList,
//               { ...item, item_name: item.description, price: item.amount },
//             ]
//             let newRec = {
//               ...existingRec,
//               amount: parseFloat(existingRec.amount) + parseFloat(item.amount),
//               itemList: newItemList,
//             }
//             final[itemIndex] = newRec
//           } else {
//             final.push({
//               ...item,
//               itemList: [
//                 { ...item, item_name: item.description, price: item.amount },
//               ],
//             })
//           }
//         })
//         dispatch({ type: GET_REPRINT, payload: final })
//         callback(data)
//       })
//       .catch((err) => {
//         console.log('Error: ', err)
//         error(err)
//       })
//   }
// }

// export const pushTransactionChanges = (onComplete = (f) => f) => {
//   console.log('start pushing transaction updates')
//   transactionsLocal.replicate
//     .to(remoteTransactions)
//     .on('complete', (info) => {
//       console.log('pushed changes to transactions')
//       console.log(info)
//       onComplete()
//     })
//     .on('error', (err) => {
//       onComplete()
//       console.log('error pushing changes to transaction db', err)
//     })
// }

// export const pullTransactionChanges = (onComplete = (f) => f) => {
//   console.log('start pulling transaction updates')
//   transactionsLocal.replicate
//     .from(remoteTransactions)
//     .on('complete', (info) => {
//       console.log('pushed changes to transactions')
//       console.log(info)
//       onComplete()
//     })
//     .on('error', (err) => {
//       console.log('error pushing changes to transaction db', err)
//     })
// }

export const syncTransactionsDB = (onComplete = (f) => f) => {
  return (dispatch) => {
    dispatch({ type: SYNC_STARTED })

    sync()
  }
}

// const sync = (callback = (f) => f) => {
//   let opts = { live: true, retry: true }

//   const onSyncChange = (info) => {
//     console.log(TAG, 'TransactionDB sync onChange', info)
//   }

//   const onSyncPaused = (err) => {
//     console.log(TAG, 'TransactionDB sync onPaused', err)
//   }

//   const onSyncError = (err) => {
//     console.log(TAG, 'TransactionDB sync onError', err)
//   }

//   console.log('starting...')
//   // do one way, one-off sync from the server until completion
//   transactionsLocal.replicate
//     .from(remoteTransactions)
//     .on('complete', function (info) {
//       console.log('one way replication completed', info)
//       // then two-way, continuous, retriable sync
//       let liveSync = transactionsLocal
//         .sync(remoteTransactions, opts)
//         .on('change', onSyncChange)
//         .on('paused', onSyncPaused)
//         .on('error', onSyncError)
//       // liveSync()

//       liveSync.on('complete', () => {
//         console.log('tx live sync is stopped')
//       })

//       liveSync.stop()
//     })
//     .on('error', onSyncError)
// }

const endpoint = 'account'

export function newTransaction() {
  return (dispatch) => {
    // dispatch({ type: NEW_TRANSACTION })
    // _postApi(
    //     `${baseAPI}`
    // )
  }
}
export function unflatten(arr) {
  var tree = [],
    mappedArr = {},
    arrElem,
    mappedElem

  // First map the nodes of the array to an object -> create a hash table.
  for (var i = 0, len = arr.length; i < len; i++) {
    arrElem = arr[i]
    mappedArr[arrElem.title] = arrElem
    mappedArr[arrElem.title]['children'] = []
  }

  for (var title in mappedArr) {
    // console.log(title, mappedArr)
    if (mappedArr.hasOwnProperty(title)) {
      mappedElem = mappedArr[title]
      // If the element is not at the root level, add it to its parent array of children.
      if (mappedElem.subhead) {
        mappedArr[mappedElem['subhead']]['children'].push(mappedElem)
      }
      // If the element is at the root level, add it to first level elements array.
      else {
        tree.push(mappedElem)
      }
    }
  }
  return tree
}

export function getAccChart() {
  return (dispatch) => {
    dispatch({ type: GETTING_ACC_CHART })
    _fetchApi(
      `/${endpoint}/chart`,
      ({ results }) => {
        // dispatch({ type: GET_ACC_CHART, payload: results });
        dispatch({ type: GETTING_ACC_CHART })
        let arrInTree = unflatten(results)
        // console.log(arrInTree)
        dispatch({ type: GET_ACC_CHART_TREE, payload: arrInTree })
      },
      (err) => {
        dispatch({ type: GETTING_ACC_CHART })
        console.log(err)
      },
    )
  }
}

export function createAccHead(data, callback) {
  return (dispatch) => {
    // dispatch({ type: CREATE_ACC_HEAD_LOADING })
    _postApi(
      `/${endpoint}/head/new`,
      data,
      () => {
        // dispatch({ type: CREATE_ACC_HEAD_LOADING})
        dispatch({ type: CREATE_ACC_HEAD, payload: data })
        callback()
        toast.success('Account Head Created')
        dispatch(getAccChart())
      },
      (err) => {
        // dispatch({ type: CREATE_ACC_HEAD_LOADING})
        toast.error('An error occured')
        console.log(err)
      },
    )
  }
}

export function getAccHeads() {
  return (dispatch) => {
    // dispatch({ type: GET_ACC_HEAD_LOADING });
    _fetchApi(
      `/${endpoint}/head`,
      ({ results }) => {
        // dispatch({ type: GET_ACC_HEAD_LOADING })
        dispatch({ type: GET_ACC_HEAD, payload: results })
      },
      (err) => {
        // dispatch({ type: GET_ACC_HEAD_LOADING })
        toast.error(err.toString())
      },
    )
  }
}

export function getRevAccHeads() {
  return (dispatch) => {
    // dispatch({ type: GET_ACC_HEAD_LOADING });
    _fetchApi(
      `/${endpoint}/head/revenue`,
      ({ results }) => {
        // dispatch({ type: GET_ACC_HEAD_LOADING })
        dispatch({ type: GET_REV_ACC_HEAD, payload: results })
      },
      (err) => {
        // dispatch({ type: GET_ACC_HEAD_LOADING })
        toast.error(err.toString())
      },
    )
  }
}

export function getExpensesAccHeads() {
  return (dispatch) => {
    // dispatch({ type: GET_ACC_HEAD_LOADING });
    _fetchApi(
      `/${endpoint}/head/expenses`,
      ({ results }) => {
        // dispatch({ type: GET_ACC_HEAD_LOADING })
        dispatch({ type: GET_EXPENSES_ACC_HEAD, payload: results })
      },
      (err) => {
        // dispatch({ type: GET_ACC_HEAD_LOADING })
        toast.error(err.toString())
      },
    )
  }
}

export function transfer(data, callback) {
  return (dispatch) => {
    _postApi(
      `/${endpoint}/transfer`,
      data,
      () => {
        callback()
        toast.success('Transfer successful')
      },
      (err) => {
        console.log(err)
        toast.error('Sorry, Could not complete transfer')
      },
    )
  }
}

export function getTotalSalesByUser(userId) {
  return (dispatch) => {
    dispatch({ type: GETTING_TOTAL_SALES_BY_USER })
    _fetchApi(
      `/${endpoint}/sales/${userId}`,
      ({ results }) => {
        dispatch({ type: GETTING_TOTAL_SALES_BY_USER })
        // console.log(results)
        dispatch({ type: GET_TOTAL_SALES_BY_USER, payload: results[0] })
      },
      (err) => {
        dispatch({ type: GETTING_TOTAL_SALES_BY_USER })
        console.log(err)
      },
    )
  }
}

export function getAmountReceived(userId) {
  return (dispatch) => {
    dispatch({ type: GETTING_TOTAL_SALES_BY_USER })
    _fetchApi(
      `/${endpoint}/cash/received/${userId}`,
      ({ results }) => {
        dispatch({ type: GETTING_TOTAL_SALES_BY_USER })
        console.log(results)
        dispatch({ type: GET_AMOUNT_RECEIVED, payload: results[0] })
      },
      (err) => {
        dispatch({ type: GETTING_TOTAL_SALES_BY_USER })
        console.log(err)
      },
    )
  }
}

export function getAmountHandedOver(userId) {
  return (dispatch) => {
    dispatch({ type: GETTING_TOTAL_SALES_BY_USER })
    _fetchApi(
      `/${endpoint}/cash/handedover/${userId}`,
      ({ results }) => {
        dispatch({ type: GETTING_TOTAL_SALES_BY_USER })
        console.log(results)
        dispatch({ type: GET_AMOUNT_HANDEDOVER, payload: results[0] })
      },
      (err) => {
        dispatch({ type: GETTING_TOTAL_SALES_BY_USER })
        console.log(err)
      },
    )
  }
}

export function getGeneralReport() {
  return (dispatch) => {
    dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
    _fetchApi(
      `/transactions/reports/general`,
      ({ results }) => {
        // this.setState({ reportData: results })
        // console.log(results)
        dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
        dispatch({ type: GET_GENERAL_ACC_REPORT, payload: results })
      },
      (err) => {
        toast.error('An error occured')
        console.log(err)
        dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
      },
    )
  }
}

export function getGeneralReportByDate(from, to) {
  return (dispatch) => {
    dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
    _fetchApi(
      `/transactions/reports/general/${from}/${to}`,
      ({ results }) => {
        // this.setState({ reportData: results })
        // console.log(results)
        dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
        dispatch({ type: GET_GENERAL_ACC_REPORT, payload: results })
      },
      (err) => {
        toast.error('An error occured')
        console.log(err)
        dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
      },
    )
  }
}

export function getGeneralReportByAccHead(from, to, accHead) {
  return (dispatch) => {
    dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
    _fetchApi(
      `/transactions/reports/general/${accHead}/${from}/${to}`,
      ({ results }) => {
        // this.setState({ reportData: results })
        // console.log(results)
        dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
        dispatch({ type: GET_GENERAL_ACC_REPORT, payload: results })
      },
      (err) => {
        toast.error('An error occured')
        console.log(err)
        dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
      },
    )
  }
}

export function getRevenueReport(from, to) {
  return (dispatch) => {
    dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
    _fetchApi(
      `/transactions/reports/revenue/${from}/${to}`,
      ({ results }) => {
        // this.setState({ reportData: results })
        // console.log(results)
        // dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
        dispatch({ type: GET_REVENUE_ACC_REPORT, payload: results })
      },
      (err) => {
        toast.error('An error occured')
        console.log(err)
        // dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
      },
    )
  }
}

export function getRevenueReportByAccHead(from, to, accHead) {
  return (dispatch) => {
    dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
    _fetchApi(
      `/transactions/reports/revenue/${accHead}/${from}/${to}`,
      ({ results }) => {
        // this.setState({ reportData: results })
        // console.log(results)
        // dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
        dispatch({ type: GET_GENERAL_ACC_REPORT, payload: results })
      },
      (err) => {
        toast.error('An error occured')
        console.log(err)
        // dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
      },
    )
  }
}

export function getExpenditureReport(from, to) {
  return (dispatch) => {
    dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
    _fetchApi(
      `/transactions/reports/expenditure/${from}/${to}`,
      ({ results }) => {
        // this.setState({ reportData: results })
        // console.log(results)
        // dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
        dispatch({ type: GET_EXPENDITURE_ACC_REPORT, payload: results })
      },
      (err) => {
        toast.error('An error occured')
        console.log(err)
        // dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
      },
    )
  }
}

export function getExpenditureReportByAccHead(from, to, accHead) {
  return (dispatch) => {
    dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
    _fetchApi(
      `/transactions/reports/expenditure/${accHead}/${from}/${to}`,
      ({ results }) => {
        // this.setState({ reportData: results })
        // console.log(results)
        // dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
        dispatch({ type: GET_GENERAL_ACC_REPORT, payload: results })
      },
      (err) => {
        toast.error('An error occured')
        console.log(err)
        // dispatch({ type: GET_GENERAL_ACC_REPORT_LOADING })
      },
    )
  }
}

// export function getPatientAccStmt(patientId,from,to,cb){
//     return dispatch => {
//         dispatch({ type: GETTING_PATIENT_ACC_STMT });
//         _fetchApi(
//             `/transactions/reports/stmt/${patientId}/${from}/${to}`,
//             ({results}) => {
//                 dispatch({ type: GET_PATIENT_ACC_STMT, payload: results })
//                 dispatch({ type: GETTING_PATIENT_ACC_STMT })
//                 if(results.length){
//                     cb(results);
//                 }
//             },
//             err => {
//                 dispatch({ type: GETTING_PATIENT_ACC_STMT });
//                 toast.error('An error occurred');
//                 console.log(err)
//             }
//         )

//     }
// }
