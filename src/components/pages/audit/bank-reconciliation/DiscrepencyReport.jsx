import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, DollarSign, Calendar, FileText, Plus, X, ChevronUp, ChevronDown, Info } from 'lucide-react';
import { useSelector } from 'react-redux';
import { _fetchApi, _postApi } from '@/redux/actions/api';
import { toast } from 'sonner';

const DiscrepancyReport = ({ selectedAccount }) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const currentUser = useSelector((state) => state.auth.user);
  const [unmatchedTransactions, setUnmatchedTransactions] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [matchedPairsWithDiscrepancies, setMatchedPairsWithDiscrepancies] = useState([]);
  const [recordedDiscrepancies, setRecordedDiscrepancies] = useState([]);
  const [matchingRules, setMatchingRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMatchedPair, setSelectedMatchedPair] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [discrepancyForm, setDiscrepancyForm] = useState({
    discrepancyType: 'amount_mismatch',
    description: '',
    severity: 'medium',
    status: 'open',
    notes: ''
  });

  // Fetch all transactions and identify matched pairs with discrepancies
  const fetchMatchedPairsWithDiscrepancies = useCallback(() => {
    if (!selectedAccount || !activeBusiness?.id) {
      setMatchedPairs([]);
      setMatchedPairsWithDiscrepancies([]);
      return;
    }

    setLoading(true);
    _fetchApi(
      `/bank-reconciliation-list?facilityId=${activeBusiness.id}&bankId=${selectedAccount}`,
      (data) => {
        if (data.success && data.results) {
          // Filter unmatched transactions
          const unmatched = data.results.filter(t => t.reconciled === 'unmatched');
          setUnmatchedTransactions(unmatched);

          // Get matched transactions (those with matched_transaction_id)
          const matchedTransactions = data.results.filter(t => 
            t.reconciled === 'matched' || t.matched_transaction_id
          );

          // Group into pairs
          const pairs = [];
          const processedIds = new Set();

          matchedTransactions.forEach((txn) => {
            if (processedIds.has(txn.id)) return;

            const matchedId = txn.matched_transaction_id;
            if (!matchedId) return;

            const matchedTxn = matchedTransactions.find(
              (t) => (t.id === matchedId || t.transaction_id === matchedId) && t.id !== txn.id
            );

            if (matchedTxn) {
              const bankTxn = txn.source === 'statement' ? txn : matchedTxn;
              const ledgerTxn = txn.source === 'ledger' ? txn : matchedTxn;

              pairs.push({
                id: `${txn.id}_${matchedTxn.id}`,
                bankTransaction: bankTxn,
                ledgerTransaction: ledgerTxn,
                matchedDate: txn.matched_date || txn.updated_at || txn.created_at
              });

              processedIds.add(txn.id);
              processedIds.add(matchedTxn.id);
            }
          });

          setMatchedPairs(pairs);

          // Check for discrepancies in matched pairs
          const pairsWithDiscrepancies = pairs.filter((pair) => {
            const bankAmount = Math.abs(parseFloat(pair.bankTransaction.amount || 0));
            const ledgerAmount = Math.abs(parseFloat(pair.ledgerTransaction.amount || 0));
            const bankDate = pair.bankTransaction.date ? new Date(pair.bankTransaction.date) : null;
            const ledgerDate = pair.ledgerTransaction.date ? new Date(pair.ledgerTransaction.date) : null;

            // Check amount mismatch
            const amountDiff = Math.abs(bankAmount - ledgerAmount);
            const hasAmountMismatch = amountDiff >= 0.01;

            // Check date mismatch (more than 7 days apart)
            let hasDateMismatch = false;
            if (bankDate && ledgerDate) {
              const daysDiff = Math.abs((bankDate - ledgerDate) / (1000 * 60 * 60 * 24));
              hasDateMismatch = daysDiff > 7;
            }

            return hasAmountMismatch || hasDateMismatch;
          });

          setMatchedPairsWithDiscrepancies(pairsWithDiscrepancies);
        } else {
          setMatchedPairs([]);
          setMatchedPairsWithDiscrepancies([]);
          setUnmatchedTransactions([]);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching transactions:", err);
        setMatchedPairs([]);
        setMatchedPairsWithDiscrepancies([]);
        setUnmatchedTransactions([]);
        setLoading(false);
      }
    );
  }, [selectedAccount, activeBusiness?.id]);

  // Fetch recorded discrepancies
  const fetchDiscrepancies = useCallback(() => {
    if (!selectedAccount || !activeBusiness?.id) {
      setRecordedDiscrepancies([]);
      return;
    }

    _fetchApi(
      `/api/get/discrepancies?facilityId=${activeBusiness.id}&bankAccountId=${selectedAccount}`,
      (data) => {
        if (data.success && data.results) {
          setRecordedDiscrepancies(data.results);
        } else {
          setRecordedDiscrepancies([]);
        }
      },
      (err) => {
        console.error("Error fetching discrepancies:", err);
        setRecordedDiscrepancies([]);
      }
    );
  }, [selectedAccount, activeBusiness?.id]);

  // Fetch matching rules
  const fetchMatchingRules = useCallback(() => {
    if (!activeBusiness?.id) {
      setMatchingRules([]);
      return;
    }

    _fetchApi(
      `/api/get/matching-rules?facilityId=${activeBusiness.id}`,
      (data) => {
        if (data.success && data.results) {
          setMatchingRules(data.results || []);
        } else {
          setMatchingRules([]);
        }
      },
      (err) => {
        console.error("Error fetching matching rules:", err);
        setMatchingRules([]);
      }
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    fetchMatchedPairsWithDiscrepancies();
    fetchDiscrepancies();
    fetchMatchingRules();
  }, [fetchMatchedPairsWithDiscrepancies, fetchDiscrepancies, fetchMatchingRules]);

  // Helper function to calculate string similarity
  const calculateStringSimilarity = (str1, str2) => {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    // Simple similarity based on common characters and length
    let matches = 0;
    const shorterSet = new Set(shorter.split(''));
    for (const char of longer) {
      if (shorterSet.has(char)) {
        matches++;
      }
    }
    
    return matches / Math.max(longer.length, shorter.length);
  };

  // Calculate match confidence between two transactions based on a rule
  const calculateMatchConfidence = useCallback((transaction, candidate, rule) => {
    if (!rule || !rule.conditions || !Array.isArray(rule.conditions) || rule.conditions.length === 0) {
      return {
        matches: false,
        confidence: 0,
        reasons: []
      };
    }

    const bankAmount = Math.abs(parseFloat(transaction.amount || 0));
    const appAmount = Math.abs(parseFloat(candidate.amount || 0));
    const bankDate = transaction.date ? new Date(transaction.date) : null;
    const appDate = candidate.date ? new Date(candidate.date) : null;
    const bankRef = (transaction.reference || transaction.reference_number || '').toLowerCase().trim();
    const appRef = (candidate.reference || candidate.reference_number || '').toLowerCase().trim();
    const bankDesc = (transaction.description || transaction.narration || '').toLowerCase().trim();
    const appDesc = (candidate.description || candidate.narration || '').toLowerCase().trim();

    let matchedConditions = 0;
    let totalConditions = rule.conditions.length;
    const reasons = [];
    let confidence = 0;

    for (const condition of rule.conditions) {
      let conditionMatched = false;
      let conditionConfidence = 0;

      if (condition.field === 'amount' && condition.operator === 'equals') {
        const diff = Math.abs(bankAmount - appAmount);
        if (diff < 0.01) {
          conditionMatched = true;
          conditionConfidence = 100;
          reasons.push('Amount matches exactly');
        } else {
          // Partial match based on how close the amounts are
          const maxAmount = Math.max(bankAmount, appAmount);
          if (maxAmount > 0) {
            const similarity = Math.max(0, 100 - (diff / maxAmount) * 100);
            conditionConfidence = similarity;
            if (similarity > 50) {
              conditionMatched = true;
              reasons.push(`Amount close match (${similarity.toFixed(1)}% similarity)`);
            }
          }
        }
      } else if (condition.field === 'date' && condition.operator === 'equals') {
        if (bankDate && appDate) {
          const daysDiff = Math.abs((bankDate - appDate) / (1000 * 60 * 60 * 24));
          if (daysDiff === 0) {
            conditionMatched = true;
            conditionConfidence = 100;
            reasons.push('Date matches exactly');
          } else if (daysDiff <= 7) {
            conditionMatched = true;
            conditionConfidence = Math.max(0, 100 - (daysDiff * 10));
            reasons.push(`Date close match (${Math.round(daysDiff)} days apart)`);
          } else if (daysDiff <= 30) {
            conditionConfidence = Math.max(0, 100 - (daysDiff * 3));
            if (conditionConfidence > 50) {
              conditionMatched = true;
              reasons.push(`Date partial match (${Math.round(daysDiff)} days apart)`);
            }
          }
        }
      } else if (condition.field === 'reference' && condition.operator === 'equals') {
        if (bankRef && appRef) {
          if (bankRef === appRef) {
            conditionMatched = true;
            conditionConfidence = 100;
            reasons.push('Reference matches exactly');
          } else if (bankRef.includes(appRef) || appRef.includes(bankRef)) {
            conditionMatched = true;
            conditionConfidence = 75;
            reasons.push('Reference partial match');
          } else {
            // Check for similarity
            const similarity = calculateStringSimilarity(bankRef, appRef);
            conditionConfidence = similarity * 100;
            if (similarity > 0.5) {
              conditionMatched = true;
              reasons.push(`Reference similar match (${(similarity * 100).toFixed(0)}% similarity)`);
            }
          }
        }
      } else if (condition.field === 'description') {
        if (bankDesc && appDesc) {
          if (bankDesc === appDesc) {
            conditionMatched = true;
            conditionConfidence = 100;
            reasons.push('Description matches exactly');
          } else {
            const similarity = calculateStringSimilarity(bankDesc, appDesc);
            conditionConfidence = similarity * 100;
            if (similarity > 0.5) {
              conditionMatched = true;
              reasons.push(`Description similar match (${(similarity * 100).toFixed(0)}% similarity)`);
            }
          }
        }
      }

      if (conditionMatched) {
        matchedConditions++;
      }
      confidence += conditionConfidence;
    }

    // Calculate overall confidence as average of condition confidences
    confidence = totalConditions > 0 ? confidence / totalConditions : 0;

    // Consider it a match if at least 50% of conditions match and overall confidence is above threshold
    const matches = matchedConditions >= Math.ceil(totalConditions * 0.5) && confidence >= 50;

    return {
      matches,
      confidence: Math.round(confidence),
      reasons
    };
  }, []);

  // Analyze why transactions don't match
  const analyzeMismatch = useCallback((transaction) => {
    if (!matchingRules || !Array.isArray(matchingRules) || !matchingRules.length || !unmatchedTransactions || !unmatchedTransactions.length) {
      return {
        potentialMatches: [],
        reasons: ['No matching rules configured'],
        bestMatch: null
      };
    }

    const bankTransactions = unmatchedTransactions.filter(t => t.source === 'statement');
    const ledgerTransactions = unmatchedTransactions.filter(t => t.source === 'ledger');
    
    const oppositeTransactions = transaction.source === 'statement' 
      ? ledgerTransactions 
      : bankTransactions;

    const enabledRules = matchingRules || []; // API already filters for active rules
    if (enabledRules.length === 0) {
      return {
        potentialMatches: [],
        reasons: ['No active matching rules'],
        bestMatch: null
      };
    }

    const potentialMatches = [];
    const allReasons = [];

    for (const candidate of oppositeTransactions) {
      let bestConfidence = 0;
      const matchReasons = [];
      const failedChecks = [];

      for (const rule of enabledRules) {
        const result = calculateMatchConfidence(transaction, candidate, rule);
        
        if (result.matches) {
          if (result.confidence > bestConfidence) {
            bestConfidence = result.confidence;
          }
          matchReasons.push(...result.reasons);
        } else {
          // Analyze why it failed
          const bankAmount = Math.abs(parseFloat(transaction.amount || 0));
          const appAmount = Math.abs(parseFloat(candidate.amount || 0));
          const bankDate = transaction.date ? new Date(transaction.date) : null;
          const appDate = candidate.date ? new Date(candidate.date) : null;
          const bankRef = (transaction.reference || transaction.reference_number || '').toLowerCase().trim();
          const appRef = (candidate.reference || candidate.reference_number || '').toLowerCase().trim();
          const bankDesc = (transaction.description || transaction.narration || '').toLowerCase().trim();
          const appDesc = (candidate.description || candidate.narration || '').toLowerCase().trim();

          if (rule.conditions && Array.isArray(rule.conditions)) {
            rule.conditions.forEach(condition => {
              if (condition.field === 'amount' && condition.operator === 'equals') {
                const diff = Math.abs(bankAmount - appAmount);
                if (diff >= 0.01) {
                  failedChecks.push(`Amount mismatch: ${bankAmount.toFixed(2)} vs ${appAmount.toFixed(2)} (diff: ${diff.toFixed(2)})`);
                }
              }
              if (condition.field === 'date' && condition.operator === 'equals' && bankDate && appDate) {
                const daysDiff = Math.abs((bankDate - appDate) / (1000 * 60 * 60 * 24));
                if (daysDiff > 30) {
                  failedChecks.push(`Date mismatch: ${Math.round(daysDiff)} days apart`);
                }
              }
              if (condition.field === 'reference' && condition.operator === 'equals') {
                if (bankRef && appRef && bankRef !== appRef && !bankRef.includes(appRef) && !appRef.includes(bankRef)) {
                  failedChecks.push(`Reference mismatch: "${bankRef}" vs "${appRef}"`);
                }
              }
              if (condition.field === 'description') {
                if (bankDesc && appDesc && bankDesc !== appDesc) {
                  failedChecks.push(`Description mismatch`);
                }
              }
            });
          }
        }
      }

      if (bestConfidence > 0 && bestConfidence < 50) {
        potentialMatches.push({
          transaction: candidate,
          confidence: bestConfidence,
          reasons: matchReasons,
          failedChecks
        });
        allReasons.push(...failedChecks);
      } else if (bestConfidence === 0) {
        potentialMatches.push({
          transaction: candidate,
          confidence: 0,
          reasons: [],
          failedChecks
        });
        allReasons.push(...failedChecks);
      }
    }

    // Find best potential match
    const bestMatch = potentialMatches.length > 0 
      ? potentialMatches.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        )
      : null;

    return {
      potentialMatches: potentialMatches.slice(0, 3), // Top 3 potential matches
      reasons: [...new Set(allReasons)], // Unique reasons
      bestMatch
    };
  }, [matchingRules, unmatchedTransactions]);

  const toggleRowExpansion = (txnId) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(txnId)) {
        newSet.delete(txnId);
      } else {
        newSet.add(txnId);
      }
      return newSet;
    });
  };

  const handleRecordDiscrepancy = (matchedPair) => {
    setSelectedMatchedPair(matchedPair);
    
    // Auto-detect discrepancy type based on mismatches
    const bankAmount = Math.abs(parseFloat(matchedPair.bankTransaction.amount || 0));
    const ledgerAmount = Math.abs(parseFloat(matchedPair.ledgerTransaction.amount || 0));
    const amountDiff = Math.abs(bankAmount - ledgerAmount);
    const hasAmountMismatch = amountDiff >= 0.01;

    const bankDate = matchedPair.bankTransaction.date ? new Date(matchedPair.bankTransaction.date) : null;
    const ledgerDate = matchedPair.ledgerTransaction.date ? new Date(matchedPair.ledgerTransaction.date) : null;
    let hasDateMismatch = false;
    if (bankDate && ledgerDate) {
      const daysDiff = Math.abs((bankDate - ledgerDate) / (1000 * 60 * 60 * 24));
      hasDateMismatch = daysDiff > 7;
    }

    let discrepancyType = 'other';
    if (hasAmountMismatch && hasDateMismatch) {
      discrepancyType = 'amount_mismatch'; // Prioritize amount mismatch
    } else if (hasAmountMismatch) {
      discrepancyType = 'amount_mismatch';
    } else if (hasDateMismatch) {
      discrepancyType = 'date_mismatch';
    }

    // Auto-generate description
    let description = '';
    if (hasAmountMismatch) {
      description += `Amount mismatch: Bank ${bankAmount.toFixed(2)} vs Ledger ${ledgerAmount.toFixed(2)} (Difference: ${amountDiff.toFixed(2)}). `;
    }
    if (hasDateMismatch && bankDate && ledgerDate) {
      const daysDiff = Math.abs((bankDate - ledgerDate) / (1000 * 60 * 60 * 24));
      description += `Date mismatch: ${Math.round(daysDiff)} days apart.`;
    }

    setDiscrepancyForm({
      discrepancyType,
      description: description.trim(),
      severity: 'medium',
      status: 'open',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleSaveDiscrepancy = () => {
    if (!discrepancyForm.description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    if (!selectedMatchedPair) {
      toast.error("No matched pair selected");
      return;
    }

    const bankTxn = selectedMatchedPair.bankTransaction;
    const ledgerTxn = selectedMatchedPair.ledgerTransaction;

    const payload = {
      facilityId: activeBusiness.id,
      bankAccountId: selectedAccount,
      bankTransactionId: bankTxn.id || bankTxn.originalId || null,
      ledgerTransactionId: ledgerTxn.id || ledgerTxn.originalId || ledgerTxn.transaction_id || null,
      discrepancyType: discrepancyForm.discrepancyType,
      description: discrepancyForm.description,
      bankAmount: parseFloat(bankTxn.amount || 0),
      ledgerAmount: parseFloat(ledgerTxn.amount || 0),
      severity: discrepancyForm.severity,
      status: discrepancyForm.status,
      notes: discrepancyForm.notes,
      createdBy: currentUser?.id || null
    };

    _postApi(
      '/api/add/discrepancy',
      payload,
      (data) => {
        if (data.success) {
          toast.success("Discrepancy recorded successfully");
          setIsModalOpen(false);
          setSelectedMatchedPair(null);
          fetchDiscrepancies();
          fetchMatchedPairsWithDiscrepancies();
        } else {
          toast.error(data.message || "Failed to record discrepancy");
        }
      },
      (err) => {
        console.error("Error recording discrepancy:", err);
        toast.error("Error recording discrepancy");
      }
    );
  };

  const handleResolveDiscrepancy = (discrepancyId) => {
    _postApi(
      `/api/update/discrepancy/${discrepancyId}`,
      {
        status: 'resolved',
        resolvedBy: currentUser?.id || null
      },
      (data) => {
        if (data.success) {
          toast.success("Discrepancy marked as resolved");
          fetchDiscrepancies();
        } else {
          toast.error(data.message || "Failed to resolve discrepancy");
        }
      },
      (err) => {
        console.error("Error resolving discrepancy:", err);
        toast.error("Error resolving discrepancy");
      }
    );
  };

  const getSourceBadge = (source) => {
    const colors = {
      statement: 'bg-blue-100 text-blue-800',
      ledger: 'bg-purple-100 text-purple-800'
    };
    
    const labels = {
      statement: 'Bank Statement',
      ledger: 'General Ledger'
    };
    
    return <Badge className={colors[source] || 'bg-gray-100 text-gray-800'}>{labels[source] || source}</Badge>;
  };

  const getTypeBadge = (type) => {
    const typeColors = {
      credit: 'bg-green-100 text-green-800',
      debit: 'bg-red-100 text-red-800'
    };

    return (
      <Badge className={typeColors[type] || 'bg-gray-100 text-gray-800'}>
        {type === 'credit' ? 'Credit' : 'Debit'}
      </Badge>
    );
  };

  const getDiscrepancyTypeBadge = (type) => {
    const typeLabels = {
      missing_deposit: 'Missing Deposit',
      unauthorized_withdrawal: 'Unauthorized Withdrawal',
      duplicate_entry: 'Duplicate Entry',
      amount_mismatch: 'Amount Mismatch',
      date_mismatch: 'Date Mismatch',
      other: 'Other'
    };
    
    const typeColors = {
      missing_deposit: 'bg-red-100 text-red-800 hover:bg-red-200 hover:text-red-900',
      unauthorized_withdrawal: 'bg-red-100 text-red-800 hover:bg-red-200 hover:text-red-900',
      duplicate_entry: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 hover:text-yellow-900',
      amount_mismatch: 'bg-orange-100 text-orange-800 hover:bg-orange-200 hover:text-orange-900',
      date_mismatch: 'bg-blue-100 text-blue-800 hover:bg-blue-200 hover:text-blue-900',
      other: 'bg-gray-100 text-gray-800 hover:bg-gray-200 hover:text-gray-900'
    };

    return (
      <Badge className={`shadow-none transition-colors duration-200 ${typeColors[type] || 'bg-gray-100 text-gray-800 hover:bg-gray-200 hover:text-gray-900'}`}>
        {typeLabels[type] || type}
      </Badge>
    );
  };

  const getSeverityBadge = (severity) => {
    const colors = {
      high: 'bg-red-100 text-red-800 hover:bg-red-200 hover:text-red-900',
      medium: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 hover:text-yellow-900',
      low: 'bg-green-100 text-green-800 hover:bg-green-200 hover:text-green-900'
    };
    
    return <Badge className={`shadow-none transition-colors duration-200 ${colors[severity] || 'bg-gray-100 text-gray-800 hover:bg-gray-200 hover:text-gray-900'}`}>{severity}</Badge>;
  };

  const getStatusBadge = (status) => {
    const colors = {
      open: 'bg-red-100 text-red-800 hover:bg-red-200 hover:text-red-900',
      investigating: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 hover:text-yellow-900',
      resolved: 'bg-green-100 text-green-800 hover:bg-green-200 hover:text-green-900'
    };
    
    return <Badge className={`shadow-none transition-colors duration-200 ${colors[status] || 'bg-gray-100 text-gray-800 hover:bg-gray-200 hover:text-gray-900'}`}>{status}</Badge>;
  };

  const totalUnmatchedAmount = unmatchedTransactions.reduce((sum, txn) => {
    return sum + Math.abs(parseFloat(txn.amount || 0));
  }, 0);

  const bankStatementCount = unmatchedTransactions.filter(t => t.source === 'statement').length;
  const ledgerCount = unmatchedTransactions.filter(t => t.source === 'ledger').length;
  const openDiscrepancies = recordedDiscrepancies.filter(d => d.status !== 'resolved').length;

  if (!selectedAccount) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600">No Account Selected</h3>
            <p className="text-gray-500">Please select a bank account to view discrepancies</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Discrepancy Report</h2>
            <p className="text-gray-600">Record and manage discrepancies</p>
          </div>
          <Button className="flex items-center gap-2" onClick={() => { fetchMatchedPairsWithDiscrepancies(); fetchDiscrepancies(); fetchMatchingRules(); }}>
            <FileText className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Discrepancies</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {loading ? "..." : recordedDiscrepancies.filter(d => d.status !== 'resolved').length.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Requiring attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Matched Pairs with Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {loading ? "..." : matchedPairsWithDiscrepancies.length.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Matched pairs with amount/date mismatches</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Impact</CardTitle>
              <DollarSign className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {loading ? "..." : `₦${matchedPairsWithDiscrepancies.reduce((sum, pair) => {
                  const bankAmount = Math.abs(parseFloat(pair.bankTransaction.amount || 0));
                  const ledgerAmount = Math.abs(parseFloat(pair.ledgerTransaction.amount || 0));
                  return sum + Math.abs(bankAmount - ledgerAmount);
                }, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
              <p className="text-xs text-muted-foreground">Total amount difference in mismatched pairs</p>
            </CardContent>
          </Card>
        </div>

        {/* Recorded Discrepancies Table */}
        {recordedDiscrepancies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recorded Discrepancies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Bank Amount</TableHead>
                      <TableHead>Ledger Amount</TableHead>
                      <TableHead>Difference</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recordedDiscrepancies.map((discrepancy) => (
                      <TableRow key={discrepancy.id}>
                        <TableCell>{getDiscrepancyTypeBadge(discrepancy.discrepancy_type)}</TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate">{discrepancy.description}</div>
                        </TableCell>
                        <TableCell>
                          {discrepancy.created_at ? new Date(discrepancy.created_at).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell className="font-semibold">
                          ₦{parseFloat(discrepancy.bank_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="font-semibold">
                          ₦{parseFloat(discrepancy.ledger_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className={`font-semibold ${discrepancy.difference < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {discrepancy.difference < 0 ? '-' : '+'}
                          ₦{Math.abs(parseFloat(discrepancy.difference || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>{getSeverityBadge(discrepancy.severity)}</TableCell>
                        <TableCell>{getStatusBadge(discrepancy.status)}</TableCell>
                        <TableCell>
                          {discrepancy.status !== 'resolved' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResolveDiscrepancy(discrepancy.id)}
                            >
                              Resolve
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Matched Pairs with Discrepancies Table */}
        <Card>
          <CardHeader>
            <CardTitle>Matched Pairs with Discrepancies</CardTitle>
            <p className="text-sm text-gray-600 mt-1">Matched transactions with amount or date mismatches</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : matchedPairsWithDiscrepancies.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p>No matched pairs with discrepancies found. All matched pairs are consistent.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bank Transaction</TableHead>
                      <TableHead>Bank Date</TableHead>
                      <TableHead>Bank Amount</TableHead>
                      <TableHead>Ledger Transaction</TableHead>
                      <TableHead>Ledger Date</TableHead>
                      <TableHead>Ledger Amount</TableHead>
                      <TableHead>Issues</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchedPairsWithDiscrepancies.map((pair) => {
                      const bankAmount = Math.abs(parseFloat(pair.bankTransaction.amount || 0));
                      const ledgerAmount = Math.abs(parseFloat(pair.ledgerTransaction.amount || 0));
                      const amountDiff = Math.abs(bankAmount - ledgerAmount);
                      const hasAmountMismatch = amountDiff >= 0.01;

                      const bankDate = pair.bankTransaction.date ? new Date(pair.bankTransaction.date) : null;
                      const ledgerDate = pair.ledgerTransaction.date ? new Date(pair.ledgerTransaction.date) : null;
                      let hasDateMismatch = false;
                      let daysDiff = 0;
                      if (bankDate && ledgerDate) {
                        daysDiff = Math.abs((bankDate - ledgerDate) / (1000 * 60 * 60 * 24));
                        hasDateMismatch = daysDiff > 7;
                      }

                      const issues = [];
                      if (hasAmountMismatch) {
                        issues.push(`Amount diff: ₦${amountDiff.toFixed(2)}`);
                      }
                      if (hasDateMismatch) {
                        issues.push(`Date diff: ${Math.round(daysDiff)} days`);
                      }

                      return (
                        <TableRow key={pair.id}>
                          <TableCell className="max-w-xs">
                            <div className="font-medium">{pair.bankTransaction.description || pair.bankTransaction.narration || 'N/A'}</div>
                            <div className="text-xs text-gray-500">Ref: {pair.bankTransaction.reference || 'N/A'}</div>
                          </TableCell>
                          <TableCell>{pair.bankTransaction.date || 'N/A'}</TableCell>
                          <TableCell className="font-semibold">
                            ₦{bankAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="font-medium">{pair.ledgerTransaction.description || pair.ledgerTransaction.narration || 'N/A'}</div>
                            <div className="text-xs text-gray-500">Ref: {pair.ledgerTransaction.reference || 'N/A'}</div>
                          </TableCell>
                          <TableCell>{pair.ledgerTransaction.date || 'N/A'}</TableCell>
                          <TableCell className="font-semibold">
                            ₦{ledgerAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {issues.map((issue, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs text-left justify-start text-red-600 border-red-300">
                                  {issue}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRecordDiscrepancy(pair)}
                              className="flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" />
                              Record
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Record Discrepancy Modal */}
      {isModalOpen && selectedMatchedPair && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Record Discrepancy
                </h2>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedMatchedPair(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Matched Pair Info */}
              <div className="mb-4 p-3 bg-gray-50 rounded-md space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Matched Pair Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-blue-600">Bank Transaction</h4>
                    <div className="text-sm">
                      <div><span className="text-gray-600">Date:</span> {selectedMatchedPair.bankTransaction.date || 'N/A'}</div>
                      <div><span className="text-gray-600">Amount:</span> ₦{Math.abs(parseFloat(selectedMatchedPair.bankTransaction.amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div><span className="text-gray-600">Description:</span> {selectedMatchedPair.bankTransaction.description || selectedMatchedPair.bankTransaction.narration || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-purple-600">Ledger Transaction</h4>
                    <div className="text-sm">
                      <div><span className="text-gray-600">Date:</span> {selectedMatchedPair.ledgerTransaction.date || 'N/A'}</div>
                      <div><span className="text-gray-600">Amount:</span> ₦{Math.abs(parseFloat(selectedMatchedPair.ledgerTransaction.amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div><span className="text-gray-600">Description:</span> {selectedMatchedPair.ledgerTransaction.description || selectedMatchedPair.ledgerTransaction.narration || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discrepancy Type <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={discrepancyForm.discrepancyType}
                    onValueChange={(value) => setDiscrepancyForm(prev => ({ ...prev, discrepancyType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="missing_deposit">Missing Deposit</SelectItem>
                      <SelectItem value="unauthorized_withdrawal">Unauthorized Withdrawal</SelectItem>
                      <SelectItem value="duplicate_entry">Duplicate Entry</SelectItem>
                      <SelectItem value="amount_mismatch">Amount Mismatch</SelectItem>
                      <SelectItem value="date_mismatch">Date Mismatch</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                    rows={3}
                    value={discrepancyForm.description}
                    onChange={(e) => setDiscrepancyForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the discrepancy..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Severity
                    </label>
                    <Select
                      value={discrepancyForm.severity}
                      onValueChange={(value) => setDiscrepancyForm(prev => ({ ...prev, severity: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <Select
                      value={discrepancyForm.status}
                      onValueChange={(value) => setDiscrepancyForm(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="investigating">Investigating</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                    rows={2}
                    value={discrepancyForm.notes}
                    onChange={(e) => setDiscrepancyForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleSaveDiscrepancy}
                    className="flex-[2] flex items-center justify-center gap-2"
                  >
                    Record Discrepancy
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setSelectedMatchedPair(null);
                    }}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DiscrepancyReport;
