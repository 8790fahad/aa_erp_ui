import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import moment from "moment";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, RefreshCw, TrendingUp } from "lucide-react";
import { _postApi } from "@/redux/actions/api";
import { toast } from "sonner";

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtSigned = (n) => {
  const v = Number(n || 0);
  return v < 0 ? `(${fmt(Math.abs(v))})` : fmt(v);
};

const SectionRows = ({ title, lines = [] }) => {
  if (!lines || lines.length === 0) return null;
  return (
    <>
      <tr className="bg-gray-50">
        <td colSpan={3} className="px-4 py-1.5 text-xs font-bold text-gray-700">
          {title}
        </td>
      </tr>
      {lines.map((l) => (
        <tr key={`${title}-${l.account_code}`} className="hover:bg-blue-50/30">
          <td className="px-4 py-1.5 text-sm text-gray-700">
            <span className="text-[10px] font-mono text-gray-400 mr-2">
              {l.account_code}
            </span>
            {l.account_name}
          </td>
          <td className="px-4 py-1.5 text-sm text-right">
            {fmtSigned(l.cumulative)}
          </td>
          <td className="px-4 py-1.5 text-sm text-right">
            {fmtSigned(l.current_month)}
          </td>
        </tr>
      ))}
    </>
  );
};

const TotalRow = ({ label, cum, cur, accent }) => (
  <tr className={accent ? "bg-[var(--aa-navy)]/10 font-bold" : "bg-gray-100 font-semibold"}>
    <td className="px-4 py-2 text-sm">{label}</td>
    <td className="px-4 py-2 text-sm text-right">{fmtSigned(cum)}</td>
    <td className="px-4 py-2 text-sm text-right">{fmtSigned(cur)}</td>
  </tr>
);

