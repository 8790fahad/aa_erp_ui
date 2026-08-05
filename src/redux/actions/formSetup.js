import { SET_FORM_SETUP, SYNC_STARTED } from "./actionTypes";
import store from "../store";
import { v4 as UUIDV4 } from "uuid";
import { _fetchApi, _postApi, apiURL } from "./api";

export const saveFormSetup = (obj = {}, callback = (f) => f, error = (f) => f) => {
  _postApi("/form-setup", obj, callback, error);
};

export const formSettingSetup = (type, callback = (f) => f, error = (f) => f) => {
  return (dispatch) => {
    const user = store.getState().auth.user;
    _fetchApi(`/form-setup?facilityID=${user.facilityId}&type=${type}`, (data) => {
      callback(data);
      dispatch({ type: SET_FORM_SETUP, payload: data });
    }, error);
  };
};

export const updateFormSetup = (_id = "", data = {}, callback = (f) => f, error = (f) => f) => {
  fetch(`${apiURL}/form-setup/${_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", authorization: token },
    body: JSON.stringify(data),
  })
    .then((res) => res.json())
    .then(() => {
      console.log("Form Setup Successfully updated item info");
      callback();
    })
    .catch((err) => {
      console.log("Error: ", err);
      error(err);
    });
};

export const syncFormSetup = () => {
  return (dispatch) => {
    dispatch({ type: SYNC_STARTED });
    console.log("Sync process started (Handled by API backend)");
  };
};