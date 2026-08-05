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
import { Textarea } from "../../../ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/table";
import { Badge } from "../../../ui/badge";
import { Progress } from "../../../ui/progress";
import { Factory, Play, Pause, CheckCircle, Clock } from "lucide-react";
import axios from "axios";

const ShopFloorTracking = ({ facilityId }) => {
  const [productionOrders, setProductionOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updateData, setUpdateData] = useState({
    quantityActual: 0,
    status: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProductionOrders();
  }, [facilityId]);

  const fetchProductionOrders = async () => {
    try {
      const response = await axios.get(
        `/api/production/orders?facilityId=${facilityId}`
      );
      if (response.data.success) {
        setProductionOrders(response.data.data.productionOrders);
      }
    } catch (error) {
      console.error("Error fetching production orders:", error);
    }
  };

  const handleOrderSelect = (orderId) => {
    const order = productionOrders.find((po) => po.id === orderId);
    setSelectedOrder(order);
    setUpdateData({
      quantityActual: order?.quantity_actual || 0,
      status: order?.status || "",
      notes: "",
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setLoading(true);
    try {
      const response = await axios.post("/api/production/update-progress", {
        facilityId,
        orderId: selectedOrder.id,
        quantityActual: updateData.quantityActual,
        status: updateData.status,
        notes: updateData.notes,
      });

      if (response.data.success) {
        alert("Production progress updated successfully!");
        fetchProductionOrders();
        setSelectedOrder(null);
        setUpdateData({
          quantityActual: 0,
          status: "",
          notes: "",
        });
      }
    } catch (error) {
      console.error("Error updating production progress:", error);
      alert("Error updating production progress");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      planned: { color: "secondary", icon: Clock },
      in_progress: { color: "default", icon: Play },
      completed: { color: "success", icon: CheckCircle },
      cancelled: { color: "destructive", icon: Pause },
    };

    const config = statusConfig[status] || statusConfig.planned;
    const Icon = config.icon;

    return (
      <Badge variant={config.color} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const getProgressPercentage = (planned, actual) => {
    if (planned <= 0) return 0;
    return Math.min((actual / planned) * 100, 100);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Factory className="h-5 w-5" />
          Shop Floor Tracking
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Production Orders List */}
          <div>
            <Label className="text-lg font-medium mb-4 block">
              Active Production Orders
            </Label>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Planned Qty</TableHead>
                  <TableHead>Actual Qty</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productionOrders.map((order) => {
                  const progress = getProgressPercentage(
                    order.quantity_planned,
                    order.quantity_actual
                  );

                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.order_number}
                      </TableCell>
                      <TableCell>{order.product_name}</TableCell>
                      <TableCell>{order.quantity_planned}</TableCell>
                      <TableCell>{order.quantity_actual}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="flex-1" />
                          <span className="text-sm text-gray-600">
                            {progress.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleOrderSelect(order.id)}
                          disabled={order.status === "completed"}
                        >
                          Update
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Update Form */}
          {selectedOrder && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-4">Update Production Progress</h4>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Order Number</Label>
                    <Input value={selectedOrder.order_number} disabled />
                  </div>
                  <div>
                    <Label>Product</Label>
                    <Input value={selectedOrder.product_name} disabled />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantityActual">
                      Actual Quantity Produced
                    </Label>
                    <Input
                      type="number"
                      value={updateData.quantityActual}
                      onChange={(e) =>
                        setUpdateData({
                          ...updateData,
                          quantityActual: parseInt(e.target.value) || 0,
                        })
                      }
                      min="0"
                      max={selectedOrder.quantity_planned}
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={updateData.status}
                      onValueChange={(value) =>
                        setUpdateData({ ...updateData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    value={updateData.notes}
                    onChange={(e) =>
                      setUpdateData({ ...updateData, notes: e.target.value })
                    }
                    placeholder="Production notes..."
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Updating..." : "Update Progress"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedOrder(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ShopFloorTracking;



