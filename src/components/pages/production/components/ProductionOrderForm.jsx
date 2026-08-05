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
import { Badge } from "../../../ui/badge";
import { Factory, Save, AlertCircle } from "lucide-react";
import axios from "axios";

const ProductionOrderForm = ({ facilityId }) => {
  const [formData, setFormData] = useState({
    bomId: "",
    quantityPlanned: 0,
    startDate: "",
    endDate: "",
    priority: "medium",
    notes: "",
    createdBy: "current-user",
  });

  const [billOfMaterials, setBillOfMaterials] = useState([]);
  const [selectedBOM, setSelectedBOM] = useState(null);
  const [materialChecks, setMaterialChecks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBillOfMaterials();
  }, [facilityId]);

  const fetchBillOfMaterials = async () => {
    try {
      const response = await axios.get(
        `/api/production/bill-of-materials?facilityId=${facilityId}`
      );
      if (response.data.success) {
        setBillOfMaterials(response.data.data.billOfMaterials);
      }
    } catch (error) {
      console.error("Error fetching BOMs:", error);
    }
  };

  const handleBOMSelect = async (bomId) => {
    setFormData({ ...formData, bomId });

    try {
      const response = await axios.get(
        `/api/production/bill-of-materials/${bomId}`
      );
      if (response.data.success) {
        setSelectedBOM(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching BOM details:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post("/api/production/create-order", {
        facilityId,
        bomId: formData.bomId,
        quantityPlanned: formData.quantityPlanned,
        startDate: formData.startDate,
        endDate: formData.endDate,
        priority: formData.priority,
        notes: formData.notes,
        createdBy: formData.createdBy,
      });

      if (response.data.success) {
        alert("Production Order created successfully!");
        setFormData({
          bomId: "",
          quantityPlanned: 0,
          startDate: "",
          endDate: "",
          priority: "medium",
          notes: "",
          createdBy: "current-user",
        });
        setSelectedBOM(null);
        setMaterialChecks([]);
      } else {
        alert(response.data.message || "Error creating production order");
        if (response.data.insufficientMaterials) {
          setMaterialChecks(response.data.insufficientMaterials);
        }
      }
    } catch (error) {
      console.error("Error creating production order:", error);
      alert("Error creating production order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Factory className="h-5 w-5" />
          Create Production Order
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="bomId">Bill of Materials</Label>
            <Select value={formData.bomId} onValueChange={handleBOMSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select BOM" />
              </SelectTrigger>
              <SelectContent>
                {billOfMaterials.map((bom) => (
                  <SelectItem key={bom.id} value={bom.id}>
                    {bom.product_name} (v{bom.version})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedBOM && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">BOM Details</h4>
              <p>
                <strong>Product:</strong> {selectedBOM.product_name}
              </p>
              <p>
                <strong>Version:</strong> {selectedBOM.version}
              </p>
              <p>
                <strong>Total Cost:</strong> ₦
                {selectedBOM.total_cost.toFixed(2)}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantityPlanned">Quantity to Produce</Label>
              <Input
                type="number"
                value={formData.quantityPlanned}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    quantityPlanned: parseInt(e.target.value) || 0,
                  })
                }
                min="1"
                required
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
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

          {materialChecks.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800 mb-2">
                <AlertCircle className="h-4 w-4" />
                <strong>Insufficient Materials</strong>
              </div>
              <div className="space-y-2">
                {materialChecks.map((check, index) => (
                  <div key={index} className="text-sm">
                    <strong>{check.materialId}:</strong> Required:{" "}
                    {check.required}, Available: {check.available}
                    <Badge variant="destructive" className="ml-2">
                      {check.sufficient ? "Sufficient" : "Insufficient"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={
              loading || !formData.bomId || formData.quantityPlanned <= 0
            }
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Creating..." : "Create Production Order"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProductionOrderForm;



