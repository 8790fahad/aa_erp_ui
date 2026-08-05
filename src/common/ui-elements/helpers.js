import moment from "moment";
import { api_url } from "redux/actions";
import { _fetchApi } from "../../redux/actions/api";
import store from "../../redux/store";
// import store

// export const url = 'http://localhost:4000';
//http://192.168.43.240:4000';

// export const url = 'https://pscprime.com/hms1/hms-server';
// export const url = 'https://bitshis-server.herokuapp.com';

/**
 * _fetchData()
 * helper function that fetches data from the database using a
 * specified route and performs the callback function on the returned data
 * @params route (string) => the api route
 * @params callback (func) => the action to perform on that data
 *      that is being returned
 */
// const _fetchData = ({ route, callback }) => {
//   fetch(`http://localhost:4000/${route}`, {
//     method: 'GET',
//   })
//     .then(function(response) {
//       if (response.ok) return response.json();
//       else
//         return Promise.reject({
//           status: response.status,
//           statusText: response.statusText,
//         });
//     })
//     .then(function(data) {
//       // console.log(data)
//       callback(data);
//     })
//     .catch(err => console.log(err));
// };

const toCamelCase = (str = "") => {
  return str && str[0].toUpperCase() + str.substr(1);
};

// const _customNotify = (msg) => {
//   toast.success(msg);
// };

// const toast.error = (msg) => {
//   toast.error(msg);
// };

const _convertArrOfObjToArr = (arr) => {
  let result = [];
  for (let o of arr) {
    result.push(Object.values(o));
  }
  return result;
};

function formatNumber(n) {
  let num = Math.round(parseInt(n), 0);
  if (num) {
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
  } else {
    return "";
  }
}

function pad(n, width, z) {
  z = z || "0";
  n = n + "";
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

// const _checkPresence = (arr, testId) => {
//   let errArr = [];
//   for (let i = 0; i < arr.length; i++) {
//     arr[i].id === testId ? errArr.push(true) : errArr.push(false);
//   }
//   return errArr.includes(true) ? true : false;
// };

const today = moment().format("YYYY-MM-DD");

function generateReceiptNo(callback) {
  // console.log()
  const today = moment().format("DDMMYY");
  _fetchApi(
    `/transactions/getNextTransactionID`,
    ({ transactionId }) => {
      // let txnId = pad(transactionId, 6, 0)
      _fetchApi(
        `/transactions/getReceiptNo`,
        ({ receiptNo }) => {
          receiptNo = receiptNo ? receiptNo : 1;
          transactionId = transactionId ? transactionId : 1;
          // console.log(receiptNo)
          // let rcptNo = pad(receiptNo, 4, 0)
          let rec = `${today}${receiptNo}${transactionId}`;
          callback(rec, receiptNo);
          // const newBalance = this.state.depositForm.balance + this.state.depositForm.amount
          // this.setState(prevState => ({ depositForm: Object.assign({}, prevState.depositForm, { receiptNo: rec, receiptId: receiptNo }) }))
        },
        (err) => console.log(err)
      );
    },
    (err) => console.log(err)
  );
}

function appendNameToTxnData(results = [], callback = (f) => f) {
  let allPatients = JSON.parse(localStorage.getItem("allpatients")) || [];
  let newPendingTxnsList = [];
  if (allPatients.length) {
    results.forEach((item) => {
      if (item.transaction_source === "Expenditure") {
        newPendingTxnsList.push({ ...item, accountName: "Expenditure" });
      } else {
        let actualPatient = allPatients.filter(
          (el) => parseInt(item.transaction_source) === parseInt(el.accountNo)
        );
        if (actualPatient.length) {
          let patient = actualPatient[0];
          newPendingTxnsList.push({
            ...item,
            accountName: `${patient.firstname} ${patient.surname} ${patient.other}`,
          });
        }
      }
    });
    callback(newPendingTxnsList);
  } else {
    _fetchApi(
      `/patientrecords/patientlist`,
      (res) => {
        let allpatients = res.results;
        if (allpatients.length) {
          localStorage.setItem("allpatients", JSON.stringify(allpatients));
          results.forEach((item) => {
            if (item.transaction_source === "Expenditure") {
              newPendingTxnsList.push({ ...item, accountName: "Expenditure" });
            } else {
              let actualPatient = allPatients.filter(
                (el) =>
                  parseInt(item.transaction_source) === parseInt(el.accountNo)
              );
              if (actualPatient.length) {
                let patient = actualPatient[0];
                newPendingTxnsList.push({
                  ...item,
                  accountName: `${patient.firstname} ${patient.surname} ${patient.other}`,
                });
              }
            }
          });
          callback(newPendingTxnsList);
        }
      },
      (err) => console.log(err)
    );
  }
}

function generateAvatar(firstname = "", lastname = "") {
  if (firstname !== "" && lastname !== "") {
    return `${firstname[0].toUpperCase()}${lastname[0].toUpperCase()}`;
    // console.log(`${firstname[0].toUpperCase()}${lastname[0].toUpperCase()}`)
  }
}

function getPatientId(firstname = "", surname = "", accNo = "") {
  const patientList = store.getState().records.patientlist;
  let patient = patientList.filter(
    (p) =>
      p.firstname === firstname &&
      p.surname === surname &&
      p.accountNo === parseInt(accNo)
  );
  if (patient.length) {
    return patient[0].id;
  } else {
    return null;
  }
}

function extractPatientNameAndId(nameNid) {
  let newVal = nameNid.split(" ");
  let surname = newVal[0];
  let firstname = newVal[1];
  let bracedAcc = newVal[2];
  let accNo = bracedAcc.substr(1, bracedAcc.length - 2);
  let patientId = getPatientId(firstname, surname, accNo);
  return {
    name: `${surname} ${firstname}`,
    accNo,
    patientId,
  };
}

function getAgeFromDOB(dob, format = "Y") {
  let today = moment();
  let f_dob = moment(dob);
  let age = moment.duration(today.diff(f_dob));

  if (format === "Y") {
    return `${age.years()} Y`;
  } else if (format === "YM") {
    return `${age.years()} Y, ${age.months()} months`;
  } else if (format === "YMD") {
    return `${age.years()} Y, ${age.months()} months, ${age.days()} days`;
  } else {
    return null;
  }
}

function checkEmpty(obj) {
  if (typeof obj === "object") {
    let val = Object.values(obj);
    if (val.join("").length > 0) return false;
    // if (!val.join('').includes('0') && val.join('').length > 0) return false;
    return true;
  }
}

const convertSignedMoney = (amt) => {
  if (parseInt(amt) < 0) return `(${formatNumber(Math.abs(amt))})`;
  else if (parseInt(amt) > 0) return `${formatNumber(amt)}`;
};

const getCustomerInfo = (cb, customer_code, kyc_type) => {
  _fetchApi(
    `/kyc/query?query_type=select_kyc&query_param=${customer_code}&kyc_type=${kyc_type}`,

    (data) => {
      // console.log(data);
      cb(data.results[0]);
    },
    (err) => {
      console.log(err);
    }
  );
};

export {
  toCamelCase,
  _convertArrOfObjToArr,
  pad,
  today,
  generateReceiptNo,
  appendNameToTxnData,
  generateAvatar,
  formatNumber,
  getPatientId,
  extractPatientNameAndId,
  getAgeFromDOB,
  checkEmpty,
  convertSignedMoney,
  getCustomerInfo,
};
