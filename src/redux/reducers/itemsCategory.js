import { SET_NEW_ITEMS_CATEGORY } from '../actions/actionTypes'

const initialState = {
  itemsCategoryList: [],
}

export default function itemsCategoryReducer(state = initialState, action) {
  switch (action.type) {
    case SET_NEW_ITEMS_CATEGORY:
      return {
        ...state,
        itemsCategoryList: action.payload,
      }

    default:
      return state
  }
}
