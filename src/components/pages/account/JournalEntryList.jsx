import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BookOpen,
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  Download,
} from "lucide-react";
import { _postApi } from "@/redux/actions/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import CustomButton from "@/common/Custom/CustomButton";
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
  // Try multiple sources for user role
  const userRole =
    user?.role || user?.user_role || activeBusiness?.user_role || "admin";

  console.log("Journal Entry List - User info:", {
    user,
    facilityId,
    userRole,
  });

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoRangeAdjusted, setAutoRangeAdjusted] = useState(false);
  const defaultDates = getYearToDateDefaults();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [startDate, setStartDate] = useState(
    searchParams.get("startDate") || defaultDates.yearStart
  );
  const [endDate, setEndDate] = useState(
    searchParams.get("endDate") || defaultDates.today
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

    console.log("Fetching journal entries with payload:", payload);

    _postApi(
      `/api/journals/list`,
      payload,
      (resp) => {
        setLoading(false);
        console.log("Journal entries response:", resp);
        if (resp.success) {
          const rows = resp.data || [];
          setEntries(rows);
          // If URL-restored date range is too narrow, auto-broaden once to year start.
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
        console.error("Error fetching journal entries:", err);
        toast.error(err.message || "Failed to load journal entries");
      }
    );
  };

  const handleSearch = () => {
    fetchEntries();
  };

  const canEdit = userRole === "admin" || userRole === "accountant";
  const fields = [
    { title: "Reference", value: "reference_number" },
    { title: "Date", value: "entry_date" },
    { title: "Description", value: "description" },
    {
      title: "Total Debit",
      custom: true,
      component: (item) => <div className="text-end">₦{formatNumber1(item.total_debit || 0)}</div>,
    },
    {
      title: "Total Credit",
      custom: true,
      component: (item) => <div className="text-end">₦{formatNumber1(item.total_credit || 0)}</div>,
    },
    { title: "Created By", value: "created_by" },
    {
      title: "Actions",
      custom: true,
      component: (item) => (
        <div className="d-flex justify-content-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/app/account/journal-entries/${item.transaction_ref}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {item.status === "draft" && canEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                navigate(`/app/account/journal-entries/${item.transaction_ref}/edit`)
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
    <div className="container mx-auto  space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Journal Entries
          </h1>
          <p className="text-gray-600 mt-2">
            Create and manage accounting journal entries
          </p>
        </div>

        <CustomButton
          size="sm"
          color="primary"
          className="flex items-center gap-2"
          onClick={() => navigate("/app/account/journal-entries/new")}
        >
          <Plus className="h-5 w-5" />
          New Journal Entry
        </CustomButton>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search & Filter</CardTitle>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <Label htmlFor="search">Search Reference</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by reference..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <CustomTable1
            data={entries}
            fields={fields}
            loading={loading}
            pageSize={20}
            message="No journal entries found matching your criteria."
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default JournalEntryList;
