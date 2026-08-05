import db from '../../pouchdb'
import {v4 as UUIDV4} from 'uuid'
import {
  CREATE_ACC_CHART_TREE,
  GETTING_ACC_CHART,
  NEW_ACCT_HEAD,
} from './actionTypes'
import store from '../store.js'
import { unflatten } from './suppliers'

const _id = 'acctTree'

export const saveNewAcctTree = (
  obj = {},
  callback = (f) => f,
  error = (f) => f
) => {
  const user = store.getState().auth.user
  let uuid =  UUIDV4()
    obj.id = uuid
    obj.createdAt = new Date().toISOString()
    obj.facilityID = user.facilityId
    obj.userId = user.id

    db.get('acctTree')
      .then((doc) => {
        db.put({
          _id,
          _rev: doc._rev,
          acctTree: [...doc.acctTree, obj],
        })
          .then(() => {
            console.log('new AcctTree')
            callback()
          })
          .catch((err) => console.log(err))
      })
      .catch((err) => {
        console.log(err)
        db.put({ _id, acctTree: [obj] })
          .then(() => console.log('new AcctTree'))
          .catch((_err) => {
            error(err)
            console.log(_err)
          })
      })
}

export const getacctTree = (callback = (f) => f) => {
  return (dispatch) => {
    dispatch({ type: GETTING_ACC_CHART })
    db.get('acctTree')
      .then((doc) => {
        callback(doc.acctTree)
        dispatch({ type: CREATE_ACC_CHART_TREE, payload: doc.acctTree })
        // dispatch({ type: NEW_ACCT_HEAD, payload: doc.acctTree })
        let newArr = []
        doc.acctTree.forEach((i) =>
          newArr.push({ ...i, name: i.description, value: i.head })
        )
        let arrInTree = unflatten(newArr)
        dispatch({ type: NEW_ACCT_HEAD, payload: arrInTree })
        console.log(doc.acctTree, 'NEW ARRRRRRRRR')
      })
      .catch((err) => {
        console.log(err)
        dispatch({ type: GETTING_ACC_CHART })
        console.log(err)
      })
  }
}

export const updateAcctTree = (
  id = '',
  obj = {},
  callback = (f) => f,
  error = (f) => f
) => {
  db.get('acctTree')
    .then((doc) => {
      db.put({
        _id,
        _rev: doc._rev,
        acctTree: [...doc.acctTree, obj],
      })
        .then(() => {
          console.log('new AcctTree')
          callback()
        })
        .catch((err) => console.log(err))
    })
    .catch((err) => {
      console.log(err)
      db.put({ _id, acctTree: [obj] })
        .then(() => console.log('new AcctTree'))
        .catch((_err) => console.log(_err))
      error(err)
    })
}
