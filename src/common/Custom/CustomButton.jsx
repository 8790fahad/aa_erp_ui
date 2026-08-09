/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import React from "react";
import { useSelector } from "react-redux";
import { Button } from "reactstrap";
// import { primaryColor } from '../../theme';

function CustomButton(props) {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const primary = activeBusiness?.primary_color || "#4267B2";
  const {
    className,
    handleSubmit,
    loading,
    disabled,
    mb,
    children,
    color,
    size,
    style,
    ...rest
  } = props;
  return (
    <Button
      color={color}
      style={{
        backgroundColor: primary,
        borderColor: primary,
        color: "#fff",
        ...style,
      }}
      className={`d-inline-flex align-items-center justify-content-center gap-2 whitespace-nowrap [&_svg]:shrink-0 ${mb ? `mb-${mb}` : "mb-2"} ${className || ""}`}
      onClick={handleSubmit}
      size={size}
      {...rest}
      disabled={loading || disabled}
    >
      {loading && (
        <span
          className="spinner-border spinner-border-sm mr-2"
          role="status"
          aria-hidden="true"
        />
      )}
      {children}
    </Button>
  );
}

export default CustomButton;

function CustomEyeButton(props) {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  return (
    <button
      color={props.color}
      style={{
        backgroundColor: activeBusiness?.primary_color,
        borderColor: activeBusiness?.primary_color,
      }}
      className={`${props.className} d-flex align-items-center rounded-r-lg bg-blue-600 text-white px-2.5 py-2.5`}
      onClick={props.handleSubmit}
      size={props.size}
      {...props}
      disabled={props.loading || props.disabled}
    >
      {props.loading && (
        <span
          className="spinner-border spinner-border-sm mr-2"
          role="status"
          aria-hidden="true"
        />
      )}
      {props.children}
    </button>
  );
}

export { CustomEyeButton };
