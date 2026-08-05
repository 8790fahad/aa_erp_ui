import { Alert } from 'reactstrap'

function EmptyList({ text = '', color = 'success' }) {
  return <Alert color={color} className='text-center'>{text}</Alert>
}

export default EmptyList
