import { Table } from '@/components/ui/table'
import CustomScrollbar from '@/common/Custom/CustomScrollBar'

function List({ activeStore, rows }) {
  return (
    <CustomScrollbar height="68vh">
      <Table bordered size='sm'>
        <thead>
          <tr>
            <th>S/N</th>
            <th>Item name </th>
            <th>Supplier</th>
            <th>Qty Available</th>
            <th>Selling price (₦)</th>
            <th>Expiry date</th>
            {activeStore==='Show All Stores' ? <th>Store</th> : null}
            <th>Action</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </Table>
    </CustomScrollbar>
  )
}

export default List
