const XLSX = require('xlsx');
const path = require('path');
const filePath = path.resolve('src/components/pages/audit/bank-reconciliation/Report1.xls');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
console.log(JSON.stringify(data.slice(0, 5), null, 2));
