# HR Module for Inventria System

A comprehensive Human Resources Management System integrated with the Inventria ERP platform.

## Features

### 🏢 Employee Management

- **Employee Registration**: Complete employee profiles with personal, employment, and emergency contact information
- **Employee Directory**: Searchable and filterable employee list with department and status filters
- **Employee Records**: Detailed employee profiles with job history and promotion tracking
- **Status Management**: Active, Inactive, Terminated, and On Leave status tracking

### 📅 Leave Management

- **Leave Types**: Annual, Sick, Maternity, Paternity, Emergency, Study, and Unpaid leave
- **Leave Application**: Self-service leave request system with balance checking
- **Approval Workflow**: Manager and HR approval process with notifications
- **Leave Balance Tracking**: Automatic accrual and usage tracking
- **Leave Reports**: Comprehensive leave utilization reports

### 💰 Payroll Management

- **Salary Structures**: Flexible salary configuration with allowances and deductions
- **Payroll Processing**: Monthly payroll generation with automatic calculations
- **Payslip Generation**: PDF payslips with detailed breakdown
- **Accounting Integration**: Automatic journal entries for General Ledger
- **PAYE & Pension**: Automatic tax and pension calculations

### ⏰ Attendance Management

- **Clock In/Out**: Digital time tracking system
- **Manual Entry**: HR can manually enter attendance records
- **Overtime Tracking**: Automatic overtime calculation
- **Attendance Reports**: Monthly and custom period reports
- **Compliance Monitoring**: Attendance rate tracking and alerts

### 📊 Performance Management

- **Performance Reviews**: Quarterly and annual review cycles
- **KPI Tracking**: Customizable key performance indicators
- **Rating System**: 1-5 scale rating with manager and self-review
- **Promotion Recommendations**: Performance-based promotion suggestions
- **Analytics Dashboard**: Performance trends and department comparisons

## Database Schema

### Core Tables

#### employees

```sql
- id (UUID, PK)
- employeeId (String, Unique)
- userId (UUID, FK to users)
- facilityId (UUID)
- firstName, lastName (String)
- gender (ENUM: Male, Female, Other)
- dateOfBirth (Date)
- contactInfo (String)
- address (Text)
- nationalId (String)
- bankAccount (String)
- photoUrl (String)
- departmentId (Integer, FK to Departments)
- designation (String)
- hireDate (Date)
- contractType (ENUM: Permanent, Contract, Intern, Part-time)
- salaryStructureId (UUID, FK to salary_structures)
- status (ENUM: Active, Inactive, Terminated, On Leave)
- emergencyContact, emergencyPhone (String)
- nextOfKin, nextOfKinPhone (String)
- createdBy, updatedBy (UUID)
- timestamps
```

#### salary_structures

```sql
- id (UUID, PK)
- structureName (String)
- structureCode (String, Unique)
- facilityId (UUID)
- basicSalary (Decimal)
- allowances (JSON)
- deductions (JSON)
- overtimeRate (Decimal)
- payeRate (Decimal)
- pensionRate (Decimal)
- status (ENUM: Active, Inactive)
- description (Text)
- createdBy, updatedBy (UUID)
- timestamps
```

#### leaves

```sql
- id (UUID, PK)
- employeeId (UUID, FK to employees)
- facilityId (UUID)
- leaveType (ENUM: Annual, Sick, Maternity, Paternity, Unpaid, Emergency, Study)
- startDate, endDate (Date)
- totalDays (Integer)
- reason (Text)
- status (ENUM: Pending, Approved, Rejected, Cancelled)
- approverId (UUID, FK to users)
- approvedAt (Date)
- rejectionReason (Text)
- attachmentUrl (String)
- createdBy, updatedBy (UUID)
- timestamps
```

#### payroll

