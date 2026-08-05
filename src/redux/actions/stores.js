import { v4 as UUIDV4 } from 'uuid'
// import storesLocal, { remoteStoresDB } from '../../pouchdb/stores'
import store from '../store'
import { SET_STORE_LIST, SYNC_STARTED } from './actionTypes'
import { _fetchApi, _postApi } from './api'

export const initStore = (user) => {
  if (!user) {
    console.error("User data is missing.");
    return;
  }

  getStoresList(
    (data) => {
      console.log("Stores List:", data);

      if (!Array.isArray(data) || data.length === 0) {
        alert("No store found");

        const defaultStore = {
          address: user.address || "",
          phone: "",
          storeName: user.busName || "Unnamed Store",
          storeType: "Point of sale (POS)",
          default: true,
        };

        saveNewStore(defaultStore)
          .then(() => console.log("Default store saved successfully"))
          .catch((err) => console.error("Error saving default store:", err));
      }
    },
    (err) => {
      console.error("Error fetching stores list:", err);
    }
  );
};


export function getStores(
  query_type = 'list',
  callback = () => {},
  error = () => {}
) {
  try {
    const facilityId = store.getState()?.auth?.activeBusiness?.id;

    if (!facilityId) {
      console.error("Facility ID is missing. Cannot fetch stores.");
      error("Facility ID is missing");
      return;
    }

    _fetchApi(
      `/branches/get?facilityId=${facilityId}&query_type=${query_type}`,
      (data) => {
        if (data) {
          callback(data);
          // alert(JSON.stringify(data))
        } else {
          console.warn("Received empty response from API.");
          callback([]);
        }
      },
      (err) => {
        console.error("Error fetching stores:", err);
        error(err);
      }
    );
  } catch (err) {
    console.error("Unexpected error in getStores:", err);
    error(err);
  }
}


function postStore(data, callback = (f) => f, error = (f) => f) {
  _postApi(
    `/branches/new`,
    data,
    (resp) => {
      callback(resp)
    },
    (err) => {
      console.log(err)
      error(err)
    },
  )
}

export const saveNewStore = (
  obj = {},
  callback = (f) => f,
  error = (f) => f,
) => {
  const facilityId = store.getState().auth.activeBusiness.id
  const user = store.getState().auth.user
  obj._id = UUIDV4()
  obj.createdAt = new Date().toISOString()
  obj.facilityId = facilityId
  obj.created_by = user.id

  postStore(obj, callback, error)
  // storesLocal
  //   .put(obj)
  //   .then((resp) => {
  //     console.log('Store created successfully')
  //     callback()
  //   })
  //   .catch((err) => {
  //     console.log('Error: ', err)
  //     error(err)
  //   })
}

// export const saveNewStoreToCache = (
//   obj = {},
//   callback = (f) => f,
//   error = (f) => f,
// ) => {
//   const facilityId = store.getState().auth.activeBusiness.id
//   const user = store.getState().auth.user
//   obj._id = UUIDV4()
//   obj.createdAt = new Date().toISOString()
//   obj.facilityID = facilityId
//   obj.userId = user.id

//   storesLocal
//     .put(obj)
//     .then((resp) => {
//       console.log('Store created successfully')
//       callback()
//     })
//     .catch((err) => {
//       console.log('Error: ', err)
//       error(err)
//     })
// }

// export const deleteStore = (id, callback) => {
//   storesLocal
//     .get(id)
//     .then((doc) => {
//       doc._deleted = true
//       return storesLocal.put(doc)
//     })
//     .then(() => callback())
//     .catch(() => console.log('Error when deleting purchase document'))
// }

export const getStoresList = (callback = () => {}, error = () => {}) => {
  return (dispatch) => {
    getStores(
      'list',
      (data) => {
        if (data?.results) {
          dispatch({ type: SET_STORE_LIST, payload: data.results });
          callback(data.results);
        } else {
          console.warn("No results found in stores list response:", data);
          callback([]);
        }
      },
      (err) => {
        console.error("Error fetching store list:", err);
        error(err);
      }
    );
  };
};


// export const getStoresListFromCache = (
//   callback = (f) => f,
//   error = (f) => f,
// ) => {
//   return (dispatch) => {
//     const facilityId = store.getState().auth.activeBusiness.id
//     storesLocal
//       .createIndex({ index: { fields: ['facilityID', 'createdAt'] } })
//       .then(() => {
//         return storesLocal.find({
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
//         callback(data)
//         dispatch({ type: SET_STORE_LIST, payload: data })
//       })
//       .catch((err) => {
//         error(err)
//         console.log(err)
//       })
//   }
// }

const TAG = 'CHECK'

// export function syncStores() {
//   return (dispatch) => {
//     dispatch({ type: SYNC_STARTED })

//     let opts = { live: true, retry: true }

//     const onSyncChange = (info) => {
//       console.log(TAG, 'StoreDB sync onChange', info)
//     }

//     const onSyncPaused = (err) => {
//       console.log(TAG, 'StoreDB sync onPaused', err)
//     }

//     const onSyncError = (err) => {
//       console.log(TAG, 'StoreDB sync onError', err)
//     }

//     // do one way, one-off sync from the server until completion
//     storesLocal.replicate
//       .from(remoteStoresDB)
//       .on('complete', function (info) {
//         console.log('one way replication completed', info)
//         // then two-way, continuous, retriable sync
//         storesLocal
//           .sync(remoteStoresDB, opts)
//           .on('change', onSyncChange)
//           .on('paused', onSyncPaused)
//           .on('error', onSyncError)
//       })
//       .on('error', onSyncError)
//   }
// }

// export const pushStoresChanges = (onComplete = (f) => f) => {
//   console.log('start pushing Stores updates')
//   storesLocal.replicate
//     .to(remoteStoresDB)
//     .on('complete', (info) => {
//       console.log('pushed changes to Stores')
//       console.log(info)
//       onComplete()
//     })
//     .on('error', (err) => {
//       console.log('error pushing changes to Stores db', err)
//     })
// }

// export const pullStoresChanges = (onComplete = (f) => f) => {
//   console.log('start pulling Stores updates')
//   storesLocal.replicate
//     .from(remoteStoresDB)
//     .on('complete', (info) => {
//       console.log('pushed changes to Stores')
//       console.log(info)
//       onComplete()
//     })
//     .on('error', (err) => {
//       console.log('error pushing changes to Stores db', err)
//     })
// }
