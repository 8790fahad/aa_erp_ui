import { useState, useEffect } from "react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";

/** Prefer Cash on/in Hand when auto-selecting a default cash head. */
export function isCashInHandHead(head) {
  if (!head) return false;
  const code = String(head.head || head.code || "").trim();
  const desc = String(head.description || "").toLowerCase();
  if (code === "112199" || code === "112100") return true;
  return /cash\s*(on|in)\s*hand/.test(desc);
}

/**
 * Loads cash account heads (COA) or bank accounts when mode of payment changes.
 * Cash Pay Through lists all cash COA heads so the cashier can change account.
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

    const mode = String(modeOfPayment || "")
      .toLowerCase()
      .trim();
    const isSplit =
      mode === "cash+transfer" || mode === "split" || mode === "cash_transfer";
    const needCash = mode === "cash" || isSplit;
    const needBank =
      mode === "bank" || mode === "cheque" || mode === "card" || isSplit;

    if (needCash) {
      _postApi(
        `/inventory/product-list?query_type=cash`,
        { facilityId },
        (resp) => {
          if (resp.success) {
            // Full cash COA list — cashier can pick any cash head (not locked to one)
            const heads = resp?.results || [];
            setHeadList(heads);
          } else {
            toast.error("Failed to load cash accounts.");
          }
        },
        (err) => {
          console.error("API Error:", err);
          toast.error("Could not load account heads.");
        },
      );
    }
    if (needBank) {
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
        },
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
