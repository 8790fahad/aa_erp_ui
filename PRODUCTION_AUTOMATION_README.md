# Production Automation System

## Overview

This system automates the entire production lifecycle — from the purchase of raw materials to the manufacture of finished goods and sales distribution. It integrates inventory management, production scheduling, quality control, and accounting to ensure smooth, accurate, and efficient operations.

The system is designed for manufacturers, factories, and processing plants, and ensures compliance with International Accounting Standards (IAS/IFRS) and Nigerian Federal Inland Revenue Service (FIRS) where applicable.

## Features

### Procurement & Raw Material Management

- **Purchase Orders (POs)**: Automated PO creation and approval workflows
- **Supplier Management**: Track vendors, contracts, and pricing history
- **Raw Material Inventory**: Real-time stock monitoring with minimum/maximum alerts
- **Goods Received Note (GRN)**: Record and validate deliveries against POs

### Production Management

- **Bill of Materials (BOM)**: Define materials and quantities for each product
- **Production Orders (Work Orders)**: Create and schedule production runs
- **Material Issuance**: Automated consumption of raw materials during production
- **Shop Floor Tracking**: Track each stage of production (assembly, processing, packaging)
- **Quality Control**: Inspections and rework tracking

### Finished Goods Management

- **Warehouse Management**: Store, track, and transfer finished goods
- **Batch & Lot Tracking**: Full traceability from raw material to finished product
- **Costing Module**: Compute standard cost, actual cost, and variance analysis

### Sales & Distribution

- **Sales Orders**: Link production output to customer demand
- **Dispatch Management**: Track delivery schedules and logistics
- **Invoicing & Revenue Recognition**: Automated sales invoices and tax compliance

### Accounting & Reporting

- **Inventory Valuation**: FIFO, LIFO, and Weighted Average methods
- **Cost of Goods Manufactured (COGM)**: Detailed cost analysis of production runs
- **Cost of Goods Sold (COGS)**: Automatically linked to financial reporting
- **Integrated Accounting**: Real-time posting to General Ledger
- **Tax Compliance Reports (FIRS)**: VAT, WHT, and CIT integration

## Database Schema

### Core Tables

#### materials

- `material_id`: Unique identifier
- `name`: Raw material name
- `unit`: Measurement unit (kg, liter, pcs)
- `unit_cost`: Standard unit cost
- `stock_qty`: Current stock level
- `reorder_level`: Minimum reorder threshold
- `supplier_id`: Linked supplier

#### production_orders

- `order_id`: Unique production order ID
- `bom_id`: Linked bill of materials
- `quantity_planned`: Planned production output
- `quantity_actual`: Actual output
- `status`: Planned, In-progress, Completed
- `start_date`: Scheduled start date
- `end_date`: Completion date

#### finished_goods

- `fg_id`: Finished good identifier
- `description`: Product description
- `batch_no`: Batch or lot number
- `quantity`: Stock level
- `cost_per_unit`: Unit production cost
- `status`: Available, Reserved, Dispatched

## API Endpoints

### Procurement & Materials

- `POST /api/procurement/create-po` - Create purchase order
- `POST /api/procurement/receive-grn` - Record goods received
- `GET /api/procurement/materials` - Get materials list
- `GET /api/procurement/purchase-orders` - Get purchase orders

### Production

- `POST /api/production/create-bom` - Create bill of materials
- `POST /api/production/create-order` - Create production order
- `POST /api/production/update-progress` - Update production progress
- `GET /api/production/orders` - Get production orders
- `GET /api/production/bill-of-materials` - Get BOMs

### Finished Goods

- `POST /api/finished-goods/add` - Add finished goods
- `POST /api/finished-goods/transfer` - Transfer goods
- `POST /api/finished-goods/dispatch` - Dispatch goods
- `GET /api/finished-goods` - Get finished goods

### Reports

