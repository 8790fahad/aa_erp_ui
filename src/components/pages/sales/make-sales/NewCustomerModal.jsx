import CustomButton from "@/common/Custom/CustomButton";
import CustomModal from "@/common/Custom/CustomModal";
import React, { useState } from "react";


function NewCustomerModal({
  isOpen = false,
  toggle = (f) => f,
  onSkipClicked = (f) => f,
  onSubmit = (f) => f,loading
}) {
  const [form, setForm] = useState({customerName:''});
  const handleFormChange = ({ target: { name, value } }) =>
    setForm((p) => ({ ...p, [name]: value }));

  return (
    <CustomModal
      isOpen={isOpen}
      toggle={toggle}
      header='Customer Details'
      footer={
        <>
          <CustomButton color='success' onClick={onSkipClicked}>
            Skip
          </CustomButton>
          <CustomButton onClick={() => onSubmit(form)} loading={loading} disabled={form.customerName ==="" ? true : false}>Submit</CustomButton>
        </>
      }
    >
      {/* <CustomerForm
        form={form}
        handleFormChange={handleFormChange}
        showDeposit={false}
      /> */}
    </CustomModal>
  );
}
export default NewCustomerModal;
