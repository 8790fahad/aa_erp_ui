import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import PropTypes from "prop-types";
import CustomCard from "@/common/Custom/CustomCard2";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Calendar,
  Building2,
  FileText,
  Calculator,
  TrendingUp,
  BarChart3,
  PieChart,
  Receipt,
  Shield,
  DollarSign,
} from "lucide-react";
// import TrialBalanceReport from "./components/TrialBalanceReport";
import IncomeStatementReport from "./components/IncomeStatementReport";
import BalanceSheetReport from "./components/BalanceSheetReport";
import CashFlowReport from "./components/CashFlowReport";
import EquityChangesReport from "./components/EquityChangesReport";
import GeneralLedgerReport from "./components/GeneralLedgerReport";
import VATReport from "./components/VATReport";
import WHTReport from "./components/WHTReport";
import CITReport from "./components/CITReport";
import TaxSummaryReport from "./components/TaxSummaryReport";

const AccountingReports = ({ defaultTab }) => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const { "*": tabParam } = useParams();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("2025-09-09");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab || "trial-balance");

  // Get facility ID from Redux state
  const facilityId = activeBusiness?.id || user?.facilityId || "";

  // Set default from date to beginning of year
  useEffect(() => {
    if (!fromDate) {
      const currentYear = new Date().getFullYear();
      setFromDate(`${currentYear}-01-01`);
    }
  }, [fromDate]);

  // Handle URL parameters for direct tab access
  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    } else if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [tabParam, defaultTab]);

  const handleDateChange = (field, value) => {
    if (field === "fromDate") {
      setFromDate(value);
    } else {
      setToDate(value);
    }
  };

  if (!facilityId) {
    return (
      <CustomCard header="Comprehensive Accounting Reports - IFRS & FIRS Compliant">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Please ensure you have selected a facility/business to generate
            reports.
          </AlertDescription>
        </Alert>
      </CustomCard>
    );
  }

  return (
    <div className="container-fluid">
      <CustomCard header="Comprehensive Accounting Reports - IFRS & FIRS Compliant">
        {/* Compliance Information */}
        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription className="ml-2 text-blue-800">
            <strong>IFRS Compliance:</strong> All financial statements follow
            International Financial Reporting Standards.{" "}
            <strong>FIRS Compliance:</strong> Tax reports comply with Nigerian
            Federal Inland Revenue Service requirements.
          </AlertDescription>
        </Alert>

        {/* Report Parameters */}
        <Card className="mb-6">
          <CardHeader className="bg-blue-50">
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Building2 className="h-5 w-5" />
              Report Parameters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="fromDate">From Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="fromDate"
                    type="date"
                    value={fromDate}
                    onChange={(e) =>
                      handleDateChange("fromDate", e.target.value)
                    }
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="toDate">To Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="toDate"
                    type="date"
                    value={toDate}
                    onChange={(e) => handleDateChange("toDate", e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Button
                onClick={() => setLoading(true)}
                disabled={!facilityId || !toDate || loading}
                className="w-full bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Reports
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Report Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10 mb-6 bg-blue-50">
            <TabsTrigger value="trial-balance" className="text-xs">
              <BarChart3 className="h-4 w-4 mr-1" />
              Trial Balance
            </TabsTrigger>
            <TabsTrigger value="income-statement" className="text-xs">
              <TrendingUp className="h-4 w-4 mr-1" />
              Income Statement
            </TabsTrigger>
            <TabsTrigger value="balance-sheet" className="text-xs">
              <PieChart className="h-4 w-4 mr-1" />
              Balance Sheet
            </TabsTrigger>
            <TabsTrigger value="cash-flow" className="text-xs">
              <DollarSign className="h-4 w-4 mr-1" />
              Cash Flow
            </TabsTrigger>
            <TabsTrigger value="equity-changes" className="text-xs">
              <Calculator className="h-4 w-4 mr-1" />
              Equity Changes
            </TabsTrigger>
            <TabsTrigger value="general-ledger" className="text-xs">
              <FileText className="h-4 w-4 mr-1" />
              General Ledger
            </TabsTrigger>
            <TabsTrigger value="vat-report" className="text-xs">
              <Receipt className="h-4 w-4 mr-1" />
              VAT Report
            </TabsTrigger>
            <TabsTrigger value="wht-report" className="text-xs">
              <Shield className="h-4 w-4 mr-1" />
              WHT Report
            </TabsTrigger>
            <TabsTrigger value="cit-report" className="text-xs">
              <Calculator className="h-4 w-4 mr-1" />
              CIT Computation
            </TabsTrigger>
            <TabsTrigger value="tax-summary" className="text-xs">
              <BarChart3 className="h-4 w-4 mr-1" />
              Tax Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trial-balance">
            <TrialBalanceReport
              facilityId={facilityId}
              asOfDate={toDate}
              loading={loading}
              setLoading={setLoading}
            />
          </TabsContent>

          <TabsContent value="income-statement">
            <IncomeStatementReport
              facilityId={facilityId}
              fromDate={fromDate}
              toDate={toDate}
              loading={loading}
              setLoading={setLoading}
            />
          </TabsContent>

          <TabsContent value="balance-sheet">
            <BalanceSheetReport
              facilityId={facilityId}
              asOfDate={toDate}
              loading={loading}
              setLoading={setLoading}
            />
          </TabsContent>

          <TabsContent value="cash-flow">
            <CashFlowReport
              facilityId={facilityId}
              fromDate={fromDate}
              toDate={toDate}
              loading={loading}
              setLoading={setLoading}
            />
          </TabsContent>

          <TabsContent value="equity-changes">
            <EquityChangesReport
              facilityId={facilityId}
              fromDate={fromDate}
              toDate={toDate}
              loading={loading}
              setLoading={setLoading}
            />
          </TabsContent>

          <TabsContent value="general-ledger">
            <GeneralLedgerReport
              facilityId={facilityId}
              asOfDate={toDate}
              loading={loading}
              setLoading={setLoading}
            />
          </TabsContent>

          <TabsContent value="vat-report">
            <VATReport
              facilityId={facilityId}
              fromDate={fromDate}
              toDate={toDate}
              loading={loading}
              setLoading={setLoading}
            />
          </TabsContent>

          <TabsContent value="wht-report">
            <WHTReport
              facilityId={facilityId}
              fromDate={fromDate}
              toDate={toDate}
              loading={loading}
              setLoading={setLoading}
            />
          </TabsContent>

          <TabsContent value="cit-report">
            <CITReport
              facilityId={facilityId}
              fromDate={fromDate}
              toDate={toDate}
              loading={loading}
              setLoading={setLoading}
            />
          </TabsContent>

          <TabsContent value="tax-summary">
            <TaxSummaryReport
              facilityId={facilityId}
              fromDate={fromDate}
              toDate={toDate}
              loading={loading}
              setLoading={setLoading}
            />
          </TabsContent>
        </Tabs>
      </CustomCard>
    </div>
  );
};

AccountingReports.propTypes = {
  defaultTab: PropTypes.string,
};

export default AccountingReports;
