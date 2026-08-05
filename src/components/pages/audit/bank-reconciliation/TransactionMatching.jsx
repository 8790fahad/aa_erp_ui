import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Search, Sparkles, RefreshCw, Settings2, Link, UploadCloud, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { findSuggestedMatches } from "@/utils/bankMatchingEngine";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import BankStatementUpload from "./BankStatementUpload";
import MatchingRulesManager from "./MatchingRuleManager";
import MatchedList from "./MatchedList";
import ConfirmationModal from "./ConfirmationModal";
import DiscrepancyReport from "./DiscrepencyReport";
import DirectPostModal from "./DirectPostModal";
import { useSearchParams } from "react-router-dom";

const TransactionMatching = ({ selectedAccount, onMatchSaved }) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const currentUser = useSelector((state) => state.auth.user);
  const [searchParams, setSearchParams] = useSearchParams();

  // Main state
  const [allTransactions, setAllTransactions] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [matchingRules, setMatchingRules] = useState([]);
  const [selectedRule, setSelectedRule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Selection state
  const [selectedBankIds, setSelectedBankIds] = useState([]);
  const [selectedAppIds, setSelectedAppIds] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isDirectPostOpen, setIsDirectPostOpen] = useState(false);
  const [directPostType, setDirectPostType] = useState("charge");
  const [bankAccount, setBankAccount] = useState(null);

  // Filters from searchParams
  const search = searchParams.get("search") || "";

  // Default to current month if no dates are provided
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const dateFrom = searchParams.get("dateFrom") || firstDay;
  const dateTo = searchParams.get("dateTo") || lastDay;

  const [localDateFrom, setLocalDateFrom] = useState(dateFrom);
  const [localDateTo, setLocalDateTo] = useState(dateTo);

  // Sync local state when search params change (e.g. on mount or back button)
  useEffect(() => {
    setLocalDateFrom(dateFrom);
    setLocalDateTo(dateTo);
  }, [dateFrom, dateTo]);

  const applyDateFilters = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("dateFrom", localDateFrom);
    newParams.set("dateTo", localDateTo);
    setSearchParams(newParams);
  };

  const updateFilters = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const getBankTransactions = useCallback(() => {
    if (!selectedAccount || !activeBusiness?.id) {
      setAllTransactions([]);
      return;
    }

    setLoading(true);

    _fetchApi(
      `/bank-reconciliation-list?facilityId=${activeBusiness.id}&bankId=${selectedAccount}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
      (data) => {
        if (data.success) {
          const transformedTransactions =
            data.results?.map((txn) => {
              let dateStr = "";
              if (txn.date) {
                dateStr = txn.date;
              } else if (txn.created_at) {
                dateStr = new Date(txn.created_at).toISOString().split("T")[0];
              } else {
                dateStr = new Date().toISOString().split("T")[0];
              }

              return {
                id: txn.id || txn.transaction_id || `bank_${txn.id}`,
                originalId:
                  txn.originalId ||
                  (txn.source === "statement"
                    ? txn.id?.toString().startsWith("statement_")
                      ? txn.id.toString().replace("statement_", "")
                      : txn.id
                    : txn.transaction_id || txn.id),
                date: dateStr,
                description:
                  txn.description || txn.narration || "Bank Transaction",
                amount: parseFloat(txn.amount || 0),
                type:
                  txn.type ||
                  (parseFloat(txn.amount || 0) >= 0 ? "credit" : "debit"),
                reference:
                  txn.reference ||
                  txn.reference_number ||
                  txn.transaction_ref ||
                  "",
                source: txn.source || "ledger",
                reconciled: txn.reconciled || "unmatched",
                matched_transaction_id: txn.matched_transaction_id || null,
                updated_at: txn.updated_at,
              };
            }) || [];

          setAllTransactions(transformedTransactions);
          loadMatchedPairs(transformedTransactions);
        } else {
          toast.error(data.message || "Failed to load transactions");
          setAllTransactions([]);
        }
        setLoading(false);
      },
      () => {
        toast.error("Error loading transactions");
        setLoading(false);
        setAllTransactions([]);
      }
    );
  }, [selectedAccount, activeBusiness?.id, dateFrom, dateTo]);

  const getBankAccountDetails = useCallback(() => {
    if (!selectedAccount || !activeBusiness?.id) return;

    _fetchApi(
      `/api/get/bank-account/by-id/${selectedAccount}?facilityId=${activeBusiness.id}`,
      (data) => {
        if (data.success) {
          setBankAccount(data.results);
        }
      }
    );
  }, [selectedAccount, activeBusiness?.id]);

  useEffect(() => {
    getBankAccountDetails();
  }, [getBankAccountDetails]);

  const loadMatchedPairs = (transactions) => {
    const pairs = [];
    const processedPairs = new Set();
    const matchedBankTransactions = transactions.filter(
      (t) => t.source === "statement" && t.reconciled === "matched" && t.matched_transaction_id
    );

    matchedBankTransactions.forEach((bankTx) => {
      const ledgerTx = transactions.find((t) => {
        if (t.source !== "ledger") return false;
        const bankMatchedId = bankTx.matched_transaction_id;
        return (
          t.originalId === bankMatchedId ||
          t.originalId?.toString() === bankMatchedId?.toString() ||
          parseInt(t.originalId) === parseInt(bankMatchedId) ||
          t.id === `ledger_${bankMatchedId}`
        );
      });

      if (ledgerTx) {
        const pairKey = `${bankTx.originalId || bankTx.id}-${ledgerTx.originalId || ledgerTx.id}`;
        if (!processedPairs.has(pairKey)) {
          processedPairs.add(pairKey);
          pairs.push({
            id: `match-${bankTx.originalId || bankTx.id}-${ledgerTx.originalId || ledgerTx.id}`,
            bankTransaction: bankTx,
            inAppTransaction: ledgerTx,
            matchedDate: bankTx.updated_at || ledgerTx.updated_at || new Date().toISOString().split("T")[0],
          });
        }
      }
    });

    setMatchedPairs(pairs);
  };

  useEffect(() => {
    getBankTransactions();
  }, [getBankTransactions]);

  const bankStatementTransactions = useMemo(() => {
    return allTransactions.filter((txn) => txn.source === "statement");
  }, [allTransactions]);

  const generalLedgerTransactions = useMemo(() => {
    return allTransactions.filter((txn) => txn.source === "ledger");
  }, [allTransactions]);

  const filterTransactions = (transactions) => {
    return transactions.filter((transaction) => {
      if (search && !transaction.description.toLowerCase().includes(search.toLowerCase()) &&
          !(transaction.reference && transaction.reference.toLowerCase().includes(search.toLowerCase()))) {
        return false;
      }
      if (dateFrom && transaction.date < dateFrom) {
        return false;
      }
      if (dateTo && transaction.date > dateTo) {
        return false;
      }
      return true;
    });
  };

  const filteredBankTransactions = useMemo(
    () => filterTransactions(bankStatementTransactions.filter((t) => t.reconciled === "unmatched")),
    [bankStatementTransactions, search, dateFrom, dateTo]
  );

  const filteredInAppTransactions = useMemo(
    () => filterTransactions(generalLedgerTransactions.filter((t) => t.reconciled === "unmatched")),
    [generalLedgerTransactions, search, dateFrom, dateTo]
  );

  const runAutoMatch = () => {
    if (matchingRules.length === 0) {
      toast.error("Please create at least one matching rule first");
      return;
    }
    if (bankStatementTransactions.length === 0) {
      toast.error("No bank statement transactions found.");
      return;
    }
    if (generalLedgerTransactions.length === 0) {
      toast.error("No general ledger transactions found for this account.");
      return;
    }

    const suggestions = findSuggestedMatches(
      bankStatementTransactions,
      generalLedgerTransactions,
      matchingRules
    );

    if (suggestions.length === 0) {
      toast("No Matches Found", { description: "No automatic matches found based on current rules." });
    } else {
      let matchedCount = 0;
      suggestions.forEach((suggestion) => {
        performMatch(suggestion.bankTransactionId, suggestion.inAppTransactionId, true, true);
        matchedCount++;
      });
      toast.success(`Successfully auto-matched ${matchedCount} transaction pairs`);
    }
  };

  const saveMatchToBackend = useCallback(
    async (bankIds, appIds, bankTxns, appTxns) => {
      if (!activeBusiness?.id) return;

      const bankTransactions = bankTxns || allTransactions.filter((t) => bankIds.includes(t.id));
      const appTransactions = appTxns || allTransactions.filter((t) => appIds.includes(t.id));

      if (bankTransactions.length === 0 || appTransactions.length === 0) return;

      const dbBankIds = bankTransactions.map(t => {
        let id = t.originalId || t.id;
        return id.toString().startsWith("statement_") ? id.replace("statement_", "") : id;
      });

      const dbAppIds = appTransactions.map(t => {
        let id = t.originalId || t.id;
        return id.toString().startsWith("ledger_") ? id.replace("ledger_", "") : id;
      });

      const bankSum = bankTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0);
      const appSum = appTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0);

      _postApi(
        `/api/bank-reconciliation/match`,
        {
          facilityId: activeBusiness.id,
          bankAccountId: selectedAccount,
          bankTransactionId: dbBankIds,
          ledgerTransactionId: dbAppIds,
          bankAmount: bankSum,
          ledgerAmount: appSum,
          bankDate: bankTransactions[0].date,
          ledgerDate: appTransactions[0].date,
          user_id: currentUser?.id || "",
          createdBy: currentUser?.id || "",
        },
        (data) => {
          if (data.success) {
            if (data.discrepancyCreated) {
              toast.warning("Match saved, but a discrepancy was automatically created due to mismatches");
            }
            getBankTransactions();
            if (onMatchSaved) onMatchSaved();
          } else {
            toast.error(data.message || "Failed to save match");
          }
        },
        () => toast.error("Error saving match")
      );
    },
    [allTransactions, activeBusiness?.id, selectedAccount, getBankTransactions, onMatchSaved, currentUser?.id]
  );

  const checkForDiscrepancies = useCallback((bankTxns, appTxns) => {
    const bankAmount = bankTxns.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0);
    const ledgerAmount = appTxns.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0);
    const amountDiff = Math.abs(bankAmount - ledgerAmount);
    const hasAmountMismatch = amountDiff >= 0.01;

    const bankDate = bankTxns[0]?.date ? new Date(bankTxns[0].date) : null;
    const ledgerDate = appTxns[0]?.date ? new Date(appTxns[0].date) : null;
    let hasDateMismatch = false;
    let daysDiff = 0;
    if (bankDate && ledgerDate) {
      daysDiff = Math.abs((bankDate - ledgerDate) / (1000 * 60 * 60 * 24));
      hasDateMismatch = daysDiff > 7;
    }

    return {
      hasDiscrepancy: hasAmountMismatch || hasDateMismatch,
      hasAmountMismatch,
      hasDateMismatch,
      amountDiff,
      daysDiff,
      bankAmount,
      ledgerAmount
    };
  }, []);

  const performMatch = useCallback(
    (bankIds, appIds, silent = false, skipDiscrepancyCheck = false) => {
      // If we pass a single ID (from auto-match), convert to array
      const bIds = Array.isArray(bankIds) ? bankIds : [bankIds];
      const aIds = Array.isArray(appIds) ? appIds : [appIds];

      const bankTxns = allTransactions.filter((t) => bIds.includes(t.id));
      const appTxns = allTransactions.filter((t) => aIds.includes(t.id));

      if (bankTxns.length === 0 || appTxns.length === 0) return;

      if (!skipDiscrepancyCheck) {
        const discrepancyCheck = checkForDiscrepancies(bankTxns, appTxns);
        if (discrepancyCheck.hasDiscrepancy) {
          const issues = [];
          if (discrepancyCheck.hasAmountMismatch) {
            issues.push(`Amount mismatch: ₦${discrepancyCheck.amountDiff.toFixed(2)} difference`);
          }
          if (discrepancyCheck.hasDateMismatch) {
            issues.push(`Date mismatch: ${Math.round(discrepancyCheck.daysDiff)} days apart`);
          }

          const confirmMessage = `Warning: This match has discrepancies:\n${issues.join('\n')}\n\nDo you want to proceed with the match?`;
          if (!window.confirm(confirmMessage)) return;
        }
      }

      setAllTransactions((prev) =>
        prev.map((t) => {
          if (bIds.includes(t.id) || aIds.includes(t.id)) {
            return {
              ...t,
              reconciled: "matched",
              matched_transaction_id: bIds.includes(t.id) ? aIds.join(',') : bIds.join(','),
            };
          }
          return t;
        })
      );

      const newMatch = {
        id: `match-${Date.now()}-${Math.random()}`,
        bankTransaction: bankTxns[0], // for compatibility with MatchedList display
        inAppTransaction: appTxns[0],
        bankTransactions: bankTxns,
        inAppTransactions: appTxns,
        matchedDate: new Date().toISOString().split("T")[0],
      };

      setMatchedPairs((prev) => [...prev, newMatch]);
      saveMatchToBackend(bIds, aIds, bankTxns, appTxns);

      if (!silent) toast.success("Transactions matched successfully");
    },
    [allTransactions, saveMatchToBackend, checkForDiscrepancies]
  );

  const toggleBankSelection = (bankId) => {
    setSelectedBankIds(prev => prev.includes(bankId) ? prev.filter(id => id !== bankId) : [...prev, bankId]);
  };

  const toggleAppSelection = (appId) => {
    setSelectedAppIds(prev => prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]);
  };

  const handleConfirmMatch = () => {
    if (selectedBankIds.length === 0 || selectedAppIds.length === 0) return;
    performMatch(selectedBankIds, selectedAppIds);
    setSelectedBankIds([]);
    setSelectedAppIds([]);
    setIsModalOpen(false);
  };

  const handleDirectPost = async (formData) => {
    if (!activeBusiness?.id || !selectedAccount) return;

    const cleanedBankIds = formData.bankTransactionIds.map((id) =>
      id.toString().startsWith("statement_")
        ? id.replace("statement_", "")
        : id,
    );

    return new Promise((resolve, reject) => {
      _postApi(
        `/api/bank-reconciliation/direct-post-match`,
        {
          ...formData,
          bankTransactionIds: cleanedBankIds,
          facilityId: activeBusiness.id,
          bankAccountId: selectedAccount,
          user_id: currentUser?.id || "",
          createdBy: currentUser?.id || "",
        },
        (data) => {
          if (data.success) {
            toast.success(data.message || "Posted and matched successfully");
            getBankTransactions();
            setSelectedBankIds([]);
            if (onMatchSaved) onMatchSaved();
            resolve(data);
          } else {
            toast.error(data.message || "Failed to post");
            reject(new Error(data.message));
          }
        },
        (err) => {
          toast.error("Error during direct post");
          reject(err);
        },
      );
    });
  };


  const handleDeleteStatements = async () => {
    if (selectedBankIds.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${selectedBankIds.length} selected bank statement transactions? This action cannot be undone.`)) {
      return;
    }

    const cleanedIds = selectedBankIds.map(id =>
      id.toString().startsWith("statement_") ? id.replace("statement_", "") : id
    );

    _postApi(
      `/api/bank-reconciliation/delete-statement-transactions`,
      {
        transactionIds: cleanedIds,
        facilityId: activeBusiness.id,
        user_id: currentUser?.id
      },
      (data) => {
        if (data.success) {
          toast.success(data.message);
          setSelectedBankIds([]);
          getBankTransactions();
        } else {
          toast.error(data.message || "Failed to delete transactions");
        }
      },
      () => toast.error("Error deleting transactions")
    );
  };

  const handleUndo = (matchId) => {
    const match = matchedPairs.find((m) => m.id === matchId);
    if (!match) return;

    setAllTransactions((prev) =>
      prev.map((t) => {
        if (t.id === match.bankTransaction.id || t.id === match.inAppTransaction.id) {
          return { ...t, reconciled: "unmatched", matched_transaction_id: null };
        }
        return t;
      })
    );

    setMatchedPairs((prev) => prev.filter((m) => m.id !== matchId));

    if (activeBusiness?.id) {
      let bankTransactionDbId = match.bankTransaction.originalId || match.bankTransaction.id;
      let ledgerTransactionDbId = match.inAppTransaction.originalId || match.inAppTransaction.id;

      if (bankTransactionDbId.toString().startsWith("statement_")) bankTransactionDbId = bankTransactionDbId.replace("statement_", "");
      if (ledgerTransactionDbId.toString().startsWith("ledger_")) ledgerTransactionDbId = ledgerTransactionDbId.replace("ledger_", "");

      _postApi(
        `/api/bank-reconciliation/unmatch`,
        {
          facilityId: activeBusiness.id,
          bankTransactionId: bankTransactionDbId,
          ledgerTransactionId: ledgerTransactionDbId,
          user_id: currentUser?.id || "",
          createdBy: currentUser?.id || "",
        },
        (data) => {
          if (data.success) {
            toast.success("Match undone successfully");
            getBankTransactions();
            if (onMatchSaved) onMatchSaved();
          } else {
            toast.error(data.message || "Failed to undo match");
          }
        },
        () => toast.error("Error undoing match")
      );
    }
  };

  const selectedBanks = allTransactions.filter((t) => selectedBankIds.includes(t.id));
  const selectedApps = allTransactions.filter((t) => selectedAppIds.includes(t.id));

  const totalBankSelectedAmount = selectedBanks.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0);
  const totalAppSelectedAmount = selectedApps.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0);

  // We keep upload closed by default as requested
  /* useEffect(() => {
    if (!loading && bankStatementTransactions.length === 0 && !isUploadOpen) {
      setIsUploadOpen(true);
    }
  }, [loading, bankStatementTransactions.length, isUploadOpen]); */

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* 1. Upload Statement Section (Collapsible) */}
      <Card className="bg-white border shadow-sm">
        <div
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => setIsUploadOpen(!isUploadOpen)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Upload Bank Statement</h3>
              <p className="text-xs text-slate-500">Add missing statements or update current month</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            {isUploadOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {isUploadOpen && (
          <div className="border-t border-slate-100 p-4">
            <BankStatementUpload
              onTransactionsUploaded={(data) => {
                getBankTransactions();
                setIsUploadOpen(false);
              }}
              selectedAccount={selectedAccount}
              onStatementUploaded={() => {
                getBankTransactions();
                setIsUploadOpen(false);
              }}
            />
          </div>
        )}
      </Card>

      {/* 2. Top Section: Active Selection Banner & Actions */}
      <Card className="bg-white border shadow-sm">
        <CardContent className="p-4 md:p-6 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-800">Action Center</h3>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                <Button
                  onClick={() => setIsRulesOpen(!isRulesOpen)}
                  variant={isRulesOpen ? "secondary" : "outline"}
                  className={`h-10 gap-2 font-medium ${isRulesOpen ? 'bg-slate-100 text-slate-900 border-slate-300' : 'text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                >
                  <Settings2 className="h-4 w-4" />
                  Matching Rules
                  {matchingRules.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-slate-200">{matchingRules.length}</Badge>
                  )}
                  {isRulesOpen ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                </Button>

                <Button
                  onClick={runAutoMatch}
                  variant="default"
                  className="h-10 gap-2 bg-[#4267B2] hover:bg-[#365899] transition-colors shadow-sm"
                >
                  <Sparkles className="h-4 w-4" />
                  Auto-Match All
                </Button>

                <Button onClick={getBankTransactions} variant="outline" size="icon" className="h-10 w-10 text-slate-500 border-slate-200 hover:text-slate-700">
                  <RefreshCw className="h-4 w-4" />
                </Button>
            </div>
          </div>

          {/* Collapsible Rules Section */}
          {isRulesOpen && (
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
               <div className="flex justify-between items-center mb-4">
                 <h4 className="font-medium text-slate-800 text-sm">Automated Matching Rules</h4>
               </div>
               <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  <MatchingRulesManager
                    rules={matchingRules}
                    onRulesChange={setMatchingRules}
                    onRuleSelected={(rule) => {
                      setSelectedRule(rule);
                      toast.success(`Rule "${rule.name}" activated`);
                    }}
                    selectedRule={selectedRule}
                  />
               </div>
            </div>
          )}

          {/* Match Pair Cards Banner */}
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
              <div className={`flex-1 w-full p-2.5 rounded-md border text-sm flex items-center justify-between transition-colors ${selectedBankIds.length > 0 ? 'border-blue-200 bg-blue-50/50 text-blue-800' : 'border-slate-200 bg-white text-slate-400 border-dashed'}`}>
                <span className="truncate max-w-[200px] pr-2">{selectedBanks.length > 0 ? `${selectedBanks.length} bank row(s) selected` : 'Select statement row(s)'}</span>
                <span className="font-semibold">{selectedBankIds.length > 0 ? `₦${totalBankSelectedAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}` : ''}</span>
              </div>
              <Link className="h-4 w-4 text-slate-300 flex-shrink-0" />
              <div className={`flex-1 w-full p-2.5 rounded-md border text-sm flex items-center justify-between transition-colors ${selectedAppIds.length > 0 ? 'border-indigo-200 bg-indigo-50/50 text-indigo-800' : 'border-slate-200 bg-white text-slate-400 border-dashed'}`}>
                 <span className="truncate max-w-[200px] pr-2">{selectedApps.length > 0 ? `${selectedApps.length} ledger row(s) selected` : 'Select ledger row(s)'}</span>
                 <span className="font-semibold">{selectedAppIds.length > 0 ? `₦${totalAppSelectedAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}` : ''}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
               {selectedBankIds.length > 0 && selectedAppIds.length === 0 && (
                 <>
                   <Button
                     onClick={() => {
                       setDirectPostType("charge");
                       setIsDirectPostOpen(true);
                     }}
                     variant="outline"
                     className="h-10 text-red-600 border-red-100 hover:bg-red-50"
                   >
                     Post as Charge
                   </Button>
                   <Button
                     onClick={() => {
                       setDirectPostType("interest");
                       setIsDirectPostOpen(true);
                     }}
                     variant="outline"
                     className="h-10 text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                   >
                     Post as Interest
                   </Button>
                 </>
               )}
               <Button
                onClick={() => setIsModalOpen(true)}
                disabled={selectedBankIds.length === 0 || selectedAppIds.length === 0}
                className="w-full md:w-32 h-10 font-medium shadow-sm flex-shrink-0"
                size="default"
              >
                Match Pair
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Filters (Search & Date) */}
      <div className="flex flex-col sm:flex-row gap-3 w-full items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search reference or description..."
            value={search}
            onChange={(e) => updateFilters("search", e.target.value)}
            className="pl-9 h-10 w-full bg-white shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-md shadow-sm border border-slate-200">
          <Input
            type="date"
            value={localDateFrom}
            onChange={(e) => setLocalDateFrom(e.target.value)}
            className="h-8 w-36 border-0 focus-visible:ring-0 text-sm"
          />
          <span className="text-gray-400 text-xs font-medium">TO</span>
          <Input
            type="date"
            value={localDateTo}
            onChange={(e) => setLocalDateTo(e.target.value)}
            className="h-8 w-36 border-0 focus-visible:ring-0 text-sm"
          />
          <Button
            onClick={applyDateFilters}
            size="sm"
            className="h-8 px-3 bg-slate-800 hover:bg-slate-900 text-white ml-1"
          >
            Apply
          </Button>
        </div>
      </div>

      {/* 4. Side-by-Side Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[650px]">

        {/* Left Column: Bank Statement */}
        <Card className="h-full flex flex-col overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="bg-white py-3 border-b flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-800">Bank Statement</CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">Uploaded transactions</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectedBankIds.length > 0 && (
                <Button
                  onClick={handleDeleteStatements}
                  variant="ghost"
                  size="sm"
                  className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  <span className="text-xs font-semibold">Delete</span>
                </Button>
              )}
              <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-mono">{filteredBankTransactions.length}</Badge>
            </div>
          </CardHeader>
          <div className="flex-1 overflow-auto bg-slate-50 p-0 relative">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                <TableRow className="border-slate-200">
                  <TableHead className="w-8 h-9 text-center pl-4">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) setSelectedBankIds(filteredBankTransactions.map(t => t.id));
                        else setSelectedBankIds([]);
                      }}
                      checked={filteredBankTransactions.length > 0 && selectedBankIds.length === filteredBankTransactions.length}
                      className="rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead className="w-[90px] text-xs font-medium text-slate-500 h-9">Date</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 h-9">Description</TableHead>
                  <TableHead className="text-right text-xs font-medium text-slate-500 h-9 pr-4">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(10)].map((_, i) => (
                    <TableRow key={i} className="bg-white border-b-slate-100">
                      <TableCell className="pl-4"><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="pr-4"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredBankTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-[400px] text-center text-slate-400 text-sm">
                      No unmatched statements for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBankTransactions.map((transaction) => {
                    const isSelected = selectedBankIds.includes(transaction.id);
                    return (
                      <TableRow
                        key={transaction.id}
                        className={`cursor-pointer transition-colors border-b-slate-100 ${
                          isSelected ? "bg-blue-50 hover:bg-blue-50 border-l-2 border-l-blue-500" : "bg-white hover:bg-slate-50 border-l-2 border-l-transparent"
                        }`}
                        onClick={() => toggleBankSelection(transaction.id)}
                      >
                      <TableCell className="pl-4">
                        <input type="checkbox" checked={isSelected} readOnly className="rounded border-gray-300" />
                      </TableCell>
                      <TableCell className="text-[11px] whitespace-nowrap text-slate-500 py-2.5">{transaction.date}</TableCell>
                      <TableCell className="py-2.5">
                        <div className={`font-medium text-sm leading-tight ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>{transaction.description}</div>
                        {transaction.reference && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{transaction.reference}</div>}
                      </TableCell>
                      <TableCell
                        className={`text-sm text-right font-semibold py-2.5 pr-4 ${
                          transaction.type === "credit"
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {Math.abs(transaction.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                        <span
                          className={`ml-1 text-[10px] font-bold uppercase ${
                            transaction.type === "credit"
                              ? "text-emerald-700"
                              : "text-rose-700"
                          }`}
                        >
                          {transaction.type === "credit" ? "Cr" : "Dr"}
                        </span>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
                </TableBody>
              </Table>
         
          </div>
        </Card>

        {/* Right Column: General Ledger */}
        <Card className="h-full flex flex-col overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="bg-white py-3 border-b flex flex-row items-center justify-between space-y-0">
             <div>
              <CardTitle className="text-sm font-semibold text-slate-800">General Ledger</CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">System transactions</CardDescription>
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-mono">{filteredInAppTransactions.length}</Badge>
          </CardHeader>
          <div className="flex-1 overflow-auto bg-slate-50 p-0 relative">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                <TableRow className="border-slate-200">
                  <TableHead className="w-8 h-9 text-center pl-4">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) setSelectedAppIds(filteredInAppTransactions.map(t => t.id));
                        else setSelectedAppIds([]);
                      }}
                      checked={filteredInAppTransactions.length > 0 && selectedAppIds.length === filteredInAppTransactions.length}
                      className="rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead className="w-[90px] text-xs font-medium text-slate-500 h-9">Date</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 h-9">Description</TableHead>
                  <TableHead className="text-right text-xs font-medium text-slate-500 h-9 pr-4">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(10)].map((_, i) => (
                    <TableRow key={i} className="bg-white border-b-slate-100">
                      <TableCell className="pl-4"><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="pr-4"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredInAppTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-[400px] text-center text-slate-400 text-sm">
                      No matching ledger transactions for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInAppTransactions.map((transaction) => {
                    const isSelected = selectedAppIds.includes(transaction.id);
                    return (
                      <TableRow
                        key={transaction.id}
                        className={`cursor-pointer transition-colors border-b-slate-100 ${
                          isSelected ? "bg-indigo-50 hover:bg-indigo-50 border-l-2 border-l-indigo-500" : "bg-white hover:bg-slate-50 border-l-2 border-l-transparent"
                        }`}
                        onClick={() => toggleAppSelection(transaction.id)}
                      >
                      <TableCell className="pl-4">
                        <input type="checkbox" checked={isSelected} readOnly className="rounded border-gray-300" />
                      </TableCell>
                      <TableCell className="text-[11px] whitespace-nowrap text-slate-500 py-2.5">{transaction.date}</TableCell>
                      <TableCell className="py-2.5">
                        <div className={`font-medium text-sm leading-tight ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{transaction.description}</div>
                        {transaction.reference && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{transaction.reference}</div>}
                      </TableCell>
                      <TableCell
                        className={`text-sm text-right font-semibold py-2.5 pr-4 ${
                          transaction.type === "credit"
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {Math.abs(transaction.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                        <span
                          className={`ml-1 text-[10px] font-bold uppercase ${
                            transaction.type === "credit"
                              ? "text-emerald-700"
                              : "text-rose-700"
                          }`}
                        >
                          {transaction.type === "credit" ? "Cr" : "Dr"}
                        </span>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Discrepancies and Matched Log */}
      <div className="grid grid-cols-1 gap-6 pt-6 mt-8">
        <MatchedList matchedPairs={matchedPairs} onUndo={handleUndo} bankAccount={bankAccount} />
        <DiscrepancyReport selectedAccount={selectedAccount} />
      </div>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmMatch}
        bankTransaction={selectedBanks[0] || null}
        inAppTransaction={selectedApps[0] || null}
      />

      <DirectPostModal
        isOpen={isDirectPostOpen}
        onClose={() => setIsDirectPostOpen(false)}
        onPost={handleDirectPost}
        selectedTransactions={selectedBanks}
        type={directPostType}
      />

    </div>
  );
};

export default TransactionMatching;
