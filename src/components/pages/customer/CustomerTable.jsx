import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MoreVertical,
  Upload,
  Search,
  Users,
  ChevronDown,
  Check,
  Plus,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";
import CustomersUpload from "./components/CustomersUpload";
import CustomerRegistartion from "./CustomerRegistration";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import { customerKindLabel, isWalkInCustomer, isUnlimitedCreditLimit } from "@/utils/customerKind";

const AVATAR_BG = [
  "linear-gradient(155deg,#4d6bff,#141c56)",
  "linear-gradient(155deg,#0f9d58,#0a6b3c)",
  "linear-gradient(155deg,#b5790a,#8a5c06)",
  "linear-gradient(155deg,#3457ff,#141c56)",
];

function customerInitials(item) {
  const name = String(item?.fullname || item.company_name || "").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return (item?.customerNo || "?").slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function avatarBg(key) {
  const s = String(key || "");
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) hash = (hash + s.charCodeAt(i) * (i + 1)) % 997;
  return AVATAR_BG[hash % AVATAR_BG.length];
}

export default function CustomerTable() {
  const [showModal, setShowModal] = useState(false);
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [filterText, setFilterText] = useState("");
  const [filterBranches, setFilterBranches] = useState([]);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const branchMenuRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const formatMoney = (amount) => `₦${formatNumber1(parseFloat(amount) || 0)}`;

  const formatDisplayPhone = (phone) => {
    const raw = String(phone || "").trim();
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("234") && digits.length >= 13) return `+${digits}`;
    if (digits.startsWith("0") && digits.length === 11) {
      return `+234${digits.slice(1)}`;
    }
    if (digits.length === 10) return `+234${digits}`;
    return raw.startsWith("+") ? raw : `+${digits || raw}`;
  };

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
  const [loading, setLoading] = useState(true);
  const [customerList, setCustomerList] = useState([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const getList = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    _fetchApi(
      `/api/v1/get-customers-list/${activeBusiness.id}`,
      (data) => {
        if (data.results) setCustomerList(data.results);
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

  useEffect(() => {
    if (!visibleBranches.length) return;
    const validIds = visibleBranches.map((b) => String(b.id));
    setFilterBranches((prev) => {
      if (prev.length === 0) return prev;
      const kept = prev.filter((id) => validIds.includes(id));
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
    if (id == null || id === "") return "—";
    const match = branches.find((b) => String(b.id) === String(id));
    return match ? match.branch_name : "—";
  };

  const matchesText = (item) =>
    !filterText.length ||
    [
      item.fullname,
      item.company_name,
      item.address,
      item.phone,
      item.mobile,
      item.email,
      item.customerNo,
      item.customer_type,
      customerKindLabel(item),
    ].some((v) => String(v || "").toLowerCase().includes(filterText.toLowerCase()));

  const viewingAllWarehouses =
    filterBranches.length === 0 ||
    (visibleBranches.length > 0 &&
      filterBranches.length === visibleBranches.length);

  const matchesBranch = (item) => {
    if (viewingAllWarehouses) return true;
    const bid =
      item.branch_id == null || String(item.branch_id).trim() === ""
        ? ""
        : String(item.branch_id);
    if (!bid) return true;
    return filterBranches.includes(bid);
  };

  const rows = customerList.filter(
    (item) => matchesText(item) && matchesBranch(item),
  );

  useEffect(() => {
    setPageIndex(0);
  }, [filterText, filterBranches, pageSize]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize) || 1);
  const safePage = Math.min(pageIndex, pageCount - 1);
  const pageRows = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const allRowIds = useMemo(
    () => pageRows.map((r) => String(r.customerNo)),
    [pageRows],
  );
  const allSelected =
    allRowIds.length > 0 && allRowIds.every((id) => selectedIds.has(id));
  const someSelected =
    allRowIds.some((id) => selectedIds.has(id)) && !allSelected;

  const toggleSelectAll = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) allRowIds.forEach((id) => next.add(id));
      else allRowIds.forEach((id) => next.delete(id));
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

  const totalCustomers = customerList.length;
  const branchLabel =
    filterBranches.length === 0 ||
    filterBranches.length === visibleBranches.length
      ? "All branches"
      : filterBranches.length === 1
        ? branchNameById(filterBranches[0])
        : `${filterBranches.length} branches selected`;

  return (
    <div className="min-h-full bg-[#f4f5fa] px-4 py-6 sm:px-7">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-[22px] flex items-center gap-1.5 text-[12.5px] font-medium tracking-wide text-[#6a6f8f]">
          <span>app</span>
          <span className="text-[#a8acc4]">›</span>
          <span className="font-semibold text-[#151a33]">customers</span>
        </div>

        <div className="mb-[26px] flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl text-white shadow-[0_6px_16px_-6px_rgba(52,87,255,.55)]"
              style={{
                background: "linear-gradient(155deg,#4d6bff,#141c56)",
              }}
            >
              <Users className="h-[22px] w-[22px]" />
            </div>
            <div>
              <h1 className="flex items-center gap-2.5 text-[26px] font-extrabold tracking-tight text-[#151a33]">
                Active Customers
                {totalCustomers > 0 ? (
                  <span className="rounded-full bg-[#eef1ff] px-2.5 py-0.5 text-xs font-bold tracking-wide text-[#3457ff]">
                    {totalCustomers} total
                  </span>
                ) : null}
              </h1>
              <p className="mt-1 text-sm font-medium text-[#6a6f8f]">
                Manage your customers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedCustomer(null);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#0d1440] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_-4px_rgba(13,20,64,.4)] hover:-translate-y-px"
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            New customer
          </button>
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

        <div className="overflow-hidden rounded-2xl border border-[#e6e8f2] bg-white shadow-[0_1px_2px_rgba(20,25,60,.03),0_12px_32px_-18px_rgba(20,25,60,.10)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-[#e6e8f2] px-[22px] py-5">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-[13px] top-1/2 h-4 w-4 -translate-y-1/2 text-[#a8acc4]" />
              <input
                type="text"
                value={filterText}
                placeholder="Search in customers"
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full rounded-[10px] border border-[#e6e8f2] bg-[#f4f5fa] py-[11px] pl-10 pr-3.5 text-sm font-medium text-[#151a33] outline-none placeholder:font-medium placeholder:text-[#a8acc4] focus:border-[#4d6bff] focus:bg-white"
              />
            </div>
            <div className="relative" ref={branchMenuRef}>
              <button
                type="button"
                onClick={() => setBranchMenuOpen((o) => !o)}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-[10px] border border-[#e6e8f2] bg-[#f4f5fa] px-3.5 py-[11px] text-[13.5px] font-semibold text-[#3d4260]"
              >
                {branchLabel}
                <ChevronDown className="h-3.5 w-3.5 text-[#6a6f8f]" />
              </button>
              {branchMenuOpen && (
                <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-lg border border-[#e6e8f2] bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-[#e6e8f2] px-3 py-2 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setFilterBranches(visibleBranches.map((b) => String(b.id)))
                      }
                      className="font-medium text-[#3457ff]"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterBranches([])}
                      className="font-medium text-[#6a6f8f]"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1">
                    {visibleBranches.map((b) => {
                      const checked = filterBranches.includes(String(b.id));
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => toggleBranch(b.id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#fafbff]"
                        >
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                              checked
                                ? "border-[#3457ff] bg-[#0d1440] text-white"
                                : "border-[#e6e8f2] bg-white"
                            }`}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          <span className="truncate text-[#3d4260]">
                            {b.branch_name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[#e6e8f2] bg-white px-4 py-[11px] text-[13.5px] font-semibold text-[#3d4260] hover:border-[#4d6bff] hover:text-[#3457ff]"
            >
              <Upload className="h-[15px] w-[15px]" />
              Upload
            </button>
          </div>

          <div className="px-[22px] pb-1 pt-3.5 text-[12.5px] font-semibold tracking-wide text-[#6a6f8f]">
            Showing {rows.length} of {totalCustomers} customers
            {selectedIds.size > 0 ? (
              <span className="ml-2 text-[#3457ff]">
                · {selectedIds.size} selected
              </span>
            ) : null}
          </div>

          <CustomersUpload
            open={uploadOpen}
            onClose={() => setUploadOpen(false)}
            onUploadSuccess={getList}
          />

          <div className="overflow-x-auto">
            {loading ? (
              <div className="px-[22px] py-6">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="mb-3 h-12 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="px-[22px] py-16 text-center text-sm font-medium text-[#6a6f8f]">
                No customers found. Try adjusting your filters.
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="w-[34px] border-b border-[#e6e8f2] py-3.5 pl-[22px] pr-2.5 text-left">
                      <Checkbox
                        checked={
                          allSelected ? true : someSelected ? "indeterminate" : false
                        }
                        onCheckedChange={(v) => toggleSelectAll(!!v)}
                        aria-label="Select all customers"
                      />
                    </th>
                    {[
                      ["Customer", false],
                      ["Type", false],
                      ["Company", false],
                      ["Contact", false],
                      ["Receivables", true, "₦ used"],
                      ["Credit use", true],
                      ["Credit limit", true],
                      ["Deposit", true, "₦ unearned"],
                    ].map(([label, num, unit]) => (
                      <th
                        key={label}
                        className={`whitespace-nowrap border-b border-[#e6e8f2] px-2.5 py-3.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#6a6f8f] ${
                          num ? "text-right" : "text-left"
                        }`}
                      >
                        {label}
                        {unit ? (
                          <span className="mt-0.5 block text-[9.5px] font-semibold normal-case tracking-normal text-[#a8acc4]">
                            {unit}
                          </span>
                        ) : null}
                      </th>
                    ))}
                    <th className="border-b border-[#e6e8f2] py-3.5 pr-[22px]" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((item) => {
                    const displayName =
                      item.fullname || item.company_name || item.customerNo || "—";
                    const company = item.company_name || item.fullname || "—";
                    const email = String(item.email || "").trim();
                    const phone = formatDisplayPhone(item.phone || item.mobile || "");
                    const limit = parseFloat(item.credit_limit);
                    const walkIn = isWalkInCustomer(item);
                    const unlimited = isUnlimitedCreditLimit(item.credit_limit, {
                      walkIn,
                    });
                    const pct = unlimited ? null : Number(item.credit_used_percent ?? 0);
                    const deposit = parseFloat(
                      item.deposit ?? item.unearned_deposit ?? item.unused_credits,
                    ) || 0;
                    const barPct = pct == null ? 0 : Math.min(100, Math.max(0, pct));
                    const barColor =
                      pct == null
                        ? "#0f9d58"
                        : pct >= 100
                          ? "#c0392b"
                          : pct >= 80
                            ? "#b5790a"
                            : "#0f9d58";
                    return (
                      <tr
                        key={item.customerNo}
                        className="border-b border-[#e6e8f2] last:border-b-0 hover:bg-[#fafbff]"
                      >
                        <td className="py-[15px] pl-[22px] pr-2.5">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(String(item.customerNo))}
                              onCheckedChange={(v) =>
                                toggleSelectRow(item.customerNo, !!v)
                              }
                              aria-label={`Select ${displayName}`}
                            />
                          </div>
                        </td>
                        <td className="px-2.5 py-[15px]" data-label="Customer">
                          <div className="flex items-center gap-[11px]">
                            <div
                              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] text-[12.5px] font-bold text-white"
                              style={{
                                background: avatarBg(item.customerNo),
                              }}
                            >
                              {customerInitials(item)}
                            </div>
                            <div>
                              <button
                                type="button"
                                onClick={() => openCustomer(item)}
                                className="text-[13.5px] font-semibold text-[#0d1440] hover:text-[#3457ff]"
                              >
                                {displayName}
                              </button>
                              <div className="mt-px font-mono text-[11.5px] font-medium text-[#a8acc4]">
                                {item.customerNo}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td
                          className="px-2.5 py-[15px]"
                          data-label="Type"
                        >
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                              walkIn
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-[#3d4260]"
                            }`}
                          >
                            {customerKindLabel(item)}
                          </span>
                        </td>
                        <td
                          className="px-2.5 py-[15px] text-[13.5px] font-medium text-[#3d4260]"
                          data-label="Company"
                        >
                          {company}
                        </td>
                        <td
                          className="px-2.5 py-[15px] text-[13.5px] font-medium text-[#3d4260]"
                          data-label="Contact"
                        >
                          {email ? (
                            email
                          ) : (
                            <span className="text-[#a8acc4]">—</span>
                          )}
                          {phone ? (
                            <div className="mt-px text-xs text-[#6a6f8f]">
                              {phone}
                            </div>
                          ) : null}
                        </td>
                        <td
                          className="whitespace-nowrap px-2.5 py-[15px] text-right font-mono text-[13.5px] font-medium tabular-nums text-[#151a33]"
                          data-label="Receivables"
                        >
                          {formatMoney(item.receivables)}
                        </td>
                        <td className="px-2.5 py-[15px]" data-label="Credit use">
                          <div className="flex min-w-[74px] flex-col items-end gap-1.5">
                            {unlimited ? (
                              <span className="text-xs font-medium text-[#a8acc4]">
                                — unlimited
                              </span>
                            ) : (
                              <>
                                <div className="h-[5px] w-[74px] overflow-hidden rounded-full bg-[#e6e8f2]">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${barPct}%`,
                                      background: barColor,
                                    }}
                                  />
                                </div>
                                <span
                                  className="text-xs font-bold tabular-nums"
                                  style={{ color: barColor }}
                                >
                                  {Number(pct).toFixed(1)}%
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td
                          className="px-2.5 py-[15px] text-right"
                          data-label="Credit limit"
                        >
                          {unlimited ? (
                            <span className="inline-flex rounded-full bg-[#eef1ff] px-2.5 py-0.5 text-[11.5px] font-bold tracking-wide text-[#3457ff]">
                              Unlimited
                            </span>
                          ) : (
                            <span className="whitespace-nowrap font-mono text-[13.5px] font-medium tabular-nums text-[#151a33]">
                              {formatMoney(limit)}
                            </span>
                          )}
                        </td>
                        <td
                          className="px-2.5 py-[15px] text-right"
                          data-label="Deposit"
                        >
                          <div className="font-mono text-[13.5px] font-bold tabular-nums text-[#151a33]">
                            {formatMoney(deposit)}
                          </div>
                          <span
                            className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide ${
                              deposit > 0.009
                                ? "bg-[#fdf3e2] text-[#b5790a]"
                                : "bg-[#f4f5fa] text-[#a8acc4]"
                            }`}
                          >
                            {deposit > 0.009 ? "Held" : "None held"}
                          </span>
                        </td>
                        <td className="py-[15px] pr-[18px]">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-[#6a6f8f] hover:bg-[#f4f5fa] hover:text-[#151a33]"
                              >
                                <MoreVertical className="h-[17px] w-[17px]" />
                                <span className="sr-only">Open menu</span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => openCustomer(item)}>
                                Edit
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6e8f2] px-[22px] py-4">
            <div className="flex items-center gap-2.5 text-[13px] font-medium text-[#6a6f8f]">
              Rows per page
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-[#e6e8f2] bg-white px-2.5 py-1.5 text-[13px] font-semibold text-[#151a33]"
              >
                {[10, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3.5">
              <span className="text-[13px] font-medium text-[#6a6f8f]">
                Page {safePage + 1} of {pageCount}
              </span>
              <div className="flex gap-1.5">
                {[
                  [ChevronsLeft, 0, safePage === 0],
                  [ChevronLeft, safePage - 1, safePage === 0],
                  [ChevronRight, safePage + 1, safePage >= pageCount - 1],
                  [ChevronsRight, pageCount - 1, safePage >= pageCount - 1],
                ].map(([Icon, next, disabled], i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={disabled}
                    onClick={() => setPageIndex(Math.max(0, Math.min(pageCount - 1, next)))}
                    className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[#e6e8f2] bg-white text-[#6a6f8f] hover:border-[#4d6bff] hover:text-[#3457ff] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon className="h-[15px] w-[15px]" strokeWidth={2.4} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
