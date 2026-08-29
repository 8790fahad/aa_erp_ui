// pages/TransactionTypeSelection.js
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { transactionTypes } from "./TransactionUtils";

const TransactionTypeSelection = () => {
  const navigate = useNavigate();

  const handleTransactionTypeSelect = (transactionType) => {
    // Navigate directly to all transaction types
    navigateToTransaction(transactionType);
    // Check if this transaction type previously required line of business confirmation
    const requiresLineOfBusiness = [
      "supplier_deposit",
      "customer_deposit",
      "customer_security_deposit",
    ].includes(transactionType.id);

    // Navigate directly with default line of business value (true)
    navigateToTransaction(
      transactionType,
      requiresLineOfBusiness ? true : false
    );
  };

  const navigateToTransaction = (transactionType, lineOfBusiness = false) => {
    // Create a serializable version of the transaction type (without the icon component)
    const serializableTransactionType = {
      id: transactionType.id,
      label: transactionType.label,
      description: transactionType.description,
      accountType: transactionType.accountType,
      debitAccount: transactionType.debitAccount,
      creditAccount: transactionType.creditAccount,
      showCustomer: transactionType.showCustomer,
      showVendor: transactionType.showVendor,
      isSpecialForm: transactionType.isSpecialForm,
      defaultAccounts: transactionType.defaultAccounts,
      documentPrefix: transactionType.documentPrefix,
      line_of_business: lineOfBusiness,
    };

    // Customer deposits → Verification Points; supplier deposits → Pay Bills
    if (transactionType.id === "supplier_deposit") {
      navigate("/app/payments/pay-bills?action=deposit", {
        state: { transactionType: serializableTransactionType },
      });
    } else if (transactionType.id === "customer_deposit") {
      navigate("/app/payments/verification-points?action=deposit", {
        state: { transactionType: serializableTransactionType },
      });
    } else if (transactionType.id === "customer_security_deposit") {
      navigate("/app/customers/customer-security-deposit", {
        state: { transactionType: serializableTransactionType },
      });
    } else {
      // Navigate and pass the serializable transaction type data in state
      navigate(`/app/reports/transaction/create/${transactionType.id}`, {
        state: { transactionType: serializableTransactionType },
      });
    }
  };

  return (
    <div className="bg-white p-2">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Create Transaction
          </h2>
          <p className="text-gray-600">
            Choose the type of transaction you want to create
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {transactionTypes.map((type) => {
          const IconComponent = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => handleTransactionTypeSelect(type)}
              className="p-6 border border-gray-200 rounded-xl hover:border-[#AAC7EF] hover:bg-[#C4DFFF] transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#AAC7EF] rounded-lg flex items-center justify-center group-hover:bg-[#AAC7EF] transition-colors">
                  <IconComponent className="w-6 h-6 text-[var(--aa-navy)]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    {type.label}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    {type.description}
                  </p>
                  <div className="text-xs text-[var(--aa-navy)] font-medium">
                    Document: {type.documentPrefix}-XXXXXX
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TransactionTypeSelection;
