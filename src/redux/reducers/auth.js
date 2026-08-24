import { BUSINESS_TYPES } from "../../constants";
import {
  LOGIN,
  // ERROR,
  // LOADING,
  LOGOUT,
  LOGGING_IN,
  RESTORE_TOKEN,
  LOGIN_ERROR,
  SIGN_UP_LOADING,
  SET_PROFILE,
  SET_APP_THEME,
  UPDATE_BUSINESS,
  UPDATE_USER,
  UPDATE_BUSINESS_SETTINGS,
} from "../actions/actionTypes";

const initialState = {
  token: null,
  loggedIn: false,
  loggingIn: false,
  user: {
    id: "emaitee",
    // facilityID: "test",
    state: "",
    technical_arm: "",
    phone: "",
    wallet: 0,
    email: "",
    role: "",
    busName: "Inventria General Enterprises",
    businessType: BUSINESS_TYPES.PRODUCTS,
    businessIncludesLogistics: true,
    image:
      "https://res.cloudinary.com/emaitee/image/upload/v1607108016/PharmPay/profile_pictures/user-avatar.jpg",
  },
  business: [],
  error: "",
  signupLoading: false,
  theme: {
    primary: "#1a2d5e", // --aa-navy
    secondary: "#fff",
    tertiary: "white",
    black: "black",
    faded: "#f7f7f7",
    inverse: "#292b2c",
    accent: "#2c7be5", // --aa-accent
  },
  businessesList: [],
  businessCount: 0,
  activeBusiness: {
    primary_color: "#1a2d5e", // --aa-navy
    secondary_color: "#fff",
    tertiary_color: "white",
    black: "black",
    faded: "#f7f7f7",
    inverse: "#292b2c",
  },
};

export default function authReducer(state = initialState, action) {

  switch (action.type) {
    case LOGIN: {
      const payload = action.payload || {};
      const user = payload.user || {};
      const businessTree = Array.isArray(payload.business)
        ? payload.business
        : [];
      const firstBusinessRow = Array.isArray(businessTree[0])
        ? businessTree[0]
        : businessTree;
      const activeFromTree =
        (Array.isArray(firstBusinessRow) && firstBusinessRow[0]) ||
        firstBusinessRow ||
        {};
      const businessesList = Array.isArray(payload.businessesList)
        ? payload.businessesList
        : [];

      return Object.assign({}, state, {
        authenticated: true,
        loggedIn: true,
        user: Object.assign({}, state.user, user, {
          facilityId: user.facilityId || user.facilityID || state.user.facilityId,
        }),
        token: payload.token || state.token,
        error: "",
        business: firstBusinessRow || state.business,
        businessesList,
        businessCount:
          payload.businessCount ??
          businessesList.length ??
          state.businessCount,
        activeBusiness: activeFromTree?.id
          ? activeFromTree
          : businessesList[0] || state.activeBusiness || {},
      });
    }
    case UPDATE_BUSINESS: {
      return Object.assign({}, state, {
        business: action.payload.business,
        activeBusiness: action.payload.business
          ? action.payload.business[0]
          : {},
      });
    }
    case UPDATE_BUSINESS_SETTINGS: {
      // Handle different payload structures:
      // 1. { business: updatedBusinessObject }
      // 2. { activeBusiness: updatedBusinessObject }
      const rawUpdate =
        action.payload.business || action.payload.activeBusiness;

      if (!rawUpdate) {
        console.warn(
          "UPDATE_BUSINESS_SETTINGS: No updatedBusiness found in payload",
          action.payload,
        );
        return state;
      }

      const normalizeBusinessUpdate = (business) => {
        if (!business) return null;
        if (typeof business.toJSON === "function") {
          return business.toJSON();
        }
        if (business.dataValues) {
          return { ...business.dataValues };
        }
        return business;
      };

      const updatedBusiness = normalizeBusinessUpdate(rawUpdate);

      const mergeBusiness = (current) => {
        if (!current?.id || !updatedBusiness?.id) {
          return current;
        }
        if (current.id !== updatedBusiness.id) {
          return current;
        }

        return {
          ...current,
          ...updatedBusiness,
          // Membership fields are merged at login, not stored on business row.
          access_to: updatedBusiness.access_to ?? current.access_to,
          functionalities:
            updatedBusiness.functionalities ?? current.functionalities,
          branch_id: updatedBusiness.branch_id ?? current.branch_id,
        };
      };

      const businessList = Array.isArray(state.business) ? state.business : [];
      const updatedBusinessArray = businessList.map((item) =>
        mergeBusiness(normalizeBusinessUpdate(item) || item),
      );

      const updatedActiveBusiness = mergeBusiness(state.activeBusiness);

      return Object.assign({}, state, {
        activeBusiness: updatedActiveBusiness,
        business: updatedBusinessArray,
      });
    }
    case UPDATE_USER: {
      const payload = action.payload || {};
      const accessTo = payload.access_to
        ? payload.access_to.split(",").map((s) => s.trim()).filter(Boolean)
        : state.user.accessTo ?? [];
      const functionalities = payload.functionalities
        ? payload.functionalities.split(",").map((s) => s.trim()).filter(Boolean)
        : state.user.functionalities ?? [];
      return {
        ...state,
        activeBusiness: payload,
        user: {
          ...state.user,
          facilityId: payload.id ?? state.user.facilityId,
          accessTo,
          functionalities,
        },
      };
    }
    case LOGOUT:
      return {
        ...initialState,
        // ...state,
        // activeBusiness: action.payload,
      };
    case LOGGING_IN:
      return {
        ...state,
        loggingIn: !state.loggingIn,
      };
    case RESTORE_TOKEN:
      return {
        ...state,
        token: action.payload.token,
      };
    case LOGIN_ERROR:
      return {
        ...state,
        error: action.payload,
      };
    case SIGN_UP_LOADING:
      return {
        ...state,
        signupLoading: !state.signupLoading,
      };
    case SET_PROFILE:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };
    case SET_APP_THEME:
      return {
        ...state,
        theme: { ...state.theme, ...action.payload },
      };
    default:
      return state;
  }
}
