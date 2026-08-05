
export class MatchingRulesEngine {
  rules = [];

  constructor(rules = []) {
    this.rules = rules.sort((a, b) => b.priority - a.priority);
  }

  addRule(rule) {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  removeRule(ruleId) {
    this.rules = this.rules.filter(rule => rule.id !== ruleId);
  }

  updateRule(ruleId, updatedRule) {
    const index = this.rules.findIndex(rule => rule.id === ruleId);
    if (index !== -1) {
      this.rules[index] = updatedRule;
      this.rules.sort((a, b) => b.priority - a.priority);
    }
  }

  calculateFieldScore(
    bankValue,
    appValue,
    operator,
    ruleValue,
    bankTransaction,
    appTransaction
  ) {
    switch (operator) {
      case 'equals':
        // For amount: normalize and compare values
        if (ruleValue === 0 && (typeof bankValue === 'number' || typeof appValue === 'number')) {
          // Normalize bank transaction amount (handle both amount field and debit/credit)
          let bankAmount = 0;
          if (bankTransaction) {
            if (bankTransaction.amount !== undefined && bankTransaction.amount !== null) {
              bankAmount = Math.abs(parseFloat(bankTransaction.amount) || 0);
            } else if (bankTransaction.debit !== undefined || bankTransaction.credit !== undefined) {
              bankAmount = Math.abs(parseFloat(bankTransaction.debit || 0) - parseFloat(bankTransaction.credit || 0));
            }
          } else {
            bankAmount = Math.abs(parseFloat(bankValue) || 0);
          }
          
          // Normalize app transaction amount (handle both amount field and debit/credit)
          let appAmount = 0;
          if (appTransaction) {
            if (appTransaction.amount !== undefined && appTransaction.amount !== null) {
              appAmount = Math.abs(parseFloat(appTransaction.amount) || 0);
            } else if (appTransaction.debit !== undefined || appTransaction.credit !== undefined) {
              appAmount = Math.abs(parseFloat(appTransaction.debit || 0) - parseFloat(appTransaction.credit || 0));
            }
          } else {
            appAmount = Math.abs(parseFloat(appValue) || 0);
          }
          
          // Allow exact match or very small difference (due to rounding)
          const difference = Math.abs(bankAmount - appAmount);
          if (difference < 0.01) {
            return 1;
          }
          // Allow some tolerance for larger amounts (0.1% tolerance)
          if (bankAmount > 0 && appAmount > 0) {
            const tolerance = Math.max(bankAmount, appAmount) * 0.001;
            return difference <= tolerance ? 0.95 : 0;
          }
          return 0;
        }
        // For date: compare dates with tolerance (allow up to 30 days difference for bank reconciliation)
        if (ruleValue === '' && bankValue && appValue) {
          // Check if this is a date field based on transaction data
          const isDateField = (bankTransaction && (bankTransaction.date || bankTransaction.transaction_date)) ||
                             (appTransaction && (appTransaction.date || appTransaction.transaction_date));
          
          // Filter out invalid dates (before 1970-01-02)
          const bankDateStr = bankValue instanceof Date ? bankValue.toISOString().split('T')[0] : String(bankValue);
          const appDateStr = appValue instanceof Date ? appValue.toISOString().split('T')[0] : String(appValue);
          
          const invalidDateThreshold = new Date('1970-01-02');
          
          if (isDateField || (typeof bankValue === 'string' && typeof appValue === 'string' && bankDateStr.match(/^\d{4}-\d{2}-\d{2}/) && appDateStr.match(/^\d{4}-\d{2}-\d{2}/))) {
            try {
              // Handle date strings in various formats
              let bankDate = bankValue instanceof Date ? bankValue : new Date(bankValue);
              let appDate = appValue instanceof Date ? appValue : new Date(appValue);
              
              // Skip invalid dates
              if (bankDate < invalidDateThreshold || appDate < invalidDateThreshold) {
                return 0;
              }
              
              if (isNaN(bankDate.getTime()) || isNaN(appDate.getTime())) {
                return 0;
              }
              
              // Normalize to date strings (YYYY-MM-DD)
              const bankDateStrNorm = bankDate.toISOString().split('T')[0];
              const appDateStrNorm = appDate.toISOString().split('T')[0];
              
              // Exact match
              if (bankDateStrNorm === appDateStrNorm) {
                return 1;
              }
              
              // Check if dates are within 30 days of each other (allow more tolerance for bank reconciliation)
              const daysDiff = Math.abs((bankDate - appDate) / (1000 * 60 * 60 * 24));
              if (daysDiff <= 30) {
                // Score decreases linearly from 1.0 (exact) to 0.7 (30 days)
                return Math.max(0.7, 1 - (daysDiff / 30) * 0.3);
              }
              return 0;
            } catch (e) {
              return 0;
            }
          }
        }
        
        // For reference: fuzzy match (case insensitive, partial match)
        if (ruleValue === '' && typeof bankValue === 'string' && typeof appValue === 'string') {
          const bankRef = bankValue.toLowerCase().trim();
          const appRef = appValue.toLowerCase().trim();
          
          // Exact match
          if (bankRef === appRef && bankRef.length > 0) {
            return 1;
          }
          
          // Partial match (one contains the other)
          if (bankRef.length > 0 && appRef.length > 0) {
            if (bankRef.includes(appRef) || appRef.includes(bankRef)) {
              return 0.8;
            }
            // Fuzzy similarity for reference numbers
            return this.stringSimilarity(bankRef, appRef);
          }
          
          return 0;
        }
        
        // For description: exact match (case insensitive)
        if (ruleValue === '' && typeof bankValue === 'string' && typeof appValue === 'string') {
          return bankValue.toLowerCase().trim() === appValue.toLowerCase().trim() ? 1 : 0;
        }
        return bankValue === appValue && appValue === ruleValue ? 1 : 0;
      case 'contains':
        const bankStr = bankValue.toString().toLowerCase();
        const appStr = appValue.toString().toLowerCase();
        const ruleStr = ruleValue.toString().toLowerCase();
        return bankStr.includes(ruleStr) && appStr.includes(ruleStr) ? 1 : 0;
      case 'startsWith':
        return bankValue.toString().toLowerCase().startsWith(ruleValue.toString().toLowerCase()) &&
               appValue.toString().toLowerCase().startsWith(ruleValue.toString().toLowerCase()) ? 1 : 0;
      case 'endsWith':
        return bankValue.toString().toLowerCase().endsWith(ruleValue.toString().toLowerCase()) &&
               appValue.toString().toLowerCase().endsWith(ruleValue.toString().toLowerCase()) ? 1 : 0;
      case 'between':
        const [min, max] = ruleValue;
        return (bankValue >= min && bankValue <= max) && (appValue >= min && appValue <= max) ? 1 : 0;
      case 'fuzzy':
        // For fuzzy matching, compare bankValue and appValue directly
        if (typeof bankValue === 'string' && typeof appValue === 'string') {
          return this.stringSimilarity(bankValue.toLowerCase(), appValue.toLowerCase());
        }
        return this.fuzzyMatch(bankValue.toString(), appValue.toString(), ruleValue.toString());
      default:
        return 0;
    }
  }

  fuzzyMatch(str1, str2, pattern) {
    const similarity1 = this.stringSimilarity(str1.toLowerCase(), pattern.toLowerCase());
    const similarity2 = this.stringSimilarity(str2.toLowerCase(), pattern.toLowerCase());
    return Math.max(similarity1, similarity2);
  }

  stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
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
  }

