import React, { useState, useEffect, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  ArrowLeft,
  User,
  Building,
  Phone,
  Mail,
  Calendar,
  Briefcase,
  DollarSign,
  FileText,
  AlertCircle,
  Plus,
  Pencil,
  MapPin,
  TrendingUp,
  Loader2,
  XCircle,
  Download,
  Percent,
  Banknote,
  ShieldCheck,
  CreditCard,
  ChevronRight,
  Eye,
  Layers,
  Sparkles,
  Info,
  Clock,
  Printer,
  Share2,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { _fetchApi, _postApi, _putApi, _deleteApi } from "@/redux/actions/api";
import CustomTable1 from "@/common/Custom/CustomTable1";
import CustomButton from "@/common/Custom/CustomButton";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import moment from "moment";
import PayslipPDF from "./PayslipPDF";

const EmployeeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, activeBusiness } = useSelector((state) => state.auth);
  
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  // Detailed States
  const [loans, setLoans] = useState([]);
  const [payrollHistory, setPayrollHistory] = useState([]);
  
  // Modal States
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const payslipRef = useRef();

  const handlePrint = useReactToPrint({
    contentRef: payslipRef,
    documentTitle: `Payslip_${employee?.firstName}_${employee?.lastName}`,
  });
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [structureLoading, setStructureLoading] = useState(false);
  const [salaryStructures, setSalaryStructures] = useState([]);
  const [selectedStructureId, setSelectedStructureId] = useState("");
  const [showAllowanceModal,setShowAllowanceModal] = useState(false);
  

  useEffect(() => {
    if (id && activeBusiness?.id) {
      fetchEmployeeDetails();
      fetchEmployeeLoans();
      fetchPayrollHistory();
      fetchSalaryStructures();
    }
  }, [id, activeBusiness?.id]);

  const fetchSalaryStructures = () => {
    _fetchApi(`/api/hr/salary-structures?facilityId=${activeBusiness?.id}`, (res) => {
      if (res.success) setSalaryStructures(res.data || []);
    });
  };

  const fetchEmployeeDetails = () => {
    setLoading(true);
    _fetchApi(
      `/api/hr/employees/${id}?facilityId=${activeBusiness?.id}`,
      (data) => {
        if (data.success) {
          setEmployee(data.data);
        } else {
          toast.error("Failed to load employee details");
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching employee:", error);
        toast.error("Error fetching employee");
        setLoading(false);
      }
    );
  };

  const fetchEmployeeLoans = () => {
    _fetchApi(
      `/api/hr/loans?facilityId=${activeBusiness?.id}&employeeId=${id}`,
      (data) => {
        if (data.success) {
          setLoans(data.data);
        }
      }
    );
  };

  const fetchPayrollHistory = () => {
    _fetchApi(
      `/api/hr/payroll/history?facilityId=${activeBusiness?.id}&employeeId=${id}`,
      (data) => {
        if (data.success) {
          setPayrollHistory(data.data);
        }
      }
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    const variants = {
      Active: "success",
      Inactive: "secondary",
      Terminated: "destructive",
      "On Leave": "warning",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="font-bold uppercase tracking-widest text-[10px]">
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-xs font-medium text-muted-foreground animate-pulse tracking-widest uppercase">Synchronizing Data…</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-background rounded-3xl border border-dashed">
        <XCircle className="size-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold tracking-tight mb-2">Employee Not Found</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">The record you are looking for might have been moved or deleted.</p>
        <Button onClick={() => navigate("/app/admin/hr/employees")} variant="outline">
          Return to Directory
        </Button>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Profile", icon: User },
    { id: "compensation", label: "Compensation", icon: Sparkles },
    { id: "loans", label: "Financials", icon: CreditCard },
    { id: "payroll", label: "Ledger", icon: Layers },
  ];

  return (
    <>
    <div className="min-h-screen bg-muted/30 pb-20 font-sans selection:bg-primary/10">
      {/* Salary Status Alerts */}
      {employee.salaryStatus === 'Stopped' && (
        <Alert variant="destructive" className="rounded-none border-t-0 border-x-0 bg-red-500/10 text-red-600">
          <AlertCircle className="size-4" />
          <AlertDescription className="font-bold flex items-center justify-between">
            <span>Salary Processing is currently <span className="uppercase tracking-widest">Stopped</span> for this employee.</span>
            <span className="text-xs font-medium italic opacity-80">Reason: {employee.salaryStatusReason}</span>
          </AlertDescription>
        </Alert>
      )}
      
      {employee.salaryStatus === 'Active' && employee.salaryStatusDate && moment().diff(moment(employee.salaryStatusDate), 'days') <= 7 && (
        <Alert className="rounded-none border-t-0 border-x-0 bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
          <CheckCircle className="size-4 text-emerald-600" />
          <AlertDescription className="font-bold">
            Salary Processing was <span className="uppercase tracking-widest">Recently Restored</span> on {moment(employee.salaryStatusDate).format('MMM Do, YYYY')}.
          </AlertDescription>
        </Alert>
      )}

      {/* Editorial Header */}
      <div className="bg-background/80 backdrop-blur-xl border-b sticky top-0 z-[40]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="py-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline"
                size="icon"
                onClick={() => navigate("/app/admin/hr/employees")}
                className="size-9 rounded-xl border-muted-foreground/20 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
              </Button>
              
              <div className="flex items-center gap-4">
                <Avatar className="size-12 rounded-xl ring-2 ring-muted/50">
                  <AvatarImage src={employee.photoUrl} alt={`${employee.firstName} ${employee.lastName}`} className="object-cover" />
                  <AvatarFallback className="rounded-xl bg-muted text-muted-foreground">
                    <User className="size-6" />
                  </AvatarFallback>
                </Avatar>

                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-foreground tracking-tight">
                      {employee.firstName} <span className="text-muted-foreground font-medium">{employee.lastName}</span>
                    </h1>
                    {getStatusBadge(employee.status)}
                    {employee.salaryStatus === 'Stopped' && (
                      <Badge variant="destructive" className="font-bold uppercase tracking-widest text-[9px] bg-red-100 text-red-700 hover:bg-red-200">
                        Salary Stopped
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-muted/50 border-none font-mono">
                      ID: {employee.employeeId}
                    </Badge>
                    <Separator orientation="vertical" className="h-3" />
                    <div className="flex items-center text-[11px] font-medium text-muted-foreground uppercase tracking-tight">
                      <Briefcase className="size-3 mr-1 text-primary" />
                      {employee.designation}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden md:flex flex-col items-end">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Est. Net Share</p>
              <p className="text-base font-bold text-foreground font-mono tabular-nums tracking-tighter">
                  {(() => {
                    const structure = employee.salaryStructure || {};
                    const basic = parseFloat(structure.basicSalary) || 0;
                    const allowances = typeof structure.allowances === 'string' ? JSON.parse(structure.allowances) : (structure.allowances || {});
                    const deductions = typeof structure.deductions === 'string' ? JSON.parse(structure.deductions) : (structure.deductions || {});
                    
                    let totalA = 0;
                    Object.values(allowances).forEach(v => {
                       if (v.toString().includes('%')) totalA += (parseFloat(v)/100) * basic;
                       else totalA += parseFloat(v) || 0;
                    });
                    
                    let totalD = ((parseFloat(structure.payeRate || 0)/100) * basic) + ((parseFloat(structure.pensionRate || 0)/100) * basic);
                    Object.values(deductions).forEach(v => {
                       if (v.toString().includes('%')) totalD += (parseFloat(v)/100) * basic;
                       else totalD += parseFloat(v) || 0;
                    });
                    
                    return formatCurrency(basic + totalA - totalD);
                 })()}
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="h-12 w-full justify-start bg-transparent p-0 gap-8 border-b rounded-none overflow-x-auto no-scrollbar">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="h-12 px-0 pb-3 pt-4 font-bold uppercase tracking-widest text-[10px] text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none transition-none focus-visible:ring-0"
                >
                  <tab.icon className="size-3.5 mr-2" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        <Tabs value={activeTab} className="w-full border-none shadow-none">
        
        <TabsContent value="overview" className="mt-0 border-none p-0 outline-none focus-visible:ring-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Professional Summary */}
            <Card className="md:col-span-1 shadow-sm border-muted/50 overflow-hidden">
               <CardHeader className="bg-muted/30 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Briefcase className="size-4" />
                    <CardTitle className="text-[10px] font-bold uppercase tracking-widest">Professional</CardTitle>
                  </div>
               </CardHeader>
               <CardContent className="pt-6 space-y-6">
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Current Designation</p>
                    <h3 className="text-lg font-bold tracking-tight italic uppercase">{employee.designation}</h3>
                  </div>
                  
                  <Separator className="bg-muted/50" />
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Department</span>
                      <span className="text-sm font-bold">{employee.department?.departmentName || "General"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Joining Date</span>
                      <span className="text-sm font-bold font-mono tabular-nums">{new Date(employee.hireDate).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Type</span>
                      <Badge variant="outline" className="h-5 px-2 text-[10px] font-bold uppercase tracking-tighter border-muted-foreground/30">{employee.contractType}</Badge>
                    </div>
                  </div>
               </CardContent>
            </Card>

            {/* Personal & Contact */}
            <div className="md:col-span-2 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card className="shadow-sm border-muted/50">
                  <CardHeader className="pb-3 pt-4 px-5">
                    <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      <User className="size-3.5" /> Identity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 space-y-4">
                    <div>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Full Legal Name</p>
                      <p className="text-sm font-bold">{employee.firstName} {employee.lastName}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Gender</p>
                        <p className="text-sm font-bold">{employee.gender}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Birth Date</p>
                        <p className="text-sm font-bold font-mono tabular-nums">{new Date(employee.dateOfBirth).toLocaleDateString('en-GB')}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">NIN (Identity)</p>
                      <p className="text-sm font-bold font-mono tracking-widest">{employee.nationalId || "—"}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-muted/50">
                  <CardHeader className="pb-3 pt-4 px-5">
                    <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                       <Mail className="size-3.5" /> Communications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 space-y-4">
                    <div className="flex gap-3">
                      <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                        <Mail className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Corporate Email</p>
                        <p className="text-sm font-bold truncate">{employee.user?.email || "N/A"}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                        <Phone className="size-4" />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Phone Contact</p>
                        <p className="text-sm font-bold font-mono tabular-nums">{employee.contactInfo || "—"}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                        <MapPin className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Residential Address</p>
                        <p className="text-xs font-medium leading-relaxed italic">{employee.address || "No address provided"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Banking & Financials Card */}
              <Card className="shadow-sm border-muted/50 bg-muted/10">
                <CardHeader className="pb-4 pt-4 px-6">
                  <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Banknote className="size-3.5" /> Financial Remittance
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="sm:col-span-1">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Bank Institution</p>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold uppercase">{employee.bankName || "Unknown Bank"}</span>
                        {employee.bankCode && <Badge variant="secondary" className="w-fit h-4 text-[8px] px-1 font-bold">{employee.bankCode}</Badge>}
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Account Ledger</p>
                      <p className="text-sm font-bold font-mono tracking-wider tabular-nums">{employee.bankAccount || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Ledger Class</p>
                      <p className="text-sm font-bold uppercase">{employee.accountType || "Standard"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="compensation" className="mt-0 border-none p-0 outline-none focus-visible:ring-0">
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {employee.salaryStructure ? (
              <>
                {/* Compensation Header & Package Control */}
                {/* <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20 p-6 rounded-3xl border border-muted/50 mb-6 font-primary">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Briefcase className="size-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold tracking-tight">{employee.salaryStructure.structureName}</h3>
                    </div>
                  </div>
                </div> */}

                {/* Unified Data Processing */}
                {(() => {
                        const basic = parseFloat(employee.salaryStructure.basicSalary) || 0;
                  const structAllowances = typeof employee.salaryStructure.allowances === 'string' ? JSON.parse(employee.salaryStructure.allowances) : (employee.salaryStructure.allowances || {});
                  const structDeductions = typeof employee.salaryStructure.deductions === 'string' ? JSON.parse(employee.salaryStructure.deductions) : (employee.salaryStructure.deductions || {});
                  
                  const allAllowances = [];
                  const allDeductions = [];

                  // Add basic salary to stats
                  let totalA = 0;
                  let totalD = ((parseFloat(employee.salaryStructure.payeRate || 0)/100) * basic) + ((parseFloat(employee.salaryStructure.pensionRate || 0)/100) * basic);

                  // Process JSON components from structure
                  Object.entries(structAllowances).forEach(([name, val]) => {
                    let amount = val.toString().includes('%') ? (parseFloat(val)/100) * basic : parseFloat(val);
                    allAllowances.push({ name, amount, source: 'Employee' });
                    totalA += amount;
                  });
                  Object.entries(structDeductions).forEach(([name, val]) => {
                    let amount = val.toString().includes('%') ? (parseFloat(val)/100) * basic : parseFloat(val);
                    allDeductions.push({ name, amount, source: 'Employee' });
                    totalD += amount;
                  });

                  // Process Master components (Role/Structure based from table)
                  (employee.masterAllowances || []).forEach(comp => {
                    let amount = comp.calculationType === 'percentage' ? (parseFloat(comp.amount)/100) * basic : parseFloat(comp.amount);
                    if (comp.type === 'allowance') {
                      allAllowances.push({ name: comp.name, amount, source: 'Shared' });
                      totalA += amount;
                    } else {
                      allDeductions.push({ name: comp.name, amount, source: 'Shared' });
                      totalD += amount;
                    }
                  });

                  // Process Individual components
                  (employee.individualAllowances || []).forEach(comp => {
                    let amount = comp.calculationType === 'percentage' ? (parseFloat(comp.amount)/100) * basic : parseFloat(comp.amount);
                    if (comp.type === 'allowance') {
                      allAllowances.push({ name: comp.name, amount, source: 'Extra' });
                      totalA += amount;
                    } else {
                      allDeductions.push({ name: comp.name, amount, source: 'Extra' });
                      totalD += amount;
                    }
                  });

                  const gross = basic + totalA;
                  const net = gross - totalD;

                  return (
                    <>
                      {/* Visual Summary */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <Card className="bg-primary text-primary-foreground shadow-lg border-none">
                          <CardHeader className="pb-2 pt-4 px-6">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-widest opacity-80 text-white">Monthly Gross</CardTitle>
                          </CardHeader>
                          <CardContent className="px-6 pb-6">
                            <h3 className="text-2xl font-black tracking-tighter tabular-nums text-white">
                              {formatCurrency(gross)}
                            </h3>
                          </CardContent>
                        </Card>

                        <Card className="bg-background shadow-sm border-muted/50">
                          <CardHeader className="pb-2 pt-4 px-6">
                            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Deductions</CardTitle>
                          </CardHeader>
                          <CardContent className="px-6 pb-6">
                            <h3 className="text-2xl font-black text-destructive tracking-tighter tabular-nums">
                              {formatCurrency(totalD)}
                            </h3>
                          </CardContent>
                        </Card>

                        <Card className="bg-emerald-600 text-white shadow-lg border-none">
                          <CardHeader className="pb-2 pt-4 px-6">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-widest opacity-80">Estimated Net</CardTitle>
                          </CardHeader>
                          <CardContent className="px-6 pb-6">
                            <h3 className="text-2xl font-black tracking-tighter tabular-nums">
                              {formatCurrency(net)}
                            </h3>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Detailed Itemization */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="shadow-sm border-muted/50">
                          <CardHeader className="bg-emerald-50/50 py-3 px-6 flex flex-row items-center justify-between">
                            <CardTitle className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                              <Plus className="size-3" /> Earnings & Credits
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
                            <div className="divide-y divide-muted/50">
                              <div className="flex items-center justify-between p-4">
                                <span className="text-[11px] font-bold uppercase text-muted-foreground">Basic Salary</span>
                                <span className="text-sm font-bold font-mono tabular-nums">{formatCurrency(basic)}</span>
                              </div>
                              {allAllowances.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-muted/5 transition-colors group">
                                  <div className="flex flex-col">
                                    <span className="text-[11px] font-bold text-slate-700 uppercase">{item.name}</span>
                                    <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-tighter transition-opacity group-hover:opacity-100">{item.source}</span>
                                  </div>
                                  <span className="text-sm font-bold font-mono tabular-nums text-emerald-600">+{formatCurrency(item.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="shadow-sm border-muted/50">
                          <CardHeader className="bg-red-50/50 py-3 px-6 flex flex-row items-center justify-between">
                            <CardTitle className="text-[10px] font-bold text-red-700 uppercase tracking-widest flex items-center gap-2">
                              <XCircle className="size-3" /> Statutory & Obligations
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
                            <div className="divide-y divide-muted/50">
                              <div className="flex items-center justify-between p-4">
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-bold uppercase text-muted-foreground">PAYE Tax</span>
                                  <span className="text-[10px] text-muted-foreground/60">{employee.salaryStructure.payeRate || 0}% calculation</span>
                                </div>
                                <span className="text-sm font-bold font-mono tabular-nums text-destructive">
                                  -{formatCurrency((parseFloat(employee.salaryStructure.payeRate || 0)/100) * basic)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-4">
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-bold uppercase text-muted-foreground">Pension Fund</span>
                                  <span className="text-[10px] text-muted-foreground/60">{employee.salaryStructure.pensionRate || 0}% calculation</span>
                                </div>
                                <span className="text-sm font-bold font-mono tabular-nums text-destructive">
                                  -{formatCurrency((parseFloat(employee.salaryStructure.pensionRate || 0)/100) * basic)}
                                </span>
                              </div>
                              {allDeductions.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-muted/5 transition-colors group">
                                  <div className="flex flex-col">
                                    <span className="text-[11px] font-bold text-slate-700 uppercase">{item.name}</span>
                                    <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-tighter transition-opacity group-hover:opacity-100">{item.source}</span>
                                  </div>
                                  <span className="text-sm font-bold font-mono tabular-nums text-destructive">-{formatCurrency(item.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <Card className="min-h-[300px] flex flex-col items-center justify-center text-center p-12 border-dashed">
                 <DollarSign className="size-12 text-muted mb-4" />
                 <h3 className="text-xl font-bold tracking-tight">No salary set yet</h3>
                 <p className="text-muted-foreground text-sm mt-2 max-w-sm">
                   Edit this employee and enter their basic salary, allowances, and deductions.
                 </p>
                 <Button
                   className="mt-4"
                   onClick={() => navigate(`/app/admin/hr/employees`)}
                 >
                   Back to Employees
                 </Button>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="loans" className="mt-0 border-none p-0 outline-none focus-visible:ring-0">

            <div className="flex flex-row items-center justify-between pb-4 pt- bg-muted/20">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-lg font-bold tracking-tight italic">Financial Portfolio</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Active Financial Instruments</CardDescription>
              </div>
              <Button size="sm" className="h-8 text-[10px] font-bold uppercase tracking-wider">Request Advance</Button>
            </div>
            <CardContent className="p-0">
              <CustomTable1
                data={loans}
                fields={[
                  { title: "S/N", value: "id", className: "text-left font-mono text-[10px] uppercase w-24",custom: true,component: (item, index) => index + 1 },
                  { 
                    title: "Principal", 
                    value: "amount",
                    className: "text-right font-bold tabular-nums",
                    custom: true,
                    component: (item) => formatCurrency(item.amount)
                  },
                  { 
                    title: "Repaid", 
                    value: "amountPaid",
                    className: "text-right font-bold text-emerald-600 tabular-nums",
                    custom: true,
                    component: (item) => formatCurrency(item.amountPaid || 0)
                  },
                  { 
                    title: "Balance", 
                    className: "text-right font-bold text-destructive tabular-nums",
                    custom: true,
                    component: (item) => formatCurrency(parseFloat(item.amount) - parseFloat(item.amountPaid || 0))
                  },
                  { 
                    title: "Progress", 
                    className: "w-40",
                    custom: true,
                    component: (item) => {
                      const progress = (parseFloat(item.amountPaid || 0) / parseFloat(item.amount)) * 100;
                      return (
                        <div className="flex flex-col gap-1 px-4">
                          <Progress value={progress} className="h-1.5" />
                          <span className="text-[9px] font-bold text-muted-foreground text-right">{progress.toFixed(0)}%</span>
                        </div>
                      );
                    }
                  },
                  { 
                    title: "Status", 
                    value: "status",
                    custom: true,
                    component: (item) => <Badge variant={item.status === 'Active' ? 'success' : 'outline'} className="text-[9px] uppercase">{item.status}</Badge>
                  }
                ]}
                pageSize={5}
                message="No active loan obligations found"
              />
            </CardContent>

        </TabsContent>

        <TabsContent value="payroll" className="mt-0 border-none p-0 outline-none focus-visible:ring-0">
{
  payrollHistory.length === 0 ? (
    <Card className="min-h-[300px] flex flex-col items-center justify-center text-center p-12 border-dashed">
      <DollarSign className="size-12 text-muted mb-4" />
      <h3 className="text-xl font-bold tracking-tight">No Payroll History</h3>
      <p className="text-muted-foreground text-sm mt-2 max-w-sm">This account is not yet synchronized with a valid salary structure package.</p>
    </Card>
  ) : (
    
      showPayslipModal ? (<>
        <div className="p-2 bg-muted/20 border-t flex justify-between gap-4 rounded-b-3xl">
            <Button variant="outline" onClick={() => setShowPayslipModal(false)} className="h-11 rounded-xl font-bold uppercase tracking-wider text-[10px] px-6">
              <ArrowLeft className="size-3.5 mr-2" /> Back
            </Button>
              <Button 
                variant="outline" 
                onClick={handlePrint} 
                className="h-11 rounded-xl font-bold uppercase tracking-wider text-[10px] px-6 bg-white"
              >
                <Printer className="size-3.5 mr-2" /> Print
              </Button>
          </div>
             <div className="p-8 space-y-8 bg-slate-100 min-h-[75vh]">
               <div className="mx-auto max-w-[210mm] shadow-2xl bg-white ring-1 ring-slate-200">
                  <PayslipPDF 
                    ref={payslipRef}
                    data={selectedPayslip} 
                    employee={employee} 
                    businessName={activeBusiness?.business_name} 
                  />
               </div>
            </div>
        </>) : 
    <>
            <div className="pb-4  bg-muted/20">
              <CardTitle className="text-lg font-bold tracking-tight italic">Payment Ledger</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Verified Remittance History</CardDescription>
            </div>
            <CardContent className="p-0">
              <CustomTable1
                data={payrollHistory}
                fields={[
                  { 
                    title: "Period", 
                    className: "text-left font-bold italic",
                    custom: true,
                    component: (item) => `${moment(item.month).format('MMMM')} ${item.year}`
                  },
                  { 
                    title: "Gross", 
                    className: "text-center font-medium tabular-nums",
                    custom: true,
                    component: (item) => <div className="text-center text-bold font-mono font-bold">{formatCurrency(item.grossPay || (item.netPay + item.deductions))}</div>
                  },
                  { 
                    title: "Deductions", 
                    className: "text-center font-medium text-destructive tabular-nums",
                    custom: true,
                    component: (item) => <div className="text-center font-bold font-mono">-{formatCurrency(item.deductions + Number(item.loanRepayment || 0))}</div>
                  },
                  { 
                    title: "Net Disbursed", 
                    className: "text-center font-bold text-emerald-600 text-base tabular-nums",
                    custom: true,
                    component: (item) => <div className="text-center font-bold font-mono">{formatCurrency(item.netPay)}</div>
                  },
                  { 
                    title: "Actions", 
                    className: "text-center",
                    custom: true,
                    component: (item) => (
                      <div className="flex justify-center gap-2 pr-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedPayslip(item);
                            setShowPayslipModal(true);
                          }}
                          className="size-8 hover:bg-primary/10 hover:text-primary"
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 hover:bg-emerald-50 hover:text-emerald-600"
                        >
                          <Download className="size-4" />
                        </Button>
                      </div>
                    )
                  }
                ]}
                pageSize={10}
                message="No historical records available in the ledger"
              />
            </CardContent>
            </>
    
  )
}
        </TabsContent>
      </Tabs>
    </div>





      
    </div>
    </>
  );
};

export default EmployeeDetail;
