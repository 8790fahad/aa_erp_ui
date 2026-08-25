import { useState, useEffect, useCallback } from "react";
import { Loader2, X } from "lucide-react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1, formatNaira } from "@/components/router/utilities";
import moment from "moment";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import AccountingTreatmentByScenarioPanel from "@/components/accounting/AccountingTreatmentByScenarioPanel";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

const AaErpBalanceSheet = () => {
  const { activeBusiness } = useSelector((state) => state.auth);
  const location = useLocation();
  const facilityId = activeBusiness?.id;
  const navigate = useNavigate();
  const [asOfDate, setAsOfDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState("");

  // Initialize date
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];

    // Check if date is passed from navigation
    if (location.state?.asOfDate) {
      setAsOfDate(location.state.asOfDate);
    } else {
      setAsOfDate(today);
    }
  }, [location.state]);

  const fetchBalanceSheetData = useCallback(async () => {
    if (!facilityId || !asOfDate) {
      setError("Please provide facility ID and as of date");
      return;
    }

    setLoading(true);
    setError("");

    _postApi(
      `/accounting/balance-sheet`,
      {
        facilityId,
        asOfDate,
      },
      (response) => {
        setLoading(false);
        if (response.success && response.data) {
          setReportData(response.data);
        } else {
          setError(response.message || "Failed to fetch balance sheet data");
        }
      },
      (err) => {
        setLoading(false);
        console.error("Balance Sheet Error:", err);
        setError("An error occurred while fetching balance sheet data");
      }
    );
  }, [facilityId, asOfDate]);

  // Fetch data when date changes
  useEffect(() => {
    if (asOfDate && facilityId) {
      fetchBalanceSheetData();
    }
  }, [asOfDate, facilityId, fetchBalanceSheetData]);

  const formatCurrency = formatNaira;

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleRunReport = () => {
    fetchBalanceSheetData();
  };

  const hasData =
    reportData &&
    ((reportData.assets &&
      (reportData.assets.current?.length > 0 ||
        reportData.assets.nonCurrent?.length > 0)) ||
      (reportData.liabilities &&
        (reportData.liabilities.current?.length > 0 ||
          reportData.liabilities.nonCurrent?.length > 0)) ||
      (reportData.equity && reportData.equity.items?.length > 0));

  return (
    <div className="min-h-screen bg-gray-50 p-1">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-100 pl-2 mb-2 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Report Date
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded bg-white"
                />
              </div>
            </div>
            <div className="flex items-end justify-end gap-3">
            <Button
                type="button"
                variant="destructive"
                size="lg"
                className="h-10"
                onClick={() => navigate("/app/reports/accounting-reports")}
              >
                <X className="h-4 w-4" />
                Close
              </Button>
              <button
                className="px-4 py-2 border border-gray-300 rounded bg-white hover:bg-gray-50"
                onClick={handleRunReport}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Run report"
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="no-print mb-4 max-w-7xl mx-auto px-1">
          <AccountingTreatmentByScenarioPanel showReportContext />
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <Skeleton className="h-8 w-64 mb-4" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Balance Sheet Report */}
        {!loading && !error && hasData && (
          <div className="space-y-4">
            {/* Business Header */}
            <div className="mb-1">
              <BusinessDocumentHeader
                business={activeBusiness}
                title="BALANCE SHEET"
                numberLabel={`As of: ${formatDate(asOfDate)}`}
                date={new Date()}
                dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
                className="mb-0"
              />
            </div>

            {/* Two Column Layout for Assets and Liabilities + Equity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Assets Column */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="bg-blue-50 p-4 border-b">
                  <h2 className="text-xl font-bold text-gray-900">ASSETS</h2>
                </div>

                {/* Current Assets */}
                {reportData.assets?.current &&
                  reportData.assets.current.length > 0 && (
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-700 mb-2">
                        Current Assets
                      </h3>
                      <div className="space-y-1 mb-4">
                        {reportData.assets.current.map((asset, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center py-1"
                          >
                            <div className="flex-1 pl-4">
                              <p className="text-sm text-gray-900">
                                {asset.account_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {asset.account_code}
                              </p>
                            </div>
                            <p className="text-sm font-medium text-gray-900 w-32 text-right">
                              {formatCurrency(asset.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="border-t pt-2 flex justify-between items-center">
                        <p className="font-semibold text-gray-900">
                          Total Current Assets
                        </p>
                        <p className="font-bold text-gray-900">
                          {formatCurrency(
                            parseFloat(reportData.assets.currentTotal || 0)
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                {/* Non-Current Assets */}
                {reportData.assets?.nonCurrent &&
                  reportData.assets.nonCurrent.length > 0 && (
                    <div className="p-4 border-t">
                      <h3 className="font-semibold text-gray-700 mb-2">
                        Non-Current Assets
                      </h3>
                      <div className="space-y-1 mb-4">
                        {reportData.assets.nonCurrent.map((asset, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center py-1"
                          >
                            <div className="flex-1 pl-4">
                              <p className="text-sm text-gray-900">
                                {asset.account_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {asset.account_code}
                              </p>
                            </div>
                            <p className="text-sm font-medium text-gray-900 w-32 text-right">
                              {formatCurrency(asset.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="border-t pt-2 flex justify-between items-center">
                        <p className="font-semibold text-gray-900">
                          Total Non-Current Assets
                        </p>
                        <p className="font-bold text-gray-900">
                          {formatCurrency(
                            parseFloat(reportData.assets.nonCurrentTotal || 0)
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                {/* Total Assets */}
                <div className="bg-gray-100 p-4 border-t-2 border-gray-300">
                  <div className="flex justify-between items-center">
                    <p className="text-lg font-bold text-gray-900">
                      TOTAL ASSETS
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(
                        parseFloat(reportData.assets?.total || 0)
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Liabilities and Equity Column */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="bg-blue-50 p-4 border-b">
                  <h2 className="text-xl font-bold text-gray-900">
                    LIABILITIES & EQUITY
                  </h2>
                </div>

                {/* Current Liabilities */}
                {reportData.liabilities?.current &&
                  reportData.liabilities.current.length > 0 && (
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-700 mb-2">
                        Current Liabilities
                      </h3>
                      <div className="space-y-1 mb-4">
                        {reportData.liabilities.current.map(
                          (liability, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between items-center py-1"
                            >
                              <div className="flex-1 pl-4">
                                <p className="text-sm text-gray-900">
                                  {liability.account_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {liability.account_code}
                                </p>
                              </div>
                              <p className="text-sm font-medium text-gray-900 w-32 text-right">
                                {formatCurrency(liability.amount)}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                      <div className="border-t pt-2 flex justify-between items-center">
                        <p className="font-semibold text-gray-900">
                          Total Current Liabilities
                        </p>
                        <p className="font-bold text-gray-900">
                          {formatCurrency(
                            parseFloat(reportData.liabilities.currentTotal || 0)
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                {/* Non-Current Liabilities */}
                {reportData.liabilities?.nonCurrent &&
                  reportData.liabilities.nonCurrent.length > 0 && (
                    <div className="p-4 border-t">
                      <h3 className="font-semibold text-gray-700 mb-2">
                        Non-Current Liabilities
                      </h3>
                      <div className="space-y-1 mb-4">
                        {reportData.liabilities.nonCurrent.map(
                          (liability, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between items-center py-1"
                            >
                              <div className="flex-1 pl-4">
                                <p className="text-sm text-gray-900">
                                  {liability.account_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {liability.account_code}
                                </p>
                              </div>
                              <p className="text-sm font-medium text-gray-900 w-32 text-right">
                                {formatCurrency(liability.amount)}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                      <div className="border-t pt-2 flex justify-between items-center">
                        <p className="font-semibold text-gray-900">
                          Total Non-Current Liabilities
                        </p>
                        <p className="font-bold text-gray-900">
                          {formatCurrency(
                            parseFloat(
                              reportData.liabilities.nonCurrentTotal || 0
                            )
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                {/* Total Liabilities */}
                {(reportData.liabilities?.current?.length > 0 ||
                  reportData.liabilities?.nonCurrent?.length > 0) && (
                  <div className="p-4 border-t bg-gray-50">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-gray-900">
                        TOTAL LIABILITIES
                      </p>
                      <p className="font-bold text-gray-900">
                        {formatCurrency(
                          parseFloat(reportData.liabilities?.total || 0)
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Equity */}
                {reportData.equity?.items &&
                  reportData.equity.items.length > 0 && (
                    <div className="p-4 border-t">
                      <h3 className="font-semibold text-gray-700 mb-2">
                        Equity
                      </h3>
                      <div className="space-y-1 mb-4">
                        {reportData.equity.items.map((equity, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center py-1"
                          >
                            <div className="flex-1 pl-4">
                              <p className="text-sm text-gray-900">
                                {equity.account_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {equity.account_code}
                              </p>
                            </div>
                            <p className="text-sm font-medium text-gray-900 w-32 text-right">
                              {formatCurrency(equity.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="border-t pt-2 flex justify-between items-center">
                        <p className="font-semibold text-gray-900">
                          Total Equity
                        </p>
                        <p className="font-bold text-gray-900">
                          {formatCurrency(
                            parseFloat(reportData.equity.total || 0)
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                {/* Total liabilities + equity (balance sheet equation) */}
                <div className="bg-gray-100 p-4 border-t-2 border-gray-300">
                  <div className="flex justify-between items-center">
                    <p className="text-lg font-bold text-gray-900">
                      TOTAL LIABILITIES + EQUITY
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(
                        parseFloat(
                          reportData.totals?.totalLiabilitiesAndEquity || 0
                        )
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Validation Footer */}
            {reportData.totals && (
              <div className="bg-white rounded-lg shadow-sm p-6 mt-4">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Balance Sheet Validation
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Total Assets</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(
                        parseFloat(reportData.totals.totalAssets || 0)
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      Total Liabilities & Equity
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(
                        parseFloat(
                          reportData.totals.totalLiabilitiesAndEquity || 0
                        )
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <p
                    className={`text-lg font-semibold ${
                      Math.abs(
                        parseFloat(reportData.totals.totalAssets || 0) -
                          parseFloat(
                            reportData.totals.totalLiabilitiesAndEquity || 0
                          )
                      ) < 0.01
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {Math.abs(
                      parseFloat(reportData.totals.totalAssets || 0) -
                        parseFloat(
                          reportData.totals.totalLiabilitiesAndEquity || 0
                        )
                    ) < 0.01
                      ? "✓ Balanced"
                      : "⚠ Not Balanced"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && !hasData && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-600">
              No balance sheet data found for the selected date.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AaErpBalanceSheet;
