# Payslip System with React PDF

This system provides professional payslip generation using React PDF, based on your HTML template design.

## 🚀 Features

- **Professional Design**: Matches your original HTML template exactly
- **React PDF Integration**: Generates PDF documents in the browser
- **Flexible Data Structure**: Easy to integrate with existing payroll data
- **Preview & Download**: Both preview and download functionality
- **Responsive Design**: Works on all screen sizes
- **Customizable**: Easy to modify company info, employee data, and styling

## 📁 Files Created

### Core Components

- `src/components/common/PayslipPDF.jsx` - Main PDF document component
- `src/components/common/PayslipGenerator.jsx` - Wrapper with download/preview functionality
- `src/components/pages/hr/PayslipDemo.jsx` - Demo component with form inputs
- `src/components/pages/hr/PayslipIntegration.jsx` - Integration with existing payroll API

## 🎯 Usage

### Basic Usage

```jsx
import PayslipGenerator from "../common/PayslipGenerator";

const MyComponent = () => {
  const payslipData = {
    employeeName: "John Doe",
    employeeNumber: "EMP001",
    department: "IT Department",
    position: "Software Developer",
    basicSalary: 50000,
    allowances: {
      transportAllowance: 15000,
      medicalAllowance: 3000,
      // ... other allowances
    },
    deductions: {
      paye: 7500,
      pension: 4000,
      // ... other deductions
    },
    overtime: 0,
    lateness: 0,
    daysAbsent: 0,
  };

  const companyInfo = {
    companyName: "YOUR COMPANY LTD.",
    address: "Your Company Address",
  };

  return (
    <PayslipGenerator
      payslipData={payslipData}
      companyInfo={companyInfo}
      month="December"
      year="2024"
    />
  );
};
```

### Integration with Existing Payroll API

```jsx
import PayslipIntegration from "../pages/hr/PayslipIntegration";

const PayrollPage = () => {
  return (
    <PayslipIntegration
      employeeId="emp-123"
      month="December"
      year="2024"
      facilityId="facility-456"
    />
  );
};
```

## 📊 Data Structure

### Payslip Data Format

```javascript
const payslipData = {
  // Employee Information
  employeeName: "string",
  employeeNumber: "string",
  department: "string",
  position: "string",

  // Salary Information
  basicSalary: number,
  overtime: number,

  // Allowances (all optional)
  allowances: {
    additionalEarnings: number,
    incrementArrears: number,
    transportAllowance: number,
    travelAllowance: number,
    inconvenienceAllowance: number,
    leaveAllowance: number,
    medicalAllowance: number,
    bonus: number,
  },

  // Deductions (all optional)
  deductions: {
    loanDeduction: number,
    paye: number,
    securityDeposit: number,
    pension: number,
    other: number,
  },

  // Attendance
  lateness: number,
  daysAbsent: number,
};
```

### Company Info Format

```javascript
const companyInfo = {
  companyName: "string",
  address: "string (supports line breaks with \\n)",
};
```

## 🎨 Customization

### Styling

The PDF styling is defined in the `styles` object in `PayslipPDF.jsx`. You can modify:

- Colors (company blue: `#2c5aa0`)
- Fonts (currently using Arial)
- Layout and spacing
- Table designs

### Adding New Fields

1. Add the field to the data structure
2. Add the field to the PDF template in `PayslipPDF.jsx`
3. Update the form in `PayslipDemo.jsx` if needed

### Company Branding

Update the `companyInfo` object with your company details:

- Company name
- Address
- Logo (can be added to the header)

## 🔧 API Integration

The system is designed to work with your existing payroll API. The `PayslipIntegration` component shows how to:

1. Fetch payroll data from your API
2. Transform the data to match the payslip format
3. Handle loading and error states
4. Generate payslips for specific employees

### Required API Endpoints

```javascript
// Fetch payslip data for an employee
GET /api/hr/payroll/payslip/:employeeId?month=12&year=2024&facilityId=xxx

// Fetch company information
GET /api/settings/company/:facilityId
```

## 📱 Features

### Download Functionality

- Generates PDF files with proper naming: `payslip-EMP001-December-2024.pdf`
- Uses React PDF's `PDFDownloadLink` component
- Shows loading state during generation

### Preview Functionality

- Full-screen PDF preview using `PDFViewer`
- Modal overlay with close functionality
- Responsive design for different screen sizes

### Error Handling

- Graceful error handling for API failures
- Fallback to default data when needed
- User-friendly error messages

## 🚀 Getting Started

1. **Install Dependencies** (already done)

   ```bash
   npm install @react-pdf/renderer
   ```

2. **Import Components**

   ```jsx
   import PayslipGenerator from "../common/PayslipGenerator";
   ```

3. **Use in Your Component**
   ```jsx
   <PayslipGenerator
     payslipData={yourData}
     companyInfo={yourCompanyInfo}
     month="December"
     year="2024"
   />
   ```

## 🎯 Integration Points

### With Payroll System

- Integrates with existing payroll processing
- Uses same data structure as your payroll API
- Supports all existing salary components

### With HR System

- Employee information from HR database
- Department and position data
- Attendance records integration

### With Accounting System

- Journal entries for salary payments
- Tax calculations (PAYE, Pension)
- Financial reporting integration

## 🔍 Testing

Use the `PayslipDemo` component to test different scenarios:

- Different salary amounts
- Various allowance combinations
- Different deduction scenarios
- Company information customization

## 📈 Future Enhancements

- **Bulk Generation**: Generate payslips for multiple employees
- **Email Integration**: Send payslips via email
- **Digital Signatures**: Add digital signature support
- **Multi-language**: Support for different languages
- **Custom Templates**: Multiple payslip templates
- **Print Optimization**: Better print formatting

## 🐛 Troubleshooting

### Common Issues

1. **PDF not generating**: Check if all required data is provided
2. **Styling issues**: Verify font registration and style definitions
3. **API integration**: Ensure API endpoints return correct data format
4. **Performance**: Large datasets may take time to generate

### Debug Mode

Add console logs to track data flow:

```javascript
console.log("Payslip Data:", payslipData);
console.log("Company Info:", companyInfo);
```

## 📞 Support

For issues or questions:

1. Check the console for error messages
2. Verify data structure matches expected format
3. Test with the demo component first
4. Check API integration points

---

**Note**: This system is fully integrated with your existing payroll system and maintains the exact design of your original HTML template while providing modern React PDF functionality.
