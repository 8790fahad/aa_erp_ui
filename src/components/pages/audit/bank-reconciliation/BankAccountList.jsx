import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Plus,
  X,
  Loader,
  Pencil,
  ArrowRight,
  MoreVertical,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Typeahead } from "react-bootstrap-typeahead";
import { accountTypes } from "@/lib/utils";
import PropTypes from "prop-types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/utils/numberUtils";

const BANK_COA_HINTS = [
  "bank",
  "cash",
  "petty cash",
  "cash and bank",
  "cash & bank",
];

const isBankCoaHead = (acc) => {
  const text = [
    acc.subcategory,
    acc.category,
    acc.type,
    acc.description,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())
    .join(" ");

  return (
    acc.account_nature === "ASSET" &&
    BANK_COA_HINTS.some((hint) => text.includes(hint))
  );
};

const pickBankCoaHeads = (accounts = []) => {
  const visible = accounts.filter(
    (acc) =>
      acc.head &&
      String(acc.head) !== "0" &&
      (acc.display === 1 || acc.display === true || acc.display == null),
  );
  const bankHeads = visible.filter(isBankCoaHead);
  return bankHeads.length > 0 ? bankHeads : visible;
};

const BankAccountsList = ({ onAccountSelect, selectedAccount }) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const currentUser = useSelector((state) => state.auth.user);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [existingCodes, setExistingCodes] = useState([]);
  const [loadingCoa, setLoadingCoa] = useState(false);
  const [bankList, setBankList] = useState([]);
  const [formData, setFormData] = useState({
    subhead: "",
    bank_code: "",
    bank_name: "",
    account_number: "",
    account_name: "",
    code: "",
    account_bank_type: "",
    head: null,
    opening_balance: "",
    category: "",
  });

  const getBanks = useCallback(() => {
    setLoading(true);
    _fetchApi(
      `/api/get/bank-accounts?facilityId=${activeBusiness.id}`,
      (data) => {
        if (data.success) {
          setBanks(data.results);
        } else {
          toast.error(data.message || "Failed to load bank accounts");
        }
        setLoading(false);
      },
      (err) => {
        console.error(err);
        toast.error("Error loading bank accounts");
        setLoading(false);
      }
    );
  }, [activeBusiness.id]);

  const getExistingCodes = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoadingCoa(true);
    _fetchApi(
      `/account/account-categories?facilityId=${activeBusiness.id}`,
      (resp) => {
        setLoadingCoa(false);
        if (resp.success) {
          const flat = Array.isArray(resp.flat)
            ? resp.flat
            : Array.isArray(resp.results)
              ? resp.results
              : [];
          setExistingCodes(pickBankCoaHeads(flat));
        } else {
          toast.error("Failed to load account codes.");
          setExistingCodes([]);
        }
      },
      (err) => {
        setLoadingCoa(false);
        console.error("API Error:", err);
        toast.error("Failed to load chart of accounts.");
        setExistingCodes([]);
      },
    );
  }, [activeBusiness?.id]);

  const getBankList = useCallback(() => {
    _fetchApi(
      `/bank/list`,
      (data) => {
        if (data.success) {
          setBankList(data.results);
        }
      },
      (err) => {
        console.error(err);
      }
    );
  }, []);

  const handleSubmit = () => {
    if (
      !formData.bank_code ||
      !formData.account_number ||
      !formData.account_name ||
      !formData.code ||
      !formData.category ||
      !formData.head
    ) {
      toast.error("Please fill in all required fields, including Account Head");
      return;
    }

    setLoading2(true);

    const apiData = {
      account_number: formData.account_number,
      account_name: formData.account_name,
      user_id: currentUser.id,
      bank_code: formData.bank_code,
      bank_name: formData.bank_name,
      account_bank_type: formData.account_bank_type,
      head: formData.head,
      subhead: formData.subhead,
      facilityId: activeBusiness.id,
      opening_balance: formData.opening_balance || 0,
      category: formData.category,
    };

    const endpoint = editingBank
      ? `/api/update/bank-account/by-id/${editingBank.id}`
      : "/api/add/bank-account";

    _postApi(
      endpoint,
      apiData,
      (res) => {
        if (res.success) {
          toast.success(res.message || `Bank account ${editingBank ? "updated" : "created"} successfully`);
          handleCancel();
          getBanks();
        } else {
          toast.error(res.message || "Failed to submit");
          setLoading2(false);
        }
      },
      (err) => {
        toast.error("An error occurred while submitting");
        console.error(err);
        setLoading2(false);
      }
    );
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setEditingBank(null);
    setLoading2(false);
    setFormData({
      subhead: "",
      bank_code: "",
      bank_name: "",
      account_number: "",
      account_name: "",
      code: "",
      account_bank_type: "",
      head: null,
      opening_balance: "",
      category: "",
    });
  };

  const formatAccountNumber = (accountNumber) => {
    if (!accountNumber) return "•••• 0000";
    if (accountNumber.length <= 4) return accountNumber;
    return `•••• ${accountNumber.slice(-4)}`;
  };

  const getBankName = (bankCode) => {
    const bank = bankList.find((b) => b.bank_code === bankCode);
    return bank?.bank_name || "Bank";
  };

  useEffect(() => {
    getBanks();
    getExistingCodes();
    getBankList();
  }, [getBanks, getExistingCodes, getBankList]);

  useEffect(() => {
    if (isModalOpen && !loadingCoa && existingCodes.length === 0) {
      getExistingCodes();
    }
  }, [isModalOpen, loadingCoa, existingCodes.length, getExistingCodes]);

  return (
    <>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Select Account</h2>
            <p className="text-sm text-slate-500 mt-1">
              Choose an account to begin matching statements and ledger entries
            </p>
          </div>
          <Button
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, index) => (
              <Card key={index} className="border-slate-100 shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-3">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : banks.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Building2 className="mx-auto h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No bank accounts configured</h3>
            <p className="text-slate-500 mt-1 mb-6">Add an account to start reconciling your finances.</p>
            <Button variant="outline" onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Account
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {banks.map((account) => (
              <div
                key={account.id}
                className={`group relative bg-white border rounded-xl p-3.5 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-slate-300 ${
                  selectedAccount === account.id ? "ring-2 ring-blue-500 border-transparent shadow-sm" : "border-slate-200 shadow-sm"
                }`}
                onClick={() => onAccountSelect(account.id,account.account_code)}
              >
                {/* Edit Dropdown */}
                <div className="absolute top-4 right-4 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100" onClick={e => e.stopPropagation()}>
                        <span className="sr-only">Open menu</span>
                        <MoreVertical className="h-4 w-4 text-slate-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[160px]">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingBank(account);
                          setFormData({
                            subhead: account.subhead || "",
                            bank_code: account.bank_code || "",
                            bank_name: account.bank_name || "",
                            account_number: account.account_number || "",
                            account_name: account.account_name || "",
                            code: account.account_bank_type || "",
                            account_bank_type: account.account_bank_type || "",
                            head: account.head || null,
                            opening_balance: account.opening_balance || "",
                            category: account.category || "",
                          });
                          setIsModalOpen(true);
                        }}
                        className="cursor-pointer"
                      >
                        <Pencil className="mr-2 h-4 w-4 text-slate-500" />
                        <span>Edit Details</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-start gap-3 mb-3">
                  <div className={`p-2 rounded-lg shrink-0 ${account.category === 'cash' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="pr-6">
                    <h3 className="font-semibold text-slate-900 truncate text-sm" title={account.account_name || "Unnamed Account"}>
                      {account.account_name || "Unnamed Account"}
                    </h3>
                    <p className="text-xs font-medium text-slate-500 truncate" title={getBankName(account.bank_code)}>
                      {getBankName(account.bank_code)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-medium">Account No.</span>
                    <span className="text-[11px] font-mono text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                      {formatAccountNumber(account.account_number)}
                    </span>
                  </div>

                  {/* <div className="flex justify-between items-center">
                    <span className="text-[11px] text-slate-500 font-medium">Opening Bal</span>
                    <span className="text-[11px] font-semibold text-slate-700">
                      {account.currency === "NGN" ? "₦" : "$"}
                      {(account.opening_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div> */}

                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-slate-500 font-medium">Current Bal</span>
                    <span className="text-[11px] font-semibold text-slate-900">
                      {/* {account.currency === "NGN" ? "₦" : "$"} */}
                      {formatCurrency(account.balance)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-slate-500 font-medium">Last Reconciled</span>
                    <span className="text-[10px] text-slate-600">
                      {account.last_reconciled ? new Date(account.last_reconciled).toLocaleDateString() : "Never"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 mt-1">
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Currency</span>
                      <span className="text-[11px] font-medium text-slate-700">{account.currency || "NGN"}</span>
                    </div>

                    <div className="flex items-center gap-1 text-blue-600 font-medium text-[11px]">
                      Select <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Bank Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">

            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-semibold text-slate-800 tracking-tight">
                {editingBank ? "Edit Account Details" : "Add New Account"}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancel}
                className="h-8 w-8 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Account Head</label>
                <Typeahead
                  id="bank-account-head-typeahead"
                  options={existingCodes}
                  placeholder={
                    loadingCoa
                      ? "Loading chart of accounts..."
                      : "Search and select account head..."
                  }
                  selected={
                    formData.head
                      ? existingCodes.filter(
                          (code) =>
                            String(code.head) === String(formData.head),
                        )
                      : []
                  }
                  renderMenuItemChildren={(option) => (
                    <div className="py-1.5">
                      <div className="text-sm font-medium text-slate-800">
                        {option.head} — {option.description}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {option.type || option.category}
                      </div>
                    </div>
                  )}
                  clearButton
                  isLoading={loadingCoa}
                  onChange={(selected) => {
                    if (selected.length > 0) {
                      setFormData((prev) => ({
                        ...prev,
                        head: selected[0].head,
                        subhead: selected[0].subhead || "",
                      }));
                    } else {
                      setFormData((prev) => ({
                        ...prev,
                        head: null,
                        subhead: "",
                      }));
                    }
                  }}
                  labelKey={(option) =>
                    `${option.description} (${option.head})`
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Bank <span className="text-red-500">*</span></label>
                  <Select
                    value={formData.bank_code}
                    onValueChange={(value) => {
                      const selectedBank = bankList.find(bank => bank.bank_code === value);
                      if (selectedBank) {
                        setFormData({ ...formData, bank_code: selectedBank.bank_code, bank_name: selectedBank.bank_name });
                      }
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select institution" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankList.map((item, index) => (
                        <SelectItem key={index} value={item.bank_code}>{item.bank_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Account Number <span className="text-red-500">*</span></label>
                  <Input
                    type="number"
                    required
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="0000000000"
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Account Name <span className="text-red-500">*</span></label>
                <Input
                  type="text"
                  required
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  placeholder="Official account holder name"
                  className="h-10"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Account Type <span className="text-red-500">*</span></label>
                  <Select
                    value={formData.code}
                    onValueChange={(value) => {
                      const selectedType = accountTypes.find(type => type.code === value);
                      if (selectedType) {
                        setFormData({ ...formData, code: selectedType.code, account_bank_type: selectedType.code });
                      }
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountTypes.map((item, index) => (
                        <SelectItem key={index} value={item.code}>{item.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Category <span className="text-red-500">*</span></label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash Account</SelectItem>
                      <SelectItem value="bank">Bank Account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Opening Balance</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₦</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                    placeholder="0.00"
                    className="pl-7 h-10"
                  />
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="px-6"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading2}
                className="bg-slate-900 hover:bg-slate-800 px-8"
              >
                {loading2 ? (
                  <Loader className="animate-spin w-4 h-4 mr-2" />
                ) : null}
                {editingBank ? "Update Account" : "Add Account"}
              </Button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

BankAccountsList.propTypes = {
  onAccountSelect: PropTypes.func,
  selectedAccount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default BankAccountsList;
