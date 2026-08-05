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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../ui/select";
import { Package, Search, AlertTriangle, CheckCircle } from "lucide-react";
import axios from "axios";

const RawMaterialInventory = ({ facilityId }) => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    fetchMaterials();
  }, [facilityId]);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `/api/procurement/materials?facilityId=${facilityId}`
      );
      if (response.data.success) {
        setMaterials(response.data.data.materials);
      }
    } catch (error) {
      console.error("Error fetching materials:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (stockQty, reorderLevel) => {
    if (stockQty <= reorderLevel) {
      return { status: "low", color: "destructive", icon: AlertTriangle };
    } else if (stockQty <= reorderLevel * 1.5) {
      return { status: "medium", color: "warning", icon: AlertTriangle };
    } else {
      return { status: "good", color: "success", icon: CheckCircle };
    }
  };

  const filteredMaterials = materials.filter((material) => {
    const matchesSearch =
      material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.sku.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === "all") return matchesSearch;
    if (filterStatus === "low") {
      const stockStatus = getStockStatus(
        material.stock_qty,
        material.reorder_level
      );
      return matchesSearch && stockStatus.status === "low";
    }
    if (filterStatus === "out") {
      return matchesSearch && material.stock_qty <= 0;
    }

    return matchesSearch;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Raw Material Inventory 
        </CardTitle>
        <div className="flex gap-4 mt-4">
          <div className="flex-1">
            <Label htmlFor="search">Search Materials</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Search by name or SKU..."
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
                <SelectValue placeholder="All materials" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Materials</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Loading materials...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Stock Qty</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Reorder Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Supplier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMaterials.map((material) => {
                const stockStatus = getStockStatus(
                  material.stock_qty,
                  material.reorder_level
                );
                const StatusIcon = stockStatus.icon;
                const totalValue = material.stock_qty * material.unit_cost;

                return (
                  <TableRow key={material.id}>
                    <TableCell className="font-medium">
                      {material.name}
                    </TableCell>
                    <TableCell>{material.sku}</TableCell>
                    <TableCell>{material.unit}</TableCell>
                    <TableCell>{material.stock_qty.toFixed(2)}</TableCell>
                    <TableCell>₦{material.unit_cost.toFixed(2)}</TableCell>
                    <TableCell>₦{totalValue.toFixed(2)}</TableCell>
                    <TableCell>{material.reorder_level}</TableCell>
                    <TableCell>
                      <Badge
                        variant={stockStatus.color}
                        className="flex items-center gap-1 w-fit"
                      >
                        <StatusIcon className="h-3 w-3" />
                        {stockStatus.status === "low"
                          ? "Low Stock"
                          : stockStatus.status === "medium"
                          ? "Medium Stock"
                          : "Good Stock"}
                      </Badge>
                    </TableCell>
                    <TableCell>{material.supplier_name || "N/A"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {filteredMaterials.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            No materials found matching your criteria.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RawMaterialInventory;



