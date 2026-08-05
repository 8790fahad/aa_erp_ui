import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";
import { Label } from "../../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/table";
import { Badge } from "../../../ui/badge";
import { BarChart3, Download, Calendar, AlertTriangle } from "lucide-react";
import axios from "axios";

const CostingReport = ({ facilityId }) => {
  const [reportData, setReportData] = useState(null);
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [valuationMethod, setValuationMethod] = useState("FIFO");
  const [loading, setLoading] = useState(false);

  const fetchInventoryValuationReport = async () => {
    setLoading(true);
    try {
      const response = await axios.post("/api/reports/inventory-valuation", {
        facilityId,
        asOfDate,
        valuationMethod,
      });

      if (response.data.success) {
        setReportData(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching inventory valuation report:", error);
      alert("Error fetching inventory valuation report");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData) return;

    const csvContent = [
      [
        "Type",
        "Item",
        "SKU/Batch",
        "Quantity",
        "Unit Cost",
        "Total Value",
        "Status",
        "Warehouse",
      ],
      ...reportData.rawMaterials.items.map((item) => [
        "Raw Material",
        item.name,
        item.sku,
        item.stock_qty,
        item.unit_cost,
        item.total_value,
        item.stock_status,
        "N/A",
      ]),
      ...reportData.finishedGoods.items.map((item) => [
        "Finished Good",
        item.product_name,
        item.batch_no,
        item.quantity,
        item.cost_per_unit,
        item.total_value,
        item.status,
        item.warehouse_location || "N/A",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-valuation-${asOfDate}.csv`;
    a.click();
  };

  useEffect(() => {
    fetchInventoryValuationReport();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Inventory Valuation Report
        </CardTitle>
        <div className="flex gap-4 mt-4">
          <div>
            <Label htmlFor="asOfDate">As of Date</Label>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="valuationMethod">Valuation Method</Label>
            <Select value={valuationMethod} onValueChange={setValuationMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIFO">FIFO</SelectItem>
                <SelectItem value="LIFO">LIFO</SelectItem>
                <SelectItem value="WAC">Weighted Average Cost</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={fetchInventoryValuationReport} disabled={loading}>
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
                  Raw Materials Value
                </h4>
                <p className="text-2xl font-bold text-blue-900">
                  ₦{reportData.rawMaterials.totalValue.toFixed(2)}
                </p>
                <p className="text-xs text-blue-600">
                  {reportData.rawMaterials.itemCount} items
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="text-sm font-medium text-green-800">
                  Finished Goods Value
                </h4>
                <p className="text-2xl font-bold text-green-900">
                  ₦{reportData.finishedGoods.totalValue.toFixed(2)}
                </p>
                <p className="text-xs text-green-600">
                  {reportData.finishedGoods.itemCount} items
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="text-sm font-medium text-purple-800">
                  Total Inventory Value
                </h4>
                <p className="text-2xl font-bold text-purple-900">
                  ₦{reportData.summary.totalInventoryValue.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <h4 className="text-sm font-medium text-orange-800">
                  Low Stock Items
                </h4>
                <p className="text-2xl font-bold text-orange-900">
                  {reportData.summary.lowStockItems}
                </p>
              </div>
            </div>

            {/* Low Stock Alerts */}
            {reportData.summary.lowStockAlerts.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <strong>Low Stock Alerts</strong>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {reportData.summary.lowStockAlerts.map((item, index) => (
                    <div key={index} className="text-sm">
                      <strong>{item.name}</strong> - {item.stock_qty}{" "}
                      {item.unit} remaining
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw Materials Table */}
            <div>
              <h4 className="text-lg font-medium mb-4">
                Raw Materials Inventory
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Total Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Supplier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.rawMaterials.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>{item.stock_qty}</TableCell>
                      <TableCell>₦{item.unit_cost.toFixed(2)}</TableCell>
                      <TableCell>₦{item.total_value.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.stock_status === "Low Stock"
                              ? "destructive"
                              : item.stock_status === "Medium Stock"
                              ? "warning"
                              : "success"
                          }
                        >
                          {item.stock_status}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.supplier_name || "N/A"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Finished Goods Table */}
            <div>
              <h4 className="text-lg font-medium mb-4">
                Finished Goods Inventory
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Total Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Warehouse</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.finishedGoods.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {item.product_name}
                      </TableCell>
                      <TableCell>{item.batch_no}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>₦{item.cost_per_unit.toFixed(2)}</TableCell>
                      <TableCell>₦{item.total_value.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.status}</Badge>
                      </TableCell>
                      <TableCell>{item.warehouse_location || "N/A"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Export Button */}
            <div className="flex justify-end">
              <Button onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No data available for the selected date.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CostingReport;



