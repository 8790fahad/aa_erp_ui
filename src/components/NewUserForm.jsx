/* eslint-disable react/no-unescaped-entities */
/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import { Col, FormGroup, Input, Label, Row } from "reactstrap";
import { useDispatch, useSelector } from "react-redux";
import { Typeahead } from "react-bootstrap-typeahead";
import { BsEyeSlashFill } from "react-icons/bs";
import { BiShow } from "react-icons/bi";
import { getStoresList } from "@/redux/actions/stores";
import CustomButton, { CustomEyeButton } from "@/common/Custom/CustomButton";
import CustomTypeahead from "@/common/Custom/Customtypeahead";

function NewUserForm({
  handleChange,
  handleCheckboxChange,
  handleChildChechBoxChange,
  email,
  // username,
  handleTypeaheadChange,
  form,
  phone,
  fullname,
  password,
  role,
  accessTo,
  multiSelections,
  setMultiSelections,
  accessData,
}) {
  const dispatch = useDispatch();
  const options = useSelector((state) => state.stores.storeList);

  useEffect(() => {
    dispatch(getStoresList());
  }, [dispatch]);

  const [showPass, setShowPass] = useState(false);
  const showPassword = () => {
    setShowPass((prev) => !prev);
  };

  return (
    <>
      <FormGroup row>
        <div className="col-md-4 col-lg-4">
          <label>First Name</label>
          <input
            className="form-control"
            type="text"
            name="firstname"
            value={form.firstname}
            onChange={handleChange}
          />
        </div>
        <div className="col-md-4 col-lg-4">
          <label>Last Name</label>
          <input
            className="form-control"
            type="text"
            name="lastname"
            value={form.lastname}
            onChange={handleChange}
          />
        </div>
        <div className="col-md-4 col-lg-4">
          <label>Email</label>
          <input
            className="form-control"
            type="text"
            name="email"
            value={form.email}
            onChange={handleChange}
          />
        </div>
        <div className="col-md-4 col-lg-4">
          <label>Email</label>
          <input
            className="form-control"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
          />
        </div>
        <div className="col-md-4 col-lg-4">
          <label>Phone No.</label>
          <input
            className="form-control"
            type="phone"
            name="phone"
            value={phone}
            onChange={handleChange}
          />
        </div>
        <div className="col-md-4 col-lg-4">
          <label>Password</label>
          <div className="input-group !items-center">
            <input
              type={!showPass ? "password" : "text"}
              name="password"
              value={password}
              onChange={handleChange}
              className="form-control"
            />
            <div className="input-group-append">
              <CustomEyeButton onClick={showPassword}>
                {showPass ? <BiShow /> : <BsEyeSlashFill />}
              </CustomEyeButton>
            </div>
          </div>
        </div>

        {/* <FormGroup row> */}

        <div className="col-md-4 col-lg-4">
          <label>Role</label>
          <Input
            onChange={handleChange}
            name="role"
            type="select"
            list="role"
            value={role}
            className="form-control"
          >
            {[
              "Store Owner",
              "Receptionist",
              "Sales Agent",
              "Store Keeper",
              "operator",
              "Accountant",
            ].map((role, i) => (
              <option key={i}>{role}</option>
            ))}
          </Input>
          <datalist id="role">
            <option value="Business Owner" />
            <option value="Receptionist" />
            <option value="Sales Agent" />
            <option value="Store Keeper" />
            <option value="Accountant" />
            <option value="Admin" />
          </datalist>
        </div>
        {/* <div className="col-md-4 col-lg-4">
          <CustomTypeahead
            label="Default store"
            options={options}
            labelKey="storeName"
            inline={true}
            noBorder={true}
            onChange={(val) => {
              if (val) {
                handleTypeaheadChange(val[0]);
              }
            }}
          />
        </div>
        <div className="col-md-4 col-lg-4">
          <Label>Assign Store</Label>
          <Typeahead
            id="basic-typeahead-multiple"
            labelKey="branch_name"
            multiple
            onChange={setMultiSelections}
            options={options}
            placeholder="Choose several store..."
            selected={multiSelections}
          />
        </div> */}
      </FormGroup>

      <FormGroup className="mt-4">
        <h4 className="text-center font-bold">Access (User's Privilege)</h4>
        <Row className="border-1 py-3 mx-0 rounded">
          {/* {JSON.stringify(accessData.navMain)} */}
          {accessData?.map((item, index) => (
            <Col md="4" key={index}>
              <div className="form-check form-switch">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={form.accessTo?.includes(item.title)}
                  onChange={() => handleCheckboxChange(item)}
                  id={`mainSwitch-${index}`}
                />
                <label
                  className="form-check-label"
                  htmlFor={`mainSwitch-${index}`}
                >
                  <b>{item.title}</b>
                </label>
              </div>

              {form.accessTo.includes(item.title) &&
                item.items &&
                item.items.length > 0 && (
                  <div style={{ marginLeft: 20 }}>
                    {item.items.map((subItem, subIndex) => (
                      <div className="form-check form-switch" key={subIndex}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={form.functionalities?.includes(
                            subItem.title
                          )}
                          onChange={() => handleChildChechBoxChange(subItem)}
                          id={`subSwitch-${index}-${subIndex}`}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`subSwitch-${index}-${subIndex}`}
                        >
                          {subItem.title}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
            </Col>
          ))}
        </Row>
      </FormGroup>
    </>
  );
}

export default NewUserForm;
