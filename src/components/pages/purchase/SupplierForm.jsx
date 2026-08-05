/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import { Row } from "reactstrap";
import { getSuppliers, saveNewSupplier } from "@/redux/actions/suppliers";
import CustomButton from "@/common/Custom/CustomButton";
import { FaSave } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import CustomForm from "@/common/Custom/CustomForm";
import { useNavigate } from "react-router";
import CustomCard from "@/common/Custom/CustomCard2";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import useQuery from "@/hooks/useQuery";
import { toast } from "sonner";

export default function SupplierForm() {
  const query = useQuery();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const supplier_id = query.get("supplier_id");
  const subhead = query.get("subhead");
  const supplier_name = query.get("supplier_name");
  const facilityId = useSelector((state) => state.auth.activeBusiness.id);
  const [payableCode, setPayableCode] = useState([]);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    _fetchApi(
      `/v1/api/supplier/one/${facilityId}/${supplier_id}`,
      (res) => {
        setForm((p) => ({
          ...p,
          name: supplier_name,
        }));
        if (res.supplier) {
          console.log(res.supplier);

          setForm((p) => ({
            ...p,
            name: res.supplier.description,
            email: res.supplier.email,
            phone: res.supplier.phone,
            address: res.supplier.address,
            website: res.supplier.website,
          }));
        }
      },
      (err) => {
        toast.error("Supplier not found");
      }
    );
  }, [supplier_id, facilityId]);

  const getPayableItems = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=payable`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setPayableCode(
            resp.results
              // .filter((item) => item.description.includes("Accounts Payable"))
              .map((item) => ({
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
    getPayableItems();
  }, []);

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({
      ...p,
      [name]: value,
    }));
  };

  const fields = [
    {
      label: "Supplier Name",
      name: "name",
      required: true,
      value: form.name,
    },
    {
      label: "Supplier Address",
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
  ];

  const success_callback = () => {
    setLoading(false);
    dispatch(getSuppliers());
    navigate("/app/suppliers");
  };

  const handleSubmit = () => {
    if (form.fullname == "") {
      toast.error("Name is required");
    }
    if (!payableCode[0]) {
      toast.error("Payable code not found");
    }
    setLoading(true);
    try {
      let obj = {
        ...form,
        query_type: "create_supplier",
        supplier_code: payableCode[0]?.code,
        supplier_subhead: payableCode[0]?.chart_code,
        facilityId,
      };
      _postApi(
        `/create/new_supplier`,
        obj,
        (res) => {
          if (!res.success) {
            setLoading(false);
            toast.error("An error occured!");
            return;
          } else {
            toast.success(
              `Supplier ${form.fullname} added successfully and has a supplier id of ${res.supplierNo}`
            );
            success_callback();
          }
          return;
        },
        (err) => {
          setLoading(false);
          console.error(err);
          toast.error("An error occured!");
        }
      );
    } catch (err) {
      console.error(err);
      toast.error("An error occured!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <CustomCard back header={"Supplier Form"}>
      {/* {JSON.stringify({ payableCode, form })} */}
      <Row>
        <CustomForm fields={fields} handleChange={handleChange} />
      </Row>
      {/* <Row className="mx-3">
        <Table className="table table-bordered">
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Account No</th>
              <th>Bank Name</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {banks.map((item, index) => (
              <tr key={index}>
                <td>{item.account_name}</td>
                <td>{item.account_number}</td>
                <td>{item.bank_name}</td>
                <td className="text-center gap-2 flex justify-content-center">
                  <Button color="danger" size="sm">
                    <Trash />
                  </Button>
                  <Button color="warning" size="sm">
                    <Pencil />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Row> */}
      {/* <div className="row mt-3 justify-content-center">
        <div className="width-40">
          <CustomButton onClick={() => handleAdd()}>
            <Plus />
            Add Bank Details
          </CustomButton>
        </div>
      </div> */}
      {/* {bank && (
        <Form>
          <div className="row">
            <p className="col-md-4 font-weight-bold">Account Name</p>
            <p className="col-md-4 font-weight-bold">Account No</p>
            <p className="col-md-4 font-weight-bold">Bank Name</p>
          </div>
          {bankDetails.map((item, index) => (
            <FormGroup row className="p-0 m-0 mb-1" key={index}>
              <TextInput
                container="col-md-4"
                className="mb-2"
                value={item.acctName}
                onChange={(e) => {
                  handleBankDetails("acctName", e.target.value, index);
                }}
              />
              <TextInput
                container="col-md-4"
                className="mb-2"
                value={item.acctNo}
                type="number"
                onChange={(e) => {
                  handleBankDetails("acctNo", e.target.value, index);
                }}
              />
              <SelectInput
                container="col-md-4"
                className="mb-2"
                options={data}
                value={item.bank_name}
                onChange={(e) =>
                  handleBankDetails("bank_name", e.target.value, index)
                }
              />
            </FormGroup>
          ))}
        </Form>
      )} */}

      <center>
        <CustomButton
          className="px-5 d-flex align-items-center gap-2"
          loading={loading}
          disabled={loading}
          onClick={() => handleSubmit()}
        >
          <FaSave /> Save
        </CustomButton>
      </center>
    </CustomCard>
  );
}
