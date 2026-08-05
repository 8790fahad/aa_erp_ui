// import Pouchdb from '../../pouchdb'
import { SYNC_STARTED } from './actionTypes'
import { v4 as UUIDV4 } from 'uuid'

import store from '../store'
// import { SET_PURCHASED_ITEMS_LIST } from './actionTypes'

import servicesLocal, { remoteService } from '../../pouchdb/services_db'

// const TAG = 'CHECK'
// const _id = 'purchase'

export const saveNewServices = (
  list = [],
  callback = (f) => f,
  error = (f) => f
) => {
  const facilityId = store.getState().auth.activeBusiness.id
  const user = store.getState().auth.user
  let finalList = []
  let currTime = new Date().toISOString()
  list.forEach((i) =>
    finalList.push({
      ...i,
      id: UUIDV4(),
      createdAt: currTime,
      facilityID: facilityId,
      userId: user.id,
    })
  )

  // console.log(finalList)
  servicesLocal.bulkDocs(finalList, (err, resp) => {
    // console.log(err, 'err', resp, 'resp')
    if (err) {
      return error(err)
    } else {
      //   purchaseOrderLocal
      //     .put({
      //       _id: UUIDV4(),
      //       items: finalList,
      //       description: 'purchase order items',
      //       userId: user.id,
      //       createdAt: currTime,
      //       facilityID: user.facilityId,
      //       supplierId: finalList.length ? finalList[0].supplierId : '',
      //       totalAmount: finalList.length
      //         ? finalList.reduce((a, b) => a + parseFloat(b.cost), 0)
      //         : '',
      //       client: '',
      //     })
      //     .then((docs) => {
      //       console.log(resp)
      //       console.log('Purchases list saved successfully')
      callback()
      pushServicesChange(() => pullServicesChanges())
      //   pushPurchaseOrderChanges(() => pullPurchaseOrderChanges())
      // })
      // .catch((err) => {
      //   console.log('Error saving purchase order list', err)
      // })
    }
  })
}

export const updateService = (
  id = '',
  data = {},
  callback = (f) => f,
  error = (f) => f
) => {
  console.log(id, data)

  servicesLocal
    .get(id)
    .then((doc) => {
      servicesLocal
        .put({
          ...doc,
          ...data,
        })
        .then((resp) => {
          console.log('Successfully updated service info', resp)
          callback()
        })
        .catch((err) => console.log(err))
    })
    .catch((err) => {
      console.log('Error: ', err)

      error(err)
    })
}

export const getServiceList = (callback = (f) => f) => {
  const facilityId = store.getState().auth.activeBusiness.id
  servicesLocal
    .createIndex({ index: { fields: ['facilityID', 'createdAt'] } })
    .then(() => {
      return servicesLocal.find({
        selector: {
          facilityID: {
            $eq: facilityId,
          },
          createdAt: {
            $gt: null,
          },
        },
      })
    })
    .then((resp) => {
      let data = resp.docs
      callback(data)
    })
    .catch((err) => {
      console.log('Error: ', err)
    })
}

export const deleteService = (id, callback) => {
  servicesLocal
    .get(id)
    .then((doc) => {
      doc._deleted = true
      return servicesLocal.put(doc)
    })
    .then(() => callback())
    .catch(() => console.log('Error when deleting purchase document'))
}

export const syncPurchaseDB = (onComplete = (f) => f) => {
  return (dispatch) => {
    dispatch({ type: SYNC_STARTED })

    // let opts = { live: true, retry: true }

    // do one way, one-off sync from the server until completion
    // oneWaySync(() => {
    //   servicesLocal
    //       .sync(remotePurchase, opts)
    //       .on('change', onSyncChange)
    //       .on('paused', onSyncPaused)
    //       .on('error', onSyncError)
    //     })
  }
}

export const pushServicesChange = (onComplete = (f) => f) => {
  console.log('start pushing Services updates')
  servicesLocal.replicate
    .to(remoteService)
    .on('complete', (info) => {
      console.log('pushed changes to Services')
      console.log(info)
      onComplete()
    })
    .on('error', (err) => {
      console.log('error pushing changes to Services db', err)
    })
}

export const pullServicesChanges = (onComplete = (f) => f) => {
  console.log('start pulling Services updates')
  servicesLocal.replicate
    .from(remoteService)
    .on('complete', (info) => {
      console.log('pushed changes to Services')
      console.log(info)
      onComplete()
    })
    .on('error', (err) => {
      console.log('error pushing changes to Services db', err)
    })
}
