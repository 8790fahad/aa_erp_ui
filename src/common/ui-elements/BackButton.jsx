import React from "react";
import { ArrowLeft } from "react-feather";
import { useHistory } from "react-router";

function BackButton({ text = "Click to go back", size = "",className='' }) {
  const history = useHistory();

  return (
    <button
      className={`btn btn-primary btn-${size} ${className}`}
      onClick={() => history.goBack()}
    >
      <span className="d-flex flex-direction-row align-items-center">
        <ArrowLeft className="mr-1" size={20} />
        {text}
      </span>
    </button>
  );
}

export default BackButton;
