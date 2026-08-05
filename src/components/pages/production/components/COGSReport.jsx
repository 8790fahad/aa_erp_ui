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

const COGSReport = ({ facilityId }) => {
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState({
    fromDate: new Date().toISOString().split("T")[0],
    toDate: new Date().toISOString().split("T")[0],
  });
  const [loading, setLoading] = useState(false);

  const fetchCOGSReport = async () => {
    setLoading(true);
    try {
      const response = await axios.post("/api/reports/cogs", {
        facilityId,
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate,
      });

      if (response.data.success) {
        setReportData(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching COGS report:", error);
      alert("Error fetching COGS report");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData) return;

    const csvContent = [
      [
        "Dispatch ID",
        "Date",
        "Product",
        "Batch",
        "Quantity",
        "Unit Cost",
        "Total COGS",
        "Customer",
      ],
      ...reportData.cogsData.map((item) => [
        item.dispatch_id,
        item.dispatch_date,
        item.product_name,
        item.batch_no,
        item.dispatched_quantity,
        item.cost_per_unit,
        item.total_cogs,
        item.customer_id || "N/A",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cogs-report-${dateRange.fromDate}-to-${dateRange.toDate}.csv`;
    a.click();
  };

  useEffect(() => {
    fetchCOGSReport();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Cost of Goods Sold (COGS) Report
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
            <Button onClick={fetchCOGSReport} disabled={loading}>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800">
                  Total Quantity Sold
                </h4>
                <p className="text-2xl font-bold text-blue-900">
                  {reportData.summary.totalQuantity}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="text-sm font-medium text-green-800">
                  Total COGS
                </h4>
                <p className="text-2xl font-bold text-green-900">
                  ₦{reportData.summary.totalCOGS.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="text-sm font-medium text-purple-800">
                  Average COGS per Unit
                </h4>
                <p className="text-2xl font-bold text-purple-900">
                  ₦{reportData.summary.averageCOGSPerUnit.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Detailed Table */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-medium">Sales Dispatches Detail</h4>
                <Button onClick={exportToCSV} size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dispatch ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Total COGS</TableHead>
                    <TableHead>Customer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.cogsData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {item.dispatch_id}
                      </TableCell>
                      <TableCell>{item.dispatch_date}</TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.batch_no}</TableCell>
                      <TableCell>{item.dispatched_quantity}</TableCell>
                      <TableCell>₦{item.cost_per_unit.toFixed(2)}</TableCell>
                      <TableCell>₦{item.total_cogs.toFixed(2)}</TableCell>
                      <TableCell>{item.customer_id || "N/A"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Report Period */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Report Period</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
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
        ) : (
          <div className="text-center py-8 text-gray-500">
            No data available for the selected period.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default COGSReport;



