// pages/TransactionList.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Eye, Printer, Edit, Filter } from 'lucide-react';
import { useSelector } from 'react-redux';
import { _fetchApi } from '@/redux/actions/api';
import { toast } from 'sonner';
import { formatNumber1, formatNaira } from "@/components/router/utilities";
import moment from 'moment';

const TransactionList = () => {
  const navigate = useNavigate();
  const { activeBusiness } = useSelector((state) => state.auth);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  const fetchTransactions = () => {
    if (!activeBusiness?.id) {
      toast.error('No active business selected');
      setLoading(false);
      return;
    }

    setLoading(true);
    _fetchApi(
      `/get-all-transactions?facilityId=${activeBusiness.id}`,
      (res) => {
        setLoading(false);
        if (res.success) {
          setTransactions(res.results || []);
          setFilteredTransactions(res.results || []);
        } else {
          toast.error('Failed to load transactions');
        }
      },
      (err) => {
        setLoading(false);
        console.error(err);
        toast.error('Error fetching transactions');
      }
    );
  };

  useEffect(() => {
    if (activeBusiness?.id) {
      fetchTransactions();
    }
  }, [activeBusiness?.id]);

  // Filter transactions when filterType changes
  useEffect(() => {
    if (filterType === 'all') {
      setFilteredTransactions(transactions);
    } else {
      const filtered = transactions.filter(
        (txn) => txn.type?.toLowerCase() === filterType.toLowerCase()
      );
      setFilteredTransactions(filtered);
    }
  }, [filterType, transactions]);

  const handleCreateNewTransaction = () => {
    navigate('/app/reports/transaction/new');
  };

  return (
    <div className="p-2 h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Transaction List</h2>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? 'Loading...' : `${filteredTransactions.length} transaction(s) found`}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              <option value="customer deposit">Customer Deposit</option>
              <option value="tax">Tax</option>
              <option value="purchase">Purchase</option>
              <option value="invoice">Invoice</option>
              <option value="sales">Sales</option>
            </select>
          </div>
          <button
            onClick={handleCreateNewTransaction}
            className="bg-[#5C7FC1] hover:bg-[#4267B2] text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Transaction
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading transactions...</p>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No transactions created yet</p>
          <button
            onClick={handleCreateNewTransaction}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Create your first transaction
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Document #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {invoice.first_document || invoice.invoice_ref}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {invoice.transactionTypeName}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {moment(invoice.invoice_date).format('MMM D, YYYY')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ₦{formatNumber1(invoice.total)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        invoice.status === 'posted'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {invoice.status?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        className="text-blue-600 hover:text-blue-900"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        className="text-green-600 hover:text-green-900"
                        title="Print"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        className="text-gray-600 hover:text-gray-900"
                        title="Edit"
                        disabled={invoice.status === 'posted'}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TransactionList;
