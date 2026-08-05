import { SET_NEW_CUSTOMER } from '../actions/actionTypes'

const initialState = {
  customerList: [],
}

export default function customersReducer(state = initialState, action) {
  switch (action.type) {
    case SET_NEW_CUSTOMER:
      return {
        ...state,
        customerList: action.payload,
      }

    default:
      return state
  }
}
