import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
// import CustomTypeahead from '../../../components/CustomTypeahead'
import SelectInput from '../SelectInput'
import { getStoresList } from '@/redux/actions/stores'

function StoreSelection(props) {
  const dispatch = useDispatch()
  const options = useSelector((state) => state.stores.storeList)

  useEffect(() => {
    dispatch(getStoresList())
  }, [dispatch])

  return (
    <SelectInput
      label={props.label}
      required={props.required}
      value={props.activeStore}
      options={options && options.map((a) => a.storeName)}
      onChange={({ target: { value } }) => {
        let selected = options.find((i) => i.storeName === value)
        props.selectStore(selected)
      }}
    />
  )
}

export default StoreSelection
