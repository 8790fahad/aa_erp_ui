// import { purchaseOrderLocal, remotePurchaseOrder } from '../../pouchdb/purchase_db'
import { SYNC_STARTED } from './actionTypes'
const TAG = 'CHECK'

// export const syncPurchaseOrderDB = (onComplete = (f) => f) => {
//   return (dispatch) => {
//     dispatch({ type: SYNC_STARTED })

//     let opts = { live: true, retry: true }

//     const onSyncChange = (info) => {
//       console.log(TAG, 'Purchase Order List sync onChange', info)
//     }

//     const onSyncPaused = (err) => {
//       console.log(TAG, 'Purchase Order List sync onPaused', err)
//     }

//     const onSyncError = (err) => {
//       console.log(TAG, 'Purchase Order List sync onError', err)
//     }

//     // do one way, one-off sync from the server until completion
//     purchaseOrderLocal.replicate
//       .from(remotePurchaseOrder)
//       .on('complete', function (info) {
//         console.log('one way replication completed', info)
//         // then two-way, continuous, retriable sync
//         purchaseOrderLocal
//           .sync(remotePurchaseOrder, opts)
//           .on('change', onSyncChange)
//           .on('paused', onSyncPaused)
//           .on('error', onSyncError)
//       })
//       .on('error', onSyncError)
//   }
// }

// export const pushPurchaseOrderChanges = (onComplete = (f) => f) => {
//   console.log('start pushing Purchases updates')
//   purchaseOrderLocal.replicate
//     .to(remotePurchaseOrder)
//     .on('complete', (info) => {
//       console.log('pushed changes to Purchasess')
//       console.log(info)
//       onComplete()
//     })
//     .on('error', (err) => {
//       console.log('error pushing changes to Purchases db', err)
//     })
// }

// export const pullPurchaseOrderChanges = (onComplete = (f) => f) => {
//   console.log('start pulling Purchases updates')
//   purchaseOrderLocal.replicate
//     .from(remotePurchaseOrder)
//     .on('complete', (info) => {
//       console.log('pushed changes to Purchasess')
//       console.log(info)
//       onComplete()
//     })
//     .on('error', (err) => {
//       console.log('error pushing changes to Purchases db', err)
//     })
// }
