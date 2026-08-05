# Production Automation Setup Guide

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd aa_erp_api
npm install
npm start
```

### 2. Frontend Setup

```bash
cd aa_erp_ui
npm install
npm run dev
```

### 3. Database Setup

Run the SQL commands from `PRODUCTION_AUTOMATION_README.md` to create the required tables.

## 📋 Pre-requisites

### Required Tables

- `materials` - Raw material inventory
- `production_orders` - Production work orders
- `finished_goods` - Finished product inventory
- `bill_of_materials` - Product recipes
- `bill_of_material_items` - BOM line items
- `purchase_orders` - Purchase orders
- `purchase_order_items` - PO line items
- `goods_received_notes` - Material receipts
- `grn_items` - GRN line items
- `material_issuances` - Material consumption
- `finished_good_transfers` - Product transfers
- `finished_good_dispatches` - Product sales
- `suppliersinfo` - Supplier master data

### Required UI Components

All UI components are already available in `/src/components/ui/`:

- ✅ `card.jsx`
- ✅ `button.jsx`
- ✅ `input.jsx`
- ✅ `label.jsx`
- ✅ `select.jsx`
- ✅ `textarea.jsx`
- ✅ `table.jsx`
- ✅ `badge.jsx`
- ✅ `tabs.jsx`
- ✅ `progress.jsx`

## 🔧 Configuration

### 1. Facility ID

Update the `facilityId` in `ProductionAutomation.jsx`:

```javascript
const [facilityId] = useState("your-facility-id-here");
```

### 2. API Base URL

Ensure your frontend is configured to call the correct API endpoint:

```javascript
// In your axios configuration
const API_BASE_URL = "http://localhost:3000/inventria_new";
```

### 3. User Authentication

Update the `createdBy` field in forms to use actual user data:

```javascript
const [formData, setFormData] = useState({
  createdBy: getCurrentUserId(), // Replace with actual user ID
  // ... other fields
});
```

## 🧪 Testing

### Run Test Suite

```bash
cd aa_erp_api
node test-production-automation.js
```

### Manual Testing Checklist

- [ ] Create a material
- [ ] Create a purchase order
- [ ] Receive goods (GRN)
- [ ] Create a bill of materials
- [ ] Create a production order
- [ ] Update production progress
- [ ] Add finished goods
- [ ] Generate COGM report
- [ ] Generate inventory valuation report

## 📊 Features Overview

### 1. Procurement Management

- **Purchase Orders**: Create and manage PO workflow
- **Goods Received Notes**: Record material receipts
- **Supplier Management**: Track vendor information
- **Material Inventory**: Real-time stock monitoring

### 2. Production Management

- **Bill of Materials**: Define product recipes
- **Production Orders**: Schedule and track work orders
- **Shop Floor Tracking**: Real-time production progress
- **Material Issuance**: Track material consumption

### 3. Inventory Management

- **Finished Goods**: Manage end products
- **Batch Tracking**: Full traceability
- **Warehouse Management**: Location tracking
- **Transfer Management**: Internal movements

### 4. Reporting & Analytics

- **COGM Reports**: Cost of Goods Manufactured
- **COGS Reports**: Cost of Goods Sold
- **Inventory Valuation**: FIFO/LIFO/WAC methods
- **Production Efficiency**: Performance metrics
- **Tax Compliance**: FIRS reports

## 🔐 Security & Access Control

### Role-Based Access

The system respects the existing access control:

- `manufacturing` - Full access to all features
- `recycling` - Access to relevant features
- `services` - Limited access
- `retailers` - Limited access

### Data Segregation

All data is segregated by `facilityId` to ensure multi-tenant security.

## 📈 Performance Optimization

### Database Indexes

Ensure these indexes exist for optimal performance:

```sql
-- Materials
CREATE INDEX idx_materials_facility_id ON materials(facility_id);
CREATE INDEX idx_materials_supplier_id ON materials(supplier_id);

-- Production Orders
CREATE INDEX idx_production_orders_facility_id ON production_orders(facility_id);
CREATE INDEX idx_production_orders_status ON production_orders(status);

-- Purchase Orders
CREATE INDEX idx_purchase_orders_facility_id ON purchase_orders(facility_id);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_number);
```

### Caching Strategy

- Material master data can be cached
- Supplier information can be cached
- BOM data can be cached for frequently used products

## 🚨 Troubleshooting

### Common Issues

#### 1. "Cannot find module" errors

```bash
# Reinstall dependencies
npm install
```

#### 2. Database connection errors

- Check database credentials
- Ensure all tables are created
- Verify foreign key relationships

#### 3. API endpoint not found

- Check if routes are properly registered in `app.js`
- Verify the API base URL configuration

#### 4. UI components not rendering

- Ensure all UI components exist in `/src/components/ui/`
- Check import paths in component files

### Debug Mode

Enable debug logging by setting:

```javascript
// In your environment variables
DEBUG = true;
```

## 📞 Support

### Getting Help

1. Check the console for error messages
2. Review the test suite output
3. Verify database table structure
4. Check API endpoint responses

### Common Solutions

- **Empty data**: Ensure you have test data in the database
- **Permission errors**: Check user access levels
- **UI not loading**: Verify all dependencies are installed

## 🎯 Next Steps

### Customization

1. **Add new report types**: Create new controller methods
2. **Custom fields**: Extend database tables
3. **Integration**: Connect with external systems
4. **Workflows**: Add approval processes

### Scaling

1. **Database optimization**: Add more indexes
2. **Caching**: Implement Redis for frequently accessed data
3. **Background jobs**: Use queues for heavy processing
4. **API rate limiting**: Implement throttling

## ✅ Success Criteria

Your Production Automation system is ready when:

- [ ] All API endpoints respond correctly
- [ ] Frontend components render without errors
- [ ] Data flows correctly between components
- [ ] Reports generate accurate data
- [ ] User can complete a full production cycle
- [ ] Accounting integration works properly

---

**🎉 Congratulations!** Your Production Automation system is now fully integrated and ready for use!


