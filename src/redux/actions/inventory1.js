// import {
//   SUBMITTIN_REQUEST,
//   LOADING_PENDING_REQUESTS,
//   GET_PENDING_REQUESTS,
//   GET_SHELF_ALERTS,
//   GET_STORE_ALERTS,
// } from './types';
// import { _postApi, apiURL, _fetchApi } from './api';
// import { _customNotify } from '../helper';

// export function submitRequest(data, cb = (f) => f) {
//   return (dispatch) => {
//     dispatch({ type: SUBMITTIN_REQUEST });
//     _postApi(
//       `${apiURL}/requests/batch`,
//       data,
//       (results) => {
//         console.log(results);
//         toast.success('Request(s) submitted');
//         dispatch({ type: SUBMITTIN_REQUEST });
//         cb();
//       },
//       (err) => {
//         console.log(err);
//         dispatch({ type: SUBMITTIN_REQUEST });
//       },
//     );
//   };
// }

// export const getStoreAlert = () => {
//   return (dispatch) => {
//     _fetchApi(
//       `${apiURL}/store/alert/`,
//       (data) => dispatch({ type: GET_STORE_ALERTS, payload: data.results }),
//       (err) => console.log(err),
//     );
//   };
// };

// export const getShelfAlert = () => {
//   return (dispatch) => {
//     _fetchApi(
//       `${apiURL}/shelf/alert/`,
//       (data) => {
//         dispatch({ type: GET_SHELF_ALERTS, payload: data.results });
//       },
//       (err) => console.log(err),
//     );
//   };
// };

// export function getPendingRequest(cb) {
//   return (dispatch) => {
//     dispatch({ type: LOADING_PENDING_REQUESTS });
//     _fetchApi(
//       `${apiURL}/requests/pending`,
//       ({ results }) => {
//         dispatch({ type: LOADING_PENDING_REQUESTS });
//         dispatch({ type: GET_PENDING_REQUESTS, payload: results });
//         cb(results);
//       },
//       (err) => {
//         dispatch({ type: LOADING_PENDING_REQUESTS });
//         console.log(err);
//       },
//     );
//   };
// }
