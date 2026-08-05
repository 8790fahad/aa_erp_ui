// import customerCategory, {
//   remoteCustomerCategory,
// } from '../../pouchdb/customerCategory'
import { v4 as UUIDV4 } from 'uuid'
import { SYNC_STARTED, SET_NEW_CUSTOMER_CAT } from './actionTypes'
import store from '../store'

const TAG = 'CHECK'

// export const saveCustomerCategory = (
//   obj = {},
//   callback = (f) => f,
//   error = (f) => f,
// ) => {
//   const user = store.getState().auth.user
//   let uuid = UUIDV4()
//   obj._id = uuid
//   obj.createdAt = new Date().toISOString()
//   obj.facilityID = user.facilityId
//   obj.userId = user.id

//   customerCategory
//     .put(obj)
//     .then((resp) => {
//       console.log('Customer Category created successfully')
//       callback()
//       pushCustomerCategoryChanges(() => pullCustomerCategoryChanges())
//     })
//     .catch((err) => {
//       console.log('Error: ', err)
//       error(err)
//     })
// }

// export const getCustomerCategory = (callback = (f) => f, error = (f) => f) => {
//   return (dispatch) => {
//     const user = store.getState().auth.user
//     customerCategory
//       .createIndex({ index: { fields: ['facilityID', 'createdAt'] } })
//       .then(() => {
//         return customerCategory.find({
//           selector: {
//             facilityID: {
//               $eq: user.facilityId,
//             },
//             createdAt: {
//               $gt: null,
//             },
//           },
//         })
//       })
//       .then((resp) => {
//         let data = resp.docs
//         callback(data)
//         dispatch({ type: SET_NEW_CUSTOMER_CAT, payload: data })
//       })
//       .catch((err) => {
//         error(err)
//         console.log(err)
//       })
//   }
// }

// export const updateCustomerCategory = (
//   id = '',
//   data = {},
//   callback = (f) => f,
//   error = (f) => f,
// ) => {
//   customerCategory
//     .put(data)
//     .then((resp) => {
//       callback()
//       console.log('Successfully updated Customer Category info', resp)
//     })
//     .catch((err) => {
//       console.log('Error: ', err)
//       error(err)
//     })
// }

// export const syncCustomerCategory = () => {
//   return (dispatch) => {
//     dispatch({ type: SYNC_STARTED })

//     let opts = { live: true, retry: true }

//     const onSyncChange = (info) => {
//       console.log(TAG, 'CustomerCategory_DB sync onChange', info)
//     }

//     const onSyncPaused = (err) => {
//       console.log(TAG, 'CustomerCategory_DB sync onPaused', err)
//     }

//     const onSyncError = (err) => {
//       console.log(TAG, 'CustomerCategory_DB sync onError', err)
//     }

//     // do one way, one-off sync from the server until completion
//     customerCategory.replicate
//       .from(remoteCustomerCategory)
//       .on('complete', function (info) {
//         console.log('one way replication completed', info)
//         // then two-way, continuous, retriable sync
//         customerCategory
//           .sync(remoteCustomerCategory, opts)
//           .on('change', onSyncChange)
//           .on('paused', onSyncPaused)
//           .on('error', onSyncError)
//       })
//       .on('error', onSyncError)
//   }
// }

// export const pushCustomerCategoryChanges = (onComplete = (f) => f) => {
//   console.log('start pushing CustomerCategory updates')
//   customerCategory.replicate
//     .to(remoteCustomerCategory)
//     .on('complete', (info) => {
//       console.log('pushed changes to CustomerCategory')
//       console.log(info)
//       onComplete()
//     })
//     .on('error', (err) => {
//       console.log('error pushing changes to CustomerCategory db', err)
//     })
// }

// export const pullCustomerCategoryChanges = (onComplete = (f) => f) => {
//   console.log('start pulling CustomerCategory updates')
//   customerCategory.replicate
//     .from(remoteCustomerCategory)
//     .on('complete', (info) => {
//       console.log('pushed changes to CustomerCategory')
//       console.log(info)
//       onComplete()
//     })
//     .on('error', (err) => {
//       console.log('error pushing changes to CustomerCategory db', err)
//     })
// }
