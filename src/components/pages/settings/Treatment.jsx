import { useCallback, useEffect, useState } from "react";
import { CardBody, CardHeader } from "reactstrap";
import { FaPlus } from "react-icons/fa";
import UnitTable from "./UnitTable";
import { useDispatch, useSelector } from "react-redux";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import CustomScrollbar from "@/common/Custom/CustomScrollBar";

export default function Treatment() {
  const _form = {
    unitName: "",
    measure: "",
    quantity: "",
  };
  const user = useSelector((state) => state.auth.user);

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
  };

  return (
    <CustomScrollbar>
      <CustomCard header="Setup treatment">
        {JSON.stringify(user)}
        <CardBody>
          <CardHeader>
            <CustomButton onClick={handleSubmit} loading={loading}>
              <FaPlus />
              Add Treatment
            </CustomButton>
          </CardHeader>
        </CardBody>

        <UnitTable data={data} />
      </CustomCard>
    </CustomScrollbar>
  );
}
