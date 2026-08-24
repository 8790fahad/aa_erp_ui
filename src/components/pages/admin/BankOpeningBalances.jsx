import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { Building2, Loader, Pencil, Search } from "lucide-react";
import CustomTable1 from "@/common/Custom/CustomTable1";
import CustomButton from "@/common/Custom/CustomButton";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import { Alert } from "reactstrap";
import { validateOpeningBalanceFields } from "@/lib/openingBalanceDate";

/**
 * Settings → Banking: set / update opening balances on bank accounts.
 */
export default function BankOpeningBalances({
  embedded = false,
  nested = false,
}) {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const currentUser = useSelector((state) => state.auth.user);
  const [banks, setBanks] = useState([]);
  const [bankList, setBankList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingBalanceDate, setOpeningBalanceDate] = useState("");

  const getBanks = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    _fetchApi(
      `/api/get/bank-accounts?facilityId=${activeBusiness.id}`,
      (res) => {
        setLoading(false);
        if (res?.success) {
          setBanks(Array.isArray(res.results) ? res.results : []);
        } else {
          setBanks([]);
        }
      },
      () => {
        setLoading(false);
        setBanks([]);
      },
    );
  }, [activeBusiness?.id]);

  const getBankDirectory = useCallback(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/bank/list?facilityId=${activeBusiness.id}`,
      (res) => {
        if (res?.success) {
          setBankList(Array.isArray(res.results) ? res.results : []);
        }
      },
      () => {},
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    getBanks();
    getBankDirectory();
  }, [getBanks, getBankDirectory]);

  const bankNameFor = (bank) => {
    const dir = bankList.find((b) => b.bank_code === bank.bank_code);
    return dir?.bank_name || bank.bank_name || bank.account_name || "—";
  };

  const openEdit = (bank) => {
    setSelected(bank);
    setOpeningBalance(
      bank.opening_balance != null && bank.opening_balance !== ""
        ? String(bank.opening_balance)
        : "",
    );
    setOpeningBalanceDate(bank.opening_balance_date || "");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelected(null);
    setOpeningBalance("");
    setOpeningBalanceDate("");
    setSaving(false);
  };

  const handleSave = () => {
    if (!selected) return;
    const obCheck = validateOpeningBalanceFields(
      openingBalance,
      openingBalanceDate,
    );
    if (!obCheck.ok) {
      toast.error(obCheck.message);
      return;
    }
    if (!activeBusiness?.opening_balance_equity) {
      toast.error(
        "Set Opening Balance Equity under Default accounts before posting opening balances.",
      );
      return;
    }

    setSaving(true);
    _postApi(
      `/api/update/bank-account/by-id/${selected.id}`,
      {
        account_number: selected.account_number,
        account_name: selected.account_name,
        user_id: currentUser?.id,
        bank_code: selected.bank_code,
        bank_name: selected.bank_name,
        bank_cbn_code: selected.bank_cbn_code,
        account_bank_type: selected.account_bank_type || selected.code,
        head: selected.head,
        facilityId: activeBusiness.id,
        opening_balance: obCheck.amount,
        opening_balance_date: obCheck.date,
        opening_balance_equity: activeBusiness.opening_balance_equity,
      },
      (res) => {
        if (res?.success) {
          toast.success(res.message || "Opening balance updated");
          closeModal();
          getBanks();
        } else {
          toast.error(res?.message || "Failed to update opening balance");
          setSaving(false);
        }
      },
      (err) => {
        console.error(err);
        toast.error(err?.message || "Failed to update opening balance");
        setSaving(false);
      },
      "PUT",
    );
  };

  const filtered = banks.filter((bank) => {
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      bankNameFor(bank).toLowerCase().includes(q) ||
      String(bank.account_name || "")
        .toLowerCase()
        .includes(q) ||
      String(bank.account_number || "")
        .toLowerCase()
        .includes(q)
    );
  });

  const fields = [
    {
      title: "Bank",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--aa-sidebar-active)] text-[var(--aa-navy)]">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-slate-900">{bankNameFor(item)}</div>
            <div className="text-xs text-slate-500">{item.account_name}</div>
          </div>
        </div>
      ),
    },
    {
      title: "Account Number",
      custom: true,
      className: "text-left",
      component: (item) => (
        <span className="tabular-nums text-slate-800">
          {item.account_number || "—"}
        </span>
      ),
    },
    {
      title: (
        <span className="inline-flex flex-col items-end leading-tight">
          <span>Opening Balance</span>
          <span className="text-[10px] font-normal text-slate-500">₦</span>
        </span>
      ),
      custom: true,
      className: "text-right",
      component: (item) => (
        <span className="tabular-nums text-slate-800">
          {formatNumber1(parseFloat(item.opening_balance) || 0)}
        </span>
      ),
    },
    {
      title: "As of",
      custom: true,
      className: "text-left",
      component: (item) => (
        <span className="text-slate-700">
          {item.opening_balance_date || "—"}
        </span>
      ),
    },
    {
      title: "",
      custom: true,
      className: "text-center w-12",
      component: (item) => (
        <button
          type="button"
          onClick={() => openEdit(item)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--aa-accent)] hover:bg-[var(--aa-sidebar-active)]"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      ),
    },
  ];

  return (
    <div className={embedded || nested ? "pb-2" : "min-h-screen"}>
      {!nested && (
        <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Opening Balances</h1>
            <p className="text-sm text-slate-500">
              Set opening balances for bank accounts (₦). Requires Opening Balance
              Equity under Default accounts.
            </p>
          </div>
          <span className="text-sm text-slate-600">
            Total:{" "}
            <span className="font-semibold text-slate-900">{filtered.length}</span>
          </span>
        </div>
      )}
      {nested && (
        <p className="mb-4 text-sm text-slate-500">
          Set opening balances (₦) for each bank account. Requires Opening Balance
          Equity under Default accounts.
        </p>
      )}

      <div className="relative mb-4 max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search bank accounts…"
          className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader className="h-7 w-7 animate-spin text-[var(--aa-accent)]" />
        </div>
      )}
      {!loading ? (
        <CustomTable1
          data={filtered}
          fields={fields}
          message="No bank accounts found. Add accounts under Bank Setup first."
        />
      ) : (
        <Alert className="mt-3 text-center" color="info">
          Loading
        </Alert>
      )}

      {modalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="bg-[var(--aa-navy)] p-4 text-white">
              <h2 className="text-lg font-semibold">Set Opening Balance</h2>
              <p className="text-sm text-white/70">
                {bankNameFor(selected)} · {selected.account_number}
              </p>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Opening Balance (₦)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  As of date
                  {parseFloat(openingBalance || 0) !== 0 && (
                    <span className="text-red-500"> *</span>
                  )}
                </label>
                <input
                  type="date"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                  value={openingBalanceDate}
                  onChange={(e) => setOpeningBalanceDate(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Required when amount is entered. Future dates are allowed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t bg-slate-50 p-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
              >
                Cancel
              </button>
              <CustomButton
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </CustomButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
