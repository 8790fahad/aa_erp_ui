/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import React from "react";
import { Button } from "reactstrap";

function CustomButton(props) {
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
        backgroundColor: "var(--aa-navy)",
        borderColor: "var(--aa-navy)",
        color: "#fff",
        ...style,
      }}
      className={`aa-btn-primary d-inline-flex align-items-center justify-content-center gap-2 whitespace-nowrap [&_svg]:shrink-0 ${mb ? `mb-${mb}` : "mb-2"} ${className || ""}`}
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
  return (
    <button
      color={props.color}
      style={{
        backgroundColor: "var(--aa-navy)",
        borderColor: "var(--aa-navy)",
      }}
      className={`${props.className} d-flex align-items-center rounded-r-lg bg-[var(--aa-navy)] text-white px-2.5 py-2.5`}
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
