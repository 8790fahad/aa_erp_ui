import Widget from "@/common/Widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  DollarSign,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  LineChart,
  Line,
  BarChart,
} from "recharts";
import { CustomTooltip } from "./CustomDashboard";
import { useCallback, useEffect, useState } from "react";
import { _fetchApi } from "@/redux/actions/api";
import { useSelector } from "react-redux";
import { Progress } from "reactstrap/lib";
import { Badge } from "@/components/ui/badge";
import PropTypes from "prop-types";
import { formatNumber } from "@/utilities";
import { formatNumber1 } from "@/components/router/utilities";

export default function RetailersDashboard({ range }) {
  const { activeBusiness } = useSelector((state) => state.auth);
  const data = {
    title: "Retail Inventory Dashboard",
    icon: ShoppingCart,
    gradient: "from-emerald-600 via-teal-600 to-cyan-700",
    accentColor: "emerald",

    chartData: {
      sales: [
        { name: "Jan", sales: 4200, orders: 145, profit: 1260 },
        { name: "Feb", sales: 3800, orders: 132, profit: 1140 },
        { name: "Mar", sales: 5100, orders: 178, profit: 1530 },
        { name: "Apr", sales: 4600, orders: 156, profit: 1380 },
        { name: "May", sales: 5800, orders: 198, profit: 1740 },
        { name: "Jun", sales: 6200, orders: 215, profit: 1860 },
      ],
      categories: [
        { name: "Electronics", value: 40, color: "#10B981" },
        { name: "Accessories", value: 30, color: "#3B82F6" },
        { name: "Clothing", value: 20, color: "#F59E0B" },
        { name: "Home", value: 10, color: "#EF4444" },
      ],
    },
    widgets: [
      {
        title: "Top Selling Products",
        type: "products",
        data: [
          {
            name: "Wireless Headphones",
            sold: 145,
            revenue: "$14,500",
            trend: "up",
            growth: 12,
          },
          {
            name: "Smartphone Case",
            sold: 98,
            revenue: "$2,940",
            trend: "up",
            growth: 8,
          },
          {
            name: "Laptop Stand",
            sold: 76,
            revenue: "$3,800",
            trend: "down",
            growth: -3,
          },
          {
            name: "USB Cable",
            sold: 234,
            revenue: "$1,170",
            trend: "up",
            growth: 15,
          },
        ],
      },
      {
        title: "Stock Alerts",
        type: "alerts",
        data: [
          {
            item: "iPhone Chargers",
            current: 5,
            minimum: 20,
            status: "critical",
            supplier: "TechCorp",
          },
          {
            item: "Bluetooth Speakers",
            current: 12,
            minimum: 15,
            status: "warning",
            supplier: "AudioMax",
          },
          {
            item: "Screen Protectors",
            current: 8,
            minimum: 25,
            status: "critical",
            supplier: "ProtectPro",
          },
          {
            item: "Power Banks",
            current: 18,
            minimum: 20,
            status: "warning",
            supplier: "PowerTech",
          },
        ],
      },
    ],
  };
  const stats = [
    {
      label: "Total Sales",
      value: "12,450",
      change: "+5%",
      trend: "up",
      icon: Package,
    },
    {
      label: "Low Stock Items",
      value: "23",
      change: "+15%",
      trend: "up",
      icon: AlertTriangle,
    },
    {
      label: "Total Inventory",
      value: "450",
      change: "+18%",
      trend: "up",
      icon: DollarSign,
    },
    {
      label: "Pending Orders",
      value: "23",
      change: "+0.2",
      trend: "up",
      icon: Truck,
    },
  ];
  const [reports, setReports] = useState({
    material_collected: 0,
    recycled_batches: 0,
    pending_processing: 0,
    revenue_generated: 0,
  });

  const getReports = useCallback(() => {
    if (!activeBusiness.business_type) return;
    _fetchApi(
      `/account/get-all-report?from=${range.from}&to=${range.to}&facilityId=${activeBusiness.id}&query_type=${activeBusiness.business_type}`,
      (data) => {
        if (data && data.results) {
          if (data.results.length > 0) {
            setReports(data.results[0]);
          } else {
            setReports(data.results);
          }
        }
      },
      (error) => {
        console.error({ error });
      }
    );
  }, [range.from, range.to, activeBusiness.id, activeBusiness.business_type]);

  useEffect(() => {
    getReports();
  }, [getReports]);

  const renderWidget = (widget) => {
    switch (widget.type) {
      case "products":
        return (
          <div className="space-y-4">
            {widget.data.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-[var(--aa-navy)] backdrop-blur-sm rounded-xl border border-gray-700/50 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{item.name}</p>
                    <p className="text-sm text-gray-400">
                      {item.sold} units sold
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-400 text-lg">
                    {item.revenue}
                  </p>
                  <div className="flex items-center gap-1">
                    {item.trend === "up" ? (
                      <ArrowUpRight className="w-4 h-4 text-green-400" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-red-400" />
                    )}
                    <span
                      className={`text-sm font-medium ${
                        item.trend === "up" ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {item.growth}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case "alerts":
        return (
          <div className="space-y-4">
            {widget.data.map((item, index) => (
              <div
                key={index}
                className={`p-4 rounded-xl border transition-all duration-300 ${
                  item.status === "critical"
                    ? "bg-gradient-to-r from-red-900/20 to-red-800/20 border-red-500/50 hover:border-red-400/70"
                    : "bg-gradient-to-r from-yellow-900/20 to-yellow-800/20 border-yellow-500/50 hover:border-yellow-400/70"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-white">{item.item}</p>
                  <Badge
                    variant={
                      item.status === "critical" ? "destructive" : "secondary"
                    }
                    className="animate-pulse"
                  >
                    {item.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                  <span>Current: {item.current}</span>
                  <span>Min: {item.minimum}</span>
                </div>
                <Progress
                  value={(item.current / item.minimum) * 100}
                  className={`h-2 ${
                    item.status === "critical" ? "bg-red-900" : "bg-yellow-900"
                  }`}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Supplier: {item.supplier}
                </p>
              </div>
            ))}
          </div>
        );
      default:
        return <div>Widget type not supported</div>;
    }
  };

  return (
    <div className="min-h-screen text-white">
      <div className="">
        <main className="py-4 relative ">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <>
                  <Widget
                    icon={<Icon className="h-4 w-4 text-muted-foreground" />}
                    link={`/app/reports/Purchase category summary?from=${range.from}&to=${range.to}`}
                    title={stat.label}
                    content={
                      stat.type === "number"
                        ? formatNumber(reports[stat.value])
                        : "₦ " + formatNumber1(reports[stat.value])
                    }
                  />
                </>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className=" backdrop-blur-sm border-gray-700/50 shadow-2xl">
              <CardHeader>
                <CardTitle className="text- flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  Sales Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.chartData.sales}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="sales"
                      stroke="#10B981"
                      strokeWidth={3}
                      dot={{ fill: "#10B981", strokeWidth: 2, r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      dot={{ fill: "#3B82F6", strokeWidth: 2, r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className=" backdrop-blur-sm border-gray-700/50 shadow-2xl">
              <CardHeader>
                <CardTitle className="text- flex items-center gap-2">
                  <Package className="w-5 h-5 text-cyan-400" />
                  Category Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.chartData.categories}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Widgets Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.widgets.map((widget, index) => (
              <Card
                key={index}
                className=" border-gray-700/50 shadow-2xl hover:shadow-3xl transition-all duration-300"
              >
                <CardHeader className=" border-gray-700/50">
                  <CardTitle className="text-[var(--aa-navy)] flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full bg-gradient-to-r ${data.gradient} animate-pulse`}
                    ></div>
                    {widget.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-2">
                  {renderWidget(widget)}
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

RetailersDashboard.propTypes = {
  range: PropTypes.object.isRequired,
};
