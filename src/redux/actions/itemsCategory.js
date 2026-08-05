// import itemsCategory, { remoteItemsCategory } from '../../pouchdb/itemsCategory'
import { v4 as UUIDV4 } from 'uuid'
import { SYNC_STARTED, SET_NEW_ITEMS_CATEGORY } from './actionTypes'
import store from '../store'

const TAG = 'CHECK'

// export const saveitemsCategory = (
//   obj = {},
//   callback = (f) => f,
//   error = (f) => f,
// ) => {
//   const user = store.getState().auth.user
//   obj._id = UUIDV4()
//   obj.createdAt = new Date().toISOString()
//   obj.facilityID = user.facilityId
//   obj.userId = user.id

//   itemsCategory
//     .put(obj)
//     .then((resp) => {
//       console.log('Items Category Category created successfully')
//       callback()
//       pushitemsCategoryChanges(() => pullitemsCategoryChanges())
//     })
//     .catch((err) => {
//       console.log('Error: ', err)
//       error(err)
//     })
// }

// export const getitemsCategory = (callback = (f) => f, error = (f) => f) => {
//   return (dispatch) => {
//     const user = store.getState().auth.user
//     itemsCategory
//       .createIndex({ index: { fields: ['facilityID', 'createdAt'] } })
//       .then(() => {
//         return itemsCategory.find({
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
//         dispatch({ type: SET_NEW_ITEMS_CATEGORY, payload: data })
//       })
//       .catch((err) => {
//         error(err)
//         console.log(err)
//       })
//   }
// }

// export const updateitemsCategory = (
//   id = '',
//   data = {},
//   callback = (f) => f,
//   error = (f) => f,
// ) => {
//   itemsCategory
//     .put(data)
//     .then((resp) => {
//       callback()
//       console.log('Successfully updated itemsCategory Category info', resp)
//     })
//     .catch((err) => {
//       console.log('Error: ', err)
//       error(err)
//     })
// }

// export const syncitemsCategory = () => {
//   return (dispatch) => {
//     dispatch({ type: SYNC_STARTED })

//     let opts = { live: true, retry: true }

//     const onSyncChange = (info) => {
//       console.log(TAG, 'itemsCategory_DB sync onChange', info)
//     }

//     const onSyncPaused = (err) => {
//       console.log(TAG, 'itemsCategory_DB sync onPaused', err)
//     }

//     const onSyncError = (err) => {
//       console.log(TAG, 'itemsCategory_DB sync onError', err)
//     }

//     // do one way, one-off sync from the server until completion
//     itemsCategory.replicate
//       .from(remoteItemsCategory)
//       .on('complete', function (info) {
//         console.log('one way replication completed', info)
//         // then two-way, continuous, retriable sync
//         itemsCategory
//           .sync(remoteItemsCategory, opts)
//           .on('change', onSyncChange)
//           .on('paused', onSyncPaused)
//           .on('error', onSyncError)
//       })
//       .on('error', onSyncError)
//   }
// }

// export const pushitemsCategoryChanges = (onComplete = (f) => f) => {
//   console.log('start pushing itemsCategory updates')
//   itemsCategory.replicate
//     .to(remoteItemsCategory)
//     .on('complete', (info) => {
//       console.log('pushed changes to itemsCategory')
//       console.log(info)
//       onComplete()
//     })
//     .on('error', (err) => {
//       console.log('error pushing changes to itemsCategory db', err)
//     })
// }

// export const pullitemsCategoryChanges = (onComplete = (f) => f) => {
//   console.log('start pulling itemsCategory updates')
//   itemsCategory.replicate
//     .from(remoteItemsCategory)
//     .on('complete', (info) => {
//       console.log('pushed changes to itemsCategory')
//       console.log(info)
//       onComplete()
//     })
//     .on('error', (err) => {
//       console.log('error pushing changes to itemsCategory db', err)
//     })
// }
