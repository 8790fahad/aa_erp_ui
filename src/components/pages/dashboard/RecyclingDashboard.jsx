import Widget from "@/common/Widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  TrendingUp,
  Recycle,
  Activity,
  Zap,
  Leaf,
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
import { formatNumber } from "@/utilities";
import { BiCollection } from "react-icons/bi";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import PropTypes from "prop-types";

export default function RecyclingDashboard({ range }) {
  const { activeBusiness } = useSelector((state) => state.auth);
  const data = {
    title: "Recycling Operations Dashboard",
    icon: Recycle,
    gradient: "from-green-600 via-emerald-600 to-teal-700",
    accentColor: "green",
    stats: [
      {
        label: "Material Intake",
        value: "1,245 kg",
        change: "+22%",
        trend: "up",
        icon: Package,
      },
      {
        label: "Processing Rate",
        value: "89%",
        change: "+7%",
        trend: "up",
        icon: Activity,
      },
      {
        label: "Recycled Output",
        value: "1,108 kg",
        change: "+19%",
        trend: "up",
        icon: Recycle,
      },
      {
        label: "CO₂ Saved",
        value: "2.3 tons",
        change: "+25%",
        trend: "up",
        icon: Leaf,
      },
    ],
    chartData: {
      materials: [
        { name: "Week 1", black: 240, white: 180, color: 320, other: 120 },
        { name: "Week 2", black: 280, white: 210, color: 290, other: 140 },
        { name: "Week 3", black: 310, white: 190, color: 340, other: 110 },
        { name: "Week 4", black: 290, white: 230, color: 310, other: 130 },
      ],
      distribution: [
        { name: "Black", value: 35, color: "#000000" },
        { name: "White", value: 28, color: "#10B981" },
        { name: "Color", value: 22, color: "#F59E0B" },
        { name: "Other", value: 15, color: "#EF4444" },
      ],
    },
    widgets: [
      {
        title: "Material Processing Stages",
        type: "processing",
        data: [
          {
            stage: "Collection",
            amount: "1,245 kg",
            progress: 100,
            status: "complete",
            efficiency: 98,
          },
          {
            stage: "Sorting",
            amount: "1,180 kg",
            progress: 85,
            status: "active",
            efficiency: 92,
          },
          {
            stage: "Filter",
            amount: "890 kg",
            progress: 65,
            status: "active",
            efficiency: 87,
          },
          {
            stage: "Bangori",
            amount: "756 kg",
            progress: 45,
            status: "pending",
            efficiency: 94,
          },
        ],
      },
      {
        title: "Enery Consumption",
        type: "impact",
        data: [
          {
            metric: "Energy Used",
            value: "1,450 kWh",
            icon: Zap,
            color: "white",
          },
          {
            metric: "Water Conserved",
            value: "890 L",
            icon: Activity,
            color: "white",
          },
          {
            metric: "Landfill Diverted",
            value: "1,108 kg",
            icon: Recycle,
            color: "white",
          },
          { metric: "Trees Saved", value: "12", icon: Leaf, color: "white" },
        ],
      },
    ],
  };
  const stats = [
    {
      label: "Material Collected (KG)",
      value: "material_collected",
      change: "+12%",
      type: "number",
      icon: BiCollection,
    },
    {
      label: "Recycled Batches",
      value: "recycled_batches",
      change: "+8%",
      type: "number",
      icon: Recycle,
    },
    {
      label: "Pending Processing",
      value: "pending_processing",
      change: "-5%",
      type: "number",
      icon: Package,
    },
    {
      label: "Revenue Generated",
      value: "revenue_generated",
      change: "+3%",
      type: "money",
      icon: TrendingUp,
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
      case "processing":
        return (
          <div className="space-y-4">
            {widget.data.map((item, index) => (
              <div
                key={index}
                className="p-4 bg-gradient-to-r from-[var(--aa-navy)] to-[#4267B3] backdrop-blur-sm rounded-xl border border-gray-700/50 hover:border-green-500/50 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-white">{item.stage}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{item.amount}</span>
                    <Badge
                      variant={
                        item.status === "complete" ? "default" : "secondary"
                      }
                    >
                      {item.efficiency}% eff.
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Progress
                    value={item.progress}
                    className="flex-1 h-3 bg-white"
                  />
                  <span className="text-sm text-white font-medium">
                    {item.progress}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        );

      case "impact":
        return (
          <div className="grid grid-cols-2 gap-4">
            {widget.data.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={index}
                  className={`p-4 bg-gradient-to-br from-[var(--aa-navy)] to-[#4267B3] backdrop-blur-sm rounded-xl border border-gray-700/50 hover:border-${item.color}-500/50 transition-all duration-300 text-center group`}
                >
                  <Icon
                    className={` absolute w-6 h-6 mx-auto mb-3 text-${item.color} group-hover:scale-110 transition-transform`}
                  />
                  <p className="text-sm text-white mb-1">{item.metric}</p>
                  <p className="font-bold text-white text-lg">{item.value}</p>
                </div>
              );
            })}
          </div>
        );
      default:
        return <div>Widget type not supported</div>;
    }
  }

  return (
    <div className="min-h-screen text-white">
      <div className="">
        <main className="py-4 relative ">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat,index) => {
              const Icon = stat.icon;
              return (
                <div key={index}>
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
                </div>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className=" backdrop-blur-sm border-gray-700/50 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-[var(--aa-navy)] flex items-center gap-2">
                  <Recycle className="w-5 h-5 text-green-400" />
                  Material Intake
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.chartData.materials}>
                    <defs>
                      <linearGradient
                        id="plasticGradient"
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
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="black"
                      stackId="1"
                      stroke="#3B82F6"
                      fill="url(#plasticGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="white"
                      stackId="1"
                      stroke="#F59E0B"
                      fill="#F59E0B"
                    />
                    <Area
                      type="monotone"
                      dataKey="color"
                      stackId="1"
                      stroke="#10B981"
                      fill="#10B981"
                    />
                    <Area
                      type="monotone"
                      dataKey="other"
                      stackId="1"
                      stroke="#EF4444"
                      fill="#EF4444"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className=" backdrop-blur-sm border-gray-700/50 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-[var(--aa-navy)] flex items-center gap-2">
                  <Leaf className="w-5 h-5 text-emerald-400" />
                  Material Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.chartData.distribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {data.chartData.distribution.map((entry, index) => (
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

RecyclingDashboard.propTypes = {
  range: PropTypes.object.isRequired,
};
