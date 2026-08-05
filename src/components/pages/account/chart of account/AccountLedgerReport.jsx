import { useSearchParams } from "react-router-dom";
import moment from "moment";
import AccountLedgerReportView from "../../report/components/AccountLedgerReportView";

/**
 * Standalone route: /app/reports/account-ledger-report?accounts=…&from=…&to=…
 * Delegates to {@link AccountLedgerReportView} (same UI as Custom Reports embedded ledger).
 */
export default function AccountLedgerReport() {
  const [searchParams] = useSearchParams();
  const qAccounts = searchParams.get("accounts");
  const qName = searchParams.get("name") || "";
  const qFrom =
    searchParams.get("from") ||
    moment().startOf("month").format("YYYY-MM-DD");
  const qTo = searchParams.get("to") || moment().format("YYYY-MM-DD");
  const qOnlyChildren = searchParams.get("onlyChildren") === "1";
  const qReportType =
    searchParams.get("reportType") === "summary" ? "summary" : "full";
  const passedCodes = qAccounts ? qAccounts.split(",").filter(Boolean) : [];

  return (
    <AccountLedgerReportView
      variant="full"
      accountCodes={passedCodes}
      initialFrom={qFrom}
      initialTo={qTo}
      initialName={qName}
      initialOnlyChildren={qOnlyChildren}
      initialReportType={qReportType}
    />
  );
}
