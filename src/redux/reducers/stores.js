import { SET_STORE_LIST } from '../actions/actionTypes'

const initialState = {
  storeList: [],
}

export default function storeReducer(state = initialState, action) {
  switch (action.type) {
    case SET_STORE_LIST:
      return {
        ...state,
        storeList: action.payload,
      }

    default:
      return state
  }
}
