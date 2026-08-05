import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSelector } from 'react-redux';
import ExcelJS from 'exceljs';
import moment from 'moment';
import { Undo2, CheckCircle2, Download } from 'lucide-react';

const MatchedList = ({ matchedPairs, onUndo, bankAccount }) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  const handleExport = async () => {
    if (!matchedPairs || matchedPairs.length === 0) return;

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Matched Transactions");

    // Set column widths
    worksheet.columns = [
      { width: 30 }, // Column A - Account hierarchy
      { width: 12 }, // Column B - Date
      { width: 15 }, // Column C - Num (Ref.)
      { width: 50 }, // Column D - Memo/Description
      { width: 18 }, // Column E - Debit
      { width: 18 }, // Column F - Credit
      { width: 18 }, // Column G - Balance
    ];

    // Define styles
    const borderStyle = {
      top: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    };

    const headerStyle = {
      font: { bold: true, size: 11, color: { argb: "FFFFFFFF" } },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4B5563" }, // gray-600
      },
      alignment: { vertical: "middle", horizontal: "center" },
      border: borderStyle,
    };

    const headerStyleNoRightBorder = {
      ...headerStyle,
      border: {
        ...borderStyle,
        right: { style: "none" },
      },
    };

    const titleStyle = {
      font: { bold: true, size: 14 },
      alignment: { vertical: "middle", horizontal: "center" },
    };

    const accountNameStyle = {
      font: { bold: true },
      alignment: { vertical: "middle", horizontal: "left" },
      border: borderStyle,
    };

    const dataStyle = {
      alignment: { vertical: "middle", horizontal: "left" },
      border: borderStyle,
    };

    const numberStyle = {
      alignment: { vertical: "middle", horizontal: "right" },
      border: borderStyle,
      numFmt: "#,##0.00",
    };

    const numberStyleNoRightBorder = {
      ...numberStyle,
      border: {
        ...borderStyle,
        right: { style: "none" },
      },
    };

    const boldStyle = {
      font: { bold: true },
      border: borderStyle,
    };

    let currentRow = 1;

    // Row 1: Business Name
    const businessNameCell = worksheet.getCell(currentRow, 3);
    businessNameCell.value = activeBusiness?.business_name || activeBusiness?.name || "Business Name";
    businessNameCell.style = titleStyle;
    worksheet.mergeCells(currentRow, 3, currentRow, 7);
    currentRow++;

    // Row 2: RC Number
    if (activeBusiness?.rc) {
      const rcCell = worksheet.getCell(currentRow, 3);
      rcCell.value = `RC. ${activeBusiness.rc}`;
      rcCell.style = { ...titleStyle, font: { ...titleStyle.font, size: 11 } };
      worksheet.mergeCells(currentRow, 3, currentRow, 7);
      currentRow++;
    }

    // Row 3: Address
    if (activeBusiness?.business_address) {
      const addressCell = worksheet.getCell(currentRow, 3);
      addressCell.value = activeBusiness.business_address;
      addressCell.style = { ...titleStyle, font: { ...titleStyle.font, size: 10 } };
      worksheet.mergeCells(currentRow, 3, currentRow, 7);
      currentRow++;
    }

    // Row 4: Contact Info
    const contactInfo = [];
    if (activeBusiness?.business_phone) contactInfo.push(`Tel: ${activeBusiness.business_phone}`);
    if (activeBusiness?.business_email) contactInfo.push(`Email: ${activeBusiness.business_email}`);
    if (contactInfo.length > 0) {
      const contactCell = worksheet.getCell(currentRow, 3);
      contactCell.value = contactInfo.join(" | ");
      contactCell.style = { ...titleStyle, font: { ...titleStyle.font, size: 10 } };
      worksheet.mergeCells(currentRow, 3, currentRow, 7);
      currentRow++;
    }

    currentRow++; // Empty row

    // Row: Report Title
    const reportTitleCell = worksheet.getCell(currentRow, 3);
    reportTitleCell.value = "BANK RECONCILIATION - MATCHED TRANSACTIONS";
    reportTitleCell.style = { ...titleStyle, font: { bold: true, size: 12 } };
    worksheet.mergeCells(currentRow, 3, currentRow, 7);
    currentRow++;

    // Row: Period
    const dates = matchedPairs.map(p => new Date(p.bankTransaction?.date || p.matchedDate)).filter(d => !isNaN(d));
    const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : new Date();
    const maxDate = dates.length > 0 ? new Date(Math.max(...dates)) : new Date();
    
    const periodCell = worksheet.getCell(currentRow, 3);
    periodCell.value = `Period: ${moment(minDate).format("DD/MM/YYYY")} - ${moment(maxDate).format("DD/MM/YYYY")}`;
    periodCell.style = { ...titleStyle, font: { ...titleStyle.font, size: 11 } };
    worksheet.mergeCells(currentRow, 3, currentRow, 7);
    currentRow++;

    // Row: Generated Date
    const genDateCell = worksheet.getCell(currentRow, 3);
    genDateCell.value = `Date: ${moment().format("dddd, DD MMMM YYYY hh:mm A [GMT]Z")}`;
    genDateCell.style = { ...titleStyle, font: { ...titleStyle.font, size: 10 } };
    worksheet.mergeCells(currentRow, 3, currentRow, 7);
    currentRow++;

    currentRow++; // Empty row

    // Header Row
    const headers = ["", "DATE", "REF.", "MEMO/DESCRIPTION", "DEBIT", "CREDIT", "BALANCE"];
    headers.forEach((header, colIndex) => {
      const cell = worksheet.getCell(currentRow, colIndex + 1);
      cell.value = header;
      if (colIndex > 0) {
        if (colIndex === 6) {
          cell.style = headerStyleNoRightBorder;
          cell.style.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF6B7280" },
          };
        } else {
          cell.style = headerStyle;
        }
      }
    });
    currentRow++;

    // Grouped data rows
    const groupedByAccount = matchedPairs.reduce((acc, match) => {
      const accountName = match.inAppTransaction?.account_description || 'Other Matches';
      const accountCode = match.inAppTransaction?.account_code || match.inAppTransaction?.account_subhead || '';
      const key = `${accountCode} ${accountName}`.trim();
      if (!acc[key]) acc[key] = [];
      acc[key].push(match);
      return acc;
    }, {});

    // Add Bank Account Sub-header first
    if (bankAccount) {
      const bankHeaderCell = worksheet.getCell(currentRow, 1);
      bankHeaderCell.value = `Bank - ${bankAccount.account_name} (A/C: ${bankAccount.account_number})`;
      bankHeaderCell.style = accountNameStyle;
      currentRow++;
    }

    Object.keys(groupedByAccount).forEach(accountKey => {
      const catCell = worksheet.getCell(currentRow, 1);
      catCell.value = accountKey;
      catCell.style = accountNameStyle;
      currentRow++;

      let runningBalance = 0;
      const begBalRow = worksheet.getRow(currentRow);
      begBalRow.getCell(4).value = "Beginning Balance";
      begBalRow.getCell(4).style = { ...boldStyle, ...dataStyle };
      begBalRow.getCell(7).value = runningBalance;
      begBalRow.getCell(7).style = { ...numberStyleNoRightBorder, font: { bold: true } };
      [1, 2, 3, 5, 6].forEach(col => begBalRow.getCell(col).style = dataStyle);
      currentRow++;

      groupedByAccount[accountKey].forEach(match => {
        const transRow = worksheet.getRow(currentRow);
        const dr = match.inAppTransaction?.type === 'credit' ? Math.abs(match.inAppTransaction?.amount || 0) : 0;
        const cr = match.inAppTransaction?.type === 'debit' ? Math.abs(match.inAppTransaction?.amount || 0) : 0;
        runningBalance = runningBalance + dr - cr;

        transRow.getCell(2).value = match.bankTransaction?.date || match.matchedDate || '';
        transRow.getCell(3).value = match.bankTransaction?.reference || match.inAppTransaction?.reference || '';
        transRow.getCell(4).value = match.bankTransaction?.description || match.inAppTransaction?.description || '';
        transRow.getCell(5).value = dr > 0 ? dr : '';
        transRow.getCell(6).value = cr > 0 ? cr : '';
        transRow.getCell(7).value = runningBalance;

        transRow.getCell(1).style = dataStyle;
        transRow.getCell(2).style = dataStyle;
        transRow.getCell(3).style = dataStyle;
        transRow.getCell(4).style = dataStyle;
        transRow.getCell(5).style = numberStyle;
        transRow.getCell(6).style = numberStyle;
        transRow.getCell(7).style = { ...numberStyleNoRightBorder, font: { bold: true } };
        currentRow++;
      });

      const totalRow = worksheet.getRow(currentRow);
      const totalDr = groupedByAccount[accountKey].reduce((sum, m) => sum + (m.inAppTransaction?.type === 'credit' ? Math.abs(m.inAppTransaction?.amount || 0) : 0), 0);
      const totalCr = groupedByAccount[accountKey].reduce((sum, m) => sum + (m.inAppTransaction?.type === 'debit' ? Math.abs(m.inAppTransaction?.amount || 0) : 0), 0);
      
      totalRow.getCell(4).value = `Total for ${accountKey}`;
      totalRow.getCell(4).style = { ...boldStyle, ...dataStyle };
      totalRow.getCell(5).value = totalDr;
      totalRow.getCell(5).style = { ...boldStyle, ...numberStyle };
      totalRow.getCell(6).value = totalCr;
      totalRow.getCell(6).style = { ...boldStyle, ...numberStyle };
      totalRow.getCell(7).value = runningBalance;
      totalRow.getCell(7).style = { ...boldStyle, ...numberStyleNoRightBorder };
      [1, 2, 3].forEach(col => totalRow.getCell(col).style = dataStyle);
      currentRow++;
      currentRow++; // Spacer
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Matched_Transactions_${businessNameCell.value}_${moment().format("YYYY-MM-DD")}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  if (!matchedPairs || matchedPairs.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Matched Transactions (0)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No matched transactions yet. Match transactions in the Matching tab to see them here.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Matched Transactions ({matchedPairs.length})
        </CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExport}
          className="gap-2 border-green-200 text-green-700 hover:bg-green-50"
        >
          <Download className="h-4 w-4" />
          Export to Excel
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Match Date</TableHead>
                <TableHead>Bank Transaction</TableHead>
                <TableHead>Bank Date</TableHead>
                <TableHead>Bank Amount</TableHead>
                <TableHead>Ledger Transaction</TableHead>
                <TableHead>Ledger Date</TableHead>
                <TableHead>Ledger Amount</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matchedPairs.map((match) => (
                <TableRow key={match.id} className="bg-green-50">
                  <TableCell className="text-sm">
                    {match.matchedDate ? new Date(match.matchedDate).toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="font-medium text-gray-900">
                      {match.bankTransaction?.description || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Ref: {match.bankTransaction?.reference || 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {match.bankTransaction?.date || 'N/A'}
                  </TableCell>
                  <TableCell className={`font-semibold ${
                    match.bankTransaction?.type === "credit" ? "text-green-600" : "text-red-600"
                  }`}>
                    {match.bankTransaction?.type === "credit" ? "+" : "-"}
                    {Math.abs(match.bankTransaction?.amount || 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="font-medium text-gray-900">
                      {match.inAppTransaction?.description || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Ref: {match.inAppTransaction?.reference || 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {match.inAppTransaction?.date || 'N/A'}
                  </TableCell>
                  <TableCell className={`font-semibold ${
                    match.inAppTransaction?.type === "credit" ? "text-green-600" : "text-red-600"
                  }`}>
                    {match.inAppTransaction?.type === "credit" ? "+" : "-"}
                    {Math.abs(match.inAppTransaction?.amount || 0).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      onClick={() => onUndo(match.id)}
                      size="sm"
                      variant="outline"
                      className="gap-1"
                    >
                      <Undo2 className="h-4 w-4" />
                      Undo
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default MatchedList;
