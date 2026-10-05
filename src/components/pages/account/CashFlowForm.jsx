import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { ArrowLeftRight } from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import { formatNumber1 } from "@/components/router/utilities";
import {
  formatNumberWithCommas,
  filterJournalAmountInput,
  parseNumberFromFormatted,
} from "@/utilities";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import "react-bootstrap-typeahead/css/Typeahead.css";

const formatJournalAmountInput = (value) => {
  const withoutCommas = String(value || "").replace(/,/g, "");
  const sanitized = filterJournalAmountInput(withoutCommas);
  const parts = sanitized.split(".");
  const numericValue =
    parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : sanitized;
  return formatNumberWithCommas(numericValue);
};
const isCashSourceAccount = (acc) => {
  const code = String(acc?.head || acc?.code || "").trim();
  const desc = String(acc?.description || "").toLowerCase();
  return (
    code === "112199" ||
    code === "112200" ||
    desc.includes("cash on hand") ||
    desc.includes("till")
  );
};

const isBankLikeAccount = (acc) => {
  if (!acc || isCashSourceAccount(acc)) return false;
  const code = String(acc.head || acc.code || "").trim();
  const desc = String(acc.description || "").toLowerCase();
  const cat = String(acc.category || "").toLowerCase();
  const sub = String(acc.subcategory || "").toLowerCase();
  if (desc.includes("bank") || cat.includes("bank") || sub.includes("bank")) {
    return true;
  }
  // Typical cash-at-bank COA range under Cash & Cash Equivalents
  if (/^1122\d{2}$/.test(code) && code !== "112200") return true;
  return Boolean(acc.display);
};

const bankOptionLabel = (b) => {
  const name = b.account_name || b.bank_name || b.description || "Bank";
  const num = b.account_number || "";
  const code = b.head || b.account_code || b.code || "";
  if (num && num !== code) return `${name} · ${num}`;
  if (code) return `${name} (${code})`;
  return String(name);
};

