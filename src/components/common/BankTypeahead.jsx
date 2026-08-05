import React, { useState, useCallback } from "react";
import { toast } from "sonner";
import { Building2, X, Loader } from "lucide-react";
import { Typeahead, Menu, MenuItem, TypeaheadMenu } from "react-bootstrap-typeahead";
import { _postApi } from "@/redux/actions/api";
import "react-bootstrap-typeahead/css/Typeahead.css";

const bankDirectoryLabelKey = (b) =>
  b ? `${b.bank_name || ""} (${b.bank_code || ""})` : "";

function BankDirectoryMenuItemChildren(option) {
  return (
    <div className="py-1">
      <div className="font-semibold text-slate-800">{option.bank_name}</div>
      <small className="text-slate-600 text-xs">
        Code: {option.bank_code} · CBN: {option.bank_cbn_code}
      </small>
    </div>
  );
}

const BankTypeahead = ({ 
  id = "bank-typeahead",
  bankList = [], 
  onLoaded, 
  selectedBankCode, 
  onChange,
  facilityId,
  error = ""
}) => {
  const [showBankQuickAdd, setShowBankQuickAdd] = useState(false);
  const [savingQuickBank, setSavingQuickBank] = useState(false);
  const [quickAddBank, setQuickAddBank] = useState({
    bank_name: "",
    bank_code: "",
    bank_cbn_code: "",
  });

  const handleQuickAddBankDirectory = () => {
    const name = String(quickAddBank.bank_name || "").trim();
    const bc = String(quickAddBank.bank_code || "").trim();
    const cbn = String(quickAddBank.bank_cbn_code || "").trim();

    if (!name) {
      toast.error("Bank name is required");
      return;
    }
    if (!bc) {
      toast.error("Bank code is required");
      return;
    }
    if (!cbn) {
      toast.error("CBN code is required");
      return;
    }
    if (!facilityId) return;

    setSavingQuickBank(true);
    _postApi(
      "/api/bank-list",
      { bank_name: name, bank_code: bc, bank_cbn_code: cbn },
      (res) => {
        setSavingQuickBank(false);
        if (res.success) {
          toast.success(res.message || "Bank added to directory");
          setQuickAddBank({ bank_name: "", bank_code: "", bank_cbn_code: "" });
          setShowBankQuickAdd(false);
          
          if (typeof onLoaded === "function") {
            onLoaded(); // Refresh the list in the parent
          }

          // Automatically select the newly created bank
          onChange({
            bank_code: bc,
            bank_name: name,
            bank_cbn_code: cbn
          });
        } else {
          toast.error(res.message || "Could not add bank");
        }
      },
      (err) => {
        setSavingQuickBank(false);
        toast.error("Could not add bank");
        console.error(err);
      }
    );
  };

  const renderBankTypeaheadMenu = useCallback((results, menuProps, state) => {
    const q = String(state.text || "").trim();

    if (results.length > 0) {
      return (
        <TypeaheadMenu
          {...menuProps}
          labelKey={bankDirectoryLabelKey}
          options={results}
          text={state.text}
          renderMenuItemChildren={BankDirectoryMenuItemChildren}
        />
      );
    }

    if (q.length > 0) {
      return (
        <Menu {...menuProps} emptyLabel={null}>
          <MenuItem
            option={{ __createBank: true }}
            position={0}
            label={`Create "${q}"`}
            onClick={(e) => {
              e.preventDefault();
              state.hideMenu();
              setShowBankQuickAdd(true);
              setQuickAddBank((prev) => ({
                ...prev,
                bank_name: q,
              }));
            }}
          >
            <div className="py-1">
              <div className="font-semibold text-blue-700">
                + Create &ldquo;{q}&rdquo;
              </div>
              <small className="text-slate-600 text-xs">
                Enter bank code and CBN code (same as Settings → Bank list)
              </small>
            </div>
          </MenuItem>
        </Menu>
      );
    }

    return (
      <TypeaheadMenu
        {...menuProps}
        labelKey={bankDirectoryLabelKey}
        options={[]}
        text={state.text}
        renderMenuItemChildren={BankDirectoryMenuItemChildren}
      />
    );
  }, []);

  return (
    <div className="w-full">
      <Typeahead
        id={id}
        options={bankList || []}
        placeholder="Search or select bank…"
        labelKey={bankDirectoryLabelKey}
        selected={
          selectedBankCode
            ? bankList.filter(
                (b) => String(b.bank_code) === String(selectedBankCode)
              )
            : []
        }
        onChange={(selected) => {
          if (!selected || selected.length === 0) {
            onChange({
                bank_code: "",
                bank_name: "",
                bank_cbn_code: ""
            });
            return;
          }
          const b = selected[0];
          onChange({
            bank_code: String(b.bank_code),
            bank_cbn_code: String(b.bank_cbn_code || ""),
            bank_name: String(b.bank_name || ""),
          });
        }}
        renderMenuItemChildren={BankDirectoryMenuItemChildren}
        renderMenu={renderBankTypeaheadMenu}
        clearButton
        positionFixed
        flip
        className={`w-full [&_.rbt-input-main]:rounded-lg [&_.rbt-input-main]:border ${
          error ? "[&_.rbt-input-main]:border-red-500" : "[&_.rbt-input-main]:border-gray-300"
        } [&_.rbt-input-main]:min-h-[42px] [&_.rbt-input-main]:shadow-sm outline-none focus:ring-2 focus:ring-blue-500`}
      />
      
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
          onClick={() => setShowBankQuickAdd((v) => !v)}
        >
          {showBankQuickAdd
            ? "Hide add bank form"
            : "Bank not listed? Add it to the directory"}
        </button>
        <span className="text-xs text-gray-500">
          (same as Admin → Settings → Bank list)
        </span>
      </div>

      {showBankQuickAdd && (
        <div className="mt-3 p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50 space-y-3">
          <p className="text-sm text-gray-700 font-medium">
            New bank directory entry
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Bank name *
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={quickAddBank.bank_name}
                onChange={(e) =>
                  setQuickAddBank((q) => ({
                    ...q,
                    bank_name: e.target.value,
                  }))
                }
                placeholder="e.g. Keystone Bank"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Bank code *
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={quickAddBank.bank_code}
                onChange={(e) =>
                  setQuickAddBank((q) => ({
                    ...q,
                    bank_code: e.target.value,
                  }))
                }
                placeholder="e.g. 082121038"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                CBN code *
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={quickAddBank.bank_cbn_code}
                onChange={(e) =>
                  setQuickAddBank((q) => ({
                    ...q,
                    bank_cbn_code: e.target.value,
                  }))
                }
                placeholder="e.g. 082"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-100"
              onClick={() => {
                setShowBankQuickAdd(false);
                setQuickAddBank({
                  bank_name: "",
                  bank_code: "",
                  bank_cbn_code: "",
                });
              }}
              disabled={savingQuickBank}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              onClick={handleQuickAddBankDirectory}
              disabled={savingQuickBank}
            >
              {savingQuickBank
                ? "Saving…"
                : "Save to directory"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankTypeahead;
