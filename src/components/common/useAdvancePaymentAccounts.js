import { useState, useEffect } from "react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";

/** Cash payment mode may only use the Cash on/in Hand ledger head. */
export function isCashInHandHead(head) {
  if (!head) return false;
  const code = String(head.head || head.code || "").trim();
  const desc = String(head.description || "").toLowerCase();
  if (code === "112199") return true;
  return /cash\s*(on|in)\s*hand/.test(desc);
}

/**
 * Loads cash account heads or bank accounts when mode of payment changes.
 * When mode is cash, only "Cash on Hand" / "Cash in Hand" is offered for Pay Through / Deposit To.
 */
export function useAdvancePaymentAccounts(open, facilityId, modeOfPayment) {
  const [accountHead, setAccountHead] = useState({});
  const [bankAccount, setBankAccount] = useState(null);
  const [accountList, setAccountList] = useState([]);
  const [headList, setHeadList] = useState([]);

  useEffect(() => {
    if (!open || !facilityId) return;

    setBankAccount(null);
    setAccountHead({});
    setAccountList([]);
    setHeadList([]);

    if (modeOfPayment === "cash") {
      _postApi(
        `/inventory/product-list?query_type=cash`,
        { facilityId },
        (resp) => {
          if (resp.success) {
            setHeadList((resp?.results || []).filter(isCashInHandHead));
          } else {
            toast.error("Failed to load cash accounts.");
          }
        },
        (err) => {
          console.error("API Error:", err);
          toast.error("Could not load account heads.");
        }
      );
    } else if (["bank", "cheque"].includes(modeOfPayment)) {
      _fetchApi(
        `/api/get/bank-accounts?facilityId=${facilityId}`,
        (data) => {
          if (data.success) {
            setAccountList(data.results || []);
          } else {
            toast.error("Failed to load bank accounts");
          }
        },
        (err) => {
          console.error(err);
          toast.error("Failed to load bank accounts");
        }
      );
    }
  }, [modeOfPayment, facilityId, open]);

  return {
    accountHead,
    setAccountHead,
    bankAccount,
    setBankAccount,
    accountList,
    headList,
  };
}
