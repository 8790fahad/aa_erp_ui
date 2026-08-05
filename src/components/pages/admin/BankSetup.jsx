import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Trash2,
  Building2,
  X,
  Loader,
  MoreVerticalIcon,
  Upload,
} from "lucide-react";
import BankAccountsUpload from "@/components/pages/admin/BankAccountsUpload";
import CustomTable1 from "@/common/Custom/CustomTable1";
import CustomButton from "@/common/Custom/CustomButton";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { Alert } from "reactstrap";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ReactSelect from "react-select";
import { accountTypes } from "@/lib/utils";
import { formatNumber1 } from "@/components/router/utilities";
import {
  Typeahead,
  Menu,
  MenuItem,
  TypeaheadMenu,
} from "react-bootstrap-typeahead";
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

const BankSetup = ({ embedded = false }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [selectedBank, setSelectedBank] = useState(null);
  const [banks, setBanks] = useState([]);
  const [existingCodes, setExistingCodes] = useState([]);
  const [bankList, setBankList] = useState([]);
  const [showBankQuickAdd, setShowBankQuickAdd] = useState(false);
  const [savingQuickBank, setSavingQuickBank] = useState(false);
  const [quickAddBank, setQuickAddBank] = useState({
    bank_name: "",
    bank_code: "",
    bank_cbn_code: "",
  });
  const [formData, setFormData] = useState({
    subhead: "",
    bank_code: "",
    bank_name: "",
    bank_cbn_code: "",
    account_number: "",
    account_name: "",
    code: "20",
    account_bank_type: "",
    head: null,
    opening_balance: "",
    opening_balance_date: "",
  });

  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const currentUser = useSelector((state) => state.auth.user);

  const handleEdit = (bank) => {
    console.log("[BankSetup] handleEdit bank row:", bank);
    setShowBankQuickAdd(false);
    setEditingBank(bank);
    const bankCode = String(
      bank.bank_code ?? bank.bankCode ?? bank.bank_id ?? bank.bankId ?? "",
    );
    const bankTypeCode = String(
      bank.account_bank_type ??
        bank.accountBankType ??
        bank.account_bank_type_code ??
        bank.accountBankTypeCode ??
        "",
    );
    const headCode =
      bank.head ??
      bank.account_code ??
      bank.accountCode ??
      bank.account_head ??
      bank.head_code ??
      bank.headCode ??
      null;

    const bankInfo = bankList.find((b) => String(b.bank_code) === bankCode);
    console.log("[BankSetup] edit derived:", {
      bankCode,
      bankTypeCode,
      headCode,
      bankInfo,
    });
    setFormData({
      subhead: String(bank.subhead ?? ""),
      bank_code: bankCode,
      bank_cbn_code: String(
        bank.bank_cbn_code ?? bank.bankCbnCode ?? bankInfo?.bank_cbn_code ?? "",
      ),
      bank_name: bankInfo?.bank_name || bank.bank_name || bank.bankName || "",
      account_number: String(bank.account_number ?? bank.accountNumber ?? ""),
      account_name: String(bank.account_name ?? bank.accountName ?? ""),
      code: bankTypeCode,
      account_bank_type: bankTypeCode,
      head:
        headCode != null && String(headCode).trim() !== ""
          ? String(headCode).trim()
          : null,
      opening_balance: String(bank.opening_balance ?? ""),
      opening_balance_date: String(bank.opening_balance_date ?? ""),
      id: bank.id,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.bank_code) {
      toast.error("Please select a bank");
      return;
    }
    if (!formData.account_number) {
      toast.error("Please enter account number");
      return;
    }
    if (!formData.account_name) {
      toast.error("Please enter account name");
      return;
    }
    if (!formData.code) {
      toast.error("Please select account type");
      return;
    }

    // Validate that opening balance date is provided if opening balance is set
    if (
      formData.opening_balance &&
      formData.opening_balance !== "" &&
      parseFloat(formData.opening_balance) !== 0
    ) {
      if (!formData.opening_balance_date) {
        toast.error(
          "Please provide Opening Balance Date when Opening Balance is set",
        );
        return;
      }
    }

    setLoading2(true);

    // Prepare data for API
    const apiData = {
      account_number: formData.account_number,
      account_name: formData.account_name,
      user_id: currentUser.id,
      bank_code: formData.bank_code,
      bank_name: formData.bank_name,
      bank_cbn_code: formData.bank_cbn_code,
      account_bank_type: formData.code,
      head: formData.head,
      facilityId: activeBusiness.id,
      opening_balance: formData.opening_balance || 0,
      opening_balance_date: formData.opening_balance_date,
      opening_balance_equity: activeBusiness.opening_balance_equity,
    };

    const endpoint = editingBank
      ? `/api/update/bank-account/by-id/${editingBank.id}`
      : "/api/add/bank-account";

    const method = editingBank ? "PUT" : "POST";

    _postApi(
      endpoint,
      apiData,
      (res) => {
        if (res.success) {
          toast.success(
            res.message ||
              `Bank account ${editingBank ? "updated" : "created"} successfully`,
          );
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
      },
      method,
    );
  };

  const handleDelete = (bank) => {
    setLoading2(true);
    _postApi(
      `/api/bank-account/${bank.id}`,
      { facilityId: activeBusiness.id },
      (res) => {
        if (res.success) {
          toast.success(res.message || "Bank account deleted successfully");
          setShowDeleteModal(false);
          getBanks();
        } else {
          toast.error(res.message || "Failed to delete");
          setLoading2(false);
        }
      },
      (err) => {
        toast.error("An error occurred while deleting");
        console.error(err);
        setLoading2(false);
      },
      "DELETE",
    );
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setShowDeleteModal(false);
    setEditingBank(null);
    setSelectedBank(null);
    setLoading2(false);
    setShowBankQuickAdd(false);
    setQuickAddBank({ bank_name: "", bank_code: "", bank_cbn_code: "" });
    setFormData({
      subhead: "",
      bank_code: "",
      bank_name: "",
      bank_cbn_code: "",
      account_number: "",
      account_name: "",
      code: "20",
      account_bank_type: "",
      head: null,
      opening_balance: "",
      opening_balance_date: "",
    });
  };

  /** Same endpoint as Settings → Bank list (`BankListSettings`). */
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
    if (!activeBusiness?.id) return;
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
          getBankList((rows) => {
            const list = Array.isArray(rows) ? rows : [];
            const match = list.find((b) => String(b.bank_code) === String(bc));
            if (match) {
              setFormData((prev) => ({
                ...prev,
                bank_name: String(match.bank_name || name),
                bank_code: String(match.bank_code),
                bank_cbn_code: String(match.bank_cbn_code || ""),
              }));
            } else {
              setFormData((prev) => ({
                ...prev,
                bank_name: name,
                bank_code: bc,
                bank_cbn_code: cbn,
              }));
            }
          });
        } else {
          toast.error(res.message || "Could not add bank");
        }
      },
      (err) => {
        setSavingQuickBank(false);
        toast.error("Could not add bank");
        console.error(err);
      },
    );
  };

  const handleShowDelete = (bank) => {
    setSelectedBank(bank);
    setShowDeleteModal(true);
  };

  const getBanks = useCallback(() => {
    setLoading(true);
    _fetchApi(
      `/api/get/bank-accounts?facilityId=${activeBusiness.id}`,
      (data) => {
        console.log("[BankSetup] getBanks response:", data);
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
      },
    );
  }, [activeBusiness.id]);

  const getExistingCodes = useCallback(() => {
    if (!activeBusiness?.business_name) return;

    _postApi(
      `/account/chart-of-account?query_type=select`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          setExistingCodes(resp.results);
        } else {
          toast.error("Failed to load account codes.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching account codes.");
      },
    );
  }, [activeBusiness?.business_name]);

  const getBankList = useCallback(
    (onLoaded) => {
      _fetchApi(
        `/bank/list?facilityId=${activeBusiness.id}`,
        (data) => {
          if (data.success) {
            const rows = Array.isArray(data.results) ? data.results : [];
            setBankList(rows);
            if (typeof onLoaded === "function") {
              onLoaded(rows);
            }
          }
        },
        (err) => {
          console.error(err);
        },
      );
    },
    [activeBusiness.id],
  );

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

  useEffect(() => {
    getBanks();
    getExistingCodes();
    getBankList();
  }, [getBanks, getExistingCodes, getBankList]);

  //   const fetchGeneratedCode = (parentCode) => {
  //     if (!parentCode || !parentCode[0]) return;

  //     _postApi(
  //       "/account/generate-chart-of-account",
  //       {
  //         parent_code: parentCode[0],
  //         parent_description: parentCode[1],
  //         business_name: activeBusiness?.business_name,
  //       },
  //       (resp) => {
  //         if (resp.success) {
  //           setFormData((prev) => ({
  //             ...prev,
  //             head: null,
  //           }));
  //           console.log("Generated code:", resp.code);
  //         } else {
  //           toast.error("Failed to generate account code.");
  //         }
  //       },
  //       (err) => {
  //         console.error("API Error:", err);
  //         toast.error("Something went wrong while generating the code.");
  //       }
  //     );
  //   };

  const fields = [
    {
      title: "Account Name",
      custom: true,
      className: "text-left",
      component: (item) => {
        return (
          <div className="">
            <div className="font-medium text-gray-900">{item.account_name}</div>

            <div className="text-sm text-gray-500">
              {item.account_bank_type_title}
            </div>
          </div>
        );
      },
    },
    {
      title: "Account Number",
      custom: true,
      className: "text-left",
      component: (item) => {
        return (
          <div className="text-">
            <div className="font-medium text-gray-900">
              {item.account_number}
            </div>
          </div>
        );
      },
    },
    {
      title: "Account Type",
      custom: true,
      component: (item) => {
        return (
          <div className="text-gray-900 text-center">
            {
              accountTypes.find((type) => type.code === item.account_bank_type)
                ?.title
            }
          </div>
        );
      },
    },
    {
      title: "Currency",
      custom: true,
      component: (item) => (
        <div className="text-gray-900 text-center">
          {item.currency || "N/A"}
        </div>
      ),
    },
    {
      title: "Status",
      custom: true,
      component: (item) => {
        const status = item.status || "active";
        return (
          <div className="text-center">
            {" "}
            <Badge
              variant={status === "active" ? "default" : "secondary"}
              className={
                status === "active"
                  ? "bg-green-100 text-green-800 hover:bg-green-100 text-center"
                  : "bg-gray-100 text-gray-800 hover:bg-gray-100 text-center"
              }
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </div>
        );
      },
    },
    {
      title: "Balance",
      custom: true,
      classNames: "text-right",
      component: (item) => {
        return (
          <div className="text-end">
            <div className="font-medium text-gray-900">
              {formatNumber1(item.balance)}
            </div>
          </div>
        );
      },
    },
    {
      title: "Action",
      custom: true,
      component: (item) => (
        <div className="text-center flex gap-1 justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex size-8 text-slate-500 data-[state=open]:bg-slate-100 dark:text-slate-400 dark:data-[state=open]:bg-slate-800"
                size="icon"
              >
                <MoreVerticalIcon />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem onClick={() => handleEdit(item)}>
                Edit Account
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleShowDelete(item)}>
                Delete Account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const filteredBanks = banks.filter((bank) => {
    const bankInfo = bankList.find((b) => b.bank_code === bank.bank_code);
    const bankName = bankInfo?.bank_name || bank.account_name || "";

    return (
      bankName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bank.account_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bank.account_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bank.account_bank_type
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      bank.head?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bank.bank_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <>
      <div className={embedded ? "pb-2" : "min-h-screen"}>
        {/* {JSON.stringify(banks)}÷ */}
        <div className="max-w-7xl mx-auto">
          <div className="">
            <div className="p-">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  Manage Bank Accounts
                </h1>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    Total:{" "}
                    <span className="font-semibold text-gray-900">
                      {filteredBanks.length}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search bank accounts by name, number, type, subhead, or bank code..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Upload className="w-5 h-5" />
                Upload
              </button>
              <CustomButton
                onClick={() => {
                  setShowBankQuickAdd(false);
                  setIsModalOpen(true);
                }}
              >
                <Plus className="w-5 h-5" />
                Add Bank Account
              </CustomButton>
            </div>

            <div className="overflow-x-auto">
              {loading && (
                <div className="flex mx-auto">
                  <Loader className="animate-spin w-7 h-7 mx-auto" />
                </div>
              )}
              {!loading ? (
                <CustomTable1
                  data={filteredBanks}
                  fields={fields}
                  message="No bank accounts found"
                />
              ) : (
                <Alert className="mt-3 text-center" color="info">
                  Loading
                </Alert>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Upload Modal */}
      <BankAccountsUpload
        open={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => {
          getBanks();
        }}
      />

      {/* Create/Edit Bank Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {editingBank ? "Edit Bank Account" : "Add New Bank Account"}
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">
                    {editingBank
                      ? "Update bank account information"
                      : "Create a new bank account for your business"}
                  </p>
                </div>
                <button
                  onClick={handleCancel}
                  className="p-1.5 hover:bg-white/20 rounded transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="space-y-4">
                  {/* {JSON.stringify(formData)} */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Head
                    </label>
                    <ReactSelect
                      inputId="account-head-select"
                      placeholder="Select account head"
                      isClearable
                      options={(existingCodes || [])
                        .map((acc) => {
                          const code = String(
                            acc.head ?? acc.code ?? acc.head_code ?? "",
                          ).trim();
                          if (!code) return null;
                          const name = String(
                            acc.description || acc.name || acc.accName || "",
                          ).trim();
                          return {
                            value: code,
                            label: `${name || "Account"} (${code})`,
                            raw: acc,
                          };
                        })
                        .filter(Boolean)}
                      value={
                        formData.head
                          ? {
                              value: String(formData.head).trim(),
                              label: (() => {
                                const head = String(formData.head).trim();
                                const found = (existingCodes || []).find(
                                  (a) =>
                                    String(
                                      a.head ?? a.code ?? a.head_code ?? "",
                                    ).trim() === head,
                                );
                                return found
                                  ? `${
                                      String(
                                        found.description ||
                                          found.name ||
                                          found.accName ||
                                          "",
                                      ).trim() || "Account"
                                    } (${head})`
                                  : `(${head})`;
                              })(),
                            }
                          : null
                      }
                      onChange={(opt) => {
                        setFormData((prev) => ({
                          ...prev,
                          head: opt?.value ? String(opt.value) : null,
                        }));
                      }}
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          minHeight: "42px",
                          borderColor: state.isFocused ? "#4267B2" : "#d1d5db",
                          boxShadow: state.isFocused
                            ? "0 0 0 3px rgb(66 103 178 / 0.2)"
                            : "none",
                          "&:hover": {
                            borderColor: state.isFocused
                              ? "#4267B2"
                              : "#d1d5db",
                          },
                        }),
                        menuPortal: (base) => ({ ...base, zIndex: 99999 }),
                      }}
                      menuPortalTarget={document.body}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select bank <span className="text-red-500">*</span>
                      </label>
                      <Typeahead
                        id="bank-setup-bank-typeahead"
                        options={bankList}
                        placeholder="Search or select bank…"
                        labelKey={bankDirectoryLabelKey}
                        selected={
                          formData.bank_code
                            ? bankList.filter(
                                (b) =>
                                  String(b.bank_code) ===
                                  String(formData.bank_code),
                              )
                            : []
                        }
                        onChange={(selected) => {
                          if (!selected || selected.length === 0) {
                            setFormData((prev) => ({
                              ...prev,
                              bank_code: "",
                              bank_name: "",
                              bank_cbn_code: "",
                            }));
                            return;
                          }
                          const b = selected[0];
                          setFormData((prev) => ({
                            ...prev,
                            bank_code: String(b.bank_code),
                            bank_cbn_code: String(b.bank_cbn_code || ""),
                            bank_name: String(b.bank_name || ""),
                          }));
                        }}
                        renderMenuItemChildren={BankDirectoryMenuItemChildren}
                        renderMenu={renderBankTypeaheadMenu}
                        clearButton
                        positionFixed
                        flip
                        className="w-full [&_.rbt-input-main]:rounded-md [&_.rbt-input-main]:border [&_.rbt-input-main]:border-gray-300 [&_.rbt-input-main]:min-h-[42px] [&_.rbt-input-main]:shadow-sm"
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

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        pattern="[0-9]*"
                        inputMode="numeric"
                        maxLength={10}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={formData.account_number}
                        onChange={(e) => {
                          // Only allow numeric characters and limit to 10 digits
                          const value = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 10);
                          setFormData({
                            ...formData,
                            account_number: value,
                          });
                        }}
                        placeholder="0000000000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.account_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          account_name: e.target.value,
                        })
                      }
                      placeholder="Account holder name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Type <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formData.code}
                      onValueChange={(value) => {
                        const selectedType = accountTypes.find(
                          (type) => String(type.code) === String(value),
                        );
                        if (selectedType) {
                          setFormData({
                            ...formData,
                            code: String(selectedType.code),
                            account_bank_type: String(selectedType.code), // Save code instead of title
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Bank Account Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {accountTypes.map((item, index) => (
                          <SelectItem key={index} value={String(item.code)}>
                            {item.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/*
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Opening Balance
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={formData.opening_balance}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            opening_balance: e.target.value,
                          })
                        }
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Opening Balance Date{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={formData.opening_balance_date}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            opening_balance_date: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div> */}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t bg-gray-50 p-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
                <CustomButton
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading2}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading2 ? (
                    <>
                      <Loader className="animate-spin w-4 h-4" />
                      Processing...
                    </>
                  ) : editingBank ? (
                    "Update Account"
                  ) : (
                    "Create Account"
                  )}
                </CustomButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Trash2 className="h-5 w-5" />
                    Confirm Delete
                  </h3>
                  <p className="text-red-100 text-sm mt-1">
                    This action cannot be undone
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="p-1.5 hover:bg-white/20 rounded transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="mb-6">
                  <p className="text-gray-700 mb-3">
                    Are you sure you want to delete the following bank account?
                  </p>
                  <div className="p-3 bg-gray-100 rounded-lg space-y-2">
                    <p>
                      <strong>Bank:</strong>{" "}
                      {(() => {
                        const bankInfo = bankList.find(
                          (b) => b.bank_code === selectedBank?.bank_code,
                        );
                        return (
                          bankInfo?.bank_name ||
                          selectedBank?.account_name ||
                          "Unknown"
                        );
                      })()}
                    </p>
                    <p>
                      <strong>Account Name:</strong>{" "}
                      {selectedBank?.account_name}
                    </p>
                    <p>
                      <strong>Account Number:</strong>{" "}
                      {selectedBank?.account_number}
                    </p>
                    <p>
                      <strong>Account Type:</strong>{" "}
                      {selectedBank?.account_bank_type}
                    </p>
                    <p>
                      <strong>Account Head:</strong>{" "}
                      {selectedBank?.head || "Not assigned"}
                    </p>
                    <p>
                      <strong>Bank Code:</strong> {selectedBank?.bank_code}
                    </p>
                  </div>
                  <p className="text-red-600 text-sm mt-3">
                    <strong>Warning:</strong> This action cannot be undone. All
                    bank account data will be permanently deleted.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t bg-gray-50 p-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleDelete(selectedBank);
                    setShowDeleteModal(false);
                  }}
                  disabled={loading2}
                  className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading2 ? (
                    <>
                      <Loader className="animate-spin w-4 h-4" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Account"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BankSetup;
