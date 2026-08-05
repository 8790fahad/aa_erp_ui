/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import { Input } from '@/components/ui/input'
import { checkStrEmpty } from '@/utilities'
import React from 'react'
import { useSelector } from 'react-redux'
import {  Label, FormGroup } from 'reactstrap'

function TextInput(props) {
  const { label, required = false, className = null, container = null } = props
  const activeBusiness = useSelector((state) => state.auth.activeBusiness)

  return (
    <FormGroup className={container}>
      {!checkStrEmpty(label) && (
        <Label className="font-weight-bold">
          {label}
          {required && <span className="text-danger">*</span>}
        </Label>
      )}
      <Input
        className={`${className}`}
        {...props}
        style={{
          borderWidth: 2,
          borderColor: activeBusiness?.primary_color,
          ...props.style
        }}
      />
    </FormGroup>
  )
}

export default TextInput
