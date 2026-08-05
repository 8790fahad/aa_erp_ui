import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import moment from "moment";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Activity,
  BarChart3,
  PieChart,
  Calendar,
} from "lucide-react";

const SalesOverview = () => {
  const { activeBusiness = {} } = useSelector((state) => state.auth);
  const [salesData, setSalesData] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    totalSales: 0,
    totalTransactions: 0,
    totalCustomers: 0,
    averageOrderValue: 0,
    todaySales: 0,
    weeklyGrowth: 0,
    monthlyGrowth: 0,
  });
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: moment().startOf("month").format("YYYY-MM-DD"),
    end: moment().endOf("month").format("YYYY-MM-DD"),
  });

  // Mock data for demonstration - replace with actual API calls
  const mockSalesData = [
    { date: "2024-01-01", amount: 15000, transactions: 5, customers: 4 },
    { date: "2024-01-02", amount: 22000, transactions: 7, customers: 6 },
    { date: "2024-01-03", amount: 18000, transactions: 6, customers: 5 },
    { date: "2024-01-04", amount: 25000, transactions: 8, customers: 7 },
    { date: "2024-01-05", amount: 30000, transactions: 10, customers: 8 },
  ];

  const mockTopProducts = [
    { name: "Product A", sales: 45000, quantity: 25 },
    { name: "Product B", sales: 32000, quantity: 18 },
    { name: "Product C", sales: 28000, quantity: 15 },
    { name: "Product D", sales: 22000, quantity: 12 },
    { name: "Product E", sales: 18000, quantity: 10 },
  ];

  const mockTopCustomers = [
    { name: "Customer A", purchases: 15000, transactions: 5 },
    { name: "Customer B", purchases: 12000, transactions: 4 },
    { name: "Customer C", purchases: 10000, transactions: 3 },
    { name: "Customer D", purchases: 8000, transactions: 2 },
    { name: "Customer E", purchases: 6000, transactions: 2 },
  ];

  useEffect(() => {
    // In a real implementation, you would fetch data from your API
    // For now, we'll use mock data
    setSalesData(mockSalesData);
    setSummaryStats({
      totalSales: 110000,
      totalTransactions: 36,
      totalCustomers: 30,
      averageOrderValue: 3056,
      todaySales: 30000,
      weeklyGrowth: 12.5,
      monthlyGrowth: 8.3,
    });
  }, [activeBusiness.id]);

  const StatCard = ({
    title,
    value,
    icon: Icon,
    trend,
    trendValue,
    color = "blue",
  }) => (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <div className="flex items-center mt-1">
              {trend === "up" ? (
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span
                className={`text-sm ${
                  trend === "up" ? "text-green-500" : "text-red-500"
                }`}
              >
                {trendValue}% from last period
              </span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-full bg-${color}-100`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

  const formatCurrency = (amount) => `₦${formatNumber1(amount)}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sales Overview</h1>
          <p className="text-gray-600 mt-2">
            Monitor your sales performance and analytics
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <Calendar className="h-5 w-5 text-gray-500" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange({ ...dateRange, start: e.target.value })
              }
              className="border border-gray-300 rounded-md px-3 py-2"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange({ ...dateRange, end: e.target.value })
              }
              className="border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Sales"
            value={formatCurrency(summaryStats.totalSales)}
            icon={DollarSign}
            trend="up"
            trendValue={summaryStats.monthlyGrowth}
            color="green"
          />
          <StatCard
            title="Total Transactions"
            value={summaryStats.totalTransactions}
            icon={ShoppingCart}
            trend="up"
            trendValue={summaryStats.weeklyGrowth}
            color="blue"
          />
          <StatCard
            title="Total Customers"
            value={summaryStats.totalCustomers}
            icon={Users}
            trend="up"
            trendValue={5.2}
            color="purple"
          />
          <StatCard
            title="Average Order Value"
            value={formatCurrency(summaryStats.averageOrderValue)}
            icon={Activity}
            trend="down"
            trendValue={2.1}
            color="orange"
          />
        </div>

        {/* Charts and Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Sales Trend Chart */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Sales Trend
              </h3>
              <BarChart3 className="h-5 w-5 text-gray-500" />
            </div>
            <div className="h-64 flex items-end justify-between">
              {salesData.map((data, index) => (
                <div key={index} className="flex flex-col items-center">
                  <div
                    className="bg-blue-500 rounded-t w-8 mb-2"
                    style={{ height: `${(data.amount / 30000) * 200}px` }}
                  ></div>
                  <span className="text-xs text-gray-600">
                    {moment(data.date).format("MMM DD")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Top Products
              </h3>
              <Package className="h-5 w-5 text-gray-500" />
            </div>
            <div className="space-y-3">
              {mockTopProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-xs font-semibold text-blue-600">
                        {index + 1}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {product.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatCurrency(product.sales)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {product.quantity} sold
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Customers */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Top Customers
              </h3>
              <Users className="h-5 w-5 text-gray-500" />
            </div>
            <div className="space-y-3">
              {mockTopCustomers.map((customer, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-sm font-semibold text-green-600">
                        {customer.name.charAt(0)}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {customer.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatCurrency(customer.purchases)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {customer.transactions} transactions
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="flex items-center">
                  <ShoppingCart className="h-5 w-5 text-blue-500 mr-3" />
                  <div>
                    <div className="font-medium text-gray-900">
                      Create New Sale
                    </div>
                    <div className="text-sm text-gray-500">
                      Start a new sales transaction
                    </div>
                  </div>
                </div>
              </button>
              <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-green-500 mr-3" />
                  <div>
                    <div className="font-medium text-gray-900">
                      Add Customer
                    </div>
                    <div className="text-sm text-gray-500">
                      Register a new customer
                    </div>
                  </div>
                </div>
              </button>
              <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="flex items-center">
                  <Package className="h-5 w-5 text-purple-500 mr-3" />
                  <div>
                    <div className="font-medium text-gray-900">
                      Manage Inventory
                    </div>
                    <div className="text-sm text-gray-500">
                      Update product stock levels
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesOverview;
