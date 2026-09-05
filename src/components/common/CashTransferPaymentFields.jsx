import { useEffect, useRef } from "react";
import { Typeahead } from "react-bootstrap-typeahead";
import "react-bootstrap-typeahead/css/Typeahead.css";

/**
 * Cash + Transfer split payment fields for supplier bills / pay bills.
 * Mode options include cash | bank | cheque | card | cash+transfer.
 */
export function isCashTransferSplitMode(mode) {
  const m = String(mode || "")
    .toLowerCase()
    .trim();
  return m === "cash+transfer" || m === "split" || m === "cash_transfer";
}

export function parseMoneyInput(value) {
  return parseFloat(String(value || "").replace(/,/g, "")) || 0;
}

export function formatMoneyInput(value) {
  if (value == null || value === "") return "";
  const numericValue = String(value).replace(/[^0-9.]/g, "");
  const endsWithDot = numericValue.endsWith(".");
  const parts = numericValue.split(".");
  const integerPart = parts[0] || "";
  const decimalPart = parts[1] || "";
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decimalPart) return `${formattedInteger}.${decimalPart}`;
  if (endsWithDot) return integerPart ? `${formattedInteger}.` : ".";
  return formattedInteger;
}

function formatFixedMoney(num) {
  const n = Math.max(0, Number(Number(num || 0).toFixed(2)));
  return formatMoneyInput(n.toFixed(2));
}

/**
 * Cap typed amount to `max` and return { display, amount }.
 * Keeps incomplete decimals (e.g. "12.") while typing.
 */
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

export function buildPaymentSplits({
  mode,
  cashAmount,
  transferAmount,
  accountHead,
  bankAccount,
}) {
  if (!isCashTransferSplitMode(mode)) return null;
  const splits = [];
  const cash = parseMoneyInput(cashAmount);
  const transfer = parseMoneyInput(transferAmount);
  if (cash > 0) {
    splits.push({
      mode: "cash",
      amount: cash,
      accountHead: accountHead?.head
        ? { head: accountHead.head, description: accountHead.description || "" }
        : null,
    });
  }
  if (transfer > 0) {
    splits.push({
      mode: "bank",
      amount: transfer,
      bankAccount: bankAccount?.id
        ? { id: bankAccount.id, account_name: bankAccount.account_name }
        : null,
    });
  }
  return splits;
}

const rowClass =
  "grid grid-cols-1 gap-4 lg:grid-cols-[9rem_minmax(0,28rem)] lg:items-center";
const labelClass =
  "text-sm font-medium text-slate-600 lg:text-right";
const inputClass =
  "h-9 w-full max-w-md rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]";

/**
 * @param {object} props
 * @param {'grid'|'stack'} [props.layout] - grid matches Product Bill; stack for Pay Bills rows
 */
