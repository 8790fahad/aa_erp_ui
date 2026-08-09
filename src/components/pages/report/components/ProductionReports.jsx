import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, Download, TrendingUp, Package, DollarSign, BarChart3, Receipt } from "lucide-react";
import { apiURL } from "@/redux/actions/api";
import { formatNumber1, formatNaira } from "@/components/router/utilities";

const ProductionReports = () => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId || "";

  const [selectedReport, setSelectedReport] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [asOfDate, setAsOfDate] = useState("");
  const [valuationMethod, setValuationMethod] = useState("FIFO");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportTotals, setReportTotals] = useState(null);
  const [error, setError] = useState("");

  // Set default dates
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const currentYear = new Date().getFullYear();
    setFromDate(`${currentYear}-01-01`);
    setToDate(today);
    setAsOfDate(today);
  }, []);

  const reportOptions = [
    {
      value: "cogm",
      label: "Cost of Goods Manufactured (COGM)",
      description: "Analysis of production costs and variances",
      icon: Package,
      requiresDate: "dateRange",
    },
    {
      value: "cogs",
      label: "Cost of Goods Sold (COGS)",
      description: "Tracking of finished goods dispatched and their costs",
      icon: DollarSign,
      requiresDate: "dateRange",
    },
    {
      value: "inventory-valuation",
      label: "Inventory Valuation Report",
      description: "Current inventory value of raw materials and finished goods",
      icon: BarChart3,
      requiresDate: "asOfDate",
    },
    {
      value: "production-efficiency",
      label: "Production Efficiency Report",
      description: "Analysis of production performance and efficiency metrics",
      icon: TrendingUp,
      requiresDate: "dateRange",
    },
    {
      value: "tax-summary",
      label: "Tax Summary Report",
      description: "FIRS compliance report for VAT and WHT calculations",
      icon: Receipt,
      requiresDate: "dateRange",
    },
  ];

  const selectedReportConfig = reportOptions.find(
    (option) => option.value === selectedReport
  );

  const generateReport = async () => {
    if (!selectedReport || !facilityId) {
      setError("Please select a report type and ensure facility is selected");
      return;
    }

    setLoading(true);
    setError("");
    setReportData(null);
    setReportTotals(null);

    try {
      const requestBody = {
        facilityId,
        ...(selectedReportConfig?.requiresDate === "dateRange" && {
          fromDate,
          toDate,
        }),
        ...(selectedReportConfig?.requiresDate === "asOfDate" && {
          asOfDate,
          valuationMethod,
        }),
      };

      const endpoint = `/api/reports/${selectedReport}`;

      console.log("Making API call to:", endpoint);
      console.log("Request body:", requestBody);

      const response = await fetch(`${apiURL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Response data:", data);

      if (data.success) {
        // Handle different data structures based on report type
        let reportData = [];
        let reportTotals = null;

        if (selectedReport === "cogm") {
          reportData = data.data.cogmData || [];
          reportTotals = data.data.summary;
        } else if (selectedReport === "cogs") {
          reportData = data.data.cogsData || [];
          reportTotals = data.data.summary;
        } else if (selectedReport === "inventory-valuation") {
          // For inventory, we'll store the full data structure
          reportData = data.data;
          reportTotals = data.data.summary;
        } else if (selectedReport === "production-efficiency") {
          reportData = data.data.efficiencyData || [];
          reportTotals = data.data.summary;
        } else if (selectedReport === "tax-summary") {
          // For tax summary, we'll store the full data structure
          reportData = data.data;
          reportTotals = data.data.summary;
        }

        console.log("Setting report data:", reportData);
        setReportData(reportData);
        setReportTotals(reportTotals);
      } else {
        setError(data.message || "Failed to generate report");
      }
    } catch (err) {
      console.error("Error generating report:", err);
      setError("Error generating report: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!reportData) return;

    const csvContent = convertToCSV(reportData);
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedReport}-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const convertToCSV = (data) => {
    if (!data || !Array.isArray(data)) return "";

    if (data.length === 0) return "";

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            return typeof value === "string" && value.includes(",")
              ? `"${value}"`
              : value;
          })
          .join(",")
      ),
    ];

    return csvRows.join("\n");
  };


  const renderReportContent = () => {
    if (!reportData) return null;

    // For reports that return arrays, show a generic table
    if (Array.isArray(reportData)) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                {reportData.length > 0 &&
                  Object.keys(reportData[0]).map((key) => (
                    <th
                      key={key}
                      className="border border-gray-300 px-4 py-2 text-left font-medium"
                    >
                      {key.replace(/_/g, " ").toUpperCase()}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {reportData.length > 0 ? (
                reportData.map((row, index) => (
                  <tr
                    key={index}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    {Object.values(row).map((value, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="border border-gray-300 px-4 py-2"
                      >
                        {typeof value === "number"
                          ? formatNumber1(value)
                          : value}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={
                      reportData.length > 0 ? Object.keys(reportData[0]).length : 1
                    }
                    className="border border-gray-300 px-4 py-8 text-center text-gray-500"
                  >
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    }

    // For complex reports with custom components
    switch (selectedReport) {
      case "inventory-valuation":
        return <InventoryValuationReport data={reportData} />;
      case "tax-summary":
        return <TaxSummaryReport data={reportData} />;
      default:
        return (
          <div className="text-center text-gray-500 py-8">
            Report data loaded successfully. Use the export function to download detailed data.
          </div>
        );
    }
  };

  if (!facilityId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg">
              <CardTitle className="text-2xl font-semibold flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                Facility Required
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">
                No Facility Selected
              </h3>
              <p className="text-slate-600 mb-6">
                Please ensure you have selected a facility/business to generate
                reports.
              </p>
              <Button
                onClick={() => window.location.reload()}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-6 py-3 rounded-xl"
              >
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Production Reports</h1>
        <p className="text-gray-600 mt-1">
          Generate comprehensive production analysis and reporting
        </p>
      </div>

      {/* Main Report Card */}
      <Card>
        <CardHeader>
          <CardTitle>Report Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="report-type">Report Type</Label>
            <Select value={selectedReport} onValueChange={setSelectedReport}>
              <SelectTrigger>
                <SelectValue placeholder="Select a report type" />
              </SelectTrigger>
              <SelectContent>
                {reportOptions.map((option) => {
                  const IconComponent = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-sm text-muted-foreground">
                            {option.description}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Date Parameters */}
          {selectedReportConfig && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">
                Date Parameters
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedReportConfig.requiresDate === "dateRange" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fromDate">From Date</Label>
                      <Input
                        id="fromDate"
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="toDate">To Date</Label>
                      <Input
                        id="toDate"
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </>
                )}

                {selectedReportConfig.requiresDate === "asOfDate" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="asOfDate">As of Date</Label>
                      <Input
                        id="asOfDate"
                        type="date"
                        value={asOfDate}
                        onChange={(e) => setAsOfDate(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="valuation-method">Valuation Method</Label>
                      <Select value={valuationMethod} onValueChange={setValuationMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FIFO">FIFO (First In, First Out)</SelectItem>
                          <SelectItem value="LIFO">LIFO (Last In, First Out)</SelectItem>
                          <SelectItem value="AVERAGE">Average Cost</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Generate Button aligned with date inputs */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 opacity-0">
                    Actions
                  </Label>
                  <Button
                    onClick={generateReport}
                    disabled={!selectedReport || loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Generate Report
                      </>
                    )}
                  </Button>
                </div>

                {/* Export Button (only show when report data exists) */}
                {reportData && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700 opacity-0">
                      Export
                    </Label>
                    <Button
                      onClick={exportReport}
                      variant="outline"
                      className="w-full border-green-600 text-green-600 hover:bg-green-50"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons for when no date config */}
          {!selectedReportConfig && (
            <div className="flex gap-2">
              <Button
                onClick={generateReport}
                disabled={!selectedReport || loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Report
                  </>
                )}
              </Button>

              {reportData && (
                <Button
                  onClick={exportReport}
                  variant="outline"
                  className="border-green-600 text-green-600 hover:bg-green-50"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              )}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-blue-800 text-sm">
                  Processing your report request...
                </span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Report Results */}
      {reportData && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedReportConfig?.label} Report
              {selectedReportConfig?.requiresDate === "dateRange" &&
                ` (${fromDate} to ${toDate})`}
              {selectedReportConfig?.requiresDate === "asOfDate" &&
                ` (As of ${asOfDate})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderReportContent()}

            {/* Report Summary/Totals */}
            {reportTotals && (
              <div className="mt-6 p-4 bg-gray-50 border-t border-gray-200">
                <h4 className="text-lg font-semibold text-gray-800 mb-3">
                  Report Summary
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(reportTotals).map(([key, value]) => (
                    <div key={key} className="text-center">
                      <div className="text-sm text-gray-600 capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </div>
                      <div className="text-lg font-semibold text-gray-800">
                        {typeof value === "number"
                          ? formatNumber1(value)
                          : value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// COGM Report Component
const COGMReport = ({ data }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">Total Planned Cost</div>
          <div className="text-2xl font-bold text-blue-600">
            ₦{formatNumber1(data.summary?.totalPlannedCost || 0)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">Total Actual Cost</div>
          <div className="text-2xl font-bold text-green-600">
            ₦{formatNumber1(data.summary?.totalActualCost || 0)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">Cost Variance</div>
          <div className={`text-2xl font-bold ${(data.summary?.totalVariance || 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            ₦{formatNumber1(data.summary?.totalVariance || 0)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">Avg Cost/Unit</div>
          <div className="text-2xl font-bold text-purple-600">
            ₦{formatNumber1(data.summary?.averageCostPerUnit || 0)}
          </div>
        </CardContent>
      </Card>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-300 px-4 py-2 text-left">Order #</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Product</th>
            <th className="border border-gray-300 px-4 py-2 text-right">Qty Planned</th>
            <th className="border border-gray-300 px-4 py-2 text-right">Qty Actual</th>
            <th className="border border-gray-300 px-4 py-2 text-right">Planned Cost</th>
            <th className="border border-gray-300 px-4 py-2 text-right">Actual Cost</th>
            <th className="border border-gray-300 px-4 py-2 text-right">Variance</th>
            <th className="border border-gray-300 px-4 py-2 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.cogmData?.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">{item.order_number}</td>
              <td className="border border-gray-300 px-4 py-2">{item.product_name}</td>
              <td className="border border-gray-300 px-4 py-2 text-right">{item.quantity_planned}</td>
              <td className="border border-gray-300 px-4 py-2 text-right">{item.quantity_actual}</td>
              <td className="border border-gray-300 px-4 py-2 text-right">₦{formatNumber1(item.planned_total_cost || 0)}</td>
              <td className="border border-gray-300 px-4 py-2 text-right">₦{formatNumber1(item.actual_cost || 0)}</td>
              <td className={`border border-gray-300 px-4 py-2 text-right ${(item.cost_variance || 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                ₦{formatNumber1(item.cost_variance || 0)}
              </td>
              <td className="border border-gray-300 px-4 py-2 text-center">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  item.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// COGS Report Component
const COGSReport = ({ data }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">Total Quantity Dispatched</div>
          <div className="text-2xl font-bold text-blue-600">
            {formatNumber1(data.summary?.totalQuantity || 0)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">Total COGS</div>
          <div className="text-2xl font-bold text-green-600">
            ₦{formatNumber1(data.summary?.totalCOGS || 0)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">Avg COGS/Unit</div>
          <div className="text-2xl font-bold text-purple-600">
            ₦{formatNumber1(data.summary?.averageCOGSPerUnit || 0)}
          </div>
        </CardContent>
      </Card>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-300 px-4 py-2 text-left">Dispatch Date</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Product</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Batch No</th>
            <th className="border border-gray-300 px-4 py-2 text-right">Quantity</th>
            <th className="border border-gray-300 px-4 py-2 text-right">Cost/Unit</th>
            <th className="border border-gray-300 px-4 py-2 text-right">Total COGS</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Customer</th>
          </tr>
        </thead>
        <tbody>
          {data.cogsData?.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">{new Date(item.dispatch_date).toLocaleDateString()}</td>
              <td className="border border-gray-300 px-4 py-2">{item.product_name}</td>
              <td className="border border-gray-300 px-4 py-2">{item.batch_no}</td>
              <td className="border border-gray-300 px-4 py-2 text-right">{item.dispatched_quantity}</td>
              <td className="border border-gray-300 px-4 py-2 text-right">₦{formatNumber1(item.cost_per_unit || 0)}</td>
              <td className="border border-gray-300 px-4 py-2 text-right">₦{formatNumber1(item.total_cogs || 0)}</td>
              <td className="border border-gray-300 px-4 py-2">{item.customer_id || 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Inventory Valuation Report Component
const InventoryValuationReport = ({ data }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">Raw Materials Value</div>
          <div className="text-2xl font-bold text-blue-600">
            ₦{formatNumber1(data.summary?.rawMaterialsTotal || 0)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">Finished Goods Value</div>
          <div className="text-2xl font-bold text-green-600">
            ₦{formatNumber1(data.summary?.finishedGoodsTotal || 0)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">Total Inventory Value</div>
          <div className="text-2xl font-bold text-purple-600">
            ₦{formatNumber1(data.summary?.totalInventoryValue || 0)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">Low Stock Items</div>
          <div className="text-2xl font-bold text-red-600">
            {data.summary?.lowStockItems || 0}
          </div>
        </CardContent>
      </Card>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Raw Materials ({data.rawMaterials?.itemCount || 0} items)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-2 py-1 text-left text-sm">Name</th>
                  <th className="border border-gray-300 px-2 py-1 text-left text-sm">SKU</th>
                  <th className="border border-gray-300 px-2 py-1 text-right text-sm">Qty</th>
                  <th className="border border-gray-300 px-2 py-1 text-right text-sm">Unit Cost</th>
                  <th className="border border-gray-300 px-2 py-1 text-right text-sm">Total Value</th>
                  <th className="border border-gray-300 px-2 py-1 text-center text-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rawMaterials?.items?.slice(0, 10).map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-2 py-1 text-sm">{item.name}</td>
                    <td className="border border-gray-300 px-2 py-1 text-sm">{item.sku}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right text-sm">{item.stock_qty}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right text-sm">₦{formatNumber1(item.unit_cost || 0)}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right text-sm">₦{formatNumber1(item.total_value || 0)}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center text-sm">
                      <span className={`px-1 py-0.5 rounded text-xs ${
                        item.stock_status === 'Low Stock' ? 'bg-red-100 text-red-800' :
                        item.stock_status === 'Medium Stock' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {item.stock_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Finished Goods ({data.finishedGoods?.itemCount || 0} items)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-2 py-1 text-left text-sm">Product</th>
                  <th className="border border-gray-300 px-2 py-1 text-left text-sm">Batch</th>
                  <th className="border border-gray-300 px-2 py-1 text-right text-sm">Qty</th>
                  <th className="border border-gray-300 px-2 py-1 text-right text-sm">Cost/Unit</th>
                  <th className="border border-gray-300 px-2 py-1 text-right text-sm">Total Value</th>
                  <th className="border border-gray-300 px-2 py-1 text-center text-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.finishedGoods?.items?.slice(0, 10).map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-2 py-1 text-sm">{item.product_name}</td>
                    <td className="border border-gray-300 px-2 py-1 text-sm">{item.batch_no}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right text-sm">{item.quantity}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right text-sm">₦{formatNumber1(item.cost_per_unit || 0)}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right text-sm">₦{formatNumber1(item.total_value || 0)}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center text-sm">
                      <span className={`px-1 py-0.5 rounded text-xs ${
                        item.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

// Production Efficiency Report Component
const ProductionEfficiencyReport = ({ data }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">Total Orders</div>
          <div className="text-2xl font-bold text-blue-600">
            {data.summary?.totalOrders || 0}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">Completed Orders</div>
          <div className="text-2xl font-bold text-green-600">
            {data.summary?.completedOrders || 0}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">Completion Rate</div>
          <div className="text-2xl font-bold text-purple-600">
            {formatNumber1(data.summary?.completionRate || 0)}%
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">Avg Quantity Efficiency</div>
          <div className="text-2xl font-bold text-orange-600">
            {formatNumber1(data.summary?.avgQuantityEfficiency || 0)}%
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">Overall Efficiency</div>
          <div className="text-2xl font-bold text-indigo-600">
            {formatNumber1(data.summary?.overallEfficiency || 0)}%
          </div>
        </CardContent>
      </Card>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-300 px-4 py-2 text-left">Order #</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Product</th>
            <th className="border border-gray-300 px-4 py-2 text-right">Qty Planned</th>
            <th className="border border-gray-300 px-4 py-2 text-right">Qty Actual</th>
            <th className="border border-gray-300 px-4 py-2 text-right">Planned Duration</th>
            <th className="border border-gray-300 px-4 py-2 text-right">Actual Duration</th>
            <th className="border border-gray-300 px-4 py-2 text-right">Qty Efficiency</th>
            <th className="border border-gray-300 px-4 py-2 text-right">Time Efficiency</th>
            <th className="border border-gray-300 px-4 py-2 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.efficiencyData?.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">{item.order_number}</td>
              <td className="border border-gray-300 px-4 py-2">{item.product_name}</td>
              <td className="border border-gray-300 px-4 py-2 text-right">{item.quantity_planned}</td>
              <td className="border border-gray-300 px-4 py-2 text-right">{item.quantity_actual}</td>
              <td className="border border-gray-300 px-4 py-2 text-right">{item.planned_duration} days</td>
              <td className="border border-gray-300 px-4 py-2 text-right">{item.actual_duration} days</td>
              <td className="border border-gray-300 px-4 py-2 text-right">{formatNumber1(item.quantity_efficiency || 0)}%</td>
              <td className="border border-gray-300 px-4 py-2 text-right">{formatNumber1(item.time_efficiency || 0)}%</td>
              <td className="border border-gray-300 px-4 py-2 text-center">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  item.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Tax Summary Report Component
const TaxSummaryReport = ({ data }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">VAT Purchases</div>
          <div className="text-2xl font-bold text-blue-600">
            ₦{formatNumber1(data.vatPurchases?.vatAmount || 0)}
          </div>
          <div className="text-xs text-gray-500">
            From ₦{formatNumber1(data.vatPurchases?.totalPurchases || 0)} purchases
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">VAT Sales</div>
          <div className="text-2xl font-bold text-green-600">
            ₦{formatNumber1(data.vatSales?.vatAmount || 0)}
          </div>
          <div className="text-xs text-gray-500">
            From ₦{formatNumber1(data.vatSales?.totalSales || 0)} sales
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-gray-500">WHT</div>
          <div className="text-2xl font-bold text-purple-600">
            ₦{formatNumber1(data.wht?.whtAmount || 0)}
          </div>
          <div className="text-xs text-gray-500">
            From ₦{formatNumber1(data.wht?.totalPayments || 0)} payments
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p4">
          <div className="text-sm font-medium text-gray-500">Total Tax Liability</div>
          <div className="text-2xl font-bold text-red-600">
            ₦{formatNumber1(data.summary?.totalTaxLiability || 0)}
          </div>
          <div className="text-xs text-gray-500">
            VAT Payable: ₦{formatNumber1(data.summary?.vatPayable || 0)}
          </div>
        </CardContent>
      </Card>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Tax Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="font-medium">VAT Purchases (7.5%)</span>
              <span className="font-bold">₦{formatNumber1(data.vatPurchases?.vatAmount || 0)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="font-medium">VAT Sales (7.5%)</span>
              <span className="font-bold">₦{formatNumber1(data.vatSales?.vatAmount || 0)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
              <span className="font-medium">WHT (5%)</span>
              <span className="font-bold">₦{formatNumber1(data.wht?.whtAmount || 0)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border-2 border-red-200">
              <span className="font-bold">Net VAT Payable</span>
              <span className="font-bold text-red-600">₦{formatNumber1(data.summary?.vatPayable || 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax Rates & Compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>VAT Rate</span>
              <span className="font-bold">{data.taxRates?.vat}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span>WHT Rate</span>
              <span className="font-bold">{data.taxRates?.wht}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Purchase Orders</span>
              <span className="font-bold">{data.vatPurchases?.purchaseOrdersCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Sales Transactions</span>
              <span className="font-bold">{data.vatSales?.salesCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Payment Transactions</span>
              <span className="font-bold">{data.wht?.paymentCount}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

export default ProductionReports;