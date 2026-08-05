/**
 * Bank Transaction Matching Engine
 * Based on reference pattern with backend integration support
 */

export const calculateMatchConfidence = (
  bankTx,
  appTx,
  rule
) => {
  let confidence = 0;
  const reasons = [];
  
  // Normalize amounts
  const bankAmount = Math.abs(parseFloat(bankTx.amount || 0));
  const appAmount = Math.abs(parseFloat(appTx.amount || 0));
  
  // Process each condition in the rule
  if (rule.conditions && Array.isArray(rule.conditions)) {
    let totalWeight = 0;
    let weightedScore = 0;
    
    for (const condition of rule.conditions) {
      const field = condition.field;
      const operator = condition.operator;
      const weight = parseFloat(condition.weight || 1);
      
      let fieldScore = 0;
      let fieldReason = '';
      
      // Amount matching
      if (field === 'amount') {
        if (operator === 'equals') {
          const difference = Math.abs(bankAmount - appAmount);
          if (difference < 0.01) {
            fieldScore = 1;
            fieldReason = 'Exact amount match';
          } else if (bankAmount > 0 && appAmount > 0) {
            const tolerance = Math.max(bankAmount, appAmount) * 0.001;
            if (difference <= tolerance) {
              fieldScore = 0.95;
              fieldReason = 'Amount within tolerance';
            }
          }
        }
      }
      
      // Date matching
      if (field === 'date') {
        if (operator === 'equals') {
          const bankDate = bankTx.date ? new Date(bankTx.date) : null;
          const appDate = appTx.date ? new Date(appTx.date) : null;
          
          if (bankDate && appDate && !isNaN(bankDate.getTime()) && !isNaN(appDate.getTime())) {
            // Filter invalid dates
            if (bankDate >= new Date('1970-01-02') && appDate >= new Date('1970-01-02')) {
              const daysDiff = Math.abs((bankDate - appDate) / (1000 * 60 * 60 * 24));
              
              if (daysDiff === 0) {
                fieldScore = 1;
                fieldReason = 'Exact date match';
              } else if (daysDiff <= 30) {
                // Score decreases linearly from 1.0 (exact) to 0.7 (30 days)
                fieldScore = Math.max(0.7, 1 - (daysDiff / 30) * 0.3);
                fieldReason = `Date within ${Math.round(daysDiff)} days`;
              }
            }
          }
        }
      }
      
      // Reference matching
      if (field === 'reference') {
        if (operator === 'equals') {
          const bankRef = (bankTx.reference || bankTx.reference_number || '').toLowerCase().trim();
          const appRef = (appTx.reference || appTx.reference_number || '').toLowerCase().trim();
          
          if (bankRef && appRef) {
            if (bankRef === appRef) {
              fieldScore = 1;
              fieldReason = 'Exact reference match';
            } else if (bankRef.includes(appRef) || appRef.includes(bankRef)) {
              fieldScore = 0.8;
              fieldReason = 'Partial reference match';
            } else {
              // Fuzzy similarity
              fieldScore = stringSimilarity(bankRef, appRef);
              if (fieldScore > 0.6) {
                fieldReason = 'Similar reference';
              }
            }
          }
        }
      }
      
      // Description matching
      if (field === 'description') {
        const bankDesc = (bankTx.description || bankTx.narration || '').toLowerCase().trim();
        const appDesc = (appTx.description || appTx.narration || '').toLowerCase().trim();
        
        if (operator === 'equals' && bankDesc && appDesc) {
          if (bankDesc === appDesc) {
            fieldScore = 1;
            fieldReason = 'Exact description match';
          }
        } else if (operator === 'contains' && bankDesc && appDesc) {
          // Check if both contain common keywords
          const bankWords = bankDesc.split(/\s+/);
          const appWords = appDesc.split(/\s+/);
          const commonWords = bankWords.filter(w => w.length > 3 && appWords.includes(w));
          
          if (commonWords.length > 0) {
            fieldScore = Math.min(0.9, commonWords.length / Math.max(bankWords.length, appWords.length) * 2);
            fieldReason = `${commonWords.length} keyword(s) match`;
          }
        } else if (operator === 'fuzzy' && bankDesc && appDesc) {
          fieldScore = stringSimilarity(bankDesc, appDesc);
          if (fieldScore > 0.6) {
            fieldReason = 'Similar description';
          }
        }
      }
      
      weightedScore += fieldScore * weight;
      totalWeight += weight;
      
      if (fieldScore > 0 && fieldReason) {
        reasons.push(fieldReason);
      }
    }
    
    if (totalWeight > 0) {
      confidence = (weightedScore / totalWeight) * 100;
    }
  }
  
  return {
    matches: confidence >= (rule.threshold || 0.7) * 100,
    confidence: Math.min(100, Math.round(confidence)),
    reasons,
  };
};

const stringSimilarity = (str1, str2) => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
};

const levenshteinDistance = (str1, str2) => {
  const matrix = Array(str2.length + 1).fill(null).map(() => 
    Array(str1.length + 1).fill(null)
  );

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }

  return matrix[str2.length][str1.length];
};

export const findSuggestedMatches = (
  bankTransactions,
  appTransactions,
  rules
) => {
  const suggestions = [];
  const enabledRules = rules.filter(r => r.status !== 'inactive').sort((a, b) => (b.priority || 0) - (a.priority || 0));

  if (enabledRules.length === 0) return suggestions;

  // Filter unmatched transactions (exclude both matched and retain)
  const unmatchedBank = bankTransactions.filter(t => t.reconciled === 'unmatched' && t.source === 'statement');
  const unmatchedApp = appTransactions.filter(t => t.reconciled === 'unmatched' && t.source === 'ledger');

  // Filter out invalid dates
  const validBank = unmatchedBank.filter(txn => {
    if (!txn.date) return false;
    try {
      const txnDate = new Date(txn.date);
      return !isNaN(txnDate.getTime()) && txnDate >= new Date('1970-01-02');
    } catch {
      return false;
    }
  });
  
  const validApp = unmatchedApp.filter(txn => {
    if (!txn.date) return false;
    try {
      const txnDate = new Date(txn.date);
      return !isNaN(txnDate.getTime()) && txnDate >= new Date('1970-01-02');
    } catch {
      return false;
    }
  });

  for (const bankTx of validBank) {
    let bestMatch = null;
    let bestConfidence = 0;
    let bestMatchedBy = [];

    for (const appTx of validApp) {
      let totalConfidence = 0;
      const matchedBy = [];

      for (const rule of enabledRules) {
        const result = calculateMatchConfidence(bankTx, appTx, rule);
        if (result.matches && result.confidence > totalConfidence) {
          totalConfidence = result.confidence;
          matchedBy.push(rule.name);
        }
      }

      if (totalConfidence > bestConfidence && totalConfidence >= 50) {
        bestConfidence = totalConfidence;
        bestMatch = appTx;
        bestMatchedBy = matchedBy;
      }
    }

    if (bestMatch && bestConfidence >= 50) {
      // Check if this app transaction is already suggested with higher confidence
      const existingSuggestion = suggestions.find(
        s => s.inAppTransactionId === bestMatch.id
      );

      if (!existingSuggestion || existingSuggestion.confidence < bestConfidence) {
        if (existingSuggestion) {
          suggestions.splice(suggestions.indexOf(existingSuggestion), 1);
        }
        suggestions.push({
          bankTransactionId: bankTx.id,
          inAppTransactionId: bestMatch.id,
          confidence: bestConfidence,
          matchedBy: bestMatchedBy,
        });
      }
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
};
