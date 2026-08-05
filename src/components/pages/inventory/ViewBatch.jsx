import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";

// Sample batch data
const getBatchData = (id) => ({
  id,
  name: "Raw Material A",
  quantity: 58,
  date: "2024-03-25",
  status: "approved",
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

const formatNaira = (amount) => `₦${formatNumber1(amount)}`;

export default function ViewBatch() {
  const { grn } = useParams();
  const decodedGRN = decodeURIComponent(grn);
  const navigate = useNavigate();

  const [batchData, setBatchData] = useState(null);
  const [items, setItems] = useState([]);
  const [batch, setBatch] = useState([]);
  const [loading, setLoading] = useState(true);

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
    const data = getBatchData(decodedGRN);
    setBatchData(data);
    getItemList();
    getBatch();
    setLoading(false);
  }, [decodedGRN]);

  if (loading) return <div className="p-8 text-center">Loading batch details...</div>;
  if (!batchData) return <div className="p-8 text-center">Batch not found</div>;

  const totalItems = batchData.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalItemsValue = batchData.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const totalExpenses = batchData.expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* {JSON.stringify(batch)} */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <h1 className="text-2xl font-bold">Batch Details - {decodedGRN}</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Batch Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>GRN Number:</dt>
                <dd className="font-medium">{batchData.grnNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Status:</dt>
                <dd className="font-medium">{batch.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Date:</dt>
                <dd className="font-medium">{batch.date}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Total Items:</dt>
                <dd className="font-medium">{formatNaira(batch.total)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Value Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Items Value:</dt>
                <dd className="font-medium">{formatNaira(batch.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Expenses:</dt>
                <dd className="font-medium">{formatNaira(totalExpenses)}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>Total Cost:</dt>
                <dd>{formatNaira(Number(batch.total) + totalExpenses)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{item.item_name}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatNaira(item.est_cost)}</TableCell>
                  <TableCell className="text-right">
                    {formatNaira(item.quantity * item.est_cost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
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
                  <TableCell>{expense.id}</TableCell>
                  <TableCell>{expense.name}</TableCell>
                  <TableCell className="text-right">
                    {formatNaira(expense.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
