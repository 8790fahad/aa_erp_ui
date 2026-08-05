/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useCallback } from "react";
import { Row, Col } from "reactstrap";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { formatNumber } from "@/utilities";
import { useSelector } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { Typeahead } from "react-bootstrap-typeahead";
import { toast } from "sonner";
import { Input } from "reactstrap/lib";
import { BiSave } from "react-icons/bi";

import CustomCard from "@/common/Custom/CustomCard2";
import { CustomButton } from "@/common/ui-elements";

export default function OperationDeposit() {
  const history = useNavigate();
  const inputRef = useRef();
  const [teamSetup, setTeamSetup] = useState([]);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const today = moment().format("YYYY-MM-DD");
  const [loading, setLoading] = useState(false);
  const [bankDetails, setBankDetails] = useState([]);
  const [wagesData, setWagesData] = useState([]);
  const [deposite, setDeposite] = useState([]);
  const [form, setForm] = useState({
    date: today,
    customer_name: "",
    amount_paid: "",
    remark: "",
  });

  const handleFormChange = ({ target: { name, value } }) =>
    setForm((p) => ({ ...p, [name]: value }));

  const getSalaryWages = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=expense_data`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setWagesData(resp.results);
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
    getSalaryWages();
  }, []);

  const handleDeposit = () => {
    const data = {
      ...form,
      query_type: "deposit",
      facilityId: activeBusiness.id,
      dr: form.amount_paid,
      cr: 0,
      receipt_no: moment().format("YYMDhms"),
      description: "Customer Deposit",
      narration: form.remark,
      mode_of_payment: form.bank_name || "CASH",
      wages_account_name: wagesData[0]?.description,
      wages_account_head: wagesData[0]?.head,
      wages_account_subhead: wagesData[0]?.subhead,
    };

    if (!form.amount_paid) {
      alert("Please enter an amount");
      return;
    }
    setLoading(true);
    _postApi(
      `/v1/materials/credit_operation_rate`,
      {
        ...form,
        query_type: "deposit",
        facilityId: activeBusiness.id,
        dr: form.amount_paid,
        cr: 0,
        receipt_no: moment().format("YYMDhms"),
        description: "Customer Deposit",
        narration: form.remark,
        mode_of_payment: form.bank_name || "CASH",
      },
      (res) => {
        setLoading(false);
        alert("Fund Deposited Successfully");
        _postApi(
          `/v1/materials/insertDepositLedger`,
          { data },
          (res) => {
            if (res.success) {
              toast.success(`${res.message}`);
              setLoading(false);
              console.log(res);
            }
            setLoading(false);
          },
          (err) => {
            toast.error("Error Occurred");
            console.error(err);
            setLoading(false);
          }
        );
        history(
          `/app/customers/view-receipt/print?entry_id=${res.results[0].entry_id}`
        );
      },
      (err) => {
        console.log(err);
        setLoading(false);
        history(-1);
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

  const getTeams = useCallback(() => {
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
    getTeams();
  }, []);

  const getTeamDeposite = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=team_deposite&memo_id=${form?.team_id}`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setDeposite(resp.results);
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
    getTeamDeposite();
  }, [form?.team_id]);

  return (
    <CustomCard back header={"Operation Deposit"}>
      {/* {JSON.stringify({ form, teamSetup, wagesData })} */}
      <Row className="m-0">
        <Col md={4}>
          <label>Date</label>
          <Input
            type="date"
            name="date"
            value={form.date}
            onChange={handleFormChange}
            style={{
              borderColor: activeBusiness.primary_color,
              borderWidth: 2,
            }}
          />
        </Col>
        <Col md={4}>
          <label className="font-weight-bold">Team</label>
          <Typeahead
            id="material-typeahead"
            ref={inputRef}
            options={teamSetup}
            className="z-100 custom-typeahead-border"
            placeholder="Select Team..."
            onChange={(selected) =>
              setForm((prev) => ({
                ...prev,
                ...selected[0],
                lead_name: selected[0]?.teamName || "",
                team_id: selected[0]?.team_id || "",
              }))
            }
            labelKey={(option) => `${option.teamName} - (${option.team_id})`}
          />
        </Col>
        <Col md={4}>
          <label>Total Liability</label>
          <label
            className="form-control"
            style={{
              borderColor: activeBusiness.primary_color,
              borderWidth: 2,
            }}
          >
            ₦ {deposite[0] ? formatNumber(deposite[0].balance) : 0}
          </label>
        </Col>
        <Col md={4}>
          <label>Amount Paid({formatNumber(form.amount_paid)})</label>
          <Input
            type="number"
            name="amount_paid"
            value={form.amount_paid}
            onChange={handleFormChange}
            style={{
              borderColor: activeBusiness.primary_color,
              borderWidth: 2,
            }}
          />
        </Col>
        <Col md={4}>
          <label>Balance</label>
          <label
            className="form-control"
            style={{
              borderColor: activeBusiness.primary_color,
              borderWidth: 2,
            }}
          >
            ₦ {deposite[0] ? formatNumber(deposite[0].balance) : 0}
          </label>
        </Col>
        <Col md={4}>
          <label>Remark</label>
          <Input
            type="text"
            name="remark"
            value={form.remark}
            onChange={handleFormChange}
            style={{
              borderColor: activeBusiness.primary_color,
              borderWidth: 2,
            }}
          />
        </Col>
        <Col md={4}>
          <label>Mode of payment</label>
          <Typeahead
            id="material-typeahead"
            ref={inputRef}
            options={bankDetails}
            className="z-100 custom-typeahead-border"
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
        <CustomButton
          className="d-flex gap-1"
          onClick={handleDeposit}
          loading={loading}
          size="2"
        >
          <BiSave className="mt-1" /> Save
        </CustomButton>
      </center>
    </CustomCard>
  );
}
