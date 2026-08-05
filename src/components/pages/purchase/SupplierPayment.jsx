/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from "react";
import { Row, Col } from "reactstrap";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { formatNumber } from "@/utilities";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import { useSelector } from "react-redux";
import { _postApi } from "@/redux/actions/api";
import { Typeahead } from "react-bootstrap-typeahead";
import { toast } from "sonner";
import { Input } from "reactstrap/lib";
import { BiSave } from "react-icons/bi";

export default function SupplierPayment() {
  const inputRef = useRef();
  const { supplierList } = useSelector((d) => d.suppliers) || [];
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [deposit, setDeposit] = useState([]);
  const today = moment().format("YYYY-MM-DD");
  const [loading, setLoading] = useState(false);
  const [bankDetails, setBankDetails] = useState([]);
  const navigate = useNavigate();
  const [form, setForm] = useState({
    date: today,
    customer_name: "",
    amount_paid: "",
    remark: "",
  });

  const handleFormChange = ({ target: { name, value } }) =>
    setForm((p) => ({ ...p, [name]: value }));

  const handleDeposit = () => {
    // Validate required fields
    if (!form.supplier_name || !form.supplier_number) {
      toast.error("Please select a supplier");
      return;
    }

    if (!form.amount_paid || parseFloat(form.amount_paid) <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    if (!form.mod_of_payment) {
      toast.error("Please select mode of payment");
      return;
    }

    if (!form.bank_code) {
      toast.error("Please select a bank account");
      return;
    }

    if (!activeBusiness?.payable_code) {
      toast.error(
        "Business payable code is not configured. Please contact administrator."
      );
      return;
    }

    if (loading) {
      toast.warning("Please wait, processing...");
      return;
    }

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
    });

    const supplierEntry = createEntry(
      form.amount_paid,
      form?.supplier_name,
      form?.supplier_code,
      form?.supplier_subhead,
      "tax"
    );

    const bankEntry = createEntry(
      form.amount_paid,
      form.bank_name,
      form.bank_code,
      form.bank_chart_code,
      "net"
    );

    setLoading(true);

    // Set timeout to prevent infinite loading (30 seconds)
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
      toast.error(
        "Request timed out. Please check your connection and try again."
      );
    }, 30000);

    _postApi(
      `/account/supplier-payment`,
      {
        data: form,
        facilityId: activeBusiness._id,
      },
      (res) => {
        clearTimeout(loadingTimeout);

        if (res.success) {
          toast.success("Supplier payment processed successfully");

          // Post to ledger
          _postApi(
            `/v1/materials/insertCollectionProductionLedger`,
            {
              supplierEntry: supplierEntry,
              bankEntry: bankEntry,
              facilityId: activeBusiness._id,
              transaction_date: form.date,
            },
            (ledgerRes) => {
              setLoading(false);
              if (ledgerRes.success) {
                console.log("Ledger entry successful", ledgerRes);
                toast.success(
                  "Payment recorded successfully! Opening receipt..."
                );

                // Navigate to PDF receipt
                const refNumber =
                  res.data?.reference_number ||
                  form.ref_number ||
                  `REF-${Date.now()}`;
                setTimeout(() => {
                  navigate(
                    `/app/purchase/supplier-payment-receipt?ref_number=${refNumber}`
                  );
                }, 1000);
              } else {
                toast.error(ledgerRes.message || "Error recording to ledger");
                console.error("Ledger response:", ledgerRes);
                // Still navigate back even if ledger fails (payment was successful)
                setTimeout(() => navigate(-1), 2000);
              }
            },
            (ledgerErr) => {
              setLoading(false);
              toast.error(
                "Error posting to ledger. Payment may not be fully recorded."
              );
              console.error("Ledger error:", ledgerErr);
              // Still navigate back
              setTimeout(() => navigate(-1), 2000);
            }
          );
        } else {
          setLoading(false);
          const errorMsg =
            res.message ||
            res.error ||
            "Supplier payment failed. Please try again.";
          toast.error(errorMsg);
          console.error("Payment response:", res);
        }
      },
      (err) => {
        clearTimeout(loadingTimeout);
        setLoading(false);

        // Extract meaningful error message
        let errorMessage = "Error creating supplier payment";

        if (err.message) {
          errorMessage = err.message;
        } else if (err.error) {
          errorMessage = err.error;
        } else if (typeof err === "string") {
          errorMessage = err;
        }

        toast.error(errorMessage);
        console.error("Payment error:", err);

        // Show specific errors
        if (
          errorMessage.includes("Data truncated") ||
          errorMessage.includes("type")
        ) {
          toast.error(
            "Database configuration error. Please run database update script."
          );
        } else if (errorMessage.includes("not found")) {
          toast.error(
            "Account configuration missing. Please check Chart of Accounts setup."
          );
        } else if (errorMessage.includes("required")) {
          toast.error("Missing required information. Please check all fields.");
        }
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

  const getDepositData = () => {
    if (!activeBusiness?.id || !form.supplier_number) return;
    _postApi(
      `/inventory/product-list?query_type=supplier_deposit&memo_id=${form.supplier_number}`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setDeposit(resp.results);
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
    if (form.supplier_number) {
      getDepositData();
    }
  }, [form.supplier_number]);

  return (
    <CustomCard back header={"Supplier Deposit"}>
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
          <label>Select Supplier</label>
          <Typeahead
            labelKey="name"
            options={supplierList}
            className="mb-2"
            onChange={(s) => {
              if (s.length) {
                console.log(s);
                setForm((p) => ({
                  ...p,
                  supplier_name: s[0].name,
                  supplier_code: s[0].supplier_code,
                  supplier_subhead: s[0].supplier_subhead,
                  supplier_number: s[0].supplier_number,
                }));
              }
            }}
            onInputChange={(v) => {
              if (v.length) {
                console.log(v, "KDDDDDDDK");
              }
            }}
          />
        </Col>
        <Col md={4}>
          <label>Total Liability</label>
          <label className="form-control">
            ₦ {deposit[0] ? formatNumber(deposit[0].balance) : 0}
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
            ₦ {deposit[0] ? formatNumber(deposit[0].balance) : 0}
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
