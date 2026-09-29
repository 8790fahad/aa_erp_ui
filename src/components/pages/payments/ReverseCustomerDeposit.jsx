import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import moment from "moment";
import { toast } from "sonner";
import { Typeahead } from "react-bootstrap-typeahead";
import "react-bootstrap-typeahead/css/Typeahead.css";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import SearchCustomerInput from "@/components/pages/customer/components/SearchCustomerInput";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  filterJournalAmountInput,
  formatNumberWithCommas,
  getPostingDateMax,
  parseNumberFromFormatted,
  POSTING_DATE_MIN,
  validatePostingDateClient,
} from "@/utilities";

function parseAmount(value) {
  const n = parseFloat(parseNumberFromFormatted(String(value ?? "")));
  return Number.isFinite(n) ? n : 0;
}

function bankChartCode(bank) {
  return String(bank?.account_code || bank?.head || bank?.code || "").trim();
}

function bankAccountLabel(bank) {
  if (!bank) return "";
  const name = bank.account_name || bank.bank_name || bank.head || "Bank";
  const number = bank.account_number || bankChartCode(bank);
  return number ? `${name} (${number})` : String(name);
}

/** Access Bank on chart 112202 is the default pay-from account. */
function pickDefaultBank(banks) {
  const list = Array.isArray(banks) ? banks : [];
  const preferred = list.find((bank) => {
    const code = bankChartCode(bank);
    const number = String(bank?.account_number || "");
    const name = String(bank?.account_name || bank?.bank_name || "");
    return (
      code === "112202" ||
      number.replace(/\s/g, "").includes("112202") ||
      /access bank/i.test(name)
    );
  });
  return preferred || list[0] || null;
}

/**
 * Pay back a customer's available deposit.
 * The amount cannot exceed the deposit balance.
 */
