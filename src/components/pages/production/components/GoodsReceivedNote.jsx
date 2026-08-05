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
import { Package, Save } from "lucide-react";
import axios from "axios";

const GoodsReceivedNote = ({ facilityId }) => {
  const [formData, setFormData] = useState({
    poId: "",
    receivedBy: "current-user",
    notes: "",
  });

  const [receivedItems, setReceivedItems] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [facilityId]);

  const fetchPurchaseOrders = async () => {
    try {
      const response = await axios.get(
        `/api/procurement/purchase-orders?facilityId=${facilityId}&status=pending`
      );
      if (response.data.success) {
        setPurchaseOrders(response.data.data.purchaseOrders);
      }
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
    }
  };

  const handlePOSelect = async (poId) => {
    setFormData({ ...formData, poId });

    // Fetch PO details to populate items
    try {
      const response = await axios.get(
        `/api/procurement/purchase-orders/${poId}`
      );
      if (response.data.success) {
        setSelectedPO(response.data.data);
        // Initialize received items with PO items
        const items = response.data.data.items.map((item) => ({
          materialId: item.material_id,
          quantityReceived: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.total_price,
        }));
        setReceivedItems(items);
      }
    } catch (error) {
      console.error("Error fetching PO details:", error);
    }
  };

  const updateReceivedItem = (index, field, value) => {
    const updatedItems = [...receivedItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };

    if (field === "quantityReceived" || field === "unitPrice") {
      updatedItems[index].totalPrice =
        updatedItems[index].quantityReceived * updatedItems[index].unitPrice;
    }

    setReceivedItems(updatedItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post("/api/procurement/receive-grn", {
        facilityId,
        poId: formData.poId,
        receivedItems: receivedItems.filter(
          (item) => item.quantityReceived > 0
        ),
        receivedBy: formData.receivedBy,
        notes: formData.notes,
      });

      if (response.data.success) {
        alert("Goods received successfully!");
        setFormData({
          poId: "",
          receivedBy: "current-user",
          notes: "",
        });
        setReceivedItems([]);
        setSelectedPO(null);
        fetchPurchaseOrders(); // Refresh PO list
      }
    } catch (error) {
      console.error("Error receiving goods:", error);
      alert("Error receiving goods");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Goods Received Note
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="poId">Purchase Order</Label>
            <Select value={formData.poId} onValueChange={handlePOSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select purchase order" />
              </SelectTrigger>
              <SelectContent>
                {purchaseOrders.map((po) => (
                  <SelectItem key={po.id} value={po.id}>
                    {po.po_number} - {po.supplier_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPO && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>PO Number</Label>
                  <Input value={selectedPO.po_number} disabled />
                </div>
                <div>
                  <Label>Supplier</Label>
                  <Input value={selectedPO.supplier_name} disabled />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Additional notes..."
                />
              </div>

              <div className="space-y-4">
                <Label>Received Items</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Ordered Qty</TableHead>
                      <TableHead>Received Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receivedItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input
                            value={item.materialName || "Loading..."}
                            disabled
                          />
                        </TableCell>
                        <TableCell>
                          <Input value={item.quantityOrdered || 0} disabled />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantityReceived}
                            onChange={(e) =>
                              updateReceivedItem(
                                index,
                                "quantityReceived",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            min="0"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateReceivedItem(
                                index,
                                "unitPrice",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            min="0"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            ₦{item.totalPrice.toFixed(2)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {loading ? "Processing..." : "Receive Goods"}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

export default GoodsReceivedNote;



