// import { BluetoothManager } from 'react-native-bluetooth-escpos-printer'
// import AsyncStorage from '@react-native-community/async-storage'
// import { showMessage } from 'react-native-flash-message'
// import { REMOVE_PRINTER } from './actionTypes'

// const SAVED_PRINTERS_KEY = '@@aa_erp:saved_pinters'

export const getDefaultPrinter = async (
  callback = (f) => f,
  error = (f) => f
) => {
  // let req = await AsyncStorage.getItem(SAVED_PRINTERS_KEY)
  // if (req) {
  //   let savedPrinters = JSON.parse(req)

  //   if (savedPrinters && savedPrinters.length) {
  //     // setSavedPrintersList(savedPrinters)
  //     let d_printer = savedPrinters.find((i) => i.default)

  //     callback(savedPrinters, d_printer)
  //   }
  // } else {
  //   error()
  // }
}

// export const getPrinters =() => {
// 	return dispatch => {

// 	}
// }

export const connectPrinter = (
  mac = null,
  callback = (f) => f,
  error = (f) => f
) => {
  // if (mac) {
  //   BluetoothManager.connect(mac).then(
  //     (resp) => {
  //       console.log(resp)
  //       callback(resp)
  //     },
  //     (e) => {
  //       error(e)
  //     }
  //   )
  // }
}

export const removeDefaultPrinter = (callback) => {
  return (dispatch) => {
    console.log('removing --- 2')
  //   AsyncStorage.removeItem(SAVED_PRINTERS_KEY)
  //     .then(() => {
  //       dispatch({
  //         type: REMOVE_PRINTER,
  //         // payload: default_printer.address,
  //       })
  //       callback()
  //       console.log('removing --- success')
  //     })
  //     .catch((err) => {
  //       console.log(err)
  //     })
  }
}

export const initConnectDefaultPrinter = () => {
  return (dispatch) => {
    getDefaultPrinter(
      (list, default_printer) => {
        // setSavedPrintersList(list);
        // setDefaultPrinter(default_printer)
        // if (default_printer) {
        //   connectPrinter(
        //     default_printer.address,
        //     () => {
        //       showMessage({
        //         message: 'Printer Connected Successfully',
        //         type: 'success',
        //         duration: 1000,
        //       })
        //     },
        //     (e) => {
        //       showMessage({
        //         message:
        //           'Fail to connect to printer, please check your connection',
        //         type: 'warning',
        //         duration: 1000,
        //       })
        //     }
        //   )
        //   dispatch({
        //     type: 'PRINTER_SELECTED',
        //     payload: default_printer.address,
        //   })
        // }
      },
      (err) => {
        console.log('An error occured', err)
      }
    )
  }
}
