function CustomScrollbar(props) {
  const { height = '75vh' } = props
  return (
    <div style={{ overflow: 'scroll' }} {...props}>
      {props.children}
    </div>
  )
}

export default CustomScrollbar
