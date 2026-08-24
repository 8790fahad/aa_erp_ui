import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Typeahead } from "react-bootstrap-typeahead";
import "react-bootstrap-typeahead/css/Typeahead.css";
import { Label } from "@/components/ui/label";
import { _fetchApi } from "@/redux/actions/api";
import { useSelector } from "react-redux";
import { Loader2 } from "lucide-react";

const DirectPostModal = ({
  isOpen,
  onClose,
  onPost,
  selectedTransactions = [],
  type = "charge",
}) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    accountCode: "",
    description: "",
    date: "",
    amount: 0,
  });

  useEffect(() => {
    if (isOpen && activeBusiness?.id) {
      // Calculate sum and default values from selected transactions
      const totalAmount = selectedTransactions.reduce(
        (sum, t) => sum + Math.abs(parseFloat(t.amount || 0)),
        0,
      );

      const firstTxn = selectedTransactions[0];

      setFormData({
        accountCode: "",
        description: firstTxn
          ? firstTxn.description
          : `Bank ${type === "charge" ? "Charge" : "Interest"}`,
        date: firstTxn ? firstTxn.date : new Date().toISOString().split("T")[0],
        amount: totalAmount,
      });

      fetchAccounts();
    }
  }, [isOpen, selectedTransactions, type, activeBusiness?.id]);

  const fetchAccounts = () => {
    if (!activeBusiness?.id) return;
    setLoadingAccounts(true);

    _fetchApi(
      `/account/account-categories?facilityId=${activeBusiness.id}`,
      (data) => {
        if (data.success) {
          const flat = Array.isArray(data.flat)
            ? data.flat
            : Array.isArray(data.results)
              ? data.results
              : [];
          const sorted = [...flat].sort((a, b) =>
            String(a.head || "").localeCompare(String(b.head || ""), undefined, {
              numeric: true,
            }),
          );
          setAccounts(sorted);
        } else {
          setAccounts([]);
        }
        setLoadingAccounts(false);
      },
      () => {
        setAccounts([]);
        setLoadingAccounts(false);
      },
    );
  };

  const handleSubmit = async () => {
    if (
      !formData.accountCode ||
      !formData.description ||
      !formData.date ||
      !formData.amount
    ) {
      return;
    }

    setSubmitting(true);
    try {
      await onPost({
        ...formData,
        bankTransactionIds: selectedTransactions.map((t) => t.id),
        type,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            Post as {type === "charge" ? "Bank Charge" : "Interest Income"}
          </DialogTitle>
          <DialogDescription>
            Create a ledger entry and match it with the selected bank
            transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Selected Items Summary */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Selected Transactions
            </Label>
            <div className="max-h-32 overflow-y-auto border rounded-lg p-2 bg-slate-50">
              {selectedTransactions.map((txn, index) => (
                <div
                  key={txn.id || index}
                  className="flex justify-between items-center py-1 px-2 text-sm border-b border-slate-100 last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-slate-700">
                      {txn.description || "No description"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {txn.date || "No date"}
                    </p>
                  </div>
                  <span className="ml-2 font-semibold text-slate-900">
                    ₦{Math.abs(parseFloat(txn.amount || 0)).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="account">Account Head</Label>
            <Typeahead
              id="account-typeahead"
              labelKey={(option) => `${option.head} - ${option.description}`}
              options={accounts}
              placeholder={
                loadingAccounts
                  ? "Loading accounts..."
                  : "Search and select account head..."
              }
              onChange={(selected) => {
                if (selected.length > 0) {
                  setFormData({ ...formData, accountCode: selected[0].head });
                } else {
                  setFormData({ ...formData, accountCode: "" });
                }
              }}
              selected={
                formData.accountCode
                  ? [
                      accounts.find((a) => a.head === formData.accountCode),
                    ].filter(Boolean)
                  : []
              }
              isLoading={loadingAccounts}
              className="w-full"
              inputProps={{ className: "h-10 text-sm" }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Batch Total (₦)</Label>
              <Input
                id="amount"
                type="number"
                value={formData.amount}
                readOnly
                className="bg-slate-50"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !formData.accountCode}
            className="bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)]"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Post & Match
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DirectPostModal;
