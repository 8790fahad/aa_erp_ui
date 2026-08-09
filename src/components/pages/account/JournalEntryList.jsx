import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Search, Plus, Eye, Edit } from "lucide-react";
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

const JournalEntryList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const userRole =
    user?.role || user?.user_role || activeBusiness?.user_role || "admin";

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoRangeAdjusted, setAutoRangeAdjusted] = useState(false);
  const defaultDates = getYearToDateDefaults();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
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
    setSearchParams(next, { replace: true });
  }, [searchTerm, startDate, endDate, setSearchParams]);

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

  const canEdit = userRole === "admin" || userRole === "accountant";
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
    { title: "Created By", value: "created_by" },
    {
      title: "Actions",
      className: "text-right",
      custom: true,
      component: (item) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-slate-600 hover:bg-[var(--aa-sidebar-active,#eff4fb)] hover:text-[#4267B2]"
            onClick={() =>
              navigate(`/app/account/journal-entries/${item.transaction_ref}`)
            }
          >
            <Eye className="h-4 w-4" />
          </Button>
          {item.status === "draft" && canEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-slate-600 hover:bg-[var(--aa-sidebar-active,#eff4fb)] hover:text-[#4267B2]"
              onClick={() =>
                navigate(
                  `/app/account/journal-entries/${item.transaction_ref}/edit`,
                )
              }
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
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
            Create and manage accounting journal entries
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
          <p className="text-sm font-medium text-slate-800">Journal entries</p>
          <p className="text-xs text-slate-500">
            {loading
              ? "Loading…"
              : `${entries.length} entr${entries.length === 1 ? "y" : "ies"}`}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50/50 p-4 md:grid-cols-3 lg:grid-cols-[1fr_10rem_10rem]">
          <div className="min-w-0">
            <Label
              htmlFor="journal-search"
              className="mb-1.5 text-xs font-medium text-slate-600"
            >
              Search reference
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="journal-search"
                type="search"
                placeholder="Search by reference…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchEntries()}
                className="h-9 border-slate-200 bg-white pl-9 text-sm focus-visible:border-[#4267B2] focus-visible:ring-[#4267B2]/20"
              />
            </div>
          </div>
          <div>
            <Label
              htmlFor="journal-start"
              className="mb-1.5 text-xs font-medium text-slate-600"
            >
              Start date
            </Label>
            <Input
              id="journal-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 border-slate-200 bg-white text-sm focus-visible:border-[#4267B2] focus-visible:ring-[#4267B2]/20"
            />
          </div>
          <div>
            <Label
              htmlFor="journal-end"
              className="mb-1.5 text-xs font-medium text-slate-600"
            >
              End date
            </Label>
            <Input
              id="journal-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 border-slate-200 bg-white text-sm focus-visible:border-[#4267B2] focus-visible:ring-[#4267B2]/20"
            />
          </div>
        </div>

        <div className="p-0">
          <CustomTable1
            data={entries}
            fields={fields}
            loading={loading}
            pageSize={20}
            message="No journal entries found matching your criteria."
            emptyHint="Try a wider date range or clear the search."
          />
        </div>
      </div>
    </div>
  );
};

export default JournalEntryList;
