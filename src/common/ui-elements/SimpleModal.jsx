/* eslint react/no-multi-comp: 0, react/prop-types: 0 */

import React, { useState } from 'react';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter, Form } from 'reactstrap';

const SimpleModal = (props) => {
  const {
    buttonLabel,
    className
  } = props;
  const [modal, setModal] = useState(false);
  const [backdrop,] = useState(true);
  const [keyboard,] = useState(true);
  const toggle = () => setModal(!modal);

  return (
    <div>
      <Form inline onSubmit={(e) => e.preventDefault()}>
        <Button color="link" onClick={toggle}>{buttonLabel}</Button>
      </Form>
      <Modal isOpen={modal} toggle={toggle} className={className} backdrop={backdrop} keyboard={keyboard}>
        <ModalHeader toggle={toggle}>{props.title}</ModalHeader>
        <ModalBody style={{ fontSize: 16 }}>
          {props.children}
        </ModalBody>
        <ModalFooter>
          <Button color="warning" onClick={toggle}>Close</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

export default SimpleModal;