import React from "react";
import { Button } from "reactstrap";

function CustomButton(props) {
  return (
    <Button
      color="primary"
      onClick={props.handleSubmit}
      {...props}
      disabled={props.loading === "true" || props.disabled === "true"}
    >
      {props.loading === "true" && (
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
