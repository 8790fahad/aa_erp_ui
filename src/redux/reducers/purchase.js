import {
  LOADING_PURCHASES,
  GET_PURCHASES,
  LOADING_PENDING_PURCHASES,
  GET_PENDING_PURCHASES,
  ACTIVE_TAB,
  MY_SUPPLIERS,
  MY_ITEMS,
  SET_PURCHASED_ITEMS_LIST,
  SET_PURCHASED_ITEMS_GROUP,
  SET_PURCHASED_BY_SUPPLIER,
  GET_SUPPLIER_STATEMENT,
} from "../actions/actionTypes";

const initialState = {
  my_suppliers: [],
  my_items: [],
  purchases: [],
  loadingPurchases: false,
  pendingPurchases: [],
  loadingPendingPurchases: false,
  purchaseList: [],
  purchaseSupplierGroup: [],
  purchaseItemGroup: [],
  supplier_account_statement:[]
};

export default function purchase(state = initialState, action){
  switch (action.type) {
    case ACTIVE_TAB:
      return {
        ...state,
        activeTab: action.payload,
      };
    case LOADING_PURCHASES:
      return {
        ...state,
        loadingPurchases: !state.loadingPurchases,
      };
    case GET_PURCHASES:
      return {
        ...state,
        purchases: action.payload,
      };
    case LOADING_PENDING_PURCHASES:
      return {
        ...state,
        loadingPendingPurchases: !state.loadingPendingPurchases,
      };
    case GET_PENDING_PURCHASES:
      return {
        ...state,
        pendingPurchases: action.payload,
      };
    case MY_SUPPLIERS:
      return {
        ...state,
        my_suppliers: action.payload,
      };
    case MY_ITEMS:
      return {
        ...state,
        my_items: action.payload,
      };
    case SET_PURCHASED_ITEMS_LIST:
      return {
        ...state,
        purchaseList: action.payload,
      };
    case SET_PURCHASED_BY_SUPPLIER:
      return {
        ...state,
        purchaseSupplierGroup: action.payload,
      };
    case SET_PURCHASED_ITEMS_GROUP:
      return {
        ...state,
        purchaseItemGroup: action.payload,
      };
      case GET_SUPPLIER_STATEMENT:
      return {
        ...state,
        supplier_account_statement: action.payload,
      };
    default:
      return state;
  }
};
