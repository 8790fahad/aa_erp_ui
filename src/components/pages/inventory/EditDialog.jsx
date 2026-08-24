"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calculator, Package, DollarSign, Tag } from "lucide-react";
import { formatNumber1 } from "@/components/router/utilities";

export function EditItemDialog({ isOpen, onOpenChange, selectedItem, onSave }) {
  const [markup, setMarkup] = useState(10); // Default to 10%
  const [markupMode, setMarkupMode] = useState("percentage"); // "percentage" or "fixed"
  const [vat, setVat] = useState(7.5); // VAT at 7.5%
  const [sellingPrice, setSellingPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [status, setStatus] = useState("for sale");

  useEffect(() => {
    if (selectedItem) {
      const cost =
        Number(selectedItem.cost_price || selectedItem.valuation_cost) || 0;
      const storedMarkup = Number(selectedItem.mark_up) || 10; // Default to 10% if not set
      const storedMode = selectedItem.markup_mode || "percentage";
      const storedVat = Number(selectedItem.vat) || 7.5; // Default to 7.5% if not set

      setCostPrice(cost);

      if (storedMode === "percentage") {
        setMarkup(Number(storedMarkup.toFixed(2)));
      } else {
        setMarkup(storedMarkup);
      }

      setMarkupMode(storedMode);
      setVat(storedVat);

      // Calculate initial selling price with VAT (only if taxable)
      const priceAfterMarkup =
        storedMode === "percentage"
          ? cost + (cost * storedMarkup) / 100
          : cost + storedMarkup;
      const isTaxable = selectedItem.taxable === "Taxable";
      const priceWithVat = isTaxable
        ? priceAfterMarkup * (1 + storedVat / 100)
        : priceAfterMarkup;
      setSellingPrice(Number(priceWithVat.toFixed(2)));
      setStatus(selectedItem.status || "for sale");
    }
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedItem) return;

    const cost =
      costPrice ||
      Number(selectedItem.cost_price || selectedItem.valuation_cost) ||
      0;
    const safeMarkup = isNaN(Number(markup)) ? 0 : Number(markup);
    const safeVat = isNaN(Number(vat)) ? 7.5 : Number(vat);

    // Calculate price after markup
    const priceAfterMarkup =
      markupMode === "percentage"
        ? cost + (cost * safeMarkup) / 100
        : cost + safeMarkup;

    // Add VAT to the price after markup (only if taxable)
    const isTaxable = selectedItem?.taxable === "Taxable";
    const newSellingPrice = isTaxable
      ? priceAfterMarkup * (1 + safeVat / 100)
      : priceAfterMarkup;

    setSellingPrice(Number(newSellingPrice.toFixed(2)));
  }, [markup, markupMode, vat, costPrice, selectedItem]);

  const handleMarkupModeChange = (val) => {
    const newMode = val; // "percentage" or "fixed"
    const cost =
      costPrice ||
      Number(selectedItem?.cost_price || selectedItem?.valuation_cost) ||
      0;
    const currentMarkupValue = markup;

    // Convert the markup value when switching modes
    if (newMode === "percentage" && markupMode === "fixed") {
      // Convert fixed amount to percentage
      const percentageValue = cost > 0 ? (currentMarkupValue / cost) * 100 : 0;
      setMarkup(Number(percentageValue.toFixed(2)));
    } else if (newMode === "fixed" && markupMode === "percentage") {
      // Convert percentage to fixed amount
      const fixedAmount = (cost * currentMarkupValue) / 100;
      setMarkup(Number(fixedAmount.toFixed(2)));
    }

    setMarkupMode(newMode);
  };

  const handleSave = () => {
    if (!selectedItem) return;

    onSave({
      id: selectedItem.id, // Include the store entry ID
      item_name: selectedItem.item_name,
      cost_price:
        costPrice || selectedItem.cost_price || selectedItem.valuation_cost,
      mark_up: markup,
      markup_mode: markupMode,
      vat: vat,
      selling_price: sellingPrice,
      store_id: selectedItem.store_id,
      item_code: selectedItem.item_code,
      reference_number: selectedItem.reference_number,
      status,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Setup Item Pricing
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Product Information */}
            {/* {JSON.stringify(selectedItem)} */}
            <div className="space-y-6">
              {/* Product Information Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Product Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">
                      Item Name
                    </Label>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {selectedItem?.item_name}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">
                      Item Code
                    </Label>
                    <p className="text-sm text-gray-700 mt-1">
                      {selectedItem?.item_code}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">
                      {/* Item Code */}
                      UoM
                    </Label>
                    <p className="text-sm text-gray-700 mt-1">
                      {selectedItem?.unit_of_measure}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">
                      Current Status
                    </Label>
                    <div className="mt-2">
                      <Input value="For Sales" disabled />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">
                      Taxable
                    </Label>
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
                          selectedItem?.taxable === "Taxable"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {selectedItem?.taxable}
                      </span>
                    </div>
                  </div>
                  {selectedItem?.taxable === "Taxable" && (
                    <div>
                      <Label
                        htmlFor="vat"
                        className="text-sm font-medium text-gray-600"
                      >
                        VAT Percentage (%)
                      </Label>
                      <Input
                        id="vat"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="Enter VAT percentage (e.g., 7.5)"
                        value={vat}
                        onChange={(e) => setVat(Number(e.target.value))}
                        className="w-full mt-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        VAT will be applied to the price after markup
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Pricing Configuration */}
            <div className="space-y-6">
              {/* Pricing Configuration Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Pricing Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Cost Price Input */}
                  <div className="space-y-2">
                    <Label htmlFor="cost-price" className="text-sm font-medium">
                      Cost Price (₦)
                    </Label>
                    <Input
                      id="cost-price"
                      type="text"
                      disabled
                      readOnly
                      placeholder="Enter cost price"
                      value={formatNumber1(costPrice)}
                      className="w-full font-bold text-blue-700"
                    />
                    <p className="text-xs text-muted-foreground">
                      Base cost price for markup calculation
                    </p>
                  </div>

                  <Separator />

                  {/* Markup Mode Selection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Markup Mode
                    </Label>
                    <RadioGroup
                      value={markupMode}
                      onValueChange={handleMarkupModeChange}
                      className="flex space-x-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="percentage" id="percentage" />
                        <Label htmlFor="percentage" className="text-sm">
                          Percentage (%)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fixed" id="fixed" />
                        <Label htmlFor="fixed" className="text-sm">
                          Fixed Amount (₦)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Markup Input */}
                  <div className="space-y-2">
                    <Label htmlFor="markup" className="text-sm font-medium">
                      {markupMode === "percentage"
                        ? "Markup Percentage (%)"
                        : "Markup Amount (₦)"}
                    </Label>
                    <Input
                      id="markup"
                      type="number"
                      step="0.01"
                      placeholder={
                        markupMode === "percentage"
                          ? "Enter percentage (e.g., 25)"
                          : "Enter amount (e.g., 500)"
                      }
                      value={markup}
                      onChange={(e) => setMarkup(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      {markupMode === "percentage" ? (
                        <>This will add {markup || 0}% to the cost price</>
                      ) : (
                        <>
                          This will add ₦{formatNumber1(markup || 0)} to the
                          cost price
                        </>
                      )}
                    </p>
                  </div>

                  <Separator />

                  {/* Calculated Selling Price */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Calculated Selling Price
                    </Label>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-xl font-bold text-green-700">
                        ₦{formatNumber1(sellingPrice)}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        {selectedItem?.taxable === "Taxable" ? (
                          <>
                            Final price customers will pay (includes {vat}% VAT)
                          </>
                        ) : (
                          <>Final price customers will pay (no VAT)</>
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-[var(--aa-navy)] hover:bg-[var(--aa-navy)]/90 shadow-none"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
