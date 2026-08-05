import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Factory } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { REPORT_META } from "./productionReportingDemoData";
import { canAccessAnyProductionReport } from "@/components/pages/report/utils/reportPermissions";
import { useReportPermissions } from "@/components/pages/report/hooks/useReportPermissions";
import { ACCOUNTING_REPORT_SECTIONS } from "@/components/pages/report/utils/accountingReportCatalog";
import ReportHubSection, {
  filterReportItemsByPermission,
} from "@/components/pages/report/components/ReportHubSection";

const PRODUCTION_SECTION = ACCOUNTING_REPORT_SECTIONS.find(
  (s) => s.id === "production",
);

export default function ProductionReportingHub() {
  const navigate = useNavigate();
  const { user, activeBusiness, canViewReportEntry } = useReportPermissions();

  const section = useMemo(() => {
    if (!PRODUCTION_SECTION) return null;
    const items = filterReportItemsByPermission(
      PRODUCTION_SECTION.items || [],
      canViewReportEntry,
    );
    if (!items.length) return null;
    return {
      ...PRODUCTION_SECTION,
      title: "Production Reports",
      subtitle: PRODUCTION_SECTION.subtitle,
      icon: Factory,
      items,
    };
  }, [canViewReportEntry]);

  const navState = (mode) => {
    const today = new Date().toISOString().split("T")[0];
    const year = REPORT_META.defaultPeriod.fromDate.slice(0, 4);
    if (mode === "asOf") return { asOfDate: today };
    return {
      fromDate: REPORT_META.defaultPeriod.fromDate || `${year}-01-01`,
      toDate: REPORT_META.defaultPeriod.toDate || today,
    };
  };

  if (!canAccessAnyProductionReport(user, activeBusiness)) {
    return (
      <div className="space-y-8 pb-12">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Production Reports
          </h1>
        </div>
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              You do not have permission to view production reports. Ask an
              administrator to grant access under Admin → Manage Staffs →
              Permissions.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Production Reports</h1>
        <p className="text-gray-600 mt-1 max-w-3xl">
          Production output, finished goods and raw materials inventory, and sales
          by product. Open a report to set dates on that screen.
        </p>
      </div>

      {section ? (
        <ReportHubSection
          section={section}
          onNavigate={(item) =>
            item.path && navigate(item.path, { state: navState(item.dateMode) })
          }
        />
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-gray-500">
            No production reports are available for your permissions.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
