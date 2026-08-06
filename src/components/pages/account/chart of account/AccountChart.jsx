/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MoreVerticalIcon,
  Plus,
  Upload,
  X,
  FileBarChart,
  Trash2,
  Download,
  BookOpen,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CustomTable1 from "@/common/Custom/CustomTable1";
import CustomButton from "@/common/Custom/CustomButton";
import { toast } from "sonner";
import { Typeahead } from "react-bootstrap-typeahead";
import ChartofAccountUpload from "../../customer/components/ChartofAccountUpload";
import { _fetchApi, _postApi, _deleteApi, _putApi } from "@/redux/actions/api";
import AddAccountModal from "./AddAccountModal";
import { getAccountTypes } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import moment from "moment";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";

export default function AccountChart() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [flatAccounts, setFlatAccounts] = useState([]);
  const [editAccount, setEditAccount] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedAccounts, setSelectedAccounts] = useState(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const getAccounts = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoading(true);
    _fetchApi(
      `/account/account-categories?facilityId=${activeBusiness.id}`,
      (resp) => {
        console.log("[AccountChart] /account/account-categories resp:", resp);
        console.log("[AccountChart] counts:", {
          tree: Array.isArray(resp?.results) ? resp.results.length : null,
          flat: Array.isArray(resp?.flat) ? resp.flat.length : null,
        });
        if (resp.success) {
          setAccounts(resp.results || []);
          if (resp.flat && resp.flat.length > 0) {
            setFlatAccounts(resp.flat);
          } else if (resp.results && resp.results.length > 0) {
            setFlatAccounts(resp.results);
          } else {
            setFlatAccounts([]);
          }
        } else {
          toast.error("Failed to load chart of accounts.");
          setFlatAccounts([]);
        }
        setLoading(false);
      },
      (err) => {
        console.error(err);
        toast.error("Network error.");
        setFlatAccounts([]);
        setLoading(false);
      },
    );
  }, [activeBusiness?.id]);

  const handleCreateOrUpdate = (form, isEditing = false) => {
    if (!isEditing && (!form.category || !form.level || !form.accountNature)) {
      toast.error("Category, Level, and Account Nature are required.");
      return;
    }

    const payload = {
      parentCode: form.parentCode || form.subhead || null,
      level: form.level,
      category: form.category || form.description,
      subcategory: form.subcategory || null,
      description: form.description,
      type: form.type || null,
      detail: form.detail || null,
      accountNature: form.accountNature || form.account_type,
      normalBalance: form.normalBalance || form.normal_balance || "debit",
      fsSection: form.fsSection || form.fs_section || "balance_sheet",
      reportingBehavior:
        form.reportingBehavior || form.reporting_behavior || "fixed",
      alternateNature:
        form.alternateNature || form.alternate_nature || null,
      accountRole: form.accountRole || form.account_role || "general",
      plLine: form.plLine || form.pl_line || null,
      display: form.display,
      isActive: form.isActive ?? form.is_active,
      facilityId: activeBusiness.id,
    };

    if (isEditing) {
      _putApi(
        `/account/account-category?code=${form.code || form.head}&facilityId=${
          activeBusiness.id
        }`,
        payload,
        (resp) => {
          if (resp.success) {
            toast.success("Account updated successfully");
            getAccounts();
            setEditAccount(null);
          } else {
            toast.error("Update failed.");
          }
        },
        (err) => {
          console.error(err);
          toast.error("Something went wrong.");
        },
      );
    } else {
      _postApi(
        `/account/account-category`,
        payload,
        (resp) => {
          if (resp.success) {
            toast.success("Account created successfully");
            getAccounts();
          } else {
            toast.error("Create failed.");
          }
        },
        (err) => {
          console.error(err);
          toast.error("Something went wrong.");
        },
      );
    }
  };

  const handleDisable = (node) => {
    if (
      !window.confirm(
        "Disable this account? It will be hidden from lists but can be re-enabled later.",
      )
    )
      return;

    _postApi(
      `/account/account-category/disable`,
      { code: node.code || node.head, facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          toast.success("Account disabled successfully");
          getAccounts();
        } else {
          toast.error(resp.message || "Disable failed");
        }
      },
      () => toast.error("Disable failed"),
    );
  };

  const handleDeleteSelected = () => {
    if (selectedAccounts.size === 0) return;
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    const codesToDelete = Array.from(selectedAccounts);
    if (codesToDelete.length === 0) return;

    setDeleteDialogOpen(false);
    setSelectedAccounts(new Set());

    let completed = 0;
    let failed = 0;
    const total = codesToDelete.length;

    const deleteNext = (index) => {
      if (index >= total) {
        getAccounts();
        if (failed > 0) {
          toast.error(`${failed} account(s) could not be deleted`);
        } else {
          toast.success(`${completed} account(s) deleted permanently`);
        }
        return;
      }

      const code = codesToDelete[index];
      _deleteApi(
        `/account/account-category`,
        { code, facilityId: activeBusiness.id },
        (resp) => {
          if (resp.success) {
            completed++;
          } else {
            failed++;
            toast.error(resp.message || `Failed to delete ${code}`);
          }
          deleteNext(index + 1);
        },
        () => {
          failed++;
          toast.error(`Failed to delete ${code}`);
          deleteNext(index + 1);
        },
      );
    };

    deleteNext(0);
  };

  const toggleAccountSelection = (code) => {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const toggleSelectAll = (allCodes) => {
    if (selectedAccounts.size === allCodes.length) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(allCodes));
    }
  };

  const runReport = (accountCodes) => {
    const codes = Array.isArray(accountCodes) ? accountCodes : [accountCodes];
    const validCodes = codes.map((c) => String(c || "").trim()).filter(Boolean);
    if (validCodes.length === 0) {
      toast.error("No accounts selected for this report");
      return;
    }
    const params = new URLSearchParams();
    params.set("accounts", validCodes.join(","));
    navigate(`/app/reports/accounting-reports/custom-reports?${params.toString()}`);
  };

  const handleRunReportForSelected = () => {
    if (selectedAccounts.size === 0) {
      toast.error("Please select at least one account");
      return;
    }
    runReport(Array.from(selectedAccounts));
  };

  const handleExportSelected = () => {
    const list = (flatAccounts?.length ? flatAccounts : accounts) || [];
    const allCodes = new Set(
      list.map((a) => String(a.code || a.head || "").trim()).filter(Boolean),
    );
    const exportAll = allCodes.size > 0 && selectedAccounts.size >= allCodes.size;
    const byCode = new Map(
      list.map((a) => [String(a.code || a.head || "").trim(), a]).filter(([c]) => !!c),
    );
    const depthMemo = new Map();
    const getDepth = (code, seen = new Set()) => {
      if (!code) return 0;
      if (depthMemo.has(code)) return depthMemo.get(code);
      if (seen.has(code)) return 0;
      seen.add(code);
      const row = byCode.get(code);
      if (!row) return 0;
      const parent = String(row.parent_code || row.parentCode || row.subhead || "").trim();
      if (!parent || parent === "0" || !byCode.has(parent)) {
        depthMemo.set(code, 0);
        return 0;
      }
      const d = Math.min(getDepth(parent, seen) + 1, 4);
      depthMemo.set(code, d);
      return d;
    };

    return list
      .filter((a) => {
        if (exportAll) return true;
        return selectedAccounts.has(String(a.code || a.head || "").trim());
      })
      .map((a) => {
        const code = String(a.code || a.head || "").trim();
        const natureRaw = (a.accountNature || a.account_nature || "").toString().trim();
        const nature =
          natureRaw === "ASSET"
            ? "Assets"
            : natureRaw === "LIABILITY"
              ? "Liabilities"
              : natureRaw === "EQUITY"
                ? "Equity"
                : natureRaw === "REVENUE"
                  ? "Revenue"
                  : natureRaw === "EXPENSE"
                    ? "Expenses"
                    : natureRaw || "—";
        const status = a.status
          ? String(a.status).toLowerCase()
          : a.is_active === 0 || a.isActive === false
            ? "inactive"
            : "active";
        return {
          Code: code,
          "Account Description": a.description || "",
          "Account Type": a.type || "",
          Nature: nature,
          Status: status,
          _depth: getDepth(code),
        };
      });
  };

  const exportSelectedAsExcel = async () => {
    const rows = handleExportSelected();
    if (rows.length === 0) {
      toast.error("No selected rows to export");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Chart of Accounts");
    worksheet.columns = [
      { width: 14 },
      { width: 42 },
      { width: 24 },
      { width: 18 },
      { width: 14 },
    ];

    let row = 1;
    const title = worksheet.getCell(row, 1);
    title.value = activeBusiness?.business_name || activeBusiness?.name || "Chart of Accounts";
    title.style = {
      font: { bold: true, size: 14, color: { argb: "FFFFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } },
      alignment: { horizontal: "center", vertical: "middle" },
    };
    worksheet.mergeCells(row, 1, row, 5);
    row++;

    const subtitle = worksheet.getCell(row, 1);
    subtitle.value = `Chart of Accounts Report • ${moment().format("DD/MM/YYYY HH:mm")}`;
    subtitle.style = {
      font: { size: 11, color: { argb: "FF1E3A8A" } },
      alignment: { horizontal: "center" },
    };
    worksheet.mergeCells(row, 1, row, 5);
    row += 2;

    const headers = ["Code", "Account Description", "Account Type", "Nature", "Status"];
    const headerRow = worksheet.getRow(row);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.style = {
        font: { bold: true, color: { argb: "FFFFFFFF" } },
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } },
        alignment: { horizontal: "center" },
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        },
      };
    });
    row++;

    rows.forEach((r) => {
      const excelRow = worksheet.getRow(row);
      headers.forEach((h, i) => {
        const cell = excelRow.getCell(i + 1);
        cell.value = r[h];
        cell.style = {
          font: { size: 10 },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: row % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" },
          },
          border: {
            top: { style: "thin", color: { argb: "FFE5E7EB" } },
            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
            left: { style: "thin", color: { argb: "FFE5E7EB" } },
            right: { style: "thin", color: { argb: "FFE5E7EB" } },
          },
        };
      });
      row++;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chart_of_accounts_${moment().format("YYYYMMDD_HHmmss")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel downloaded");
  };

  const exportSelectedAsPdf = () => {
    const rows = handleExportSelected();
    if (rows.length === 0) {
      toast.error("No selected rows to export");
      return;
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 26;
    const tableX = marginX;
    const tableWidth = pageWidth - marginX * 2;
    const headers = ["Code", "Account Description", "Account Type", "Nature", "Status"];
    const colWidths = [72, 182, 116, 92, 74];
    const rowH = 22;
    const headerBlue = [30, 58, 138];
    const drawTopHeader = () => {
      const y0 = 24;
      doc.setFillColor(...headerBlue);
      doc.rect(tableX, y0, tableWidth, 78, "F");

      const businessName =
        String(activeBusiness?.business_name || activeBusiness?.name || "Business Name").toUpperCase();
      const rc = activeBusiness?.rc || activeBusiness?.registration_number;
      const description = activeBusiness?.description || "Manufacturers of Industrial Gases";
      const address =
        activeBusiness?.business_address || activeBusiness?.address || "Address not available";
      const contact = `Tel: ${activeBusiness?.business_phone || activeBusiness?.phone || "N/A"} | Fax: ${activeBusiness?.fax || "N/A"} | Email: ${activeBusiness?.business_email || activeBusiness?.email || "N/A"}`;
      const rightW = 240;
      const rightX = tableX + tableWidth - rightW - 8;
      const rightY = y0 + 6;

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      const titleY = y0 + 18;
      doc.text(businessName, tableX + 8, titleY);
      if (rc) {
        // Place RC on a dedicated line to keep it visible.
        doc.setFontSize(10);
        doc.text(`RC. ${rc}`, tableX + 8, y0 + 30);
      }
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.text(description, tableX + 8, y0 + 34);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(address, tableX + 8, y0 + 50);
      doc.text(contact, tableX + 8, y0 + 64);

      doc.setFillColor(79, 106, 181);
      doc.roundedRect(rightX, rightY, rightW, 46, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("CHART OF ACCOUNT", rightX + rightW / 2, rightY + 18, { align: "center" });
      doc.setFontSize(10);
      doc.text(`Date: ${moment().format("DD/MM/YYYY")}`, rightX + rightW / 2, rightY + 35, {
        align: "center",
      });
      doc.setFontSize(8.5);
      doc.text(
        `Date: ${moment().format("dddd, DD MMMM YYYY hh:mm A [GMT]Z")}`,
        tableX + tableWidth - 8,
        y0 + 69,
        { align: "right" },
      );
      // Keep a small aligned separation between header and table.
      return y0 + 82;
    };

    const drawTableHeader = (y) => {
      doc.setFillColor(55, 65, 81);
      doc.rect(tableX, y, colWidths.reduce((a, b) => a + b, 0), rowH, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      let x = tableX;
      headers.forEach((h, i) => {
        doc.text(h, x + 6, y + 14);
        x += colWidths[i];
      });
    };

    let y = drawTopHeader();
    drawTableHeader(y);
    y += rowH;
    doc.setTextColor(31, 41, 55);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const depthFill = (depth) => {
      if (depth === 0) return [248, 250, 252];
      if (depth === 1) return [239, 246, 255];
      if (depth === 2) return [236, 253, 245];
      if (depth === 3) return [245, 243, 255];
      return [255, 251, 235];
    };

    rows.forEach((r) => {
      const [fr, fg, fb] = depthFill(r._depth || 0);
      doc.setFillColor(fr, fg, fb);
      doc.rect(tableX, y, colWidths.reduce((a, b) => a + b, 0), rowH, "F");
      doc.setDrawColor(229, 231, 235);
      doc.rect(tableX, y, colWidths.reduce((a, b) => a + b, 0), rowH, "S");

      const vals = [
        r.Code,
        r["Account Description"],
        r["Account Type"],
        r.Nature,
        r.Status,
      ];
      let cx = tableX;
      vals.forEach((v, i) => {
        const maxLen = i === 1 ? 34 : i === 2 ? 20 : 16;
        const raw = String(v ?? "");
        const txt = raw.length > maxLen ? `${raw.slice(0, maxLen - 1)}…` : raw;
        doc.text(txt, cx + 6, y + 14);
        cx += colWidths[i];
      });
      y += rowH;
      if (y > pageHeight - 34) {
        doc.addPage();
        y = drawTopHeader();
        drawTableHeader(y);
        y += rowH;
        doc.setTextColor(31, 41, 55);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
      }
    });

    doc.save(`chart_of_accounts_${moment().format("YYYYMMDD_HHmmss")}.pdf`);
    toast.success("PDF downloaded");
  };

  useEffect(() => {
    getAccounts();
  }, [getAccounts]);

  const sourceAccounts =
    flatAccounts.length > 0 ? flatAccounts : accounts.length > 0 ? accounts : [];

  const filteredAccounts = sourceAccounts.filter((a) => {
    const q = String(searchTerm || "").trim().toLowerCase();
    if (!q) return true;
    const code = String(a.code || a.head || "").toLowerCase();
    const description = String(a.description || "").toLowerCase();
    const type = String(a.type || "").toLowerCase();
    const subcategory = String(
      a.sub_class_category || a.subClassCategory || a.detail || a.detail_type || "",
    ).toLowerCase();
    const nature = String(a.accountNature || a.account_nature || "").toLowerCase();
    return (
      code.includes(q) ||
      description.includes(q) ||
      type.includes(q) ||
      subcategory.includes(q) ||
      nature.includes(q)
    );
  });

  return (
    <div className="min-h-[70vh] px-3 py-4 sm:px-4 lg:px-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
            <BookOpen className="h-5 w-5 text-[#4267B2]" />
            Chart of Accounts
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Manage your financial structure for P&amp;L, Trial Balance, and Balance Sheet
          </p>
        </div>
      </div>

      {selectedAccounts.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#4267B2]/20 bg-[var(--aa-sidebar-active,#eff4fb)] p-3">
          <Badge className="border-0 bg-[#4267B2] text-white hover:bg-[#4267B2]">
            {selectedAccounts.size} selected
          </Badge>
          <Button
            size="sm"
            className="gap-2 border-0 bg-[#4267B2] text-white hover:bg-[#4267B2]/90"
            onClick={handleRunReportForSelected}
          >
            <FileBarChart className="h-4 w-4" />
            Run Report
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-slate-200 bg-white text-slate-700"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={exportSelectedAsExcel}>
                Export Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportSelectedAsPdf}>
                Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant="destructive"
            className="gap-2"
            onClick={handleDeleteSelected}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-slate-600"
            onClick={() => setSelectedAccounts(new Set())}
          >
            Clear Selection
          </Button>
        </div>
      )}

      <ChartofAccountUpload
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        getAcc={getAccounts}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by code, description, account type, subcategory, or nature"
            className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#4267B2] focus:ring-2 focus:ring-[#4267B2]/20"
          />
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2 border-slate-200 text-[#4267B2] hover:bg-[var(--aa-sidebar-active)]"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="h-4 w-4 shrink-0" />
            Upload
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 gap-2 border-0 bg-[#4267B2] text-white hover:bg-[#4267B2]/90 shadow-none"
            onClick={() => setAddModalOpen(true)}
          >
            <Plus className="h-4 w-4 shrink-0" />
            Add Account
          </Button>
        </div>
      </div>

      {loading ? (
        <AccountListSkeleton />
      ) : (
        <AccountList
          accounts={filteredAccounts}
          onEdit={(account) => setEditAccount(account)}
          onDisable={handleDisable}
          selectedAccounts={selectedAccounts}
          onToggleSelect={toggleAccountSelection}
          onToggleSelectAll={toggleSelectAll}
          onRunReport={(code) => runReport(code)}
        />
      )}

      <AddAccountModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={getAccounts}
      />
      {editAccount && (
        <EditAccountForm
          account={editAccount}
          onSave={handleCreateOrUpdate}
          onCancel={() => setEditAccount(null)}
          existingAccounts={accounts}
        />
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Permanent Delete</DialogTitle>
            <DialogDescription className="text-slate-500">
              Are you sure you want to delete {selectedAccounts.size} selected
              account(s)? This action cannot be undone. Only accounts with no
              ledger transactions can be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            {Array.from(selectedAccounts).map((code) => {
              const accountsList =
                flatAccounts.length > 0 ? flatAccounts : accounts;
              const acc = accountsList.find((a) => (a.code || a.head) === code);
              const description = acc?.description || acc?.detail || "";
              return (
                <div key={code} className="text-slate-700">
                  <span className="font-medium">{code}</span>
                  {description && (
                    <span className="text-slate-500"> — {description}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              className="border-slate-200"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ====================== TABLE LIST COMPONENT ====================== */
const AccountList = ({
  accounts,
  onEdit,
  onDisable,
  selectedAccounts,
  onToggleSelect,
  onToggleSelectAll,
  onRunReport,
}) => {
  const deriveNature = (a) => {
    const nature = (a.accountNature || a.account_nature || "").toString().trim();
    if (nature) {
      if (nature === "ASSET") return "Assets";
      if (nature === "LIABILITY") return "Liabilities";
      if (nature === "EQUITY") return "Equity";
      if (nature === "REVENUE") return "Revenue";
      if (nature === "EXPENSE") return "Expenses";
      return nature;
    }
    return "—";
  };

  const deriveStatus = (a) => {
    if (a.status) return String(a.status).toLowerCase();
    if (a.is_active === 0 || a.isActive === false) return "inactive";
    return "active";
  };

  const deriveSubcategory = (a) => {
    const v =
      a.subcategory || a.subClassCategory || a.detail || a.detail_type || "";
    return String(v || "").trim() || "—";
  };

  const getNatureTone = (natureLabel) => {
    const n = String(natureLabel || "").toLowerCase();
    if (n.includes("asset"))
      return "bg-[#4267B2]/10 text-[#4267B2] border-[#4267B2]/25";
    if (n.includes("liabil"))
      return "bg-slate-100 text-slate-700 border-slate-200";
    if (n.includes("equity"))
      return "bg-slate-800/5 text-slate-800 border-slate-300";
    if (n.includes("revenue"))
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    if (n.includes("expense"))
      return "bg-rose-50 text-rose-800 border-rose-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const getDepthTone = (depth) => {
    if (depth === 0) return "bg-slate-50/90";
    if (depth === 1) return "bg-white";
    if (depth === 2) return "bg-slate-50/40";
    return "bg-white";
  };

  const flattenAccounts = (accList) => {
    if (!Array.isArray(accList)) return [];
    const result = [];
    for (const acc of accList) {
      if (acc.children && Array.isArray(acc.children)) {
        const { children, ...nodeData } = acc;
        result.push(nodeData);
        result.push(...flattenAccounts(children));
      } else {
        result.push(acc);
      }
    }
    return result;
  };

  const accountsArray = Array.isArray(accounts) ? accounts : [];
  const flatAccountsList =
    accountsArray.length > 0 && accountsArray[0]?.children
      ? flattenAccounts(accountsArray)
      : accountsArray;
  const buildHierarchicalRows = (list) => {
    const map = new Map();
    const roots = [];
    const linked = new Set();

    list.forEach((a) => {
      const code = String(a.code || a.head || "").trim();
      if (!code) return;
      map.set(code, { ...a, _code: code, _children: [] });
    });

    map.forEach((node) => {
      const p = String(
        node.parent_code || node.parentCode || node.subhead || "",
      ).trim();
      if (!p || p === "0" || !map.has(p) || p === node._code) {
        roots.push(node);
      } else {
        map.get(p)._children.push(node);
        linked.add(node._code);
      }
    });

    // In case some rows were neither linked nor marked as root.
    map.forEach((node) => {
      if (!linked.has(node._code) && !roots.find((r) => r._code === node._code)) {
        roots.push(node);
      }
    });

    const sortByNatureTypeCode = (a, b) => {
      const na = deriveNature(a);
      const nb = deriveNature(b);
      if (na !== nb) return na.localeCompare(nb);
      const ta = String(a.type || "").toLowerCase();
      const tb = String(b.type || "").toLowerCase();
      if (ta !== tb) return ta.localeCompare(tb);
      return a._code.localeCompare(b._code);
    };

    const sortByTypeCode = (a, b) => {
      const ta = String(a.type || "").toLowerCase();
      const tb = String(b.type || "").toLowerCase();
      if (ta !== tb) return ta.localeCompare(tb);
      return a._code.localeCompare(b._code);
    };

    const walk = (nodes, depth = 0) => {
      const out = [];
      nodes.sort(depth === 0 ? sortByNatureTypeCode : sortByTypeCode).forEach((n) => {
        out.push({
          ...n,
          _depth: depth,
          _hasChildren: (n._children || []).length > 0,
        });
        if (n._children?.length) out.push(...walk(n._children, depth + 1));
      });
      return out;
    };

    return walk(roots, 0);
  };

  const flat = buildHierarchicalRows(flatAccountsList);
  const groupedRows = flat;

  const allCodes = flat
    .map((a) => String(a.code || a.head || "").trim())
    .filter(Boolean);
  const columns = [
    {
      title: (
        <Checkbox
          checked={allCodes.length > 0 && selectedAccounts.size === allCodes.length}
          onCheckedChange={() => onToggleSelectAll(allCodes)}
          aria-label="Select all accounts"
        />
      ),
      className: "text-left w-[44px]",
      custom: true,
      component: (a) => {
        if (a._isGroupHeader) return null;
        const code = String(a.code || a.head || "").trim();
        if (!code) return null;
        return (
          <Checkbox
            checked={selectedAccounts.has(code)}
            onCheckedChange={() => onToggleSelect(code)}
            aria-label={`Select account ${code}`}
          />
        );
      },
    },
    {
      title: "Code",
      className: "text-left",
      custom: true,
      component: (a) => (
        a._isGroupHeader ? (
          <div className="font-bold text-slate-900">{a._groupLabel}</div>
        ) : (
          <span className={`${a._hasChildren ? "font-bold" : "font-medium"} text-slate-900`}>
            {a.code || a.head || "NULL"}
          </span>
        )
      ),
    },
    {
      title: "Account Description",
      className: "text-left",
      custom: true,
      component: (a) => (
        a._isGroupHeader ? (
          <span className="text-xs text-slate-500">{a._groupCount} account(s)</span>
        ) : (
          <span className={`${a._hasChildren ? "font-semibold" : "font-normal"} text-slate-900`}>
            {a.description || <span className="text-gray-400 italic">NULL</span>}
          </span>
        )
      ),
    },
    {
      title: "Account Type",
      className: "text-left",
      custom: true,
      component: (a) =>
        a._isGroupHeader ? null : <span className="text-slate-900">{a.type || "—"}</span>,
    },
    // {
    //   title: "Sub  Category",
    //   className: "text-left",
    //   custom: true,
    //   component: (a) =>
    //     a._isGroupHeader ? null : (
    //       <span className="text-slate-900">{deriveSubcategory(a)}</span>
    //     ),
    // },
    {
      title: "Nature",
      className: "text-left",
      custom: true,
      component: (a) =>
        a._isGroupHeader ? null : (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={`${getNatureTone(deriveNature(a))} ${
                a._hasChildren ? "font-bold" : "font-semibold"
              }`}
            >
              {deriveNature(a)}
            </Badge>
            {(a.reporting_behavior === "balance_switch" ||
              a.reportingBehavior === "balance_switch") && (
              <Badge
                variant="outline"
                className="bg-[#4267B2]/10 text-[#4267B2] border-[#4267B2]/30 text-[10px] font-medium tracking-wide"
                title="Balance switch: debit → asset, credit → liability"
              >
                Switch
              </Badge>
            )}
          </div>
        ),
    },
    {
      title: "Status",
      className: "text-left",
      custom: true,
      component: (a) => {
        if (a._isGroupHeader) return null;
        const status = deriveStatus(a);
        const isActive = status === "active";
        return (
          <Badge
            variant="outline"
            className={
              isActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }
          >
            {status}
          </Badge>
        );
      },
    },
    {
      title: "Action",
      className: "text-left",
      custom: true,
      component: (a) =>
        a._isGroupHeader ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-gray-100"
              >
                <MoreVerticalIcon className="h-4 w-4 text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(a)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRunReport(a.code || a.head)}>
                Report
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-yellow-700 focus:text-yellow-800"
                onClick={() => onDisable(a)}
              >
                Disable
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
    },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <CustomTable1
        data={groupedRows}
        fields={columns}
        pageSize={100}
        rowClassName={(row) =>
          row?._isGroupHeader
            ? "bg-slate-100 font-semibold"
            : `${getDepthTone(row?._depth || 0)} ${row?._hasChildren ? "font-semibold" : ""}`
        }
      />
    </div>
  );
};

/* ====================== ADD ACCOUNT FORM ====================== */
export const AddAccountForm = ({ onSave, onCancel }) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const [form, setForm] = useState({
    head: "",
    description: "",
    account_type: "",
    type_details: "",
    type_mnemonic: "",
    detail_type_mnemonic: "",
    balance: "",
    opening_balance_date: "",
  });
  const [selectedType, setSelectedType] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [typesData, setTypesData] = useState({});

  const fetchTypes = () => {
    _fetchApi(
      `/account/get-account-types/${activeBusiness.id}`,
      (r) => {
        if (r.success && r.results?.accountTypes?.length) {
          setTypesData(r.results);
        } else if (r.success) {
          setTypesData({ accountTypes: getAccountTypes() });
        }
      },
      () => {
        toast.error("Failed to load account types. Using defaults.");
        setTypesData({ accountTypes: getAccountTypes() });
      },
    );
  };

  const generateCode = () => {
    if (!selectedDetail) return;
    _postApi(
      "/account/generate-chart-of-account",
      {
        facilityId: activeBusiness.id,
        typeId: selectedType?.typeId,
        detailTypeId: selectedDetail?.detailTypeId,
      },
      (r) => r.success && setForm((p) => ({ ...p, head: r.code })),
    );
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  useEffect(() => {
    if (selectedDetail) generateCode();
  }, [selectedDetail]);

  const formatNumberWithCommas = (value) => {
    if (!value || value === "") return "";
    const numericValue = value.replace(/[^0-9.]/g, "");
    const endsWithDot = numericValue.endsWith(".");
    const parts = numericValue.split(".");
    const integerPart = parts[0] || "";
    const decimalPart = parts[1] || "";
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    if (decimalPart) return `${formattedInteger}.${decimalPart}`;
    if (endsWithDot && integerPart) return `${formattedInteger}.`;
    return formattedInteger;
  };

  const parseNumberFromFormatted = (value) => {
    if (!value || value === "") return "";
    return value.replace(/,/g, "");
  };

  const handleBalanceChange = (value) => {
    const withoutCommas = value.replace(/,/g, "");
    const sanitized = withoutCommas.replace(/[^0-9.]/g, "");
    const parts = sanitized.split(".");
    const numericValue =
      parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : sanitized;
    const formatted = formatNumberWithCommas(numericValue);
    const parsed = parseNumberFromFormatted(formatted);
    const isZeroOrEmpty =
      parsed === "" || parsed === "0" || parseFloat(parsed) === 0;

    setForm({
      ...form,
      balance: formatted,
      opening_balance_date: isZeroOrEmpty ? "" : form.opening_balance_date,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.head || !form.description)
      return toast.error("Fill required fields");

    const parsedBalance = parseNumberFromFormatted(form.balance);
    const balanceValue =
      parsedBalance === "" ? 0 : parseFloat(parsedBalance) || 0;

    onSave({
      ...form,
      balance: balanceValue,
      facilityId: activeBusiness.id,
      created_by: user?.id,
      display: 1,
      show: 1,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row justify-between">
          <div>
            <CardTitle>Add Account</CardTitle>
          </div>
          <Button variant="ghost" onClick={onCancel}>
            <X />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Account Type *</Label>
              <Typeahead
                options={typesData.accountTypes || []}
                labelKey="type"
                onChange={(s) => {
                  setSelectedType(s[0] || null);
                  setSelectedDetail(s[0]?.children?.[0] || null);
                }}
                placeholder="Select type"
              />
            </div>

            {selectedType && (
              <div>
                <Label>Detail Type *</Label>
                <Typeahead
                  options={selectedType.children || []}
                  labelKey="detailType"
                  onChange={(s) => setSelectedDetail(s[0] || null)}
                  placeholder="Select detail"
                />
              </div>
            )}

            <div>
              <Label>Code (auto-generated)</Label>
              <Input value={form.head} disabled />
            </div>

            <div>
              <Label>Description *</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="e.g. Bank Account"
              />
            </div>

            {[
              "Cash and cash equivalents",
              "Current assets",
              "Fixed assets",
              "Current liabilities",
              "Non-current liabilities",
              "Owner's equity",
            ].includes(selectedType?.type) && (
              <>
                <div>
                  <Label>Opening Balance</Label>
                  <Input
                    type="text"
                    value={form.balance}
                    onChange={(e) => handleBalanceChange(e.target.value)}
                    placeholder="0.00"
                    className="text-right"
                  />
                </div>
                {(() => {
                  const parsed = parseNumberFromFormatted(form.balance);
                  return (
                    parsed !== "" && parsed !== "0" && parseFloat(parsed) !== 0
                  );
                })() && (
                  <div>
                    <Label>Balance Date *</Label>
                    <Input
                      type="date"
                      value={form.opening_balance_date || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          opening_balance_date: e.target.value || "",
                        })
                      }
                    />
                  </div>
                )}
              </>
            )}

            <div className="flex gap-3 pt-4">
              <CustomButton type="submit" className="flex-1">
                Save
              </CustomButton>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

/* ====================== EDIT FORM ====================== */
export const EditAccountForm = ({ account, onSave, onCancel }) => {
  const pick = (...keys) => {
    for (const k of keys) {
      if (account?.[k] !== undefined && account?.[k] !== null && account?.[k] !== "") {
        return account[k];
      }
    }
    return "";
  };

  const primaryNature = String(
    pick("accountNature", "account_nature", "account_type") || ""
  ).toUpperCase();

  const [form, setForm] = useState(() => {
    const fsRaw = String(pick("fsSection", "fs_section") || "").toLowerCase();
    let fsSection = "balance_sheet";
    if (fsRaw === "pl" || fsRaw === "profit_and_loss") fsSection = "profit_and_loss";
    else if (fsRaw === "off_statement") fsSection = "off_statement";
    else if (fsRaw === "bs" || fsRaw === "balance_sheet") fsSection = "balance_sheet";
    else if (["REVENUE", "EXPENSE"].includes(primaryNature))
      fsSection = "profit_and_loss";

    const nb = String(pick("normalBalance", "normal_balance") || "").toLowerCase();
    return {
      ...account,
      level: account?.level ?? account?.Level ?? "",
      category: account?.category ?? "",
      subcategory: pick("subcategory"),
      type: pick("type"),
      accountNature: primaryNature,
      description: pick("description"),
      normalBalance: nb === "credit" ? "credit" : nb === "debit" ? "debit" : (
        ["ASSET", "EXPENSE"].includes(primaryNature) ? "debit" : "credit"
      ),
      fsSection,
      reportingBehavior:
        pick("reportingBehavior", "reporting_behavior") || "fixed",
      alternateNature: String(
        pick("alternateNature", "alternate_nature") || ""
      ).toUpperCase(),
      accountRole: pick("accountRole", "account_role") || "general",
      plLine: pick("plLine", "pl_line"),
      display:
        account?.display === undefined || account?.display === null
          ? true
          : Boolean(account.display === true || account.display === 1 || account.display === "1"),
      isActive:
        account?.is_active === undefined && account?.isActive === undefined
          ? true
          : Boolean(
              account?.isActive === true ||
                account?.isActive === 1 ||
                account?.is_active === true ||
                account?.is_active === 1
            ),
    };
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.description?.trim()) {
      toast.error("Description is required");
      return;
    }
    if (
      form.reportingBehavior === "balance_switch" &&
      !form.alternateNature
    ) {
      toast.error("Alternate nature is required for balance-switch accounts");
      return;
    }
    onSave(
      {
        ...form,
        code: form.code || form.head || account?.code || account?.head,
        head: form.head || account?.head,
        level: form.level || account?.level,
        category: form.category || account?.category,
        accountNature:
          form.accountNature ||
          account?.accountNature ||
          account?.account_nature ||
          account?.account_type,
      },
      true
    );
  };

  const selectClass =
    "mt-1 w-full px-3 py-2 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#4267B2]/30 focus:border-[#4267B2] text-sm";

  return (
    <Sheet
      open={!!account}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel?.();
      }}
    >
      <SheetContent
        side="right"
        className="!inset-y-0 !right-0 !left-auto flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l border-slate-200 p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:!max-w-xl md:!max-w-2xl [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:bg-white/10 [&>button]:hover:opacity-100"
      >
        <SheetHeader className="shrink-0 space-y-1 border-b border-slate-200 bg-[var(--aa-navy,#4267B2)] px-5 py-4 pr-12 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-white/10 p-2">
              <BookOpen className="h-4 w-4 text-[var(--aa-accent,#93c5fd)]" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-lg font-semibold leading-tight text-white">
                Edit Account
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-xs text-white/70">
                Update classification and statement mapping (code is locked)
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-5 py-5 md:px-6">
            <div>
              <Label>Code</Label>
              <Input value={form.head || form.code || ""} disabled className="mt-1 font-mono" />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                className="mt-1 border-slate-200"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Account type</Label>
                <Input
                  className="mt-1 border-slate-200"
                  value={form.type || ""}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                />
              </div>
              <div>
                <Label>Subcategory</Label>
                <Input
                  className="mt-1 border-slate-200"
                  value={form.subcategory || ""}
                  onChange={(e) =>
                    setForm({ ...form, subcategory: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 space-y-3">
              <h4 className="text-sm font-semibold text-slate-800">
                Statement mapping
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Nature</Label>
                  <select
                    className={selectClass}
                    value={form.accountNature}
                    onChange={(e) => {
                      const accountNature = e.target.value;
                      const isPl =
                        accountNature === "REVENUE" ||
                        accountNature === "EXPENSE";
                      setForm((f) => ({
                        ...f,
                        accountNature,
                        normalBalance: ["ASSET", "EXPENSE"].includes(
                          accountNature
                        )
                          ? "debit"
                          : "credit",
                        fsSection: isPl ? "profit_and_loss" : "balance_sheet",
                      }));
                    }}
                  >
                    {["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].map(
                      (n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <Label>Financial statement</Label>
                  <select
                    className={selectClass}
                    value={form.fsSection}
                    onChange={(e) =>
                      setForm({ ...form, fsSection: e.target.value })
                    }
                  >
                    <option value="balance_sheet">Balance sheet</option>
                    <option value="profit_and_loss">Profit &amp; loss</option>
                    <option value="off_statement">Off statement</option>
                  </select>
                </div>
                <div>
                  <Label>Normal balance</Label>
                  <select
                    className={selectClass}
                    value={form.normalBalance}
                    onChange={(e) =>
                      setForm({ ...form, normalBalance: e.target.value })
                    }
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
                {form.fsSection === "profit_and_loss" && (
                  <div>
                    <Label>P&amp;L line</Label>
                    <select
                      className={selectClass}
                      value={form.plLine || ""}
                      onChange={(e) =>
                        setForm({ ...form, plLine: e.target.value })
                      }
                    >
                      <option value="">Derive from type</option>
                      <option value="turnover">Turnover</option>
                      <option value="cost_of_sales">Cost of sales</option>
                      <option value="admin_costs">Admin costs</option>
                      <option value="other_income">Other income</option>
                      <option value="finance">Finance</option>
                      <option value="tax">Tax</option>
                      <option value="impairment">Impairment</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 space-y-3">
              <h4 className="text-sm font-semibold text-slate-800">
                Special reporting
              </h4>
              <div>
                <Label>Reporting behavior</Label>
                <select
                  className={selectClass}
                  value={form.reportingBehavior}
                  onChange={(e) => {
                    const reportingBehavior = e.target.value;
                    setForm((f) => ({
                      ...f,
                      reportingBehavior,
                      alternateNature:
                        reportingBehavior === "balance_switch"
                          ? f.alternateNature ||
                            (f.accountNature === "LIABILITY"
                              ? "ASSET"
                              : "LIABILITY")
                          : "",
                    }));
                  }}
                >
                  <option value="fixed">Fixed</option>
                  <option value="balance_switch">Balance switch</option>
                </select>
              </div>
              {form.reportingBehavior === "balance_switch" && (
                <div className="rounded-md border border-[#4267B2]/25 bg-[var(--aa-sidebar-active,#eff4fb)] p-3 space-y-2">
                  <p className="text-xs text-slate-600">
                    Debit balance → asset side; credit balance → liability side
                    (VAT / clearing).
                  </p>
                  <div>
                    <Label>Alternate nature</Label>
                    <select
                      className={selectClass}
                      value={form.alternateNature}
                      onChange={(e) =>
                        setForm({ ...form, alternateNature: e.target.value })
                      }
                    >
                      <option value="">Select…</option>
                      {["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]
                        .filter((n) => n !== form.accountNature)
                        .map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}
              <div>
                <Label>Account role</Label>
                <select
                  className={selectClass}
                  value={form.accountRole}
                  onChange={(e) =>
                    setForm({ ...form, accountRole: e.target.value })
                  }
                >
                  <option value="general">General</option>
                  <option value="tax_control">Tax control</option>
                  <option value="bank">Bank</option>
                  <option value="ar">AR</option>
                  <option value="ap">AP</option>
                  <option value="clearing">Clearing</option>
                  <option value="retained_earnings">Retained earnings</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
              <label className="flex items-center justify-between gap-4 text-sm text-slate-700 cursor-pointer">
                <span>Show in account lists</span>
                <Checkbox
                  checked={!!form.display}
                  onCheckedChange={(c) =>
                    setForm({ ...form, display: !!c })
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-4 text-sm text-slate-700 cursor-pointer">
                <span>Active</span>
                <Checkbox
                  checked={!!form.isActive}
                  onCheckedChange={(c) =>
                    setForm({ ...form, isActive: !!c })
                  }
                />
              </label>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-5 py-3.5">
            <Button
              variant="outline"
              type="button"
              size="sm"
              onClick={onCancel}
              className="border-slate-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="border-0 bg-[#4267B2] text-white hover:bg-[#4267B2]/90"
            >
              Update
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

/* ====================== SKELETON ====================== */
const AccountListSkeleton = () => (
  <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
    <div className="p-4">
      <div className="mb-4 grid grid-cols-5 gap-4 border-b border-slate-200 pb-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-16" />
      </div>
      {[...Array(10)].map((_, i) => (
        <div key={i} className="mb-3 grid grid-cols-5 gap-4 border-b border-slate-100 pb-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mx-auto h-6 w-20" />
          <Skeleton className="ml-auto h-6 w-6" />
        </div>
      ))}
    </div>
  </div>
);
