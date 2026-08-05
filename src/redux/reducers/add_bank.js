import { SET_NEW_BANK, SET_NEW_BANK_NEW } from "../actions/actionTypes";

const initialState = {
  bankList: [
    "Access Bank",
    "Citi Bank",
    "EcoBank PLC",
    "First Bank PLC",
    "First City Monument Bank",
    "Fidelity Bank",
    "Guaranty Trust Bank",
    "Polaris bank",
    "Stanbic IBTC Bank",
    "Standard Chaterted bank PLC",
    "Sterling Bank PLC",
    "United Bank for Africa",
    "Union Bank PLC",
    "Wema Bank PLC",
    "Zenith bank PLC",
    "Unity Bank PLC",
    "ProvidusBank PLC",
    "Keystone Bank",
    "Jaiz Bank",
    "Heritage Bank",
    "Suntrust Bank",
    "FINATRUST MICROFINANCE BANK",
    "Rubies Microfinance Bank",
    "Kuda",
    "TCF MFB",
    "FSDH Merchant Bank",
    "Rand merchant Bank",
    "Globus Bank",
    "Paga",
    "Taj Bank Limited",
    "GoMoney",
    "AMJU Unique Microfinance Bank",
    "BRIDGEWAY MICROFINANCE BANK",
    "Eyowo MFB",
    "Mint-Finex MICROFINANCE BANK",
    "Covenant Microfinance Bank",
    "VFD Micro Finance Bank",
    "PatrickGold Microfinance Bank",
  ],
  new_bankList: [],
};

export default function bankReducer(state = initialState, action) {
  switch (action.type) {
    case SET_NEW_BANK:
      return {
        ...state,
        bankList: action.payload,
      };
    case SET_NEW_BANK_NEW:
      return {
        ...state,
        new_bankList: action.payload,
      };
    default:
      return state;
  }
}
