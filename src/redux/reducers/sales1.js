import { GET_PENDING_ITEMS, SALES } from "../actions/actionTypes";

const initialState = {
  salesevices: [],
  loadingSaleSevices: false,
  pendingItems: [],
};

const salesReducer = (state = initialState, action) => {
  switch (action.type) {
    case SALES:
      return {
        ...state,
        salesevices: action.payload,
      };
    case GET_PENDING_ITEMS:
      return {
        ...state,
        pendingItems: action.payload,
      };
    default:
      return state;
  }
};

export default salesReducer;
