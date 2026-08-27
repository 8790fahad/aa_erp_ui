import Widget from "@/common/Widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  TrendingUp,
  AlertTriangle,
  Factory,
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
import PropTypes from "prop-types";
import { useCallback, useEffect, useState } from "react";
import { _fetchApi } from "@/redux/actions/api";
import { useSelector } from "react-redux";
import { formatNumber } from "@/utilities";
import { formatNumber1 } from "@/components/router/utilities";
import { Badge, Progress } from "reactstrap/lib";


export default function ManufacturingDashboard({range}) {
      const { activeBusiness } = useSelector((state) => state.auth);
    const data = {
      title: "Manufacturing Dashboard",
      icon: Factory,
      gradient: "from-orange-600 via-red-600 to-pink-700",
      accentColor: "orange",
    
      chartData: {
        production: [
          { name: "00:00", produced: 45, target: 50, efficiency: 90 },
          { name: "04:00", produced: 48, target: 50, efficiency: 96 },
          { name: "08:00", produced: 52, target: 50, efficiency: 104 },
          { name: "12:00", produced: 49, target: 50, efficiency: 98 },
          { name: "16:00", produced: 51, target: 50, efficiency: 102 },
          { name: "20:00", produced: 47, target: 50, efficiency: 94 },
        ],
        materials: [
          { name: "Steel", usage: 75, color: "#6B7280" },
          { name: "Aluminum", usage: 60, color: "#9CA3AF" },
          { name: "Plastic", usage: 45, color: "#3B82F6" },
          { name: "Copper", usage: 30, color: "#F59E0B" },
        ],
      },
      widgets: [
        {
          title: "Production Pipeline",
          type: "pipeline",
          data: [
            {
              line: "Assembly Line A",
              status: "Running",
              output: "145 units/hr",
              efficiency: 96,
              temperature: "Normal",
            },
            {
              line: "Assembly Line B",
              status: "Maintenance",
              output: "0 units/hr",
              efficiency: 0,
              temperature: "Offline",
            },
            {
              line: "Quality Control",
              status: "Running",
              output: "180 units/hr",
              efficiency: 89,
              temperature: "Normal",
            },
            {
              line: "Packaging",
              status: "Running",
              output: "165 units/hr",
              efficiency: 92,
              temperature: "Normal",
            },
          ],
        },
        {
          title: "Material Consumption",
          type: "consumption",
          data: [
            {
              material: "Steel Sheets",
              consumed: "450 kg",
              remaining: "1,200 kg",
              usage: 27,
              cost: "₦1,250",
            },
            {
              material: "Plastic Components",
              consumed: "230 units",
              remaining: "890 units",
              usage: 21,
              cost: "₦890",
            },
            {
              material: "Electronic Parts",
              consumed: "145 units",
              remaining: "455 units",
              usage: 24,
              cost: "₦2,100",
            },
            {
              material: "Packaging Materials",
              consumed: "340 units",
              remaining: "1,100 units",
              usage: 24,
              cost: "₦450",
            },
          ],
        },
      ],
    };
    const stats = [
        {
          label: "Production Rate",
          value: "94%",
          change: "+6%",
          type: "number",
          icon: Factory,
        },
        {
          label: "Raw Materials",
          value: "2,340 units",
          change: "-8%",
          type: "number",
          icon: Package,
        },
        {
          label: "Quality Score",
          value: "98.5%",
          change: "+1.2%",
          type: "number",
          icon: TrendingUp,
        },
        {
          label: "Wastage Rate",
          value: "2.1%",
          change: "-0.5%",
          type: "number",
          icon: AlertTriangle,
        },
      ]
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
      case "pipeline":
        return (
          <div className="space-y-4">
            {widget.data.map((item, index) => (
              <div
                key={index}
                className="p-4 bg-[var(--aa-navy)] backdrop-blur-sm rounded-xl border border-gray-700/50 hover:border-orange-500/50 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-white">{item.line}</p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        item.status === "Running" ? "default" : "secondary"
                      }
                      className="animate-pulse"
                    >
                      {item.status}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {item.temperature}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                  <span>{item.output}</span>
                  <span>{item.efficiency}% efficiency</span>
                </div>
                <Progress value={item.efficiency} className="h-2" />
              </div>
            ))}
          </div>
        );

      case "consumption":
        return (
          <div className="space-y-4">
            {widget.data.map((item, index) => (
              <div
                key={index}
                className="p-4 bg-[var(--aa-navy)] backdrop-blur-sm rounded-xl border border-gray-700/50 hover:border-orange-500/50 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-white">{item.material}</p>
                  <span className="text-sm font-medium text-orange-400">
                    {item.cost}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                  <span>Used: {item.consumed}</span>
                  <span>Remaining: {item.remaining}</span>
                </div>
                <Progress value={item.usage} className="h-2" />
              </div>
            ))}
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
                        <CardTitle className="text-white flex items-center gap-2">
                          <Factory className="w-5 h-5 text-orange-400" />
                          Production Metrics
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={data.chartData.production}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="name" stroke="#9CA3AF" />
                            <YAxis stroke="#9CA3AF" />
                            <Tooltip content={<CustomTooltip />} />
                            <Line
                              type="monotone"
                              dataKey="produced"
                              stroke="#F59E0B"
                              strokeWidth={3}
                              dot={{ fill: "#F59E0B", strokeWidth: 2, r: 6 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="target"
                              stroke="#EF4444"
                              strokeWidth={3}
                              strokeDasharray="5 5"
                              dot={{ fill: "#EF4444", strokeWidth: 2, r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
        
                    <Card className=" backdrop-blur-sm border-gray-700/50 shadow-2xl">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                          <Package className="w-5 h-5 text-red-400" />
                          Material Usage
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={data.chartData.materials} layout="horizontal">
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis type="number" stroke="#9CA3AF" />
                            <YAxis dataKey="name" type="category" stroke="#9CA3AF" />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="usage" fill="#F59E0B" radius={[0, 4, 4, 0]} />
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

ManufacturingDashboard.propTypes = {
  range: PropTypes.object.isRequired,
};