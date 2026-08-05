import { useCallback, useEffect, useState } from "react";
import {  CardBody, CardHeader } from "reactstrap";

import { FaPlus } from "react-icons/fa";

import UnitTable from "./UnitTable";
import { useDispatch, useSelector } from "react-redux";
// import {
//   getUOM,
//   pullUOMChanges,
//   pushUOMChanges,
//   saveNewUOM,
// } from "../../redux/actions/uom";
// import CustomScrollbar from "../../components/CustomScrollbar";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import CustomScrollbar from "@/common/Custom/CustomScrollBar";
export default function UnitOfMeasure() {
  const _form = {
    unitName: "",
    measure: "",
    quantity: "",
  };

  const [form, setForm] = useState(_form);
  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({
      ...p,
      [name]: value,
    }));
  };

  const fields = [
    {
      label: "Unit Name",
      name: "unitName",
      required: true,
      value: form.unitName,
    },

    { label: "Measure", name: "measure", required: true, value: form.measure },

    {
      label: "Quantity In Unit",
      name: "quantity",
      required: true,
      value: form.quantity,
    },
  ];

  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const data = useSelector((d) => d.uom.uomList);

  const handleSubmit = () => {
    setLoading(true);
    // saveNewUOM(
    //   form,
    //   () => {
    //     setLoading(false);
    //     dispatch(getUOM());
    //     setForm(_form);
    //   },
    //   (err) => {
    //     setLoading(false);
    //     console.log(err);
    //   }
    // );
  };
  // const getUOMList = useCallback(() => {
  //   dispatch(getUOM());
  // }, [dispatch]);

  // useEffect(() => {
  //   getUOMList();
  //   pushUOMChanges(() => pullUOMChanges());
  // }, [getUOMList]);

  const user = useSelector((state) => state.auth.user);

  return (
    <CustomScrollbar>
      <CustomCard header="Unit of Measurement">
       
        <CardBody>
          {/* <CustomForm fields={fields} handleChange={handleChange} /> */}
          <CardHeader>
            <center>
              <CustomButton onClick={handleSubmit} loading={loading}>
                <FaPlus />
                Add New
              </CustomButton>
            </center>
          </CardHeader>
          {/* {JSON.stringify(user)} */}
        </CardBody>

        <UnitTable data={data} />
      </CustomCard>
    </CustomScrollbar>
  );
}
