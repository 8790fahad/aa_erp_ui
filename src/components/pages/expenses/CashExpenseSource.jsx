import { useEffect, useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { Col, Row } from "reactstrap";
import { useNavigate } from "react-router";
import { Input } from "antd";
import {
  HandCoins,
  MoreVerticalIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { _fetchApi } from "@/redux/actions/api";

export default function CashExpenseSource() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!activeBusiness?.id) return;

    setLoading(true);
    _fetchApi(
      `/api/suppliers/get-by-balance?facilityId=${activeBusiness.id}&limit=1000&page=1`,
      (resp) => {
        if (resp.success) {
          setData(resp.data || resp.results || []);
        } else {
          console.error("Failed to load suppliers");
          setData([]);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching suppliers:", err);
        setData([]);
        setLoading(false);
      }
    );
  }, [activeBusiness?.id]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const text = searchText?.toLowerCase() || "";
      return (
        item.supplier_name?.toLowerCase().includes(text) ||
        item.supplier_number?.toLowerCase().includes(text)
      );
    });
  }, [data, searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const startIndex = safePageIndex * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  useEffect(() => {
    setPageIndex(0);
  }, [searchText]);

  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(Math.max(totalPages - 1, 0));
    }
  }, [pageIndex, totalPages]);

  const summaryTotals = useMemo(() => {
    return data.reduce(
      (acc, supplier) => {
        const purchaseOrderAmount = parseFloat(
          supplier.purchase_order_amount || 0
        );
        const overdueAmount = parseFloat(supplier.overdue_amount || 0);
        const openBillsAmount = parseFloat(supplier.open_bill_amount || 0);
        const paidLast30 = parseFloat(supplier.paid_last_30_amount || 0);

        acc.purchaseOrder.amount += purchaseOrderAmount;
        acc.purchaseOrder.count += parseInt(
          supplier.purchase_order_count || (purchaseOrderAmount > 0 ? 1 : 0),
          10
        );

        acc.overdue.amount += overdueAmount;
        acc.overdue.count += parseInt(
          supplier.overdue_count || (overdueAmount > 0 ? 1 : 0),
          10
        );

        acc.openBills.amount += openBillsAmount;
        acc.openBills.count += parseInt(
          supplier.open_bill_count || (openBillsAmount > 0 ? 1 : 0),
          10
        );

        acc.paid.amount += paidLast30;
        acc.paid.count += parseInt(
          supplier.paid_last_30_count || (paidLast30 > 0 ? 1 : 0),
          10
        );

        return acc;
      },
      {
        purchaseOrder: { amount: 0, count: 0 },
        overdue: { amount: 0, count: 0 },
        openBills: { amount: 0, count: 0 },
        paid: { amount: 0, count: 0 },
      }
    );
  }, [data]);

  const summaryCards = [
    {
      title: "Unbilled Last 365 Days",
      description: `${summaryTotals.purchaseOrder.count} Purchase Orders`,
      amount: summaryTotals.purchaseOrder.amount,
      bg: "bg-blue-600",
    },
    {
      title: "Unpaid Last 365 Days",
      description: `${summaryTotals.overdue.count} Overdue`,
      amount: summaryTotals.overdue.amount,
      bg: "bg-orange-500",
    },
    {
      title: "Open Bills",
      description: `${summaryTotals.openBills.count} Open Bills`,
      amount: summaryTotals.openBills.amount,
      bg: "bg-gray-500",
    },
    {
      title: "Paid",
      description: `${summaryTotals.paid.count} Paid Last 30 Days`,
      amount: summaryTotals.paid.amount,
      bg: "bg-green-600",
    },
  ];

  const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
    }).format(Number(value) || 0);

  return (
    <div className="p-2 space-y-5">
      {/* {JSON.stringify(data)} */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Expenses</h1>
            <p className="text-muted-foreground">
              Track supplier balances and initiate expenses
            </p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="flex items-center gap-2 bg-[#4267B2] hover:bg-[#5A7EC1] dark:bg-slate-800 dark:hover:bg-slate-700 shadow-none"
                >
                  <HandCoins className="w-4 h-4" />
                  Create Expense
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() =>
                    navigate("/app/expenses/cash-expenses/product-cash-expense")
                  }
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <HandCoins className="w-4 h-4" />
                  Product Expense
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    navigate(
                      "/app/expenses/cash-expenses/operating-cash-expense"
                    )
                  }
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <HandCoins className="w-4 h-4" />
                   Expense
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.title}
              className={`${card.bg} rounded-xl p-4 text-white shadow-sm`}
            >
              <p className="text-xs uppercase tracking-wide opacity-80">
                {card.title}
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {formatCurrency(card.amount)}
              </p>
              <p className="mt-1 text-sm opacity-90">{card.description}</p>
            </div>
          ))}
        </div>
      </div>

      <Row className="items-center gap-2 md:gap-0">
        <Col md="8">
          <Input.Search
            placeholder="Search for a payee by name, code, or address"
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            size="large"
          />
        </Col>
        <Col md="4" className="flex justify-end text-sm text-slate-500">
          Showing {paginatedData.length} of {filteredData.length} suppliers
        </Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                Supplier
              </th>

              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                Balance
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading
              ? Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    {Array.from({ length: 5 }).map((__, cellIdx) => (
                      <td key={cellIdx} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : filteredData.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center gap-4">
                        <p>No suppliers found</p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button className="flex items-center gap-2 bg-[#4267B2] hover:bg-[#5A7EC1] shadow-none">
                              <HandCoins className="w-4 h-4" />
                              Create Expense
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" className="w-48">
                            <DropdownMenuItem
                              onClick={() =>
                                navigate(
                                  "/app/expenses/cash-expenses/product-cash-expense"
                                )
                              }
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <HandCoins className="w-4 h-4" />
                              Product Expense
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                navigate(
                                  "/app/expenses/cash-expenses/operating-cash-expense"
                                )
                              }
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <HandCoins className="w-4 h-4" />
                              Operating Expense
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                )}

            {!loading &&
              paginatedData.map((item) => (
                <tr
                  key={item.supplier_number}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <div className="flex flex-col">
                      <span>{item.supplier_name || "—"}</span>
                      <span className="text-xs text-gray-500">
                        ID: {item.supplier_number || "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {item.phone || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {item.email || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                    {formatCurrency(item.open_balance || item.balance || 0)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-slate-500 hover:text-slate-700"
                          >
                            <MoreVerticalIcon className="w-4 h-4" />
                            <span className="sr-only">Open actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(
                                `/app/expenses/cash-expenses/product-cash-expense?supplier_code=${item.supplier_number}`
                              )
                            }
                            className="cursor-pointer"
                          >
                            Product Expense
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(
                                `/app/expenses/cash-expenses/operating-cash-expense?supplier_code=${item.supplier_number}`
                              )
                            }
                            className="cursor-pointer"
                          >
                             Expense
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {!loading && filteredData.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPageIndex(0);
                }}
              >
                <SelectTrigger className="w-20 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 30, 40, 50, 100].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm font-medium text-gray-700 md:justify-end">
              <span>
                Page {safePageIndex + 1} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPageIndex(0)}
                  disabled={safePageIndex === 0}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
                  disabled={safePageIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setPageIndex((prev) => Math.min(prev + 1, totalPages - 1))
                  }
                  disabled={safePageIndex >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPageIndex(totalPages - 1)}
                  disabled={safePageIndex >= totalPages - 1}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
