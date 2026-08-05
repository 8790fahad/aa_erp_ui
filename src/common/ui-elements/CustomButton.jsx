import React from "react";
import { Button } from "reactstrap/lib/";

function CustomButton(props) {
  return (
    <Button
      {...props}
      disabled={props.loading || props.disabled}
      color={props.color || "primary"}
    >
      {props.loading && (
        <span
          className="spinner-border spinner-border-sm mr-2"
          role="status"
          aria-hidden="true"
        />
      )}
      {props.children}
    </Button>
  );
}

export default CustomButton;
