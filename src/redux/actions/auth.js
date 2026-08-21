import { toast } from "sonner";
import {
  LOADING,
  LOGIN,
  ERROR,
  LOGOUT,
  CREATING_USER,
  ERROR_CREATING_USER,
  LOGGING_IN,
} from "./actionTypes";
// import {
//   pullTransactionChanges,
//   pushTransactionChanges,
//   // syncTransactionsDB,
// } from "./transactions";
// import { pullPurchasesChanges, pushPurchasesChanges } from "./purchase";
// import { pullSuppliersChanges, pushSuppliersChanges } from "./suppliers";
// import { pullCustomersDBChanges, pushCustomersDBChanges } from "./customer";
// import { initStore, pullStoresChanges, pushStoresChanges } from "./stores";
// import { pullUOMChanges, pushUOMChanges } from "./uom";
// import { pullPurchaseOrderChanges, pushPurchaseOrderChanges } from "./db_sync";
// import {
//   pullitemsCategoryChanges,
//   pushitemsCategoryChanges,
// } from "./itemsCategory";
// import {
//   pullCustomerCategoryChanges,
//   pushCustomerCategoryChanges,
// } from "./customerCategory";
// import { BUSINESS_TYPES } from "../../constants";
// import { pullbankChanges, pushbankChanges } from "./add_bank";

import { apiURL, _postApi } from "./api";

const endpoint = "auth";

export function createUser(data = [], success = (f) => f, error = (f) => f) {
  return (dispatch) => {
    dispatch({ type: CREATING_USER });
    // let token = store.getState().auth.token;
    _postApi(
      `${apiURL}/api/${endpoint}/sign-up`,
      data,
      (result) => {
        // console.log(result);
        if (result.errors) {
          let err = Object.values(result.errors);
          error(err[0]);
          dispatch({ type: ERROR_CREATING_USER, payload: err[0] });
        } else {
          dispatch({ type: CREATING_USER });
          success();
        }
      },
      (err) => {
        // console.log(err);
        dispatch({ type: ERROR_CREATING_USER, payload: err });
      }
    );
  };
}

