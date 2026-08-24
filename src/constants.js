export const colors = {
  primary: '#1a2d5e', // var(--aa-navy)
  secondary: '#f5e4e4',
  white: '#fff',
  accent: '#2c7be5', // var(--aa-accent)
}

export const STORE = 'STORE'
export const CASH = 'CASH'
export const RECEIVABLE = 'RECEIVABLE'
export const VAT_RECEIVABLE = 'VAT_RECEIVABLE'
export const PAYABLE = 'PAYABLE'
export const VAT_PAYABLE = 'VAT_PAYABLE'
export const EXPENSES = 'EXPENSES'
// export const EXPENSES = 'EXPENSES'
export const BUSINESS_TYPES = {
  PRODUCTS: 'PRODUCTS',
  SERVICES: 'SERVICES',
  PRODUCTS_AND_SERVICES: 'PRODUCTS AND SERVICES',
}

export const CUSTOMER_TYPES = {
  WALKIN: 'Walk-In',
}

export const MODES_OF_PAYMENT = {
  CASH: 'CASH',
  POST: 'POS',
  BANK_TRANSFER: 'BANK TRANSFER',
  CREDIT: 'CREDIT',
  CHEQUE: 'CHEQUE',
}

export const TRANSACTION_TYPES = {
  SUPPLIER_PAYMENT: 'SUPPLIER PAYMENT',
  CUSTOMER_DEPOSIT: 'CUSTOMER_DEPOSIT',
  NEW_SALE: 'NEW_SALE',
  NEW_PURCHASE: 'NEW_PURCHASE',
  NEW_EXPENSES: 'NEW_EXPENSES',
  RETURN_AND_REPLACE: 'NEW_RETURN_AND_REPLACE'
}

export const RETURN_TYPES = {
  REPLACE: 'REPLACE',
  RETURN: 'RETURN',
}

export const ACCOUNT_TYPES = {
  SUBSIDIARY: 'SUBSIDIARY',
}

export const DATA_KEYS = {
  ITEM_HISTORY: 'item_history',
  SUPPLIER_STATEMENT: 'supplier_statement'

}

export const STORE_TYPES = {
  POS: 'Point of sale (POS)',
  STORE: 'Store'
}

export const CURRENCY = '₦'

export const moduleData = [
  'Dashboard',
  'Reports',
  'Customers',
  'Settings',
]

export const subModuleData = [
  'Customers',
  'Unit of measurement',
]

// modules that are required only by product business
export const productsModuleData = [
  'Supplier',
  'Purchases',
  'Make Sales',
  'Transfer',
  'Pending Sales',
  'ReturnReplace',
]

// modules that are required only by services business
export const servicesModuleData = ['Record Services', 'Services List']