- `POST /api/reports/cogm` - COGM report
- `POST /api/reports/cogs` - COGS report
- `POST /api/reports/inventory-valuation` - Inventory valuation
- `POST /api/reports/production-efficiency` - Production efficiency
- `POST /api/reports/tax-summary` - Tax summary

## Request Format

All endpoints require a POST request with JSON body:

```json
{
  "facilityId": "ae9d49ee-3f9c-4f1e-bd6c-d2f18c61269f",
  "fromDate": "2025-01-01",
  "toDate": "2025-09-09",
  "asOfDate": "2025-09-09"
}
```

## Response Format

```json
{
  "success": true,
  "data": {
    // Report or transaction details
  }
}
```

## Compliance Features

### IFRS / IAS

- **Accrual Basis**: Raw material costs matched with production and revenue
- **Inventory Valuation**: FIFO/LIFO/WAC supported
- **COGM & COGS Disclosure**: Proper classification in financial statements

### FIRS (Nigeria)

- **VAT**: 7.5% applied to raw material purchases & finished goods sales
- **WHT**: Applied on contractor/supplier services
- **CIT**: Linked to taxable profit after deducting production costs

## Frontend Components

### Main Component

- `ProductionAutomation.jsx`: Container with step-based navigation

### Functional Components

- `PurchaseOrderForm.jsx`: Create and manage purchase orders
- `GoodsReceivedNote.jsx`: Record goods received
- `RawMaterialInventory.jsx`: Monitor raw material stock
- `ProductionOrderForm.jsx`: Create production orders
- `ShopFloorTracking.jsx`: Track production progress
- `FinishedGoodsReport.jsx`: Manage finished goods
- `CostingReport.jsx`: Inventory valuation reports
- `COGMReport.jsx`: Cost of goods manufactured
- `COGSReport.jsx`: Cost of goods sold

## Installation & Setup

### Backend

```bash
cd aa_erp_api
npm install
npm start
```

### Frontend

```bash
cd aa_erp_ui
npm install
npm run dev
```

## Usage

1. **Create purchase orders** for raw materials
2. **Record goods received** into stock
3. **Launch production orders** with BOM
4. **Track progress** on the shop floor
5. **Move finished goods** into warehouse
6. **Dispatch finished goods** against sales orders
7. **Generate accounting & tax compliance** reports

## Customization

- **New Report Types**: Add controller, route, and frontend component
- **Tax Rates**: Update rates in taxReports.js
- **Costing Methods**: Configure FIFO/LIFO/WAC in system settings

## Security Considerations

- **Role-based access**: Procurement, Production, Finance, Sales
- **Facility-level data segregation**
- **Input sanitization** to prevent SQL injection

## Performance Optimization

- **Indexed queries** for stock and production orders
- **Batch processing** for large production runs
- **Caching** frequently accessed reports

## Troubleshooting

- **Stock mismatch**: Verify GRNs and production consumption
- **Order delays**: Check material availability
- **Report discrepancies**: Validate costing method setup

## Support

For technical support or custom integrations, contact the system development team.

## Database Migration

To set up the production automation tables, run the following SQL commands:

