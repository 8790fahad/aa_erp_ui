import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { FaPlus } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import CustomButton from "@/common/Custom/CustomButton";
import { getSuppliers } from "@/redux/actions/suppliers";
import { _fetchApi } from "@/redux/actions/api";
import CustomTable1 from "@/common/Custom/CustomTable1";
import {
  MoreVerticalIcon,
  Upload,
  Truck,
  Building2,
  ChevronDown,
  Check,
  Search,
  Wallet,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import SuppliersUpload from "../suppliers/SuppliersUpload";
import SupplierRegisteration from "../suppliers/SupplierRegisteration";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import ViewSupplierAccounts from "../suppliers/ViewSupplierAccounts";

export default function SupplierTable() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const data = useSelector((state) => state.suppliers.supplierList);
  const [searchText, setSearchText] = useState("");
  const [filterBranches, setFilterBranches] = useState([]);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const branchMenuRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [toggle, setToggle] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal states - Simplified (removed separate bank modal)
  const [showModal, setShowModal] = useState(false);
  const [showViewAccountsModal, setShowViewAccountsModal] = useState(false);

  // Selected data states
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // Mode states
  const [uploadOpen, setUploadOpen] = useState(false);

  const goMakeDeposit = useCallback(
    (supplier = null) => {
      const params = new URLSearchParams({ action: "deposit" });
      const no =
        supplier?.supplier_number ||
        supplier?.supplierNo ||
        supplier?.id ||
        "";
      const name =
        supplier?.supplier_name || supplier?.name || supplier?.supplierName || "";
      if (no) params.set("supplierNo", String(no));
      if (name) params.set("supplierName", String(name));
      navigate(`/app/payments/pay-bills?${params.toString()}`);
    },
    [navigate],
  );

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

  const visibleBranches = useMemo(() => {
    if (!userBranchIds.length) return branches;
    return branches.filter((b) => userBranchIds.includes(Number(b.id)));
  }, [branches, userBranchIds]);

  const toggleModal = useCallback(() => {
    setToggle((prev) => !prev);
  }, []);

  const getSupplierList = useCallback(() => {
    // Wait until a facility/business is available before hitting the API
    if (!activeBusiness?.id) return;

    setLoading(true);
    dispatch(
      getSuppliers(
        () => setLoading(false),
        () => setLoading(false)
      )
    );
  }, [dispatch, activeBusiness?.id]);

  // Helper to keep URL in sync with current state
  const syncUrl = useCallback(
    (nextSearch, nextPage, nextPageSize) => {
      const params = new URLSearchParams(location.search);

      const searchVal =
        typeof nextSearch === "string" ? nextSearch : searchText || "";
      const pageVal =
        typeof nextPage === "number" ? nextPage : currentPage || 1;
      const sizeVal =
        typeof nextPageSize === "number" ? nextPageSize : itemsPerPage || 10;

      if (searchVal) {
        params.set("search", searchVal);
      } else {
        params.delete("search");
      }
      params.set("page", String(pageVal));
      params.set("pageSize", String(sizeVal));

      navigate(
        {
          pathname: location.pathname,
          search: params.toString(),
        },
        { replace: true }
      );
    },
    [navigate, location.pathname, location.search, searchText, currentPage, itemsPerPage]
  );

  // Initialize filters & pagination from URL on first load
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    const urlSearch = params.get("search") || "";
    const urlPage = parseInt(params.get("page") || "1", 10);
    const urlPageSize = parseInt(params.get("pageSize") || "10", 10);

    const initialPage = !Number.isNaN(urlPage) && urlPage > 0 ? urlPage : 1;
    const initialPageSize =
      !Number.isNaN(urlPageSize) && urlPageSize > 0 ? urlPageSize : 10;

    setSearchText(urlSearch);
    setCurrentPage(initialPage);
    setItemsPerPage(initialPageSize);

    // Normalize URL immediately
    syncUrl(urlSearch, initialPage, initialPageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch data whenever filters or pagination change
  useEffect(() => {
    getSupplierList();
  }, [getSupplierList, currentPage, itemsPerPage, searchText]);

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

  useEffect(() => {
    if (!visibleBranches.length) return;
    const validIds = visibleBranches.map((b) => String(b.id));
    setFilterBranches((prev) => {
      const kept = prev.filter((id) => validIds.includes(id));
      if (prev.length === 0) return validIds;
      return kept.length === prev.length ? prev : kept;
    });
  }, [visibleBranches]);

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

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSearch =
        item.supplier_name?.toLowerCase().includes(searchText?.toLowerCase()) ||
        item.name?.toLowerCase().includes(searchText?.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchText?.toLowerCase()) ||
        item.address?.toLowerCase().includes(searchText?.toLowerCase()) ||
        item.supplier_number?.toLowerCase().includes(searchText?.toLowerCase());

      const matchesBranch =
        filterBranches.length === 0 ||
        filterBranches.includes(String(item.branch_id));

      return matchesSearch && matchesBranch;
    });
  }, [data, searchText, filterBranches]);

  // Simplified handler - only one for managing accounts
  const handleManageAccounts = useCallback((supplier) => {
    setSelectedSupplier(supplier);
    setShowViewAccountsModal(true);
  }, []);

  // Close modal handlers
  const closeViewAccountsModal = useCallback(() => {
    setShowViewAccountsModal(false);
    setSelectedSupplier(null);
  }, []);

  const closeSupplierModal = useCallback(() => {
    setShowModal(false);
    setSelectedSupplier(null);
  }, []);

  const fields = [
    {
      title: "Payee ID",
      custom: true,
      component: (item) => (
        <div className="text-sm font-medium text-gray-900">
          {item.supplier_number || "-"}
        </div>
      ),
    },
    {
      title: "Payee Name",
      custom: true,
      component: (item) => (
        <div className="text-sm text-gray-800">{item.supplier_name || "-"}</div>
      ),
    },
    {
      title: "Address",
      custom: true,
      component: (item) => (
        <div className="max-w-[220px] truncate text-sm text-gray-600">
          {item.address && item.address !== "" ? item.address : "-"}
        </div>
      ),
    },
    {
      title: "Email",
      custom: true,
      component: (item) => (
        <div className="text-sm text-gray-600">
          {item.email && item.email !== "" ? item.email : "-"}
        </div>
      ),
    },
    {
      title: "Phone",
      custom: true,
      component: (item) => (
        <div className="text-sm text-gray-600">
          {item.phone && item.phone !== "" ? item.phone : "-"}
        </div>
      ),
    },
    {
      title: "Warehouse",
      custom: true,
      component: (item) => (
        <div className="text-sm text-gray-700">
          {branchNameById(item.branch_id)}
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
                className="flex size-8 text-slate-500 data-[state=open]:bg-slate-100"
                size="icon"
              >
                <MoreVerticalIcon className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => {
                  setSelectedSupplier(item);
                  setShowModal(true);
                }}
              >
                Edit Payee
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => goMakeDeposit(item)}>
                Make Deposit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleManageAccounts(item)}>
                Manage Accounts
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const totalPayees = data.length;

  return (
    <div className="p-4 space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Payees / Suppliers / Vendors
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your payees, suppliers and vendors
              {totalPayees > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {totalPayees} total
                </span>
              )}
            </p>
          </div>
        </div>
        <CustomButton
          className="!mb-0"
          onClick={() => {
            setSelectedSupplier(null);
            setShowModal(true);
          }}
        >
          <FaPlus className="w-4 h-4" />
          Add New Payee
        </CustomButton>
      </div>

      {/* Toolbar */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-1">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchText}
                placeholder="Search in Payees"
                onChange={(e) => {
                  const next = e.target.value;
                  setSearchText(next);
                  setCurrentPage(1);
                  syncUrl(next, 1, itemsPerPage);
                }}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="relative w-full sm:w-60" ref={branchMenuRef}>
              <button
                type="button"
                onClick={() => setBranchMenuOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                ? "border-blue-600 bg-blue-600 text-white"
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
              Upload Payees
            </Button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
          <span>
            Showing {filteredData.length} of {totalPayees} payees
            {filterBranches.length > 0 &&
              filterBranches.length < visibleBranches.length && (
                <span className="ml-1 font-medium text-gray-700">
                  in{" "}
                  {filterBranches.length === 1
                    ? branchNameById(filterBranches[0])
                    : `${filterBranches.length} branches`}
                </span>
              )}
          </span>
          {searchText && (
            <button
              type="button"
              onClick={() => {
                setSearchText("");
                setCurrentPage(1);
                syncUrl("", 1, itemsPerPage);
              }}
              className="font-medium text-blue-600 hover:text-blue-700"
            >
              Clear search
            </button>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      <SuppliersUpload
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploadSuccess={getSupplierList}
      />

      {/* Supplier Registration Modal */}
      <SupplierRegisteration
        closeModal={closeSupplierModal}
        empty={() => setSelectedSupplier(null)}
        showModal={showModal}
        getList={getSupplierList}
        selectedSupplier={selectedSupplier}
      />

      {/* Enhanced View/Manage Accounts Modal */}
      <ViewSupplierAccounts
        closeModal={closeViewAccountsModal}
        showModal={showViewAccountsModal}
        selectedSupplier={selectedSupplier}
        getList={getSupplierList}
      />

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="mt-0">
          {loading ? (
            <div className="w-full">
              <div className="overflow-hidden">
                <div className="border-b bg-gray-50 p-4">
                  <div className="grid grid-cols-7 gap-4">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </div>
                <div className="divide-y">
                  {[...Array(8)].map((_, index) => (
                    <div key={index} className="p-4">
                      <div className="grid grid-cols-7 gap-4">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-4 w-40" />
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
              message="No payees found"
              toggleModal={toggleModal}
              toggle={toggle}
              pageSize={itemsPerPage}
              initialPageIndex={currentPage - 1}
              onPageChange={(page) => {
                setCurrentPage(page);
                syncUrl(undefined, page, itemsPerPage);
              }}
              onPageSizeChange={(size) => {
                setItemsPerPage(size);
                setCurrentPage(1);
                syncUrl(undefined, 1, size);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
