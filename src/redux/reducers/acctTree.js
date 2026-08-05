import { CREATE_ACC_CHART_TREE, NEW_ACCT_HEAD } from '../actions/actionTypes'

const initialState = {
  acctTreeList: [],
  acctHead: [],
}

export default function suppliersReducer(state = initialState, action) {
  switch (action.type) {
    case CREATE_ACC_CHART_TREE:
      return {
        ...state,
        acctTreeList: action.payload,
      }
    case NEW_ACCT_HEAD:
      return {
        ...state,
        acctHead: action.payload,
      }

    default:
      return state
  }
}
