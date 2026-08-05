// import { toast.success } from "../helper";
import { toast } from "sonner";
import store from "../store";
import { GET_PENDING_ITEMS, SALES } from "./actionTypes";
import { _fetchApi } from "./api";
const endpoint = "sale";
export function getAllSales() {
  return (dispatch) => {
    dispatch({ type: SALES });
    let url = `/${endpoint}/sales/all`;
    let successFn = ({ results }) => {
      //   dispatch({ type: GET_LAB_SERVICES, payload: results });
      dispatch({ type: SALES });
    };
    let errorFn = (err) => {
      dispatch({ type: SALES });
      console.log(err);
    };
    _fetchApi(url, successFn, errorFn);
  };
}

export function getPendingItems(_store) {
  const facilityId = store.getState().auth.activeBusiness.id;
  return (dispatch) => {
    let url = `/${endpoint}/sales/get-pending-items/${_store}/${facilityId}`;
    let successFn = (reps) => {
      if (reps) {
        dispatch({ type: GET_PENDING_ITEMS, payload: reps.results });
        console.log("fetch....................", reps);
      }
    };
    let errorFn = () => {
      console.log("error ........................");
    };
    _fetchApi(url, successFn, errorFn);
  };
}

export function updatePendingItems(trnNumber, id, _store, query_type) {
  const facilityId = store.getState().auth.activeBusiness.id;
  return (dispatch) => {
    let url = `/${endpoint}/sales/get-update-pending-items/${id}/${trnNumber}/${query_type}/${facilityId}`;
    let successFn = (reps) => {
      if (reps) {
        toast.success('successfully');
        dispatch(getPendingItems(_store));
      }
    };
    let errorFn = () => {
      toast.error("Unabled to update");
    };
    _fetchApi(url, successFn, errorFn);
  };
}
