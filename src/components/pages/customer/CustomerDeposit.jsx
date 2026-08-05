import { useState, useEffect, useRef } from "react";
import { Row, Col } from "reactstrap";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { formatNumber } from "@/utilities";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import SearchCustomerInput from "./components/SearchCustomerInput";
import { useSelector } from "react-redux";
import { _postApi } from "@/redux/actions/api";
import { Typeahead } from "react-bootstrap-typeahead";
import { toast } from "sonner";
import { Input } from "reactstrap/lib";
import { BiSave } from "react-icons/bi";

export default function CustomerDeposit() {
  const history = useNavigate();
  const inputRef = useRef();
  const [selectedCustomer, setSelectedCustomer] = useState({});
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const today = moment().format("YYYY-MM-DD");
  const [form, setForm] = useState({
    date: today,
    customer_name: "",
    amount_paid: "",
    remark: "",
  });
  const [loading, setLoading] = useState(false);
  const [bankDetails, setBankDetails] = useState([]);

  const handleFormChange = ({ target: { name, value } }) =>
    setForm((p) => ({ ...p, [name]: value }));

  const validateForm = () => {
    if (!selectedCustomer[0]) {
      toast.error("Please select a customer");
      return false;
    }
    if (!form.amount_paid) {
      toast.error("Please enter an amount");
      return false;
    }
    if (!form.bank_name) {
      toast.error("Please select a bank");
      return false;
    }
    return true;
  };

  const handleDeposit = () => {
    if (!validateForm()) return;
    const data = {
      ...form,
      query_type: "deposit",
      facilityId: activeBusiness.id,
      customer_no: selectedCustomer[0].customerNo,
      customer_name: selectedCustomer[0].fullname,
      customerSubhead: selectedCustomer[0].subhead,
      dr: form.amount_paid,
      cr: 0,
      receipt_no: moment().format("YYMDhms"),
      description: "Customer Deposit",
      narration: form.remark,
      mode_of_payment: form.bank_name || "CASH",
    };

    setLoading(true);
    _postApi(
      `/customer-deposit`,
      {
        ...form,
        query_type: "deposit",
        facilityId: activeBusiness.id,
        customer_no: selectedCustomer[0].customerNo,
        dr: form.amount_paid,
        cr: 0,
        receipt_no: moment().format("YYMDhms"),
        description: "Customer Deposit",
        narration: form.remark,
        mode_of_payment: form.bank_name || "CASH",
      },
      (res) => {
        // console.log(res);
        if (!res.success) {
          setLoading(false);
          toast.error("Error Occurred");
          return;
        }
        setLoading(false);
        toast.success("Fund Deposited Successfully");
        _postApi(
          `/v1/materials/insertDepositLedger`,
          { data },
          (res) => {
            if (res.success) {
              toast.success(`${res.message}`);
              setLoading(false);
              // console.log(res);
              history(
                `/app/customers/view-receipt/print?entry_id=${res.results[0].entry_id}`
              );
            }
            setLoading(false);
          },
          (err) => {
            toast.error("Error Occurred");
            console.error(err);
            setLoading(false);
          }
        );
      },
      (err) => {
        console.log(err);
        setLoading(false);
        toast.error("Error Occurred");
      }
    );
  };

  const getRevenueItems = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=banks_details`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setBankDetails(
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
  }, []);

  return (
    <CustomCard header={"Customer Deposit"}>
      <Row className="m-0">
        <Col md={4}>
          <label>Date</label>
          <Input
            type="date"
            name="date"
            value={form.date}
            onChange={handleFormChange}
          />
        </Col>
        <Col md={4}>
          <label>Select Customer</label>
          <SearchCustomerInput
            label="Select Customer"
            onChange={setSelectedCustomer}
          />
        </Col>
        <Col md={4}>
          <label>Total Liability</label>
          <label className="form-control">
            ₦{" "}
            {selectedCustomer[0]
              ? formatNumber(selectedCustomer[0].balance)
              : 0}
          </label>
        </Col>
        <Col md={4}>
          <label>Amount Paid({formatNumber(form.amount_paid)})</label>
          <Input
            type="number"
            name="amount_paid"
            value={form.amount_paid}
            onChange={handleFormChange}
          />
        </Col>
        <Col md={4}>
          <label>Balance</label>
          <label className="form-control">
            ₦{" "}
            {selectedCustomer[0]
              ? formatNumber(selectedCustomer[0].balance)
              : 0}
          </label>
        </Col>
        <Col md={4}>
          <label>Remark</label>
          <Input
            type="text"
            name="remark"
            value={form.remark}
            onChange={handleFormChange}
          />
        </Col>
        <Col md={4}>
          <label>Mode of payment</label>
          <Typeahead
            id="material-typeahead"
            ref={inputRef}
            options={bankDetails}
            className="z-100"
            placeholder="Select Mode of payment..."
            onChange={(selected) =>
              setForm((prev) => ({
                ...prev,
                ...selected[0],
                bank_name: selected[0]?.name || "",
                bank_code: selected[0]?.code || "",
                bank_chart_code: selected[0]?.chart_code || "",
              }))
            }
            labelKey={(option) => `${option.name} - (${option.code})`}
          />
        </Col>
      </Row>
      <center className="mt-1">
        <CustomButton onClick={handleDeposit} loading={loading} size="2">
          <BiSave /> Save
        </CustomButton>
      </center>
    </CustomCard>
  );
}