export default function CashTransferPaymentFields({
  layout = "grid",
  modeOfPayment,
  onModeChange,
  cashAmount,
  onCashAmountChange,
  transferAmount,
  onTransferAmountChange,
  expectedTotal,
  accountHead,
  onAccountHeadChange,
  bankAccount,
  onBankAccountChange,
  accountList = [],
  headList = [],
  chequeNumber,
  onChequeNumberChange,
  cashTypeaheadRef,
  bankTypeaheadRef,
  disabled = false,
  /** Custom row wrapper for Pay Bills (Row component) */
  Row,
}) {
  const isSplit = isCashTransferSplitMode(modeOfPayment);
  const expected =
    expectedTotal != null && Number.isFinite(Number(expectedTotal))
      ? Number(expectedTotal)
      : null;
  const lastEditedRef = useRef(null);

  // When bill/payment total changes, keep cash + transfer capped to it.
  useEffect(() => {
    if (!isSplit || expected == null || !(expected > 0)) return;
    const cash = parseMoneyInput(cashAmount);
    const transfer = parseMoneyInput(transferAmount);
    if (cash + transfer <= expected + 0.02 && cash <= expected + 0.02 && transfer <= expected + 0.02) {
      return;
    }
    const preferCash = lastEditedRef.current !== "transfer";
    if (preferCash) {
      const nextCash = Math.min(cash, expected);
      onCashAmountChange?.(formatFixedMoney(nextCash));
      onTransferAmountChange?.(formatFixedMoney(expected - nextCash));
    } else {
      const nextTransfer = Math.min(transfer, expected);
      onTransferAmountChange?.(formatFixedMoney(nextTransfer));
      onCashAmountChange?.(formatFixedMoney(expected - nextTransfer));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only rebalance when expected/mode changes
  }, [expected, isSplit]);

  const handleCashAmountChange = (raw) => {
    lastEditedRef.current = "cash";
    if (expected == null || !(expected > 0)) {
      onCashAmountChange?.(formatMoneyInput(raw));
      return;
    }
    const { display, amount, incomplete } = clampMoneyTyping(raw, expected);
    onCashAmountChange?.(display);
    if (!incomplete) {
      onTransferAmountChange?.(formatFixedMoney(expected - amount));
    }
  };

  const handleTransferAmountChange = (raw) => {
    lastEditedRef.current = "transfer";
    if (expected == null || !(expected > 0)) {
      onTransferAmountChange?.(formatMoneyInput(raw));
      return;
    }
    const { display, amount, incomplete } = clampMoneyTyping(raw, expected);
    onTransferAmountChange?.(display);
    if (!incomplete) {
      onCashAmountChange?.(formatFixedMoney(expected - amount));
    }
  };

  const totalHint =
    expected != null && expected > 0
      ? `Max ₦${expected.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} — other amount auto-fills to match total`
      : null;

  const ModeSelect = (
    <select
      value={modeOfPayment || ""}
      onChange={(e) => onModeChange?.(e.target.value)}
      disabled={disabled}
      className={
        layout === "grid"
          ? "h-9 w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
          : inputClass
      }
    >
      <option value="">Select mode...</option>
      <option value="cash">Cash</option>
      <option value="bank">Bank Transfer</option>
      <option value="cash+transfer">Cash + Transfer</option>
      <option value="cheque">Cheque</option>
      <option value="card">Card</option>
    </select>
  );

  const CashAmountInput = (
    <div className="w-full max-w-md space-y-1">
      <input
        type="text"
        inputMode="decimal"
        value={cashAmount || ""}
        onChange={(e) => handleCashAmountChange(e.target.value)}
        disabled={disabled}
        placeholder="0.00"
        className={inputClass}
      />
      {totalHint ? (
        <p className="text-[11px] text-slate-500">{totalHint}</p>
      ) : null}
    </div>
  );

  const TransferAmountInput = (
    <input
      type="text"
      inputMode="decimal"
      value={transferAmount || ""}
      onChange={(e) => handleTransferAmountChange(e.target.value)}
      disabled={disabled}
      placeholder="0.00"
      className={inputClass}
    />
  );

  const CashAccountSelect = (
    <Typeahead
      ref={cashTypeaheadRef}
      id="cash-transfer-cash-account"
      labelKey={(option) =>
        `${option.head || ""} ${option.description || ""}`.trim()
      }
      options={headList}
      placeholder="Select cash account..."
      disabled={disabled}
      onChange={(selectedItems) => {
        if (selectedItems?.length) {
          const cash = selectedItems[0];
          onAccountHeadChange?.({
            head: cash.head || "",
            description: cash.description || "",
          });
        } else onAccountHeadChange?.({});
      }}
      selected={
        accountHead?.head
          ? headList.filter((c) => c.head === accountHead.head)
          : []
      }
      clearButton
    />
  );

  const bankAccountLabel = (account) =>
    `${account?.account_name || ""}${
      account?.account_number ? ` (${account.account_number})` : ""
    }`.trim();

  const BankAccountSelect = (
    <Typeahead
      ref={bankTypeaheadRef}
      id="cash-transfer-bank-account"
      labelKey={bankAccountLabel}
      options={accountList}
      placeholder="Select bank account..."
      disabled={disabled}
      onChange={(selectedItems) => {
        onBankAccountChange?.(selectedItems?.length ? selectedItems[0] : null);
      }}
      selected={
        bankAccount?.id
          ? accountList.filter((a) => String(a.id) === String(bankAccount.id))
          : []
      }
      clearButton
    />
  );

  if (Row) {
    return (
      <>
        <Row label="Payment Mode" required>
          {ModeSelect}
        </Row>
        {isSplit ? (
          <>
            <Row label="Cash Amount" required>
              {CashAmountInput}
            </Row>
            <Row label="Cash Account" required>
              {CashAccountSelect}
            </Row>
            <Row label="Transfer Amount" required>
              {TransferAmountInput}
            </Row>
            <Row label="Bank Account" required>
              <div className="w-full max-w-md">{BankAccountSelect}</div>
            </Row>
          </>
        ) : (
          <>
            {(modeOfPayment === "cash" ||
              modeOfPayment === "bank" ||
              modeOfPayment === "cheque" ||
              modeOfPayment === "card") && (
              <Row
                label={modeOfPayment === "cash" ? "Cash Account" : "Paid Through"}
                required
              >
                {modeOfPayment === "cash" ? CashAccountSelect : BankAccountSelect}
              </Row>
            )}
            {modeOfPayment === "cheque" && (
              <Row label="Cheque Number" required>
                <input
                  type="text"
                  value={chequeNumber || ""}
                  onChange={(e) => onChequeNumberChange?.(e.target.value)}
                  disabled={disabled}
                  className={inputClass}
                />
              </Row>
            )}
          </>
        )}
      </>
    );
  }

  return (
    <>
      <div className={rowClass}>
        <label className={labelClass}>
          Mode of Payment <span className="text-red-500">*</span>
        </label>
        {ModeSelect}
      </div>

      {isSplit ? (
        <>
          <div className={rowClass}>
            <label className={labelClass}>
              Cash Amount <span className="text-red-500">*</span>
            </label>
            {CashAmountInput}
          </div>
          <div className={rowClass}>
            <label className={labelClass}>
              Cash Account <span className="text-red-500">*</span>
            </label>
            <div className="w-full max-w-md">{CashAccountSelect}</div>
          </div>
          <div className={rowClass}>
            <label className={labelClass}>
              Transfer Amount <span className="text-red-500">*</span>
            </label>
            {TransferAmountInput}
          </div>
          <div className={rowClass}>
            <label className={labelClass}>
              Bank Account <span className="text-red-500">*</span>
            </label>
            <div className="w-full max-w-md">{BankAccountSelect}</div>
          </div>
        </>
      ) : (
        <>
          {(modeOfPayment === "bank" ||
            modeOfPayment === "cheque" ||
            modeOfPayment === "card") && (
            <div className={rowClass}>
              <label className={labelClass}>
                Bank Account <span className="text-red-500">*</span>
              </label>
              <div className="w-full max-w-md">{BankAccountSelect}</div>
            </div>
          )}
          {modeOfPayment === "cash" && (
            <div className={rowClass}>
              <label className={labelClass}>
                Cash Account <span className="text-red-500">*</span>
              </label>
              <div className="w-full max-w-md">{CashAccountSelect}</div>
            </div>
          )}
          {modeOfPayment === "cheque" && (
            <div className={rowClass}>
              <label className={labelClass}>
                Cheque No <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={chequeNumber || ""}
                onChange={(e) => onChequeNumberChange?.(e.target.value)}
                disabled={disabled}
                placeholder="Enter cheque number..."
                className="h-9 w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
              />
            </div>
          )}
        </>
      )}
    </>
  );
}
