import {
  SET_SUPPLIER_LIST,
  GETTING_ACC_CHART,
  GET_ACC_CHART_TREE,
} from '../actions/actionTypes'

const initialState = {
  supplierList: [],
  accChartTree: [],
  accountChartLoading: true,
}

export default function suppliersReducer(state = initialState, action) {
  switch (action.type) {
    case SET_SUPPLIER_LIST:
      return {
        ...state,
        supplierList: action.payload,
      }
    case GET_ACC_CHART_TREE:
      return {
        ...state,
        accChartTree: action.payload,
      }
    case GETTING_ACC_CHART:
      return {
        ...state,
        accountChartLoading: !state.accountChartLoading,
      }

    default:
      return state
  }
}
