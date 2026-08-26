import axios from 'axios';

import { apiURL } from '../actions/apiConfig';

// Create axios instance with proper configuration
const apiClient = axios.create({
  baseURL: apiURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('@@__token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export { apiClient };

// Action Types
export const FETCH_ASSETS_REQUEST = 'FETCH_ASSETS_REQUEST';
export const FETCH_ASSETS_SUCCESS = 'FETCH_ASSETS_SUCCESS';
export const FETCH_ASSETS_FAILURE = 'FETCH_ASSETS_FAILURE';

export const FETCH_ASSET_REQUEST = 'FETCH_ASSET_REQUEST';
export const FETCH_ASSET_SUCCESS = 'FETCH_ASSET_SUCCESS';
export const FETCH_ASSET_FAILURE = 'FETCH_ASSET_FAILURE';

export const CREATE_ASSET_REQUEST = 'CREATE_ASSET_REQUEST';
export const CREATE_ASSET_SUCCESS = 'CREATE_ASSET_SUCCESS';
export const CREATE_ASSET_FAILURE = 'CREATE_ASSET_FAILURE';

export const UPDATE_ASSET_REQUEST = 'UPDATE_ASSET_REQUEST';
export const UPDATE_ASSET_SUCCESS = 'UPDATE_ASSET_SUCCESS';
export const UPDATE_ASSET_FAILURE = 'UPDATE_ASSET_FAILURE';

export const DISPOSE_ASSET_REQUEST = 'DISPOSE_ASSET_REQUEST';
export const DISPOSE_ASSET_SUCCESS = 'DISPOSE_ASSET_SUCCESS';
export const DISPOSE_ASSET_FAILURE = 'DISPOSE_ASSET_FAILURE';

export const FETCH_ASSET_SUMMARY_REQUEST = 'FETCH_ASSET_SUMMARY_REQUEST';
export const FETCH_ASSET_SUMMARY_SUCCESS = 'FETCH_ASSET_SUMMARY_SUCCESS';
export const FETCH_ASSET_SUMMARY_FAILURE = 'FETCH_ASSET_SUMMARY_FAILURE';

export const SET_ASSET_FILTERS = 'SET_ASSET_FILTERS';
export const CLEAR_ASSET_FILTERS = 'CLEAR_ASSET_FILTERS';
export const SET_CURRENT_ASSET = 'SET_CURRENT_ASSET';
export const CLEAR_CURRENT_ASSET = 'CLEAR_CURRENT_ASSET';
export const CLEAR_ASSET_ERROR = 'CLEAR_ASSET_ERROR';

// Action Creators
export const fetchAssetsRequest = () => ({
  type: FETCH_ASSETS_REQUEST
});

export const fetchAssetsSuccess = (data) => ({
  type: FETCH_ASSETS_SUCCESS,
  payload: data
});

export const fetchAssetsFailure = (error) => ({
  type: FETCH_ASSETS_FAILURE,
  payload: error
});

export const fetchAssetRequest = () => ({
  type: FETCH_ASSET_REQUEST
});

export const fetchAssetSuccess = (data) => ({
  type: FETCH_ASSET_SUCCESS,
  payload: data
});

export const fetchAssetFailure = (error) => ({
  type: FETCH_ASSET_FAILURE,
  payload: error
});

export const createAssetRequest = () => ({
  type: CREATE_ASSET_REQUEST
});

export const createAssetSuccess = (data) => ({
  type: CREATE_ASSET_SUCCESS,
  payload: data
});

export const createAssetFailure = (error) => ({
  type: CREATE_ASSET_FAILURE,
  payload: error
});

export const updateAssetRequest = () => ({
  type: UPDATE_ASSET_REQUEST
});

export const updateAssetSuccess = (data) => ({
  type: UPDATE_ASSET_SUCCESS,
  payload: data
});

export const updateAssetFailure = (error) => ({
  type: UPDATE_ASSET_FAILURE,
  payload: error
});

export const disposeAssetRequest = () => ({
  type: DISPOSE_ASSET_REQUEST
});

export const disposeAssetSuccess = (data) => ({
  type: DISPOSE_ASSET_SUCCESS,
  payload: data
});

export const disposeAssetFailure = (error) => ({
  type: DISPOSE_ASSET_FAILURE,
  payload: error
});

export const fetchAssetSummaryRequest = () => ({
  type: FETCH_ASSET_SUMMARY_REQUEST
});

export const fetchAssetSummarySuccess = (data) => ({
  type: FETCH_ASSET_SUMMARY_SUCCESS,
  payload: data
});

export const fetchAssetSummaryFailure = (error) => ({
  type: FETCH_ASSET_SUMMARY_FAILURE,
  payload: error
});

export const setAssetFilters = (filters) => ({
  type: SET_ASSET_FILTERS,
  payload: filters
});

export const clearAssetFilters = () => ({
  type: CLEAR_ASSET_FILTERS
});

export const setCurrentAsset = (asset) => ({
  type: SET_CURRENT_ASSET,
  payload: asset
});

export const clearCurrentAsset = () => ({
  type: CLEAR_CURRENT_ASSET
});

export const clearAssetError = () => ({
  type: CLEAR_ASSET_ERROR
});

// Thunk Actions
export const fetchAssets = (params) => {
  return async (dispatch) => {
    dispatch(fetchAssetsRequest());
    try {
      const response = await apiClient.get('/api/assets', { params });
      dispatch(fetchAssetsSuccess(response.data));
    } catch (error) {
      dispatch(fetchAssetsFailure(error.response?.data?.message || 'Failed to fetch assets'));
    }
  };
};

export const fetchAssetById = (id) => {
  return async (dispatch) => {
    dispatch(fetchAssetRequest());
    try {
      const response = await apiClient.get(`/api/assets/${id}`);
      dispatch(fetchAssetSuccess(response.data));
    } catch (error) {
      dispatch(fetchAssetFailure(error.response?.data?.message || 'Failed to fetch asset'));
    }
  };
};

export const createAsset = (assetData) => {
  return async (dispatch) => {
    dispatch(createAssetRequest());
    try {
      const response = await apiClient.post('/api/assets', assetData);
      dispatch(createAssetSuccess(response.data));
      return response.data;
    } catch (error) {
      dispatch(createAssetFailure(error.response?.data?.message || 'Failed to create asset'));
      throw error;
    }
  };
};

export const updateAsset = (id, data) => {
  return async (dispatch) => {
    dispatch(updateAssetRequest());
    try {
      const response = await apiClient.put(`/api/assets/${id}`, data);
      dispatch(updateAssetSuccess(response.data));
      return response.data;
    } catch (error) {
      dispatch(updateAssetFailure(error.response?.data?.message || 'Failed to update asset'));
      throw error;
    }
  };
};

export const disposeAsset = (id, disposalData) => {
  return async (dispatch) => {
    dispatch(disposeAssetRequest());
    try {
      const response = await apiClient.post(`/api/assets/${id}/dispose`, disposalData);
      dispatch(disposeAssetSuccess(response.data));
      return response.data;
    } catch (error) {
      dispatch(disposeAssetFailure(error.response?.data?.message || 'Failed to dispose asset'));
      throw error;
    }
  };
};

export const fetchAssetSummary = (facilityId) => {
  return async (dispatch) => {
    dispatch(fetchAssetSummaryRequest());
    try {
      const response = await apiClient.get('/api/assets/summary/dashboard', {
        params: { facilityId }
      });
      dispatch(fetchAssetSummarySuccess(response.data));
    } catch (error) {
      dispatch(fetchAssetSummaryFailure(error.response?.data?.message || 'Failed to fetch asset summary'));
    }
  };
};

// Initial State
const initialState = {
  assets: [],
  currentAsset: null,
  summary: {
    totalAssets: 0,
    totalValue: 0,
    activeAssets: 0,
    disposedAssets: 0,
    maintenanceDue: 0,
    categoryStats: [],
    statusStats: []
  },
  pagination: {
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1
  },
  filters: {
    search: '',
    category: '',
    status: '',
    location: '',
    custodian: ''
  },
  loading: {
    assets: false,
    currentAsset: false,
    creating: false,
    updating: false,
    disposing: false,
    summary: false
  },
  error: null
};

// Reducer
const assetReducer = (state = initialState, action) => {
  switch (action.type) {
    case FETCH_ASSETS_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, assets: true },
        error: null
      };
    case FETCH_ASSETS_SUCCESS:
      return {
        ...state,
        loading: { ...state.loading, assets: false },
        assets: action.payload.success ? action.payload.data.assets : [],
        pagination: action.payload.success ? action.payload.data.pagination : state.pagination
      };
    case FETCH_ASSETS_FAILURE:
      return {
        ...state,
        loading: { ...state.loading, assets: false },
        error: action.payload
      };

    case FETCH_ASSET_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, currentAsset: true },
        error: null
      };
    case FETCH_ASSET_SUCCESS:
      return {
        ...state,
        loading: { ...state.loading, currentAsset: false },
        currentAsset: action.payload.success ? action.payload.data : null
      };
    case FETCH_ASSET_FAILURE:
      return {
        ...state,
        loading: { ...state.loading, currentAsset: false },
        error: action.payload
      };

    case CREATE_ASSET_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, creating: true },
        error: null
      };
    case CREATE_ASSET_SUCCESS:
      return {
        ...state,
        loading: { ...state.loading, creating: false },
        assets: action.payload.success ? [action.payload.data, ...state.assets] : state.assets
      };
    case CREATE_ASSET_FAILURE:
      return {
        ...state,
        loading: { ...state.loading, creating: false },
        error: action.payload
      };

    case UPDATE_ASSET_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, updating: true },
        error: null
      };
    case UPDATE_ASSET_SUCCESS:
      if (action.payload.success) {
        const updatedAssets = state.assets.map(asset =>
          asset.id === action.payload.data.id ? action.payload.data : asset
        );
        return {
          ...state,
          loading: { ...state.loading, updating: false },
          assets: updatedAssets,
          currentAsset: state.currentAsset?.id === action.payload.data.id ? action.payload.data : state.currentAsset
        };
      }
      return {
        ...state,
        loading: { ...state.loading, updating: false }
      };
    case UPDATE_ASSET_FAILURE:
      return {
        ...state,
        loading: { ...state.loading, updating: false },
        error: action.payload
      };

    case DISPOSE_ASSET_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, disposing: true },
        error: null
      };
    case DISPOSE_ASSET_SUCCESS:
      if (action.payload.success) {
        const updatedAssets = state.assets.map(asset =>
          asset.id === action.payload.data.asset.id ? action.payload.data.asset : asset
        );
        return {
          ...state,
          loading: { ...state.loading, disposing: false },
          assets: updatedAssets,
          currentAsset: state.currentAsset?.id === action.payload.data.asset.id ? action.payload.data.asset : state.currentAsset
        };
      }
      return {
        ...state,
        loading: { ...state.loading, disposing: false }
      };
    case DISPOSE_ASSET_FAILURE:
      return {
        ...state,
        loading: { ...state.loading, disposing: false },
        error: action.payload
      };

    case FETCH_ASSET_SUMMARY_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, summary: true },
        error: null
      };
    case FETCH_ASSET_SUMMARY_SUCCESS:
      if (action.payload.success) {
        const data = action.payload.data;
        return {
          ...state,
          loading: { ...state.loading, summary: false },
          summary: {
            totalAssets: data.categoryStats.reduce((sum, cat) => sum + parseInt(cat.count), 0),
            totalValue: data.totalValue,
            activeAssets: data.statusStats.find(s => s.status === 'Active')?.count || 0,
            disposedAssets: data.statusStats.find(s => s.status === 'Disposed')?.count || 0,
            maintenanceDue: data.maintenanceDue,
            categoryStats: data.categoryStats,
            statusStats: data.statusStats
          }
        };
      }
      return {
        ...state,
        loading: { ...state.loading, summary: false }
      };
    case FETCH_ASSET_SUMMARY_FAILURE:
      return {
        ...state,
        loading: { ...state.loading, summary: false },
        error: action.payload
      };

    case SET_ASSET_FILTERS:
      return {
        ...state,
        filters: { ...state.filters, ...action.payload }
      };
    case CLEAR_ASSET_FILTERS:
      return {
        ...state,
        filters: initialState.filters
      };
    case SET_CURRENT_ASSET:
      return {
        ...state,
        currentAsset: action.payload
      };
    case CLEAR_CURRENT_ASSET:
      return {
        ...state,
        currentAsset: null
      };
    case CLEAR_ASSET_ERROR:
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
};

export default assetReducer;