const CashFlowForm = ({
  closeModal,
  showModal,
  getList,
  onSuccess,
  tillMode = false,
  defaultFromCode = "",
  lockFrom = false,
  defaultRemarks = "",
  title = "Move Cash",
  description = "Transfer funds between accounts",
}) => {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [chartOfAccount, setChartOfAccount] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    transfer_from: "",
    transfer_to: "",
    amount: "",
    remarks: "",
  });

  const getInitialFormValues = useCallback(
    () => ({
      transfer_from: defaultFromCode || "",
      transfer_to: "",
      amount: "",
      remarks: defaultRemarks || (tillMode ? "Till: Cash Exchange" : ""),
      date: new Date().toISOString().split("T")[0],
    }),
    [defaultFromCode, defaultRemarks, tillMode],
  );

  const [form, setForm] = useState(getInitialFormValues);
  const facilityId = activeBusiness?.id;

  const fieldClass =
    "h-9 border-slate-200 bg-white text-sm focus-visible:border-[var(--aa-navy,#0f2744)] focus-visible:ring-[var(--aa-navy,#0f2744)]/20";
  const labelClass = "mb-1.5 text-xs font-medium text-slate-600";

  const handleChange = ({ target: { name, value } }) => {
    if (name === "amount") {
      const formattedValue = formatJournalAmountInput(value);
      setForm((p) => ({ ...p, amount: formattedValue }));
      const amountNum = parseFloat(parseNumberFromFormatted(formattedValue)) || 0;
      setErrors((prev) => ({
        ...prev,
        amount:
          formattedValue && amountNum <= 0
            ? "Amount must be greater than zero"
            : "",
      }));
      return;
    }

    setForm((p) => ({
      ...p,
      [name]: value,
    }));
  };

  const getChartOfAccount = useCallback(() => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/account/chart-of-accounts/${activeBusiness.id}`,
      (resp) => {
        if (resp.success) {
          const results = Array.isArray(resp.results) ? resp.results : [];
          const normalized = results.map((acc) => ({
            ...acc,
            head: acc.head || acc.account_code || acc.code || "",
          }));
          setChartOfAccount(normalized.filter((acc) => !!acc.head));
        }
      },
      (err) => {
        console.error("Error fetching chart of accounts:", err);
        setChartOfAccount([]);
      },
    );
  }, [activeBusiness?.id]);

  const getBankAccounts = useCallback(() => {
    if (!activeBusiness?.id || !tillMode) return;
    setLoadingBanks(true);
    _fetchApi(
      `/api/get/bank-accounts?facilityId=${activeBusiness.id}`,
      (data) => {
        setLoadingBanks(false);
        if (data?.success) {
          const list = (data.results || [])
            .map((b) => ({
              ...b,
              head: String(
                b.head || b.account_code || b.subhead || b.code || "",
              ).trim(),
            }))
            .filter((b) => b.head);
          setBankAccounts(list);
        } else {
          setBankAccounts([]);
        }
      },
      (err) => {
        setLoadingBanks(false);
        console.error(err);
        setBankAccounts([]);
      },
    );
  }, [activeBusiness?.id, tillMode]);

  useEffect(() => {
    getChartOfAccount();
  }, [getChartOfAccount]);

  // Reset form only when the sheet opens — not when account lists reload.
  useEffect(() => {
    if (!showModal) return;
    setForm(getInitialFormValues());
    setErrors({});
    getChartOfAccount();
    getBankAccounts();
    // intentionally only depend on showModal opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]);

  useEffect(() => {
    if (!showModal || !tillMode || form.transfer_from || !chartOfAccount.length) {
      return;
    }
    const preferredCode = String(defaultFromCode || "").trim();
    const cashLike = chartOfAccount.find((acc) => {
      const code = String(acc.head || acc.code || "").trim();
      if (preferredCode && code === preferredCode) return true;
      return isCashSourceAccount(acc);
    });
    if (cashLike?.head) {
      setForm((prev) =>
        prev.transfer_from ? prev : { ...prev, transfer_from: cashLike.head },
      );
    }
  }, [
    showModal,
    tillMode,
    chartOfAccount,
    defaultFromCode,
    form.transfer_from,
  ]);

  const tillBankOptions = useMemo(() => {
    const fromCode = String(form.transfer_from || "").trim();
    const seen = new Set();
    const pushUnique = (opt) => {
      const code = String(opt.head || "").trim();
      if (!code || code === fromCode || seen.has(code)) return null;
      seen.add(code);
      return { ...opt, head: code };
    };

    if (bankAccounts.length) {
      return bankAccounts
        .map((b) =>
          pushUnique({
            head: String(
              b.head || b.account_code || b.subhead || b.code || "",
            ).trim(),
            description:
              b.account_name || b.bank_name || b.description || b.head,
            account_number: b.account_number,
            label: bankOptionLabel(b),
          }),
        )
        .filter(Boolean);
    }

    return chartOfAccount
      .filter(isBankLikeAccount)
      .map((acc) =>
        pushUnique({
          head: String(acc.head || "").trim(),
          description: acc.description,
          label: `${acc.description} (${acc.head})`,
        }),
      )
      .filter(Boolean);
  }, [bankAccounts, chartOfAccount, form.transfer_from]);

  const success_callback = () => {
    setLoading(false);
    setForm(getInitialFormValues());
    setErrors({});
    closeModal();
    if (onSuccess) {
      onSuccess();
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault?.();

    setErrors({});

    const newErrors = {};
    if (!form.transfer_from) {
      newErrors.transfer_from = "Transfer from account is required";
    }
    if (!form.transfer_to) {
      newErrors.transfer_to = "Transfer to account is required";
    }
    const amountNum =
      parseFloat(parseNumberFromFormatted(form.amount)) || 0;
    if (!form.amount || amountNum <= 0) {
      newErrors.amount = "Amount must be greater than zero";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fill in all required fields correctly");
      return;
    }

    setLoading(true);

    const obj = {
      ...form,
      amount: amountNum,
      remarks:
        form.remarks?.trim() ||
        (tillMode ? "Till: Cash Exchange" : ""),
      query_type: "transfer",
      facilityId,
      created_by: user.id,
    };

    _postApi(
      `/cash-transfer`,
      obj,
      (res) => {
        if (res.success) {
          getList?.();
          toast.success(
            `Cash transfer of ₦${formatNumber1(amountNum)} successful`,
          );
          success_callback();
        } else {
          setLoading(false);
          toast.error(res.message);
        }
      },
      (err) => {
        setLoading(false);
        console.error(err);
        toast.error("An error occurred during cash transfer!");
      },
    );
  };

  const selectedTransferFrom = chartOfAccount.find(
    (account) => account.head === form.transfer_from,
  );
  const selectedTransferTo = chartOfAccount.find(
    (account) => account.head === form.transfer_to,
  );

  return (
    <Sheet
      open={!!showModal}
      onOpenChange={(isOpen) => {
        if (!isOpen) closeModal?.();
      }}
    >
      <SheetContent
        side="right"
        className="!inset-y-0 !right-0 !left-auto flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l border-slate-200 p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:!max-w-xl md:!max-w-lg [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:bg-white/10 [&>button]:hover:opacity-100"
      >
        <SheetHeader className="shrink-0 space-y-1 border-b border-slate-200 bg-[var(--aa-navy,#0f2744)] px-5 py-4 pr-12 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-white/10 p-2">
              <ArrowLeftRight className="h-4 w-4 text-white/90" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-lg font-semibold leading-tight text-white">
                {title}
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-xs text-white/70">
                {description}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-5 py-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="cash-date" className={labelClass}>
                  Date
                </Label>
                <Input
                  id="cash-date"
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  className={fieldClass}
                />
              </div>
              <div>
                <Label htmlFor="cash-amount" className={labelClass}>
                  Amount (₦) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="cash-amount"
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.amount || ""}
                  onChange={handleChange}
                  className={`${fieldClass} tabular-nums ${
                    errors.amount ? "border-red-400" : ""
                  }`}
                />
                {errors.amount && (
                  <p className="mt-1 text-xs text-red-500">{errors.amount}</p>
                )}
              </div>
            </div>

            <div>
              <Label className={labelClass}>
                Transfer funds from <span className="text-red-500">*</span>
              </Label>
              {lockFrom ? (
                <Input
                  value={
                    selectedTransferFrom
                      ? `${selectedTransferFrom.description} - (${selectedTransferFrom.head})`
                      : form.transfer_from || "Cash on Hand"
                  }
                  readOnly
                  className={`${fieldClass} bg-slate-50`}
                />
              ) : (
                <TypeaheadCustom
                  options={chartOfAccount}
                  placeholder="Select source account"
                  labelKey={(i) => `${i.description} - (${i.head})`}
                  onChange={(selectedItems) => {
                    if (selectedItems.length > 0) {
                      setForm((prev) => ({
                        ...prev,
                        transfer_from: selectedItems[0].head,
                      }));
                      setErrors((prev) => ({ ...prev, transfer_from: "" }));
                    } else {
                      setForm((prev) => ({
                        ...prev,
                        transfer_from: "",
                      }));
                    }
                  }}
                  fixed={true}
                  flip={true}
                  selected={selectedTransferFrom ? [selectedTransferFrom] : []}
                />
              )}
              {errors.transfer_from && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.transfer_from}
                </p>
              )}
            </div>

            <div>
              <Label className={labelClass}>
                {tillMode ? (
                  <>
                    Bank / destination account{" "}
                    <span className="text-red-500">*</span>
                  </>
                ) : (
                  <>
                    Transfer funds to <span className="text-red-500">*</span>
                  </>
                )}
              </Label>
              {tillMode ? (
                <>
                  <select
                    id="till-bank-destination"
                    name="transfer_to"
                    value={form.transfer_to || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((prev) => ({ ...prev, transfer_to: val }));
                      setErrors((prev) => ({ ...prev, transfer_to: "" }));
                    }}
                    className={`flex h-9 w-full rounded-md border bg-white px-3 py-1 text-sm shadow-sm outline-none focus-visible:border-[var(--aa-navy,#0f2744)] focus-visible:ring-[3px] focus-visible:ring-[var(--aa-navy,#0f2744)]/20 ${
                      errors.transfer_to ? "border-red-400" : "border-slate-200"
                    }`}
                  >
                    <option value="">
                      {loadingBanks
                        ? "Loading banks…"
                        : "Select bank account"}
                    </option>
                    {tillBankOptions.map((b) => (
                      <option key={b.head} value={b.head}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  {!loadingBanks && tillBankOptions.length === 0 ? (
                    <p className="mt-1 text-xs text-amber-600">
                      No bank accounts found. Add banks under Settings → Bank
                      setup, or ensure chart of accounts has bank heads.
                    </p>
                  ) : null}
                </>
              ) : (
                <TypeaheadCustom
                  options={chartOfAccount}
                  placeholder="Select destination account"
                  labelKey={(i) => `${i.description} - (${i.head})`}
                  onChange={(selectedItems) => {
                    if (selectedItems.length > 0) {
                      setForm((prev) => ({
                        ...prev,
                        transfer_to: selectedItems[0].head,
                      }));
                      setErrors((prev) => ({ ...prev, transfer_to: "" }));
                    } else {
                      setForm((prev) => ({
                        ...prev,
                        transfer_to: "",
                      }));
                    }
                  }}
                  fixed={true}
                  flip={true}
                  selected={selectedTransferTo ? [selectedTransferTo] : []}
                />
              )}
              {errors.transfer_to && (
                <p className="mt-1 text-xs text-red-500">{errors.transfer_to}</p>
              )}
            </div>

            <div>
              <Label htmlFor="cash-remarks" className={labelClass}>
                Remarks
              </Label>
              <Textarea
                id="cash-remarks"
                name="remarks"
                placeholder="Enter remarks"
                value={form.remarks}
                onChange={handleChange}
                rows={3}
                className="border-slate-200 bg-white text-sm focus-visible:border-[var(--aa-navy,#0f2744)] focus-visible:ring-[var(--aa-navy,#0f2744)]/20"
              />
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-slate-200 bg-white text-slate-700"
              onClick={closeModal}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-8 gap-2 border-0 bg-[var(--aa-navy,#0f2744)] text-white shadow-none hover:opacity-90"
              disabled={loading}
              onClick={handleSubmit}
            >
              {loading ? "Saving…" : tillMode ? "Transfer out" : "Move Cash"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default CashFlowForm;
