import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

import { useNavigate } from "react-router-dom";
import { Row } from "reactstrap";
import CustomForm from "@/common/Custom/CustomForm";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import useQuery from "@/hooks/useQuery";
import { saveNewSupplier } from "@/redux/actions/suppliers";
import { saveNewCustomer } from "@/redux/actions/customer";
import { toast } from "sonner";

export default function CustomerEdit() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  const query = useQuery();

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullname: "",
    email: "",
    phone: "",
    address: "",
    website: "",
  });

  const customer_id = query.get("customer_id");

  const facilityId = useSelector((state) => state.auth.activeBusiness.id);

  useEffect(() => {
    if (!customer_id) {
      alert("Customer ID is required");
      return;
    }

    _fetchApi(
      `/get-customer-by-id?facilityId=${facilityId}&customer_id=${customer_id}`,
      (res) => {
        setForm((p) => ({
          ...p,
        }));
        if (res.customer) {
          let data = res.customer[0];

          setForm(data);
        }
      },
      (err) => {
        console.error(err);
      }
    );
  }, [customer_id, facilityId]);

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({
      ...p,
      [name]: value,
      ...(name === "customer_type" && value === "walk-in"
        ? { credit_limit: 0 }
        : {}),
    }));
  };

  const fields = [
    {
      label: "Customer Name",
      name: "fullname",
      required: true,
      value: form.fullname,
    },
    {
      label: "Customer Address",
      name: "address",
      required: false,
      value: form.address,
    },
    {
      label: "Phone Number",
      name: "phone",
      required: false,
      type: "number",
      value: form.phone,
    },
    {
      label: "Email",
      name: "email",
      required: false,
      value: form.email,
    },
    // {
    //   label: "Credit Limit",
    //   name: "credit_limit",
    //   required: false,
    //   placeholder: "10000",
    //   value: form.credit_limit,
    //   type: "number",
    // },
    {
      label: "Customer Type",
      name: "customer_type",
      required: false,
      value: form.customer_type,
      type: "custom",
      component: () => (
        <>
          <label>Customer Type</label>
          <select
            label="Customer Type"
            className="form-select border-2 p-1.5 mt-2"
            style={{
              borderColor: activeBusiness?.primary_color || "currentColor",
            }}
            name="customer_type"
            value={form.customer_type}
            onChange={handleChange}
          >
            <option value="customer">Customer</option>
            <option value="walk-in">Walk-in</option>
            <option value="partners">Partners</option>
            <option value="directors">Directors</option>
          </select>
        </>
      ),
    },
  ];

  const success_callback = () => {
    setLoading(false);
    navigate("/app/customers");
  };

  const handleSubmit = () => {
    setLoading(true);

    let obj = {
      ...form,
      query_type: "update",
      customer_type:
        form.customer_type === "walk-in" ? "walk-in" : form.customer_type || "customer",
      credit_limit:
        form.customer_type === "walk-in" ? 0 : form.credit_limit,
    };

    console.log(obj);
    _postApi(
      `/create-customer`,
      obj,
      (res) => {
        if (!res.success) {
          setLoading(false);
          alert("An error occured!");
          return;
        } else {
          toast.success(
            `${res.message}`
          );
          success_callback();
        }
        return;
      },
      (err) => {
        setLoading(false);
        console.error(err);
        alert("An error occured!qwerttrew");
      }
    );
  };

  return (
    <CustomCard back header={"Edit Customer"}>
      <Row>
        <CustomForm fields={fields} handleChange={handleChange} />
      </Row>
      <center className="mt-4 md:mt-2">
        <CustomButton
          loading={loading}
          disabled={loading || !customer_id}
          // color="primary"
          size="2"
          onClick={handleSubmit}
        >
          Save Customer
        </CustomButton>
      </center>
    </CustomCard>
  );
}
