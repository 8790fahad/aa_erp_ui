import { Card } from "@/components/ui/card";
import SingleSelectSetting from "./SingleSelectInput";
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { _postApi } from "@/redux/actions/api";
import { Settings } from "lucide-react";

const TripleSelectSettings = ({
  title,
  description,
  icon,
  apiEndpoint,
  primaryCode,
  secondaryCode,
  tertiaryCode,
  primaryLabel = "Payable Code",
  secondaryLabel,
  tertiaryLabel
}) => {
  const [chartOfAccount, setChartOfAccount] = useState([]);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  const getChartOfAccount = useCallback(() => {
    if (!activeBusiness?.business_name) return;

    _postApi(
      `/account/chart-of-account?query_type=select`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          setChartOfAccount(resp.results);
        }
      },
      (err) => {
        console.error("API Error:", err);
      }
    );
  }, [activeBusiness?.business_name]);

  useEffect(() => {
    getChartOfAccount();
  }, [getChartOfAccount]);


  return (
    <Card className="h-100 shadow-sm border-0">
      {/* Header */}
      <div
        className="card-header border-0 text-white position-relative overflow-hidden"
        style={{
          background: "var(--aa-navy)",
          padding: "1rem",
        }}
      >
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: "1.5rem" }}>{icon}</span>
            <div>
              <h5 className="mb-0 fw-bold">{title}</h5>
              <small className="opacity-75">{description}</small>
            </div>
          </div>
          <Settings size={20} className="opacity-75" />
        </div>
      </div>

      {/* Body */}
      <div className="card-body">
        <SingleSelectSetting
          label={primaryLabel}
          code={primaryCode}
          settingKey={primaryLabel}
          title={title}
          chartOfAccount={chartOfAccount}
        />

        <SingleSelectSetting
          label={secondaryLabel}
          code={secondaryCode}
          settingKey={secondaryLabel}
          title={title}
          chartOfAccount={chartOfAccount}
        />

        {/* <SingleSelectSetting
          label={tertiaryLabel}
          code={tertiaryCode}
          settingKey={tertiaryLabel}
          title={title}
          chartOfAccount={chartOfAccount}
        /> */}
      </div>
    </Card>
  );
};

export default TripleSelectSettings;
