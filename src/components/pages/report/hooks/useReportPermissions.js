import { useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import {
  canViewReport,
  getUserFunctionalities,
} from "../utils/reportPermissions";
import { getReportPermissionKey } from "../utils/accountingReportCatalog";

/** Merged functionalities + per-report check (same pattern as GoodsTransfer tabs). */
export function useReportPermissions() {
  const { user, activeBusiness } = useSelector((state) => state.auth);

  const functionalities = useMemo(
    () => getUserFunctionalities(user, activeBusiness),
    [activeBusiness?.functionalities, user?.functionalities],
  );

  const canViewReportItem = useCallback(
    (permissionTitle) => canViewReport(functionalities, permissionTitle),
    [functionalities],
  );

  const canViewReportEntry = useCallback(
    (item) => canViewReportItem(getReportPermissionKey(item)),
    [canViewReportItem],
  );

  return { user, activeBusiness, functionalities, canViewReportItem, canViewReportEntry };
}
