import React, { useState, useEffect } from "react";
import {
  Package,
  Calendar,
  Tag,
  Users,
  FileText,
  ArrowLeft,
  AlertCircle,
  TrendingUp,
  Package2,
  Filter,
  SortAsc,
  Download,
  Search,
  Settings,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { formatNumber1 } from "@/components/router/utilities";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import moment from "moment";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import useQuery from "@/hooks/useQuery";
import { isProductTaxable, normalizeTaxableStatus } from "@/utils/taxableStatus";

function txQtyIn(tx) {
  return parseFloat(tx.qty_in ?? tx.quantity_in ?? 0) || 0;
}

function txQtyOut(tx) {
  return parseFloat(tx.qty_out ?? tx.quantity_out ?? 0) || 0;
}

function txDelta(tx) {
  return txQtyIn(tx) - txQtyOut(tx);
}

function txTime(tx) {
  const raw = tx.createdAt || tx.inserted_time || tx.receive_date;
  return raw ? moment(raw).valueOf() : 0;
}

export default function InventoryItemView() {
  const dispatch = useDispatch();
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const { id: productId } = useParams();
  const query = useQuery();
  const location = useLocation();
  const type = query.get("type");
  const branchIdFromUrl = query.get("branchId") || "";
  const fromDateFromUrl = query.get("fromDate") || "";
  const toDateFromUrl = query.get("toDate") || "";
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [summaryStats, setSummaryStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [balanceBroughtForward, setBalanceBroughtForward] = useState(0);
  const [pendingToCollect, setPendingToCollect] = useState(0);
  const [pendingCollections, setPendingCollections] = useState([]);
  const [periodClosingBalance, setPeriodClosingBalance] = useState(0);
  const [filters, setFilters] = useState({
    type: "all",
    searchTerm: "",
    sortBy: "date",
    sortOrder: "desc",
    fromDate: fromDateFromUrl,
    toDate: toDateFromUrl,
    branchId: branchIdFromUrl || "all",
  });
  const [dateDraft, setDateDraft] = useState({
    fromDate: fromDateFromUrl,
    toDate: toDateFromUrl,
  });
  const [autoSaveOpen, setAutoSaveOpen] = useState(false);
  const [autoSaveSaving, setAutoSaveSaving] = useState(false);
  const [autoSaveForm, setAutoSaveForm] = useState({
    enabled: false,
    time: "18:00",
    timezone: "Africa/Lagos",
  });

  useEffect(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/account/get/branches?facilityId=${activeBusiness.id}`,
      (resp) => {
        const rows = resp?.results || resp?.data || resp || [];
        setBranches(Array.isArray(rows) ? rows : []);
      },
      () => setBranches([]),
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    if (branchIdFromUrl) {
      setFilters((prev) =>
        prev.branchId === branchIdFromUrl
          ? prev
          : { ...prev, branchId: branchIdFromUrl },
      );
    }
  }, [branchIdFromUrl]);

  const fetchItemDetails = (dateRange) => {
    if (!productId || !activeBusiness?.id) return;

    const fromDate = dateRange?.fromDate ?? filters.fromDate;
    const toDate = dateRange?.toDate ?? filters.toDate;

    setLoading(true);
    const salesTypeParam = type || "all";
    const params = new URLSearchParams({
      productId,
      facilityId: activeBusiness.id,
      salesType: salesTypeParam,
    });
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    if (filters.branchId && filters.branchId !== "all") {
      params.set("branchId", String(filters.branchId));
    }

    _fetchApi(
      `/inventory/store-entries/item-details?${params.toString()}`,
      (resp) => {
        setLoading(false);
        if (resp.success) {
          setItem(resp.data?.product || null);
          setTransactionHistory(resp.data?.transactionHistory || []);
          setFilteredHistory(resp.data?.transactionHistory || []);
          setSummaryStats(resp.data?.summaryStats || null);
          setBalanceBroughtForward(
            Number(resp.data?.balanceBroughtForward || 0),
          );
          setPendingToCollect(Number(resp.data?.pendingToCollect || 0));
          setPendingCollections(
            Array.isArray(resp.data?.pendingCollections)
              ? resp.data.pendingCollections
              : [],
          );
        } else {
          toast.error("Failed to load item details.");
        }
      },
      (err) => {
        setLoading(false);
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching item details.");
      },
    );
  };

  useEffect(() => {
    fetchItemDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch on product/facility/warehouse; dates apply on Run
  }, [productId, activeBusiness?.id, filters.branchId]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const writeDateQuery = (fromDate, toDate) => {
    const params = new URLSearchParams(location.search);
    if (fromDate) params.set("fromDate", fromDate);
    else params.delete("fromDate");
    if (toDate) params.set("toDate", toDate);
    else params.delete("toDate");
    const qs = params.toString();
    navigate(`${location.pathname}${qs ? `?${qs}` : ""}`, { replace: true });
  };

  const runDateFilter = () => {
    const next = {
      fromDate: dateDraft.fromDate,
      toDate: dateDraft.toDate,
    };
    if (next.fromDate && next.toDate && next.fromDate > next.toDate) {
      toast.error("From date must be on or before the to date");
      return;
    }
    setFilters((prev) => ({ ...prev, ...next }));
    writeDateQuery(next.fromDate, next.toDate);
    fetchItemDetails(next);
  };

  const clearDates = () => {
    setDateDraft({ fromDate: "", toDate: "" });
    setFilters((prev) => ({ ...prev, fromDate: "", toDate: "" }));
    writeDateQuery("", "");
    fetchItemDetails({ fromDate: "", toDate: "" });
  };

  const handleWarehouseChange = (value) => {
    handleFilterChange("branchId", value);
    const params = new URLSearchParams(location.search);
    if (!value || value === "all") params.delete("branchId");
    else params.set("branchId", value);
    const qs = params.toString();
    navigate(`${location.pathname}${qs ? `?${qs}` : ""}`, { replace: true });
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  // Apply filters whenever filters or transaction history changes
  useEffect(() => {
    const opening = Number(balanceBroughtForward) || 0;

    if (!transactionHistory.length) {
      setFilteredHistory([]);
      setPeriodClosingBalance(opening);
      return;
    }

    let filtered = [...transactionHistory];

    // Filter by date range (client-side as well, using createdAt / inserted_time)
    if (filters.fromDate || filters.toDate) {
      filtered = filtered.filter((tx) => {
        const raw = tx.createdAt || tx.inserted_time || tx.receive_date;
        if (!raw) return false;
        const day = moment(raw).format("YYYY-MM-DD");
        if (filters.fromDate && day < filters.fromDate) return false;
        if (filters.toDate && day > filters.toDate) return false;
        return true;
      });
    }

    // Filter by warehouse (branchId)
    if (filters.branchId && filters.branchId !== "all") {
      filtered = filtered.filter(
        (tx) => String(tx.branchId ?? tx.branch_id ?? "") === String(filters.branchId),
      );
    }

    const chrono = [...filtered].sort((a, b) => {
      const timeDiff = txTime(a) - txTime(b);
      if (timeDiff !== 0) return timeDiff;
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });

    let running = opening;
    const withBalance = chrono.map((tx) => {
      running += txDelta(tx);
      return { ...tx, running_balance: running };
    });
    setPeriodClosingBalance(running);

    let display = withBalance;

    // Filter by type (running balance already includes every movement in the period)
    if (filters.type !== "all") {
      const wanted =
        filters.type === "in"
          ? "IN"
          : filters.type === "out"
            ? "OUT"
            : filters.type === "reverse"
              ? "REVERSE"
              : filters.type === "return"
                ? "RETURN"
                : String(filters.type).toUpperCase();
      display = display.filter((tx) => tx.movement_type === wanted);
    }

    // Filter by search term
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      display = display.filter(tx =>
        (tx.reference_number && tx.reference_number.toLowerCase().includes(term)) ||
        (tx.source_info && tx.source_info.toLowerCase().includes(term)) ||
        (tx.destination_info && tx.destination_info.toLowerCase().includes(term)) ||
        (tx.warehouse_name && tx.warehouse_name.toLowerCase().includes(term)) ||
        (tx.transaction_description && tx.transaction_description.toLowerCase().includes(term))
      );
    }

    // Sort
    display.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'date':
          comparison = txTime(b) - txTime(a);
          break;
        case 'quantity':
          comparison = Math.max(txQtyIn(b), txQtyOut(b)) - Math.max(txQtyIn(a), txQtyOut(a));
          break;
        case 'value':
          comparison = (b.transaction_value || 0) - (a.transaction_value || 0);
          break;
        default:
          comparison = txTime(b) - txTime(a);
      }

      return filters.sortOrder === 'desc' ? comparison : -comparison;
    });

    setFilteredHistory(display);
  }, [transactionHistory, filters, balanceBroughtForward]);

  const totalQtyIn = filteredHistory.reduce((sum, tx) => sum + txQtyIn(tx), 0);
  const totalQtyOut = filteredHistory.reduce((sum, tx) => sum + txQtyOut(tx), 0);

  const exportToPdf = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const rowH = 6.2;
      const colW = [32, 26, 60, 55, 32, 32, 34];
      const headers = ["Date", "Movement", "Reference", "Warehouse", "Qty In", "Qty Out", "Balance"];
      const storeName =
        filters.branchId && filters.branchId !== "all"
          ? branches.find((b) => String(b.id) === String(filters.branchId))
              ?.branch_name || "Store"
          : "All stores";
      const period =
        filters.fromDate || filters.toDate
          ? `${filters.fromDate ? moment(filters.fromDate).format("DD/MM/YYYY") : "Start"} - ${
              filters.toDate ? moment(filters.toDate).format("DD/MM/YYYY") : "Today"
            }`
          : "All dates";
      const unit = item?.unit_of_measure ? ` ${item.unit_of_measure}` : "";
      const productName = item?.name || item?.item_name || "Item";
      const businessName = activeBusiness?.business_name || activeBusiness?.name || "";

      const movementLabel = (tx) => {
        if (tx.movement_type === "REVERSE") return "Reverse";
        if (tx.movement_type === "RETURN") return "Return";
        return tx.movement_type || "";
      };

      const rows = [
        [
          filters.fromDate ? moment(filters.fromDate).format("DD/MM/YYYY") : "",
          "B/F",
          "Balance brought forward",
          "",
          "",
          "",
          formatNumber1(balanceBroughtForward),
        ],
        ...filteredHistory.map((tx) => [
          tx.createdAt || tx.inserted_time
            ? moment(tx.createdAt || tx.inserted_time).format("DD/MM/YYYY")
            : "",
          movementLabel(tx),
          tx.reference_number || "-",
          tx.warehouse_name || tx.branch_name || "",
          txQtyIn(tx) > 0 ? formatNumber1(txQtyIn(tx)) : "-",
          txQtyOut(tx) > 0 ? formatNumber1(txQtyOut(tx)) : "-",
          formatNumber1(tx.running_balance ?? 0),
        ]),
        [
          "",
          "",
          "Total",
          "",
          formatNumber1(totalQtyIn),
          formatNumber1(totalQtyOut),
          formatNumber1(periodClosingBalance),
        ],
      ];

      const summaryBoxes = [
        {
          label: "In",
          value: `${formatNumber1(totalQtyIn)}${unit}`,
          color: [22, 101, 52],
        },
        {
          label: "Out",
          value: `${formatNumber1(totalQtyOut)}${unit}`,
          color: [153, 27, 27],
        },
        {
          label: "Pending to collect",
          value: `${formatNumber1(pendingToCollect)}${unit}`,
          color: [146, 64, 14],
        },
        {
          label: "Closing balance",
          value: `${formatNumber1(periodClosingBalance)}${unit}`,
          color: [15, 23, 42],
        },
      ];

      const drawHeader = () => {
        doc.setFillColor(15, 39, 68);
        doc.rect(0, 0, pageWidth, 16, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(businessName || "Inventory report", margin, 7);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(
          `Stock movement  ·  ${productName}  ·  ${item?.sku || ""}`,
          margin,
          13,
        );
        doc.text(`${storeName}  ·  ${period}`, pageWidth - margin, 13, {
          align: "right",
        });

        const boxY = 19;
        const boxH = 14;
        const gap = 3;
        const boxW =
          (pageWidth - margin * 2 - gap * (summaryBoxes.length - 1)) /
          summaryBoxes.length;
        summaryBoxes.forEach((box, i) => {
          const x = margin + i * (boxW + gap);
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.rect(x, boxY, boxW, boxH, "FD");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(box.label.toUpperCase(), x + 3, boxY + 5);
          doc.setFontSize(11);
          doc.setTextColor(...box.color);
          doc.text(box.value, x + 3, boxY + 11);
        });
        return boxY + boxH + 3;
      };

      const drawColumns = (y) => {
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, y, pageWidth - margin * 2, rowH, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        let x = margin;
        headers.forEach((label, i) => {
          const right = i >= 4;
          doc.text(label, right ? x + colW[i] - 1.5 : x + 1.5, y + 4.2, {
            align: right ? "right" : "left",
          });
          x += colW[i];
        });
        return y + rowH;
      };

      let y = drawHeader();
      y = drawColumns(y);

      rows.forEach((cells, index) => {
        if (y > pageHeight - 12) {
          doc.addPage();
          y = drawColumns(drawHeader());
        }
        const isTotal = index === rows.length - 1;
        const isBroughtForward = index === 0;
        if (isTotal) doc.setFillColor(241, 245, 249);
        else if (isBroughtForward) doc.setFillColor(255, 251, 235);
        else if (index % 2 === 0) doc.setFillColor(248, 250, 252);
        else doc.setFillColor(255, 255, 255);
        doc.rect(margin, y, pageWidth - margin * 2, rowH, "F");
        doc.setFont("helvetica", isTotal || isBroughtForward ? "bold" : "normal");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        let x = margin;
        cells.forEach((text, i) => {
          const right = i >= 4;
          const value = String(text ?? "");
          doc.text(value, right ? x + colW[i] - 1.5 : x + 1.5, y + 4.2, {
            align: right ? "right" : "left",
            maxWidth: colW[i] - 3,
          });
          x += colW[i];
        });
        y += rowH;
      });

      const pageCount = doc.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 5, {
          align: "right",
        });
      }

      const sku = item?.sku || "item";
      doc.save(`inventory-${sku}-${filters.fromDate || "all"}-${filters.toDate || "all"}.pdf`);
      toast.success("PDF downloaded");
    } catch (error) {
      console.error(error);
      toast.error("Could not download the PDF");
    }
  };

  const openAutoSave = () => {
    setAutoSaveForm({
      enabled: Boolean(activeBusiness?.recon_auto_save_enabled),
      time: activeBusiness?.recon_auto_save_time || "18:00",
      timezone: activeBusiness?.recon_auto_save_timezone || "Africa/Lagos",
    });
    setAutoSaveOpen(true);
  };

  const saveAutoSaveSettings = () => {
    if (!activeBusiness?.id || !user?.id) return;
    if (!/^\d{2}:\d{2}$/.test(String(autoSaveForm.time || ""))) {
      toast.error("Time must be HH:mm");
      return;
    }
    const headsReady = [
      activeBusiness?.recon_cash_account_code,
      activeBusiness?.recon_safe_account_code,
      activeBusiness?.recon_shortage_account_code,
    ].every((code) => String(code || "").trim());
    if (autoSaveForm.enabled && !headsReady) {
      toast.error(
        "Set Cash, Safe, and Shortage heads in Admin settings before automatic save",
      );
      return;
    }
    setAutoSaveSaving(true);
    _postApi(
      `/account/update-recon-auto-save/${activeBusiness.id}/${user.id}`,
      {
        recon_auto_save_enabled: Boolean(autoSaveForm.enabled),
        recon_auto_save_time: autoSaveForm.time,
        recon_auto_save_timezone: autoSaveForm.timezone || "Africa/Lagos",
      },
      (resp) => {
        setAutoSaveSaving(false);
        if (resp?.success) {
          const saved = resp.results?.dataValues || resp.results || {};
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: {
              business: {
                ...activeBusiness,
                ...saved,
                id: activeBusiness.id,
              },
            },
          });
          setAutoSaveOpen(false);
          toast.success("Automatic save updated");
        } else {
          toast.error(resp?.message || "Could not save the schedule");
        }
      },
      (err) => {
        setAutoSaveSaving(false);
        toast.error(err?.message || "Could not save the schedule");
      },
    );
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoBack}
              className="mb-2 flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Main Content */}
            <div className="lg:col-span-3 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Item Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Transaction History</span>
                    <Badge variant="outline">{filteredHistory.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-48 w-full" />
                </CardContent>
              </Card>
            </div>
            
            {/* Sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Inventory Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoBack}
              className="mb-2 flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
          
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-400 mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Item Not Found</h2>
            <p className="text-sm text-gray-600 mb-4">The requested inventory item could not be found.</p>
            <Button onClick={handleGoBack} size="sm">Go Back to Inventory</Button>
          </div>
        </div>
      </div>
    );
  }

  const bfDateLabel = filters.fromDate
    ? moment(filters.fromDate).format("DD/MM/YYYY")
    : "";
  const broughtForwardRow = (
    <TableRow className="text-xs bg-amber-50 hover:bg-amber-50">
      <TableCell className="py-1.5 whitespace-nowrap">
        {bfDateLabel ? (
          <div className="font-medium text-amber-900">{bfDateLabel}</div>
        ) : (
          <span className="text-amber-800/70">—</span>
        )}
      </TableCell>
      <TableCell className="py-1.5">
        <Badge
          variant="outline"
          className="text-xs border-amber-300 bg-amber-100 text-amber-900"
        >
          B/F
        </Badge>
      </TableCell>
      <TableCell className="py-1.5 font-medium text-amber-950" colSpan={2}>
        Balance brought forward
      </TableCell>
      <TableCell className="py-1.5 text-right text-gray-300">—</TableCell>
      <TableCell className="py-1.5 text-right text-gray-300">—</TableCell>
      <TableCell className="py-1.5 text-right font-bold tabular-nums text-amber-950">
        {formatNumber1(balanceBroughtForward)}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoBack}
            className="mb-2 flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-gray-900 truncate">{item.item_name}</h1>
              <div className="flex items-center gap-2 mt-1">
                {item.category && (
                  <Badge variant="secondary" className="text-xs">
                    {item.category}
                  </Badge>
                )}
                {item.type && (
                  <Badge 
                    variant={item.type === "Finished Good" ? "default" : 
                            item.type === "Raw Material" ? "outline" : "secondary"}
                    className="text-xs"
                  >
                    {item.type}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-4">
            {/* Item Details Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Item Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Item Name</p>
                    <p className="text-sm font-medium text-gray-900">{item.name || item.item_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">SKU / Code</p>
                    <p className="text-sm text-gray-900">{item.sku || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Category</p>
                    <p className="text-sm text-gray-900">{item.category || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Item Type</p>
                    <p className="text-sm text-gray-900">{item.item_type || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Unit of Measure</p>
                    <p className="text-sm text-gray-900">{item.unit_of_measure || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Status</p>
                    <Badge variant={item.status === 'Active' ? 'default' : 'destructive'} className="text-xs">
                      {item.status || 'N/A'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Current Stock</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatNumber1(item.current_stock || 0)}
                      <span className="text-xs font-normal text-gray-500 ml-1">{item.unit_of_measure || 'units'}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Pending to collect</p>
                    <p className="text-lg font-semibold text-amber-700">
                      {formatNumber1(pendingToCollect)}
                      <span className="text-xs font-normal text-gray-500 ml-1">{item.unit_of_measure || 'units'}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Taxable</p>
                    <Badge variant={isProductTaxable(item.taxable) ? 'default' : 'outline'} className="text-xs">
                      {normalizeTaxableStatus(item.taxable, item.taxable || 'N/A')}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Reorder Level</p>
                    <p className="text-sm text-gray-900">{formatNumber1(item.reorder_level || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Warehouse</p>
                    <Select
                      value={filters.branchId || "all"}
                      onValueChange={handleWarehouseChange}
                    >
                      <SelectTrigger className="h-8 w-full max-w-[220px] text-xs mt-0.5">
                        <SelectValue placeholder="Warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All warehouses</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            {b.branch_name || `Warehouse ${b.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Tags</p>
                    <p className="text-sm text-gray-900">{item.tags || 'None'}</p>
                  </div>
                </div>
                {item.notes && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-500 mb-0.5">Notes</p>
                    <p className="text-sm text-gray-700">{item.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {pendingCollections.length > 0 ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Pending to collect</span>
                    <span className="text-sm font-semibold text-amber-700">
                      {formatNumber1(pendingToCollect)} {item.unit_of_measure || ""}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Invoice</TableHead>
                        <TableHead className="text-xs">Customer</TableHead>
                        <TableHead className="text-xs text-right">Sold</TableHead>
                        <TableHead className="text-xs text-right">Collected</TableHead>
                        <TableHead className="text-xs text-right">Waiting</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingCollections.map((row) => (
                        <TableRow key={row.sale_code} className="text-xs">
                          <TableCell className="py-1.5 font-medium">
                            <Link
                              to="/app/sales/warehouse-requests"
                              className="text-blue-700 underline underline-offset-2"
                            >
                              {row.sale_code}
                            </Link>
                          </TableCell>
                          <TableCell className="py-1.5">
                            {row.customer_name || "—"}
                          </TableCell>
                          <TableCell className="py-1.5 text-right tabular-nums">
                            {formatNumber1(row.qty_sold)}
                          </TableCell>
                          <TableCell className="py-1.5 text-right tabular-nums">
                            {formatNumber1(row.qty_collected)}
                          </TableCell>
                          <TableCell className="py-1.5 text-right font-semibold tabular-nums text-amber-700">
                            {formatNumber1(row.qty_pending)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null}

            {/* Transaction History Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Transaction History
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{filteredHistory.length} records</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={exportToPdf}
                      title="Download PDF"
                      className="h-8 px-2 text-xs"
                    >
                      <Download className="h-4 w-4" />
                      PDF
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={openAutoSave}
                      title="Set the time for automatic save"
                      className="h-8 w-8 p-0"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Filters */}
                <div className="p-4 border-b flex flex-wrap gap-2 items-center">
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor="history-from-date"
                      className="text-[11px] font-medium text-slate-500 whitespace-nowrap"
                    >
                      From
                    </label>
                    <Input
                      id="history-from-date"
                      type="date"
                      value={dateDraft.fromDate}
                      onChange={(e) =>
                        setDateDraft((prev) => ({
                          ...prev,
                          fromDate: e.target.value,
                        }))
                      }
                      className="h-8 w-[9.5rem] text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor="history-to-date"
                      className="text-[11px] font-medium text-slate-500 whitespace-nowrap"
                    >
                      To
                    </label>
                    <Input
                      id="history-to-date"
                      type="date"
                      value={dateDraft.toDate}
                      min={dateDraft.fromDate || undefined}
                      onChange={(e) =>
                        setDateDraft((prev) => ({
                          ...prev,
                          toDate: e.target.value,
                        }))
                      }
                      className="h-8 w-[9.5rem] text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-3 text-xs bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white"
                    onClick={runDateFilter}
                  >
                    Run
                  </Button>
                  {(dateDraft.fromDate ||
                    dateDraft.toDate ||
                    filters.fromDate ||
                    filters.toDate) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-slate-500"
                      onClick={clearDates}
                    >
                      Clear dates
                    </Button>
                  )}

                  <Select
                    value={filters.branchId || "all"}
                    onValueChange={handleWarehouseChange}
                  >
                    <SelectTrigger className="w-44 h-8 text-xs">
                      <SelectValue placeholder="Warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All warehouses</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.branch_name || `Warehouse ${b.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select 
                    value={filters.type} 
                    onValueChange={(value) => handleFilterChange('type', value)}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="in">Received (IN)</SelectItem>
                      <SelectItem value="out">Issued (OUT)</SelectItem>
                      <SelectItem value="reverse">Reverse</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select 
                    value={filters.sortBy} 
                    onValueChange={(value) => handleFilterChange('sortBy', value)}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="quantity">Quantity</SelectItem>
                      <SelectItem value="value">Value</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select 
                    value={filters.sortOrder} 
                    onValueChange={(value) => handleFilterChange('sortOrder', value)}
                  >
                    <SelectTrigger className="w-24 h-8 text-xs">
                      <SelectValue placeholder="Order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Descending</SelectItem>
                      <SelectItem value="asc">Ascending</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <div className="relative flex-1 min-w-32">
                    <Input
                      type="text"
                      placeholder="Search..."
                      value={filters.searchTerm}
                      onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                      className="h-8 text-xs pl-7"
                    />
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                  </div>
                </div>
                
                {/* Transaction Table */}
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10">
                      <TableRow>
                        <TableHead className="text-xs py-2 whitespace-nowrap">Date</TableHead>
                        <TableHead className="text-xs py-2">Movement</TableHead>
                        <TableHead className="text-xs py-2">Reference</TableHead>
                        <TableHead className="text-xs py-2">Warehouse</TableHead>
                        <TableHead className="text-xs py-2 text-right">Qty In</TableHead>
                        <TableHead className="text-xs py-2 text-right">Qty Out</TableHead>
                        <TableHead className="text-xs py-2 text-right whitespace-nowrap">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {broughtForwardRow}
                      {filteredHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                            <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            No transaction history found
                            {filters.fromDate || filters.toDate
                              ? " in this date range"
                              : ""}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredHistory.map((tx, index) => (
                          <TableRow key={tx.id || index} className="text-xs hover:bg-gray-50">
                            <TableCell className="py-1.5 whitespace-nowrap">
                              <div className="font-medium">{moment(tx.createdAt).format('DD/MM/YYYY')}</div>
                              <div className="text-gray-400">{moment(tx.createdAt).format('hh:mm A')}</div>
                            </TableCell>

                            <TableCell className="py-1.5">
                              <Badge
                                variant={
                                  tx.movement_type === "IN"
                                    ? "default"
                                    : tx.movement_type === "OUT"
                                      ? "destructive"
                                      : "outline"
                                }
                                className={
                                  tx.movement_type === "REVERSE"
                                    ? "text-xs border-amber-300 bg-amber-50 text-amber-800"
                                    : tx.movement_type === "RETURN"
                                      ? "text-xs border-sky-300 bg-sky-50 text-sky-800"
                                      : "text-xs"
                                }
                              >
                                {tx.movement_type === "REVERSE"
                                  ? "Reverse"
                                  : tx.movement_type === "RETURN"
                                    ? "Return"
                                    : tx.movement_type}
                              </Badge>
                            </TableCell>

                            <TableCell className="py-1.5">
                              <div className="font-medium">{tx.reference_number || '-'}</div>
                              {tx.movement_type === "REVERSE" ? (
                                <div className="text-amber-700">Invoice reversed</div>
                              ) : tx.supplier_code ? (
                                <div className="text-gray-400">{tx.supplier_code}</div>
                              ) : null}
                            </TableCell>

                            <TableCell className="py-1.5">
                              {tx.warehouse_name ||
                                tx.branch_name ||
                                (tx.branchId != null
                                  ? branches.find(
                                      (b) =>
                                        String(b.id) === String(tx.branchId),
                                    )?.branch_name
                                  : null) ||
                                "-"}
                            </TableCell>

                            <TableCell className="py-1.5 text-right">
                              {txQtyIn(tx) > 0 ? (
                                <span className="text-green-600 font-medium">+{formatNumber1(txQtyIn(tx))}</span>
                              ) : <span className="text-gray-300">-</span>}
                            </TableCell>

                            <TableCell className="py-1.5 text-right">
                              {txQtyOut(tx) > 0 ? (
                                <span className="text-red-600 font-medium">-{formatNumber1(txQtyOut(tx))}</span>
                              ) : <span className="text-gray-300">-</span>}
                            </TableCell>

                            <TableCell className="py-1.5 text-right font-semibold tabular-nums text-slate-900">
                              {formatNumber1(tx.running_balance ?? 0)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      <TableRow className="text-xs bg-slate-50 hover:bg-slate-50">
                        <TableCell className="py-1.5" colSpan={4}>
                          <span className="font-semibold text-slate-800">
                            Total
                          </span>
                          {filters.fromDate || filters.toDate ? (
                            <span className="text-slate-500 font-normal">
                              {" "}
                              for selected dates
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="py-1.5 text-right">
                          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                            Total in
                          </div>
                          <div className="font-bold tabular-nums text-green-700">
                            {formatNumber1(totalQtyIn)}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5 text-right">
                          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                            Total out
                          </div>
                          <div className="font-bold tabular-nums text-red-700">
                            {formatNumber1(totalQtyOut)}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5 text-right">
                          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                            Closing
                          </div>
                          <div className="font-bold tabular-nums text-slate-900">
                            {formatNumber1(periodClosingBalance)}
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Inventory Summary Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package2 className="h-4 w-4" />
                  Inventory Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-xs text-gray-600 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    Total In
                  </span>
                  <span className="text-sm font-medium text-green-600">
                    {formatNumber1(totalQtyIn)} {item.unit_of_measure || ''}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-xs text-gray-600 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-red-500 rotate-180" />
                    Total Out
                  </span>
                  <span className="text-sm font-medium text-red-600">
                    {formatNumber1(totalQtyOut)} {item.unit_of_measure || ''}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-xs text-gray-600">Pending to collect</span>
                  <span className="text-sm font-medium text-amber-700">
                    {formatNumber1(pendingToCollect)} {item.unit_of_measure || ''}
                  </span>
                </div>
                {(filters.fromDate || filters.toDate) && (
                  <>
                    <div className="flex justify-between items-center py-1 border-b">
                      <span className="text-xs text-gray-500">Balance brought forward</span>
                      <span className="text-sm font-medium tabular-nums">
                        {formatNumber1(balanceBroughtForward)} {item.unit_of_measure || ""}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b">
                      <span className="text-xs text-gray-500">Closing (period)</span>
                      <span className="text-sm font-medium tabular-nums">
                        {formatNumber1(periodClosingBalance)} {item.unit_of_measure || ""}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-xs text-gray-600 flex items-center gap-1">
                    <Package className="h-3 w-3 text-blue-500" />
                    Current Balance
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    {formatNumber1(item.current_stock || 0)} {item.unit_of_measure || ''}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-xs text-gray-500">Total Transactions</span>
                  <span className="text-sm font-medium">{summaryStats?.transactionCount || 0}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-xs text-gray-500">Purchases</span>
                  <span className="text-sm">{summaryStats?.purchaseCount || 0}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-xs text-gray-500">Sales</span>
                  <span className="text-sm">{summaryStats?.salesCount || 0}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-xs text-gray-500">Reverse</span>
                  <span className="text-sm">{summaryStats?.reverseCount || 0}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-xs text-gray-500">WIP</span>
                  <span className="text-sm">{summaryStats?.wipCount || 0}</span>
                </div>
                {item.current_stock <= item.reorder_level && item.current_stock > 0 && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-xs text-yellow-800">
                      <AlertCircle className="h-3 w-3 inline mr-1" />
                      Reorder level reached
                    </p>
                  </div>
                )}
                {parseFloat(item.current_stock) === 0 && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-xs text-red-800">
                      <AlertCircle className="h-3 w-3 inline mr-1" />
                      Out of stock
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={autoSaveOpen} onOpenChange={setAutoSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Automatic save
            </DialogTitle>
            <DialogDescription>
              After this time each day, open hand-ins are saved. Cash moves to
              Safe only when the Cash, Safe, and Shortage heads are all set.
              A ledger line is not posted if any of those heads is missing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={autoSaveForm.enabled}
                onChange={(e) =>
                  setAutoSaveForm((prev) => ({
                    ...prev,
                    enabled: e.target.checked,
                  }))
                }
              />
              Save automatically
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-slate-600">
                Time
                <Input
                  type="time"
                  value={autoSaveForm.time}
                  onChange={(e) =>
                    setAutoSaveForm((prev) => ({
                      ...prev,
                      time: e.target.value,
                    }))
                  }
                  className="mt-1 h-9"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Timezone
                <select
                  value={autoSaveForm.timezone}
                  onChange={(e) =>
                    setAutoSaveForm((prev) => ({
                      ...prev,
                      timezone: e.target.value,
                    }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value="Africa/Lagos">Africa/Lagos</option>
                  <option value="Africa/Accra">Africa/Accra</option>
                  <option value="UTC">UTC</option>
                </select>
              </label>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <p className="mb-1 font-semibold text-slate-800">Ledger heads</p>
              {[
                ["Cash", activeBusiness?.recon_cash_account_code],
                ["Safe", activeBusiness?.recon_safe_account_code],
                ["Shortage", activeBusiness?.recon_shortage_account_code],
              ].map(([label, code]) => (
                <p key={label}>
                  {label}: {code ? String(code) : "Not set"}
                </p>
              ))}
            </div>
            {activeBusiness?.recon_auto_save_last_run ? (
              <p className="text-xs text-slate-500">
                Last automatic save: {activeBusiness.recon_auto_save_last_run}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAutoSaveOpen(false)}
              disabled={autoSaveSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveAutoSaveSettings}
              disabled={autoSaveSaving}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}