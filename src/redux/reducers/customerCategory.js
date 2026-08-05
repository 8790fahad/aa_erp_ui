import { SET_NEW_CUSTOMER_CAT } from '../actions/actionTypes'

const initialState = {
  customerCategoryList: [],
}

export default function customerCategoryReducer(state = initialState, action) {
  switch (action.type) {
    case SET_NEW_CUSTOMER_CAT:
      return {
        ...state,
        customerCategoryList: action.payload,
      }

    default:
      return state
  }
}