export default function ProfitLossSummary() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const today = moment().format("YYYY-MM-DD");
  const yearStart = moment().startOf("year").format("YYYY-MM-DD");

  const [dateFrom, setDateFrom] = useState(yearStart);
  const [dateTo, setDateTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  const fetchReport = useCallback(() => {
    if (!activeBusiness?.id) return;
    if (!dateFrom || !dateTo) {
      toast.error("Please select date range");
      return;
    }

    setLoading(true);
    _postApi(
      "/accounting/profit-loss-summary",
      {
        facilityId: activeBusiness.id,
        dateFrom,
        dateTo,
      },
      (resp) => {
        setLoading(false);
        if (resp.success) {
          setReport(resp.data);
        } else {
          toast.error(resp.message || "Failed to load Profit & Loss report");
        }
      },
      (err) => {
        setLoading(false);
        console.error(err);
        toast.error(err?.message || "Error loading Profit & Loss report");
      }
    );
  }, [activeBusiness?.id, dateFrom, dateTo]);

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusiness?.id]);

  const handlePrint = () => window.print();

  const cmStart = report?.period?.current_month?.start;
  const cmEnd = report?.period?.current_month?.end;

  return (
    <div className="p-6 space-y-6 print:p-0 print:space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between print:mb-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-[var(--aa-navy)]" />
            Profit &amp; Loss Summary
          </h1>
          <p className="text-gray-600 mt-1">
            Operating P&amp;L driven by chart-of-accounts metadata
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            disabled={!report}
            className="flex items-center gap-1.5"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">
                From
              </Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="md:col-span-2 flex items-end justify-end">
              <Button
                onClick={fetchReport}
                disabled={loading}
                className="bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white flex items-center gap-1.5"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                {loading ? "Loading..." : "Generate"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Print header (only on print) */}
      <div className="hidden print:block">
        <h2 className="text-lg font-bold">{activeBusiness?.name || ""}</h2>
        <h3 className="text-base font-semibold">Profit &amp; Loss Summary</h3>
        <p className="text-sm">
          {dateFrom} → {dateTo}
        </p>
      </div>

      {/* Report */}
      {!report && !loading ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-gray-500">
            No data yet. Choose a date range and click Generate.
          </CardContent>
        </Card>
      ) : !report ? null : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Period: {report.period.date_from} → {report.period.date_to}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border border-gray-200">
                <thead className="bg-[var(--aa-navy)]/8">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-[var(--aa-navy)] uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-bold text-[var(--aa-navy)] uppercase tracking-wider w-[20%]">
                      Cumulative
                      <div className="text-[9px] font-normal text-gray-500 normal-case mt-0.5">
                        {report.period.date_from} → {report.period.date_to}
                      </div>
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-bold text-[var(--aa-navy)] uppercase tracking-wider w-[20%]">
                      Current Month
                      <div className="text-[9px] font-normal text-gray-500 normal-case mt-0.5">
                        {cmStart} → {cmEnd}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* Sales & Stock */}
                  <SectionRows
                    title="Sales"
                    lines={report.sales_and_stock?.sales?.lines || []}
                  />
                  <TotalRow
                    label="Total Sales"
                    cum={report.sales_and_stock?.sales?.cumulative}
                    cur={report.sales_and_stock?.sales?.current_month}
                  />
                  <tr>
                    <td className="px-4 py-1.5 pl-8 text-sm text-gray-700">
                      Less: Opening Stock
                    </td>
                    <td className="px-4 py-1.5 text-right text-sm">
                      {fmtSigned(report.sales_and_stock?.opening_stock?.cumulative)}
                    </td>
                    <td className="px-4 py-1.5 text-right text-sm">
                      {fmtSigned(report.sales_and_stock?.opening_stock?.current_month)}
                    </td>
                  </tr>
                  <TotalRow
                    label="Sales (Net of Opening)"
                    cum={report.sales_and_stock?.sales_net?.cumulative}
                    cur={report.sales_and_stock?.sales_net?.current_month}
                  />
                  <tr>
                    <td className="px-4 py-1.5 pl-8 text-sm text-gray-700">
                      Add: Closing Stock
                    </td>
                    <td className="px-4 py-1.5 text-right text-sm">
                      {fmtSigned(report.sales_and_stock?.closing_stock?.cumulative)}
                    </td>
                    <td className="px-4 py-1.5 text-right text-sm">
                      {fmtSigned(report.sales_and_stock?.closing_stock?.current_month)}
                    </td>
                  </tr>
                  <TotalRow
                    label="Adjusted Output"
                    accent
                    cum={report.sales_and_stock?.adjusted_output?.cumulative}
                    cur={report.sales_and_stock?.adjusted_output?.current_month}
                  />

                  {/* Material Consumption */}
                  <SectionRows
                    title="Material Consumption"
                    lines={report.material_consumption?.lines || []}
                  />
                  <TotalRow
                    label="Total Material Consumption"
                    cum={report.material_consumption?.totals?.cumulative}
                    cur={report.material_consumption?.totals?.current_month}
                  />

                  {/* Conversion Margin */}
                  <TotalRow
                    label="Conversion Margin"
                    accent
                    cum={report.conversion_margin?.cumulative}
                    cur={report.conversion_margin?.current_month}
                  />

                  {/* Manufacturing Expenses */}
                  <SectionRows
                    title="Manufacturing Expenses"
                    lines={report.manufacturing_expenses?.lines || []}
                  />
                  <TotalRow
                    label="Total Manufacturing"
                    cum={report.manufacturing_expenses?.totals?.cumulative}
                    cur={report.manufacturing_expenses?.totals?.current_month}
                  />

                  {/* Admin */}
                  <SectionRows
                    title="Office &amp; Admin Expenses"
                    lines={report.admin_expenses?.lines || []}
                  />
                  <TotalRow
                    label="Total Admin"
                    cum={report.admin_expenses?.totals?.cumulative}
                    cur={report.admin_expenses?.totals?.current_month}
                  />

                  {/* Selling */}
                  <SectionRows
                    title="Selling &amp; Distribution Expenses"
                    lines={report.selling_expenses?.lines || []}
                  />
                  <TotalRow
                    label="Total Selling"
                    cum={report.selling_expenses?.totals?.cumulative}
                    cur={report.selling_expenses?.totals?.current_month}
                  />

                  {/* Financial */}
                  <SectionRows
                    title="Financial Expenses"
                    lines={report.financial_expenses?.lines || []}
                  />
                  <TotalRow
                    label="Total Financial"
                    cum={report.financial_expenses?.totals?.cumulative}
                    cur={report.financial_expenses?.totals?.current_month}
                  />

                  {/* Total Expenses */}
                  <TotalRow
                    label="Total Expenses"
                    accent
                    cum={report.total_expenses?.cumulative}
                    cur={report.total_expenses?.current_month}
                  />

                  {/* Operating Margin */}
                  <TotalRow
                    label="Operating Net Margin"
                    accent
                    cum={report.operating_net_margin?.cumulative}
                    cur={report.operating_net_margin?.current_month}
                  />

                  {/* Other Income */}
                  <SectionRows
                    title="Other Income"
                    lines={report.other_income?.lines || []}
                  />
                  <TotalRow
                    label="Total Other Income"
                    cum={report.other_income?.totals?.cumulative}
                    cur={report.other_income?.totals?.current_month}
                  />

                  {/* Net Margin */}
                  <tr className="bg-[var(--aa-navy)] text-white font-bold">
                    <td className="px-4 py-3 text-sm">Total Net Margin</td>
                    <td className="px-4 py-3 text-right text-sm">
                      {fmtSigned(report.net_margin?.cumulative)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {fmtSigned(report.net_margin?.current_month)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
