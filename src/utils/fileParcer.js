



export class FileParser {
  static async parseFile(file) {
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.csv')) {
      return this.parseCSV(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return this.parseExcel(file);
    } else if (fileName.endsWith('.pdf')) {
      return this.parsePDF(file);
    } else {
      throw new Error('Unsupported file format. Please upload CSV, Excel, or PDF files.');
    }
  }

  static async parseCSV(file) {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    const transactions = [];
    const errors = [];

    // Skip header row if it exists
    const dataLines = lines.slice(1);

    dataLines.forEach((line, index) => {
      try {
        const columns = this.parseCSVLine(line);
        
        if (columns.length >= 4) {
          const transaction = this.mapColumnsToTransaction(columns, index + 2);
          if (transaction) {
            transactions.push(transaction);
          }
        } else {
          errors.push(`Row ${index + 2}: Insufficient columns`);
        }
      } catch (error) {
        errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Parse error'}`);
      }
    });

    return {
      transactions,
      errors,
      metadata: {
        fileName: file.name,
        totalRows: lines.length,
        parsedRows: transactions.length,
        format: 'csv'
      }
    };
  }

  static parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  static async parseExcel(file) {
    // For Excel parsing, we'll simulate the functionality
    // In a real implementation, you'd use a library like xlsx
    const transactions = [];
    const errors = [];

    // Simulated Excel parsing
    const sampleData = [
      ['2024-06-30', 'PAYROLL DEPOSIT', '5250.00', 'credit', 'PAY001'],
      ['2024-06-29', 'OFFICE SUPPLIES', '-340.50', 'debit', 'CHK001'],
      ['2024-06-28', 'RENT PAYMENT', '-2500.00', 'debit', 'ACH002']
    ];

    sampleData.forEach((row, index) => {
      try {
        const transaction = this.mapColumnsToTransaction(row, index + 1);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
      }
    });

    return {
      transactions,
      errors,
      metadata: {
        fileName: file.name,
        totalRows: sampleData.length,
        parsedRows: transactions.length,
        format: 'excel'
      }
    };
  }

  static async parsePDF(file) {
    // For PDF parsing, we'll simulate the functionality
    // In a real implementation, you'd use a library like pdf-parse
    const transactions = [];
    const errors = [];

    // Simulated PDF parsing
    const sampleData = [
      ['2024-06-30', 'WIRE TRANSFER IN', '10000.00', 'credit', 'WIRE001'],
      ['2024-06-29', 'BANK FEE', '-25.00', 'debit', 'FEE001']
    ];

    sampleData.forEach((row, index) => {
      try {
        const transaction = this.mapColumnsToTransaction(row, index + 1);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
      }
    });

    return {
      transactions,
      errors,
      metadata: {
        fileName: file.name,
        totalRows: sampleData.length,
        parsedRows: transactions.length,
        format: 'pdf'
      }
    };
  }

  static mapColumnsToTransaction(columns, rowNumber) {
    try {
      // Assuming column order: Date, Description, Amount, Type, Reference
      const [dateStr, description, amountStr, typeStr, reference] = columns;

      if (!dateStr || !description || !amountStr) {
        return null;
      }

      const amount = parseFloat(amountStr.replace(/[,$]/g, ''));
      const type = (typeStr?.toLowerCase() === 'credit') ? 'credit' : 'debit';

      return {
        id: `imported_${Date.now()}_${rowNumber}`,
        date: dateStr,
        description: description.trim(),
        amount: Math.abs(amount),
        type,
        reference: reference || `REF${rowNumber}`
      };
    } catch (error) {
      return null;
    }
  }
}
