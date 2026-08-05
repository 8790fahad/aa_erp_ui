import React, { useCallback, useEffect, useState } from 'react'
import { FaEdit } from 'react-icons/fa'
import { GiCancel } from 'react-icons/gi'
import { useDispatch, useSelector } from 'react-redux'

import { Alert, Button, Table } from 'reactstrap'
import {
  getStoresList } from "../../../redux/actions/stores"
import EmptyList from '@/common/Custom/EmptyList'
import Loading from '@/common/Custom/Loading'
import CustomTable1 from '@/common/Custom/CustomTable1'
import { custom } from 'zod'

export default function StoresTable({
  onEdit = (f) => f,
  onDelete = (f) => f,
}) {
  const dispatch = useDispatch()
  const storesList = useSelector((state) => state.stores.storeList)
  const [loading, setLoading] = useState(false)

  const getStores = useCallback(() => {
    setLoading(true)
    dispatch(
      getStoresList(
        () => setLoading(false),
        () => setLoading(false),
      ),
    )
  }, [dispatch])

  useEffect(() => {
    getStores()
    // pushStoresChanges(() => pullStoresChanges())
  }, [getStores])

  return (
    <>
      {loading && <Loading />}
      <CustomTable1
        data={storesList}
        fields={[
          {
            title: "Store Name",
         custom:true,
         component:(item)=>(
           <div className='text-center'>
             {item.branch_name}
           </div>
         ),
          },
          {
            title: "Warehouse",
            custom:true,
            component:(item)=>(
              <div className='text-center'>
                {item.address}
              </div>
            ),
          },
          {
            title: "Phone Number",
            custom:true,
            component:(item)=>(
              <div className='text-center'>
                {item.phone}
              </div>
            ),
          },
          {
            title: "Store Type",
            custom:true,
            component:(item)=>(
              <div className='text-center'>
                {item.store_type}
              </div>
            ),

          },
          {
            title: "Action",
            value: "action",
            custom:true,
            component:(item)=>(
              <div>
                <Button
                  color="success"
                  size="sm"
                  className="m-1 d-flex justify-content-center align-items-center"
                  onClick={() => onEdit(item)}
                >
                  <FaEdit size="20" /> Edit
                </Button>
                {/* <Button
                  color="danger"
                  className=' d-flex justify-content-center align-items-center'
                  size="sm"
                  disabled
                  onClick={() => onDelete(item)}
                >
                  <GiCancel size="20" /> Delete
                </Button> */}
              </div>
            )
          },
        ]}
        message="You have not created a store yet, get started with the form above"
      />
      {/* <Table bordered size="sm">
        <thead>
          <tr>
            <th>S/N</th>
            <th>Store</th>
            <th>Warehouse</th>
            <th>Phone Number</th>
            <th>Store Type</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {storesList.map((store, i) => (
            <tr key={i}>
              <td className='text-center'>{i + 1}</td>
              <td className='text-center'>{store.branch_name}</td>
              <td className='text-center'>{store.address}</td>
              <td className='text-center'>{store.phone}</td>
              <td className='text-center'>{store.store_type}</td>

              <td className="text-center">
                <div className='d-flex justify-content-center align-items-center'>
                <Button
                  color="success"
                  size="sm"
                  className="m-1 d-flex justify-content-center align-items-center"
                  onClick={() => onEdit(store)}
                >
                  <FaEdit size="20" /> Edit
                </Button>
                <Button
                  color="danger"
                  className=' d-flex justify-content-center align-items-center'
                  size="sm"
                  disabled
                  onClick={() => onDelete(store)}
                >
                  <GiCancel size="20" /> Delete
                </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table> */}

      {/* {!storesList.length && (
        <EmptyList text="You have not created a store yet, get started with the form above" />
      )} */}
    </>
  );
}
