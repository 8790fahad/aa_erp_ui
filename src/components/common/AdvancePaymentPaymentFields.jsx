import { useRef } from "react";
import PropTypes from "prop-types";
import { Typeahead } from "react-bootstrap-typeahead";
import "react-bootstrap-typeahead/css/Typeahead.css";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isCashTransferSplitMode,
  parseMoneyInput,
  formatMoneyInput,
} from "@/components/common/CashTransferPaymentFields";

function formatFixedMoney(num) {
  const n = Math.max(0, Number(Number(num || 0).toFixed(2)));
  return formatMoneyInput(n.toFixed(2));
}

function clampMoneyTyping(raw, max) {
  const formatted = formatMoneyInput(raw);
  if (formatted === "" || formatted === ".") {
    return { display: "", amount: 0, incomplete: false };
  }
  if (formatted.endsWith(".")) {
    const amount = parseMoneyInput(formatted.slice(0, -1));
    if (max != null && max > 0 && amount > max) {
      return {
        display: formatFixedMoney(max),
        amount: max,
        incomplete: false,
      };
    }
    return { display: formatted, amount, incomplete: true };
  }
  let amount = parseMoneyInput(formatted);
  if (max != null && max > 0 && amount > max) {
    return {
      display: formatFixedMoney(max),
      amount: max,
      incomplete: false,
    };
  }
  return { display: formatted, amount, incomplete: false };
}

/**
 * Shared payment method block: mode, account head or bank, cheque number,
 * optional Cash + Transfer split amounts.
 * @param {string} idPrefix - Prefix for input ids (e.g. "customer-adv" / "supplier-adv")
 */
