import { _fetchApi } from "./api";
import store from "../store";
import {
  CLEAR_CLIENT_STATEMENT,
  SET_DAILY_SALES_REPORT,
  SET_DAILY_SALES_REPORT_UNFORMATTED,
  SET_EXPIRY_ALERT,
  SET_FAST_SELLING_ITEMS,
  SET_REORDER_LEVEL_ALERT,
} from "./actionTypes";

export function getExpiryAlerts() {
  return (dispatch) => {
    const facilityId = store.getState().auth.user.facilityId;
    _fetchApi(
      `/drugs/alert/expiry/${facilityId}`,
      (data) => {
        if (data && data.results) {
          dispatch({ type: SET_EXPIRY_ALERT, payload: data.results });
        }
      },
      (err) => {
        console.error(err);
      }
    );
  };
}

export function getReorderLevelAlerts() {
  return (dispatch) => {
    const facilityId = store.getState().auth.user.facilityId;
    _fetchApi(
      `/drugs/alert/quantity/${facilityId}`,
      (data) => {
        if (data && data.results) {
          dispatch({ type: SET_REORDER_LEVEL_ALERT, payload: data.results });
        }
      },
      (err) => {
        console.log(err);
      }
    );
  };
}

export function getFastSellingItems(from, to) {
  return (dispatch) => {
    const facilityId = store.getState().auth.user.facilityId;
    _fetchApi(
      `/drugs/totalsold/${from}/${to}/${facilityId}`,
      (data) => {
        if (data && data.results) {
          dispatch({ type: SET_FAST_SELLING_ITEMS, payload: data.results });
        }
      },
      (err) => {
        console.log(err);
      }
    );
  };
}

// export const saveDataToCache = (
//   key,
//   data,
//   callback = (f) => f,
//   error = (f) => f
// ) => {
//   localDB
//     .get(key)
//     .then((doc) => {
//       // console.log(doc, '...................')
//       localDB
//         .put({ _id: doc._id, _rev: doc._rev, data })
//         .then(() => {
//           console.log(`Saved data ${key} to cache`);
//           callback();
//         })
//         .catch((_err) => {
//           console.log(`Error saving ${key} data to cache`, _err);
//           error(_err);
//         });
//     })
//     .catch((err) => {
//       // console.log(err)
//       console.log("Data not found in cache, but new data is being saved");

//       localDB
//         .put({ _id: key, data })
//         .then(() => {
//           console.log(`Saved data ${key} to cache`);
//           callback();
//         })
//         .catch((_err) => {
//           console.log(`Error saving ${key} data to cache`, _err);
//           error(_err);
//         });
//     });
// };

export function clearClientStmt() {
  return (dispatch) => {
    dispatch({ type: CLEAR_CLIENT_STATEMENT });
  };
}

// export const saveDataToCache = (
//   key,
//   data,
//   callback = (f) => f,
//   error = (f) => f
// ) => {
//   localDB
//     .get(key)
//     .catch((err) => {
//       if (err.name === 'not_found') {
//         return {
//           _id: key,
//           data: [],
//         }
//       } else {
//         // hm, some other error
//         console.log(err)
//       }
//     })
//     .then((resp) => {
//       console.log(data)
//       resp.data = [...data, ...resp.data]
//       localDB
//         .put(resp)
//         .then(() => {
//           console.log(`Saved data ${key} to cache`)
//           callback()
//         })
//         .catch((_err) => {
//           console.log(`Error saving ${key} data to cache`, _err)
//           error(_err)
//         })
//     })
//     .catch((err) => {
//       // handle any errors
//       console.log('some other errors', err)
//     })
// }

// export const getDataFromCache = (
//   key,
//   callback = (f) => f,
//   error = (f) => f
// ) => {
//   localDB
//     .get(key)
//     .then((doc) => {
//       console.log(`getting data ${key} from cache`);
//       callback(doc.data);
//     })
//     .catch((err) => {
//       console.log(`Error fetching ${key} data from cache`, err);
//       callback([]);
//     });
// };

export function getDailySalesReport(
  from_date,
  to_date,
  success = (f) => f,
  error = (f) => f,
  groupingKey = "description"
) {
  return (dispatch) => {
    // const user = store.getState().auth.user;
    const facilityId = store.getState().auth.activeBusiness.id;
    // const businessType = store.getState().auth.activeBusiness.businessType
    // const facilityId = user.facilityId;
    // const businessType = user.businessType;
    let key = "daily_sales_report";

    _fetchApi(
      `/account/get-all-report?from=${from_date}&to=${to_date}&facilityId=${facilityId}&query_type=Sales category summary`,
      // `/api/v1/transactions/daily-sales-report?query_type=daily_sales&from=${from_date}&to=${to_date}&facilityId=${facilityId}&businessType=${businessType}`,
      // `/api/v1/transactions/daily-sales-report?query_type=daily_sales&from=${from_date}&to=${to_date}&facilityId=${facilityId}&businessType=${businessType}`,
      (data) => {
        if (data.results) {
      
          // if (businessType === 'SERVICES') {
          let requiredFormat = {};
          data.results.forEach((item) => {
            if (Object.keys(requiredFormat).includes(item[groupingKey])) {
              requiredFormat[item[groupingKey]] = [
                ...requiredFormat[item[groupingKey]],
                item,
              ];
            } else {
              requiredFormat[item[groupingKey]] = [item];
            }
          });
          saveDataToCache(key, requiredFormat);
          dispatch({
            type: SET_DAILY_SALES_REPORT_UNFORMATTED,
            payload: data.results,
          });
          dispatch({ type: SET_DAILY_SALES_REPORT, payload: requiredFormat });
          success(requiredFormat);
          // } else {
          //   dispatch({
          //     type: SET_DAILY_SALES_REPORT_UNFORMATTED,
          //     payload: data.results,
          //   })
          //   dispatch({ type: SET_DAILY_SALES_REPORT, payload: {"Transactions" : data.results} })
          //   saveDataToCache(key, data.results)
          //   success(data.results)
          // }
        }
      },
      (err) => {
        // error(err)
        console.error("An error occured", err);
        getDataFromCache(
          key,
          (data) => {
            dispatch({ type: SET_DAILY_SALES_REPORT, payload: data });
            success(data);
          },
          () => {}
        );
      }
    );
  };
}

export function getAllReport(setter, from, to, query_type) {
  return (dispatch) => {
    const facilityId = store.getState().auth.activeBusiness.id;
    _fetchApi(
      `/account/get-all-report?from=${from}&to=${to}&facilityId=${facilityId}&query_type=${query_type}`,
      (data) => {
   
        if (data && data.results) {
          dispatch({ type: "REPORT_LIST", payload: data.results });
          setter(data.results);
        }
      },
      (error) => {
        console.error({ error });
      }
    );
  };
}
