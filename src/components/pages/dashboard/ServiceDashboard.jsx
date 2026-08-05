import Widget from "@/common/Widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  TrendingUp,
  Calendar,
  Users,
  Activity,
  BarChart3,
} from "lucide-react";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  
  ResponsiveContainer,
  Legend,
} from "recharts";
import { CustomTooltip } from "./CustomDashboard";
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import PropTypes from "prop-types";
import { Badge, Progress } from "reactstrap/lib";

export default function ServiceDashboard({range}) {
    const {activeBusiness} = useSelector((state) => state.auth);
    const data = {
      title: "Service Management Dashboard",
      icon: Users,
      gradient: "from-blue-600 via-purple-600 to-indigo-700",
      accentColor: "blue",

      chartData: {
        weekly: [
          { name: "Mon", completed: 12, scheduled: 15, efficiency: 80 },
          { name: "Tue", completed: 19, scheduled: 22, efficiency: 86 },
          { name: "Wed", completed: 15, scheduled: 18, efficiency: 83 },
          { name: "Thu", completed: 22, scheduled: 25, efficiency: 88 },
          { name: "Fri", completed: 28, scheduled: 30, efficiency: 93 },
          { name: "Sat", completed: 18, scheduled: 20, efficiency: 90 },
          { name: "Sun", completed: 14, scheduled: 16, efficiency: 87 },
        ],
        serviceTypes: [
          { name: "Maintenance", value: 35, color: "#3B82F6" },
          { name: "Repair", value: 25, color: "#8B5CF6" },
          { name: "Installation", value: 20, color: "#06B6D4" },
          { name: "Inspection", value: 20, color: "#10B981" },
        ],
      },
      widgets: [
        {
          title: "Service Status Overview",
          type: "status",
          data: [
            {
              service: "HVAC Maintenance",
              status: "In Progress",
              priority: "High",
              eta: "2 hours",
              progress: 75,
            },
            {
              service: "Plumbing Repair",
              status: "Scheduled",
              priority: "Medium",
              eta: "4 hours",
              progress: 0,
            },
            {
              service: "Electrical Check",
              status: "Completed",
              priority: "Low",
              eta: "Done",
              progress: 100,
            },
            {
              service: "Cleaning Service",
              status: "Pending",
              priority: "Medium",
              eta: "6 hours",
              progress: 25,
            },
          ],
        },
        {
          title: "Recent Activity",
          type: "activity",
          data: [
            {
              action: "Service completed",
              item: "Office Cleaning",
              time: "10 min ago",
              type: "success",
            },
            {
              action: "Inventory used",
              item: "Cleaning Supplies",
              time: "25 min ago",
              type: "info",
            },
            {
              action: "Task scheduled",
              item: "Equipment Maintenance",
              time: "1 hour ago",
              type: "warning",
            },
            {
              action: "Service started",
              item: "Security Check",
              time: "2 hours ago",
              type: "info",
            },
          ],
        },
      ],
    };
    const stats = [
      {
        label: "Active Clients",
        value: "active_clients",
        change: "+12%",
        trend: "up",
        icon: Activity,
      },
      {
        label: "Invoices Issued",
        value: "invoices_issued",
        change: "+8%",
        trend: "up",
        icon: Calendar,
      },
      {
        label: "Service Revenue",
        value: "service_revenue",
        change: "-5%",
        trend: "down",
        icon: Package,
      },
      {
        label: "Expenses",
        value: "expenses",
        change: "+3%",
        trend: "down",
        icon: TrendingUp,
      },
    ];
 const [reports, setReports] = useState({active_clients: 0, invoices_issued: 0, service_revenue: 0, expenses: 0});
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
      case "status":
        return (
          <div className="space-y-4">
            {widget.data.map((item, index) => (
              <div
                key={index}
                className="p-4 bg-[#4267B2] backdrop-blur-sm rounded-xl border border-gray-700/50 hover:border-orange-500/50 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-white">{item.service}</p>
                  <Badge
                    variant={
                      item.status === "In Progress" ? "default" : "secondary"
                    }
                    className="animate-pulse"
                  >
                    {item.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                  <span>{item.priority}</span>
                  <span>{item.eta}</span>
                </div>
                <Progress value={item.progress} className="h-2" />
              </div>
            ))}
          </div>
        );

      case "activity":
        return (
          <div className="space-y-4">
            {widget.data.map((item, index) => (
              <div
                key={index}
                className="p-4 bg-[#4267B2] backdrop-blur-sm rounded-xl border border-gray-700/50 hover:border-orange-500/50 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-white">{item.action}</p>
                  <span className="text-sm font-medium text-orange-400">
                    {item.item}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                  <span>{item.time}</span>
                  <Badge variant="default">{item.type}</Badge>
                </div>
              </div>
            ))}
          </div>
        );
    }
  };
  return (
    <div className="min-h-screen text-white">
      <div className="">
        <main className="py-4 relative ">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat , index) => {
              const Icon = stat.icon;
              return (
                <div key={index}>
                  <Widget
                    icon={<Icon className="h-4 w-4 text-muted-foreground" />}
                    link={`/app/reports/Purchase category summary?from=${range.from}&to=${range.to}`}
                    title={stat.label}
                    content={stat.trend === "up" ? reports[stat.value] : formatNumber1(reports[stat.value])}
                  />
                </div>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className=" backdrop-blur-sm border-gray-700/50 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-[#4267B2] flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  Weekly Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.chartData.weekly}>
                    <defs>
                      <linearGradient
                        id="completedGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#3B82F6"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3B82F6"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                      <linearGradient
                        id="scheduledGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#8B5CF6"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#8B5CF6"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      stroke="#3B82F6"
                      fillOpacity={1}
                      fill="url(#completedGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="scheduled"
                      stroke="#8B5CF6"
                      fillOpacity={1}
                      fill="url(#scheduledGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className=" backdrop-blur-sm border-gray-700/50 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-[#4267B2] flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-400" />
                  Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.chartData.serviceTypes}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {data.chartData.serviceTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
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
                  <CardTitle className="text-[#4267B2] flex items-center gap-2">
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

ServiceDashboard.propTypes = {
  range: PropTypes.object.isRequired,
};
