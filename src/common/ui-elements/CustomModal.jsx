import React from "react";
import { Button, Modal } from "reactstrap";

function CustomModal(props) {
  const {
    toggle = (f) => f,
    isOpen = false,
    title = "",
    message = "",
    color = "primary",
  } = props;
  return (
    <Modal.Dialog
      className="modal-dialog-centered modal-primary"
      contentClassName="bg-gradient-primary"
      isOpen={isOpen}
      toggle={toggle}
    >
      <div className="modal-header">
        <h6 className="modal-title" id="modal-title-notification">
          {title}
        </h6>
        <button
          aria-label="Close"
          className="close"
          data-dismiss="modal"
          type="button"
          onClick={toggle}
        >
          <span aria-hidden={true}>×</span>
        </button>
      </div>
      <div className="modal-body">
        <div className="py-3 text-center">
          <i className="ni ni-check-bold ni-3x" color={color} />
          <h4 className="heading mt-4">{message}</h4>
        </div>
        {props.children}
      </div>
      <div className="modal-footer">
        <Button
          className="text-white"
          color="link"
          data-dismiss="modal"
          type="button"
          onClick={toggle}
        >
          Close
        </Button>
        <Button className="btn-white ml-auto" color="default" type="button">
          Proceed to proposal
        </Button>
      </div>
    </Modal.Dialog>
  );
}

export default CustomModal;
