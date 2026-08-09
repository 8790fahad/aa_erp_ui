import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";
import { useSelector } from "react-redux";

const BankStatementUpload = ({ onTransactionsUploaded, selectedAccount, onStatementUploaded }) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const currentUser = useSelector((state) => state.auth.user);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const inputRef = React.createRef();

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          // Validate required fields
          if (jsonData.length === 0) {
            throw new Error("Excel file is empty");
          }

          // Check for required columns
          const sampleRow = jsonData[0];
          const requiredFields = [ ["tran date", "date"], ["details", "description"] ];
          const missingFields = requiredFields.filter(
            (fieldGroup) =>
              !fieldGroup.some(field =>
                 Object.keys(sampleRow).map(k => k.toLowerCase()).includes(field)
              )
          );

          if (missingFields.length > 0) {
            throw new Error(
              `Missing required fields: please ensure your template has Tran Date, Details, Withdrawal, Deposit columns.`
            );
          }

          resolve(jsonData);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileUpload = async (file) => {
    setError(null);
    setUploadResult(null);
    setParsedData(null);
    setIsProcessing(true);
    setUploadProgress(0);

    try {
      // Step 1: Parse the Excel file
      setUploadProgress(30);
      const transactions = await parseExcelFile(file);

      // Step 2: Transform and validate data
      setUploadProgress(60);
      const formattedTransactions = transactions.map((row, index) => {
        // Custom parser for Report1.xls format
        // Columns: Tran Date, Value Date, Reference, Details, Withdrawal, Deposit, Balance
        const dateCol = Object.keys(row).find(
          (key) => key.toLowerCase() === "tran date" || key.toLowerCase() === "date"
        );
        const descCol = Object.keys(row).find(
          (key) => key.toLowerCase() === "details" || key.toLowerCase() === "description"
        );
        const withdrawalCol = Object.keys(row).find(
          (key) => key.toLowerCase() === "withdrawal" || key.toLowerCase() === "debit"
        );
        const depositCol = Object.keys(row).find(
          (key) => key.toLowerCase() === "deposit" || key.toLowerCase() === "credit"
        );
        const refCol = Object.keys(row).find(
          (key) => key.toLowerCase() === "reference" || key.toLowerCase() === "ref"
        );
        const balanceCol = Object.keys(row).find(
          (key) => key.toLowerCase() === "balance"
        );

        // Convert string values with commas to float (e.g. "12,560.57" -> 12560.57)
        const parseAmount = (val) => {
          if (!val) return 0;
          if (typeof val === 'number') return val;
          return parseFloat(val.toString().replace(/,/g, '')) || 0;
        };

        const withdrawalAmt = parseAmount(row[withdrawalCol]);
        const depositAmt = parseAmount(row[depositCol]);
        const balanceAmt = parseAmount(row[balanceCol]);

        let type = "debit";
        let finalAmount = 0;
        
        if (depositAmt > 0) {
          finalAmount = depositAmt;
          type = "credit";
        } else if (withdrawalAmt > 0) {
          finalAmount = withdrawalAmt;
          type = "debit";
        } else {
           // Fallback for generic amount columns if they exist
           const amountCol = Object.keys(row).find((key) => key.toLowerCase() === "amount");
           if (amountCol) {
             const amt = parseAmount(row[amountCol]);
             finalAmount = Math.abs(amt);
             type = amt >= 0 ? "credit" : "debit";
           }
        }

        // Parse date properly - handle Excel serial dates and various formats
        let transactionDate = row[dateCol];
        if (!transactionDate) {
          transactionDate = new Date().toISOString().split("T")[0];
        } else {
          // Handle Excel serial date format (numbers)
          if (typeof transactionDate === 'number') {
            // Excel serial date: days since January 1, 1900
            const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
            const date = new Date(excelEpoch.getTime() + transactionDate * 24 * 60 * 60 * 1000);
            transactionDate = date.toISOString().split("T")[0];
          } else if (typeof transactionDate === 'string') {
            // Try to parse the date string
            const parsedDate = new Date(transactionDate);
            if (isNaN(parsedDate.getTime())) {
              transactionDate = new Date().toISOString().split("T")[0];
            } else {
              transactionDate = parsedDate.toISOString().split("T")[0];
            }
          } else if (transactionDate instanceof Date) {
            if (isNaN(transactionDate.getTime())) {
              transactionDate = new Date().toISOString().split("T")[0];
            } else {
              transactionDate = transactionDate.toISOString().split("T")[0];
            }
          } else {
            transactionDate = new Date().toISOString().split("T")[0];
          }
        }

        return {
          id: `bank_${index}`,
          date: transactionDate,
          description: row[descCol] || "Bank Transaction",
          amount: finalAmount,
          type: type,
          reference: row[refCol] || `REF${index}`,
          balance: balanceAmt,
          raw: row, 
        };
      }).filter(txn => txn.amount > 0 || txn.description !== "Bank Transaction"); // Ignore empty rows

      // Auto-extract date range from the data
      if (formattedTransactions.length > 0) {
        const dates = formattedTransactions.map(t => new Date(t.date).getTime()).filter(t => !isNaN(t));
        if (dates.length > 0) {
          const minDate = new Date(Math.min(...dates)).toISOString().split("T")[0];
          const maxDate = new Date(Math.max(...dates)).toISOString().split("T")[0];
          setStartDate(minDate);
          setEndDate(maxDate);
        }
      }

      setUploadProgress(100);
      setParsedData({
        transactions: formattedTransactions,
        rawData: transactions,
        totalRows: transactions.length,
      });
      setIsProcessing(false);
    } catch (err) {
      setError(err.message || "Failed to process file");
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const handleConfirmUpload = () => {
    if (!selectedAccount) {
      toast.error("Please select a bank account first");
      return;
    }

    if (!activeBusiness?.id) {
      toast.error("Business information not available");
      return;
    }

    if (!startDate) {
      toast.error("Please select a start date");
      return;
    }

    if (!endDate) {
      toast.error("Please select an end date");
      return;
    }

    if (parsedData && parsedData.transactions.length > 0) {
      setIsUploading(true);

      const payload = {
        bankAccountId: selectedAccount,
        facilityId: activeBusiness.id,
        startDate: startDate,
        endDate: endDate,
        transactions: parsedData.transactions.map((txn) => ({
          date: txn.date,
          description: txn.description,
          narration: txn.description,
          amount: txn.amount,
          type: txn.type,
          reference: txn.reference,
          debit: txn.type === "debit" ? txn.amount : 0,
          credit: txn.type === "credit" ? txn.amount : 0,
        })),
        uploadedBy: currentUser?.id || null,
      };

      _postApi(
        "/api/upload/bank-statement",
        payload,
        (res) => {
          if (res.success) {
            setUploadResult({
              totalTransactions: parsedData.totalRows,
              importedTransactions: parsedData.transactions.length,
              errors: [],
            });
            toast.success(
              res.message || "Bank statement uploaded successfully"
            );
            setIsUploading(false);
            // Clear form
            setStartDate("");
            setEndDate("");
            setParsedData(null);
            // Notify parent component that statement was uploaded
            if (onStatementUploaded) {
              onStatementUploaded();
            }
          } else {
            toast.error(res.message || "Failed to upload bank statement");
            setIsUploading(false);
          }
        },
        (err) => {
          console.error("Upload error:", err);
          toast.error("Error uploading bank statement");
          setIsUploading(false);
        }
      );
    }
  };

  const handleCancelPreview = () => {
    setParsedData(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    // Create template data based on Report1.xls
    const templateData = [
      {
        "Tran Date": "2026-01-31",
        "Value Date": "2026-01-31",
        "Reference": "",
        "Details": "Opening Balance",
        "Withdrawal": "",
        "Deposit": "",
        "Balance": "59253.40",
      },
      {
        "Tran Date": "2026-01-31",
        "Value Date": "2026-01-31",
        "Reference": "REF-001",
        "Details": "NIP FRM DALA FOODS NIGERIA LIMITED",
        "Withdrawal": "",
        "Deposit": "50000.00",
        "Balance": "109253.40",
      },
      {
        "Tran Date": "2026-02-01",
        "Value Date": "2026-02-01",
        "Reference": "CHG-102",
        "Details": "MAINT FEE FRM 31-jan-2026",
        "Withdrawal": "12560.57",
        "Deposit": "",
        "Balance": "96692.83",
      },
    ];

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bank Statements");

    // Generate Excel file and download
    XLSX.writeFile(wb, "Report1_Template.xlsx");
  };

  const clearResults = () => {
    setParsedData(null);
    setUploadResult(null);
    setError(null);
    setUploadProgress(0);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Bank Statement
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!parsedData ? (
            <>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging
                    ? "border-[var(--aa-navy,#0f2744)] bg-[var(--aa-sidebar-active,#eff4fb)]"
                    : "border-gray-300 hover:border-gray-400"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <FileText className="h-12 w-12 text-gray-400" />
                  </div>

                  <div>
                    <h3 className="text-lg font-medium">
                      Upload your bank statement
                    </h3>
                    <p className="text-gray-500 mt-1">
                      Drag and drop your Excel file here, or click to browse
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      Supports Excel files (.xlsx, .xls) and CSV files
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <label className="cursor-pointer">
                      <Button
                        className="flex items-center gap-2 border-0 bg-[var(--aa-navy,#0f2744)] text-white hover:bg-[var(--aa-navy,#0f2744)] hover:opacity-90"
                        onClick={() => inputRef.current.click()}
                      >
                        <Upload className="h-4 w-4" />
                        Choose File
                      </Button>
                      <input
                        type="file"
                        ref={inputRef}
                        className="hidden"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileInputChange}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Download Template Button */}
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
              </div>
            </>
          ) : (
            !uploadResult && (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Review the data below before uploading. Found{" "}
                    {parsedData.totalRows} transactions.
                  </AlertDescription>
                </Alert>

                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b">
                    <h4 className="font-medium">Preview Data (First 50 rows)</h4>
                    <p className="text-sm text-gray-600">
                      Total transactions: {parsedData.totalRows}
                    </p>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.transactions.slice(0, 50).map((txn, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-sm">{txn.date}</TableCell>
                            <TableCell className="max-w-xs truncate font-medium">
                              {txn.description}
                            </TableCell>
                            <TableCell className="text-right text-red-600 font-medium">
                              {txn.type === "debit" ? txn.amount.toLocaleString(undefined, {minimumFractionDigits: 2}) : ""}
                            </TableCell>
                            <TableCell className="text-right text-green-600 font-medium">
                              {txn.type === "credit" ? txn.amount.toLocaleString(undefined, {minimumFractionDigits: 2}) : ""}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">
                      {parsedData.transactions.length}
                    </span>{" "}
                    transactions ready to upload
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={clearResults}
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                    <Button
                      onClick={handleConfirmUpload}
                      disabled={isUploading}
                      className="flex items-center gap-2"
                    >
                      {isUploading ? (
                        <>
                          <Upload className="h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Confirm Upload
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )
          )}

          {/* Upload Progress */}
          {isProcessing && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing file...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert className="mt-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Results */}
          {uploadResult && (
            <div className="mt-4 space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  File processed successfully! Imported{" "}
                  {uploadResult.importedTransactions} transactions from{" "}
                  {uploadResult.totalTransactions} rows.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {uploadResult.importedTransactions}
                      </div>
                      <div className="text-sm text-gray-600">
                        Transactions Imported
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[var(--aa-navy,#0f2744)]">
                        {uploadResult.totalTransactions}
                      </div>
                      <div className="text-sm text-gray-600">Total Records</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {uploadResult.errors.length}
                      </div>
                      <div className="text-sm text-gray-600">Errors</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={clearResults}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BankStatementUpload;
