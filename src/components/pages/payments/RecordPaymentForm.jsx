import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getCustomers } from "@/redux/actions/customer";
import CustomerAdvancePaymentModal from "@/components/common/CustomerAdvancePaymentModal";

/**
 * Customer Make Payment form — /app/payments/receive-payment/new
 */
export default function RecordPaymentForm() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const customerList = useSelector((state) => state.customer.customerList) || [];
  const [ready, setReady] = useState(() => customerList.length > 0);

  useEffect(() => {
    let settled = false;
    const markReady = () => {
      if (settled) return;
      settled = true;
      setReady(true);
    };
    dispatch(getCustomers("Show All Stores", markReady, markReady));
    const t = setTimeout(markReady, 2500);
    return () => clearTimeout(t);
  }, [dispatch]);

  const party = useMemo(() => {
    const customerNo = searchParams.get("customerNo") || "";
    if (!customerNo) return null;
    const fromList = customerList.find(
      (c) => String(c.customerNo) === String(customerNo),
    );
    if (fromList) return fromList;
    return {
      customerNo,
      fullname: searchParams.get("customerName") || customerNo,
    };
  }, [searchParams, customerList]);

  const goBack = () => navigate("/app/payments/receive-payment");

  if (!ready && !customerList.length && !party) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Opening customer payment…
      </div>
    );
  }

  return (
    <CustomerAdvancePaymentModal
      open
      onClose={goBack}
      onSuccess={goBack}
      party={party}
      customersList={customerList}
    />
  );
}
