import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { _fetchApi, _deleteApi, apiURL } from "@/redux/actions/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Edit,
  Plus,
  Upload,
  File,
  X,
  Eye,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import EstimateModal from "./EstimateModal";

export default function ProjectDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [timeActivity, setTimeActivity] = useState([]);
  const [timeSummary, setTimeSummary] = useState({
    total_hours: 0,
    total_cost: 0,
    entry_count: 0,
  });
  const [reports, setReports] = useState(null);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingTimeActivity, setLoadingTimeActivity] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [estimates, setEstimates] = useState([]);
  const [loadingEstimates, setLoadingEstimates] = useState(false);
  const [employeeRateView, setEmployeeRateView] = useState("hourly");
  const [hourlyCostDrawerOpen, setHourlyCostDrawerOpen] = useState(false);
  const [employeeCostRates, setEmployeeCostRates] = useState([]);

  const loadProject = useCallback(() => {
    if (id && facilityId) {
      _fetchApi(
        `/api/projects/${facilityId}/${id}`,
        (response) => {
          if (response.success) {
            setProject(response.data);
            // Set documents from the combined API response
            setDocuments(response.data.documents || []);
          }
          setLoading(false);
        },
        (err) => {
          console.error("Error loading project:", err);
          setLoading(false);
        },
      );
    }
  }, [id, facilityId]);

  const loadTransactions = useCallback(() => {
    if (id && facilityId) {
      setLoadingTransactions(true);
      _fetchApi(
        `/api/projects/${facilityId}/${id}/transactions`,
        (response) => {
          if (response.success) {
            setTransactions(response.transactions || []);
          }
          setLoadingTransactions(false);
        },
        (err) => {
          console.error("Error loading transactions:", err);
          setLoadingTransactions(false);
        },
      );
    }
  }, [id, facilityId]);

  const loadTimeActivity = useCallback(() => {
    if (id && facilityId) {
      setLoadingTimeActivity(true);
      _fetchApi(
        `/api/projects/${facilityId}/${id}/time-activity`,
        (response) => {
          if (response.success) {
            setTimeActivity(response.timeEntries || []);
            setTimeSummary(
              response.summary || {
                total_hours: 0,
                total_cost: 0,
                entry_count: 0,
              },
            );
          }
          setLoadingTimeActivity(false);
        },
        (err) => {
          console.error("Error loading time activity:", err);
          setLoadingTimeActivity(false);
        },
      );
    }
  }, [id, facilityId]);

  const loadReports = useCallback(() => {
    if (id && facilityId) {
      setLoadingReports(true);
      _fetchApi(
        `/api/projects/${facilityId}/${id}/reports`,
        (response) => {
          if (response.success) {
            setReports(response.reports);
          }
          setLoadingReports(false);
        },
        (err) => {
          console.error("Error loading reports:", err);
          setLoadingReports(false);
        },
      );
    }
  }, [id, facilityId]);

  const loadEstimates = useCallback(() => {
    const projectNumber = project?.project_number || id;
    if (projectNumber && facilityId) {
      setLoadingEstimates(true);
      _fetchApi(
        `/api/estimates/${facilityId}?project_number=${encodeURIComponent(projectNumber)}`,
        (response) => {
          if (response?.success) {
            setEstimates(response.data || []);
          }
          setLoadingEstimates(false);
        },
        (err) => {
          console.error("Error loading estimates:", err);
          setLoadingEstimates(false);
        },
      );
    }
  }, [facilityId, project?.project_number, id]);

  useEffect(() => {
    loadProject();
    loadTransactions();
    loadTimeActivity();
    loadReports();
  }, [loadProject, loadTransactions, loadTimeActivity, loadReports]);

  useEffect(() => {
    if (project?.project_number || id) {
      loadEstimates();
    }
  }, [loadEstimates, project?.project_number, id]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      "not-started": { label: "Not Started", variant: "secondary" },
      "in-progress": { label: "In progress", variant: "default" },
      "on-hold": { label: "On Hold", variant: "warning" },
      completed: { label: "Completed", variant: "success" },
      cancelled: { label: "Cancelled", variant: "destructive" },
    };
    return statusMap[status] || statusMap["not-started"];
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <p className="text-red-500">Project not found</p>
        <Button
          onClick={() => navigate("/app/projects/project-list")}
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>
      </div>
    );
  }

  // Filter invoices from transactions
  const invoices = transactions.filter(
    (t) => t.type === "invoice" && t.amount > 0,
  );
  const totalInvoices = invoices.reduce(
    (sum, inv) => sum + parseFloat(inv.amount || 0),
    0,
  );
  const openInvoices = invoices.filter(
    (inv) => inv.status !== "posted" || !inv.status,
  );
  const totalOpenInvoices = openInvoices.reduce(
    (sum, inv) => sum + parseFloat(inv.amount || 0),
    0,
  );

  // Calculate expenses and bills from transactions
  const expenses = transactions.filter(
    (t) => t.type === "expense" && t.amount < 0,
  );
  const bills = transactions.filter((t) => t.type === "bill" && t.amount < 0);
  const totalExpenses = Math.abs(
    expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0),
  );
  const totalBills = Math.abs(
    bills.reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0),
  );

  // Include estimates total as potential income
  const totalEstimates = estimates.reduce(
    (sum, e) => sum + parseFloat(e.total || 0),
    0,
  );

  // Calculate from actual data
  const income = totalInvoices + totalEstimates;
  const costs =
    totalBills + totalExpenses + (timeSummary?.total_cost || 0);
  const profit = income - costs;
  const profitMargin =
    income > 0 ? ((profit / income) * 100).toFixed(1) : 0;

  const statusInfo = getStatusBadge(project.progress_status);

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    setUploading(true);
    const token = localStorage.getItem("@@__token");

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });
      selectedFiles.forEach((file) => {
        formData.append("document_names", file.name);
      });

      const response = await fetch(
        `${apiURL}/api/projects/${facilityId}/${id}/documents`,
        {
          method: "POST",
          body: formData,
          headers: {
            authorization: token,
          },
        },
      );

      const data = await response.json();

      if (data.success) {
        toast.success("Files uploaded successfully");
        setSelectedFiles([]);
        // Reload project data which now includes documents
        loadProject();
      } else {
        toast.error(data.message || "Failed to upload files");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("An error occurred while uploading files");
    } finally {
      setUploading(false);
    }
  };

  const viewDocument = (doc) => {
    const fileUrl = `${apiURL}/public/uploads/${doc.file_path}`;
    window.open(fileUrl, "_blank");
  };

  const handleDeleteDocument = async (transactionId) => {
    if (!window.confirm("Are you sure you want to delete this document?")) {
      return;
    }

    const token = localStorage.getItem("@@__token");
    try {
      const response = await fetch(
        `${apiURL}/api/projects/${facilityId}/${id}/documents/${transactionId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            authorization: token,
          },
        },
      );

      const data = await response.json();

      if (data.success) {
        toast.success("Document deleted successfully");
        // Reload project data which now includes documents
        loadProject();
      } else {
        toast.error(data.message || "Failed to delete document");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("An error occurred while deleting the document");
    }
  };

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/app/projects/project-list"
              className="text-[var(--aa-accent)] hover:text-[var(--aa-accent-hover)] flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              All projects
            </Link>
          </div>
        </div>

        {/* Project Title and Info */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{project.project_name}</h1>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <p className="text-muted-foreground">
              {project.customer} | {statusInfo.label}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-2" />
              Add to project
            </Button>
          </div>
        </div>

        {/* Summary Cards - ESTIMATES VS. ACTUALS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                ESTIMATES VS. ACTUALS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-[auto_1fr_auto] gap-3 items-center">
                {/* Row 1: Income */}
                <span className="font-semibold text-green-600 text-sm">
                  {formatCurrency(income)}
                </span>
                <Progress
                  value={
                    income + costs > 0
                      ? Math.min(100, (income / (income + costs)) * 100)
                      : 0
                  }
                  className="h-2 [&>*]:bg-green-500"
                />
                <button
                  type="button"
                  onClick={() => setShowEstimateModal(true)}
                  className="text-sm text-[var(--aa-accent)] hover:underline text-left"
                >
                  + add
                </button>
                {/* Row 2: Costs */}
                <span
                  className={`font-semibold text-sm ${costs > income ? "text-red-600" : "text-gray-700"}`}
                >
                  {formatCurrency(costs)}
                </span>
                <Progress
                  value={
                    income + costs > 0
                      ? Math.min(100, (costs / (income + costs)) * 100)
                      : 0
                  }
                  className="h-2 [&>*]:bg-teal-500"
                />
                <button
                  type="button"
                  onClick={() => setShowEstimateModal(true)}
                  className="text-sm text-[var(--aa-accent)] hover:underline text-left"
                >
                  + add
                </button>
              </div>

            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p
                className={`text-2xl font-bold ${profit < 0 ? "text-red-600" : "text-green-600"}`}
              >
                {profitMargin}%
              </p>
              <p className="text-sm text-gray-500 mt-1">Profit margin</p>
              <Link
                to={`/app/sales/sale${id ? `?projectId=${id}` : ""}`}
                className="text-sm text-[var(--aa-accent)] hover:underline mt-2 inline-block"
              >
                View all
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">
                {formatCurrency(totalOpenInvoices)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Overdue Invoices</p>
              <Link
                to={`/app/sales/sale${id ? `?projectId=${id}` : ""}`}
                className="text-sm text-[var(--aa-accent)] hover:underline mt-2 inline-block"
              >
                View all
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">
              Overview
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex-1">
              Transactions
            </TabsTrigger>
            <TabsTrigger value="time-activity" className="flex-1">
              Time Activity
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex-1">
              Project Reports
            </TabsTrigger>
            <TabsTrigger value="attachments" className="flex-1">
              Attachments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Employee rate / Hourly Costs - click opens side modal */}
            <button
              type="button"
              onClick={() => setHourlyCostDrawerOpen(true)}
              className="flex items-center gap-2 text-left hover:opacity-80"
            >
              <span className="text-sm font-medium text-gray-600">
                Employee rate
              </span>
              <span className="px-3 py-1.5 text-sm border rounded-md bg-white min-w-[180px] text-left">
                Hourly Costs
              </span>
            </button>

            {/* Summary Row: INCOME - COSTS = PROFIT */}
            <div className="flex flex-nowrap items-stretch justify-center gap-4 md:gap-6 overflow-x-auto py-1">
              <Card className="w-[355px] min-w-[355px] shrink-0 flex flex-col justify-center">
                <CardContent className="p-4 md:p-5">
                  <p className="text-xl md:text-2xl font-bold text-green-600">
                    {formatCurrency(income)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">INCOME</p>
                </CardContent>
              </Card>
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-600 font-bold text-lg shrink-0 my-auto">
                −
              </div>
              <Card className="w-[355px] min-w-[355px] shrink-0 flex flex-col justify-center">
                <CardContent className="p-4 md:p-5">
                  <p
                    className={`text-xl md:text-2xl font-bold ${costs > income ? "text-red-600" : "text-green-600"}`}
                  >
                    {formatCurrency(costs)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">COST</p>
                </CardContent>
              </Card>
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-600 font-bold text-lg shrink-0 my-auto">
                =
              </div>
              <Card className="w-[355px] min-w-[355px] shrink-0 flex flex-col justify-center">
                <CardContent className="p-4 md:p-5">
                  <p
                    className={`text-xl md:text-2xl font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {formatCurrency(profit)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {profit >= 0 ? "PROFIT" : "LOSS"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Collapsible Detail Sections */}
            <div className="space-y-2">
              {/* INCOME Section */}
              <Collapsible defaultOpen>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">
                          INCOME
                        </CardTitle>
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-4 pt-0">
                      <div className="flex justify-between items-center py-2">
                        <span className="font-medium">Sales</span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(totalInvoices || totalEstimates)}
                        </span>
                      </div>
                      <Link
                        to={`/app/sales/sale${id ? `?projectId=${id}` : ""}`}
                        className="flex items-start gap-3 p-3 border rounded hover:bg-gray-50 cursor-pointer transition-colors mt-2"
                      >
                        <div className="text-blue-600 text-2xl">📄</div>
                        <div className="flex-1">
                          <p className="font-medium">Invoices</p>
                          <p className="text-sm text-gray-500">
                            {invoices.length} invoice
                            {invoices.length !== 1 ? "s" : ""} •{" "}
                            {formatCurrency(totalInvoices)}
                          </p>
                        </div>
                      </Link>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* COST OF GOODS SOLD Section */}
              <Collapsible defaultOpen>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">
                          COST OF GOODS SOLD
                        </CardTitle>
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-4 pt-0">
                      <div className="flex justify-between items-center py-2">
                        <span className="font-medium">Materials</span>
                        <span className="font-semibold">
                          {formatCurrency(totalBills)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="font-medium">Equipment</span>
                        <span className="font-semibold">
                          {formatCurrency(0)}
                        </span>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* EXPENSE Section */}
              <Collapsible defaultOpen>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">
                          EXPENSE
                        </CardTitle>
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-4 pt-0 space-y-3">
                      <Link
                        to={`/app/expenses/billing/operating-expense-bill${id ? `?projectId=${id}` : ""}`}
                        className="flex items-start gap-3 p-3 border rounded hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <div className="text-green-600 text-2xl">💵</div>
                        <div className="flex-1">
                          <p className="font-medium">Expenses</p>
                          <p className="text-sm text-gray-500">
                            Track what you&apos;ve spent on this project.
                          </p>
                        </div>
                      </Link>
                      <Link
                        to={`/app/expenses/billing/product-supplier-bill${id ? `?projectId=${id}` : ""}`}
                        className="flex items-start gap-3 p-3 border rounded hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <div className="text-blue-600 text-2xl">🧾</div>
                        <div className="flex-1">
                          <p className="font-medium">Bills</p>
                          <p className="text-sm text-gray-500">
                            Add anything you purchase from vendors.
                          </p>
                        </div>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setHourlyCostDrawerOpen(true)}
                        className="flex items-start gap-3 p-3 border rounded hover:bg-gray-50 cursor-pointer transition-colors w-full text-left"
                      >
                        <div className="text-blue-600 text-2xl">👥</div>
                        <div className="flex-1">
                          <p className="font-medium text-blue-600 hover:text-blue-700">Payroll hours</p>
                          <p className="text-sm text-gray-500">
                            {timeSummary.total_hours.toFixed(2)} hours •{" "}
                            {formatCurrency(timeSummary.total_cost)}
                          </p>
                        </div>
                      </button>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </div>
          </TabsContent>

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Transactions</CardTitle>
                    <CardDescription>
                      All financial transactions for this project
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowEstimateModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Estimate
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingTransactions || loadingEstimates ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : transactions.length === 0 && estimates.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No transactions or estimates yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {estimates.map((estimate) => (
                      <div
                        key={`est-${estimate.id}`}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium text-sm">
                                Estimate #{estimate.id}
                                {estimate.project_number && (
                                  <span className="text-gray-500 ml-1">
                                    ({estimate.project_number})
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500">
                                {estimate.customer_name || "N/A"} •{" "}
                                {estimate.estimate_date
                                  ? new Date(
                                      estimate.estimate_date,
                                    ).toLocaleDateString()
                                  : "N/A"}
                              </p>
                            </div>
                            {estimate.status && (
                              <Badge variant="outline">{estimate.status}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">
                            {formatCurrency(parseFloat(estimate.total) || 0)}
                          </p>
                          <p className="text-xs text-gray-500">Estimate</p>
                        </div>
                      </div>
                    ))}
                    {transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium text-sm">
                                {transaction.invoice_number ||
                                  transaction.description ||
                                  "Transaction"}
                              </p>
                              <p className="text-xs text-gray-500">
                                {transaction.customer_name ||
                                  transaction.vendor_name ||
                                  transaction.employee_name ||
                                  "N/A"}{" "}
                                •{" "}
                                {transaction.date
                                  ? new Date(
                                      transaction.date,
                                    ).toLocaleDateString()
                                  : "N/A"}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-semibold ${transaction.amount >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {formatCurrency(Math.abs(transaction.amount))}
                          </p>
                          <p className="text-xs text-gray-500">
                            {transaction.type || "Transaction"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="time-activity">
            <Card>
              <CardHeader>
                <CardTitle>Time Activity</CardTitle>
                <CardDescription>
                  Track time spent on this project
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTimeActivity ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : (
                  <>
                    {timeActivity.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">
                        No time entries yet.
                      </p>
                    ) : (
                      <>
                        {/* Summary */}
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-sm text-gray-600">
                                Total Hours
                              </p>
                              <p className="text-2xl font-bold">
                                {timeSummary.total_hours.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">
                                Total Cost
                              </p>
                              <p className="text-2xl font-bold">
                                {formatCurrency(timeSummary.total_cost)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Entries</p>
                              <p className="text-2xl font-bold">
                                {timeSummary.entry_count}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Time Entries List */}
                        <div className="space-y-3">
                          {timeActivity.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-sm">
                                  {entry.employee_name || "Unknown Employee"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {entry.date
                                    ? new Date(entry.date).toLocaleDateString()
                                    : "N/A"}{" "}
                                  • {entry.description || "No description"}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">
                                  {entry.hours.toFixed(2)} hrs
                                </p>
                                <p className="text-xs text-gray-500">
                                  @ {formatCurrency(entry.hourly_rate)}/hr ={" "}
                                  {formatCurrency(entry.total_cost)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Project Reports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingReports ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : reports ? (
                  <>
                    {/* Project Profitability */}
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <div className="text-green-600 text-2xl">📊</div>
                          <div>
                            <p className="font-medium">Project profitability</p>
                            <p className="text-sm text-gray-500">
                              Check how much you're earning on this project.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                        <div>
                          <p className="text-xs text-gray-600">Income</p>
                          <p className="text-lg font-bold text-green-600">
                            {formatCurrency(reports.profitability.income)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Costs</p>
                          <p className="text-lg font-bold text-red-600">
                            {formatCurrency(reports.profitability.costs)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Profit</p>
                          <p
                            className={`text-lg font-bold ${reports.profitability.profit >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {formatCurrency(reports.profitability.profit)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Profit Margin</p>
                          <p
                            className={`text-lg font-bold ${reports.profitability.profitMargin >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {reports.profitability.profitMargin}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Time Cost by Employee */}
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <div className="text-blue-600 text-2xl">💰</div>
                          <div>
                            <p className="font-medium">
                              Time cost by employee or vendor
                            </p>
                            <p className="text-sm text-gray-500">
                              See how much you're paying employees or vendors on
                              this project.
                            </p>
                          </div>
                        </div>
                      </div>
                      {reports.timeCostByEmployee.length === 0 ? (
                        <p className="text-sm text-gray-500 mt-4">
                          No time entries yet.
                        </p>
                      ) : (
                        <div className="space-y-2 mt-4">
                          {reports.timeCostByEmployee.map((emp, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded"
                            >
                              <div>
                                <p className="text-sm font-medium">
                                  {emp.employee_name || "Unknown"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {emp.total_hours.toFixed(2)} hours
                                </p>
                              </div>
                              <p className="text-sm font-semibold">
                                {formatCurrency(emp.total_cost)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Unbilled Time and Expenses */}
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <div className="text-yellow-600 text-2xl">⏳</div>
                          <div>
                            <p className="font-medium">
                              Unbilled time and expenses
                            </p>
                            <p className="text-sm text-gray-500">
                              Find expenses and time you haven't added to an
                              invoice.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                        <div>
                          <p className="text-xs text-gray-600">
                            Unbilled Transactions
                          </p>
                          <p className="text-lg font-bold">
                            {reports.unbilled.transactions.count}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatCurrency(
                              reports.unbilled.transactions.total_amount,
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Unbilled Time</p>
                          <p className="text-lg font-bold">
                            {reports.unbilled.time.count} entries
                          </p>
                          <p className="text-sm text-gray-500">
                            {reports.unbilled.time.total_hours.toFixed(2)} hrs •{" "}
                            {formatCurrency(reports.unbilled.time.total_cost)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No report data available.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attachments">
            <Card>
              <CardHeader>
                <CardTitle>Attachments</CardTitle>
                <CardDescription>
                  Upload and manage project files
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload Section */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <Upload className="h-12 w-12 text-gray-400" />
                    <div className="text-center">
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer inline-flex items-center px-4 py-2 bg-[var(--aa-navy)] text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Choose Files
                      </label>
                      <input
                        id="file-upload"
                        type="file"
                        multiple
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg,.docx"
                        onChange={(e) => {
                          const files = Array.from(e.target.files);
                          setSelectedFiles(files);
                        }}
                      />
                      <p className="mt-2 text-sm text-gray-500">
                        PDF, PNG, JPG, DOCX (Max 5MB per file)
                      </p>
                    </div>
                    {selectedFiles.length > 0 && (
                      <div className="w-full space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded"
                          >
                            <span className="text-sm text-gray-700 truncate flex-1">
                              {file.name}
                            </span>
                            <span className="text-xs text-gray-500 mr-2">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                            <button
                              onClick={() => {
                                setSelectedFiles(
                                  selectedFiles.filter((_, i) => i !== index),
                                );
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <Button
                          onClick={handleUpload}
                          disabled={uploading}
                          className="w-full"
                        >
                          {uploading ? "Uploading..." : "Upload Files"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Documents List */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Uploaded Documents</h3>
                  {documents.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      No attachments yet. Upload files to get started.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div
                          key={doc.transaction_id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <File className="h-5 w-5 text-blue-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {doc.document_name || doc.original_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {(doc.file_size / 1024).toFixed(2)} KB •{" "}
                                {new Date(doc.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewDocument(doc)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleDeleteDocument(doc.transaction_id)
                              }
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Estimate Modal */}
      </div>

      <EstimateModal
        closeModal={() => setShowEstimateModal(false)}
        empty={() => {}}
        showModal={showEstimateModal}
        getList={() => {
          loadTransactions();
          loadEstimates();
        }}
        projectNumber={project?.project_number || ""}
        projectCustomer={project?.customer || ""}
      />

      {/* Employee hourly cost rate - Side Drawer */}
      <Drawer
        open={hourlyCostDrawerOpen}
        onOpenChange={setHourlyCostDrawerOpen}
      >
        <DrawerContent
          side="right"
          className="bg-white border-gray-200 flex flex-col max-w-md w-full"
        >
          <DrawerHeader className="border-b border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <DrawerTitle className="text-gray-900 text-xl font-bold">
                  Employee hourly cost rate
                </DrawerTitle>
                <DrawerDescription className="text-gray-600 mt-2">
                  Include the total of wages, taxes, and overhead for each
                  worker. This is not your billable rate.
                </DrawerDescription>
                <a
                  href="#"
                  className="text-sm text-[var(--aa-accent)] hover:underline mt-2 inline-block"
                >
                  Learn more
                </a>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="hover:bg-gray-100">
                  <X className="h-5 w-5 text-gray-500" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                className="border-gray-300"
                onClick={() =>
                  setEmployeeCostRates([
                    ...employeeCostRates,
                    { id: Date.now(), name: "", rate: "" },
                  ])
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add employee
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-2 bg-gray-50 border-b font-semibold text-xs text-gray-600 uppercase tracking-wider">
                <div className="px-4 py-3">EMPLOYEE</div>
                <div className="px-4 py-3">COST RATE</div>
              </div>
              {employeeCostRates.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  No employees added yet. Click &quot;Add employee&quot; to get
                  started.
                </div>
              ) : (
                employeeCostRates.map((emp) => (
                  <div
                    key={emp.id}
                    className="grid grid-cols-2 border-b last:border-b-0 hover:bg-gray-50"
                  >
                    <div className="px-4 py-3">
                      <Input
                        placeholder="Employee name"
                        value={emp.name}
                        onChange={(e) =>
                          setEmployeeCostRates(
                            employeeCostRates.map((x) =>
                              x.id === emp.id
                                ? { ...x, name: e.target.value }
                                : x,
                            ),
                          )
                        }
                        className="border-0 bg-transparent focus-visible:ring-0"
                      />
                    </div>
                    <div className="px-4 py-3">
                      <Input
                        placeholder="₦0.00"
                        type="number"
                        value={emp.rate}
                        onChange={(e) =>
                          setEmployeeCostRates(
                            employeeCostRates.map((x) =>
                              x.id === emp.id
                                ? { ...x, rate: e.target.value }
                                : x,
                            ),
                          )
                        }
                        className="border-0 bg-transparent focus-visible:ring-0"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DrawerFooter className="border-t border-gray-200 bg-gray-50 p-6">
            <DrawerClose asChild>
              <Button className="bg-green-600 hover:bg-green-700 text-white">
                Done
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
