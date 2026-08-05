/* eslint-disable no-unused-vars */
import CustomButton from "@/common/Custom/CustomButton";
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { X, Plus, Edit, Trash2, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVerticalIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input, Label } from "reactstrap/lib";
import { accountTypes } from "@/lib/utils";

const ViewSupplierAccounts = ({
  closeModal,
  showModal,
  selectedSupplier,
  getList,
}) => {
  const facilityId = useSelector((state) => state.auth.activeBusiness.id);
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [bankList, setBankList] = useState([]);
  const [editingAccount, setEditingAccount] = useState(null);
  const [errors, setErrors] = useState({});

  // Account form data for adding/editing
  const [accountFormData, setAccountFormData] = useState({
    bank_code: "",
    bank_name: "",
    bank_cbn_code: "",
    account_number: "",
    account_name: "",
    code: "",
    account_bank_type: "",
  });

  //   const accountTypes = [
  //     { code: "SAV", title: "Savings" },
  //     { code: "CUR", title: "Current" },
  //     { code: "FIX", title: "Fixed Deposit" },
  //     { code: "DOM", title: "Domiciliary" },
  //   ];

  // Fetch supplier accounts
  const fetchSupplierAccounts = useCallback(() => {
    if (!selectedSupplier?.supplier_number || !facilityId) return;

    setLoading(true);
    // Updated API endpoint to match controller
    _fetchApi(
      `/api/get/supplier-bank-details/${facilityId}/${selectedSupplier.supplier_number}`,
      (response) => {
        setLoading(false);
        if (response.success) {
          setAccounts(response.results || []);
        } else {
          toast.error("Failed to load supplier accounts");
          setAccounts([]);
        }
      },
      (error) => {
        setLoading(false);
        console.error("Error fetching accounts:", error);
        toast.error("Error loading supplier accounts");
        setAccounts([]);
      }
    );
  }, [selectedSupplier?.supplier_number, facilityId]);

  // Fetch bank list
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
        toast.error("Failed to load bank list");
      }
    );
  }, []);

  useEffect(() => {
    if (showModal && selectedSupplier) {
      fetchSupplierAccounts();
      getBankList();
    }
  }, [showModal, selectedSupplier, fetchSupplierAccounts, getBankList]);

  // Form validation
  const validateAccountForm = () => {
    const newErrors = {};

    if (!accountFormData.bank_code) {
      newErrors.bank = "Bank selection is required";
    }
    if (!accountFormData.account_number) {
      newErrors.account_number = "Account number is required";
    }
    if (!accountFormData.account_name) {
      newErrors.account_name = "Account name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle add account
  const handleAddAccount = () => {
    if (!validateAccountForm()) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading2(true);

    // Updated API endpoint and data structure
    _postApi(
      "/api/add/supplier-bank-detail",
      {
        account_name: accountFormData.account_name,
        account_number: accountFormData.account_number,
        bank_name: accountFormData.bank_name,
        sort_code: accountFormData.bank_cbn_code, // Map bank_cbn_code to sort_code
        bank_code: accountFormData.bank_code,
        facilityId: facilityId,
        supplier_number: selectedSupplier.supplier_number,
        code: accountFormData.code,
      },
      (res) => {
        setLoading2(false);
        if (res.success) {
          toast.success("Account added successfully");
          // Reset form
          setAccountFormData({
            bank_code: "",
            bank_name: "",
            bank_cbn_code: "",
            account_number: "",
            account_name: "",
            code: "",
            account_bank_type: "",
          });
          setErrors({});
          fetchSupplierAccounts(); // Refresh the list
          getList(); // Refresh parent list
        } else {
          toast.error(res.message || "Failed to add account");
        }
      },
      (err) => {
        setLoading2(false);
        console.error(err);
        toast.error("An error occurred while adding account");
      }
    );
  };

  // Handle edit account
  // Fixed handleEditAccount function - handles number/string conversion
  const handleEditAccount = (account) => {
    console.log("Account data:", account);

    setEditingAccount(account);

    // Convert numbers to strings for proper matching
    const bankCodeStr = String(account.bank_code || "");
    const accountTypeCodeStr = String(account.code || "");

    console.log("Bank code (converted to string):", bankCodeStr);
    console.log("Account type code (converted to string):", accountTypeCodeStr);

    // Find the matching bank and account type with string comparison
    const matchingBank = bankList.find(
      (bank) => String(bank.bank_code) === bankCodeStr
    );

    const matchingAccountType = accountTypes.find(
      (type) => String(type.code) === accountTypeCodeStr
    );

    console.log("Matching bank found:", matchingBank);
    console.log("Matching account type found:", matchingAccountType);

    setAccountFormData({
      // Use string values for Select components
      bank_code: bankCodeStr,
      bank_name: account.bank_name || "",
      bank_cbn_code: account.sort_code || "",
      account_number: account.account_number || "",
      account_name: account.account_name || "",
      code: accountTypeCodeStr,
      account_bank_type: matchingAccountType ? matchingAccountType.title : "",
      // Store original values for identification
      original_account_number: account.account_number,
      original_supplier_number:
        account.supplier_number || selectedSupplier.supplier_number,
    });
  };

  // Handle update account
  const handleUpdateAccount = () => {
    if (!validateAccountForm()) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading2(true);

    _postApi(
      "/api/update/supplier-bank-detail/by-id",
      {
        account_name: accountFormData.account_name,
        account_number: accountFormData.account_number,
        bank_name: accountFormData.bank_name,
        // subhead: accountFormData.code,
        // head: accountFormData.bank_code,
        bank_code: accountFormData.bank_code,
        sort_code: accountFormData.bank_cbn_code,
        supplier_number: selectedSupplier.supplier_number,
        facilityId: facilityId,
        code: parseInt(accountFormData.code, 10),
        original_account_number: accountFormData.original_account_number,
        original_supplier_number: accountFormData.original_supplier_number,
      },
      (res) => {
        setLoading2(false);
        if (res.success) {
          toast.success("Account updated successfully");
          setEditingAccount(null);
          setAccountFormData({
            bank_code: "",
            bank_name: "",
            bank_cbn_code: "",
            account_number: "",
            account_name: "",
            code: "",
            account_bank_type: "",
          });
          setErrors({});
          fetchSupplierAccounts();
          getList();
        } else {
          toast.error(res.message || "Failed to update account");
        }
      },
      (err) => {
        setLoading2(false);
        console.error(err);
        toast.error("An error occurred while updating account");
      }
    );
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingAccount(null);
    setAccountFormData({
      bank_code: "",
      bank_name: "",
      bank_cbn_code: "",
      account_number: "",
      account_name: "",
      code: "",
      account_bank_type: "",
    });
    setErrors({});
  };

  // Delete account
  const handleDeleteAccount = (account) => {
    if (!window.confirm("Are you sure you want to delete this account?")) {
      return;
    }

    setLoading2(true);

    _postApi(
      "/api/delete/supplier-bank-detail",
      {
        account_number: account.account_number,
        supplier_number:
          account.supplier_number || selectedSupplier.supplier_number,
        facilityId: facilityId,
      },
      (response) => {
        setLoading2(false);
        if (response.success) {
          toast.success("Account deleted successfully");
          fetchSupplierAccounts();
          getList();
        } else {
          toast.error(response.message || "Failed to delete account");
        }
      },
      (error) => {
        setLoading2(false);
        console.error("Error deleting account:", error);
        toast.error("Error deleting account");
      }
    );
  };

  const handleModalClose = () => {
    closeModal();
    setAccounts([]);
    setEditingAccount(null);
    setAccountFormData({
      bank_code: "",
      bank_name: "",
      bank_cbn_code: "",
      account_number: "",
      account_name: "",
      code: "",
      account_bank_type: "",
    });
    setErrors({});
  };

  const handleFormChange = ({ target: { name, value } }) => {
    setAccountFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  return (
    <Dialog open={showModal} onOpenChange={(open) => !open && handleModalClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Manage Bank Accounts
          </DialogTitle>
          <DialogDescription>
            {selectedSupplier && (
              <span className="block text-sm font-medium mt-1">
                Payee:{" "}
                {selectedSupplier.name || selectedSupplier.supplier_name}
                <span className="text-xs text-gray-500 ml-2">
                  (ID: {selectedSupplier.supplier_number})
                </span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Supplier Info Section */}
          <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">
                      Payee
                    </h3>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {selectedSupplier?.name ||
                        selectedSupplier?.supplier_name}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">
                      Payee ID
                    </h3>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {selectedSupplier?.supplier_number}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">
                      Total Accounts
                    </h3>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {accounts.length}
                    </p>
                  </div>
                </div>
              </div>

          {/* Add/Edit Account Section */}
          <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  {editingAccount ? "Edit Bank Account" : "Add Bank Account"}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="bank">
                      Select Bank<span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={accountFormData.bank_code || ""}
                      onValueChange={(value) => {
                        const selectedBank = bankList.find(
                          (bank) => bank.bank_code === value
                        );
                        if (selectedBank) {
                          setAccountFormData((prev) => ({
                            ...prev,
                            bank_code: selectedBank.bank_code,
                            bank_name: selectedBank.bank_name,
                            bank_cbn_code: selectedBank.bank_cbn_code || "",
                          }));
                          if (errors.bank) {
                            setErrors((prev) => ({ ...prev, bank: "" }));
                          }
                        }
                      }}
                    >
                      <SelectTrigger
                        className={errors.bank ? "border-red-500" : ""}
                      >
                        <SelectValue placeholder="Select bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankList.map((bank) => (
                          <SelectItem
                            key={bank.bank_code}
                            value={bank.bank_code}
                          >
                            {bank.bank_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.bank && (
                      <p className="text-sm text-red-500 mt-1">{errors.bank}</p>
                    )}
                  </div>

                  {/* Account Number */}
                  <div>
                    <Label htmlFor="account_number">
                      Account Number<span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="account_number"
                      name="account_number"
                      type="text"
                      placeholder="0000000000"
                      value={accountFormData.account_number}
                      onChange={handleFormChange}
                      className={errors.account_number ? "border-red-500" : ""}
                    />
                    {errors.account_number && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.account_number}
                      </p>
                    )}
                  </div>

                  {/* Account Name */}
                  <div>
                    <Label htmlFor="account_name">
                      Account Name<span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="account_name"
                      name="account_name"
                      type="text"
                      placeholder="Account holder name"
                      value={accountFormData.account_name}
                      onChange={handleFormChange}
                      className={errors.account_name ? "border-red-500" : ""}
                    />
                    {errors.account_name && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.account_name}
                      </p>
                    )}
                  </div>

                  {/* Account Type */}
                  <div>
                    <Label htmlFor="type">Account Type</Label>
                    <Select
                      value={accountFormData.code}
                      onValueChange={(value) => {
                        setAccountFormData((prev) => ({
                          ...prev,
                          code: value,
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account type" />
                      </SelectTrigger>
                      <SelectContent>
                        {accountTypes.map((type) => (
                          <SelectItem key={type.code} value={type.code}>
                            {type.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-end gap-2">
                    {editingAccount ? (
                      <>
                        <CustomButton
                          onClick={handleUpdateAccount}
                          loading={loading2}
                          className="flex-1 flex items-center justify-center"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Update
                        </CustomButton>
                        <Button
                          onClick={handleCancelEdit}
                          variant="outline"
                          className="flex-1 flex items-center justify-center"
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <CustomButton
                        onClick={handleAddAccount}
                        loading={loading2}
                        className="flex-1 flex items-center justify-center"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Account
                      </CustomButton>
                    )}
                  </div>
                </div>
              </div>

          {/* Accounts List */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {loading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="animate-spin h-6 w-6" />
                    <span className="ml-2">Loading accounts...</span>
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="text-center py-12">
                    <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No bank accounts found</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Add your first bank account using the form above
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold">
                            Bank Name
                          </TableHead>
                          <TableHead className="font-semibold">
                            Account Number
                          </TableHead>
                          <TableHead className="font-semibold">
                            Account Name
                          </TableHead>
                          <TableHead className="font-semibold">
                            Account Type
                          </TableHead>
                          <TableHead className="font-semibold text-center">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accounts.map((account, index) => (
                          <TableRow
                            key={`${account.account_number}-${account.supplier_number}-${index}`}
                            className="hover:bg-gray-50"
                          >
                            <TableCell className="font-medium">
                              {account.bank_name}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-sm">
                                {account.account_number}
                              </span>
                            </TableCell>
                            <TableCell>{account.account_name}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {(() => {
                                  const bank = accountTypes.find(
                                    (b) => b.code === account.code
                                  );
                                  return bank ? `${bank.title}` : "N/A";
                                })()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => handleEditAccount(account)}
                                  className="p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                                  title="Edit account"
                                  disabled={loading2}
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteAccount(account)}
                                  className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                                  title="Delete account"
                                  disabled={loading2}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {accounts.length > 0 && (
                  <div className="p-4 text-sm text-gray-500 text-center border-t">
                    Total: {accounts.length} account
                    {accounts.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewSupplierAccounts;
