import PouchDB from 'pouchdb-browser'
import Find from 'pouchdb-find'
PouchDB.plugin(Find)

const remoteURL =
  'https://apikey-v2-20x57u24z5t7c3nhhdv3q9g7s0g5nj2b8moj95shfl0o:1c74388e96bb38c5bf58a82aab9e4d75@f7c42186-1e3f-4a24-8fc9-12410b01bcff-bluemix.cloudantnosqldb.appdomain.cloud/add_bank_db'

const remoteLocalURL = 'http://admin:123456@127.0.0.1:5984/add_bank_db'

const remote = remoteURL
// const remote =process.env.NODE_ENV === 'production' ? remoteURL : remoteLocalURL

export const remotebank = new PouchDB(remote)

export const bankLocal = new PouchDB('add_bank_db')
// PouchDB.sync(bankLocal, remotebank, {
//   live: true,
//   heartbeat: false,
//   timeout: false,
//   retry: true,
// })

export default bankLocal
