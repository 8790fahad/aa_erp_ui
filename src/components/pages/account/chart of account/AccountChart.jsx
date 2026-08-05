/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MoreVerticalIcon,
  Plus,
  Upload,
  X,
  FileBarChart,
  Trash2,
  Download,
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
import CustomTree from "../CustomTree";
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
      description: form.description,
      type: form.type || null,
      detail: form.detail || null,
      accountNature: form.accountNature || form.account_type,
      normalBalance: form.normalBalance || "DEBIT",
      fsSection: form.fsSection || "BS",
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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Chart of Accounts</h1>
            <p className="text-muted-foreground">
              Manage your financial structure
            </p>
          </div>
          <div className="flex gap-3">
            <CustomButton onClick={() => setAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </CustomButton>
            <CustomButton variant="outline" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </CustomButton>
          </div>
        </div>

        {/* Selection toolbar */}
        {selectedAccounts.size > 0 && (
          <div className="mb-4 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Badge className="bg-blue-600">
              {selectedAccounts.size} selected
            </Badge>
            <Button
              size="sm"
              className="gap-2 bg-blue-600 hover:bg-blue-700"
              onClick={handleRunReportForSelected}
            >
              <FileBarChart className="h-4 w-4" />
              Run Report
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2 bg-white">
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

        <div className="mt-4 mb-2">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by code, description, account type, subcategory, or nature"
            className="max-w-md bg-white"
          />
        </div>

        <Tabs defaultValue="list" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">Table View</TabsTrigger>
            <TabsTrigger value="tree">3D View</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
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
          </TabsContent>
          <TabsContent value="tree">
            {loading ? (
              <AccountListSkeleton />
            ) : (
              <AccountTreeList
                accounts={filteredAccounts}
                onEdit={(account) => setEditAccount(account)}
                onDisable={handleDisable}
                selectedAccounts={selectedAccounts}
                onToggleSelect={toggleAccountSelection}
                onToggleSelectAll={toggleSelectAll}
                onRunReport={(code) => runReport(code)}
              />
            )}
          </TabsContent>
        </Tabs>

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
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Permanent Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedAccounts.size} selected
              account(s)? This action cannot be undone. Only accounts with no
              ledger transactions can be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 py-2 px-3 bg-gray-50 rounded text-sm max-h-32 overflow-y-auto space-y-1">
            {Array.from(selectedAccounts).map((code) => {
              const accountsList =
                flatAccounts.length > 0 ? flatAccounts : accounts;
              const acc = accountsList.find((a) => (a.code || a.head) === code);
              const description = acc?.description || acc?.detail || "";
              return (
                <div key={code} className="text-gray-700">
                  <span className="font-medium">{code}</span>
                  {description && (
                    <span className="text-gray-600"> — {description}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
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
    if (n.includes("asset")) return "bg-blue-100 text-blue-800 border-blue-200";
    if (n.includes("liabil")) return "bg-orange-100 text-orange-800 border-orange-200";
    if (n.includes("equity")) return "bg-purple-100 text-purple-800 border-purple-200";
    if (n.includes("revenue")) return "bg-green-100 text-green-800 border-green-200";
    if (n.includes("expense")) return "bg-red-100 text-red-800 border-red-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getDepthTone = (depth) => {
    if (depth === 0) return "bg-slate-50";
    if (depth === 1) return "bg-blue-50";
    if (depth === 2) return "bg-emerald-50";
    if (depth === 3) return "bg-violet-50";
    return "bg-amber-50";
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
          <Badge
            variant="outline"
            className={`${getNatureTone(deriveNature(a))} ${
              a._hasChildren ? "font-bold" : "font-semibold"
            }`}
          >
            {deriveNature(a)}
          </Badge>
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
                ? "bg-green-100 text-green-800 border-green-200"
                : "bg-red-100 text-red-800 border-red-200"
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
    <Card>
      <CardContent className="p-0">
        <CustomTable1
          data={groupedRows}
          fields={columns}
          pageSize={100}
          rowClassName={(row) =>
            row?._isGroupHeader
              ? "bg-slate-200/70 font-semibold"
              : `${getDepthTone(row?._depth || 0)} ${row?._hasChildren ? "font-semibold" : ""}`
          }
        />
      </CardContent>
    </Card>
  );
};

/* ====================== TREE LIST COMPONENT (3D VIEW) ====================== */
const AccountTreeList = ({
  accounts,
}) => {
  const isStandardSixDigitCode = (value) => /^[1-5]\d{5}$/.test(String(value || "").trim());

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
  const normalizedAccounts = flatAccountsList.filter((a) =>
    isStandardSixDigitCode(a.code || a.head),
  );
  const map = new Map();
  const treeRoots = [];
  normalizedAccounts.forEach((a) => {
    const code = String(a.code || a.head || "").trim();
    if (!code) return;
    map.set(code, {
      ...a,
      code,
      children: [],
    });
  });

  const findExistingAncestor = (code) => {
    const c = String(code || "").trim();
    if (!c) return "";
    for (let i = c.length - 1; i >= 1; i -= 1) {
      const candidate = c.slice(0, i);
      if (map.has(candidate)) return candidate;
    }
    return "";
  };

  map.forEach((node) => {
    const rawParent = String(
      node.parent_code || node.parentCode || node.subhead || "",
    ).trim();

    let parentCode = "";
    if (rawParent && rawParent !== "0" && rawParent !== node.code && map.has(rawParent)) {
      parentCode = rawParent;
    } else if (rawParent && rawParent !== "0" && rawParent !== node.code) {
      parentCode = findExistingAncestor(rawParent);
    }

    if (parentCode && map.has(parentCode) && parentCode !== node.code) {
      map.get(parentCode).children.push(node);
    } else {
      treeRoots.push(node);
    }
  });

  const toTreeData = (nodes) =>
    nodes
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((n) => ({
        title: `${n.code} - ${n.description || n.type || ""}`,
        subtitle: `${n.account_nature || n.accountNature || ""} | parent: ${
          n.parent_code || n.parentCode || n.subhead || "0"
        }`,
        expanded: String(n.code || "").length === 1,
        children: toTreeData(n.children || []),
      }));

  return (
    <Card>
      <CardContent className="p-4">
        {/* {JSON.stringify(toTreeData(treeRoots))} */}
        <div className="rounded-lg border p-2">
          <div className="text-sm font-semibold mb-2">Sortable Tree</div>
          <CustomTree treeData={toTreeData(treeRoots)} treeLoading={false} />
        </div>
      </CardContent>
    </Card>
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
  const [form, setForm] = useState(() => ({
    ...account,
    level: account?.level ?? account?.Level ?? "",
    category: account?.category ?? "",
    accountNature:
      account?.accountNature ?? account?.account_nature ?? account?.account_type ?? "",
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const merged = {
      ...form,
      level: form.level || account?.level,
      category: form.category || account?.category,
      accountNature:
        form.accountNature ||
        account?.accountNature ||
        account?.account_nature ||
        account?.account_type,
    };
    onSave(merged, true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row justify-between">
          <CardTitle>Edit Account</CardTitle>
          <Button variant="ghost" onClick={onCancel}>
            <X />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input value={form.head} disabled />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="flex gap-3">
              <CustomButton type="submit">Update</CustomButton>
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

/* ====================== SKELETON ====================== */
const AccountListSkeleton = () => (
  <Card>
    <CardContent className="p-0">
      <div className="p-4">
        <div className="grid grid-cols-5 gap-4 mb-4 pb-3 border-b">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
        {[...Array(10)].map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-4 mb-3 pb-3 border-b">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-20 mx-auto" />
            <Skeleton className="h-6 w-6 ml-auto" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);
