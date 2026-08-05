import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";
import { Label } from "../../../ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/table";
import { Badge } from "../../../ui/badge";
import { BarChart3, Download, Calendar } from "lucide-react";
import axios from "axios";

const COGMReport = ({ facilityId }) => {
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState({
    fromDate: new Date().toISOString().split("T")[0],
    toDate: new Date().toISOString().split("T")[0],
  });
  const [loading, setLoading] = useState(false);

  const fetchCOGMReport = async () => {
    setLoading(true);
    try {
      const response = await axios.post("/api/reports/cogm", {
        facilityId,
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate,
      });

      if (response.data.success) {
        setReportData(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching COGM report:", error);
      alert("Error fetching COGM report");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData) return;

    const csvContent = [
      [
        "Production Order",
        "Product",
        "Planned Qty",
        "Actual Qty",
        "Planned Cost",
        "Actual Cost",
        "Variance",
        "Status",
      ],
      ...reportData.cogmData.map((item) => [
        item.order_number,
        item.product_name,
        item.quantity_planned,
        item.quantity_actual,
        item.planned_total_cost,
        item.actual_cost,
        item.cost_variance,
        item.status,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cogm-report-${dateRange.fromDate}-to-${dateRange.toDate}.csv`;
    a.click();
  };

  useEffect(() => {
    fetchCOGMReport();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Cost of Goods Manufactured (COGM) Report
        </CardTitle>
        <div className="flex gap-4 mt-4">
          <div>
            <Label htmlFor="fromDate">From Date</Label>
            <Input
              type="date"
              value={dateRange.fromDate}
              onChange={(e) =>
                setDateRange({ ...dateRange, fromDate: e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="toDate">To Date</Label>
            <Input
              type="date"
              value={dateRange.toDate}
              onChange={(e) =>
                setDateRange({ ...dateRange, toDate: e.target.value })
              }
            />
          </div>
          <div className="flex items-end">
            <Button onClick={fetchCOGMReport} disabled={loading}>
              <Calendar className="h-4 w-4 mr-2" />
              {loading ? "Loading..." : "Generate Report"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Generating report...</div>
        ) : reportData ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800">
                  Total Planned Cost
                </h4>
                <p className="text-2xl font-bold text-blue-900">
                  ₦{reportData.summary.totalPlannedCost.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="text-sm font-medium text-green-800">
                  Total Actual Cost
                </h4>
                <p className="text-2xl font-bold text-green-900">
                  ₦{reportData.summary.totalActualCost.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <h4 className="text-sm font-medium text-orange-800">
                  Total Variance
                </h4>
                <p className="text-2xl font-bold text-orange-900">
                  ₦{reportData.summary.totalVariance.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="text-sm font-medium text-purple-800">
                  Variance %
                </h4>
                <p className="text-2xl font-bold text-purple-900">
                  {reportData.summary.variancePercentage.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Detailed Table */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-medium">
                  Production Orders Detail
                </h4>
                <Button onClick={exportToCSV} size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Planned Qty</TableHead>
                    <TableHead>Actual Qty</TableHead>
                    <TableHead>Planned Cost</TableHead>
                    <TableHead>Actual Cost</TableHead>
                    <TableHead>Variance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.cogmData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {item.order_number}
                      </TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.quantity_planned}</TableCell>
                      <TableCell>{item.quantity_actual}</TableCell>
                      <TableCell>
                        ₦{item.planned_total_cost.toFixed(2)}
                      </TableCell>
                      <TableCell>₦{item.actual_cost.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.cost_variance >= 0 ? "destructive" : "success"
                          }
                        >
                          ₦{item.cost_variance.toFixed(2)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Efficiency Metrics</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Average Cost per Unit:</span>
                    <span className="font-medium">
                      ₦{reportData.summary.averageCostPerUnit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Quantity Produced:</span>
                    <span className="font-medium">
                      {reportData.summary.totalQuantity}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Report Period</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>From:</span>
                    <span className="font-medium">
                      {reportData.reportPeriod.fromDate}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>To:</span>
                    <span className="font-medium">
                      {reportData.reportPeriod.toDate}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No data available for the selected period.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default COGMReport;



