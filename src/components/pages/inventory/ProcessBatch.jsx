"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useParams, Link, useNavigate } from "react-router-dom";
import { _postApi } from "@/redux/actions/api";

// Sample batch data (same as in page.jsx)
const getBatchData = (id) => ({
  id,
  name: "Raw Material A",
  quantity: 58,
  date: "2024-03-25",
  status: "pending",
  grnNumber: `GRN-${7845 + Number.parseInt(id)}`,
  items: [
    { id: 1, name: "Product A", sku: "SKU-001", quantity: 20, price: 24.99 },
    { id: 2, name: "Product B", sku: "SKU-002", quantity: 15, price: 19.99 },
    { id: 3, name: "Product C", sku: "SKU-003", quantity: 10, price: 34.99 },
    { id: 4, name: "Product D", sku: "SKU-004", quantity: 5, price: 44.99 },
    { id: 5, name: "Product E", sku: "SKU-005", quantity: 8, price: 29.99 },
  ],
  expenses: [
    { id: 1, name: "Transportation", amount: 15000 },
    { id: 2, name: "Customs Clearance", amount: 25000 },
    { id: 3, name: "Handling Fee", amount: 5000 },
    { id: 4, name: "Storage", amount: 8000 },
    { id: 5, name: "Documentation", amount: 3000 },
  ],
});

// Format number as Naira currency
const formatNaira = (amount) => {
  return `₦${amount.toLocaleString("en-NG")}`;
};

