import { SET_NEW_UOM } from '../actions/actionTypes'

const initialState = {
  uomList: [],
}

export default function uomReducer(state = initialState, action) {
  switch (action.type) {
    case SET_NEW_UOM:
      return {
        ...state,
        uomList: action.payload,
      }

    default:
      return state
  }
}
