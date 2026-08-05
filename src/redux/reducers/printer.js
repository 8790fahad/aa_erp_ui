import {
  PRINTER_LIST,
  PRINTER_SELECTED,
  REMOVE_PRINTER,
} from '../actions/actionTypes'

const initialState = {
  printers: [],
  currentPrinter: '',
  defaultPrinter: {},
}

export default function printerReducers(state = initialState, action) {
  switch (action.type) {
    case PRINTER_LIST:
      return {
        ...state,
        printers: action.payload,
      }
    case PRINTER_SELECTED:
      return {
        ...state,
        currentPrinter: action.payload,
      }
    case 'SET_DEFAULT_PRINTER':
      return {
        ...state,
        defaultPrinter: action.payload,
      }
    case REMOVE_PRINTER:
      return {
        ...state,
        defaultPrinter: {},
      }
    default:
      return state
  }
}
