import { initStore } from './stores'

/**
 * App wide initializations would be done here
 */

function initApp() {
  /**
   * initStore() // creates a default store with the business name i.e. Main Store
   * initCustomerCategory() // creates a default customer category for the business i.e. Walk-In customers
   * ...
   *
   */

  initStore()
}

export default initApp;