/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import CustomButton from "@/common/Custom/CustomButton";
import CustomForm from "@/common/Custom/CustomForm";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaCartPlus, FaPlus } from "react-icons/fa";
import { FiDelete } from "react-icons/fi";
import { Row, Table, Button } from "reactstrap";
import { Form } from "react-bootstrap";
import CustomCard from "@/common/Custom/CustomCard2";
import { Typeahead } from "react-bootstrap-typeahead";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import SearchCustomerInput from "../../customer/components/SearchCustomerInput";
import { Input } from "reactstrap/lib";
import moment from "moment";

import { useNavigate } from "react-router-dom";
import { formatNumber1 } from "@/components/router/utilities";
import { formatNumber } from "@/utilities";

const initialForm = {
  date: moment().format("YYYY-MM-DD"),
  team: "",
  shift: "",
  customer: "",
  type_of_goods: "",
  category: "",
  produced: 0,
  filter: 0,
  bangori: 0,
  operator_fee: 0,
  operator_rate: 0,
};

export default function Production({ formSetup = [] }) {
  const _formsetUp = formSetup.length ? formSetup[0] : {};
  const [form, setForm] = useState(initialForm);
  const [setUp, setSetup] = useState(_formsetUp);
  const [data, setData] = useState([]);
  const [category, setCategory] = useState("");
  const inputRef = useRef();
  const [materialData, setMaterialData] = useState([]);
  const [teamSetup, setTeamSetup] = useState([]);
  const [operatorRate, setOperatorRate] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saleData, setSaleData] = useState([]);
  const [payableData, setPayableData] = useState([]);
  const [rawMaterialData, setRawMaterialData] = useState([]);
  const [wagesPayable, setWagesPayable] = useState([]);
  const [factoryWages, setFactoryWages] = useState([]);
  const shiftOptions = [
    "Morning",
    "Night",
    "Overtime Morning",
    "Overtime Night",
  ];
  const { user = {}, activeBusiness = {} } = useSelector((state) => state.auth);
  const formIsValid =
    form.date &&
    form.shift &&
    form.name &&
    form.produced &&
    form.customerNo &&
    form.type_of_material;
  const navigate = useNavigate();

  const getMaterialData = useCallback(() => {
    _postApi(
      `/v1/materials/getByCustomerNo`,
      {
        customerNo: form?.customerNo,
      },
      (res) => {
        if (res.success && res.results) {
          setMaterialData(res.results);
        }
        setLoading(false);
      },
      (err) => {
        toast.error("Error Occurred");
        console.error(err);
        setLoading(false);
      }
    );
  }, [form?.customerNo]);

  useEffect(() => {
    getMaterialData();
  }, [form?.customerNo]);

  const getRateSetup = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=operator_rate`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setOperatorRate(resp.results);
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    getRateSetup();
  }, [activeBusiness.id]);

  const getWagesPayable = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=wages`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setWagesPayable(
            resp.results.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
            }))
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    getWagesPayable();
  }, [activeBusiness.id]);

  const getFactoryWages = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=factory`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setFactoryWages(
            resp.results.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
            }))
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    getFactoryWages();
  }, [activeBusiness.id]);

  const getTeamSetup = useCallback(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/api/get/team?facilityId=${activeBusiness.id}`,
      (data) => {
        if (data.success) {
          setTeamSetup(data.results);
          // alert(JSON.stringify(data.results))
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  }, [activeBusiness.id]);

  useEffect(() => {
    getTeamSetup();
  }, [activeBusiness.id]);

  const getRevenueItems = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=sales`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setSaleData(
            resp.results.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
            }))
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    getRevenueItems();
  }, [activeBusiness.id]);

  const getPayableData = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=payable`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setPayableData(
            resp.results.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
            }))
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    getPayableData();
  }, [activeBusiness.id]);

  const getRawMaterialData = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=raw_materials`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setRawMaterialData(
            resp.results.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
            }))
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    getRawMaterialData();
  }, [activeBusiness.id]);

  const handleChange = ({ target: { name, value } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveItem = () => {
    const operator_fee = Number(form.produced) * Number(form.operator_rate);
    const newItem = {
      ...form,
      team: category,
      customer: category,
      type_of_goods: category,
      operator_fee,
    };
    setData((prev) => [...prev, newItem]);
    setForm((prev) => ({
      ...form,
      // ...initialForm,
      team: prev.team,
      shift: prev.shift,
      customerNo: prev.customerNo,
      customerName: prev.customerName,
      subhead: prev.subhead,
      produced: 0,
      filter: 0,
      bangori: 0,
      operator_fee: 0,
    }));
    setCategory("");
  };

  const handleAdd = () => {
    if (formIsValid) {
      saveItem();
    } else {
      toast.success("Please complete the form");
    }
  };

  const handleDelete = (index) => {
    setData((prev) => prev.filter((_, i) => i !== index));
  };

  const totalProduced = data?.reduce(
    (total, item) => total + Number(item.produced),
    0
  );

  const totalBangori = data?.reduce(
    (total, item) => total + Number(item.bangori),
    0
  );

  const totalFilter = data?.reduce(
    (total, item) => total + Number(item.filter),
    0
  );

  const totalProduction = totalProduced;

  const rate = data?.reduce(
    (total, item) => total + Number(item.rate * totalProduction),
    0
  );

  const availableQuantity = materialData
    .filter((item) => item.material_type === form.type_of_material)
    .reduce((total, item) => total + (Number(item.quantity) || 0), 0);

  const totalOperatorFee = data?.reduce(
    (total, item) => total + Number(item.rate) * Number(item.produced),
    0
  );

  const receiptNo = new Date().getTime();

  const handleSubmit = () => {
    if (!form.customerNo || !form.customerName || !rate) {
      toast.error("Customer info and rate are required");
      return;
    }

    // alert("hello");

    setLoading(true);

    const receiptNo = moment().format("YYMDhms");

    const createEntry = (
      amount,
      account_description,
      account_head,
      account_subhead,
      query_type
    ) => ({
      amount,
      account_description,
      account_head,
      account_subhead,
      query_type,
      receiptNo,
    });

    // payable

    const payableEntries = payableData.map((item) =>
      createEntry(rate, item.name, item.code, item.chart_code, "tax")
    );

    // raw materials

    const rawMaterialEntries = rawMaterialData.map((item) =>
      createEntry(rate, item.name, item.code, item.chart_code, "net")
    );

    // factory wages

    const factoryWagesData = factoryWages.map((item) =>
      createEntry(
        totalOperatorFee,
        item.name,
        item.code,
        item.chart_code,
        "tax"
      )
    );

    //wages payable

    const wagesPayableData = wagesPayable.map((item) =>
      createEntry(
        totalOperatorFee,
        item.name,
        item.code,
        item.chart_code,
        "net"
      )
    );

    const dataEntries = {
      payableEntries,
      rawMaterialEntries,
      factoryWagesData,
      wagesPayableData,
      transaction_date: form.date,
    };

    const productionPayload = {
      ...form,
      data,
      totalProduced,
      totalBangori,
      totalFilter,
      totalOperatorFee,
      query_type: "insert",
      user_id: user.id,
      collection_id: materialData[0]?.collection_id,
      unit: materialData[0]?.unit,
    };

    const depositPayload = {
      query_type: "deposit",
      facilityId: activeBusiness.id,
      customer_no: form.customerNo,
      cr: rate,
      dr: 0,
      receiptNo: moment().format("YYMDhms"),
      description:
        form.remark ||
        `Cost for production of ${data
          .map((item) => item.type_of_material)
          .join(", ")} materials`,
      narration: "Production ",
      mode_of_payment: "CASH",
    };

    _postApi(
      `/v1/materials/recordProduction`,
      productionPayload,
      (res) => {
        if (res.success) {
          _postApi(`/customer-deposit`, depositPayload, (depositRes) => {
            if (!depositRes.success) {
              toast.error("Customer deposit failed");
              setLoading(false);
              return;
            }

            toast.success("Production recorded successfully");
            navigate(
              `/app/production/production-invoice?customerName=${form.customerName}&customer_id=${form.customerNo}&receiptNo=${res.production_id}`
            );
            setLoading(false);

            // _postApi(
            //   `/v1/materials/insertCollectionProductionLedger`,
            //   dataEntries,
            //   (ledgerRes) => {
            //     if (ledgerRes.success) {
            //       toast.success("Production recorded successfully");
            //       navigate(
            //         `/app/production/production-invoice?customerName=${form.customerName}&customer_id=${form.customerNo}&receiptNo=${res.production_id}`
            //       );
            //     } else {
            //       toast.error("Ledger entry failed");
            //     }
            //     setLoading(false);
            //   },
            //   (ledgerErr) => {
            //     toast.error("Error in ledger entry");
            //     console.error(ledgerErr);
            //     setLoading(false);
            //   }
            // );
          });
        } else {
          toast.error("Failed to record production");
          setLoading(false);
        }
      },
      (err) => {
        toast.error("Error recording production");
        console.error(err);
        setLoading(false);
      }
    );
  };

  useEffect(() => {
    const operator_fee = Number(form.produced) * Number(form.operator_rate);
    setForm((prev) => ({ ...prev, operator_fee }));
  }, [form.produced, form.operator_rate]);

  const handleMaterialChange = ({ target: { value } }) => {
    const rate = materialData.find(
      (item) => item.material_type === value
    )?.rate;
    setForm((prev) => ({ ...prev, type_of_material: value, rate }));
  };

  const fields = [
    {
      label: "Date",
      type: "date",
      name: "date",
      value: form.date,
      col: 3,
      //   switch: setupCond,
    },
    {
      label: "Team",
      labelkey: "team",
      name: "team",
      type: "custom",
      component: () => (
        <>
          <label className="font-weight-bold mb-2">Team</label>
          <Typeahead
            id="material-typeahead"
            ref={inputRef}
            options={teamSetup}
            className="z-100 "
            placeholder="Select Team..."
            onChange={(selected) =>
              setForm((prev) => ({
                ...prev,
                ...selected[0],
                name: selected[0]?.teamName || "",
                team_id: selected[0]?.team_id || "",
              }))
            }
            labelKey={(option) => `${option.teamName} - (${option.team_id})`}
          />
        </>
      ),
      col: 3,
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
            // style={{
            //   borderColor: activeBusiness.primary_color,
            //   borderWidth: 2,
            // }}
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
      //   switch: setupCond,
    },
    {
      label: "Customer",
      name: "customer",
      type: "custom",
      component: () => (
        <>
          <label className="font-weight-bold mb-2">Customer</label>
          <SearchCustomerInput
            // color={activeBusiness.primary_color}
            borderWidth={1}
            label="Select Customer"
            onChange={(selectedItems) => {
              if (data.length === 0) {
                if (selectedItems.length > 0) {
                  const { customerNo, fullname } = selectedItems[0];
                  setForm((prevForm) => ({
                    ...prevForm,
                    customerNo,
                    customerName: fullname,
                    subhead: selectedItems[0]?.subhead,
                  }));
                } else {
                  setForm((prevForm) => ({
                    ...prevForm,
                    customerNo: "",
                    customerName: "",
                  }));
                }
              }
            }}
            disabled={data.length > 0}
          />
        </>
      ),
      col: 3,
    },
    {
      label: "Type of goods",
      labelkey: "type_of_goods",
      name: "type_of_goods",
      type: "custom",
      component: () => {
        // Create a Set to track unique material types
        const seen = new Set();
        const uniqueMaterials = materialData.filter((item) => {
          if (seen.has(item.material_type)) return false;
          seen.add(item.material_type);
          return true;
        });

        return (
          <>
            <label className="font-weight-bold">Type of Goods</label>
            <Input
              type="select"
              onChange={handleMaterialChange}
              name="type_of_material"
              value={form.type_of_material}
              className="form-select"
              // style={{
              //   borderColor: activeBusiness.primary_color,
              //   borderWidth: 2,
              // }}
            >
              <option value="">Select Type of Material</option>
              {uniqueMaterials.map((category) => (
                <option key={category.id} value={category.material_type}>
                  {category.material_type}
                </option>
              ))}
            </Input>
          </>
        );
      },
      col: 3,
    },
    {
      label: "Qty Available",
      name: "available",
      col: 3,
      type: "custom",
      component: () => (
        <>
          <div className="w-full h-full d-flex items-center mt-2">
            <b className="mr-2">Qty Available:</b>
            <p className="mt-3">{formatNumber(availableQuantity)}</p>
          </div>
        </>
      ),
    },
    {
      label: "Qty Available",
      name: "available",
      col: 3,
      type: "custom",
      component: () => (
        <>
          <div className="w-full= h-full d-flex items-center mt-2">
            <b className="mr-2">Unit:</b>
            <p className="mt-3">{materialData[0]?.unit}</p>
          </div>
        </>
      ),
    },
    {
      label: "operator_rate",
      name: "operator_rate",
      col: 3,
      type: "custom",
      component: () => (
        <>
          <label className="font-weight-bold">Operator Rate </label>
          {/* <Input
            type="number"
            name="operator_rate"
            value={form.operator_rate}
            onChange={handleChange}
            className="form-control"
            disabled
            style={{
              borderColor: activeBusiness.primary_color,
              borderWidth: 2,
            }}
          /> */}
          <select
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                operator_rate: e.target.value,
              }))
            }
            name="rate"
            value={form.operator_rate}
            className="form-select"
            // style={{
            //   borderColor: activeBusiness.primary_color,
            //   borderWidth: 2,
            // }}
          >
            <option value="">Select Rate</option>
            {operatorRate.map((rate) => (
              <option key={rate.amount} value={rate.amount}>
                {rate.rate} - {rate.amount}
              </option>
            ))}
          </select>
        </>
      ),
    },
    {
      label: "Qty Produced",
      name: "produced",
      value: form.produced,
      col: 3,
      type: "number",
    },
    {
      label: "Qty Filter",
      name: "filter",
      value: form.filter,
      col: 3,
      type: "number",
    },
    {
      label: "Bangori Qty",
      name: "bangori",
      value: form.bangori,
      col: 3,
      type: "number",
    },
    {
      label: "Operator Fee",
      name: "operator_fee",
      value: form.operator_fee,
      col: 3,
      type: "number",
      disabled: true,
    },
  ];

  return (
    <CustomCard back header="Record Production">
      {/* {JSON.stringify(totalOperatorFee)} */}
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
          <Table size="sm">
            <thead>
              <tr>
                <th className="text-center">#</th>
                <th className="text-center">Date</th>
                <th className="text-center">Team</th>
                <th className="text-center">Shift</th>
                <th className="text-center">Customer</th>
                <th className="text-center">Goods</th>
                <th className="text-center">Rate</th>
                <th className="text-center">Produced</th>
                <th className="text-center">Filter</th>
                <th className="text-center">Bangori</th>
                <th className="text-center">Amount</th>

                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr key={i}>
                  <td className="text-center">{i + 1}</td>
                  <td className="text-center">{item.date}</td>
                  <td className="text-left">{item.name}</td>
                  <td className="text-left">{item.shift}</td>
                  <td className="text-left">{item.customerName}</td>
                  <td className="text-center">{item.type_of_material}</td>
                  <td className="text-center">{item.rate}</td>
                  <td className="text-center">{item.produced}</td>
                  <td className="text-center">{item.filter}</td>
                  <td className="text-center">{item.bangori}</td>
                  <td className="text-center">
                    {formatNumber1(item.rate * item.produced)}
                  </td>

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
        )}
        {data.length > 0 && (
          <div className="text-center">
            <CustomButton
              onClick={handleSubmit}
              loading={loading}
              className="px-5 d-flex align-items-center mx-auto"
            >
              <FaCartPlus className="mr-2" /> Submit
            </CustomButton>
          </div>
        )}
      </Form>
    </CustomCard>
  );
}
