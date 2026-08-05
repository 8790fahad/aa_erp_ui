import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { _fetchApi } from "@/redux/actions/api";
import { mapCustomReportRow } from "../utils/customReportHub";
import CustomReportDefinitions from "./CustomReportDefinitions";
import AccountLedgerReportView from "./AccountLedgerReportView";
import moment from "moment";

/**
 * Page: /app/reports/accounting-reports/custom-reports
 * With `?accounts=…&from=…&to=…&name=…`, renders the account ledger on this page (no redirect).
 */
export default function CustomReports() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId || "";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const accountCodes = useMemo(() => {
    const q = searchParams.get("accounts");
    return q ? q.split(",").filter(Boolean) : [];
  }, [searchParams]);

  const qFrom =
    searchParams.get("from") ||
    moment().startOf("month").format("YYYY-MM-DD");
  const qTo = searchParams.get("to") || moment().format("YYYY-MM-DD");
  const qName = searchParams.get("name") || "";
  const qOnlyChildren = searchParams.get("onlyChildren") === "1";
  const qReportType =
    searchParams.get("reportType") === "summary" ? "summary" : "full";
  const qPresentationRaw = searchParams.get("presentation");
  const qPresentation =
    qPresentationRaw === "detail" ? "breakdown" : qPresentationRaw;
  const qBalanceSide = searchParams.get("balanceSide");

  const showLedger = accountCodes.length > 0;

  useEffect(() => {
    if (!facilityId) {
      setLoading(false);
      return;
    }
    if (showLedger) {
      setLoading(false);
      return;
    }
    setLoading(true);
    _fetchApi(
      `/accounting/custom-reports/${facilityId}`,
      (res) => {
        setLoading(false);
        if (res.success && Array.isArray(res.data)) {
          setRows(res.data);
        }
      },
      () => setLoading(false)
    );
  }, [facilityId, showLedger]);

  const handleSyncSearchParams = ({
    from,
    to,
    name,
    presentation,
    reportType,
    balanceSide,
  }) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const accounts = next.get("accounts");
        if (!accounts) return prev;

        if (from) next.set("from", from);
        if (to) next.set("to", to);
        if (name) next.set("name", name);

        if (reportType === "summary") {
          next.set("reportType", "summary");
          if (presentation) {
            next.set("presentation", presentation);
            if (presentation === "head") {
              next.delete("onlyChildren");
              next.delete("balanceSide");
            } else {
              next.set("onlyChildren", "1");
              if (presentation === "breakdown") {
                if (balanceSide && balanceSide !== "all") {
                  next.set("balanceSide", balanceSide);
                } else {
                  next.delete("balanceSide");
                }
              } else {
                next.delete("balanceSide");
              }
            }
          }
        } else if (reportType === "full") {
          next.set("reportType", "full");
          next.delete("presentation");
          next.delete("balanceSide");
        }

        return next;
      },
      { replace: true },
    );
  };

  const handleOpenRow = (row) => {
    navigate(mapCustomReportRow(row).path);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div
        className={`mx-auto space-y-6 ${showLedger ? "max-w-7xl" : "max-w-3xl"}`}
      >
        {showLedger && (
          <AccountLedgerReportView
            variant="embedded"
            accountCodes={accountCodes}
            initialFrom={qFrom}
            initialTo={qTo}
            initialName={qName}
            initialOnlyChildren={qOnlyChildren}
            initialSummaryPresentation={qPresentation || undefined}
            initialBreakdownBalanceSide={qBalanceSide || undefined}
            initialReportType={qReportType}
            onSyncSearchParams={handleSyncSearchParams}
          />
        )}

        {!showLedger && (
          <CustomReportDefinitions
            rows={rows}
            loading={loading}
            onOpenRow={handleOpenRow}
          />
        )}
      </div>
    </div>
  );
}
