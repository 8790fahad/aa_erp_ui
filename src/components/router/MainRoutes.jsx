/* eslint-disable no-unused-vars */
import React from "react";
import {
  ShoppingCart,
  Building,
  Users,
  Settings,
  Book,
  FileText,
  CreditCard,
  Wallet,
  Table,
  User,
  Factory,
  Package,
  BarChart3,
} from "lucide-react";

export const accessData = [
  {
    name: "Purchase",
    icon: <ShoppingCart />,
    path: "/app/purchase",
    children: [
      { name: "Purchase List", icon: <FileText />, path: "purchase-list" }, // relative path
      { name: "Suppliers", icon: <Building />, path: "suppliers" }, // relative path
    ],
  },
  {
    name: "Customer",
    icon: <Users />,
    path: "/app/customer",
    children: [
      { name: "Customer List", icon: <Table />, path: "index" }, // relative path
    ],
  },
  {
    name: "Sales",
    icon: <CreditCard />,
    path: "/app/sales",
    children: [
      { name: "Make Sales", icon: <Wallet />, path: "0" }, // relative path
      { name: "Transfer Form", icon: <FileText />, path: "1" }, // relative path
      { name: "Return Items", icon: <ShoppingCart />, path: "2" }, // relative path
      { name: "Receive Form", icon: <Book />, path: "3" }, // relative path
      { name: "Pending Sales", icon: <FileText />, path: "4" }, // relative path
    ],
  },
  {
    name: "Settings",
    icon: <Settings />,
    path: "/app/setting",
    children: [
      { name: "Unit Measurement", icon: <Table />, path: "unit-measurement" }, // relative path
    ],
  },
  {
    name: "Production",
    icon: <Factory />,
    path: "/app/production",
    children: [
      { name: "Production Automation", icon: <Factory />, path: "automation" }, // relative path
      { name: "Materials", icon: <Package />, path: "materials" }, // relative path
      { name: "Production Reports", icon: <BarChart3 />, path: "reports" }, // relative path
    ],
  },
  {
    name: "Reports",
    icon: <Book />,
    path: "/app/reports",
    children: [
      { name: "Invoice Report", icon: <FileText />, path: "invoice-list" }, // relative path
      { name: "Expenses", icon: <Wallet />, path: "expenses-report" }, // relative path
      {
        name: "Accounting Reports",
        icon: <FileText />,
        path: "accounting-reports",
      }, // relative path
    ],
  },
  {
    name: "HR Management",
    icon: <Users />,
    path: "/app/admin/hr",
    children: [
      { name: "Dashboard", icon: <BarChart3 />, path: "dashboard" },
      { name: "Employees", icon: <Users />, path: "employees" },
      { name: "Leave Management", icon: <FileText />, path: "leaves" },
      { name: "Payroll", icon: <CreditCard />, path: "payroll" },
      { name: "Attendance", icon: <Table />, path: "attendance" },
      { name: "Performance", icon: <Book />, path: "performance" },
    ],
  },
  {
    name: "Account",
    icon: <User />,
    path: "/app/account",
    children: [
      { name: "New Record", icon: <FileText />, path: "new" },
      { name: "Generate Invoice", icon: <FileText />, path: "generateinvoice" },
      { name: "Cash Movement", icon: <Wallet />, path: "clickforcashmovement" },
      {
        name: "Setup Chart of Account",
        icon: <Book />,
        path: "setup-chart-of-account",
      },
      { name: "Account Review", icon: <Table />, path: "account-review" },
      { name: "Manage Users", icon: <Users />, path: "org-staff" },
      {
        name: "Payment Voucher",
        icon: <CreditCard />,
        path: "payment-voucher",
      },
      { name: "Memo List", icon: <FileText />, path: "memo-list" },
      { name: "Memo Approval", icon: <Book />, path: "memo/approval" },
      { name: "Memo Review", icon: <FileText />, path: "memo/reviewal" },
    ],
  },
  {
    name: "Admin",
    icon: <Settings />,
    path: "/app/admin",
    children: [
      { name: "Manage Users", icon: <Users />, path: "manage-users" }, // relative path
      { name: "Manage Stores", icon: <Building />, path: "manage-stores" }, // relative path
    ],
  },
];
