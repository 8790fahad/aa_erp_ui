"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Percent } from "lucide-react";
import { useEffect } from "react";

const ImprovedTaxSelection = ({
  form,
  taxesList,
  selectedTax,
  onTaxChange,
  onAmountUpdate,
}) => {
  const selectedTaxDetails = taxesList.find((tax) => tax.id === selectedTax);
  const baseAmount = Number.parseFloat(form.amount) || 0;

  // Calculate the adjusted amount based on tax type
  const calculateAdjustedAmount = (tax, originalAmount) => {
    if (!tax) return originalAmount;

    const rate = tax.rate || tax.percentage || 0;
    const taxAmount = (originalAmount * rate) / 100;

    if (tax.tax_type === "inclusive") {
      // For inclusive tax, the displayed amount should be the net amount (amount - tax)
      // But we keep the original amount in form for submission
      return originalAmount - taxAmount;
    } else {
      // For exclusive tax, add tax to the original amount
      return originalAmount + taxAmount;
    }
  };

  // Calculate tax amount for display
  const calculateTaxAmount = (tax, originalAmount) => {
    if (!tax || originalAmount <= 0) return 0;

    const rate = (tax.rate || tax.percentage || 0) / 100;

    if (tax.tax_type === "inclusive") {
      // For inclusive tax: netBeforeTax = originalAmount / (1 + rate)
      // taxAmount = netBeforeTax * rate
      const netBeforeTax = originalAmount / (1 + rate);
      return netBeforeTax * rate;
    } else {
      // For exclusive tax: taxAmount = originalAmount * rate
      return originalAmount * rate;
    }
  };

  // Update parent's amount when tax selection changes (only when tax changes, not amount)
  useEffect(() => {
    if (selectedTaxDetails && onAmountUpdate) {
      const newAmount = calculateAdjustedAmount(selectedTaxDetails, baseAmount);
      onAmountUpdate(newAmount, selectedTaxDetails);
    }
  }, [selectedTax]); // Remove baseAmount from dependencies to prevent circular updates

  return (
    <>
      {form.amount && baseAmount > 0 && (
        <Card className="border-2 border-dashed border-border hover:border-primary/50 transition-colors mb-4">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Percent className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg text-foreground">
                  Applicable Taxes
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Select one tax to apply to your transaction
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <RadioGroup
              value={selectedTax}
              onValueChange={onTaxChange}
              className="space-y-3"
            >
              {taxesList.map((tax, index) => {
                const taxAmount = calculateTaxAmount(tax, baseAmount);

                return (
                  <div key={tax.id || index} className="group">
                    <Label
                      htmlFor={tax.id || `tax-${index}`}
                      className="flex items-center space-x-4 rounded-lg border border-border p-4 cursor-pointer hover:bg-accent/50 transition-colors group-hover:border-primary/50"
                    >
                      <RadioGroupItem
                        value={tax.id || `tax-${index}`}
                        id={tax.id || `tax-${index}`}
                      />

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-foreground">
                            {tax.name || tax.tax_name || tax.description}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {tax.rate || tax.percentage || 0}%
                            </Badge>
                            <span className="font-semibold">
                              <span>
                                {" "}
                                {tax.tax_type === "inclusive" ? "-" : "+"}
                              </span>
                              <span
                                className={
                                  tax.tax_type === "inclusive"
                                    ? "text-red-500"
                                    : "text-primary"
                                }
                              >
                                {taxAmount.toFixed(2)}
                              </span>
                            </span>
                          </div>
                        </div>
                        {tax.description && tax.description !== tax.name && (
                          <p className="text-sm text-muted-foreground">
                            {tax.tax_type.toUpperCase()}
                          </p>
                        )}
                      </div>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>

            {/* Selected Tax Summary */}
            {selectedTaxDetails && (
              <div className="mt-6 rounded-lg bg-primary/5 border border-primary/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Selected Tax</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedTaxDetails.name ||
                        selectedTaxDetails.tax_name ||
                        selectedTaxDetails.description}
                      (
                      {selectedTaxDetails.rate ||
                        selectedTaxDetails.percentage ||
                        0}
                      %)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Tax Amount</p>
                    <p
                      className={`text-lg font-semibold ${
                        selectedTaxDetails.tax_type === "inclusive"
                          ? "text-red-500"
                          : "text-blue-600"
                      }`}
                    >
                      {selectedTaxDetails.tax_type === "inclusive" ? "-" : "+"}
                      {calculateTaxAmount(
                        selectedTaxDetails,
                        baseAmount
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-primary/20">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground">
                      Total Amount
                    </p>
                    <p className="text-xl font-bold text-foreground">
                      {(() => {
                        const taxAmount = calculateTaxAmount(
                          selectedTaxDetails,
                          baseAmount
                        );
                        if (selectedTaxDetails.tax_type === "inclusive") {
                          // For inclusive tax, show the net amount (amount without tax)
                          return (baseAmount - taxAmount).toFixed(2);
                        } else {
                          // For exclusive tax, add tax to base amount
                          return (baseAmount + taxAmount).toFixed(2);
                        }
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default ImprovedTaxSelection;
