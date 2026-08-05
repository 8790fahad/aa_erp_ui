/* eslint-disable react/no-unescaped-entities */
/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import { useCallback, useEffect, useState } from "react";
import { FormGroup, Form, Col, Row, Label, CardBody, Input } from "reactstrap";
import { MdCheck } from "react-icons/md";
import { useSelector, useDispatch } from "react-redux";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { _fetchApi, _postApi } from "@/redux/actions/api";

import { getStoresList } from "@/redux/actions/stores";
import CustomCard from "@/common/Custom/CustomCard";
import CustomButton from "@/common/Custom/CustomButton";
import { getSidebarByAppType } from "./sidebars/sidebarModules";
import { toast } from "sonner";

export default function User({ user }) {
  const [loading, setLoading] = useState(false);
  // const [multiSelections, setMultiSelections] = useState([]);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const dispatch = useDispatch();
  const history = useNavigate();

  const [form, setForm] = useState({
    roles: [
      "Admin",
      "Customers",
      "Inventory",
      "Administration",
      "Management",
      "Supplier",
      "Purchases",
      "Make Sales",
      "Expenses",
      "Transfer",
      "Pending Sales",
      "Reports",
      "Settings",
      "Custom Sales",
    ],
    firstname: user?.firstname || "",
    lastname: user?.lastname || "",
    email: user?.email || "",
    phone: user?.phone || "",
    role: user?.role || "",
    store: user?.store || "",
    branch_name: user?.branch_name || "",
    password: "",
    query_type: "update",
    checked: user?.accessTo?.split(",") || [],
    functionalities: user?.functionalities?.split(",") || [],
  });

  const options = useSelector((state) => state.stores.storeList);
  const [showPass, setShowPass] = useState(false);

  const showPassword = () => setShowPass((p) => !p);

  const handleChange = ({ target: { name, value } }) => {
    setForm({
      ...form,
      error: "",
      [name]: value,
    });
  };

  const handleTypeaheadChange = (val) => {
    if (val) {
      setForm((p) => ({
        ...p,
        branch_name: val.storeName,
      }));
    }
  };

  const syncRoles = useCallback(() => {
    _fetchApi(
      `/api/v1/get-users-by-facility/${activeBusiness.id}`,
      (data) => {
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        console.error(err);
      }
    );
  }, [activeBusiness.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    const submissionData = {
      ...form,
      id: user?.id,
      accessTo: (form.checked || []).toString(),
      functionalities: (form.functionalities || []).toString(),
    };

    _postApi(
      `/api/auth/update/${submissionData.id}`,
      submissionData,
      (resp) => {
        setLoading(false);

        toast.success(resp.message);
        history("/app/admin/manage-user");
      },
      (err) => {
        setLoading(false);
        console.error("err", err);
        toast.error("An error occurred while updating!");
      }
    );
  };

  useEffect(() => {
    dispatch(getStoresList());
    syncRoles();
  }, [dispatch, syncRoles]);

  const sidebarItems = getSidebarByAppType(activeBusiness.business_type);
  return (
    <CustomCard back header="Manage your users">
      {/* {JSON.stringify(user)} */}
      {/* {JSON.stringify(modules)} */}
      <Col>
        {/* <CustomButton
          onClick={() =>
            history("/app/admin/manage-users/new-user?type=new_user")
          }
        >
          <FaPlus className="mr-2" />
          Create New User
        </CustomButton> */}
        <br />
      </Col>
      <CardBody>
        <Form onSubmit={handleSubmit}>
          <FormGroup row>
            <div className="col-md-4 col-lg-4">
              <label>Firstname</label>
              <input
                className="form-control"
                type="text"
                name="firstname"
                value={form.firstname}
                onChange={handleChange}
              />
            </div>
            <div className="col-md-4 col-lg-4">
              <label>Lastname</label>
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
              <label>Phone No.</label>
              <input
                className="form-control"
                type="text"
                name="phone"
                value={form.phone}
                onChange={handleChange}
              />
            </div>
            {/* <div className="col-md-4 col-lg-4">
              <label>Password</label>
              <div className="input-group !items-center">
                <input
                  type={showPass ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  className="form-control"
                />
                <div className="input-group-append">
                  <CustomEyeButton onClick={showPassword}>
                    {showPass ? <BiShow /> : <BsEyeSlashFill />}
                  </CustomEyeButton>
                </div>
              </div>
            </div> */}

            <div className="col-md-4 col-lg-4">
              <label>Role</label>
              <Input
                onChange={handleChange}
                name="role"
                type="select"
                value={form.role}
              >
                {[
                  "Admin",
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
            </div>
            {/* <div className="col-md-4 col-lg-4">
              <CustomTypeahead
                label="Default store"
                options={options}
                labelKey="storeName"
                inline={true}
                noBorder={true}
                onChange={(val) => {
                  if (val) handleTypeaheadChange(val[0]);
                }}
                defaultInputValue={options[0]?.storeName || ""}
              />
            </div>
            <div className="col-md-4 col-lg-4">
              <Label className="mb-0">Assign Store</Label>
              <Typeahead
                id="basic-typeahead-multiple"
                labelKey="branch_name"
                multiple
                onChange={(e) => {
                  setMultiSelections(e);
                  setForm((prev) => ({
                    ...prev,
                    store:
                      prev.store?.length > 0 && e?.[0]?.storeName !== prev.store
                        ? `${prev.store},${e[0].storeName}`
                        : e[0].storeName,
                  }));
                }}
                options={options}
                selected={multiSelections}
                placeholder="Choose several stores..."
                clearButton
              />
            </div> */}
          </FormGroup>

          <FormGroup className="mt-5">
            <h4 className="text-center font-bold">Edit (User's Privilege)</h4>
            <Row className="border-1 py-3 mx-0 rounded">
              {sidebarItems?.map((module) => (
                <Col md="4" key={module.title}>
                  <FormGroup switch>
                    <Label check>
                      <Input
                        type="switch"
                        checked={(form.checked || []).includes(module.title)}
                        onChange={({ target: { checked } }) => {
                          setForm((prev) => {
                            const updatedChecked = checked
                              ? [...(prev.checked || []), module.title]
                              : (prev.checked || []).filter(
                                  (title) => title !== module.title
                                );

                            let updatedFunctionalities =
                              prev.functionalities || [];

                            if (checked) {
                              const firstSub = module.items?.[0]?.title;
                              if (firstSub) {
                                updatedFunctionalities = [
                                  ...new Set([
                                    ...updatedFunctionalities,
                                    firstSub,
                                  ]),
                                ];
                              }
                            } else {
                              updatedFunctionalities =
                                updatedFunctionalities.filter(
                                  (func) =>
                                    !(
                                      module.items?.map((item) => item.title) ||
                                      []
                                    ).includes(func)
                                );
                            }

                            return {
                              ...prev,
                              checked: updatedChecked,
                              functionalities: updatedFunctionalities,
                            };
                          });
                        }}
                      />{" "}
                      <b>{module.title}</b>
                    </Label>
                  </FormGroup>

                  {(form.checked || []).includes(module.title) &&
                    module.items?.length > 0 && (
                      <div className="pl-4">
                        {module.items.map((item) => (
                          <FormGroup switch key={item.title}>
                            <Label check>
                              <Input
                                type="switch"
                                checked={(form.functionalities || []).includes(
                                  item.title
                                )}
                                onChange={({ target: { checked } }) => {
                                  setForm((prev) => {
                                    const updatedFunctionalities = checked
                                      ? [
                                          ...new Set([
                                            ...(prev.functionalities || []),
                                            item.title,
                                          ]),
                                        ]
                                      : (prev.functionalities || []).filter(
                                          (func) => func !== item.title
                                        );

                                    return {
                                      ...prev,
                                      functionalities: updatedFunctionalities,
                                    };
                                  });
                                }}
                              />{" "}
                              {item.title}
                            </Label>
                          </FormGroup>
                        ))}
                      </div>
                    )}
                </Col>
              ))}
            </Row>
          </FormGroup>

          <Row>
            <Col md={12} className="text-center">
              <CustomButton color="success" size="sm" loading={loading}>
                <MdCheck size={20} fontWeight="bold" />
                Save changes
              </CustomButton>
            </Col>
          </Row>
        </Form>
      </CardBody>
    </CustomCard>
  );
}
