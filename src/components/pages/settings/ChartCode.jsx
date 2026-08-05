import { useCallback, useEffect, useState } from "react";
import { CardBody, CardHeader } from "reactstrap";
import { FaPlus } from "react-icons/fa";
import UnitTable from "./UnitTable";
import { useDispatch, useSelector } from "react-redux";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import CustomScrollbar from "@/common/Custom/CustomScrollBar";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";
import { unflatten } from "@/utilities";

export default function ChartCodeSetup() {
  const _form = {
    chart_description: "",
    chart_code: "",
  };
  const [form, setForm] = useState(_form);
  const [chart, setChart] = useState([]);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({
      ...p,
      [name]: value,
    }));
  };

  const getACCt = () => {
    if (!activeBusiness?.business_name) return;

    _postApi(
      `/account/chart-of-account?query_type=select`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          setChart(unflatten(resp.results));
        } else {
          toast.error("Failed to load chart data.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    getACCt();
  }, []);

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
  const [loading, setLoading] = useState(false);
  const data = useSelector((d) => d.uom.uomList);

  const handleSubmit = () => {
    setLoading(true);
  };

  return (
    <CustomScrollbar>
      <CustomCard header="Chart code setup">
        {JSON.stringify(chart)}
        <CardBody>
          <CardHeader>
            <CustomButton onClick={handleSubmit} loading={loading}>
              <FaPlus />
              Setup chart code
            </CustomButton>
          </CardHeader>
        </CardBody>

        <UnitTable data={data} />
      </CustomCard>
    </CustomScrollbar>
  );
}
