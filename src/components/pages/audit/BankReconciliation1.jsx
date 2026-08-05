import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader,
  AlertTriangle,
  FileText,
  BarChart3,
  CheckCircle,
  DollarSign,
  X,
} from "lucide-react";
import { useSelector } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BankAccountsList from "./bank-reconciliation/BankAccountList";
import TransactionMatching from "./bank-reconciliation/TransactionMatching";

const BankReconciliation1 = () => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const currentUser = useSelector((state) => state.auth.user);

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedAccount = searchParams.get('bankId');

  const [reconciliationStatus, setReconciliationStatus] = useState({
    matched: 0,
    unmatched: 0,
    discrepancies: 0,
    totalAmount: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // Modal states
  const [isInterestModalOpen, setIsInterestModalOpen] = useState(false);
  const [isChargesModalOpen, setIsChargesModalOpen] = useState(false);
  const [loadingInterest, setLoadingInterest] = useState(false);
  const [loadingCharges, setLoadingCharges] = useState(false);

  // Form states
  const [interestForm, setInterestForm] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
    reference: "",
  });

  const [chargesForm, setChargesForm] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
    reference: "",
    chargeType: "",
  });

  // Fetch reconciliation statistics
  const fetchReconciliationStats = useCallback(() => {
    if (!activeBusiness?.id) {
      setReconciliationStatus({
        matched: 0,
        unmatched: 0,
        discrepancies: 0,
        totalAmount: 0,
      });
      return;
    }

    setLoadingStats(true);

    const fetchDiscrepancies = (accountId) => {
      return new Promise((resolve) => {
        _fetchApi(
          `/api/get/discrepancies?facilityId=${activeBusiness.id}&bankAccountId=${accountId}`,
          (data) => {
            if (data.success && data.results) {
              const openDiscrepancies = data.results.filter(
                (d) => d.status !== "resolved"
              ).length;
              resolve(openDiscrepancies);
            } else {
              resolve(0);
            }
          },
          () => resolve(0)
        );
      });
    };

    if (selectedAccount) {
      Promise.all([
        new Promise((resolve) => {
          _fetchApi(
            `/bank-reconciliation-list?facilityId=${activeBusiness.id}&bankId=${selectedAccount}`,
            (data) => {
              if (data.success && data.results) {
                resolve(data.results || []);
              } else {
                resolve([]);
              }
            },
            () => resolve([])
          );
        }),
        fetchDiscrepancies(selectedAccount),
      ])
        .then(([transactions, discrepancies]) => {
          const matched = transactions.filter((t) => t.reconciled === "matched").length;
          const unmatched = transactions.filter((t) => t.reconciled === "unmatched").length;
          const totalAmount = transactions.reduce((sum, txn) => sum + Math.abs(parseFloat(txn.amount || 0)), 0);

          setReconciliationStatus({
            matched,
            unmatched,
            discrepancies,
            totalAmount: totalAmount,
          });
          setLoadingStats(false);
        })
        .catch((err) => {
          console.error("Error fetching reconciliation stats:", err);
          setReconciliationStatus({ matched: 0, unmatched: 0, discrepancies: 0, totalAmount: 0 });
          setLoadingStats(false);
        });
    } else {
      _fetchApi(
        `/api/get/bank-accounts?facilityId=${activeBusiness.id}`,
        (accountsData) => {
          if (accountsData.success && accountsData.results && accountsData.results.length > 0) {
            const bankAccounts = accountsData.results;
            const accountPromises = bankAccounts.map((account) => {
              return Promise.all([
                new Promise((resolve) => {
                  _fetchApi(
                    `/bank-reconciliation-list?facilityId=${activeBusiness.id}&bankId=${account.id}`,
                    (data) => {
                      if (data.success && data.results) {
                        resolve(data.results || []);
                      } else {
                        resolve([]);
                      }
                    },
                    () => resolve([])
                  );
                }),
                fetchDiscrepancies(account.id),
              ]);
            });

            Promise.all(accountPromises)
              .then((allResults) => {
                const transactions = allResults.map(([txns]) => txns).flat();
                const totalDiscrepancies = allResults.reduce((sum, [, discrepancies]) => sum + discrepancies, 0);
                const matched = transactions.filter((t) => t.reconciled === "matched").length;
                const unmatched = transactions.filter((t) => t.reconciled === "unmatched").length;
                const totalAmount = transactions.reduce((sum, txn) => sum + Math.abs(parseFloat(txn.amount || 0)), 0);

                setReconciliationStatus({
                  matched,
                  unmatched,
                  discrepancies: totalDiscrepancies,
                  totalAmount: totalAmount,
                });
                setLoadingStats(false);
              })
              .catch((err) => {
                console.error("Error aggregating reconciliation stats:", err);
                setReconciliationStatus({ matched: 0, unmatched: 0, discrepancies: 0, totalAmount: 0 });
                setLoadingStats(false);
              });
          } else {
            setReconciliationStatus({ matched: 0, unmatched: 0, discrepancies: 0, totalAmount: 0 });
            setLoadingStats(false);
          }
        },
        (err) => {
          console.error("Error fetching bank accounts:", err);
          setReconciliationStatus({ matched: 0, unmatched: 0, discrepancies: 0, totalAmount: 0 });
          setLoadingStats(false);
        }
      );
    }
  }, [selectedAccount, activeBusiness?.id]);

  useEffect(() => {
    fetchReconciliationStats();
  }, [selectedAccount, fetchReconciliationStats]);

  const handleAccountSelect = (accountId, accountCode) => {
    setSearchParams({ bankId: accountId, accountCode: accountCode });
  };

  const handleInterestSubmit = () => {
    if (!interestForm.amount || !interestForm.date || !interestForm.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!selectedAccount) {
      toast.error("Please select a bank account first");
      return;
    }

    setLoadingInterest(true);

    const payload = {
      facilityId: activeBusiness.id,
      bankAccountId: selectedAccount,
      amount: interestForm.amount,
      date: interestForm.date,
      description: interestForm.description,
      reference: interestForm.reference || `INT-${Date.now()}`,
      createdBy: currentUser?.id || null,
      user_id: currentUser?.id || null,
    };

    _postApi(
      "/api/add/interest",
      payload,
      (res) => {
        if (res.success) {
          toast.success(res.message || "Interest added successfully");
          setIsInterestModalOpen(false);
          setInterestForm({
            amount: "",
            date: new Date().toISOString().split("T")[0],
            description: "",
            reference: "",
          });
          setLoadingInterest(false);
          fetchReconciliationStats();
          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent("reconciliationUpdated"));
          }
        } else {
          toast.error(res.message || "Failed to add interest");
          setLoadingInterest(false);
        }
      },
      (err) => {
        console.error("Error adding interest:", err);
        toast.error("Error adding interest");
        setLoadingInterest(false);
      }
    );
  };

  const handleChargesSubmit = () => {
    if (!chargesForm.amount || !chargesForm.date || !chargesForm.description || !chargesForm.chargeType) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!selectedAccount) {
      toast.error("Please select a bank account first");
      return;
    }

    setLoadingCharges(true);

    const payload = {
      facilityId: activeBusiness.id,
      bankAccountId: selectedAccount,
      amount: chargesForm.amount,
      date: chargesForm.date,
      description: chargesForm.description,
      reference: chargesForm.reference || `CHG-${Date.now()}`,
      chargeType: chargesForm.chargeType,
      createdBy: currentUser?.id || null,
      user_id: currentUser?.id || null,
    };

    _postApi(
      "/api/add/charges",
      payload,
      (res) => {
        if (res.success) {
          toast.success(res.message || "Charges added successfully");
          setIsChargesModalOpen(false);
          setChargesForm({
            amount: "",
            date: new Date().toISOString().split("T")[0],
            description: "",
            reference: "",
            chargeType: "",
          });
          setLoadingCharges(false);
          fetchReconciliationStats();
          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent("reconciliationUpdated"));
          }
        } else {
          toast.error(res.message || "Failed to add charges");
          setLoadingCharges(false);
        }
      },
      (err) => {
        console.error("Error adding charges:", err);
        toast.error("Error adding charges");
        setLoadingCharges(false);
      }
    );
  };

  const handleInterestCancel = () => {
    setIsInterestModalOpen(false);
    setInterestForm({
      amount: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
      reference: "",
    });
  };

  const handleChargesCancel = () => {
    setIsChargesModalOpen(false);
    setChargesForm({
      amount: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
      reference: "",
      chargeType: "",
    });
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Bank Reconciliation
            </h1>
            <p className="text-gray-600">
              Automated transaction matching and discrepancy management
            </p>
          </div>

          {selectedAccount && (
            <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => navigate(`audit-trail?bankId=${selectedAccount}`)}
              >
                <FileText className="h-4 w-4" />
                Audit Trail
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => navigate(`reports?bankId=${selectedAccount}`)}
              >
                <BarChart3 className="h-4 w-4" />
                Reports
              </Button>
              <Button
                variant="destructive"
                size="icon"
                className="h-10 w-10"
                onClick={() => navigate("/app/audit/bank-reconciliation")}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Dynamic Content Area */}
        {!selectedAccount ? (
          <>
            {/* Quick Stats Summary when NO account is selected */}
            {/* <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Matched Transactions</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {loadingStats ? "..." : reconciliationStatus.matched.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">Successfully reconciled overall</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unmatched Items</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">
                    {loadingStats ? "..." : reconciliationStatus.unmatched.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">Requiring attention overall</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Discrepancies</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {loadingStats ? "..." : reconciliationStatus.discrepancies.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">Need investigation overall</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingStats ? "..." : `₦${reconciliationStatus.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </div>
                  <p className="text-xs text-muted-foreground">Current period overall</p>
                </CardContent>
              </Card>
            </div> */}

            <BankAccountsList
              onAccountSelect={handleAccountSelect}
              selectedAccount={selectedAccount}
            />
          </>
        ) : (
          <div className="space-y-4">
            <TransactionMatching
              selectedAccount={selectedAccount}
              onMatchSaved={fetchReconciliationStats}
            />
          </div>
        )}

        {/* Interest Modal */}
        {isInterestModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    Add Interest
                  </h2>
                  <button
                    onClick={handleInterestCancel}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="number"
                        required
                        placeholder="0.00"
                        value={interestForm.amount}
                        onChange={(e) =>
                          setInterestForm({
                            ...interestForm,
                            amount: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="date"
                        required
                        value={interestForm.date}
                        onChange={(e) =>
                          setInterestForm({
                            ...interestForm,
                            date: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      required
                      placeholder="Interest description"
                      value={interestForm.description}
                      onChange={(e) =>
                        setInterestForm({
                          ...interestForm,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reference Number
                    </label>
                    <Input
                      type="text"
                      placeholder="Optional reference"
                      value={interestForm.reference}
                      onChange={(e) =>
                        setInterestForm({
                          ...interestForm,
                          reference: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={handleInterestSubmit}
                      disabled={loadingInterest}
                      className="flex-[2] flex items-center justify-center gap-2 bg-[#4267B2] hover:bg-[#365899]"
                    >
                      {loadingInterest ? (
                        <Loader className="animate-spin w-4 h-4" />
                      ) : (
                        "Add Interest"
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={handleInterestCancel}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 rounded-md transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charges Modal */}
        {isChargesModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    Add Charges
                  </h2>
                  <button
                    onClick={handleChargesCancel}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Charge Type <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={chargesForm.chargeType}
                      onValueChange={(value) =>
                        setChargesForm({
                          ...chargesForm,
                          chargeType: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select charge type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="service_charge">Service Charge</SelectItem>
                        <SelectItem value="maintenance_fee">Maintenance Fee</SelectItem>
                        <SelectItem value="transaction_fee">Transaction Fee</SelectItem>
                        <SelectItem value="penalty">Penalty</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="number"
                        required
                        placeholder="0.00"
                        value={chargesForm.amount}
                        onChange={(e) =>
                          setChargesForm({
                            ...chargesForm,
                            amount: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="date"
                        required
                        value={chargesForm.date}
                        onChange={(e) =>
                          setChargesForm({
                            ...chargesForm,
                            date: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      required
                      placeholder="Charge description"
                      value={chargesForm.description}
                      onChange={(e) =>
                        setChargesForm({
                          ...chargesForm,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reference Number
                    </label>
                    <Input
                      type="text"
                      placeholder="Optional reference"
                      value={chargesForm.reference}
                      onChange={(e) =>
                        setChargesForm({
                          ...chargesForm,
                          reference: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={handleChargesSubmit}
                      disabled={loadingCharges}
                      className="flex-[2] flex items-center justify-center gap-2 bg-[#4267B2] hover:bg-[#365899]"
                    >
                      {loadingCharges ? (
                        <Loader className="animate-spin w-4 h-4" />
                      ) : (
                        "Add Charges"
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={handleChargesCancel}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 rounded-md transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankReconciliation1;