export default function AdvancePaymentPaymentFields({
  idPrefix,
  modeOfPayment,
  onModeChange,
  accountHead,
  onAccountHeadChange,
  bankAccount,
  onBankAccountChange,
  accountList,
  headList,
  chequeNumber,
  onChequeNumberChange,
  cashAmount = "",
  onCashAmountChange,
  transferAmount = "",
  onTransferAmountChange,
  expectedTotal = null,
  allowCashTransfer = true,
  modeLocked = false,
}) {
  const cashAccountTypeaheadRef = useRef();
  const isSplit = isCashTransferSplitMode(modeOfPayment);
  const expected =
    expectedTotal != null && Number.isFinite(Number(expectedTotal))
      ? Number(expectedTotal)
      : null;

  const handleCashAmountChange = (raw) => {
    if (!onCashAmountChange) return;
    if (expected == null || !(expected > 0)) {
      onCashAmountChange(formatMoneyInput(raw));
      return;
    }
    const { display, amount, incomplete } = clampMoneyTyping(raw, expected);
    onCashAmountChange(display);
    if (!incomplete && onTransferAmountChange) {
      onTransferAmountChange(formatFixedMoney(expected - amount));
    }
  };

  const handleTransferAmountChange = (raw) => {
    if (!onTransferAmountChange) return;
    if (expected == null || !(expected > 0)) {
      onTransferAmountChange(formatMoneyInput(raw));
      return;
    }
    const { display, amount, incomplete } = clampMoneyTyping(raw, expected);
    onTransferAmountChange(display);
    if (!incomplete && onCashAmountChange) {
      onCashAmountChange(formatFixedMoney(expected - amount));
    }
  };

  return (
    <div className="bg-gray-100 rounded-lg p-3 space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Mode of payment *
        </Label>
        <Select
          value={modeOfPayment}
          onValueChange={onModeChange}
          disabled={modeLocked}
        >
          <SelectTrigger className="w-full h-10 bg-gray-200 border-0 text-gray-900 hover:bg-gray-300 focus:ring-2 focus:ring-gray-400">
            <SelectValue placeholder="Mode of payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="bank">Bank Transfer</SelectItem>
            {allowCashTransfer ? (
              <SelectItem value="cash+transfer">Cash + Transfer</SelectItem>
            ) : null}
            <SelectItem value="cheque">Cheque</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isSplit ? (
        <>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Cash amount *
            </Label>
            <Input
              type="text"
              inputMode="decimal"
              value={cashAmount || ""}
              onChange={(e) => handleCashAmountChange(e.target.value)}
              placeholder="0.00"
              className="w-full h-10 bg-gray-200 border-0 text-gray-900 placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-gray-400"
            />
            {expected != null && expected > 0 ? (
              <p className="text-[11px] text-gray-500">
                Max ₦
                {expected.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                — other amount auto-fills
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Cash account *
            </Label>
            <Typeahead
              ref={cashAccountTypeaheadRef}
              id={`${idPrefix}-cash-head-split`}
              labelKey={(option) => `${option.head} ${option.description}`}
              options={headList}
              placeholder="Select cash on hand item…"
              onChange={(selectedItems) => {
                if (selectedItems && selectedItems.length > 0) {
                  const cash = selectedItems[0];
                  onAccountHeadChange({
                    head: cash.head || "",
                    description: cash.description || "",
                  });
                } else {
                  onAccountHeadChange({});
                }
              }}
              selected={
                accountHead?.head
                  ? headList.filter((cash) => cash.head === accountHead.head)
                  : []
              }
              clearButton
              allowNew={false}
              inputProps={{
                style: {
                  width: "100%",
                  height: "2.5rem",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.875rem",
                  border: "none",
                  borderRadius: "0.375rem",
                  backgroundColor: "rgb(229 231 235)",
                },
              }}
              positionFixed
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Transfer amount *
            </Label>
            <Input
              type="text"
              inputMode="decimal"
              value={transferAmount || ""}
              onChange={(e) => handleTransferAmountChange(e.target.value)}
              placeholder="0.00"
              className="w-full h-10 bg-gray-200 border-0 text-gray-900 placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-gray-400"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Bank account *
            </Label>
            <Select
              value={bankAccount?.id?.toString() || ""}
              onValueChange={(value) => {
                const acc = accountList.find((a) => a.id === Number(value));
                onBankAccountChange(acc || null);
              }}
            >
              <SelectTrigger className="w-full h-10 bg-gray-200 border-0 text-gray-900 hover:bg-gray-300 focus:ring-2 focus:ring-gray-400">
                <SelectValue placeholder="Select account…" />
              </SelectTrigger>
              <SelectContent>
                {accountList.map((account) => (
                  <SelectItem key={account.id} value={account.id.toString()}>
                    {account.account_name} ({account.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : null}

      {!isSplit &&
        (modeOfPayment === "cash" ||
          modeOfPayment === "bank" ||
          modeOfPayment === "cheque") && (
          <>
            {["bank", "cheque"].includes(modeOfPayment) ? (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Bank account *
                </Label>
                <Select
                  value={bankAccount?.id?.toString() || ""}
                  onValueChange={(value) => {
                    const acc = accountList.find((a) => a.id === Number(value));
                    onBankAccountChange(acc || null);
                  }}
                >
                  <SelectTrigger className="w-full h-10 bg-gray-200 border-0 text-gray-900 hover:bg-gray-300 focus:ring-2 focus:ring-gray-400">
                    <SelectValue placeholder="Select account…" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountList.map((account) => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.account_name} ({account.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Account head *
                </Label>
                <Typeahead
                  ref={cashAccountTypeaheadRef}
                  id={`${idPrefix}-cash-head`}
                  labelKey={(option) => `${option.head} ${option.description}`}
                  options={headList}
                  placeholder="Select cash on hand item…"
                  onChange={(selectedItems) => {
                    if (selectedItems && selectedItems.length > 0) {
                      const cash = selectedItems[0];
                      onAccountHeadChange({
                        head: cash.head || "",
                        description: cash.description || "",
                      });
                    } else {
                      onAccountHeadChange({});
                    }
                  }}
                  selected={
                    accountHead?.head
                      ? headList.filter(
                          (cash) => cash.head === accountHead.head,
                        )
                      : []
                  }
                  clearButton
                  allowNew={false}
                  renderMenuItemChildren={(option) => (
                    <div className="py-1">
                      <div className="font-semibold text-slate-800">
                        {option.head} {option.description}
                      </div>
                      {option.account_type && (
                        <small className="text-slate-600 text-xs">
                          Type: {option.account_type}
                        </small>
                      )}
                    </div>
                  )}
                  inputProps={{
                    style: {
                      width: "100%",
                      height: "2.5rem",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.875rem",
                      lineHeight: "1.25rem",
                      border: "none",
                      borderRadius: "0.375rem",
                      backgroundColor: "rgb(229 231 235)",
                      transition: "all 0.15s ease-in-out",
                    },
                  }}
                  positionFixed
                />
              </div>
            )}

            {modeOfPayment === "cheque" && (
              <div className="space-y-1.5">
                <Label
                  htmlFor={`${idPrefix}-cheque-no`}
                  className="text-sm font-medium text-gray-700"
                >
                  Cheque number *
                </Label>
                <Input
                  id={`${idPrefix}-cheque-no`}
                  type="text"
                  value={chequeNumber}
                  onChange={(e) => onChequeNumberChange(e.target.value)}
                  placeholder="Enter cheque number…"
                  className="w-full h-10 bg-gray-200 border-0 text-gray-900 placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-gray-400"
                />
              </div>
            )}
          </>
        )}
    </div>
  );
}

AdvancePaymentPaymentFields.propTypes = {
  idPrefix: PropTypes.string.isRequired,
  modeOfPayment: PropTypes.string.isRequired,
  onModeChange: PropTypes.func.isRequired,
  accountHead: PropTypes.object,
  onAccountHeadChange: PropTypes.func.isRequired,
  bankAccount: PropTypes.object,
  onBankAccountChange: PropTypes.func.isRequired,
  accountList: PropTypes.array,
  headList: PropTypes.array,
  chequeNumber: PropTypes.string,
  onChequeNumberChange: PropTypes.func.isRequired,
  cashAmount: PropTypes.string,
  onCashAmountChange: PropTypes.func,
  transferAmount: PropTypes.string,
  onTransferAmountChange: PropTypes.func,
  expectedTotal: PropTypes.number,
  allowCashTransfer: PropTypes.bool,
  modeLocked: PropTypes.bool,
};
