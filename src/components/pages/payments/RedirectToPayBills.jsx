import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * Legacy supplier payment/deposit routes.
 * Supplier payments and deposits are recorded at Pay Bills.
 */
export default function RedirectToPayBills({ action = "deposit" } = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const supplierNo =
      searchParams.get("supplierNo") || searchParams.get("vendorNo") || "";
    const supplierName =
      searchParams.get("supplierName") || searchParams.get("vendorName") || "";
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (supplierNo) params.set("supplierNo", supplierNo);
    if (supplierName) params.set("supplierName", supplierName);
    const qs = params.toString();
    navigate(`/app/payments/pay-bills${qs ? `?${qs}` : ""}`, {
      replace: true,
    });
  }, [navigate, searchParams, action]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      Opening Pay Bills…
    </div>
  );
}
