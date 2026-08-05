import store from '../store'
import { _fetchApi } from './api'

export const getUsers = (callback = (f) => f, error = (f) => f) => {
  const facilityId = store.getState().auth.activeBusiness.id

  _fetchApi(
    `/api/v1/get-users-by-facility/${facilityId}`,
    (data) => {
      if (data.success) {
        callback(data.results)
      }
    },
    (err) => {
      console.log(err)
      error(err)
    },
  )
}
