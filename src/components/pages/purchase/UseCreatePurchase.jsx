import { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { MY_ITEMS } from '../../redux/actions/actionTypes'
import moment from 'moment'
import { v4 as UUIDV4 } from 'uuid'
import { saveNewPurchase } from '../../redux/actions/purchase'
import { useHistory } from 'react-router-dom'
import { saveTransaction } from '../../redux/actions/transactions'
import { TRANSACTION_TYPES } from '../../constants'

const useForm = (validate) => {
  const { my_items, my_suppliers } = useSelector((state) => state.purchase)
  const history = useHistory()
  const dispatch = useDispatch()
  const [errors, setErrors] = useState({})
  const [values, setValues] = useState({
    date: moment().format('YYYY-MM-DD'),
    item_name: '',
    quantity: '',
    supplierName: '',
    expiry_date: '',
    generic_name: '',
    uom: '',
    reorder: '',
    cost: '',
    selling_price: '',
    receivedTo: '',
    modeOfPayment: '',
    item_category: '',
    reference_no: Date.now(),
    truckNo: '',
    waybillNo: '',
    otherDetails: '',
    saveAsNewItem: true,
    exisitingId: null,
    bank: '',
    account: '',
  })

  const handleChange = ({ target: { name, value } }) => {
    console.log({ name, value })
    setValues({
      ...values,
      [name]: value,
    })
    setErrors(validate(values))
  }

  const errorsCount = (errors) => {
    return Object.values(errors).length
  }
  const handleAddCart = () => {
    console.log({ xxxxxxxxxxxxxxx: values })
    my_items.push(values)
    dispatch({
      type: MY_ITEMS,
      payload: my_items,
    })
  }
  const handleDelete = (i) => {
    const new_items = my_items.filter((item, index) => i !== index)
    dispatch({
      type: MY_ITEMS,
      payload: new_items,
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setErrors(validate(values))
    console.error({ count: errorsCount(errors) })
    const receiptNo = moment().format('YYMDhms')
    values.reference_no = receiptNo
    // if (errorsCount(errors) < 1) {
    // }
    saveNewPurchase(my_items, () => {
      let txn = []
      my_items.forEach((item) => {
        // UUIDGenerator.getRandomUUID((uuid) => {
        const markup =
          parseFloat(values.selling_price) - parseFloat(values.cost)
        const transaction_id = UUIDV4()
        txn.push({
          _id: transaction_id,
          source: 'STORE',
          item_name: item.item_name,
          product_code: item.item_name,
          dr: item.cost,
          cr: 0,
          destination: item.modeOfPayment,
          quantity: item.quantity,
          description: item.item_name,
          markup,
          reference_no: receiptNo,
          trn: item.trn,
          receiptNo,
          supplierName: item.supplierName,
          transaction_type: 'NEW_PURCHASE',
          supplier_code: my_suppliers.filter(
            (spl) => spl.supplier_name === item.supplierName,
          )[0]?.supplier_code,
          truckNo: item.truckNo,
          waybillNo: item.waybillNo,
          otherDetails: item.otherDetails,
        })
      })
      saveTransaction(
        txn,
        () => {
          console.log('saved transaction')
        },
        (err) => {
          console.log(err)
        },
        TRANSACTION_TYPES.NEW_PURCHASE,
      )
      history.push('/app/purchase/purchase-list')
    })
  }
  return {
    errors,
    values,
    handleChange,
    handleSubmit,
    handleAddCart,
    handleDelete,
  }
}

export default useForm
