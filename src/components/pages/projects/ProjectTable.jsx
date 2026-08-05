import { useEffect, useState, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { FaPlus } from "react-icons/fa";
import { Col, Row } from "reactstrap";
import { Link } from "react-router-dom";
import CustomButton from "@/common/Custom/CustomButton";
import { Input } from "antd";
import CustomTable1 from "@/common/Custom/CustomTable1";
import { MoreVerticalIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import ProjectRegistration from "./ProjectRegistration";
import FollowUpModal from "./FollowUpModal";
import ProgressStatusModal from "./ProgressStatusModal";
import { _fetchApi } from "@/redux/actions/api";

// Fallback dummy projects so customers can see example data even when API is empty/unavailable
const DUMMY_PROJECTS = [
    {
        project_number: "P-0001",
        project_name: "Hectors' House",
        customer: "XXX Client LLC",
        income: 10000,
        cost: 4000,
        progress_status: "in-progress",
        follow_up_status: "Head office",
        total_hours: 8,
        start_date: "2024-01-05",
        end_date: null,
    },
    {
        project_number: "P-0002",
        project_name: "Kitchen Expansion",
        customer: "Angie Graham",
        income: 0,
        cost: 3000,
        progress_status: "in-progress",
        follow_up_status: "Raise Valuation",
        total_hours: 25,
        start_date: "2024-02-10",
        end_date: null,
    },
    {
        project_number: "P-0003",
        project_name: "Project 1",
        customer: "AAA Construction",
        income: 23747.68,
        cost: 10737.89,
        progress_status: "in-progress",
        follow_up_status: "PMS",
        total_hours: 173,
        start_date: "2024-03-01",
        end_date: null,
    },
    {
        project_number: "P-0004",
        project_name: "Project A",
        customer: "Subcustomer 3",
        income: 0,
        cost: 0,
        progress_status: "not-started",
        follow_up_status: "PLANING",
        total_hours: 0,
        start_date: null,
        end_date: null,
    },
];

export default function ProjectTable() {
    const { activeBusiness } = useSelector((state) => state.auth);

    // Projects list (initially populated with dummy data so UI is not empty)
    const [projects, setProjects] = useState(DUMMY_PROJECTS);

    const [searchText, setSearchText] = useState("");
    const [loading, setLoading] = useState(false);
    const [toggle, setToggle] = useState(false);

    // Filter states
    const [progressStatusFilter, setProgressStatusFilter] = useState("");
    const [followUpStatusFilter, setFollowUpStatusFilter] = useState("");
    const [customerFilter, setCustomerFilter] = useState("");

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [showFollowUpModal, setShowFollowUpModal] = useState(false);
    const [showProgressStatusModal, setShowProgressStatusModal] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const facilityId = activeBusiness?.id;

    const toggleModal = useCallback(() => {
        setToggle((prev) => !prev);
    }, []);

    const getProjectList = useCallback(() => {
        // If we don't have a facility yet, keep showing dummy data
        if (!facilityId) {
            setProjects(DUMMY_PROJECTS);
            return;
        }

        setLoading(true);
        _fetchApi(
            `/api/projects?facilityId=${facilityId}`,
            (response) => {
                if (response.success) {
                    const projectsList = response.data || [];
                    // If API returns no projects, keep dummy data so customers still see examples
                    setProjects(
                        projectsList.length > 0 ? projectsList : DUMMY_PROJECTS
                    );
                } else {
                    // On failure, show dummy projects
                    setProjects(DUMMY_PROJECTS);
                }
                setLoading(false);
            },
            (err) => {
                console.error("Error loading projects:", err);
                setProjects(DUMMY_PROJECTS);
                setLoading(false);
            }
        );
    }, [facilityId]);

    useEffect(() => {
        getProjectList();
    }, [getProjectList]);

    // Unique customer list for the Customer filter dropdown
    const customerOptions = useMemo(() => {
        const set = new Set();
        projects.forEach((p) => {
            if (p.customer) {
                set.add(p.customer);
            }
        });
        return Array.from(set);
    }, [projects]);

    const filteredData = useMemo(() => {
        return projects.filter((item) => {
            // Progress status filter
            const matchesProgressStatus = !progressStatusFilter ||
                item.progress_status === progressStatusFilter;

            // Follow up status filter
            const matchesFollowUpStatus = !followUpStatusFilter ||
                item.follow_up_status === followUpStatusFilter;

            // Customer filter
            const matchesCustomer =
                !customerFilter || item.customer === customerFilter;

            // General search (for backward compatibility)
            const matchesSearch = !searchText ||
                item.project_name?.toLowerCase().includes(searchText?.toLowerCase()) ||
                item.customer?.toLowerCase().includes(searchText?.toLowerCase()) ||
                item.progress_status?.toLowerCase().includes(searchText?.toLowerCase());

            return (
                matchesProgressStatus &&
                matchesFollowUpStatus &&
                matchesCustomer &&
                matchesSearch
            );
        });
    }, [
        projects,
        progressStatusFilter,
        followUpStatusFilter,
        customerFilter,
        searchText,
    ]);

    const openCreateModal = () => {
        setSelectedProject(null);
        setShowModal(true);
    };

    const openEditModal = (project) => {
        setSelectedProject(project);
        setShowModal(true);
    };

    const openFollowUpModal = (project) => {
        setSelectedProject(project);
        setShowFollowUpModal(true);
    };

    const openProgressStatusModal = (project) => {
        setSelectedProject(project);
        setShowProgressStatusModal(true);
    };

    const closeModal = useCallback(() => {
        setShowModal(false);
        setSelectedProject(null);
    }, []);

    const closeFollowUpModal = useCallback(() => {
        setShowFollowUpModal(false);
        setSelectedProject(null);
    }, []);

    const closeProgressStatusModal = useCallback(() => {
        setShowProgressStatusModal(false);
        setSelectedProject(null);
    }, []);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "NGN",
        }).format(amount || 0);
    };

    const formatStatus = (status) => {
        if (!status) return "-";
        return status
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    };

    const fields = [
        {
            title: "Project / Customer",
            custom: true,
            component: (item) => (
                <div className="flex flex-col">
                    <Link
                        to={`/app/projects/dashboard/${item.project_number}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                        {item.project_name || "-"}
                    </Link>
                    <span className="text-xs text-gray-600">
                        {item.customer || "—"}
                    </span>
                </div>
            ),
        },
        {
            title: "Income / Costs",
            custom: true,
            component: (item) => {
                const income = item.income || 0;
                const cost = item.cost || 0;
                const total = Math.max(income, cost, 1); // avoid zero division

                const incomeWidth = (income / total) * 100;
                const costWidth = (cost / total) * 100;

                return (
                    <div className="w-full max-w-xs">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">Income</span>
                            <span className="text-gray-700 font-medium">
                                {formatCurrency(income)}
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-200 mb-2 overflow-hidden">
                            <div
                                className="h-2 bg-green-500 rounded-full"
                                style={{ width: `${incomeWidth}%` }}
                            />
                        </div>

                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">Costs</span>
                            <span className="text-gray-700 font-medium">
                                {formatCurrency(cost)}
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                            <div
                                className="h-2 bg-red-500 rounded-full"
                                style={{ width: `${costWidth}%` }}
                            />
                        </div>
                    </div>
                );
            },
        },
        {
            title: "Profit Margin",
            custom: true,
            component: (item) => {
                const income = item.income || 0;
                const cost = item.cost || 0;
                const profit = income - cost;
                const margin = income > 0 ? (profit / income) * 100 : 0;

                const marginDisplay = `${margin.toFixed(1)}%`;

                return (
                    <div className="text-sm text-center font-semibold">
                        <span
                            className={profit >= 0 ? "text-green-600" : "text-red-600"}
                        >
                            {marginDisplay}
                        </span>
                    </div>
                );
            },
        },
        {
            title: "Time",
            custom: true,
            component: (item) => {
                // Expect item.total_hours in decimal hours; fallback to 0
                const hours = item.total_hours || 0;
                const whole = Math.floor(hours);
                const minutes = Math.round((hours - whole) * 60);
                const formatted = `${whole.toString().padStart(2, "0")}:${minutes
                    .toString()
                    .padStart(2, "0")}`;

                return <div className="text-sm text-center text-gray-700">{formatted}</div>;
            },
        },
        {
            title: "Start Date",
            custom: true,

            component: (item) => {
                const date = item.start_date
                    ? new Date(item.start_date)
                    : null;
                return (
                    <div className="text-sm text-center text-gray-700">
                        {date && !isNaN(date)
                            ? date.toLocaleDateString()
                            : "-"}
                    </div>
                );
            },
        },
        {
            title: "End Date",
            custom: true,
            component: (item) => {
                const date = item.end_date ? new Date(item.end_date) : null;
                return (
                    <div className="text-sm text-center text-gray-700">
                        {date && !isNaN(date)
                            ? date.toLocaleDateString()
                            : "-"}
                    </div>
                );
            },
        },
        {
            title: "Status",
            custom: true,
            component: (item) => (
                <div className="flex justify-center">
                    {item.progress_status ? (
                        <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                item.progress_status === "completed"
                                    ? "bg-green-100 text-green-700"
                                    : item.progress_status === "in-progress"
                                    ? "bg-blue-100 text-blue-700"
                                    : item.progress_status === "on-hold"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : item.progress_status === "cancelled"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-gray-100 text-gray-700"
                            }`}
                        >
                            {formatStatus(item.progress_status)}
                        </span>
                    ) : (
                        <span className="text-sm text-center text-gray-400">-</span>
                    )}
                </div>
            ),
        },
        {
            title: "Action",
            custom: true,
            component: (item) => (
                <div className="flex justify-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="flex size-8 text-slate-500 data-[state=open]:bg-slate-100 dark:text-slate-400 dark:data-[state=open]:bg-slate-800"
                                size="icon"
                            >
                                <MoreVerticalIcon />
                                <span className="sr-only">Open menu</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => openEditModal(item)}>
                                Edit Project
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => openProgressStatusModal(item)}
                            >
                                Progress Status
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => openFollowUpModal(item)}
                            >
                                Follow Up
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                                Delete Project
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        },
    ];

    return (
        <div className="p-2">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Projects</h1>
                    <p className="text-muted-foreground">
                        Manage your projects and track profitability
                    </p>
                </div>
                <div className="flex gap-2">
                    <CustomButton
                        color="primary"
                        size="sm"
                        className="mb-3 flex align-items-center"
                        onClick={openCreateModal}
                    >
                        <FaPlus className="mr-2" />
                        Create Project
                    </CustomButton>
                </div>
            </div>

            <Row className="mb-4">
                <Col md="12">
                    <div className="bg-white border rounded-lg p-4 shadow-sm">
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            {/* Progress Status Filter */}
                            <div className="flex-1 w-full md:w-auto">
                                <Label htmlFor="progress-status-filter" className="text-sm font-semibold text-gray-700 mb-2 block">
                                    Progress Status
                                </Label>
                                <Select
                                    value={progressStatusFilter || undefined}
                                    onValueChange={(value) => setProgressStatusFilter(value === "all" ? "" : value)}
                                >
                                    <SelectTrigger id="progress-status-filter" className="w-full h-11 bg-white border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500">
                                        <SelectValue placeholder="Select progress status" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                        <SelectItem value="all" className="font-medium">All Statuses</SelectItem>
                                        <SelectItem value="not-started">Not Started</SelectItem>
                                        <SelectItem value="in-progress">In Progress</SelectItem>
                                        <SelectItem value="on-hold">On Hold</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Follow Up Status Filter */}
                            <div className="flex-1 w-full md:w-auto">
                                <Label htmlFor="follow-up-status-filter" className="text-sm font-semibold text-gray-700 mb-2 block">
                                    Follow Up Status
                                </Label>
                                <Select
                                    value={followUpStatusFilter || undefined}
                                    onValueChange={(value) => setFollowUpStatusFilter(value === "all" ? "" : value)}
                                >
                                    <SelectTrigger id="follow-up-status-filter" className="w-full h-11 bg-white border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500">
                                        <SelectValue placeholder="Select follow up status" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                        <SelectItem value="all" className="font-medium">All Follow Up Statuses</SelectItem>
                                        <SelectItem value="Head office">Head office</SelectItem>
                                        <SelectItem value="Raise Valuation">Raise Valuation</SelectItem>
                                        <SelectItem value="POINT OF COLLECTION EDP">POINT OF COLLECTION EDP</SelectItem>
                                        <SelectItem value="PMS">PMS</SelectItem>
                                        <SelectItem value="CONSULTANCY REPORT">CONSULTANCY REPORT</SelectItem>
                                        <SelectItem value="COMPARISING">COMPARISING</SelectItem>
                                        <SelectItem value="INTRIME PAYMENT CERTIFICATE">INTRIME PAYMENT CERTIFICATE</SelectItem>
                                        <SelectItem value="THEN AUDIT">THEN AUDIT</SelectItem>
                                        <SelectItem value="PLANING">PLANING</SelectItem>
                                        <SelectItem value="PMS PROJETC MONITORING AND SUPERVISION">PMS PROJETC MONITORING AND SUPERVISION</SelectItem>
                                        <SelectItem value="EDP">EDP</SelectItem>
                                        <SelectItem value="FINANCE EX DIRECTOR">FINANCE EX DIRECTOR</SelectItem>
                                        <SelectItem value="TREASURY">TREASURY</SelectItem>
                                        <SelectItem value="ACCOUNT PAYABLE">ACCOUNT PAYABLE</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Customer Filter */}
                            <div className="flex-1 w-full md:w-auto">
                                <Label htmlFor="customer-filter" className="text-sm font-semibold text-gray-700 mb-2 block">
                                    Customer
                                </Label>
                                <Select
                                    value={customerFilter || undefined}
                                    onValueChange={(value) =>
                                        setCustomerFilter(value === "all" ? "" : value)
                                    }
                                >
                                    <SelectTrigger
                                        id="customer-filter"
                                        className="w-full h-11 bg-white border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500"
                                    >
                                        <SelectValue placeholder="All customers" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                        <SelectItem value="all" className="font-medium">
                                            All customers
                                        </SelectItem>
                                        {customerOptions.map((cust) => (
                                            <SelectItem key={cust} value={cust}>
                                                {cust}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Clear Filters Button */}
                            {(progressStatusFilter ||
                                followUpStatusFilter ||
                                customerFilter) && (
                                <div className="w-full md:w-auto">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setProgressStatusFilter("");
                                            setFollowUpStatusFilter("");
                                            setCustomerFilter("");
                                        }}
                                        className="h-11 w-full md:w-auto px-6 border-gray-300 hover:bg-gray-50"
                                    >
                                        Clear Filters
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </Col>
            </Row>

            {/* General Search (optional, for backward compatibility) */}
            <Row className="mb-3">
                <Col md="12">
                    <Input.Search
                        placeholder="Search for a project by name, customer, or status"
                        onChange={(e) => setSearchText(e.target.value)}
                        value={searchText}
                    />
                </Col>
            </Row>

            {/* Project Registration Modal */}
            <ProjectRegistration
                closeModal={closeModal}
                empty={() => setSelectedProject(null)}
                showModal={showModal}
                getList={getProjectList}
                selectedProject={selectedProject}
            />

            {/* Follow Up Modal */}
            <FollowUpModal
                closeModal={closeFollowUpModal}
                empty={() => setSelectedProject(null)}
                showModal={showFollowUpModal}
                getList={getProjectList}
                selectedProject={selectedProject}
            />

            {/* Progress Status Modal */}
            <ProgressStatusModal
                closeModal={closeProgressStatusModal}
                empty={() => setSelectedProject(null)}
                showModal={showProgressStatusModal}
                getList={getProjectList}
                selectedProject={selectedProject}
            />

            <div className="mt-3">
                {loading ? (
                    // Skeleton Loading State
                    <div className="w-full">
                        <div className="border rounded-lg overflow-hidden">
                            {/* Table Header Skeleton */}
                            <div className="bg-gray-50 border-b p-4">
                                <div className="grid grid-cols-6 gap-4">
                                    <Skeleton className="h-5 w-24" />
                                    <Skeleton className="h-5 w-32" />
                                    <Skeleton className="h-5 w-28" />
                                    <Skeleton className="h-5 w-36" />
                                    <Skeleton className="h-5 w-24" />
                                    <Skeleton className="h-5 w-20" />
                                </div>
                            </div>
                            {/* Table Rows Skeleton */}
                            <div className="divide-y">
                                {[...Array(8)].map((_, index) => (
                                    <div key={index} className="p-4">
                                        <div className="grid grid-cols-6 gap-4">
                                            <Skeleton className="h-4 w-32" />
                                            <Skeleton className="h-4 w-28" />
                                            <Skeleton className="h-4 w-24" />
                                            <Skeleton className="h-4 w-36" />
                                            <Skeleton className="h-4 w-24" />
                                            <Skeleton className="h-4 w-16 mx-auto" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <CustomTable1
                        fields={fields}
                        data={filteredData}
                        loading={false}
                        toggleModal={toggleModal}
                        toggle={toggle}
                    />
                )}
            </div>
        </div>
    );
}
