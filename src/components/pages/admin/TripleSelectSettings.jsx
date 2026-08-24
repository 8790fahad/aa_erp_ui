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
    <Card className="mb-0 overflow-hidden rounded-xl border border-slate-200 shadow-none">
      {/* Header */}
      <div
        className="border-0 px-5 py-3.5 text-white"
        style={{ background: "var(--aa-navy)" }}
      >
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: "1.25rem" }}>{icon}</span>
            <div>
              <h5 className="mb-0 fw-bold text-base">{title}</h5>
              <small className="opacity-75">{description}</small>
            </div>
          </div>
          <Settings size={18} className="opacity-75" />
        </div>
      </div>

      {/* Body */}
      <div className="divide-y divide-slate-100 px-0 py-0">
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
