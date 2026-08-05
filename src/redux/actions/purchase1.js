// import { _fetchApi, apiURL } from "./api"
// import {
//     LOADING_PURCHASES, GET_PURCHASES, LOADING_PENDING_PURCHASES, GET_PENDING_PURCHASES,
//     MY_SUPPLIERS
// } from "./types"

// export function getPurchaseList() {
//     return dispatch => {
//         dispatch({ type: LOADING_PURCHASES })
//         _fetchApi(
//             `${apiURL}/purchase/list`,
//             ({ results }) => {
//                 dispatch({ type: LOADING_PURCHASES })
//                 dispatch({ type: GET_PURCHASES, payload: results })
//             },
//             err => {
//                 console.log(err)
//                 dispatch({ type: LOADING_PURCHASES })
//             }
//         )
//     }
// }

// export function getSuppliers(id) {
//     return dispatch => {
//         _fetchApi(`/drugs/supplier/all/${id}`, (data) => {
//             dispatch({
//                 type: MY_SUPPLIERS,
//                 payload: data.results
//             })
//         }, err => {
//             console.log(err)
//             dispatch({ type: LOADING_PURCHASES })
//         })
//     }
// }

// export function getPendingPurchase(cb) {
//     return dispatch => {
//         dispatch({ type: LOADING_PENDING_PURCHASES })
//         _fetchApi(
//             `${apiURL}/purchase/pending`,
//             ({ results }) => {
//                 dispatch({ type: LOADING_PENDING_PURCHASES })
//                 dispatch({ type: GET_PENDING_PURCHASES, payload: results })
//                 cb(results)
//             },
//             err => {
//                 console.log(err)
//                 dispatch({ type: LOADING_PENDING_PURCHASES })
//             }
//         )
//     }
// }