```sql
- id (UUID, PK)
- employeeId (UUID, FK to employees)
- facilityId (UUID)
- month, year (Integer)
- basicSalary, allowances, overtime, deductions (Decimal)
- loanRepayment, paye, pension (Decimal)
- netPay, grossPay (Decimal)
- payslipUrl (String)
- status (ENUM: Draft, Processed, Paid, Cancelled)
- processedAt, paidAt (Date)
- workingDays, presentDays (Integer)
- overtimeHours (Decimal)
- createdBy, updatedBy (UUID)
- timestamps
```

#### attendance

```sql
- id (UUID, PK)
- employeeId (UUID, FK to employees)
- facilityId (UUID)
- date (Date)
- clockInTime, clockOutTime (Time)
- totalHours, overtimeHours (Decimal)
- status (ENUM: Present, Absent, Late, Half Day, On Leave)
- remarks (Text)
- isManualEntry (Boolean)
- approvedBy (UUID, FK to users)
- approvedAt (Date)
- createdBy, updatedBy (UUID)
- timestamps
```

#### performance

```sql
- id (UUID, PK)
- employeeId (UUID, FK to employees)
- facilityId (UUID)
- period (String)
- periodType (ENUM: Quarterly, Annual, Monthly)
- kpiScores (JSON)
- overallRating (Integer, 1-5)
- selfRating, managerRating (Integer, 1-5)
- comments, managerComments (Text)
- goals, achievements, improvementAreas (JSON)
- status (ENUM: Draft, Self Review, Manager Review, Completed, Cancelled)
- reviewedBy (UUID, FK to users)
- reviewedAt (Date)
- promotionRecommendation (Boolean)
- salaryAdjustmentRecommendation (Decimal)
- createdBy, updatedBy (UUID)
- timestamps
```

## API Endpoints

### Employee Management

```
POST   /api/hr/employees              - Create employee
GET    /api/hr/employees              - Get all employees
GET    /api/hr/employees/:id          - Get employee by ID
PUT    /api/hr/employees/:id          - Update employee
DELETE /api/hr/employees/:id          - Deactivate employee
GET    /api/hr/employees/:id/promotion-history - Get promotion history
PUT    /api/hr/employees/:id/promotion - Update promotion
```

### Leave Management

```
POST   /api/hr/leaves                 - Apply for leave
GET    /api/hr/leaves                 - Get all leaves
PUT    /api/hr/leaves/:id/approve     - Approve leave
PUT    /api/hr/leaves/:id/reject      - Reject leave
PUT    /api/hr/leaves/:id/cancel      - Cancel leave
GET    /api/hr/leaves/balance/:employeeId - Get leave balance
```

### Payroll Management

```
POST   /api/hr/payroll/run            - Run payroll
GET    /api/hr/payroll/:month/:year   - Get payroll by month
GET    /api/hr/payroll/payslip/:id    - Get payslip
PUT    /api/hr/payroll/mark-paid      - Mark payroll as paid
GET    /api/hr/payroll/accounting/:month/:year - Get accounting summary
POST   /api/hr/payroll/reverse/:month/:year - Reverse payroll entries
```

### Attendance Management

```
POST   /api/hr/attendance/clock-in    - Clock in
POST   /api/hr/attendance/clock-out   - Clock out
GET    /api/hr/attendance/report      - Get attendance report
POST   /api/hr/attendance/manual      - Manual attendance entry
PUT    /api/hr/attendance/:id/approve - Approve attendance
```

### Performance Management

```
POST   /api/hr/performance            - Create performance review
GET    /api/hr/performance            - Get performance reviews
GET    /api/hr/performance/:id        - Get performance review by ID
PUT    /api/hr/performance/:id/self-review - Update self review
PUT    /api/hr/performance/:id/manager-review - Manager review
GET    /api/hr/performance/analytics  - Get performance analytics
```

## Frontend Components

### Main Components

