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
import { Plus, Trash2, Save } from "lucide-react";
import axios from "axios";

const PurchaseOrderForm = ({ facilityId }) => {
  const [formData, setFormData] = useState({
    supplierId: "",
    expectedDeliveryDate: "",
    notes: "",
    createdBy: "current-user", // This should come from auth context
  });

  const [items, setItems] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMaterials();
    fetchSuppliers();
  }, [facilityId]);

  const fetchMaterials = async () => {
    try {
      const response = await axios.get(
        `/api/procurement/materials?facilityId=${facilityId}`
      );
      if (response.data.success) {
        setMaterials(response.data.data.materials);
      }
    } catch (error) {
      console.error("Error fetching materials:", error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get(
        `/api/supplier?facilityId=${facilityId}`
      );
      if (response.data.success) {
        setSuppliers(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        materialId: "",
        quantity: 0,
        unitPrice: 0,
        totalPrice: 0,
      },
    ]);
  };

  const updateItem = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };

    if (field === "quantity" || field === "unitPrice") {
      updatedItems[index].totalPrice =
        updatedItems[index].quantity * updatedItems[index].unitPrice;
    }

    setItems(updatedItems);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post("/api/procurement/create-po", {
        facilityId,
        supplierId: formData.supplierId,
        items: items.filter((item) => item.materialId && item.quantity > 0),
        expectedDeliveryDate: formData.expectedDeliveryDate,
        notes: formData.notes,
        createdBy: formData.createdBy,
      });

      if (response.data.success) {
        alert("Purchase Order created successfully!");
        setFormData({
          supplierId: "",
          expectedDeliveryDate: "",
          notes: "",
          createdBy: "current-user",
        });
        setItems([]);
      }
    } catch (error) {
      console.error("Error creating purchase order:", error);
      alert("Error creating purchase order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Create Purchase Order
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplier">Supplier</Label>
              <Select
                value={formData.supplierId}
                onValueChange={(value) =>
                  setFormData({ ...formData, supplierId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem
                      key={supplier.supplier_number}
                      value={supplier.supplier_number}
                    >
                      {supplier.supplier_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="deliveryDate">Expected Delivery Date</Label>
              <Input
                type="date"
                value={formData.expectedDeliveryDate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    expectedDeliveryDate: e.target.value,
                  })
                }
              />
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
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button type="button" onClick={addItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            {items.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select
                          value={item.materialId}
                          onValueChange={(value) =>
                            updateItem(index, "materialId", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select material" />
                          </SelectTrigger>
                          <SelectContent>
                            {materials.map((material) => (
                              <SelectItem key={material.id} value={material.id}>
                                {material.name} ({material.sku})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "quantity",
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
                            updateItem(
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
                      <TableCell>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {items.length > 0 && (
              <div className="flex justify-end">
                <Badge variant="secondary" className="text-lg">
                  Total: ₦{calculateTotal().toFixed(2)}
                </Badge>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading || items.length === 0}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Creating..." : "Create Purchase Order"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default PurchaseOrderForm;



