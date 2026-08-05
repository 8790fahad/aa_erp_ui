import { SET_FORM_SETUP } from '../actions/actionTypes'

const initialState = {
  purchaseSetup: [],
  dashboardSetup: [
    {
      supplier: true,
      purchase: true,
      pos: true,
      expense: true,
      transferGoods: true,
      pendingSale: true,
      report: true,
      customer: true,
      settings: true,
      returnGoods: true,
      addBanks: true,
      recordServises: true,
      myServices: true,
    },
  ],
  serviceSetup: [],
}

export default function formSetupReducer(state = initialState, action) {
  switch (action.type) {
    case SET_FORM_SETUP:
      return {
        ...state,
        purchaseSetup: action.payload,
        dashboardSetup: action.payload,
        serviceSetup: action.payload,
      }

    default:
      return state
  }
}
