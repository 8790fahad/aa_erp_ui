import { _postApi } from "./api";

export function saveDeposit(data = {}, callback = (f) => f, error = (f) => f) {
  // console.log("Is callling")
  _postApi(
    "/transactions/deposit",
    data,
    () => callback(),
    () => error()
  );
}

export function makeSale(data = [], callback = (f) => f, error = (f) => f) {
  console.log("Called makeSale");
  console.error(data, "GGGGGGGGGGGGGGGGGGGGG");
  for (let i = 0; i < data.length; i++) {
    console.error(data[i], "GGGGGGGGGGGGGGGGGGGGG");
    data.branch_name = data.store;
    data.salesFrom = data.store;
  }
  _postApi("/api/v1/transactions/batch-selling", { data }, callback, error);
}

export function newPurchase() {
  console.log("Called newPurchase");
}

export function supplierPayment(
  data = [],
  callback = (f) => f,
  error = (f) => f
) {
  console.log("Called newSupplierPayment");
  _postApi("/api/v1/transactions/supplier-payment", data, callback, error);
}

export function newExpenses(data = [], callback = (f) => f, error = (f) => f) {
  console.log("Called newExpenses");
  _postApi("/transactions/batch-expenses", { data }, callback, error);
}

export function returnAndReplace(
  data = [],
  callback = (f) => f,
  error = (f) => f
) {
  console.log("Called ReturnReplace");

  _postApi("/api/transaction/returned-items-batch", { data }, callback, error);
}
