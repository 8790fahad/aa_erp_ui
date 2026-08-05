import pouchdb from '../../pouchdb'
import { remoteDB, localDB } from '../../pouchdb'
import {
  SYNC_STARTED,
  SYNC_ACTIVE,
  SYNC_DENIED,
  SYNC_COMPLETED,
  SYNC_ERROR,
} from './actionTypes';

const TAG = 'CHECK'

export const syncDatabase = () => {
  return (dispatch) => {
    dispatch({ type: SYNC_STARTED })
    pouchdb
      .sync(remoteDB, localDB, {
        live: true,
        retry: true,
      })
      .on('change', (info) => {
        console.log(TAG, 'sync onChange', info)
      })
      .on('paused', (err) => {
        console.log(TAG, 'sync onPaused', err)
        // dispatch(getAppointments())
      })
      .on('active', () => {
        console.log(TAG, 'sync onActive')
        dispatch({ type: SYNC_ACTIVE })
      })
      .on('denied', (err) => {
        console.log(TAG, 'sync onDenied', err)
        dispatch({ type: SYNC_DENIED })
      })
      .on('complete', (info) => {
        console.log(TAG, 'sync onComplete', info)
        dispatch({ type: SYNC_COMPLETED })
      })
      .on('error', (err) => {
        console.log(TAG, 'sync onError', err)
        dispatch({ type: SYNC_ERROR })
      })
  }
}