```sql
-- Create materials table
CREATE TABLE materials (
  id VARCHAR(255) PRIMARY KEY,
  facility_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(255) UNIQUE NOT NULL,
  unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
  unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  stock_qty DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  reorder_level DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  supplier_id VARCHAR(255),
  account_code VARCHAR(255),
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create production_orders table
CREATE TABLE production_orders (
  id VARCHAR(255) PRIMARY KEY,
  facility_id VARCHAR(255) NOT NULL,
  bom_id VARCHAR(255) NOT NULL,
  order_number VARCHAR(255) UNIQUE NOT NULL,
  quantity_planned DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  quantity_actual DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  status ENUM('planned', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'planned',
  start_date DATE,
  end_date DATE,
  priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  notes TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create finished_goods table
CREATE TABLE finished_goods (
  id VARCHAR(255) PRIMARY KEY,
  facility_id VARCHAR(255) NOT NULL,
  production_order_id VARCHAR(255),
  product_name VARCHAR(255) NOT NULL,
  batch_no VARCHAR(255) NOT NULL,
  quantity DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  cost_per_unit DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  total_cost DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  status ENUM('available', 'reserved', 'dispatched', 'sold') NOT NULL DEFAULT 'available',
  warehouse_location VARCHAR(255),
  expiry_date DATE,
  account_code VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create bill_of_materials table
CREATE TABLE bill_of_materials (
  id VARCHAR(255) PRIMARY KEY,
  facility_id VARCHAR(255) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL DEFAULT '1.0',
  status ENUM('active', 'inactive', 'draft') NOT NULL DEFAULT 'draft',
  description TEXT,
  total_cost DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create bill_of_material_items table
CREATE TABLE bill_of_material_items (
  id VARCHAR(255) PRIMARY KEY,
  bom_id VARCHAR(255) NOT NULL,
  material_id VARCHAR(255) NOT NULL,
  quantity_required DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  total_cost DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  sequence INT NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create purchase_orders table
CREATE TABLE purchase_orders (
  id VARCHAR(255) PRIMARY KEY,
  facility_id VARCHAR(255) NOT NULL,
  supplier_number VARCHAR(255) NOT NULL,
  po_number VARCHAR(255) UNIQUE NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  status ENUM('pending', 'approved', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  expected_delivery_date DATE,
  notes TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create purchase_order_items table
CREATE TABLE purchase_order_items (
  id VARCHAR(255) PRIMARY KEY,
  po_id VARCHAR(255) NOT NULL,
  material_id VARCHAR(255) NOT NULL,
  quantity DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  total_price DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create goods_received_notes table
CREATE TABLE goods_received_notes (
  id VARCHAR(255) PRIMARY KEY,
  facility_id VARCHAR(255) NOT NULL,
  po_id VARCHAR(255) NOT NULL,
  grn_number VARCHAR(255) UNIQUE NOT NULL,
  received_by VARCHAR(255) NOT NULL,
  received_date DATE NOT NULL,
  notes TEXT,
  status ENUM('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create grn_items table
CREATE TABLE grn_items (
  id VARCHAR(255) PRIMARY KEY,
  grn_id VARCHAR(255) NOT NULL,
  material_id VARCHAR(255) NOT NULL,
  quantity_received DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  total_price DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create material_issuances table
CREATE TABLE material_issuances (
  id VARCHAR(255) PRIMARY KEY,
  facility_id VARCHAR(255) NOT NULL,
  production_order_id VARCHAR(255) NOT NULL,
  material_id VARCHAR(255) NOT NULL,
  quantity_issued DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  total_cost DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  issued_by VARCHAR(255) NOT NULL,
  issued_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create finished_good_transfers table
CREATE TABLE finished_good_transfers (
  id VARCHAR(255) PRIMARY KEY,
  facility_id VARCHAR(255) NOT NULL,
  finished_good_id VARCHAR(255) NOT NULL,
  from_location VARCHAR(255),
  to_location VARCHAR(255) NOT NULL,
  quantity DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  transferred_by VARCHAR(255) NOT NULL,
  transfer_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create finished_good_dispatches table
CREATE TABLE finished_good_dispatches (
  id VARCHAR(255) PRIMARY KEY,
  facility_id VARCHAR(255) NOT NULL,
  finished_good_id VARCHAR(255) NOT NULL,
  customer_id VARCHAR(255),
  quantity DECIMAL(15,2) NOT NULL DEFAULT 0.0,
  dispatch_date DATE NOT NULL,
  dispatched_by VARCHAR(255) NOT NULL,
  notes TEXT,
  status ENUM('pending', 'dispatched', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Testing

Run integration tests:

```bash
node test-production-system.js
```

## License

This project is licensed under the MIT License.



