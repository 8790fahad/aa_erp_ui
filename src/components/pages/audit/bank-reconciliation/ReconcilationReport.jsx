import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Download, Calendar, TrendingUp, FileText, Eye, Filter, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSelector } from 'react-redux';
import { _fetchApi } from '@/redux/actions/api';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';

const ReconciliationReports = ({ selectedAccount }) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  
  const currentDate = new Date();
  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(false);
  const [monthlyData, setMonthlyData] = useState([]);
  const [discrepancyTypeData, setDiscrepancyTypeData] = useState([]);
  const [reconciliationEfficiency, setReconciliationEfficiency] = useState([]);
  const [keyMetrics, setKeyMetrics] = useState({
    matchRate: 0,
    matchRateChange: 0,
    avgResolutionTime: 0,
    monthlyVolume: 0,
    exceptionRate: 0
  });
  const [summary, setSummary] = useState({
    totalMatched: 0,
    totalUnmatched: 0,
    totalDiscrepancies: 0,
    openDiscrepancies: 0,
    resolvedDiscrepancies: 0
  });

  const fetchReportsData = useCallback(() => {
    if (!activeBusiness?.id) {
      return;
    }

    setLoading(true);
    const params = new URLSearchParams({
      facilityId: activeBusiness.id
    });

    if (selectedAccount) {
      params.append('bankAccountId', selectedAccount);
    }
    
    if (selectedMonth) {
      params.append('month', selectedMonth);
    }

    _fetchApi(
      `/api/get/reconciliation-reports?${params.toString()}`,
      (data) => {
        if (data.success && data.results) {
          // Limit to last 6 months
          const allMonthlyData = data.results.monthlyData || [];
          const allEfficiencyData = data.results.reconciliationEfficiency || [];
          setMonthlyData(allMonthlyData.slice(-6));
          setDiscrepancyTypeData(data.results.discrepancyTypeData || []);
          setReconciliationEfficiency(allEfficiencyData.slice(-6));
          setKeyMetrics(data.results.keyMetrics || {
            matchRate: 0,
            matchRateChange: 0,
            avgResolutionTime: 0,
            monthlyVolume: 0,
            exceptionRate: 0
          });
          setSummary(data.results.summary || {
            totalMatched: 0,
            totalUnmatched: 0,
            totalDiscrepancies: 0,
            openDiscrepancies: 0,
            resolvedDiscrepancies: 0
          });
        } else {
          toast.error(data.message || "Failed to fetch reports data");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching reports data:", err);
        toast.error("Error fetching reports data");
        setLoading(false);
      }
    );
  }, [activeBusiness?.id, selectedAccount, selectedMonth]);

  useEffect(() => {
    fetchReportsData();
  }, [fetchReportsData]);

  const chartConfig = {
    matched: { label: "Matched", color: "#22c55e" },
    unmatched: { label: "Unmatched", color: "#ef4444" },
    discrepancies: { label: "Discrepancies", color: "#f97316" }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Reconciliation Reports</h2>
          <p className="text-gray-600">Analytics, summaries, and detailed reports</p>
        </div>
        <div className="flex gap-2 items-center">
          <Input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-40 h-10"
          />
          <Button variant="outline" className="flex items-center gap-2" onClick={fetchReportsData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="flex items-center gap-2 bg-[#4267B2] hover:bg-[#365899]" onClick={() => {
            const wb = XLSX.utils.book_new();
            
            // Summary Sheet
            const summaryData = [
              ['Metric', 'Value'],
              ['Total Matched', summary.totalMatched],
              ['Total Unmatched', summary.totalUnmatched],
              ['Total Discrepancies', summary.totalDiscrepancies],
              ['Open Discrepancies', summary.openDiscrepancies],
              ['Resolved Discrepancies', summary.resolvedDiscrepancies],
              ['Match Rate (%)', keyMetrics.matchRate],
              ['Avg Resolution Time (days)', keyMetrics.avgResolutionTime],
              ['Monthly Volume', keyMetrics.monthlyVolume],
              ['Exception Rate (%)', keyMetrics.exceptionRate],
            ];
            const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
            
            // Monthly Data Sheet
            if (monthlyData.length > 0) {
              const wsMonthly = XLSX.utils.json_to_sheet(monthlyData);
              XLSX.utils.book_append_sheet(wb, wsMonthly, 'Monthly Trends');
            }
            
            // Discrepancy Types
            if (discrepancyTypeData.length > 0) {
              const wsDiscrepancies = XLSX.utils.json_to_sheet(discrepancyTypeData);
              XLSX.utils.book_append_sheet(wb, wsDiscrepancies, 'Discrepancy Types');
            }
            
            XLSX.writeFile(wb, `Reconciliation_Report_${selectedMonth}.xlsx`);
          }}>
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Match Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {loading ? "..." : `${keyMetrics.matchRate}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              {keyMetrics.matchRateChange >= 0 ? '+' : ''}{keyMetrics.matchRateChange}% from previous period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : `${keyMetrics.avgResolutionTime} days`}
            </div>
            <p className="text-xs text-muted-foreground">Average time to resolve discrepancies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Volume</CardTitle>
            <FileText className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : keyMetrics.monthlyVolume.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Transactions processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exception Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : `${keyMetrics.exceptionRate}%`}
            </div>
            <p className="text-xs text-muted-foreground">Discrepancies per transaction</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Transaction Volumes</CardTitle>
            <CardDescription>Matched vs Unmatched transactions over time</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-gray-500">Loading chart data...</div>
            ) : monthlyData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500">No data available</div>
            ) : (
              <div className="w-full overflow-hidden">
                <ChartContainer config={chartConfig} className="h-64 w-full">
                  <BarChart data={monthlyData} width={undefined} height={256} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <XAxis 
                      dataKey="month" 
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      interval={0}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis width={60} tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="matched" fill="var(--color-matched)" />
                    <Bar dataKey="unmatched" fill="var(--color-unmatched)" />
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Efficiency</CardTitle>
            <CardDescription>Monthly efficiency percentage trend</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-gray-500">Loading chart data...</div>
            ) : reconciliationEfficiency.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500">No data available</div>
            ) : (
              <div className="w-full overflow-hidden">
                <ChartContainer config={{ efficiency: { label: "Efficiency %", color: "#3b82f6" } }} className="h-64 w-full">
                  <LineChart data={reconciliationEfficiency} width={undefined} height={256} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <XAxis 
                      dataKey="month" 
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      interval={0}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis domain={[0, 100]} width={60} tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="efficiency" stroke="var(--color-efficiency)" strokeWidth={2} />
                  </LineChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Discrepancy Types</CardTitle>
            <CardDescription>Breakdown of discrepancy categories</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-gray-500">Loading chart data...</div>
            ) : discrepancyTypeData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500">No discrepancies found</div>
            ) : (
              <div className="w-full overflow-hidden">
                <ChartContainer config={{}} className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={discrepancyTypeData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {discrepancyTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary Statistics</CardTitle>
            <CardDescription>Overall reconciliation statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-sm text-green-700 font-medium">Matched Transactions</div>
                  <div className="text-2xl font-bold text-green-600 mt-1">
                    {loading ? "..." : summary.totalMatched.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="text-sm text-yellow-700 font-medium">Unmatched Transactions</div>
                  <div className="text-2xl font-bold text-yellow-600 mt-1">
                    {loading ? "..." : summary.totalUnmatched.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-sm text-red-700 font-medium">Open Discrepancies</div>
                  <div className="text-2xl font-bold text-red-600 mt-1">
                    {loading ? "..." : summary.openDiscrepancies.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-700 font-medium">Resolved Discrepancies</div>
                  <div className="text-2xl font-bold text-blue-600 mt-1">
                    {loading ? "..." : summary.resolvedDiscrepancies.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReconciliationReports;
