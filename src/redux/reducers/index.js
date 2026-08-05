import { combineReducers } from 'redux'
import authReducer from './auth'
import supplierReducer from './suppliers'
import purchaseReducer from './purchase'
import expenseReducer from './expenses'
import customersReducer from './customer'
import acctTree from './acctTree'
import printerReducers from './printer'
import uomReducer from './uom'
import storeReducer from './stores'
import inventoryReducer from './inventory'
import reportsReducer from './reports'
import customerCategoryReducer from './customerCategory'
import itemsCategoryReducer from './itemsCategory'
import bankReducer from './add_bank'
import formSetupReducer from './formSetup'
import transactionsReducer from './transactions'
import salesReducer from './sales1'
import assetReducer from './assets'

const rootReducer = combineReducers({
  auth: authReducer,
  suppliers: supplierReducer,
  purchase: purchaseReducer,
  expenses: expenseReducer,
  customer: customersReducer,
  acctTree: acctTree,
  printer: printerReducers,
  uom: uomReducer,
  stores: storeReducer,
  sales:salesReducer,
  inventory: inventoryReducer,
  reports: reportsReducer,
  customerCategory: customerCategoryReducer,
  itemsCategory: itemsCategoryReducer,
  bank: bankReducer,
  formSettingSetup: formSetupReducer,
  transactions:transactionsReducer,
  assets: assetReducer
})

export default rootReducer