export function login({ email, password }, cb = (f) => f, error = (f) => f) {
  return async (dispatch) => {
    dispatch({ type: LOGGING_IN });

    try {
      const response = await fetch(`${apiURL}/api/${endpoint}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success === false) {
        error(data.message, data);
        dispatch({ type: ERROR, payload: data.error });
      } else {
        localStorage.setItem("@@__token", data.token);
        dispatch({ type: LOGIN, payload: data });
        cb(data);
      }
    } catch (err) {
      const msg = "Unable to connect to server, please try again";
      error(msg);
      toast.error(msg);
      dispatch({ type: ERROR, payload: err });
    } finally {
      dispatch({ type: LOGGING_IN });
    }
  };
}

export function authLoading() {
  return (dispatch) => {
    dispatch({ type: LOADING });
  };
}

export function logout(callback = (f) => f) {
  return (dispatch) => {
    // console.log('dispatching logout');
    dispatch({ type: LOGOUT });
    localStorage.removeItem("@@__token");
    callback();
  };
}

export function initUser(navigate = null, callback = (f) => f) {
  return (dispatch) => {
    let token = localStorage.getItem("@@__token");
    if (!token) {
      callback();
      if (navigate) navigate("/login");
      return;
    }

    verifyToken(token)
      .then((data) => {
        if (!data || data.success !== true) {
          // Only clear session on explicit auth failure (expired / invalid)
          const authFailed =
            data &&
            (data.success === false ||
              data.code === "TokenExpiredError" ||
              data.code === "JsonWebTokenError");
          if (authFailed) {
            callback();
            localStorage.removeItem("@@__token");
            if (navigate) navigate("/login");
            dispatch({ type: LOGOUT });
            return;
          }
          // Network / empty response — keep token, do not force logout
          console.warn("[initUser] verify-token returned no success payload");
          callback();
          return;
        }

        if (data.token) {
          localStorage.setItem(
            "@@__token",
            data.token.startsWith("Bearer ")
              ? data.token
              : `Bearer ${data.token}`,
          );
        }
        dispatch({ type: LOGIN, payload: data });
        callback();
      })
      .catch((err) => {
        // Transient errors should not log the user out on refresh
        console.warn("[initUser] verify-token failed:", err);
        callback();
      });
  };
}

async function verifyToken(token) {
  try {
    let response = await fetch(`${apiURL}/auth/verify-token`, {
      method: "GET",
      headers: {
        Authorization: token,
      },
    });
    let data = await response.json();
    return data;
  } catch (error) {
    console.warn("[verifyToken]", error);
    throw error;
  }
}

// import {
//   LOGGING_IN,
//   LOGIN,
//   LOGOUT,
//   SET_ACTIVE_BUSINESS,
//   SET_APP_THEME,
//   SET_PROFILE,
//   // SIGN_UP_LOADING,
// } from './actionTypes'
// import { _postApi, apiURL, _updateApi, _fetchApi, _deleteApi } from './api'
// // import { Alert } from 'react-native'
// import store from '../store'
// import moment from 'moment'
// // import { syncDatabase } from '.'

// import { initConnectDefaultPrinter } from './printer'

// // import { showMessage } from 'react-native-flash-message'

// export function setLogin(payload) {
//   return { type: LOGIN, payload }
// }

// export function login({ phone, password }, cb = (f) => f, error_cb = (f) => f) {
//   return (dispatch) => {
//     console.log('calling login')
//     // dispatch({ type: LOGGING_IN })
//     let success = async (results) => {
//       // console.log(results);
//       // console.log(results, '==================');
//       if (results && results.success) {
//         let conv = results
//         let today = moment.utc()
//         let appExpiry = conv.user.appExpiry
//         let daysLeft = Math.abs(today.diff(appExpiry, 'days'))
//         // console.log(
//         //   'appExpiry',
//         //   appExpiry,
//         //   moment.utc(today).isSameOrBefore(appExpiry),
//         //   '===========><========='
//         // )
//         if (conv && daysLeft >= 0) {
//           if (daysLeft <= 7) {
//             alert(
//               'Warning',
//               `You have ${daysLeft} days before the expiration of this app.`
//             )
//           }

//           // console.log('response', results)

//           // try {
//           //   await AsyncStorage.setItem(
//           //     '@bits_accounting:user',
//           //     JSON.stringify(results)
//           //   )
//           //   // console.log('storage set');
//           // } catch (e) {
//           //   console.log(e)
//           // }

//           dispatch({ type: LOGIN, payload: results })
//           // {"user": {
//           // "accessTo": ["Admin", "Inventory", "Administrati
//           // on", "Management", "Customer", "Supplier", "Purchases", "Make Sales", "Expenses", "Transfer",
//           // "Pending Sales", "Reports", "Customers", "Settings"],
//           // "address": "Kamdo headquarters, Kano",
//           // "appExpiry": "2021-06-30 00:00:00", "busName": "Emaitee Enterprises", "businessType": null,
//           // "createdAt": "2021-06-03T11:21:43.000Z", "email": "", "facilityId": "c0ebb5ea-6aef-4223-896e-afc
//           // 4d0c8c54e", "functionality": ["Admin", "Inventory", "Administration", "Management", "Customer",
//           // "Supplier", "Purchases", "Make Sales", "Expenses", "Transfer", "Pending Sales", "Reports", "Cus
//           // tomers", "Settings"], "id": 4, "licenseExpiry": null, "phone": "07062942291", "role": null, "upd
//           // atedAt": "2021-06-03T11:21:43.000Z", "username": "Mustapha Issa"}}
//           // console.log(results, '===========================================xxxxxxxxxxxxxxxxx')

//           // if (
//           //   results.user.businessType === BUSINESS_TYPES.PRODUCTS ||
//           //   results.user.businessType === BUSINESS_TYPES.PRODUCTS_AND_SERVICES
//           // ) {
//           // initStore(results.user)
//           // }
//           cb()
//         } else {
//           alert(
//             'App Expired',
//             'This has expired, contact management +234.'
//           )
//         }
//       } else {
//         if (results.message) {
//           alert('', results.message)
//         } else {
//           alert('Error', 'Cannot login at this time, try again later')
//         }
//         error_cb()
//       }
//       // dispatch({ type: LOGGING_IN })
//     }

//     let error = (err) => {
//       console.log('err', err)
//       // dispatch({ type: LOGGING_IN })
//       // dispatch({type: LOGIN_ERROR});
//       alert('Error', 'Unable to login at this time')
//       error_cb()
//     }

//     _postApi(`${apiURL}/api/auth/login`, { phone, password }, success, error)
//   }
// }

// export function checkAuthStatus(cb = (f) => f) {
//   return async (dispatch) => {
//     dispatch({ type: LOGGING_IN })
//     try {
//       // let _user = await AsyncStorage.getItem('@bits_accounting:user')
//       // let conv = JSON.parse(_user)
//       let conv = JSON.parse({})
//       console.log(conv)
//       let today = moment.utc()
//       let appExpiry = conv ? conv.user.appExpiry : null
//       let daysLeft = Math.abs(today.diff(appExpiry, 'days'))
//       // console.log(
//       //   'appExpiry',
//       //   appExpiry,
//       //   moment.utc(today).isSameOrBefore(appExpiry),
//       //   '===========><========='
//       // )
//       if (conv && daysLeft >= 0) {
//         if (daysLeft <= 7) {
//           alert(
//             'Warning',
//             `You have ${daysLeft} days before the expiration of this app.`
//           )
//         }
//         setTimeout(() => {
//           if (conv) {
//             dispatch({ type: LOGIN, payload: conv })
//           }
//           dispatch({ type: LOGGING_IN })
//         }, 1000)
//       }
//     } catch (e) {
//       // Restoring token failed
//       // try login from server || user not logged in
//       console.log('Restoring token failed', e)
//       dispatch({ type: LOGGING_IN })
//     }
//     // dispatch({type: ''});
//   }
// }

export function signup(
  form,
  cb = (f) => f,
  error_cb = (f) => f,
  query_type = "new_admin"
) {
  return (dispatch) => {
    _postApi(
      `/api/auth/sign-up`,
      { ...form,facilityId: form.facilityId, query_type },
      (resp) => {
        if (resp.success) {
          let success_cb = (results) => {
            cb();
          };
          cb(resp);
        } else {
          if (resp.status === 200) {
            toast.success("Successfully Created");
          } else {
            console.log("error", resp);
            toast.error(`Error: ${resp.msg}`);
            error_cb();
          }
        }
      },
      (err) => {
        console.log("err", err);
        alert("Error", "Unable to login at this time");
        error_cb();
      }
    );
  };
}

export function createNewUser(form, cb, error_cb = (f) => f) {
  return (dispatch) => {
    console.log(form, "====================form");
    // dispatch({ type: SIGN_UP_LOADING })
    // let success =

    _postApi(
      `/api/auth/sign-up`,
      { ...form, query_type: "new_admin" },
      (resp) => {
        if (resp.success) {
          console.log("success------------------", resp);
          let success_cb = (results) => {
            console.log("login success");
            // dispatch({ type: LOGIN, payload: results })
            cb();
            // dispatch({ type: SIGN_UP_LOADING })
          };
          dispatch(
            login({ phone: form.phone, password: form.password }, success_cb)
          );
        } else {
          console.log("error", resp);
          alert("Error", resp.msg);
          error_cb();
          // dispatch({ type: SIGN_UP_LOADING })
        }
      },
      (err) => {
        console.log("err", err);
        // dispatch({ type: SIGN_UP_LOADING })
        // dispatch({type: LOGIN_ERROR});
        alert("Error", "Unable to login at this time");
        error_cb();
      }
    );
  };
}

// export function getProfile() {
//   return (dispatch) => {
//     const user = store.getState().auth.user

//     _fetchApi(
//       `${apiURL}/users/${user.pcn_no}`,
//       (data) => {
//         dispatch({ type: SET_PROFILE, payload: data.results })
//         // console.log(data);
//       },
//       (err) => {
//         console.log(err)
//       }
//     )
//   }
// }

// export function updateProfile(form = {}, callback = (f) => f) {
//   return (dispatch) => {
//     const user = store.getState().auth.user
//     _updateApi(
//       `${apiURL}/users/${user.pcn_no}`,
//       form,
//       (data) => {
//         // console.log(data);
//         dispatch(getProfile())
//         callback()
//       },
//       (err) => {
//         console.log(err)
//       }
//     )
//   }
// }

// export function setAppTheme(obj = {}, callback = (f) => f) {
//   return (dispatch) => {
//     dispatch({ type: SET_APP_THEME, payload: obj })
//     callback()
//   }
// }

// export const getBusinessProfile =
//   (id, callback = (f) => f, error = (f) => f) =>
//   (dispatch) => {
//     _fetchApi(
//       `${apiURL}/api/v1/business-profile?id=${id}`,
//       (data) => {
//         if (data && data.results) {
//           dispatch({ type: SET_ACTIVE_BUSINESS, payload: data.results[0] })
//         }
//         callback()
//       },
//       (err) => {
//         console.log(err)
//         error(err)
//       }
//     )
//   }

// export function logout(cb) {
//   return async (dispatch) => {
//     // AsyncStorage.removeItem('@bits_accounting:user')
//     dispatch({ type: LOGOUT })
//     cb()
//   }
// }

// export function createUser(form, cb, error_cb = (f) => f) {
//   console.log('creating user')
//   _postApi(
//     `${apiURL}/api/auth/sign-up`,
//     form,
//     (resp) => {
//       if (resp.success) {
//         cb()
//       } else {
//         console.log('error', resp)
//         alert('Error', resp.msg)
//         error_cb()
//       }
//     },
//     (err) => {
//       console.log('err', err)
//       alert('Error', 'Unable to create at this time, try again later')
//       error_cb()
//     }
//   )
// }

// export function deleteUser(_u, cb) {
//   _deleteApi(
//     `${apiURL}/users/delete/${_u.id}/${_u.facilityId}`,
//     {},
//     () => {
//       alert('Success', 'User deleted successfully')
//       cb()
//     },
//     () => {
//       alert('Error', 'An error occured, try again later.')
//       cb()
//     }
//   )
// }

// export function updateUserInfo(_u, cb) {
//   _postApi(
//     `${apiURL}/users/access/update`,
//     _u,
//     () => {
//       alert('Success', 'User updated successfully')
//       cb()
//     },
//     () => {
//       alert('Error', 'An error occured, try again later.')
//       cb()
//     }
//   )
// }

// export function init(navigation, callback = (f) => f) {
//   // return async (dispatch) => {
//   //   let token = await AsyncStorage.getItem('@bits_accounting:user')
//   //   // dispatch({ type: START_LOADING_APP });
//   //   if (token) {
//   //     token = JSON.parse(token)
//   //     /**
//   //      * Token present
//   //      * verifyToken */
//   //     getUserProfile(token)
//   //       .then((data) => {
//   //         if (data.success) {
//   //           /**
//   //            * Token is valid
//   //            * navigate user to dashboard */
//   //           callback()
//   //           // dispatch({ type: STOP_LOADING_APP });
//   //           const { user } = data
//   //           dispatch({ type: SET_USER, payload: user })

//   //           // if (user.role === "4") {
//   //           //   if (user.position === "state_coordinator") {
//   //           //     setFormType("State");
//   //           //     setSelectedState(user.state);
//   //           //   } else if (user.position === "national_coordinator") {
//   //           //     setFormType("National");
//   //           //   } else {
//   //           //     history.push("/admin/index");
//   //           //   }
//   //           // }

//   //           // history.push("/app/payments");
//   //           navigation.navigate('Home')
//   //         } else {
//   //           /**
//   //            * Token is invalid
//   //            * navigate user to auth */
//   //           // dispatch({ type: STOP_LOADING_APP });
//   //           callback()
//   //           // console.log(err)
//   //           localStorage.removeItem('@bits_accounting:user')
//   //           navigation.navigate('Login')
//   //           // history.push("/auth/login");
//   //           // console.log('Token expired');
//   //         }
//   //       })
//   //       .catch((err) => {
//   //         // server error
//   //         console.log(err)
//   //         dispatch({ type: STOP_LOADING_APP })
//   //       })
//   //   } else {
//   //     /**
//   //      * No token found
//   //      * navigate user to auth page
//   //      */
//   //     callback()
//   //     navigation.navigate('Login')

//   //     // history.push("/auth/login");

//   //     // dispatch({ type: STOP_LOADING_APP });
//   //   }
//   // }
// }

// function syncDatabase() {
//   pushTransactionChanges(() => pullTransactionChanges());
//   pushPurchaseOrderChanges(() => pullPurchaseOrderChanges());
//   pushPurchasesChanges(() => pullPurchasesChanges());
//   pushSuppliersChanges(() => pullSuppliersChanges());
//   pushCustomersDBChanges(() => pullCustomersDBChanges());
//   pushitemsCategoryChanges(() => pullitemsCategoryChanges());
//   pushCustomerCategoryChanges(() => pullCustomerCategoryChanges());
//   pushStoresChanges(() => pullStoresChanges());
//   pushUOMChanges(() => pullUOMChanges());
//   pushbankChanges(() => pullbankChanges());
// }

// export const initDB = () => {
// return (dispatch) => {
// syncDatabase();
// dispatch(initConnectDefaultPrinter())
// }
// };

// export function initUser(history = null, callback = (f) => f) {
//   return (dispatch) => {
//     let token = localStorage.getItem('@@__token');
//     // console.log(token)
//     if (token) {
//       /**
//        * Token present
//        * verifyToken */
//       verifyToken(token)
//         .then((data) => {
//           if (data.success) {
//             dispatch({ type: LOGIN, payload: data });
//             // history.push('/app');
//             callback();
//             console.log('success');
//           } else {
//             callback();
//             localStorage.removeItem('@@__token');
//             history.push('/login');
//             console.log('Token expired');
//             dispatch({ type: LOGOUT });
//           }
//         })
//         .catch((err) => {
//           callback();
//           localStorage.removeItem('@@__token');
//           history.push('/login');
//           console.log('Token expired');
//           dispatch({ type: LOGOUT });
//         });
//     } else {
//       /**
//        * No token found
//        * navigate user to auth page
//        */
//       callback();
//       history.push('/login');
//     }
//   };
// }

// async function verifyToken(token) {
//   try {
//     let response = await fetch(`${apiURL}/auth/verify-token`, {
//       method: 'GET',
//       headers: {
//         Authorization: token,
//       },
//     });
//     let data = await response.json();
//     return data;
//   } catch (error) {
//     console.log(error);
//   }
// }
