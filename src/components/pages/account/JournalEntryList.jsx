import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Search, Plus, CheckCircle } from "lucide-react";
import { _postApi } from "@/redux/actions/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import CustomTable1 from "@/common/Custom/CustomTable1";
import { formatNumber1 } from "@/components/router/utilities";

const getYearToDateDefaults = () => {
  const formatLocalDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  const now = new Date();
  const today = formatLocalDate(now);
  const yearStart = formatLocalDate(new Date(now.getFullYear(), 0, 1));
  return { yearStart, today };
};

const normalizeStatus = (status) => {
  if (status === "saved" || status === "draft") return "pending";
  if (status === "posted") return "approved";
  if (status === "reversed") return "reversed";
  return status || "pending";
};

const statusLabel = (status) => {
  const s = normalizeStatus(status);
  if (s === "pending") return "Pending Approval";
  if (s === "approved") return "Approved";
  if (s === "reversed") return "Reversed";
  return s;
};

const statusBadgeClass = (status) => {
  const s = normalizeStatus(status);
  if (s === "pending")
    return "border-amber-200 bg-amber-50 text-amber-800";
  if (s === "approved")
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (s === "reversed") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
};

const JournalEntryList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const userId = user?.id || user?.email;
  const userRole = String(
    user?.role || user?.user_role || activeBusiness?.user_role || "admin",
  )
    .toLowerCase()
    .trim();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [approvingRef, setApprovingRef] = useState(null);
  const [autoRangeAdjusted, setAutoRangeAdjusted] = useState(false);
  const defaultDates = getYearToDateDefaults();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "all",
  );
  const [startDate, setStartDate] = useState(
    searchParams.get("startDate") || defaultDates.yearStart,
  );
  const [endDate, setEndDate] = useState(
    searchParams.get("endDate") || defaultDates.today,
  );

  useEffect(() => {
    if (facilityId && startDate && endDate) {
      fetchEntries();
    }
  }, [facilityId, startDate, endDate, searchTerm]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (searchTerm) next.set("q", searchTerm);
    else next.delete("q");
    if (startDate) next.set("startDate", startDate);
    else next.delete("startDate");
    if (endDate) next.set("endDate", endDate);
    else next.delete("endDate");
    if (statusFilter && statusFilter !== "all") next.set("status", statusFilter);
    else next.delete("status");
    setSearchParams(next, { replace: true });
  }, [searchTerm, startDate, endDate, statusFilter, setSearchParams]);

  const fetchEntries = async () => {
    setLoading(true);

    const payload = {
      facility_id: facilityId,
      user_role: userRole,
      page: 1,
      limit: 10000,
      start_date: startDate,
      end_date: endDate,
    };

    if (searchTerm) payload.reference = searchTerm;

    _postApi(
      `/api/journals/list`,
      payload,
      (resp) => {
        setLoading(false);
        if (resp.success) {
          const rows = resp.data || [];
          setEntries(rows);
          if (
            rows.length === 0 &&
            !searchTerm &&
            !autoRangeAdjusted &&
            startDate !== defaultDates.yearStart
          ) {
            setAutoRangeAdjusted(true);
            setStartDate(defaultDates.yearStart);
          }
        }
      },
      (err) => {
        setLoading(false);
        toast.error(err.message || "Failed to load journal entries");
      },
    );
  };

  const handleApprove = (item) => {
    if (
      !window.confirm(
        `Approve ${item.reference_number || item.transaction_ref}? It will enter the ledger and cannot be edited.`,
      )
    ) {
      return;
    }

    setApprovingRef(item.transaction_ref);
    _postApi(
      `/api/journals/${item.transaction_ref}/post`,
      {
        facility_id: facilityId,
        user_id: userId,
        user_role: userRole,
      },
      (resp) => {
        setApprovingRef(null);
        if (resp.success) {
          toast.success("Journal entry approved — now in the ledger.");
          fetchEntries();
        } else {
          toast.error(resp.message || "Failed to approve journal entry");
        }
      },
      (err) => {
        setApprovingRef(null);
        toast.error(err.message || "Failed to approve journal entry");
      },
      "POST",
    );
  };

  const filteredEntries = useMemo(() => {
    if (statusFilter === "all") return entries;
    return entries.filter(
      (item) => normalizeStatus(item.status) === statusFilter,
    );
  }, [entries, statusFilter]);

  const counts = useMemo(() => {
    const c = { all: entries.length, pending: 0, approved: 0, reversed: 0 };
    entries.forEach((e) => {
      const s = normalizeStatus(e.status);
      if (c[s] !== undefined) c[s] += 1;
    });
    return c;
  }, [entries]);

  // API allows any authenticated user to approve; keep UI aligned.
  const canManage = true;
  const fields = [
    { title: "Reference", value: "reference_number" },
    { title: "Date", value: "entry_date" },
    { title: "Description", value: "description" },
    {
      title: "Total Debit",
      className: "text-right",
      custom: true,
      component: (item) => (
        <div className="text-right tabular-nums text-slate-800">
          ₦{formatNumber1(item.total_debit || 0)}
        </div>
      ),
    },
    {
      title: "Total Credit",
      className: "text-right",
      custom: true,
      component: (item) => (
        <div className="text-right tabular-nums text-slate-800">
          ₦{formatNumber1(item.total_credit || 0)}
        </div>
      ),
    },
    {
      title: "Status",
      custom: true,
      component: (item) => (
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
            item.status,
          )}`}
        >
          {statusLabel(item.status)}
        </span>
      ),
    },
    { title: "Created By", value: "created_by" },
    {
      title: "Actions",
      className: "text-right",
      custom: true,
      component: (item) => {
        const pending = normalizeStatus(item.status) === "pending";
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-sm font-medium capitalize text-[var(--aa-accent)] hover:bg-slate-100 hover:text-[var(--aa-navy)]"
              onClick={() =>
                navigate(`/app/account/journal-entries/${item.transaction_ref}`)
              }
            >
              View
            </Button>
            {pending && canManage && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-[var(--aa-navy)]"
                  onClick={() =>
                    navigate(
                      `/app/account/journal-entries/${item.transaction_ref}/edit`,
                    )
                  }
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 px-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                  disabled={approvingRef === item.transaction_ref}
                  onClick={() => handleApprove(item)}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  {approvingRef === item.transaction_ref
                    ? "Approving…"
                    : "Approve"}
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  const filterTabs = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "reversed", label: "Reversed" },
  ];

  return (
    <div className="min-h-[70vh] px-3 py-4 sm:px-4 lg:px-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
            <BookOpen className="h-5 w-5 text-[var(--aa-navy,#0f2744)]" />
            Journal Entries
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Save for approval — approved entries post to the ledger
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-2 border-0 bg-[var(--aa-navy,#0f2744)] text-white shadow-none hover:bg-[var(--aa-navy-hover,var(--aa-navy,#0f2744))] hover:opacity-90"
          onClick={() => navigate("/app/account/journal-entries/new")}
        >
          <Plus className="h-4 w-4" />
          New Journal Entry
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  statusFilter === tab.key
                    ? "bg-[var(--aa-navy)] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
                <span className="ml-1 opacity-70">({counts[tab.key] || 0})</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {loading
              ? "Loading…"
              : `${filteredEntries.length} entr${
                  filteredEntries.length === 1 ? "y" : "ies"
                }`}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50/50 p-4 md:grid-cols-3 lg:grid-cols-[1fr_10rem_10rem]">
          <div className="min-w-0">
            <Label
              htmlFor="journal-search"
              className="mb-1.5 text-xs font-medium text-slate-600"
            >
              Search
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="journal-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Reference or description…"
                className="h-9 border-slate-200 bg-white pl-9 text-sm"
              />
            </div>
          </div>
          <div>
            <Label
              htmlFor="journal-start"
              className="mb-1.5 text-xs font-medium text-slate-600"
            >
              From
            </Label>
            <Input
              id="journal-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 border-slate-200 bg-white text-sm"
            />
          </div>
          <div>
            <Label
              htmlFor="journal-end"
              className="mb-1.5 text-xs font-medium text-slate-600"
            >
              To
            </Label>
            <Input
              id="journal-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 border-slate-200 bg-white text-sm"
            />
          </div>
        </div>

        <div className="p-0">
          <CustomTable1
            fields={fields}
            data={filteredEntries}
            loading={loading}
            message="No journal entries found for this filter."
          />
        </div>
      </div>
    </div>
  );
};

export default JournalEntryList;
