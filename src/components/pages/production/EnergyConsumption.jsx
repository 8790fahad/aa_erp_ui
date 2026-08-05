import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import moment from "moment";
import { toast } from "sonner";

// Components
import CustomButton from "@/common/Custom/CustomButton";
import CustomForm from "@/common/Custom/CustomForm";
import CustomCard from "@/common/Custom/CustomCard2";

// UI Elements
import { FaCartPlus, FaPlus } from "react-icons/fa";
import { FiDelete } from "react-icons/fi";
import { Row, Table, Button } from "reactstrap";
import { Form } from "react-bootstrap";

// Utils
import { _fetchApi, _postApi } from "@/redux/actions/api";

import { formatNumber1 } from "@/components/router/utilities";

const initialForm = {
  date: moment().format("YYYY-MM-DD"),
  shift: "",
  rate: 240,
  customer: "",
  type_of_goods: "",
  category: "",
  produced: 0,
};

const shiftOptions = [
  "All day",
  "Morning",
  "Night",
  "Overtime Morning",
  "Overtime Night",
];

export default function EnergyConsumption({
  formSetup = [],
  storeList = [],
  option = [],
}) {
  const navigate = useNavigate();
  const { user = {}, activeBusiness = {} } = useSelector((state) => state.auth);

  // State management
  const _formsetUp = formSetup.length ? formSetup[0] : {};
  const [form, setForm] = useState(initialForm);
  const [setUp, setSetup] = useState(_formsetUp);
  const [data, setData] = useState([]);
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [materialData, setMaterialData] = useState([]);
  const [teamSetup, setTeamSetup] = useState([]);
  const [operatorRate, setOperatorRate] = useState([]);
  const [loading, setLoading] = useState(false);

  // Derived values
  const formIsValid = form.date && form.shift;

  const totalProduced = data.reduce(
    (total, item) => total + Number(item.produced),
    0
  );
  const totalBangori = data.reduce(
    (total, item) => total + Number(item.bangori),
    0
  );
  const totalFilter = data.reduce(
    (total, item) => total + Number(item.filter),
    0
  );

  const availableQuantity = materialData
    .filter((item) => item.material_type === form.type_of_material)
    .reduce((total, item) => total + (Number(item.quantity) || 0), 0);

  // API calls
  const getUom = useCallback(() => {
    _fetchApi(
      `/inventory/get-category?facilityId=${activeBusiness.id}`,
      (data) => data.success && setUom(data.results),
      console.error
    );
  }, [activeBusiness.id]);

  const getMaterialData = useCallback(() => {
    _postApi(
      `/v1/materials/getByCustomerNo`,
      { customerNo: form?.customerNo },
      (res) => {
        if (res.success && res.results) setMaterialData(res.results);
        setLoading(false);
      },
      (err) => {
        toast.error("Error Occurred");
        console.error(err);
        setLoading(false);
      }
    );
  }, [form?.customerNo]);

  const getRateSetup = useCallback(() => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=operator_rate`,
      { facilityId: activeBusiness.id },
      (resp) => {
        resp.success
          ? setOperatorRate(resp.results)
          : toast.error("Failed to load list of items.");
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  }, [activeBusiness.id]);

  const getTeamSetup = useCallback(() => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=team_leader`,
      { facilityId: activeBusiness.id },
      (resp) => {
        resp.success
          ? setTeamSetup(resp.results)
          : toast.error("Failed to load list of items.");
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  }, [activeBusiness.id]);

  const getCategory = useCallback(() => {
    _fetchApi(
      `/inventory/get-category?facilityId=${activeBusiness.id}`,
      (data) => data.success && setCategories(data.results),
      console.error
    );
  }, [activeBusiness.id]);

  // Effects
  useEffect(() => {
    getMaterialData();
  }, [form?.customerNo, getMaterialData]);

  useEffect(() => {
    getUom();
    getRateSetup();
    getTeamSetup();
    getCategory();
  }, [activeBusiness.id, getUom, getRateSetup, getTeamSetup, getCategory]);

  useEffect(() => {
    const operator_fee = Number(form.produced) * Number(form.operator_rate);
    setForm((prev) => ({ ...prev, operator_fee }));
  }, [form.produced, form.operator_rate]);

  // Handlers
  const handleChange = ({ target: { name, value } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveItem = () => {
    const newItem = {
      ...form,
      team: category,
      customer: category,
      type_of_goods: category,
    };
    setData((prev) => [...prev, newItem]);
    setForm((prev) => ({
      ...initialForm,
      team: prev.team,
      shift: prev.shift,
      customerNo: prev.customerNo,
      customerName: prev.customerName,
    }));
    setCategory("");
  };

  const handleAdd = () => {
    formIsValid ? saveItem() : toast.success("Please complete the form");
  };

  const handleDelete = (index) => {
    setData((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    setLoading(true);
    _postApi(
      `/v1/materials/record-energy-consumption`,
      {
        data,
        query_type: "insert",
        user_id: user.id,
      },
      (res) => {
        if (res.success) {
          toast.success(`${res.message}`);
          navigate(-1);
        }
        setLoading(false);
      },
      (err) => {
        toast.error("Error Occurred");
        console.error(err);
        setLoading(false);
      }
    );
  };

  // Form fields configuration
  const fields = [
    {
      label: "Date",
      type: "date",
      name: "date",
      value: form.date,
      col: 3,
    },
    {
      label: "Energy",
      labelkey: "energy",
      name: "energy",
      type: "custom",
      component: () => (
        <>
          <label className="font-weight-bold mb-2">Energy</label>
          <select
            className="w-full form-select"
            required
            value={form.energy}
            onChange={(e) => {
              setForm({
                ...form,
                energy: e.target.value,
                energy_code: e.target.value,
              });
              setUnits(
                categories?.find((sup) => sup.category === e.target.value)
                  ?.units || []
              );
            }}
            style={{
              borderColor: activeBusiness.primary_color,
              borderWidth: 2,
            }}
          >
            <option value="">Select category</option>
            {categories?.map((sup) => (
              <option key={sup.category} value={sup.category}>
                {sup.category}
              </option>
            ))}
          </select>
        </>
      ),
      col: 3,
    },
    {
      label: "Unit",
      labelkey: "unit",
      name: "unit",
      type: "custom",
      component: () => (
        <>
          <label className="font-weight-bold mb-2">Unit</label>
          <select
            className="w-full form-select"
            required
            value={form.unit}
            onChange={(e) => {
              setForm({
                ...form,
                unit: e.target.value,
              });
            }}
            style={{
              borderColor: activeBusiness.primary_color,
              borderWidth: 2,
            }}
          >
            <option value="">Select rate</option>
            {units?.map((sup) => (
              <option key={sup} value={sup}>
                {sup}
              </option>
            ))}
          </select>
        </>
      ),
      col: 3,
    },
    {
      label: "Rate",
      name: "rate",
      value: form.rate,
      col: 3,
      type: "number",
      disabled: true,
    },
    {
      label: "Unit Consumed",
      name: "consumed",
      value: form.consumed,
      col: 3,
      type: "number",
    },
    {
      label: "shift",
      type: "custom",
      name: "shift",
      value: form.shift,
      col: 3,
      component: () => (
        <>
          <label className="font-weight-bold mb-2">Shift</label>
          <Form.Select
            name="shift"
            value={form.shift}
            onChange={handleChange}
            disabled={data.length > 0}
            style={{
              borderColor: activeBusiness.primary_color,
              borderWidth: 2,
            }}
          >
            <option value="">-- Select --</option>
            {shiftOptions.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </Form.Select>
        </>
      ),
    },
  ];

  return (
    <CustomCard back header="Energy Consumption">
      <Form>
        <Row>
          <CustomForm
            fields={fields}
            handleChange={handleChange}
            setState={setSetup}
            state={setUp}
          />
        </Row>

        <center>
          <CustomButton
            onClick={handleAdd}
            className="mb-2 px-4 d-flex align-items-center fw-bold"
          >
            <FaPlus className="mr-2" /> Add
          </CustomButton>
        </center>

        {data.length > 0 && (
          <>
            <Table size="sm" bordered>
              <thead>
                <tr>
                  <th className="text-center">#</th>
                  <th className="text-center">Date</th>
                  <th className="text-center">Energy</th>
                  <th className="text-center">Unit</th>
                  <th className="text-center">Rate</th>
                  <th className="text-center">Unit Consumed</th>
                  <th className="text-center"> Total Amount</th>
                  <th className="text-center">Shift</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="text-center">{item.date}</td>
                    <td className="text-left">{item.energy}</td>
                    <td className="text-left">{item.unit}</td>
                    <td className="text-right">{item.rate}</td>
                    <td className="text-right">{item.consumed}</td>
                    <td className="text-right">
                      {formatNumber1(item.consumed * item.rate)}
                    </td>
                    <td className="text-center">{item.shift}</td>
                    <td className="text-center">
                      <Button
                        size="sm"
                        onClick={() => handleDelete(i)}
                        className="btn btn-danger"
                      >
                        <FiDelete />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className="text-center">
              <CustomButton
                onClick={handleSubmit}
                loading={loading}
                className="px-5 d-flex align-items-center mx-auto"
              >
                <FaCartPlus className="mr-2" /> Submit
              </CustomButton>
            </div>
          </>
        )}
      </Form>
    </CustomCard>
  );
}
