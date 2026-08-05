// import { Row, Col } from 'reactstrap'
import { formatNumber } from '@/utilities';
import { CURRENCY } from '@/constants';
import ActiveStoresList from '../ActiveStoresList';

function OtherOptions({
  items = [],
  total_selling_price = 0,
  setActiveStore = (f) => f,
  activeStore = '',
}) {
  return (
    <div className="row m-0 mb-1">
      <div className="col-md-4 p-0">
        <ActiveStoresList
          activeStore={activeStore}
          setActiveStore={setActiveStore}
        />
      </div>
      <div
        style={{
          marginLeft: 'auto',
          marginRight: 0,
          paddingRight: '20px',
        }}
      >
        <div style={{ fontSize: '12px', fontFamily: 'sans-serif' }}>
          Total No. of Items:{' '}
          <span style={{ textAlign: 'center', fontWeight: 'bold' }}>
            {items.length}
          </span>
        </div>
        {/* <div style={{ fontSize: '12px', fontFamily: 'sans-serif' }}>
                Total Cost:{' '}
                <span style={{ float: 'right', fontWeight: 'bold' }}>
                  {CURRENCY}
                  {formatNumber(totalAmount)}
                </span>
              </div> */}
        <div style={{ fontSize: '12px', fontFamily: 'sans-serif' }}>
          Total Selling Price:{' '}
          <span
            style={{
              float: 'right',
              fontWeight: 'bold',
              marginLeft: '4px',
            }}
          >
            {CURRENCY}
            {formatNumber(total_selling_price)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default OtherOptions
