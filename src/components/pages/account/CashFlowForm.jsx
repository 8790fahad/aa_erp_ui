import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { ArrowLeftRight } from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import { formatNumber1 } from "@/components/router/utilities";
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

const CashFlowForm = ({ closeModal, showModal, getList, onSuccess }) => {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [chartOfAccount, setChartOfAccount] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    transfer_from: "",
    transfer_to: "",
    amount: "",
    remarks: "",
  });

  const getInitialFormValues = () => ({
    transfer_from: "",
    transfer_to: "",
    amount: null,
    remarks: "",
    date: new Date().toISOString().split("T")[0],
  });

  const [form, setForm] = useState(getInitialFormValues());
  const facilityId = activeBusiness?.id;

  const fieldClass =
    "h-9 border-slate-200 bg-white text-sm focus-visible:border-[var(--aa-navy,#0f2744)] focus-visible:ring-[var(--aa-navy,#0f2744)]/20";
  const labelClass = "mb-1.5 text-xs font-medium text-slate-600";

  const handleChange = ({ target: { name, value } }) => {
    if (name === "amount" && value !== "" && value !== null) {
      const numValue = parseFloat(value);
      if (numValue <= 0) {
        setErrors((prev) => ({
          ...prev,
          amount: "Amount must be greater than zero",
        }));
        return;
      }
      setErrors((prev) => ({
        ...prev,
        amount: "",
      }));
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

  useEffect(() => {
    getChartOfAccount();
  }, [getChartOfAccount]);

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
    if (!form.amount || parseFloat(form.amount) <= 0) {
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
            `Cash transfer of ₦${formatNumber1(form.amount)} successful`,
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
                Move Cash
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-xs text-white/70">
                Transfer funds between accounts
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
                  type="number"
                  step="0.01"
                  placeholder="Enter amount"
                  value={form.amount || ""}
                  onChange={handleChange}
                  className={`${fieldClass} ${
                    errors.amount ? "border-red-400" : ""
                  }`}
                />
                {form.amount ? (
                  <p className="mt-1 text-xs text-slate-500">
                    ₦{formatNumber1(form.amount)}
                  </p>
                ) : null}
                {errors.amount && (
                  <p className="mt-1 text-xs text-red-500">{errors.amount}</p>
                )}
              </div>
            </div>

            <div>
              <Label className={labelClass}>
                Transfer funds from <span className="text-red-500">*</span>
              </Label>
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
              {errors.transfer_from && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.transfer_from}
                </p>
              )}
            </div>

            <div>
              <Label className={labelClass}>
                Transfer funds to <span className="text-red-500">*</span>
              </Label>
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
              {loading ? "Saving…" : "Move Cash"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default CashFlowForm;