export default function ReverseCustomerDeposit({
  open = true,
  onOpenChange,
  onSuccess,
}) {
  const navigate = useNavigate();
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const currency =
    activeBusiness?.currency ||
    activeBusiness?.currency_code ||
    activeBusiness?.base_currency ||
    "NGN";

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [availableDeposit, setAvailableDeposit] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(moment().format("YYYY-MM-DD"));
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState("transfer");
  const [bankList, setBankList] = useState([]);
  const [cashHeads, setCashHeads] = useState([]);
  const [bankId, setBankId] = useState("");
  const [cashHead, setCashHead] = useState("");
  const [saving, setSaving] = useState(false);

  const loadBalance = useCallback(
    (customerNo) => {
      if (!facilityId || !customerNo) return;
      setBalanceLoading(true);
      _fetchApi(
        `/api/v1/get-customer-advance-history?customerNo=${encodeURIComponent(
          customerNo,
        )}&facilityId=${facilityId}&limit=1`,
        (res) => {
          const available = parseFloat(res?.available_deposit) || 0;
          setAvailableDeposit(available);
          setAmount(
            available > 0 ? formatNumberWithCommas(String(available)) : "",
          );
          setBalanceLoading(false);
        },
        () => {
          setAvailableDeposit(0);
          setBalanceLoading(false);
          toast.error("Failed to load the deposit balance");
        },
      );
    },
    [facilityId],
  );

  const handleCustomerChange = (customer) => {
    setAmount("");
    if (!customer?.customerNo) {
      setSelectedCustomer(null);
      setAvailableDeposit(0);
      return;
    }
    setSelectedCustomer(customer);
    loadBalance(customer.customerNo);
  };

  useEffect(() => {
    if (!facilityId || !open) return;
    if (mode === "transfer") {
      _fetchApi(
        `/api/get/bank-accounts?facilityId=${facilityId}`,
        (data) => {
          const list = data?.results || data?.data || [];
          const banks = Array.isArray(list) ? list : [];
          setBankList(banks);
          const preferred = pickDefaultBank(banks);
          setBankId(preferred?.id != null ? String(preferred.id) : "");
        },
        () => setBankList([]),
      );
    } else {
      _postApi(
        `/inventory/product-list?query_type=cash`,
        { facilityId },
        (resp) => {
          const list = Array.isArray(resp?.results) ? resp.results : [];
          setCashHeads(list);
          setCashHead((current) => {
            if (current) return current;
            const first = list[0];
            return first ? String(first.head || first.code || "") : "";
          });
        },
        () => setCashHeads([]),
      );
    }
  }, [facilityId, mode, open]);

  const onAmountChange = (raw) => {
    const withoutCommas = String(raw).replace(/,/g, "");
    const sanitized = filterJournalAmountInput(withoutCommas);
    const parts = sanitized.split(".");
    const numericValue =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : sanitized;
    const num = parseFloat(numericValue);
    if (
      availableDeposit > 0 &&
      Number.isFinite(num) &&
      num > availableDeposit + 0.001
    ) {
      setAmount(formatNumberWithCommas(String(availableDeposit)));
      return;
    }
    setAmount(formatNumberWithCommas(numericValue));
  };

  const handleReverse = () => {
    if (!selectedCustomer?.customerNo) {
      toast.error("Select a customer");
      return;
    }
    if (availableDeposit <= 0) {
      toast.error("This customer has no available deposit");
      return;
    }
    const dateErr = validatePostingDateClient(paymentDate, { field: "Date" });
    if (dateErr) {
      toast.error(dateErr);
      return;
    }
    const reverseAmount = parseAmount(amount);
    if (reverseAmount <= 0) {
      toast.error("Enter the amount to reverse");
      return;
    }
    if (reverseAmount > availableDeposit + 0.01) {
      toast.error(
        `Amount cannot exceed the available deposit of ${currency} ${formatNumber1(availableDeposit)}`,
      );
      return;
    }

    const payload = {
      facilityId,
      userId: user?.id || user?.user_id,
      customer_no: selectedCustomer.customerNo,
      amount: reverseAmount,
      mode_of_payment: mode,
      transaction_date: paymentDate,
      narration: notes,
    };
    if (mode === "transfer") {
      const bank = bankList.find((b) => String(b.id) === String(bankId));
      if (!bank) {
        toast.error("Select a bank account");
        return;
      }
      payload.bankAccount = bank;
    } else {
      const head = cashHeads.find(
        (h) => String(h.head || h.code) === String(cashHead),
      );
      if (!head) {
        toast.error("Select a cash account");
        return;
      }
      payload.accountHead = {
        head: head.head || head.code,
        description: head.description || head.name || "Cash",
      };
    }

    setSaving(true);
    _postApi(
      "/api/v1/reverse-customer-deposit",
      payload,
      (res) => {
        setSaving(false);
        if (res?.success) {
          toast.success(res.message || "Deposit reversed");
          setAmount("");
          setNotes("");
          setSelectedCustomer(null);
          setAvailableDeposit(0);
          if (onSuccess) onSuccess();
          if (onOpenChange) onOpenChange(false);
          else navigate("/app/payments/receive-payment");
        } else {
          toast.error(res?.error || res?.message || "Failed to reverse deposit");
        }
      },
      (err) => {
        setSaving(false);
        toast.error(err?.error || err?.message || "Failed to reverse deposit");
      },
    );
  };

  const typed = parseAmount(amount);
  const remaining = Math.max(0, availableDeposit - typed);

  const handleOpenChange = (next) => {
    if (saving) return;
    if (!next) {
      setAmount("");
      setNotes("");
      setSelectedCustomer(null);
      setAvailableDeposit(0);
    }
    if (onOpenChange) onOpenChange(next);
    else if (!next) navigate("/app/payments/receive-payment");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-visible sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Reverse Deposit</DialogTitle>
          <DialogDescription>
            Pay a customer&apos;s deposit back in cash or by transfer. The
            amount cannot be more than the available deposit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
            Customer <span className="text-red-600">*</span>
          </label>
          <div className="max-w-md">
            <SearchCustomerInput
              onChange={handleCustomerChange}
              selected={selectedCustomer ? [selectedCustomer] : []}
              disabled={saving}
            />
          </div>

          {selectedCustomer ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                  Available deposit
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-800">
                  {balanceLoading
                    ? "…"
                    : `${currency} ${formatNumber1(availableDeposit)}`}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Amount to reverse
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">
                  {currency} {formatNumber1(typed)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Remaining after reverse
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">
                  {currency} {formatNumber1(remaining)}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[13px] text-gray-700">Amount</label>
                <button
                  type="button"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40"
                  disabled={saving || availableDeposit <= 0}
                  onClick={() =>
                    setAmount(
                      availableDeposit
                        ? formatNumberWithCommas(String(availableDeposit))
                        : "",
                    )
                  }
                >
                  Reverse full balance
                </button>
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                disabled={saving || !selectedCustomer || availableDeposit <= 0}
                placeholder="0.00"
                className="h-9 w-full rounded border border-gray-300 px-2.5 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] text-gray-700">Date</label>
              <input
                type="date"
                value={paymentDate}
                min={POSTING_DATE_MIN}
                max={getPostingDateMax()}
                onChange={(e) => setPaymentDate(e.target.value)}
                disabled={saving}
                className="h-9 w-full rounded border border-gray-300 px-2.5 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] text-gray-700">Pay from</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                disabled={saving}
                className="h-9 w-full rounded border border-gray-300 bg-white px-2.5 text-sm"
              >
                <option value="transfer">Bank transfer</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[13px] text-gray-700">
                {mode === "transfer" ? "Bank account" : "Cash account"}
              </label>
              {mode === "transfer" ? (
                <Typeahead
                  id="reverse-deposit-bank-account"
                  labelKey={bankAccountLabel}
                  options={bankList}
                  placeholder="Search bank account"
                  disabled={saving}
                  clearButton
                  positionFixed
                  flip
                  className="z-[80] w-full [&_.rbt-input-main]:h-9 [&_.rbt-input-main]:rounded [&_.rbt-input-main]:border-gray-300 [&_.rbt-input-main]:px-2.5 [&_.rbt-input-main]:text-sm [&_.rbt-menu]:z-[80] [&_.rbt-menu]:max-h-60"
                  selected={
                    bankId
                      ? bankList.filter((b) => String(b.id) === String(bankId))
                      : []
                  }
                  onChange={(selected) => {
                    const bank = selected?.[0];
                    setBankId(bank?.id != null ? String(bank.id) : "");
                  }}
                  filterBy={(option, props) => {
                    const q = String(props.text || "").toLowerCase().trim();
                    if (!q) return true;
                    return [
                      bankAccountLabel(option),
                      option.account_name,
                      option.bank_name,
                      option.head,
                      option.account_number,
                      option.account_code,
                      option.code,
                    ].some((value) =>
                      String(value || "")
                        .toLowerCase()
                        .includes(q),
                    );
                  }}
                />
              ) : (
                <select
                  value={cashHead}
                  onChange={(e) => setCashHead(e.target.value)}
                  disabled={saving}
                  className="h-9 w-full rounded border border-gray-300 bg-white px-2.5 text-sm"
                >
                  <option value="">Select cash</option>
                  {cashHeads.map((h) => (
                    <option key={h.head || h.code} value={h.head || h.code}>
                      {h.description || h.name || h.head}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[13px] text-gray-700">
                Notes (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={saving}
                placeholder="Internal note"
                className="h-9 w-full rounded border border-gray-300 px-2.5 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
              />
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)]"
            onClick={handleReverse}
            disabled={saving || !selectedCustomer || availableDeposit <= 0}
          >
            {saving ? "Reversing…" : "Reverse Deposit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
