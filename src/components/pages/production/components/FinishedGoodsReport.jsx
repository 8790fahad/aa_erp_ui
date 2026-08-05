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
import { Package, Search, Eye, Truck, ArrowRightLeft } from "lucide-react";
import axios from "axios";

const FinishedGoodsReport = ({ facilityId }) => {
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedGood, setSelectedGood] = useState(null);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [showDispatchForm, setShowDispatchForm] = useState(false);

  useEffect(() => {
    fetchFinishedGoods();
  }, [facilityId]);

  const fetchFinishedGoods = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `/api/finished-goods?facilityId=${facilityId}`
      );
      if (response.data.success) {
        setFinishedGoods(response.data.data.finishedGoods);
      }
    } catch (error) {
      console.error("Error fetching finished goods:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      available: { color: "success", text: "Available" },
      reserved: { color: "warning", text: "Reserved" },
      dispatched: { color: "secondary", text: "Dispatched" },
      sold: { color: "default", text: "Sold" },
    };

    const config = statusConfig[status] || statusConfig.available;
    return <Badge variant={config.color}>{config.text}</Badge>;
  };

  const filteredGoods = finishedGoods.filter((good) => {
    const matchesSearch =
      good.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      good.batch_no.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === "all") return matchesSearch;
    return matchesSearch && good.status === filterStatus;
  });

  const handleTransfer = (good) => {
    setSelectedGood(good);
    setShowTransferForm(true);
  };

  const handleDispatch = (good) => {
    setSelectedGood(good);
    setShowDispatchForm(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Finished Goods Inventory
        </CardTitle>
        <div className="flex gap-4 mt-4">
          <div className="flex-1">
            <Label htmlFor="search">Search Finished Goods</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Search by product or batch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="w-48">
            <Label htmlFor="filter">Filter by Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Loading finished goods...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Batch No</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGoods.map((good) => (
                <TableRow key={good.id}>
                  <TableCell className="font-medium">
                    {good.product_name}
                  </TableCell>
                  <TableCell>{good.batch_no}</TableCell>
                  <TableCell>{good.quantity}</TableCell>
                  <TableCell>₦{good.cost_per_unit.toFixed(2)}</TableCell>
                  <TableCell>₦{good.total_cost.toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(good.status)}</TableCell>
                  <TableCell>{good.warehouse_location || "N/A"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTransfer(good)}
                        disabled={good.status !== "available"}
                      >
                        <ArrowRightLeft className="h-4 w-4 mr-1" />
                        Transfer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDispatch(good)}
                        disabled={good.status !== "available"}
                      >
                        <Truck className="h-4 w-4 mr-1" />
                        Dispatch
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {filteredGoods.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            No finished goods found matching your criteria.
          </div>
        )}

        {/* Summary */}
        {finishedGoods.length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Inventory Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Items:</span>
                <span className="ml-2 font-medium">{finishedGoods.length}</span>
              </div>
              <div>
                <span className="text-gray-600">Available:</span>
                <span className="ml-2 font-medium">
                  {finishedGoods.filter((g) => g.status === "available").length}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Total Value:</span>
                <span className="ml-2 font-medium">
                  ₦
                  {finishedGoods
                    .reduce((sum, g) => sum + g.total_cost, 0)
                    .toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Avg Unit Cost:</span>
                <span className="ml-2 font-medium">
                  ₦
                  {(
                    finishedGoods.reduce((sum, g) => sum + g.cost_per_unit, 0) /
                    finishedGoods.length
                  ).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FinishedGoodsReport;



