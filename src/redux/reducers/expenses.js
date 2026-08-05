import { SET_EXPENSES_LIST } from '../actions/actionTypes'

const initialState = {
  expensesList: [],
}

export default function suppliersReducer(state = initialState, action) {
  switch (action.type) {
    case SET_EXPENSES_LIST:
      return {
        ...state,
        expensesList: action.payload,
      }

    default:
      return state
  }
}
