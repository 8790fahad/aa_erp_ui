/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import React from "react";
import { useSelector } from "react-redux";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "reactstrap";

function CustomModal(props) {
  const { header, isOpen = false, toggle = (f) => f, footer } = props;
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  return (
    <Modal
      isOpen={isOpen}
      toggle={toggle}
      style={{
        borderWidth: 2,
        borderColor: activeBusiness?.primary_color,
      }}
      size={props.size || 'lg'}
    >
      {header && (
        <ModalHeader className="h6 py-1" toggle={toggle}>
          {header}
        </ModalHeader>
      )}
      <ModalBody>{props.children}</ModalBody>
      <ModalFooter>{footer}</ModalFooter>
    </Modal>
  );
}

export default CustomModal;
