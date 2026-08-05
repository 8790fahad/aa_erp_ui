// pages/TransactionForm.js (Updated to handle special forms)
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, FileImage } from 'lucide-react';
import { Typeahead } from 'react-bootstrap-typeahead';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { _postApi } from '@/redux/actions/api';
import { toast } from 'sonner';
import CustomTable1 from '@/common/Custom/CustomTable1';
import { 
  methods_of_payment, 
  getTransactionTypeById, 
  createInitialInvoiceState 
} from './TransactionUtils'
import { useTransactionData } from './TransactionUtils'
import SupplierDepositForm from './SupplierDepositForm';
import CustomerDepositForm from './CustomerDepositForm';
const TransactionForm = () => {
  const navigate = useNavigate();
  const { typeId } = useParams();
  const location = useLocation();
  const { stores, banks } = useTransactionData();

  const [selectedTransactionType, setSelectedTransactionType] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [fileError, setFileError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState({});

  const MAX_FILES = 5;

  useEffect(() => {
    // Get transaction type from location state or by typeId
    let transactionType;
    if (location.state?.transactionType) {
      transactionType = location.state.transactionType;
      // Add the icon back from the original transaction types
      const originalType = getTransactionTypeById(transactionType.id);
      if (originalType) {
        transactionType.icon = originalType.icon;
      }
    } else {
      transactionType = getTransactionTypeById(typeId);
    }

    if (transactionType) {
      setSelectedTransactionType(transactionType);
      // Only initialize invoice state for non-special forms
      if (!transactionType.isSpecialForm) {
        setCurrentInvoice(createInitialInvoiceState(transactionType));
      }
    } else {
      navigate('/transactions/new');
    }
  }, [typeId, location.state, navigate]);

  // If it's a special form, render the specialized component
  if (selectedTransactionType?.isSpecialForm) {
    if (selectedTransactionType.id === 'supplier_deposit') {
      return <SupplierDepositForm selectedTransactionType={selectedTransactionType} />;
    }
    if (selectedTransactionType.id === 'customer_deposit') {
      return <CustomerDepositForm selectedTransactionType={selectedTransactionType} />;
    }
  }

  const addInvoiceItem = () => {
    const newItem = {
      id: Date.now(),
      description: '',
      accountCode: '',
      accountDescription: '',
      accountSubhead: '',
      quantity: 1,
      unitPrice: 0,
      amount: 0,
    };
    setCurrentInvoice((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  const updateInvoiceItem = (itemId, field, value) => {
    setCurrentInvoice((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            updatedItem.amount = updatedItem.quantity * updatedItem.unitPrice;
          }
          return updatedItem;
        }
        return item;
      }),
    }));
  };

  const removeInvoiceItem = (itemId) => {
    setCurrentInvoice((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  };

  const calculateTotals = () => {
    const subtotal = currentInvoice.items?.reduce(
      (sum, item) => sum + item.amount,
      0
    ) || 0;
    const tax =
      selectedTransactionType?.id === 'vendor_invoice' ? subtotal * 0.075 : 0;
    const total = subtotal + tax;

    setCurrentInvoice((prev) => ({
      ...prev,
      subtotal,
      tax,
      total,
    }));
  };

  useEffect(() => {
    if (currentInvoice.items) {
      calculateTotals();
    }
  }, [currentInvoice.items, selectedTransactionType]);

  // File handling functions
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);

    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);

      if (attachments.length + files.length > MAX_FILES) {
        setFileError(`Maximum ${MAX_FILES} files allowed`);
        return;
      }

      const oversizedFiles = files.filter(
        (file) => file.size > 5 * 1024 * 1024
      );
      if (oversizedFiles.length > 0) {
        setFileError('Some files exceed 5MB limit');
        return;
      }

      setFileError('');
      setAttachments(prev => [...prev, ...files]);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const onFilesSelected = (files) => {
    if (!files) return;

    const fileArray = Array.from(files);

    if (attachments.length + fileArray.length > MAX_FILES) {
      setFileError(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const oversizedFiles = fileArray.filter(
      (file) => file.size > 5 * 1024 * 1024
    );
    if (oversizedFiles.length > 0) {
      setFileError('Some files exceed 5MB limit');
      return;
    }

    setFileError('');
    setAttachments(prev => [...prev, ...fileArray]);
  };

  const removeAttachment = (i) => {
    setAttachments(prev => prev.filter((_, idx) => idx !== i));
    setFileError('');
  };

  const handleSubmit = () => {
    if (!selectedTransactionType) {
      toast.error('Please select a transaction type');
      return;
    }

    const dataEntry = {
      invoice_number: currentInvoice.invoiceNumber,
      transaction_type: selectedTransactionType.id,
      customer_id: currentInvoice.customerId,
      customer_name: currentInvoice.customerName,
      vendor_id: currentInvoice.vendorId,
      vendor_name: currentInvoice.vendorName,
      employee_id: currentInvoice.employeeId,
      employee_name: currentInvoice.employeeName,
      approver_id: currentInvoice.approverId,
      approver_name: currentInvoice.approverName,
      work_hours: currentInvoice.workHours,
      hourly_rate: currentInvoice.hourlyRate,
      invoice_date: currentInvoice.invoiceDate,
      due_date: currentInvoice.dueDate,
      description: currentInvoice.description,
      subtotal: currentInvoice.subtotal,
      tax: currentInvoice.tax,
      total: currentInvoice.total,
      status: 'posted',
      items: currentInvoice.items.map((item) => ({
        description: item.description,
        account_code: item.accountCode,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        amount: item.amount,
      })),
      attachments: attachments.map((file) => ({
        document_name: file.name,
        file_path: file.path || file.name,
        original_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      })),
    };

    setLoading(true);

    _postApi(
      `/insert-new-transaction`,
      dataEntry,
      (res) => {
        if (res.success) {
          toast.success('Transaction saved successfully!');
          navigate('/transactions');
        } else {
          toast.error('Failed to save transaction');
        }
        setLoading(false);
      },
      (err) => {
        toast.error('Error saving transaction');
        console.error('Transaction error:', err);
        setLoading(false);
      }
    );
  };

  // Table fields configuration
  const fields = [
    {
      value: 'description',
      title: 'Description',
      custom: true,
      component: (item) => (
        <input
          type="text"
          value={item.description}
          onChange={(e) =>
            updateInvoiceItem(item.id, 'description', e.target.value)
          }
          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
          placeholder="Item description"
        />
      ),
    },
    {
      value: 'accountCode',
      title: 'Account',
      custom: true,
      component: (item) => (
        <div style={{ position: 'relative', width: '100%' }}>
          <Typeahead
            id={`account-typeahead-${item.id}`}
            size="sm"
            className="col-md-12 pl-0 pr-0"
            options={stores}
            placeholder="Select account..."
            onChange={(selectedItems) => {
              const selectedAccount = selectedItems[0];
              if (selectedAccount) {
                updateInvoiceItem(item.id, 'accountCode', selectedAccount.code);
                updateInvoiceItem(
                  item.id,
                  'accountDescription',
                  selectedAccount.name
                );
                updateInvoiceItem(
                  item.id,
                  'accountSubhead',
                  selectedAccount.chart_code
                );
              } else {
                updateInvoiceItem(item.id, 'accountCode', '');
                updateInvoiceItem(item.id, 'accountDescription', '');
                updateInvoiceItem(item.id, 'accountSubhead', '');
              }
            }}
            selected={
              item.accountCode
                ? stores.filter((store) => store.code === item.accountCode)
                : []
            }
            labelKey="name"
            positionFixed={true}
            style={{
              borderRadius: '7px',
            }}
          />
        </div>
      ),
    },
    {
      value: 'quantity',
      title: 'Qty',
      custom: true,
      component: (item) => (
        <input
          type="number"
          value={item.quantity}
          onChange={(e) =>
            updateInvoiceItem(
              item.id,
              'quantity',
              parseFloat(e.target.value) || 0
            )
          }
          className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
          min="1"
        />
      ),
    },
    {
      value: 'unitPrice',
      title: 'Unit Price',
      custom: true,
      component: (item) => (
        <input
          type="number"
          value={item.unitPrice}
          onChange={(e) =>
            updateInvoiceItem(
              item.id,
              'unitPrice',
              parseFloat(e.target.value) || 0
            )
          }
          className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
          min="0"
          step="0.01"
        />
      ),
    },
    {
      value: 'amount',
      title: 'Amount',
      custom: true,
      component: (item) => (
        <div className="font-semibold">₦{item.amount.toLocaleString()}</div>
      ),
    },
    {
      value: 'action',
      title: 'Action',
      custom: true,
      component: (item) => {
        const isFirst = currentInvoice.items?.[0]?.id === item.id;
        return (
          <div className="flex gap-2 justify-center">
            {isFirst ? (
              <button
                onClick={addInvoiceItem}
                className="text-[#5C7FC1] hover:text-green-700 p-1"
              >
                <Plus className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => removeInvoiceItem(item.id)}
                className="text-red-500 hover:text-red-700 p-1"
                disabled={currentInvoice.items?.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  if (!selectedTransactionType || !currentInvoice.items) {
    return <div>Loading...</div>;
  }

  return (
    <div className="">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/app/reports/transaction')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#AAC7EF] rounded-lg flex items-center justify-center">
            {selectedTransactionType &&
              React.createElement(selectedTransactionType.icon, {
                className: 'w-5 h-5 text-[#4267B2]',
              })}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {selectedTransactionType?.label || 'Create Transaction'}
            </h2>
            <p className="text-gray-600">
              {selectedTransactionType?.description}
            </p>
          </div>
        </div>
      </div>

      {/* Transaction Header Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Document Number
          </label>
          <input
            type="text"
            value={currentInvoice.invoiceNumber}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
            readOnly
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date
          </label>
          <input
            type="date"
            value={currentInvoice.invoiceDate}
            onChange={(e) =>
              setCurrentInvoice((prev) => ({
                ...prev,
                invoiceDate: e.target.value,
              }))
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Due Date
          </label>
          <input
            type="date"
            value={currentInvoice.dueDate}
            onChange={(e) =>
              setCurrentInvoice((prev) => ({
                ...prev,
                dueDate: e.target.value,
              }))
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mode of Payment
          </label>
          <Select
            value={currentInvoice.mode_of_payment}
            onValueChange={(value) =>
              setCurrentInvoice({ ...currentInvoice, mode_of_payment: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Payment Methods</SelectLabel>
                {methods_of_payment.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {currentInvoice.mode_of_payment === 'bank' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bank Account
            </label>
            <Typeahead
              id="bank-account-typeahead"
              size="sm"
              className="col-md-12 pl-0 pr-0"
              options={banks}
              placeholder="Select bank account..."
              onChange={(selectedItems) => {
                const selectedAccount = selectedItems[0];
                if (selectedAccount) {
                  setCurrentInvoice({
                    ...currentInvoice,
                    bankAccountCode: selectedAccount.code,
                    bankAccountDescription: selectedAccount.name,
                    bankAccountSubhead: selectedAccount.chart_code,
                  });
                } else {
                  setCurrentInvoice({
                    ...currentInvoice,
                    bankAccountCode: '',
                    bankAccountDescription: '',
                    bankAccountSubhead: '',
                  });
                }
              }}
              selected={
                currentInvoice.bankAccountCode
                  ? banks.filter(
                      (bank) => bank.code === currentInvoice.bankAccountCode
                    )
                  : []
              }
              labelKey="name"
              positionFixed={true}
              style={{
                borderRadius: '7px',
              }}
            />
          </div>
        )}

        {currentInvoice.mode_of_payment === 'cheque' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bank Account
              </label>
              <Typeahead
                id="cheque-bank-typeahead"
                size="sm"
                className="col-md-12 pl-0 pr-0"
                options={banks}
                placeholder="Select bank account..."
                onChange={(selectedItems) => {
                  const selectedAccount = selectedItems[0];
                  if (selectedAccount) {
                    setCurrentInvoice({
                      ...currentInvoice,
                      bankAccountCode: selectedAccount.code,
                      bankAccountDescription: selectedAccount.name,
                      bankAccountSubhead: selectedAccount.chart_code,
                    });
                  } else {
                    setCurrentInvoice({
                      ...currentInvoice,
                      bankAccountCode: '',
                      bankAccountDescription: '',
                      bankAccountSubhead: '',
                    });
                  }
                }}
                selected={
                  currentInvoice.bankAccountCode
                    ? banks.filter(
                        (bank) => bank.code === currentInvoice.bankAccountCode
                      )
                    : []
                }
                labelKey="name"
                positionFixed={true}
                style={{
                  borderRadius: '7px',
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cheque Number
              </label>
              <input
                type="text"
                value={currentInvoice.cheque}
                onChange={(e) =>
                  setCurrentInvoice((prev) => ({
                    ...prev,
                    cheque: e.target.value,
                  }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter cheque number"
              />
            </div>
          </>
        )}
      </div>

      {/* Transaction Items */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Transaction Items
          </h3>
        </div>

        <div className="overflow-x-auto">
          <CustomTable1 data={currentInvoice.items} fields={fields} />
        </div>
      </div>

      {/* File Attachments */}
      <section aria-labelledby="attach-heading" className="mb-8">
        <div className="my-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Attach Documents{' '}
            <span className="text-xs text-gray-500">
              (Optional, Max {MAX_FILES} files, 5MB each)
            </span>
          </label>
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-gray-50'
            }`}
            style={{ minHeight: '120px' }}
          >
            <Input
              type="file"
              multiple
              onChange={(e) => onFilesSelected(e.target.files)}
              className="hidden"
              id="file-upload"
              accept="image/*,.pdf,.doc,.docx"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer w-full h-full flex flex-col items-center justify-center"
            >
              <FileImage size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 mb-1">
                {isDragActive
                  ? 'Drop files here...'
                  : 'Drag & drop files here, or click to select'}
              </p>
              <p className="text-xs text-gray-500">
                Supported: Images, PDF, Word documents
              </p>
            </label>
          </div>

          {fileError && (
            <p className="text-red-500 mt-2 text-sm">{fileError}</p>
          )}

          {attachments.length > 0 && (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {attachments.map((file, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div
                    className="truncate text-sm cursor-pointer text-blue-600 hover:text-blue-800"
                    title={file.name}
                    onClick={() => {
                      const url = URL.createObjectURL(file);
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    {file.name}
                  </div>

                  <Button
                    variant="ghost"
                    className="text-white bg-red-500 hover:bg-red-600 shadow-none h-8 px-3"
                    size="sm"
                    onClick={() => removeAttachment(i)}
                    aria-label={`Remove ${file.name}`}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-end">
        <button
          onClick={() =>
            setCurrentInvoice((prev) => ({ ...prev, status: 'draft' }))
          }
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Save as Draft
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-[#5C7FC1] hover:bg-[#4267B2] text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save & Post'}
        </button>
      </div>
    </div>
  );
};

export default TransactionForm;