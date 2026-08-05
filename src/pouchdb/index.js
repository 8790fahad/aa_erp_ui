import PouchDB from 'pouchdb-browser'
import Find from 'pouchdb-find'
import { ipAddr } from '../redux/actions/api'

// import { ipAddr } from '../redux/actions/api'
PouchDB.plugin(Find)

// let apiKey = 'apikey-76118e911c404bee988454d0a3bbc873'
// // let apiKey2 = 'apikey-v2-hdg7q7sdpzex2fpt9c7zpvisgeq5gv6a3b67068es47'
// let apiPass = 'f8eced993cff6e72cd66f45009e959d95bd4806b'
// let apiPass2 = ''
// const db_user = 'admin'
// const db_password = '123456'
const db_name = 'inventory'

// create database
// let localRemote = `http://${db_user}:${db_password}@${ipAddr}:5984/${db_name}`
let localRemote = `http://${ipAddr}:3031/${db_name}`
// let onlineRemote2 =
// 'https://apikey-v2-hdg7q7sdpzex2fpt9c7zpvisgeq5gv6a3b67068es47:2c266d416856b89636469e59771a3fb2@c13e559c-61e5-4443-ae88-f778dc3507c6-bluemix.cloudantnosqldb.appdomain.cloud/inventory'
let onlineRemote = `https://apikey-v2-20x57u24z5t7c3nhhdv3q9g7s0g5nj2b8moj95shfl0o:1c74388e96bb38c5bf58a82aab9e4d75@f7c42186-1e3f-4a24-8fc9-12410b01bcff-bluemix.cloudantnosqldb.appdomain.cloud/${db_name}`;

// remoteURL onlineRemote;

export const remoteDB = new PouchDB(process.env.NODE_ENV === "production" ? onlineRemote : localRemote);
export const localDB = new PouchDB(db_name)

export default localDB
