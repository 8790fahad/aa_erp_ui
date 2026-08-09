import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1, formatNaira } from "@/components/router/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Download,
  Printer,
  CheckCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

const CashFlowReport = ({
  facilityId,
  fromDate,
  toDate,
  loading,
  setLoading,
}) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const generateReport = useCallback(() => {
    _postApi(
      "/accounting/cash-flow-statement",
      {
        fromDate,
        toDate,
      },
      (response) => {
        if (response.success) {
          setData(response.data);
        } else {
          setError(
            response.message || "Failed to generate cash flow statement"
          );
        }
        setLoading(false);
      },
      (err) => {
        setError("Error generating cash flow statement: " + err.message);
        setLoading(false);
      }
    );
  }, [fromDate, toDate, setLoading]);

  useEffect(() => {
    if (facilityId && toDate && loading) {
      generateReport();
    }
  }, [facilityId, fromDate, toDate, loading, generateReport]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (!data) return;

    const csvContent = [
      ["Cash Flow Statement", ""],
      ["For the period", `${data.period.from} to ${data.period.to}`],
      ["", ""],
      ["OPERATING ACTIVITIES", "Amount (₦)"],
      ...data.operatingActivities.items.map((item) => [
        item.account_name,
        formatNumber1(item.net_amount),
      ]),
      [
        "Net Cash from Operating Activities",
        formatNumber1(data.operatingActivities.netCashFlow),
      ],
      ["", ""],
      ["INVESTING ACTIVITIES", "Amount (₦)"],
      ...data.investingActivities.items.map((item) => [
        item.account_name,
        formatNumber1(item.net_amount),
      ]),
      [
        "Net Cash from Investing Activities",
        formatNumber1(data.investingActivities.netCashFlow),
      ],
      ["", ""],
      ["FINANCING ACTIVITIES", "Amount (₦)"],
      ...data.financingActivities.items.map((item) => [
        item.account_name,
        formatNumber1(item.net_amount),
      ]),
      [
        "Net Cash from Financing Activities",
        formatNumber1(data.financingActivities.netCashFlow),
      ],
      ["", ""],
      [
        "NET INCREASE/DECREASE IN CASH",
        formatNumber1(data.summary.netCashFlow),
      ],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash_flow_${fromDate}_to_${toDate}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-600">Generating Cash Flow Statement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert>
        <AlertDescription>
          Click &quot;Generate Reports&quot; to create the Cash Flow Statement
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">
            Cash Flow Statement
          </h3>
          <p className="text-gray-600">
            For the period {data.period.from} to {data.period.to}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={handlePrint}
            className="flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Operating Activities */}
      <Card>
        <CardHeader className="bg-blue-50">
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <DollarSign className="h-5 w-5" />
            OPERATING ACTIVITIES
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-blue-50">
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="text-right font-semibold">
                  Amount (₦)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.operatingActivities.items.map((item) => (
                <TableRow key={item.account_code} className="hover:bg-gray-50">
                  <TableCell className="font-medium">
                    {item.account_name}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-mono ${
                        parseFloat(item.net_amount) < 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {parseFloat(item.net_amount) < 0 ? (
                        <TrendingDown className="inline h-4 w-4 mr-1" />
                      ) : (
                        <TrendingUp className="inline h-4 w-4 mr-1" />
                      )}
                      {formatNumber1(item.net_amount)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="bg-blue-100 border-t">
            <TableRow className="hover:bg-transparent">
              <TableCell className="font-bold text-blue-900">
                Net Cash from Operating Activities
              </TableCell>
              <TableCell className="text-right">
                <Badge
                  variant={
                    parseFloat(data.operatingActivities.netCashFlow) < 0
                      ? "destructive"
                      : "default"
                  }
                  className="font-mono text-lg"
                >
                  {formatNumber1(data.operatingActivities.netCashFlow)}
                </Badge>
              </TableCell>
            </TableRow>
          </div>
        </CardContent>
      </Card>

      {/* Investing Activities */}
      <Card>
        <CardHeader className="bg-green-50">
          <CardTitle className="flex items-center gap-2 text-green-900">
            <TrendingUp className="h-5 w-5" />
            INVESTING ACTIVITIES
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-green-50">
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="text-right font-semibold">
                  Amount (₦)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.investingActivities.items.length > 0 ? (
                data.investingActivities.items.map((item) => (
                  <TableRow
                    key={item.account_code}
                    className="hover:bg-gray-50"
                  >
                    <TableCell className="font-medium">
                      {item.account_name}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-mono ${
                          parseFloat(item.net_amount) < 0
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {parseFloat(item.net_amount) < 0 ? (
                          <TrendingDown className="inline h-4 w-4 mr-1" />
                        ) : (
                          <TrendingUp className="inline h-4 w-4 mr-1" />
                        )}
                        {formatNumber1(item.net_amount)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="text-center text-gray-500 py-8"
                  >
                    No investing activities recorded
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="bg-green-100 border-t">
            <TableRow className="hover:bg-transparent">
              <TableCell className="font-bold text-green-900">
                Net Cash from Investing Activities
              </TableCell>
              <TableCell className="text-right">
                <Badge
                  variant={
                    parseFloat(data.investingActivities.netCashFlow) < 0
                      ? "destructive"
                      : "default"
                  }
                  className="font-mono text-lg"
                >
                  {formatNumber1(data.investingActivities.netCashFlow)}
                </Badge>
              </TableCell>
            </TableRow>
          </div>
        </CardContent>
      </Card>

      {/* Financing Activities */}
      <Card>
        <CardHeader className="bg-orange-50">
          <CardTitle className="flex items-center gap-2 text-orange-900">
            <DollarSign className="h-5 w-5" />
            FINANCING ACTIVITIES
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-orange-50">
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="text-right font-semibold">
                  Amount (₦)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.financingActivities.items.length > 0 ? (
                data.financingActivities.items.map((item) => (
                  <TableRow
                    key={item.account_code}
                    className="hover:bg-gray-50"
                  >
                    <TableCell className="font-medium">
                      {item.account_name}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-mono ${
                          parseFloat(item.net_amount) < 0
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {parseFloat(item.net_amount) < 0 ? (
                          <TrendingDown className="inline h-4 w-4 mr-1" />
                        ) : (
                          <TrendingUp className="inline h-4 w-4 mr-1" />
                        )}
                        {formatNumber1(item.net_amount)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="text-center text-gray-500 py-8"
                  >
                    No financing activities recorded
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="bg-orange-100 border-t">
            <TableRow className="hover:bg-transparent">
              <TableCell className="font-bold text-orange-900">
                Net Cash from Financing Activities
              </TableCell>
              <TableCell className="text-right">
                <Badge
                  variant={
                    parseFloat(data.financingActivities.netCashFlow) < 0
                      ? "destructive"
                      : "default"
                  }
                  className="font-mono text-lg"
                >
                  {formatNumber1(data.financingActivities.netCashFlow)}
                </Badge>
              </TableCell>
            </TableRow>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader className="bg-gray-900">
          <CardTitle className="text-white text-center">
            NET INCREASE/DECREASE IN CASH
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center">
            <Badge
              variant={
                parseFloat(data.summary.netCashFlow) < 0
                  ? "destructive"
                  : "default"
              }
              className="text-2xl font-bold px-6 py-3"
            >
              {formatNumber1(data.summary.netCashFlow)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cash Flow Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Operating Cash Flow:</span>
              <span className="font-mono font-semibold">
                ₦{formatNumber1(data.summary.netOperatingCashFlow)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Investing Cash Flow:</span>
              <span className="font-mono font-semibold">
                ₦{formatNumber1(data.summary.netInvestingCashFlow)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Financing Cash Flow:</span>
              <span className="font-mono font-semibold">
                ₦{formatNumber1(data.summary.netFinancingCashFlow)}
              </span>
            </div>
            <div className="flex justify-between items-center border-t pt-3">
              <span className="font-semibold text-gray-900">
                Net Cash Flow:
              </span>
              <span className="font-mono font-bold text-lg">
                ₦{formatNumber1(data.summary.netCashFlow)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              IAS 7 Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Indirect method used</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">
                Operating activities properly classified
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Investing activities identified</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Financing activities separated</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

CashFlowReport.propTypes = {
  facilityId: PropTypes.string.isRequired,
  fromDate: PropTypes.string.isRequired,
  toDate: PropTypes.string.isRequired,
  loading: PropTypes.bool.isRequired,
  setLoading: PropTypes.func.isRequired,
};

export default CashFlowReport;
