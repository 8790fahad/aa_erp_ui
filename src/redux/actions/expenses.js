import db from '../../pouchdb'
import {v4 as UUIDV4} from 'uuid'
import { SET_EXPENSES_LIST } from './actionTypes'
import store from '../store.js'
import transactionsLocal from '../../pouchdb/transactions'
import { EXPENSES } from '../../constants'

const _id = 'expenses'

export const saveNewExpenses = (
  list,
  callback = (f) => f,
  error = (f) => f
) => {
  const user = store.getState().auth.user
  list.map((i) => ({
    ...i, 
    _id: UUIDV4(),
    createdAt: new Date().toISOString(),
    facilityID: user.facilityId,
    userId: user.id,
  }))

  db.get('expenses')
    .then((doc) => {
      db.put({
        _id,
        _rev: doc._rev,
        expenses: [...doc.expenses, ...list],
      })
        .then(() => {
          console.log('new expense')
          callback()
        })
        .catch((err) => console.log(err))
    })
    .catch((err) => {
      console.log(err)
      db.put({ _id, expenses: [...list] })
        .then(() => console.log('new expense'))
        .catch((_err) => {
          error(err)
          console.log(_err)
        })
    })
}

export const getExpenses = (
  from = '',
  to = '',
  callback = (f) => f,
  error = (f) => f
) => {
  return (dispatch) => {
    const user = store.getState().auth.user
    // console.log(
    //   from.substr(0, 10),
    //   to.substr(0, 10),
    //   '============================================='
    // )
    // console.log(purchaseLocal.allDocs())
    // transactionsLocal.allDocs({include_docs: true}).then(d => console.log(d))
    // let nFrom = from.concat('T00:00:00.180Z')
    // let nTo = to.concat('T23:59:59.180Z')
    // console.log(nFrom, nTo, '==-==><==><==')
    transactionsLocal
      .createIndex({
        index: {
          fields: ['source', 'cr', 'createdAt', 'facilityID'],
        },
      })
      .then(() => {
        return transactionsLocal.find({
          selector: {
            source: {
              $eq: EXPENSES,
            },
            cr: {
              $eq: 0,
            },
            createdAt: {
              $gte: null,
              // $gte: nFrom,
              // $lte: nTo,
            },
            facilityID: {
              $eq: user.facilityId,
            },
          },
        })
      })
      .then((resp) => {
        console.log(resp , 'fffffffffffffffffffffffffff')
        callback(resp.docs)
        dispatch({ type: SET_EXPENSES_LIST, payload: resp.docs })
      })
      .catch((err) => {
        console.log(err)
        error(err)
      })

    // db.get('expenses')
    //   .then((doc) => {
    //     callback(doc.expenses)
    //     // console.log(doc.expenses)
    //     dispatch({ type: SET_EXPENSES_LIST, payload: doc.expenses })
    //   })
    //   .catch((err) => {
    //     console.log(err)
    //   })
  }
}
