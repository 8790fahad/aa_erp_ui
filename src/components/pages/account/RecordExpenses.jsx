"use client";

/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import { _fetchApi, _postApi, apiURL } from "@/redux/actions/api";
import {
  CreditCard,
  DollarSign,
  FileImage,
  FileText,
  Save,
  Trash,
  User,
} from "lucide-react";
import moment from "moment";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Typeahead } from "react-bootstrap-typeahead";
import { useSelector } from "react-redux";
import { Col, Container, Input, Label, Row, Table } from "reactstrap";
import { useDropzone } from "react-dropzone";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { formatNumber } from "@/utilities";
import { useLocation, useNavigate } from "react-router-dom";
import CustomModal from "@/common/Custom/CustomModal";

import { formatNumber1 } from "@/components/router/utilities";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import SearchSupplierInput from "../purchase/SearchSuppliers";
import ImprovedTaxSelection from "./inproved-tax-selection";

const methods_of_payment = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "transfer", label: "Transfer" },
  { value: "pos", label: "POS" },
];

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function RecordExpenses() {
  const today = moment().format("DD-MM-YYYY");
  const docNum = `PV-REF-${Date.now().toString().slice(-6)}`;
  const _form = {
    mod_account_code: "",
    mod_item_name: "",
    mod_sub_account: "",
    expenditure_type: "",
    expenditure_head: "",
    date: today,
    select_source_account: "",
    source_account_name: "",
    amount: "",
    mode_of_payment: "",
    narration: "",
    modeCode: "",
    reference_number: docNum,
    head_description: "",
    bank_name: "",
    cheque_number: "",
    query_type: "new_insert",
    supplier_name: "",
    supplier_number: "",
    bankAccountCode: "",
    bankAccountDescription: "",
    bankAccountSubhead: "",
    check_number: "",
    sup_bank_account_id: null,
  };
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [form, setForm] = useState(_form);
  const [expenditures, setExpenditures] = useState([]);
  const [modeCode, setModeCode] = useState([]);
  const [addExpenditure, setAddExpenditures] = useState([]);
  const [taxesList, setTaxesList] = useState([]);
  const [taxesList1, setTaxesList1] = useState([]);
  const [taxesApplied, setTaxesApplied] = useState([]);
  const [files, setFiles] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [fileError, setFileError] = useState("");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [memos, setMemos] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useSelector((state) => state.auth);
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const memo_id = queryParams.get("memo_id");
  const reference_number = queryParams.get("reference_number");
  const inputRef = useRef();
  const [isOpen2, setIsOpen2] = useState(false);
  const [supplier, setSupplier] = useState([]);
  const [supplierData, setSupplierData] = useState([]);
  const [supplierAccount, setSupplierAccount] = useState([]);
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(false);
  const [supplierBank, setSupplierBank] = useState([]);
  const [isOpen3, setIsOpen3] = useState(false);
  const [items, setItems] = useState({});
  const [expenseList, setExpenseList] = useState([]);
  const [loading2, setLoading2] = useState(false);
  const [itemList, setItemList] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [accountPayables, setAccountPayable] = useState([]);
  const [banksList, setBanksList] = useState([]);
  const [bankDetails, setBankDetails] = useState([]);
  const [originalAmount, setOriginalAmount] = useState("");
  const [errors, setErrors] = useState({
    from_name: "",
    subject: "",
    purpose: "",
    expenses: "",
  });
  const navigate = useNavigate();
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };
  const [selectedTax, setSelectedTax] = useState("");

  const toggle = (item) => {
    setItems(item);
    setIsOpen3(!isOpen3);
  };

  // Enhanced file upload configuration
  const allowedFileTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  const onDrop = (acceptedFiles, rejectedFiles) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map((file) => {
        if (file.errors.some((error) => error.code === "file-too-large")) {
          return `${file.file.name}: File size exceeds 5MB`;
        }
        if (file.errors.some((error) => error.code === "file-invalid-type")) {
          return `${file.file.name}: Invalid file type`;
        }
        return `${file.file.name}: Upload error`;
      });
      setFileError(errors.join(", "));
      toast.error(errors.join(", "));
      return;
    }

    // Check if adding new files would exceed limit
    if (files.length + acceptedFiles.length > MAX_FILES) {
      const errorMsg = `Maximum ${MAX_FILES} files allowed`;
      setFileError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setFileError("");

    // Add preview URLs for images
    const filesWithPreviews = acceptedFiles.map((file) => {
      const fileWithPreview = Object.assign(file, {
        preview: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : null,
        id: Date.now() + Math.random(), // Add unique ID
      });
      return fileWithPreview;
    });

    setFiles((prevFiles) => [...prevFiles, ...filesWithPreviews]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "application/msword": [".doc"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  });

  const removeFile = (indexToRemove) => {
    setFiles((prevFiles) => {
      const newFiles = prevFiles.filter((_, index) => index !== indexToRemove);
      // Revoke preview URL to prevent memory leaks
      const fileToRemove = prevFiles[indexToRemove];
      if (fileToRemove.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return newFiles;
    });
  };

  // Cleanup file previews when component unmounts
  useEffect(() => {
    return () => {
      files.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, []);

  const getAllExpenditures = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=select_administrative_expenses`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setExpenditures(resp.results);
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  const getSuppliers = () => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/v1/api/supplier/banks/${activeBusiness.id}`,
      (resp) => {
        if (resp.success) {
          setSupplier(resp.results);
        } else {
          toast.error("Failed to load chart data.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  const getModeCode = () => {
    if (!activeBusiness?.id) return;

    _postApi(
      `/account/expenditure?query_type=select_mode_code`,
      { store: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setModeCode(resp.results);
        } else {
          toast.error("Failed to load chart data.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  const getAccountPayable = () => {
    if (!activeBusiness?.id) return;

    _postApi(
      `/account/expenditure?query_type=select_account_payable`,
      { store: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setAccountPayable(resp.results);
        } else {
          toast.error("Failed to load chart data.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  const getAllTaxes = () => {
    if (!activeBusiness?.id) return;

    _postApi(
      `/get-all-taxes`,
      { store: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setTaxesList(resp.results);
        } else {
          toast.error("Failed to load chart data.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  const getAllTaxes2 = () => {
    if (!activeBusiness?.id) return;

    _postApi(
      `/account/expenditure?query_type=select_tax`,
      { store: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setTaxesList1(resp.results);
        } else {
          toast.error("Failed to load chart data.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  const getMemos = () => {
    _postApi(
      "/account/get-memo",
      {
        facilityId: activeBusiness.id,
        status: "approved",
        userId: user.id,
        query_type: "list_by_id",
        memo_id: memo_id,
      },
      (resp) => {
        setLoading(false);
        if (resp.success) {
          const memo = resp.results || [];
          setMemos(memo);
          setForm((prev) => ({
            ...prev,
            supplier_name: memo[0]?.supplier_name,
            supplier_code: memo[0]?.supplier_code,
            account_code: memo[0]?.account_code,
            supplier_number: memo[0]?.supplier_number,
          }));
        } else {
          toast.error("Failed to load chart data.");
        }
      },
      (err) => {
        setLoading(false);
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  const getProductList = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=select_supplier&memo_id=${reference_number}`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setSupplierData(resp.results);
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  const getBankList = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=banks_list`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setBanksList(resp.results);
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    if (supplierData.length > 0) {
      setForm((prev) => ({
        ...prev,
        supplier_code: supplierData[0]?.supplier_code,
        supplier_name: supplierData[0]?.supplier_name,
        account_code: supplierData[0]?.account_code,
        supplier_number: supplierData[0]?.supplier_number,
      }));
    }
  }, [supplierData]);

  useEffect(() => {
    if (memos.length > 0) {
      const memo = memos[0];
      setForm((prev) => ({
        ...prev,
        date: memo?.date,
        amount: memo?.total || "",
        memo_id: memo?.memo_id,
        purpose: memo?.purpose,
      }));
    }
  }, [memos]);

  useEffect(() => {
    const getSupplierBankDetails = () => {
      if (!activeBusiness?.id || !form.supplier_number) return;

      setLoadingBankAccounts(true);
      _fetchApi(
        `/api/get/supplier-bank-details/${activeBusiness.id}/${form.supplier_number}`,
        (resp) => {
          setLoadingBankAccounts(false);
          if (resp.success) {
            setSupplierBank(resp.results || []);
          } else {
            setSupplierBank([]);
            toast.error("Failed to load supplier bank details.");
          }
        },
        (err) => {
          console.error("API Error:", err);
          setLoadingBankAccounts(false);
          setSupplierBank([]);
          toast.error(
            "Something went wrong while fetching supplier bank details."
          );
        }
      );
    };

    if (form.supplier_number) {
      getSupplierBankDetails();
    } else {
      setSupplierBank([]);
      setLoadingBankAccounts(false);
    }
  }, [form.supplier_number, activeBusiness?.id]);

  const getExpenseList = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=select_administrative_expenses`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setExpenseList(
            resp.results.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
            }))
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    getExpenseList();
  }, []);

  useEffect(() => {
    getMemos();
  }, []);

  useEffect(() => {
    getAllExpenditures();
    getModeCode();
    getSuppliers();
    getAllTaxes();
    getAllTaxes2();
    getAccountPayable();
    getProductList();
    getBankList();
  }, []);

  useEffect(() => {
    if (memos?.length > 0) {
      setIsOpen2(true);
    }
  }, [memos]);

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({ ...p, [name]: value }));
  };

  React.useEffect(() => {
    let selectedCode = "";
    let head_description = "";
    let mode_account_type = "";
    let mode_Balance_Type = "";

    if (form.mode_of_payment === "cash") {
      const cashCode = modeCode?.find((code) =>
        code.description.includes("Cash at hand")
      );
      selectedCode = cashCode ? `${cashCode.head}` : "";
      head_description = cashCode ? `${cashCode.description}` : "";
      mode_account_type = cashCode ? `${cashCode.account_type}` : "";
      mode_Balance_Type = cashCode ? `${cashCode.Balance_Type}` : "";
    } else if (
      form.mode_of_payment === "cheque" ||
      form.mode_of_payment === "transfer" ||
      form.mode_of_payment === "pos"
    ) {
      const bankCode = modeCode.find(
        (code) => code.description === "Cash at Bank"
      );
      selectedCode = bankCode ? `${bankCode.head}` : "";
      head_description = bankCode ? `${bankCode.description}` : "";
      mode_account_type = bankCode ? `${bankCode.account_type}` : "";
      mode_Balance_Type = bankCode ? `${bankCode.Balance_Type}` : "";
    } else {
      selectedCode = "";
    }

    setForm((prev) => ({
      ...prev,
      mode_code: selectedCode,
      mode_account_type: mode_account_type,
      mode_Balance_Type: mode_Balance_Type,
      head_description: head_description,
    }));
  }, [form.mode_of_payment, modeCode]);

  const handleAddBank = () => {
    if (
      !form.expenditure_type ||
      !form.collected_by ||
      !form.amount ||
      !form.mode_of_payment ||
      !form.narration
    ) {
      toast.error("All fields are required!");
      return;
    }

    if (isNaN(form.amount) || Number(form.amount) <= 0) {
      toast.error("Amount must be a valid positive number!");
      return;
    }

    if (
      !methods_of_payment.some(
        (method) => method.value === form.mode_of_payment
      )
    ) {
      toast.error("Please select a valid mode of payment!");
      return;
    }

    if (
      (form.mode_of_payment === "cheque" ||
        form.mode_of_payment === "transfer") &&
      !form.reference_number
    ) {
      toast.error("Reference Number is required for this mode of payment!");
      return;
    }

    if (taxesApplied.length === 0) {
      toast.error("Please apply at least one tax!");
      return;
    }

    setAddExpenditures((prev) => [...prev, form]);
    setForm(_form);
    setTaxesApplied([]);
    toast.success("Expense added successfully!");
  };

  // Enhanced handleSubmit with file upload using FormData
  const handleSubmit = () => {
    setLoading(true);

    // Validate required fields before submission
    if (!expense.item_code || !expense.chart_code) {
      toast.error("Please select an expense account from the dropdown");
      setLoading(false);
      return;
    }

    if (!expense.unitCost || !expense.quantity) {
      toast.error("Unit cost and quantity are required");
      setLoading(false);
      return;
    }

    // Use the original amount for calculations (before any tax modifications)
    const baseAmount = Number.parseFloat(originalAmount || form.amount) || 0;
    let taxAmount = 0;
    let netAmount = baseAmount;

    if (taxesApplied.length > 0) {
      const selectedTax = taxesApplied[0];
      const rate = (selectedTax.rate || selectedTax.percentage || 0) / 100;

      if (selectedTax.tax_type === "inclusive") {
        // Backend logic: netBeforeTax = purchaseAmount / (1 + taxRate)
        // calculatedTax = netBeforeTax * taxRate
        const netBeforeTax = baseAmount / (1 + rate);
        taxAmount = Math.round(netBeforeTax * rate * 100) / 100; // Round to 2 decimal places
        netAmount = Math.round(netBeforeTax * 100) / 100; // Round to 2 decimal places
      } else {
        // For exclusive tax: calculatedTax = purchaseAmount * taxRate
        taxAmount = Math.round(baseAmount * rate * 100) / 100; // Round to 2 decimal places
        netAmount = baseAmount;
      }
    }

    // Ensure expense object has all required fields
    const validatedExpense = {
      ...expense,
      item_code: expense.item_code || form.account_code, // Fallback to form account_code
      chart_code: expense.chart_code || form.account_code, // Fallback to form account_code
      unitCost: expense.unitCost || 0,
      quantity: expense.quantity || 1,
      item: expense.item || expense.description || "Expense Item",
      description:
        expense.description || form.narration || "Payment voucher expense",
    };

    // Validate that we have the required account codes
    if (!validatedExpense.item_code) {
      toast.error(
        "Missing expense account code. Please select an expense account."
      );
      setLoading(false);
      return;
    }

    if (!validatedExpense.chart_code) {
      toast.error(
        "Missing expense account subhead. Please select an expense account."
      );
      setLoading(false);
      return;
    }

    // Validate bank account fields if payment is being made
    if (form.amount > 0 && form.mode_of_payment && !form.mod_account_code) {
      toast.error("Please select a bank account for the payment method.");
      setLoading(false);
      return;
    }

    // Get bank account details for the selected account
    let bankAccountSubhead = "";
    let bankAccountDescription = "";

    if (form.mod_account_code && accountList.length > 0) {
      const selectedBankAccount = accountList.find(
        (acc) => acc.head === form.mod_account_code
      );
      if (selectedBankAccount) {
        bankAccountSubhead =
          selectedBankAccount.subhead || selectedBankAccount.head;
        bankAccountDescription =
          selectedBankAccount.description || "Bank Account";
      }
    }

    const submitData = {
      form: {
        ...form,
        amount: baseAmount.toString(), // Use the original/base amount
        tax_amount: Number.parseFloat(taxAmount.toFixed(2)),
        net_amount: Number.parseFloat(netAmount.toFixed(2)),
        mod_item_name: bankAccountDescription,
        mod_sub_account: bankAccountSubhead,
      },
      taxesApplied: taxesApplied.map((tax) => ({
        ...tax,
        amount: Number.parseFloat(taxAmount.toFixed(2)),
        calculated_tax_amount: Number.parseFloat(taxAmount.toFixed(2)),
        base_amount: Number.parseFloat(baseAmount.toFixed(2)),
        net_amount: Number.parseFloat(netAmount.toFixed(2)),
        rate: tax.rate || tax.percentage || 0,
        tax_type: tax.tax_type || "exclusive",
      })),
      userId: user.id,
      facilityId: activeBusiness.id,
      account_payable: activeBusiness.payable_code,
      prepayment_code: activeBusiness.payable_prepayment_code,
      accruedPayment: activeBusiness.payable_accural_code,
      expense: validatedExpense,
    };

    // Create FormData for file upload
    const formData = new FormData();

    formData.append("pv_data", JSON.stringify(submitData));

    // Append files if they exist
    if (files.length > 0) {
      files.forEach((file, index) => {
        formData.append("pv_documents", file);
        formData.append("document_names", file.name);
      });
    }

    // Use fetch for FormData submission (similar to Memo component)
    fetch(`${apiURL}/create-pv-records`, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((response) => response.json())
      .then((resp) => {
        setLoading(false);
        if (resp.success) {
          toast.success("Expenses recorded successfully!");
          setForm({
            expenditure_type: "",
            expenditure_head: "",
            date: "",
            select_source_account: "",
            source_account_name: "",
            amount: "",
            mode_of_payment: "",
            narration: "",
            modeCode: "",
            reference_number: docNum,
            head_description: "",
            bank_name: "",
            cheque_number: "",
            account_number: "",
            account_name: "",
            supplier_code: "",
            userId: user.id,
            supplier_name: "",
            account: {},
          });
          setTaxesApplied([]);
          setFiles([]);

          memos.length > 0
            ? navigate(
                `/app/account/record-expenses/pv-pdf?memo_id=${memo_id}&pv=${resp.pv_code}`
              )
            : navigate(
                `/app/account/record-expenses/pv-direct-pdf?pv=${resp.pv_code}&memo_id=${memo_id}`
              );
        } else {
          toast.error(resp.message || "Error while sending expenses");
        }
      })
      .catch((err) => {
        setLoading(false);
        console.error("Fetch error:", err);
        toast.error("Error occurred while submitting");
      });
  };

  const getLogs = useCallback((memoId) => {
    if (!memoId) return;
    _fetchApi(
      `/account/get-logs?id=${memoId}&facilityId=${activeBusiness.id}`,
      (data) => {
        setLoading2(false);
        if (data.success) {
          setLogs(data.results[0]);
        }
      },
      (err) => {
        setLoading2(false);
        console.log(err);
      }
    );
  }, []);

  const viewList = (item) => {
    toggle(item);
    getLogs(item.reference_number);
    _postApi(
      "/account/memo-item-list",
      {
        query_type: "select",
        memo_id: item.reference_number,
        date: moment().format("YYYY-MM-DD"),
        user_id: user.id,
      },
      (res) => {
        if (res.success) {
          setItemList(res.results);
          const serverFiles = res.attachments.map((doc) => ({
            name: doc.original_name,
            type: doc.mime_type,
            size: doc.file_size,
            preview: `${apiURL}/public/uploads/${doc.file_path}`,
            fromServer: true,
          }));
          setAttachments(serverFiles);
        }
      },
      (err) => {
        console.log(err);
        toast.error("Error Occurred");
      }
    );
  };

  const getRevenueItems = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=banks_details`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setBankDetails(
            resp.results.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
            }))
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  const getBankDetails = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=banks_details`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setBankDetails(
            resp.results.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
            }))
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    getRevenueItems();
    getBankDetails();
    getItemDetails();
  }, []);

  useEffect(() => {
    if (form.supplier_code) {
      setSupplierAccount(
        supplier.find((item) => item.supplier_code === form.supplier_code)
          ?.bankDetails
      );
    }
  }, [form.supplier_code]);
  const [expense, setExpense] = useState({
    item: "",
    unitCost: "",
    description: "",
    quantity: 1,
    item_code: "",
    chart_code: "",
    item_id: "",
  });
  const getItemDetails = (item) => {
    _postApi(
      "/account/memo-item-list",
      {
        query_type: "select",
        memo_id: memo_id,
        date: moment().format("YYYY-MM-DD"),
        user_id: user.id,
      },
      (res) => {
        if (res.success) {
          const transformedExpenses = res.results.map((item) => ({
            item: item.item_name, // rename item_name to item
            unitCost: Number.parseFloat(item.unit_cost), // rename unit_cost to unitCost
            description: item.description,
            quantity: item.quantity,
            item_id: item.item_list_id,
            item_code: item.item_code,
            chart_code: item.item_subhead, // assuming item_subhead is what you want as chart_code
          }));
          setExpense((prev) => ({ ...prev, ...transformedExpenses[0] }));
        } else {
          toast.error("Failed to fetch expenses.");
        }
      },
      (err) => {
        toast.error("Error fetching expenses.");
        console.error(err);
      }
    );
  };
  const [accountList, setAccountList] = useState([]);
  useEffect(() => {
    if (
      form.mode_of_payment === "bank" ||
      form.mode_of_payment === "cash" ||
      form.mode_of_payment === "cheque"
    ) {
      _postApi(
        `/inventory/product-list?query_type=${form.mode_of_payment}`,
        { facilityId: activeBusiness.id },
        (resp) => {
          if (resp.success) {
            setAccountList(resp.results);
          } else {
            toast.error("Failed to load list of items.");
          }
        },
        (err) => {
          console.error("API Error:", err);
          toast.error("Something went wrong while fetching data.");
        }
      );
    }
  }, [form.mode_of_payment]);

  const resetTaxSelection = () => {
    setSelectedTax("");
    setTaxesApplied([]);
    setOriginalAmount("");
  };

  const handleTaxChange = (taxId) => {
    setSelectedTax(taxId);
    const selectedTaxDetails = taxesList.find(
      (tax) => tax.id?.toString() === taxId
    );

    if (selectedTaxDetails) {
      // Store original amount if not already stored
      if (!originalAmount && form.amount) {
        setOriginalAmount(form.amount);
      }
      setTaxesApplied([selectedTaxDetails]);
    } else {
      setTaxesApplied([]);
      // Don't reset the form amount - keep it as is
      setOriginalAmount("");
    }
  };

  const handleAmountUpdate = (newAmount, taxDetails) => {
    // Store original amount if not already stored
    if (!originalAmount && form.amount) {
      setOriginalAmount(form.amount);
    }

    // Update form amount based on tax calculation
    // setForm((prev) => ({
    //   ...prev,
    //   amount: newAmount.toString(),
    // }));

    // Update taxes applied
    if (taxDetails) {
      setTaxesApplied([taxDetails]);
    }
  };

  const Select = ({ children, className = "mt-0", ...props }) => (
    <select
      className={`flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </select>
  );

  return (
    <div>
      <CustomCard back header="Payment Voucher">
        {/* Memo Details Card */}

        {/* Basic Expense Details */}
        <div className="card shadow rounded mb-4">
          <div className="bg-muted px-4 py-3 rounded-t-lg border-b border-border">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-card-foreground">
                Basic Expense Details
              </h3>
            </div>
          </div>
          <div className="card-body">
            <Row>
              {/* {JSON.stringify(form)} */}
              <Col md={3} className="mb-1">
                <Label>Date:</Label>
                <Input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                />
              </Col>
              <Col md={4} className="mb-3">
                <Label>Reference Number: </Label>
                <Input
                  type="text"
                  name="reference_number"
                  value={form.reference_number}
                  onChange={handleChange}
                  disabled
                />
              </Col>

              {memos.length > 0 && form.amount && form.amount > 0 ? (
                <>
                  <Col md={5} className="mb-1">
                    <SearchSupplierInput
                      label="Payee:"
                      edge={true}
                      value={{
                        supplier_name: form.supplier_name,
                        supplier_code: form.supplier_code,
                        supplier_subhead: form.account_code,
                        supplier_number: form.supplier_number,
                      }}
                      onChange={(s) => {
                        console.log("SearchSupplierInput returned:", s);
                        setForm((p) => ({
                          ...p,
                          supplier_name: s.supplier_name,
                          supplier_code: s.supplier_code,
                          account_code: s.supplier_subhead,
                          supplier_number: s.supplier_number,
                        }));
                      }}
                    />
                  </Col>
                </>
              ) : (
                <>
                  {form.amount && form.amount > 0 && (
                    <Col md={5} className="mb-3">
                      <Label>Suppliers:</Label>
                      <Typeahead
                        id="supplier-typeahead"
                        size="sm"
                        className="col-md-12 pl-0 pr-0 custom-typeahead-border"
                        options={supplier?.map((sup) => ({
                          label: sup.supplier_name,
                          value: sup.supplier_code,
                          bankDetails: sup.bankDetails || [],
                        }))}
                        placeholder="Select supplier..."
                        onChange={(selectedItems) => {
                          if (selectedItems.length > 0) {
                            setSupplierAccount(
                              Array.isArray(selectedItems[0].bankDetails)
                                ? selectedItems[0].bankDetails
                                : []
                            );
                            setForm((prev) => ({
                              ...prev,
                              supplier_name: selectedItems[0].label,
                              supplier_code: selectedItems[0].value,
                            }));
                          } else {
                            setSupplierAccount([]);
                            setForm((prev) => ({
                              ...prev,
                              supplier_name: "",
                              supplier_code: "",
                            }));
                          }
                        }}
                        selected={
                          form.supplier_code
                            ? supplier
                                ?.filter(
                                  (sup) =>
                                    sup.supplier_code === form.supplier_code
                                )
                                ?.map((sup) => ({
                                  label: sup.supplier_name,
                                  value: sup.supplier_code,
                                  bankDetails: sup.bankDetails || [],
                                }))
                            : []
                        }
                        labelKey="label"
                        style={{
                          borderRadius: "7px",
                        }}
                      />
                    </Col>
                  )}
                </>
              )}

              {/* Account Selection - Show only when payee/supplier is selected */}
              {form.supplier_number && (
                <Col md={6} className="mb-1">
                  <Label>Bank accounts:</Label>
                  <Input
                    type="select"
                    name="account_selection"
                    value={form.sup_bank_account_id || ""}
                    disabled={loadingBankAccounts}
                    onChange={(e) => {
                      const selectedAccount = supplierBank.find(
                        (acc) => acc.id === Number(e.target.value)
                      );
                      console.log({ selectedAccount }, e.target.value);
                      setForm((prev) => ({
                        ...prev,
                        sup_bank_account_id: e.target.value,
                        account_name: selectedAccount?.account_name || "",
                        account_number: selectedAccount?.account_number || "",
                      }));
                    }}
                  >
                    <option value="">
                      {loadingBankAccounts
                        ? "Loading bank accounts..."
                        : supplierBank && supplierBank.length === 0
                        ? "No bank accounts available"
                        : "Select Account..."}
                    </option>
                    {!loadingBankAccounts &&
                      supplierBank?.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.account_name} - {account.bank_name}(
                          {account.account_number})
                        </option>
                      ))}
                  </Input>
                  {!loadingBankAccounts &&
                    supplierBank &&
                    supplierBank.length === 0 && (
                      <small className="text-muted">
                        This supplier has no bank accounts configured
                      </small>
                    )}
                </Col>
              )}
            </Row>
          </div>
        </div>

        <div
          className="card shadow rounded my-4"
          style={isOpen2 ? { display: "block" } : { display: "none" }}
        >
          <div className="bg-muted px-4 py-3 rounded-t-lg border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-card-foreground">
                Memo Details
              </h3>
            </div>
          </div>
          <Table responsive className="px-2">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-medium">
                  Account Code <span className="text-danger">*</span>
                </th>
                <th className="text-left p-3 font-medium">Description</th>
                <th className="text-left p-3 font-medium">Unit Cost</th>
                <th className="text-left p-3 font-medium">Quantity</th>
                <th className="text-left p-3 font-medium">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr className="px-2">
                <td>
                  <Typeahead
                    id="expense-item-typeahead"
                    size="md"
                    className="col-md-12 pl-0 pr-0"
                    options={expenseList}
                    placeholder="Select item..."
                    onChange={(selectedItems) =>
                      setExpense((prev) => ({
                        ...prev,
                        item_code: selectedItems[0]?.code || "",
                        item: selectedItems[0]?.name || "",

                        chart_code: selectedItems[0]?.chart_code || "",
                      }))
                    }
                    selected={
                      expense.item
                        ? [
                            {
                              name: expense.item,
                              code: expense.item_code,
                              chart_code: expense.chart_code,
                            },
                          ]
                        : []
                    }
                    labelKey={(option) => `${option.name} (${option.code})`}
                    positionFixed={true}
                    style={{
                      borderRadius: "7px",
                    }}
                  />
                </td>
                <td>
                  <Input
                    type="text"
                    name="description"
                    disabled
                    value={expense.description}
                    onChange={(e) =>
                      setExpense({
                        ...expense,
                        item: e.target.value,
                      })
                    }
                  />
                </td>
                <td>
                  <Input
                    type="text"
                    name="unitCost"
                    value={formatNumber1(expense.unitCost)}
                    className="text-end"
                    disabled
                    onChange={(e) =>
                      setExpense({
                        ...expense,
                        unitCost: Number(e.target.value),
                      })
                    }
                  />
                </td>
                <td>
                  <Input
                    type="text"
                    name="quantity"
                    className="text-center"
                    disabled
                    value={formatNumber(expense.quantity)}
                    onChange={(e) =>
                      setExpense({
                        ...expense,
                        quantity: Number(e.target.value),
                      })
                    }
                  />
                </td>
                <td className="text-xl font-bold text-blue-600 text-right">
                  <div className="text-right font-bold text-primary">
                    {formatNumber1(expense.unitCost * expense.quantity)}
                  </div>
                </td>
              </tr>
            </tbody>
          </Table>
          {errors.expenses && (
            <span className="text-danger">{errors.expenses}</span>
          )}
          <div className="card-footer bg-light">
            <div className="d-flex align-items-center justify-content-center">
              <CustomButton
                color="success"
                size="sm"
                className="m-1"
                handleSubmit={() => {
                  viewList(memos[0]);
                }}
              >
                View Memos
              </CustomButton>
            </div>
          </div>
        </div>

        <div className="card shadow rounded">
          <div className="bg-muted px-4 py-3 rounded-t-lg border-b border-border">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-card-foreground">
                Payment Information
              </h3>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-semibold">
                  Payment Amount ({formatNumber(form.amount)})
                </Label>
                <Input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value >= 0 || value === "") {
                      handleChange(e);
                      if (taxesApplied.length > 0) {
                        resetTaxSelection();
                      }
                    }
                  }}
                  className="font-semibold"
                />
              </div>

              {form.amount && form.amount > 0 && (
                <div className="space-y-2">
                  <Label>Mode of Payment</Label>
                  <Select
                    name="mode_of_payment"
                    value={form.mode_of_payment}
                    onChange={handleChange}
                  >
                    <option value="">Select Mode of Payment</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="bank">Bank Transfer</option>
                  </Select>
                </div>
              )}

              {(form.mode_of_payment === "bank" ||
                form.mode_of_payment === "cash" ||
                form.mode_of_payment === "cheque") &&
                form.amount > 0 && (
                  <div className="space-y-2">
                    <Label>
                      {form.mode_of_payment === "bank"
                        ? "Bank Account"
                        : form.mode_of_payment === "cheque"
                        ? "Bank Account"
                        : "Account Head"}
                    </Label>
                    <Select
                      name="mod_account_code"
                      value={form.mod_account_code}
                      onChange={handleChange}
                    >
                      <option value="">Select account...</option>
                      {accountList.map((account) => (
                        <option key={account.head} value={account.head}>
                          {account.description} ({account.head})
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

              {form.mode_of_payment === "cheque" && (
                <div className="space-y-2">
                  <Label>Cheque Number</Label>
                  <Input
                    type="text"
                    name="cheque_number"
                    value={form.cheque_number}
                    onChange={handleChange}
                  />
                </div>
              )}
            </div>

            <ImprovedTaxSelection
              form={{
                ...form,
                amount: originalAmount || form.amount,
              }}
              taxesList={taxesList}
              selectedTax={selectedTax}
              onTaxChange={handleTaxChange}
              onAmountUpdate={handleAmountUpdate}
            />
          </div>
        </div>

        {/* Enhanced Expense Documentation */}
        <div className="card shadow rounded mt-4">
          <div className="bg-muted px-4 py-3 rounded-t-lg border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-card-foreground">
                Expense Documentation
              </h3>
            </div>
          </div>
          <div className="card-body pb-0">
            <Row className="mb-3">
              <Col md={12}>
                <Label>
                  Payment Narration<span className="text-red-500">*</span>
                </Label>
                <Input
                  type="textarea"
                  rows="3"
                  name="narration"
                  value={form.narration}
                  onChange={handleChange}
                />
              </Col>
            </Row>
            <Row className="mb-3">
              <Col md={12} className="pb-3">
                <Label>
                  Attach Documents{" "}
                  <span style={{ fontSize: 10 }} className="text-secondary">
                    (Optional, Max {MAX_FILES} files, 5MB each)
                  </span>
                </Label>

                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded p-4 d-flex flex-column align-items-center justify-content-center text-center cursor-pointer ${
                    isDragActive
                      ? "border-primary bg-light"
                      : "border-secondary bg-light"
                  }`}
                  style={{
                    minHeight: "120px",
                    backgroundColor: isDragActive ? "#f8f9fa" : "#f8f9fa",
                    borderColor: isDragActive ? "var(--aa-navy)" : "#6c757d",
                    transition: "all 0.3s ease",
                  }}
                >
                  <input {...getInputProps()} />
                  <div className="text-center">
                    <FileImage size={32} className="mx-auto text-muted mb-2" />
                    <p className="text-sm text-muted mb-1">
                      {isDragActive
                        ? "Drop files here..."
                        : "Drag & drop files here, or click to select"}
                    </p>
                    <p className="text-xs text-muted">
                      Supported: Images, PDF, Word, Excel documents
                    </p>
                  </div>
                </div>

                {fileError && (
                  <p className="text-danger mt-2 small">{fileError}</p>
                )}

                {files.length > 0 && (
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {files.map((file, i) => (
                      <li
                        key={file.id || i}
                        className="flex items-center justify-between rounded-md border p-3"
                      >
                        {/* File name (clickable preview for images) */}
                        {file.type.startsWith("image/") ? (
                          <div
                            className="truncate text-sm cursor-pointer"
                            title={file.name}
                            onClick={() => {
                              setPhotoIndex(i);
                              setIsOpen(true);
                            }}
                          >
                            {file.name}
                          </div>
                        ) : (
                          <a
                            className="truncate text-sm text-black"
                            title={file.name}
                            href={file.preview || URL.createObjectURL(file)}
                            onClick={(e) => {
                              e.preventDefault();
                              const url =
                                file.preview || URL.createObjectURL(file);
                              window.open(url, "_blank", "noopener,noreferrer");
                            }}
                            style={{ textDecoration: "none" }}
                          >
                            {file.name}
                          </a>
                        )}

                        {/* Remove button */}
                        <Button
                          variant=""
                          className="text-white bg-red-500 hover:bg-red-700 shadow-none"
                          size="sm"
                          onClick={() => removeFile(i)}
                          aria-label={`Remove ${file.name}`}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Col>
            </Row>
          </div>
        </div>

        {/* Action Buttons and Table */}
        <Container>
          <Row className="mt-3">
            <Col
              md={12}
              className="mb-3"
              style={isOpen2 ? { display: "none" } : { display: "block" }}
            >
              <center>
                <CustomButton
                  onClick={handleAddBank}
                  className="mt-2 mb-2 d-flex align-items-center gap-2"
                >
                  <Save size={18} />
                  save
                </CustomButton>
              </center>
            </Col>

            <Table
              responsive
              striped
              hover
              style={isOpen2 ? { display: "none" } : { display: "block" }}
            >
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Expenditure Description</th>
                  <th>Collected By</th>
                  <th>Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {addExpenditure?.map((item, index) => (
                  <tr key={index}>
                    <td>{item.date}</td>
                    <td>{item.expenditure_type}</td>
                    <td>{item.collected_by}</td>
                    <td>{item.amount}</td>
                    <td>
                      <Trash size={18} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Col className="mt-2 mb-2 d-flex align-items-center gap-2 justify-content-center">
              <CustomButton
                onClick={handleSubmit}
                loading={loading}
                className="mt-2 mb-2 d-flex align-items-center gap-2"
              >
                Generate PV
              </CustomButton>
            </Col>
          </Row>
        </Container>
      </CustomCard>

      {/* Modal */}
      <CustomModal
        isOpen={isOpen3}
        toggle={toggle}
        itemList={itemList}
        header="Preview"
        size="lg"
      >
        {/* Modal content remains the same */}
        <div>
          <div
            style={{
              borderWidth: 1,
              borderColor: "#000",
              padding: 20,
              marginBottom: 20,
            }}
          >
            <h2
              style={{
                fontSize: 18,
                textAlign: "center",
                marginBottom: 10,
                textTransform: "uppercase",
              }}
            >
              {activeBusiness?.business_name}
            </h2>
            <h4
              style={{
                fontSize: 12,
                textAlign: "center",
                textTransform: "uppercase",
              }}
            >
              Internal Memo
            </h4>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ flexDirection: "row", width: "100%" }}>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 12,
                  textTransform: "uppercase",
                  marginRight: 10,
                }}
              >
                Date: <b>{moment().format(items?.date)}</b>
              </div>
            </div>
            <div style={{ flexDirection: "row", width: "100%" }}>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 12,
                  textTransform: "uppercase",
                  marginRight: 10,
                }}
              >
                Memo No.: <b>{items?.memo_id}</b>
              </div>
            </div>
            <div style={{ flexDirection: "row", width: "100%" }}>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 12,
                  textTransform: "uppercase",
                  marginRight: 10,
                }}
              >
                Recipient: <b>The {items?.recipient},</b>
              </div>
            </div>
            <div style={{ flexDirection: "row", width: "100%" }}>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 12,
                  textTransform: "uppercase",
                  marginRight: 10,
                }}
              >
                From branch: <b>{items?.from_name}</b>
              </div>
            </div>
            <div style={{ flexDirection: "row", width: "100%" }}>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 14,
                  textTransform: "uppercase",
                  marginRight: 10,
                }}
              >
                Subject: <b>{items?.subject}</b>
              </div>
            </div>
            <div style={{ flexDirection: "row", width: "100%" }}>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 14,
                  textTransform: "uppercase",
                  marginRight: 10,
                }}
              >
                Purpose: <b>{items?.purpose}</b>
              </div>
            </div>
            <div style={{ flexDirection: "row", width: "100%" }}>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 14,
                  textTransform: "uppercase",
                  marginRight: 10,
                }}
              >
                <span className="fw-bold">Details: </span>
                <br />
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <th>S/N</th>
                      <th>Item Name</th>
                      <th>Unit Cost</th>
                      <th>Quantity</th>
                      <th>Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemList.map((item, idx) => (
                      <tr key={item.item_list_id}>
                        <td>{idx + 1}</td>
                        <td>{item.description}</td>
                        <td className="text-right">
                          ₦{formatNumber1(item.unit_cost)}
                        </td>
                        <td className="text-center">
                          {Number(item.quantity).toLocaleString()}
                        </td>
                        <td className="text-right">
                          ₦{formatNumber1(item.unit_cost * item.quantity)}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={4} className="text-right fw-bold">
                        Requested Amount:
                      </td>
                      <td className="text-right">
                        ₦{formatNumber1(items?.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {attachments.length > 0 && (
            <>
              <div className="fw-bold">Memo attachments: </div>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {attachments.map((file, i) => {
                  // Extract file extension
                  const parts = file.name.split(".");
                  const ext = parts.length > 1 ? "." + parts.pop() : "";
                  const baseName = parts.join(".");

                  return (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-md border px-4 py-2"
                    >
                      {/* File name (clickable preview for images) */}
                      {file.type.startsWith("image/") ? (
                        <div
                          className="flex text-sm cursor-pointer"
                          title={file.name}
                          onClick={() => {
                            setPhotoIndex(i);
                            setIsOpen(true);
                          }}
                        >
                          <span className="truncate max-w-[150px]">
                            {baseName}
                          </span>
                          <span className="ml-1 flex-shrink-0">{ext}</span>
                        </div>
                      ) : (
                        <a
                          className="flex text-sm text-black"
                          title={file.name}
                          href={file.preview}
                          onClick={(e) => {
                            e.preventDefault();
                            window.open(
                              file.preview,
                              "_blank",
                              "noopener,noreferrer"
                            );
                          }}
                          style={{ textDecoration: "none" }}
                        >
                          <span className="truncate max-w-[150px]">
                            {baseName}
                          </span>
                          <span className="ml-0 flex-shrink-0">{ext}</span>
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <div className="mt-3">
            <center>
              <button onClick={toggleCollapse} className="btn btn-primary">
                {isCollapsed ? "View Logs" : "Hide Logs"}
              </button>
            </center>

            {!isCollapsed && (
              <div className="mt-3">
                <center>
                  <h4 className="fw-bold">Logs</h4>
                </center>
                <div className=" table-responsive">
                  <table className="table table-bordered">
                    <thead>
                      <tr>
                        <th>S/N</th>
                        <th>Date</th>
                        <th>Activity</th>
                        <th>User</th>
                        <th>Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>1</td>
                        <td>{items?.date}</td>
                        <td>Raised memo</td>
                        <td>{items?.raise_by}</td>
                      </tr>
                      <tr>
                        <td>2</td>
                        <td>{logs[0]?.date}</td>
                        <td>Reviewed memo</td>
                        <td>{logs[0]?.name}</td>
                        <td>{logs[0]?.remark}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </CustomModal>

      {/* Lightbox for image previews */}
      {isOpen && (
        <Lightbox
          open={isOpen}
          close={() => setIsOpen(false)}
          slides={files
            .filter((f) => f.type.startsWith("image/"))
            .map((f) => ({
              src: f.fromServer ? f.preview : URL.createObjectURL(f),
            }))}
          index={photoIndex}
          onIndexChange={setPhotoIndex}
        />
      )}
    </div>
  );
}
