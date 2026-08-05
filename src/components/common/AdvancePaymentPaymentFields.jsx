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

/**
 * Shared payment method block: mode, account head or bank, cheque number.
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
}) {
  const cashAccountTypeaheadRef = useRef();

  return (
    <div className="bg-gray-100 rounded-lg p-3 space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Mode of payment *
        </Label>
        <Select value={modeOfPayment} onValueChange={onModeChange}>
          <SelectTrigger className="w-full h-10 bg-gray-200 border-0 text-gray-900 hover:bg-gray-300 focus:ring-2 focus:ring-gray-400">
            <SelectValue placeholder="Mode of payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="cheque">Cheque</SelectItem>
            <SelectItem value="bank">Bank Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(modeOfPayment === "cash" ||
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
                    ? headList.filter((cash) => cash.head === accountHead.head)
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
};