- **HRModule.jsx** - Main HR module container with navigation
- **HRDashboard.jsx** - Dashboard with statistics and quick actions
- **EmployeeList.jsx** - Employee directory with search and filters
- **EmployeeForm.jsx** - Add/Edit employee form
- **LeaveRequestForm.jsx** - Leave application form
- **PayrollRun.jsx** - Payroll processing interface
- **AttendanceClock.jsx** - Clock in/out interface

### Key Features

- **Responsive Design** - Mobile-friendly interface
- **Real-time Updates** - Live data updates
- **Search & Filtering** - Advanced search capabilities
- **Data Validation** - Client-side form validation
- **Error Handling** - Comprehensive error management
- **Loading States** - User feedback during operations

## Accounting Integration

### Automatic Journal Entries

When payroll is processed, the system automatically creates journal entries:

1. **Debit Salary Expense Account** - Total gross pay
2. **Credit Bank Account** - Net pay amount
3. **Credit PAYE Tax Payable** - Tax deductions
4. **Credit Pension Payable** - Pension contributions
5. **Credit Other Deductions Payable** - Other deductions

### Chart of Accounts Integration

The HR module integrates with the existing chart of accounts:

- `SALARY_EXPENSE` - Salary expense account
- `BANK_ACCOUNT` - Main bank account
- `PAYE_PAYABLE` - PAYE tax payable
- `PENSION_PAYABLE` - Pension contributions payable
- `OTHER_DEDUCTIONS_PAYABLE` - Other deductions payable

## Installation & Setup

### Backend Setup

1. The HR models are automatically loaded by the existing models index
2. HR routes are registered in `app.js`
3. Controllers handle all business logic
4. Database migrations will create the required tables

### Frontend Setup

1. Import HR components into your main application
2. Add HR routes to your routing system
3. Configure API endpoints to point to your backend
4. Set up authentication for HR module access

### Configuration

1. **Salary Structures**: Configure salary structures for different employee categories
2. **Leave Policies**: Set up leave accrual rules and limits
3. **Department Mapping**: Ensure departments are properly configured
4. **Chart of Accounts**: Verify accounting account codes are set up

## Security & Permissions

### Role-Based Access Control

- **HR Manager**: Full access to all HR functions
- **HR Staff**: Limited access to employee management and leave approval
- **Managers**: Access to team performance reviews and leave approval
- **Employees**: Self-service access to leave requests and payslips

### Data Protection

- All sensitive data is encrypted
- Audit trails for all HR actions
- Secure file uploads for documents
- Role-based data access restrictions

## Reporting & Analytics

### Available Reports

1. **Employee Directory Report** - Complete employee listing
2. **Payroll Summary Report** - Monthly payroll breakdown
3. **Leave Utilization Report** - Leave usage by employee/department
4. **Attendance Compliance Report** - Attendance rates and trends
5. **Performance Analytics** - Performance trends and insights

### Export Options

- CSV export for data analysis
- PDF reports for official documentation
- Excel integration for advanced reporting

## Future Enhancements

### Planned Features

1. **Biometric Integration** - Fingerprint/face recognition for attendance
2. **Mobile App** - Native mobile application for employees
3. **Advanced Analytics** - AI-powered insights and predictions
4. **Document Management** - Centralized document storage
5. **Workflow Automation** - Automated approval workflows
6. **Integration APIs** - Third-party system integrations

### Scalability Considerations

- Database indexing for large datasets
- Caching for frequently accessed data
- Microservices architecture for high availability
- Cloud deployment options

## Support & Maintenance

### Troubleshooting

- Check database connections and table structures
- Verify API endpoint configurations
- Review authentication and authorization settings
- Monitor error logs for debugging

### Regular Maintenance

- Database cleanup and optimization
- Performance monitoring and tuning
- Security updates and patches
- Backup and disaster recovery procedures

## License

This HR module is part of the Inventria ERP system and follows the same licensing terms.

---

For technical support or feature requests, please contact the development team or create an issue in the project repository.

