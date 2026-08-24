import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaPlus } from "react-icons/fa";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import CustomButton from "@/common/Custom/CustomButton";
import { Skeleton } from "@/components/ui/skeleton";
import CustomTable1 from "@/common/Custom/CustomTable1";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MoreVerticalIcon,
  Upload,
  Wallet,
  Search,
  Users,
  Building2,
  ChevronDown,
  Check,
} from "lucide-react";
import CustomersUpload from "./components/CustomersUpload";
import CustomerRegistartion from "./CustomerRegistration";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";

export default function CustomerTable() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [filterText, setFilterText] = useState("");
  const [filterBranches, setFilterBranches] = useState([]); // selected branch ids (strings)
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const branchMenuRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const formatMoney = (amount) => formatNumber1(parseFloat(amount) || 0);

  const formatDisplayPhone = (phone) => {
    const raw = String(phone || "").trim();
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("234") && digits.length >= 13) {
      return `+${digits}`;
    }
    if (digits.startsWith("0") && digits.length === 11) {
      return `+234${digits.slice(1)}`;
    }
    if (digits.length === 10) {
      return `+234${digits}`;
    }
    return raw.startsWith("+") ? raw : `+${digits || raw}`;
  };
  // Branch ids assigned to the logged-in user (multi-branch aware).
  const userBranchIds = useMemo(() => {
    if (Array.isArray(user?.branchIds) && user.branchIds.length > 0) {
      return user.branchIds.map(Number).filter(Boolean);
    }
    if (Array.isArray(user?.branches) && user.branches.length > 0) {
      return user.branches
        .map((b) => Number(b.id || b.branch_id))
        .filter(Boolean);
    }
    if (user?.branchId) return [Number(user.branchId)];
    return [];
  }, [user?.branchIds, user?.branches, user?.branchId]);

  // Only show branches assigned to the user. If the user has no explicit
  // assignment (e.g. legacy admins), fall back to all branches.
  const visibleBranches = useMemo(() => {
    if (!userBranchIds.length) return branches;
    return branches.filter((b) => userBranchIds.includes(Number(b.id)));
  }, [branches, userBranchIds]);
  const [loading, setLoading] = useState(true);
  const [customerList, setCustomerList] = useState([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const goMakeDeposit = useCallback(
    (customer = null) => {
      const params = new URLSearchParams({ action: "deposit" });
      if (customer?.customerNo) {
        params.set("customerNo", customer.customerNo);
        const name =
          customer.fullname ||
          customer.name ||
          customer.customerName ||
          "";
        if (name) params.set("customerName", name);
      }
      navigate(`/app/payments/collection-points?${params.toString()}`);
    },
    [navigate],
  );

  const getList = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoading(true);
    _fetchApi(
      `/api/v1/get-customers-list/${activeBusiness.id}`,
      (data) => {
        if (data.results) {
          setCustomerList(data.results);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching customers:", err);
        setLoading(false);
      },
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    getList();
  }, [getList]);

  useEffect(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/account/get/branches?facilityId=${activeBusiness.id}`,
      (res) => {
        if (res.success) setBranches(res.results || []);
      },
      (err) => console.error("Error fetching warehouses:", err),
    );
  }, [activeBusiness?.id]);

  // Default to all of the user's assigned branches, and drop any selection
  // that is no longer available to the user.
  useEffect(() => {
    if (!visibleBranches.length) return;
    const validIds = visibleBranches.map((b) => String(b.id));
    setFilterBranches((prev) => {
      const kept = prev.filter((id) => validIds.includes(id));
      // First load (nothing selected yet) → select all assigned branches.
      if (prev.length === 0) return validIds;
      return kept.length === prev.length ? prev : kept;
    });
  }, [visibleBranches]);

  // Close the branch menu when clicking outside of it.
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (branchMenuRef.current && !branchMenuRef.current.contains(e.target)) {
        setBranchMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleBranch = (id) => {
    const key = String(id);
    setFilterBranches((prev) =>
      prev.includes(key) ? prev.filter((b) => b !== key) : [...prev, key],
    );
  };

  const branchNameById = (id) => {
    if (id == null || id === "") return "-";
    const match = branches.find((b) => String(b.id) === String(id));
    return match ? match.branch_name : "-";
  };

  const matchesText = (item) =>
    !filterText.length ||
    (item.fullname &&
      item.fullname.toLowerCase().includes(filterText.toLowerCase())) ||
    (item.company_name &&
      item.company_name.toLowerCase().includes(filterText.toLowerCase())) ||
    (item.address &&
      item.address.toLowerCase().includes(filterText.toLowerCase())) ||
    (item.phone &&
      item.phone.toLowerCase().includes(filterText.toLowerCase())) ||
    (item.mobile &&
      item.mobile.toLowerCase().includes(filterText.toLowerCase())) ||
    (item.email &&
      item.email.toLowerCase().includes(filterText.toLowerCase())) ||
    (item.customerNo &&
      item.customerNo.toLowerCase().includes(filterText.toLowerCase()));

  const matchesBranch = (item) =>
    filterBranches.length === 0 ||
    filterBranches.includes(String(item.branch_id));

  const rows = customerList.filter(
    (item) => matchesText(item) && matchesBranch(item),
  );

  const allRowIds = useMemo(
    () => rows.map((r) => String(r.customerNo)),
    [rows],
  );
  const allSelected =
    allRowIds.length > 0 && allRowIds.every((id) => selectedIds.has(id));
  const someSelected =
    allRowIds.some((id) => selectedIds.has(id)) && !allSelected;

  const toggleSelectAll = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        allRowIds.forEach((id) => next.add(id));
      } else {
        allRowIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const toggleSelectRow = (customerNo, checked) => {
    const id = String(customerNo);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const openCustomer = (item) => {
    setSelectedCustomer(item);
    setShowModal(true);
  };

  const columns = [
    {
      value: "select",
      title: (
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={(v) => toggleSelectAll(!!v)}
          aria-label="Select all customers"
        />
      ),
      custom: true,
      className: "text-center w-10",
      component: (item) => (
        <div
          className="flex justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={selectedIds.has(String(item.customerNo))}
            onCheckedChange={(v) => toggleSelectRow(item.customerNo, !!v)}
            aria-label={`Select ${item.fullname || item.customerNo}`}
          />
        </div>
      ),
    },
    {
      value: "customerNo",
      title: "CUSTOMER ID",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-left font-mono text-xs text-slate-700">
          {item.customerNo || item.customer_id || "-"}
        </div>
      ),
    },
    {
      value: "fullname",
      title: "NAME",
      custom: true,
      className: "text-left",
      component: (item) => (
        <button
          type="button"
          onClick={() => openCustomer(item)}
          className="text-left font-medium text-[var(--aa-accent)] hover:underline"
        >
          {item.fullname || item.company_name || item.customerNo || "-"}
        </button>
      ),
    },
    {
      value: "company_name",
      title: "CUSTOMER NAME",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-left text-gray-700">
          {item.company_name || item.fullname || "-"}
        </div>
      ),
    },
    {
      value: "email",
      title: "EMAIL",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-left text-gray-700">
          {item.email && item.email !== "" ? item.email : "-"}
        </div>
      ),
    },
    {
      value: "phone",
      title: "PHONE NUMBER",
      custom: true,
      className: "text-left",
      component: (item) => {
        const phone = formatDisplayPhone(item.phone || item.mobile || "");
        return (
          <div className="text-left text-gray-700">
            {phone !== "" ? phone : "-"}
          </div>
        );
      },
    },
    {
      value: "receivables",
      title: (
        <span className="inline-flex flex-col items-end leading-tight">
          <span>RECEIVABLES</span>
          <span className="text-[10px] font-normal text-slate-500">₦</span>
        </span>
      ),
      custom: true,
      className: "text-right",
      component: (item) => (
        <div className="text-right tabular-nums text-gray-800">
          {formatMoney(item.receivables)}
        </div>
      ),
    },
    {
      value: "unused_credits",
      title: (
        <span className="inline-flex flex-col items-end leading-tight">
          <span>UNUSED CREDITS</span>
          <span className="text-[10px] font-normal text-slate-500">₦</span>
        </span>
      ),
      custom: true,
      className: "text-right",
      component: (item) => (
        <div className="text-right tabular-nums text-gray-800">
          {formatMoney(item.unused_credits)}
        </div>
      ),
    },
    {
      value: "action",
      title: "",
      custom: true,
      className: "text-center w-12",
      component: (item) => (
        <div className="flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex size-8 text-slate-500 data-[state=open]:bg-slate-100"
                size="icon"
              >
                <MoreVerticalIcon />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => openCustomer(item)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => goMakeDeposit(item)}>
                Make Deposit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const totalCustomers = customerList.length;

  return (
    <div className="p-4 space-y-5">
      {/* Page header — Zoho-style Active Customers */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Active Customers
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your customers
              {totalCustomers > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {totalCustomers} total
                </span>
              )}
            </p>
          </div>
        </div>
        <CustomButton
          size="sm"
          color="primary"
          onClick={() => {
            setSelectedCustomer(null);
            setShowModal(true);
          }}
        >
          <FaPlus className="mr-1" />
          New
        </CustomButton>
      </div>

      <CustomerRegistartion
        closeModal={() => {
          setShowModal(false);
          setSelectedCustomer(null);
        }}
        showModal={showModal}
        getList={getList}
        selectedCustomer={selectedCustomer}
      />

      {/* Toolbar */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-1">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filterText}
                placeholder="Search in Customers"
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--aa-accent)]"
              />
            </div>
            <div className="relative w-full sm:w-60" ref={branchMenuRef}>
              <button
                type="button"
                onClick={() => setBranchMenuOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--aa-accent)]"
              >
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <span className="truncate text-left text-gray-700">
                  {filterBranches.length === 0
                    ? "All branches"
                    : filterBranches.length === visibleBranches.length
                      ? "All branches"
                      : filterBranches.length === 1
                        ? branchNameById(filterBranches[0])
                        : `${filterBranches.length} branches selected`}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
              </button>

              {branchMenuOpen && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setFilterBranches(
                          visibleBranches.map((b) => String(b.id)),
                        )
                      }
                      className="font-medium text-blue-600 hover:text-blue-700"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterBranches([])}
                      className="font-medium text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1">
                    {visibleBranches.length === 0 && (
                      <div className="px-3 py-2 text-xs text-gray-400">
                        No branches available
                      </div>
                    )}
                    {visibleBranches.map((b) => {
                      const checked = filterBranches.includes(String(b.id));
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => toggleBranch(b.id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                              checked
                                ? "border-blue-600 bg-[var(--aa-navy)] text-white"
                                : "border-gray-300 bg-white"
                            }`}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          <span className="truncate text-gray-700">
                            {b.branch_name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => goMakeDeposit()}
            >
              <Wallet className="h-4 w-4" />
              Make Deposit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="h-4 w-4" />
              Upload Customers
            </Button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
          <span>
            Showing {rows.length} of {totalCustomers} customers
            {filterBranches.length > 0 &&
              filterBranches.length < visibleBranches.length && (
                <span className="ml-1 font-medium text-gray-700">
                  in{" "}
                  {filterBranches.length === 1
                    ? branchNameById(filterBranches[0])
                    : `${filterBranches.length} branches`}
                </span>
              )}
            {selectedIds.size > 0 && (
              <span className="ml-2 font-medium text-blue-600">
                · {selectedIds.size} selected
              </span>
            )}
          </span>
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText("")}
              className="font-medium text-blue-600 hover:text-blue-700"
            >
              Clear search
            </button>
          )}
        </div>
      </div>

      <CustomersUpload
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploadSuccess={getList}
      />

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="mt-0">
          {loading ? (
            <div className="w-full">
              <div className="overflow-hidden">
                <div className="border-b bg-gray-50 p-4">
                  <div className="grid grid-cols-7 gap-4">
                    <Skeleton className="h-5 w-6" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </div>
                <div className="divide-y">
                  {[...Array(8)].map((_, index) => (
                    <div key={index} className="p-4">
                      <div className="grid grid-cols-7 gap-4">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-20 ml-auto" />
                        <Skeleton className="h-4 w-20 ml-auto" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <CustomTable1
              data={rows}
              fields={columns}
              message="No customers found"
            />
          )}
        </div>
      </div>
    </div>
  );
}
