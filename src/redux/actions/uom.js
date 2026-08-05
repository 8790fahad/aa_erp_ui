// import uomLocal, { remoteUom } from '../../pouchdb/uom'
import { v4 as UUIDV4 } from 'uuid'
import { SYNC_STARTED, SET_NEW_UOM } from './actionTypes'
import store from '../store'

const TAG = 'CHECK'

// export const saveNewUOM = (obj = {}, callback = (f) => f, error = (f) => f) => {
//   const user = store.getState().auth.user
//   const facilityId = store.getState().auth.activeBusiness.id
//   obj._id = UUIDV4()
//   obj.createdAt = new Date().toISOString()
//   obj.facilityID = facilityId
//   obj.userId = user.id

//   uomLocal
//     .put(obj)
//     .then((resp) => {
//       console.log('UOM created successfully')
//       callback()
//     })
//     .catch((err) => {
//       console.log('Error: ', err)
//       error(err)
//     })
// }

// export const getUOM = (callback = (f) => f, error = (f) => f) => {
//   return (dispatch) => {
//     const facilityId = store.getState().auth.activeBusiness.id
//     // const user = store.getState().auth.user;
//     uomLocal
//       .createIndex({ index: { fields: ['facilityID', 'createdAt'] } })
//       .then(() => {
//         return uomLocal.find({
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
//         // console.log(data, '======================================================,,')
//         callback(data)
//         dispatch({ type: SET_NEW_UOM, payload: data })
//       })
//       .catch((err) => {
//         error(err)
//         console.log(err)
//       })
//   }
// }

// export const updateUOM = (
//   id = '',
//   data = {},
//   callback = (f) => f,
//   error = (f) => f,
// ) => {
//   uomLocal
//     .put(data)
//     .then((resp) => {
//       callback()
//       console.log('Successfully updated UOM info', resp)
//     })
//     .catch((err) => {
//       console.log('Error: ', err)
//       error(err)
//     })
// }

// export const syncUOM = () => {
//   return (dispatch) => {
//     dispatch({ type: SYNC_STARTED })

//     let opts = { live: true, retry: true }

//     const onSyncChange = (info) => {
//       console.log(TAG, 'UOM_DB sync onChange', info)
//     }

//     const onSyncPaused = (err) => {
//       console.log(TAG, 'UOM_DB sync onPaused', err)
//     }

//     const onSyncError = (err) => {
//       console.log(TAG, 'UOM_DB sync onError', err)
//     }

//     // do one way, one-off sync from the server until completion
//     uomLocal.replicate
//       .from(remoteUom)
//       .on('complete', function (info) {
//         console.log('one way replication completed', info)
//         // then two-way, continuous, retriable sync
//         uomLocal
//           .sync(remoteUom, opts)
//           .on('change', onSyncChange)
//           .on('paused', onSyncPaused)
//           .on('error', onSyncError)
//       })
//       .on('error', onSyncError)
//   }
// }

// export const pushUOMChanges = (onComplete = (f) => f) => {
//   console.log('start pushing UOM updates')
//   uomLocal.replicate
//     .to(remoteUom)
//     .on('complete', (info) => {
//       console.log('pushed changes to UOM')
//       console.log(info)
//       onComplete()
//     })
//     .on('error', (err) => {
//       console.log('error pushing changes to UOM db', err)
//     })
// }

// export const pullUOMChanges = (onComplete = (f) => f) => {
//   console.log('start pulling UOM updates')
//   uomLocal.replicate
//     .from(remoteUom)
//     .on('complete', (info) => {
//       console.log('pushed changes to UOM')
//       console.log(info)
//       onComplete()
//     })
//     .on('error', (err) => {
//       console.log('error pushing changes to UOM db', err)
//     })
// }
