/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";
import { Container } from "reactstrap";
import CustomCard from "@/common/Custom/CustomCard2";
import { formatNumber } from "@/utilities";
import CustomButton from "@/common/Custom/CustomButton";
import { useSelector } from "react-redux";
import { _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function JournalEntriesForm() {
  const [form, setForm] = useState({
    first_treatment_type: "",
    first_treatment_head: "",
    second_treatment_type: "",
    second_treatment_head: "",
    third_treatment_head: "",
    third_treatment_type: "",
    fourth_treatment_head: "",
    fourth_treatment_type: "",
    fifth_treatment_head: "",
    fifth_treatment_type: "",
    sixth_treatment_head: "",
    sixth_treatment_type: "",
  });
  const navigate = useNavigate();
  const [entryData, setEntryData] = useState(null);
  const [modeCode, setModeCode] = useState([]);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  useEffect(() => {
    const storedData = localStorage.getItem("selectedJournalEntry");
    if (storedData) {
      setEntryData(JSON.parse(storedData));
    }
  }, []);

  useEffect(() => {
    if (activeBusiness?.id) {
      getModeCode();
    }
  }, [activeBusiness]);

  const getModeCode = () => {
    _postApi(
      `/account/expenditure?query_type=asset`,
      { store: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setModeCode(resp.results);
          setDefaultValues(resp.results);
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

  const setDefaultValues = (data) => {
    const cash = data.find((exp) => exp.head === "32010");
    const inventory = data.find((exp) => exp.head === "32011");
    const accountReceivables = data.find((exp) => exp.head === "32012");
    const accountPayables = data.find((exp) => exp.head === "42010");
    const sales = data.find((exp) => exp.head === "42011");
    const CostOfServices = data.find((exp) => exp.head === "42012");

    setForm({
      first_treatment_type: sales?.description || "",
      first_treatment_head: sales?.head || "",
      second_treatment_type: accountReceivables?.description || "",
      second_treatment_head: accountReceivables?.head || "",
      third_treatment_type: cash?.description || "",
      third_treatment_head: cash?.head || "",
      fourth_treatment_head: accountPayables?.head || "",
      fourth_treatment_type: accountPayables?.description || "",
      fifth_treatment_head: inventory?.head || "",
      fifth_treatment_type: inventory?.description || "",
      sixth_treatment_head: CostOfServices?.head || "",
      sixth_treatment_type: CostOfServices?.description || "",
    });
  };

  const changeBalance = entryData?.amount - entryData?.amount_paid;

  if (!entryData) return <p>Loading...</p>;

  const handleSubmit = () => {
    console.log(form);

    const balance = entryData.amount_paid - entryData.amount;
    const changeBalance = balance;

    const createEntry = (amount, head, type) => ({
      depositAmount: amount,
      description: entryData.description,
      payable_code: form[head],
      payable_description: form[type],
      facilityId: activeBusiness?.id,
      store_name: activeBusiness?.business_name,
      mode_code: form[head],
      head_description: form[type],
    });

    const firstEntry = createEntry(
      entryData.amount_paid,
      "first_treatment_head",
      "first_treatment_type"
    );

    const secondEntry =
      entryData.amount > 0
        ? createEntry(
            entryData.amount,
            "second_treatment_head",
            "second_treatment_type"
          )
        : null;

    const thirdEntry =
      entryData.amount_paid > entryData.amount && changeBalance < 0
        ? createEntry(balance, "third_treatment_head", "third_treatment_type")
        : null;

    const fourthEntry =
      changeBalance > 0
        ? createEntry(
            changeBalance,
            "fourth_treatment_head",
            "fourth_treatment_type"
          )
        : null;

    const fifthEntry = createEntry(
      entryData.cost_price,
      "fifth_treatment_head",
      "fifth_treatment_type"
    );

    const sixthEntry = createEntry(
      entryData.cost_price,
      "sixth_treatment_head",
      "sixth_treatment_type"
    );

    // Prepare the request data
    const requestData = {
      firstEntry,
      fifthEntry,
      sixthEntry,
      entryData: {
        transaction_id: entryData.transaction_id,
      },
    };

    if (secondEntry) requestData.secondEntry = secondEntry;
    if (thirdEntry) requestData.thirdEntry = thirdEntry;
    if (fourthEntry) requestData.fourthEntry = fourthEntry;

    _postApi(
      `/create-journal-entry`,
      requestData,
      (resp) => {
        if (resp.success) {
          toaster.success("Journal Entry Created Successfully");
          setForm({
            first_treatment_type: "",
            first_treatment_head: "",
            second_treatment_type: "",
            second_treatment_head: "",
            third_treatment_head: "",
            third_treatment_type: "",
            fourth_treatment_head: "",
            fourth_treatment_type: "",
            fifth_treatment_head: "",
            fifth_treatment_type: "",
            sixth_treatment_head: "",
            sixth_treatment_type: "",
          });
          navigate(-1);
        } else {
          toast.error("Failed to create journal entry.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong.");
      }
    );
  };

  return (
    <Container>
      {/* {JSON.stringify({ entryData })} */}
      <CustomCard back header="Accounting Dashboard">
        <div className="card shadow rounded mb-4">
          <div className="card-header bg-light">
            <h6 className="text-dark">Accounting Entry Details</h6>
          </div>
          <div className="card-body p-4">
            <div className="d-flex justify-content-between">
              <div>
                <p>
                  User ID: <b>{entryData.user_id}</b>
                </p>
                <p>
                  Date: <b>{entryData.transaction_date}</b>
                </p>
              </div>
              <div>
                <p>
                  Item: <b>{entryData.description}</b>
                </p>
                <p>
                  Total Amount: <b>NGN{formatNumber(entryData.amount_paid)}</b>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card shadow rounded mb-4">
          <div className="card-header bg-light">
            <h6 className="text-dark">Account Journal</h6>
          </div>
          <div className="card-body p-4">
            <div className="d-flex justify-content-between border-bottom pb-2">
              <p style={{ width: "70%" }}>
                <b>Account Journal</b>
              </p>
              <p style={{ width: "30%", textAlign: "center" }}>
                <b>Amount(₦)</b>
              </p>
            </div>

            {/* First Treatment */}

            <div className="d-flex justify-content-between mt-3 border-bottom pb-2">
              <select
                className="form-control"
                style={{ width: "70%" }}
                value={form.first_treatment_head}
                onChange={(e) => {
                  const selectedValue = e.target.value;
                  const selectedOption = modeCode.find(
                    (exp) => exp.head === selectedValue
                  );
                  setForm((prev) => ({
                    ...prev,
                    first_treatment_head: selectedValue,
                    first_treatment_type: selectedOption?.description || "",
                  }));
                }}
              >
                <option value="">Select account treatment...</option>
                {modeCode.map((option, idx) => (
                  <option key={idx} value={option.head}>
                    {option.head} - {option.description}
                  </option>
                ))}
              </select>
              <p className="text-right">
                Total Cost: NGN{formatNumber(entryData.amount_paid)}
              </p>
            </div>

            {/* Second Treatment (only if amount > 0) */}
            {entryData.amount > 0 && (
              <div className="d-flex justify-content-between mt-3 border-bottom pb-2">
                <select
                  className="form-control"
                  style={{ width: "70%" }}
                  value={form.second_treatment_head}
                  onChange={(e) => {
                    const selectedValue = e.target.value;
                    const selectedOption = modeCode.find(
                      (exp) => exp.head === selectedValue
                    );
                    setForm((prev) => ({
                      ...prev,
                      second_treatment_head: selectedValue,
                      second_treatment_type: selectedOption?.description || "",
                    }));
                  }}
                >
                  <option value="">Select account treatment...</option>
                  {modeCode.map((option, idx) => (
                    <option key={idx} value={option.head}>
                      {option.head} - {option.description}
                    </option>
                  ))}
                </select>
                <p className="text-right">
                  Amount Paid: NGN{formatNumber(entryData.amount)}
                </p>
              </div>
            )}

            {/* Third Treatment (only if amount_paid > amount) */}
            {entryData.amount_paid > entryData.amount && changeBalance < 0 && (
              <div className="d-flex justify-content-between mt-3 border-bottom pb-2">
                <select
                  style={{ width: "70%" }}
                  className="form-control"
                  value={form.third_treatment_head}
                  onChange={(e) => {
                    const selectedValue = e.target.value;
                    const selectedOption = modeCode.find(
                      (exp) => exp.head === selectedValue
                    );
                    setForm((prev) => ({
                      ...prev,
                      third_treatment_head: selectedValue,
                      third_treatment_type: selectedOption?.description || "",
                    }));
                  }}
                >
                  <option value="">Select account treatment...</option>
                  {modeCode.map((option, idx) => (
                    <option key={idx} value={option.head}>
                      {option.head} - {option.description}
                    </option>
                  ))}
                </select>
                <p className="text-right">
                  Balance: NGN
                  {formatNumber(entryData.amount_paid - entryData.amount)}
                </p>
              </div>
            )}

            {/* Fourth Treatment (only if amount_paid > amount) */}
            {changeBalance > 0 && (
              <div className="d-flex justify-content-between mt-3 border-bottom pb-2">
                <select
                  style={{ width: "70%" }}
                  className="form-control"
                  value={form.fourth_treatment_head}
                  onChange={(e) => {
                    const selectedValue = e.target.value;
                    const selectedOption = modeCode.find(
                      (exp) => exp.head === selectedValue
                    );
                    setForm((prev) => ({
                      ...prev,
                      fourth_treatment_head: selectedValue,
                      fourth_treatment_type: selectedOption?.description || "",
                    }));
                  }}
                >
                  <option value="">Select account treatment...</option>
                  {modeCode.map((option, idx) => (
                    <option key={idx} value={option.head}>
                      {option.head} - {option.description}
                    </option>
                  ))}
                </select>
                <p className="text-right">
                  Change: NGN
                  {formatNumber(entryData.amount - entryData.amount_paid)}
                </p>
              </div>
            )}

            {/* Fifth Treatment */}
            <div className="d-flex justify-content-between mt-3 border-bottom pb-2">
              <select
                style={{ width: "70%" }}
                className="form-control"
                value={form.fifth_treatment_head}
                onChange={(e) => {
                  const selectedValue = e.target.value;
                  const selectedOption = modeCode.find(
                    (exp) => exp.head === selectedValue
                  );
                  setForm((prev) => ({
                    ...prev,
                    fifth_treatment_head: selectedValue,
                    fifth_treatment_type: selectedOption?.description || "",
                  }));
                }}
              >
                <option value="">Select account treatment...</option>
                {modeCode.map((option, idx) => (
                  <option key={idx} value={option.head}>
                    {option.head} - {option.description}
                  </option>
                ))}
              </select>
              <p className="text-right">
                Cost Price: NGN
                {formatNumber(entryData.cost_price)}
              </p>
            </div>

            {/* Sixth Treatment */}
            <div className="d-flex justify-content-between mt-3 border-bottom pb-2">
              <select
                style={{ width: "70%" }}
                className="form-control"
                value={form.sixth_treatment_head}
                onChange={(e) => {
                  const selectedValue = e.target.value;
                  const selectedOption = modeCode.find(
                    (exp) => exp.head === selectedValue
                  );
                  setForm((prev) => ({
                    ...prev,
                    sixth_treatment_head: selectedValue,
                    sixth_treatment_type: selectedOption?.description || "",
                  }));
                }}
              >
                <option value="">Select account treatment...</option>
                {modeCode.map((option, idx) => (
                  <option key={idx} value={option.head}>
                    {option.head} - {option.description}
                  </option>
                ))}
              </select>
              <p className="text-right">
                Cost Price: NGN
                {formatNumber(entryData.cost_price)}
              </p>
            </div>
          </div>

          <div className="card-footer bg-light mt-4 text-center">
            <CustomButton color="success" size="sm" onClick={handleSubmit}>
              Process
            </CustomButton>
          </div>
        </div>
      </CustomCard>
    </Container>
  );
}
