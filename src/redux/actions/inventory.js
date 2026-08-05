import { _fetchApi, _postApi } from "./api";
import db from "../../pouchdb/index";
import {
  SET_NEW_DAILY_SALES,
  SET_NEW_DAILY_EXPENSES,
  SUBMITTIN_REQUEST,
  LOADING_PENDING_REQUESTS,
  GET_PENDING_REQUESTS,
  GET_STORE_ALERTS,
} from "./actionTypes";

import { _customNotify } from "../helper";

export function submitRequest(data, cb = (f) => f) {
  return (dispatch) => {
    dispatch({ type: SUBMITTIN_REQUEST });
    _postApi(
      `/requests/batch`,
      data,
      (results) => {
        console.log(results);
        toast.success("Request(s) submitted");
        dispatch({ type: SUBMITTIN_REQUEST });
        cb();
      },
      (err) => {
        console.log(err);
        dispatch({ type: SUBMITTIN_REQUEST });
      }
    );
  };
}

export const getStoreAlert = () => {
  return (dispatch) => {
    _fetchApi(
      `/store/alert/`,
      (data) => dispatch({ type: GET_STORE_ALERTS, payload: data.results }),
      (err) => console.log(err)
    );
  };
};

export const getShelfAlert = () => {
  return (dispatch) => {
    _fetchApi(
      `/shelf/alert/`,
      (data) => {
        dispatch({ type: "GET_SHELF_ALERTS", payload: data.results });
      },
      (err) => console.log(err)
    );
  };
};

export function getPendingRequest(cb) {
  return (dispatch) => {
    dispatch({ type: LOADING_PENDING_REQUESTS });
    _fetchApi(
      `/requests/pending`,
      ({ results }) => {
        dispatch({ type: LOADING_PENDING_REQUESTS });
        dispatch({ type: GET_PENDING_REQUESTS, payload: results });
        cb(results);
      },
      (err) => {
        dispatch({ type: LOADING_PENDING_REQUESTS });
        console.log(err);
      }
    );
  };
}

export const _getDailySales = (callback = (f) => f) => {
  _fetchApi(
    `/api/get/daily/sales`,
    (data) => {
      saveDailySales(data);
      callback();
    },
    (err) => {
      console.log(err);
    }
  );
};

export const saveDailySales = (data) => {
  db.put({ _id: "daily_reports", daily_reports: data })
    .then(() => console.log("saved daily_reports"))
    .catch((_err) => {
      console.log(_err);
    });
};

export const getDailySales = (callback = (f) => f) => {
  return (dispatch) => {
    let expense = [];
    let sale = [];
    db.get("daily_reports")
      .then((doc) => {
        callback(doc.daily_reports);
        console.log(doc.daily_reports, "NEW DDDDDDDDDD");
        doc.daily_reports.results.map((item) => {
          if (item.source === "EXPENSES") {
            return expense.push(item);
          } else if (item.source === "STORE") {
            return sale.push(item);
          } else {
            return null;
          }
        });
        dispatch({ type: SET_NEW_DAILY_SALES, payload: sale });
        dispatch({ type: SET_NEW_DAILY_EXPENSES, payload: expense });
      })
      .catch((err) => {
        console.log(err);
      });
  };
};