  matchTransactions(
    bankTransactions,
    appTransactions
  ) {
    const results = [];
    
    // Filter out transactions with invalid dates (before 1970-01-02)
    const validBankTransactions = bankTransactions.filter(txn => {
      if (!txn.date && !txn.transaction_date) return false;
      try {
        const txnDate = txn.date ? new Date(txn.date) : new Date(txn.transaction_date);
        return !isNaN(txnDate.getTime()) && txnDate >= new Date('1970-01-02');
      } catch {
        return false;
      }
    });
    
    const validAppTransactions = appTransactions.filter(txn => {
      if (!txn.date && !txn.transaction_date) return false;
      try {
        const txnDate = txn.date ? new Date(txn.date) : new Date(txn.transaction_date);
        return !isNaN(txnDate.getTime()) && txnDate >= new Date('1970-01-02');
      } catch {
        return false;
      }
    });

    for (const bankTxn of validBankTransactions) {
      const matches = [];

      for (const appTxn of validAppTransactions) {
        let totalScore = 0;
        let totalWeight = 0;
        const matchedRules = [];

        for (const rule of this.rules) {
          let ruleScore = 0;
          let ruleWeight = 0;

          for (const condition of rule.conditions) {
            // Handle amount field specially - normalize debit/credit to amount
            let bankFieldValue = bankTxn[condition.field];
            let appFieldValue = appTxn[condition.field];
            
            // If comparing amounts, normalize debit/credit fields
            if (condition.field === 'amount') {
              // For bank transaction, use amount field or calculate from debit/credit
              if (bankTxn.amount !== undefined && bankTxn.amount !== null) {
                bankFieldValue = Math.abs(parseFloat(bankTxn.amount) || 0);
              } else if (bankTxn.debit !== undefined || bankTxn.credit !== undefined) {
                bankFieldValue = Math.abs(parseFloat(bankTxn.debit || 0) - parseFloat(bankTxn.credit || 0));
              } else {
                bankFieldValue = 0;
              }
              
              // For app transaction, use amount field or calculate from debit/credit
              if (appTxn.amount !== undefined && appTxn.amount !== null) {
                appFieldValue = Math.abs(parseFloat(appTxn.amount) || 0);
              } else if (appTxn.debit !== undefined || appTxn.credit !== undefined) {
                appFieldValue = Math.abs(parseFloat(appTxn.debit || 0) - parseFloat(appTxn.credit || 0));
              } else {
                appFieldValue = 0;
              }
            }
            
            // Handle date field specially - normalize date formats
            if (condition.field === 'date') {
              // Extract date string from various formats
              if (bankTxn.date) {
                bankFieldValue = bankTxn.date;
              } else if (bankTxn.transaction_date) {
                bankFieldValue = bankTxn.transaction_date;
              }
              
              if (appTxn.date) {
                appFieldValue = appTxn.date;
              } else if (appTxn.transaction_date) {
                appFieldValue = appTxn.transaction_date;
              }
            }
            
            // Handle reference field - normalize empty strings
            if (condition.field === 'reference') {
              bankFieldValue = bankTxn.reference || bankTxn.reference_number || '';
              appFieldValue = appTxn.reference || appTxn.reference_number || '';
            }
            
            const fieldScore = this.calculateFieldScore(
              bankFieldValue,
              appFieldValue,
              condition.operator,
              condition.value,
              bankTxn,
              appTxn
            );

            ruleScore += fieldScore * condition.weight;
            ruleWeight += condition.weight;
          }

          if (ruleWeight > 0) {
            const normalizedRuleScore = ruleScore / ruleWeight;
            if (normalizedRuleScore >= rule.threshold) {
              totalScore += normalizedRuleScore;
              totalWeight += 1;
              matchedRules.push(rule.name);
            }
          }
        }

        if (totalWeight > 0) {
          const finalScore = totalScore / totalWeight;
          matches.push({
            transaction: appTxn,
            score: finalScore,
            rules: matchedRules
          });
        }
      }

      // Sort matches by score and get top matches
      matches.sort((a, b) => b.score - a.score);
      const topMatches = matches.filter(m => m.score > 0.5).slice(0, 5);

      if (topMatches.length > 0) {
        const confidence = topMatches[0].score > 0.8 ? 'high' : 
                          topMatches[0].score > 0.6 ? 'medium' : 'low';

        results.push({
          bankTransaction: bankTxn,
          appTransactions: topMatches.map(m => m.transaction),
          score: topMatches[0].score,
          matchedRules: topMatches[0].rules,
          confidence
        });
      }
    }

    return results;
  }

  exportRules() {
    return JSON.stringify(this.rules, null, 2);
  }

  importRules(rulesJson) {
    try {
      const rules = JSON.parse(rulesJson);
      this.rules = rules.sort((a, b) => b.priority - a.priority);
    } catch (error) {
      throw new Error('Invalid JSON format for rules');
    }
  }
}
