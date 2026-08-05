import {
  CLEAR_CLIENT_STATEMENT,
  SET_CLIENT_STATEMENT,
  SET_DAILY_SALES_REPORT,
  SET_DAILY_SALES_REPORT_UNFORMATTED,
  SET_EXPIRY_ALERT,
  SET_FAST_SELLING_ITEMS,
  SET_REORDER_LEVEL_ALERT,
} from '../actions/actionTypes'

const initialState = {
  expiryAlert: [],
  reorderAlert: [],
  fastSellingItems: [],
  dailySalesReport: {},
  fullSalesReport: [],
  showWayBill: false,
  clientAccountStatement: [],
}

export default function reportsReducer(state = initialState, action) {
  switch (action.type) {
    case SET_EXPIRY_ALERT:
      return {
        ...state,
        expiryAlert: action.payload,
      }
    case SET_REORDER_LEVEL_ALERT:
      return {
        ...state,
        reorderAlert: action.payload,
      }
    case SET_FAST_SELLING_ITEMS:
      return {
        ...state,
        fastSellingItems: action.payload,
      }
    case SET_DAILY_SALES_REPORT:
      return {
        ...state,
        dailySalesReport: action.payload,
      }
    case SET_DAILY_SALES_REPORT_UNFORMATTED:
      return {
        ...state,
        fullSalesReport: action.payload,
      }
    case SET_CLIENT_STATEMENT:
      return {
        ...state,
        clientAccountStatement: action.payload,
      }
    case CLEAR_CLIENT_STATEMENT:
      return {
        ...state,
        clientAccountStatement: [],
      }

    default:
      return state
  }
}
