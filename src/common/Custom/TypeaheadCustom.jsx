/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React from 'react'
import { Typeahead } from 'react-bootstrap-typeahead'

function TypeaheadCustom(props) {
  const {
    label,
    labelKey = '',
    options = [],
    _ref = null,
    inline = false,
    fixed = false,
    flip = false,
  } = props

  return (
    <div >
      {label && <label className={inline ? 'col-md-2 m-0 p-0 font-weight-bold mb-1' : ''}>{label}</label>}

      <Typeahead
        // clearButton
        id={`${labelKey}-${new Date()}`}
        ref={_ref}
        options={options}
        labelKey={labelKey}
        selected={props.selected || []}
        positionFixed={fixed}
        flip={flip}
        // clearButton
        {...props}
      />
    </div>
  )
}

export default TypeaheadCustom
