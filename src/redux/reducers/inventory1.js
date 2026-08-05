import { SUBMITTIN_REQUEST, LOADING_PENDING_REQUESTS, GET_PENDING_REQUESTS, GET_STORE_ALERTS, GET_SHELF_ALERTS } 
from "../actions/actionTypes"

const initialState = {
	submittingRequest: false,
	loadingRequests: false,
	pendingRequest: [],
	storeAlert: [],
	shelfAlert: [],
	bank_details: [],
	bank: {}
}

export default (state = initialState, action) => {
	switch (action.type) {
		case SUBMITTIN_REQUEST:
			return {
				...state,
				submittingRequest: !state.submittingRequest
			}
		case LOADING_PENDING_REQUESTS:
			return {
				...state,
				loadingRequests: !state.loadingRequests
			}
		case GET_PENDING_REQUESTS:
			return {
				...state,
				pendingRequest: action.payload
			}
		case GET_STORE_ALERTS:
			return {
				...state,
				storeAlert: action.payload
			}
		case GET_SHELF_ALERTS:
			return {
				...state,
				shelfAlert: action.payload
			}
		case 'NEW-BANK':
			return {
				...state,
				bank_details: action.payload
			}
		case 'EDIT-BANK':
			return {
				...state,
				bank: action.payload
			}
		default:
			return state;
	}
}