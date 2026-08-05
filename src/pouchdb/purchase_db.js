import PouchDB from 'pouchdb-browser'
import Find from 'pouchdb-find'

PouchDB.plugin(Find)

const remoteURL =
  'https://apikey-v2-20x57u24z5t7c3nhhdv3q9g7s0g5nj2b8moj95shfl0o:1c74388e96bb38c5bf58a82aab9e4d75@f7c42186-1e3f-4a24-8fc9-12410b01bcff-bluemix.cloudantnosqldb.appdomain.cloud/purchase_db'
const remotePurchaseOrderURL =
  'https://apikey-v2-20x57u24z5t7c3nhhdv3q9g7s0g5nj2b8moj95shfl0o:1c74388e96bb38c5bf58a82aab9e4d75@f7c42186-1e3f-4a24-8fc9-12410b01bcff-bluemix.cloudantnosqldb.appdomain.cloud/purchase_order_b'

const remoteLocalURL = 'http://admin:123456@127.0.0.1:5984/purchase_db'
const remotePurcahseOrderLocalURL =
  'http://admin:123456@127.0.0.1:5984/purchase_order_b'

const remote =remoteURL
  // const remote =process.env.NODE_ENV === 'production' ? remoteURL : remoteLocalURL

const remotePurchaseOrderdb =remotePurchaseOrderURL
  // process.env.NODE_ENV === 
  // 'production'
  //   ? remotePurchaseOrderURL
  //   :
    //  remotePurcahseOrderLocalURL

export const remotePurchase = new PouchDB(remote)
export const remotePurchaseOrder = new PouchDB(remotePurchaseOrderdb)

export const purchaseLocal = new PouchDB('purchase_db')
export const purchaseOrderLocal = new PouchDB('purchase_order_b')

PouchDB.sync(purchaseLocal, remotePurchase, {
  live: true,
  heartbeat: false,
  timeout: false,
  retry: true,
})
export default purchaseLocal
