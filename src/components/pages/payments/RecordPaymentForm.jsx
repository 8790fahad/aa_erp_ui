import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * Legacy /app/payments/receive-payment/new route.
 * Customer deposits are recorded at Collection Points.
 */
export default function RecordPaymentForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const customerNo = searchParams.get("customerNo") || "";
    const customerName = searchParams.get("customerName") || "";
    const params = new URLSearchParams({ action: "deposit" });
    if (customerNo) params.set("customerNo", customerNo);
    if (customerName) params.set("customerName", customerName);
    navigate(`/app/payments/collection-points?${params.toString()}`, {
      replace: true,
    });
  }, [navigate, searchParams]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      Opening Collection Points to make a deposit…
    </div>
  );
}
