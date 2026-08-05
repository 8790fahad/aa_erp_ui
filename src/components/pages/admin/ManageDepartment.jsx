import React, { useEffect, useState } from "react";
// import { Card, CardBody, CardHeader } from 'reactstrap'
import { FaSave } from "react-icons/fa";
import StoresTable from "./StoresTables";
import CustomForm from "@/common/Custom/CustomForm";
import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import { STORE_TYPES } from "@/constants";
import {
  getStoresList
} from "../../../redux/actions/stores"
import { useDispatch, useSelector } from "react-redux";
import { getUsers } from "@/redux/actions/users";
import { Button } from "reactstrap";

export default function ManageStores() {
  const dispatch = useDispatch();
  const [usersList, setUsersList] = useState([]);
  const storesList = useSelector((state) => state.stores.storeList);
  const [formMode, setFormMode] = useState("new");
  const formIsNew = formMode === "new";
  const [form, setForm] = useState({
    branch_name: "",
    admin: 0,
    phone: "",
    address: "",
    storeType: STORE_TYPES.POS,
  });

  const handleChange = ({ target: { name, value } }) => {
    if (name === "admin_name") {
      let selectedUser = usersList.find((a) => a.username === value);
      setForm((p) => ({
        ...p,
        admin: selectedUser.id,
        admin_name: selectedUser.username,
      }));
    } else {
      setForm((p) => ({
        ...p,
        [name]: value,
      }));
    }
  };

  const fields = [
    {
      label: "Store Name",
      name: "branch_name",
      required: true,
      value: form.branch_name,
      disabled: !formIsNew,
    },

    {
      label: "Phone Number (optional)",
      name: "phone",
      //   required: true,
      value: form.phone,
    },

    {
      label: "Warehouse",
      name: "address",
      required: true,
      value: form.address,
    },

    {
      label: "Store Type",
      type: "select",
      name: "storeType",
      //   required: true,
      options: Object.values(STORE_TYPES),
      value: form.storeType,
    },

    {
      label: "Managed by",
      type: "select",
      name: "admin_name",
      //   required: true,
      options: usersList.map((a) => a.username),
      value: form.admin_name,
    },
  ];

  const [loading, setLoading] = useState(false);
  const handleReset = () => {
    setForm((p) => ({
      ...p,
      branch_name: "",
      phone: "",
      admin: 0,
      address: "",
    }));
  };

  const handleSubmit = () => {
    if (form.branch_name === "" || form.storeType === "") {
      alert("Error", "Please complete the form");
    } else {
      setLoading(true);
      // dispatch(signup(form, goHome))
      // console.log(form)
      // Alert.alert('Successfully!')
      // console.log(form)
      form.query_type = formIsNew ? "insert" : "update";
      saveNewStore(form, () => {
        setLoading(false);
        handleReset();
        // navigation.navigate('BranchList')
        dispatch(getStoresList());
      });
    }
  };

  useEffect(() => {
    getUsers((list) => {
      //     if (list.length) {
      //       setForm((p) => ({
      //         ...p,
      //         admin: list[0].id,
      //         admin_name: list[0].username,
      //       }))
      //     }

      setUsersList(list);
    });
  }, []);

  const handleEdit = (store) => {
    setFormMode("update");
    setForm((p) => ({ ...p, ...store }));
  };

  const setFormIsNew = () => {
    setFormMode("new");
    handleReset();
  };

  return (
    <div>
      <CustomCard header="Manage Departments">
        {/* {JSON.stringify({usersList})} */}
        {!formIsNew && <Button onClick={setFormIsNew} close />}
        <CustomForm fields={fields} handleChange={handleChange} />
        <center className="my-2">
          <CustomButton
            className="col-md-3 d-flex justify-content-center align-items-center"
            onClick={handleSubmit}
            loading={loading}
          >
            <FaSave className="mr-2" />
            {formIsNew ? "Submit" : "Update"}
          </CustomButton>
        </center>

        <StoresTable onEdit={handleEdit} />
      </CustomCard>
    </div>
  );
}