export default function ProcessBatch({ params }) {
  const [batchData, setBatchData] = useState(null);
  const [batch, setBatch] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { grn } = useParams();
  const decodedGRN = decodeURIComponent(grn);
  const navigate = useNavigate();
  const [markupItems, setMarkupItems] = useState([]);

  useEffect(() => {
    // Simulate API fetch
    // const data = getBatchData(grn);
    // setBatchData(data);

    // Initialize markup state for each item
    const initialMarkupItems = items.map((item, idx) => ({
      itemId: idx + 1,
      markupType: "percentage",
      markupValue: "10",
      calculatedPrice: calculatePrice(item.est_cost, "percentage", "10"),
    }));

    setMarkupItems(initialMarkupItems);
    setLoading(false);
  }, [grn]);


  const getItemList = () => {
    _postApi(
      "/account/purchase/getPr",
      {
        query_type: "select-exp",
        pr_no: decodedGRN,
      },
      (res) => {
        if (res.success) {
          setItems(res.results);
        }
      },
      () => {
        console.warn("Error occurred while fetching item list");
      }
    );
  };

  const getBatch = () => {
    _postApi(
      "/account/purchase/getPr",
      {
        query_type: "select-individual",
        pr_no: decodedGRN,
      },
      (res) => {
        if (res.success) {
          setBatch(res.results[0]);
        }
      },
      () => {
        console.warn("Error occurred while fetching item list");
      }
    );
  };

  useEffect(() => {
    getItemList();
    getBatch();
  }, [decodedGRN]);


  // Calculate price based on markup type and value
  function calculatePrice(basePrice, type, value) {
    const numValue = Number.parseFloat(value) || 0;

    if (type === "percentage") {
      return basePrice * (1 + numValue / 100);
    } else {
      return basePrice + numValue;
    }
  }

  // Handle markup type change
  function handleMarkupTypeChange(itemId, newType) {
    setMarkupItems((prevItems) =>
      prevItems.map((item) => {
        if (item.itemId === itemId) {
          const newValue = newType === "percentage" ? "10" : 1000; // Default values
          return {
            ...item,
            markupType: newType,
            markupValue: newValue,
            calculatedPrice: calculatePrice(
              items.find((i, idx) => idx+1 === itemId).est_cost,
              newType,
              newValue
            ),
          };
        }
        return item;
      })
    );
  }

  // Handle markup value change
  function handleMarkupValueChange(itemId, newValue) {
    setMarkupItems((prevItems) =>
      prevItems.map((item) => {
        if (item.itemId === itemId) {
          return {
            ...item,
            markupValue: newValue,
            calculatedPrice: calculatePrice(
              items.find((i, idx) => idx+1 === itemId).est_cost,
              item.markupType,
              newValue
            ),
          };
        }
        return item;
      })
    );
  }

  // Handle form submission
  function handleSubmit(e) {
    e.preventDefault();
    // Here you would typically send the data to your backend
    console.log("Submitting markup data:", markupItems);
    alert("Markup settings saved successfully!");
  }

  if (loading) {
    return <div className="p-8 text-center">Loading batch details...</div>;
  }

  if (!items) {
    return <div className="p-8 text-center">Batch not found</div>;
  }

  const totalExpenses = 12000;
  // Determine action text based on status
  const actionText = batchData.status === "approved" ? "Transfer" : "Process";

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* {JSON.stringify(items)} */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to Batches</span>
        </Button>
        <h1 className="text-2xl font-bold">
          Process Batch - {grn}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Set Markup for Items</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Cost Price</TableHead>
                  <TableHead>Markup Type</TableHead>
                  <TableHead>Markup Value</TableHead>
                  <TableHead className="text-right">Selling Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => {
                  const markupItem = markupItems.find(
                    (m) => m.itemId === idx + 1
                  ) || {
                    markupType: "percentage",
                    markupValue: "10",
                    calculatedPrice: item.est_cost * 1.1,
                  };

                  return (
                    <TableRow key={idx + 1}>
                      <TableCell>
                        <div className="font-medium">{item.item_name}</div>
                      </TableCell>
                      <TableCell>{formatNaira(item.est_cost)}</TableCell>
                      <TableCell>
                        <div className="flex gap-4">
                          <div className="flex items-center space-x-2">
                            <input
                              checked={markupItem.markupType === "percentage"}
                              onChange={() =>
                                handleMarkupTypeChange(idx + 1, "percentage")
                              }
                              id={`percentage-${idx + 1}`}
                              name={`markupType-${idx + 1}`}
                              type="radio"
                              className="relative size-4 appearance-none rounded-full border border-gray-300 before:absolute before:inset-1 before:rounded-full before:bg-white checked:border-indigo-600 checked:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:border-gray-300 disabled:bg-gray-100 disabled:before:bg-gray-400 forced-colors:appearance-auto forced-colors:before:hidden [&:not(:checked)]:before:hidden"
                            />
                            <Label htmlFor={`percentage-${idx + 1}`}>
                              Percentage
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              checked={markupItem.markupType === "fixed"}
                              onChange={() =>
                                handleMarkupTypeChange(idx + 1, "fixed")
                              }
                              id={`fixed-${idx + 1}`}
                              name={`markupType-${idx + 1}`}
                              type="radio"
                              className="relative size-4 appearance-none rounded-full border border-gray-300 before:absolute before:inset-1 before:rounded-full before:bg-white checked:border-indigo-600 checked:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:border-gray-300 disabled:bg-gray-100 disabled:before:bg-gray-400 forced-colors:appearance-auto forced-colors:before:hidden [&:not(:checked)]:before:hidden"
                            />
                            <Label htmlFor={`fixed-${idx + 1}`}>
                              Fixed Amount
                            </Label>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          
                          {markupItem.markupType === "fixed" && (
                            <span className="mr-2">₦</span>
                          )}
                          <Input
                            type="number"
                            value={markupItem.markupValue}
                            onChange={(e) =>
                              handleMarkupValueChange(idx + 1, e.target.value)
                            }
                            className="w-24 shadow-none"
                          />
                          {markupItem.markupType === "percentage" && (
                            <span className="ml-2">%</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNaira(markupItem.calculatedPrice)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="mt-4">
              <CardTitle>Additional expenses ({formatNaira(totalExpenses)})</CardTitle>
              {/* <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Expense Name</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchData.expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.id}</TableCell>
                      <TableCell>{expense.name}</TableCell>
                      <TableCell className="text-right">
                        {formatNaira(expense.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={1}></TableCell>
                    <TableCell className="text-right font-bold">Total:</TableCell>
                    <TableCell className="text-right font-bold">
                      {formatNaira(totalExpenses)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table> */}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button
              type="submit"
              className="shadow-none bg-[#4267B2] hover:bg-[#4267B2]"
            >
              {actionText} Batch
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
