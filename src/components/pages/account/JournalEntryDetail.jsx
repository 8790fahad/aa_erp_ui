import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BookOpen,
  ArrowLeft,
  Edit,
  CheckCircle,
  RotateCcw,
  Info,
} from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { formatNumber1 } from "@/components/router/utilities";

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

const JournalEntryDetail = () => {
  const navigate = useNavigate();
  const { transaction_ref } = useParams();

  const { activeBusiness, user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const userId = user?.id || user?.email;
  const userRole =
    user?.role || user?.user_role || activeBusiness?.user_role || "admin";

  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (transaction_ref && facilityId) {
      fetchEntry();
    }
  }, [transaction_ref, facilityId]);

  const fetchEntry = () => {
    setLoading(true);
    _fetchApi(
      `/api/journals/${transaction_ref}?facility_id=${facilityId}&user_role=${userRole}`,
      (resp) => {
        setLoading(false);
        if (resp.success) {
          setEntry(resp.data);
        }
      },
      (err) => {
        setLoading(false);
        console.error("Error fetching journal entry:", err);
        toast.error("Failed to load journal entry");
        navigate("/app/account/journal-entries");
      },
    );
  };

  const handleApprove = () => {
    if (
      !window.confirm(
        "Approve this journal entry? It will enter the general ledger and can no longer be edited.",
      )
    ) {
      return;
    }

    setApproving(true);
    _postApi(
      `/api/journals/${transaction_ref}/post`,
      {
        facility_id: facilityId,
        user_id: userId,
        user_role: userRole,
      },
      (resp) => {
        setApproving(false);
        if (resp.success) {
          toast.success("Journal entry approved — now in the ledger.");
          fetchEntry();
        } else {
          toast.error(resp.message || "Failed to approve journal entry");
        }
      },
      (err) => {
        setApproving(false);
        console.error("Error approving journal entry:", err);
        toast.error(err.message || "Failed to approve journal entry");
      },
      "POST",
    );
  };

  const handleReverse = () => {
    const reversalDate = window.prompt(
      "Enter reversal date (YYYY-MM-DD):",
      new Date().toISOString().split("T")[0],
    );

    if (!reversalDate) return;

    if (!window.confirm("Are you sure you want to reverse this journal entry?")) {
      return;
    }

    _postApi(
      `/api/journals/${transaction_ref}/reverse`,
      {
        facility_id: facilityId,
        user_id: userId,
        user_role: userRole,
        reversal_date: reversalDate,
      },
      (resp) => {
        if (resp.success) {
          toast.success("Journal entry reversed successfully");
          navigate(`/app/account/journal-entries/${resp.data.transaction_ref}`);
        } else {
          toast.error(resp.message || "Failed to reverse journal entry");
        }
      },
      (err) => {
        console.error("Error reversing journal entry:", err);
        toast.error(err.message || "Failed to reverse journal entry");
      },
      "POST",
    );
  };

  const isPending = normalizeStatus(entry?.status) === "pending";
  const isApproved = normalizeStatus(entry?.status) === "approved";
  const canEdit = isPending;
  const canApprove = isPending;
  const canReverse = isApproved;
  const formatAmount = (value) => formatNumber1(parseFloat(value || 0));

  if (loading || !entry) {
    return (
      <div className="min-h-[70vh] px-3 py-4 sm:px-4 lg:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Loading journal entry…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] space-y-4 px-3 py-4 sm:px-4 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
            <BookOpen className="h-5 w-5 text-[var(--aa-navy)]" />
            Journal Entry
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {isPending
              ? "Pending approval — approve to post this entry to the ledger"
              : isApproved
                ? "Approved — this entry is in the general ledger"
                : "Reversed entry"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-200 bg-white text-slate-700"
            onClick={() => navigate("/app/account/journal-entries")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to list
          </Button>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="border-slate-200"
              onClick={() =>
                navigate(
                  `/app/account/journal-entries/${transaction_ref}/edit`,
                )
              }
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {canApprove && (
            <Button
              size="sm"
              className="bg-[var(--aa-navy)] text-white hover:bg-[var(--aa-navy-hover)]"
              onClick={handleApprove}
              disabled={approving}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {approving ? "Approving…" : "Approve to ledger"}
            </Button>
          )}
          {canReverse && (
            <Button size="sm" variant="destructive" onClick={handleReverse}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reverse
            </Button>
          )}
        </div>
      </div>

      {isPending && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This journal is saved but not yet in the ledger. Review the lines,
          then click <strong>Approve to ledger</strong>.
        </div>
      )}

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-[var(--aa-navy)] py-4 text-white">
          <CardTitle className="text-base font-semibold text-white">
            Entry details
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-xs text-slate-500">Reference Number</div>
              <div className="font-semibold text-slate-900">
                {entry.reference_number}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Entry Date</div>
              <div className="font-semibold text-slate-900">
                {entry.entry_date}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Status</div>
              <span
                className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                  entry.status,
                )}`}
              >
                {statusLabel(entry.status)}
              </span>
            </div>
            <div>
              <div className="text-xs text-slate-500">Currency</div>
              <div className="font-semibold text-slate-900">
                {entry.currency || "NGN"}
              </div>
            </div>
          </div>

          {entry.description && (
            <div className="mb-4">
              <div className="text-xs text-slate-500">Description</div>
              <div className="mt-1 text-sm text-slate-800">
                {entry.description}
              </div>
            </div>
          )}

          {entry.notes && (
            <div className="mb-2">
              <div className="text-xs text-slate-500">Notes</div>
              <div className="mt-1 text-sm text-slate-800">{entry.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 py-3">
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Account Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit (₦)</TableHead>
                <TableHead className="text-right">Credit (₦)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entry.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.line_number}</TableCell>
                  <TableCell className="font-medium">
                    {line.account_code}
                  </TableCell>
                  <TableCell>{line.description || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {parseFloat(line.debit) > 0
                      ? formatAmount(line.debit)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {parseFloat(line.credit) > 0
                      ? formatAmount(line.credit)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-[var(--aa-sidebar-active)] font-semibold">
                <TableCell colSpan={3} className="text-right">
                  TOTALS
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ₦{formatAmount(entry.total_debit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ₦{formatAmount(entry.total_credit)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" />
            History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 py-2">
              <span className="text-sm text-slate-500">Created By</span>
              <span className="font-medium text-slate-800">
                {entry.created_by}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 py-2">
              <span className="text-sm text-slate-500">Created At</span>
              <span className="font-medium text-slate-800">
                {new Date(entry.created_at).toLocaleString()}
              </span>
            </div>
            {isApproved && (
              <div className="flex items-center justify-between border-b border-slate-100 py-2">
                <span className="text-sm text-slate-500">Ledger status</span>
                <span className="font-medium text-emerald-700">
                  Posted to general ledger
                </span>
              </div>
            )}
            {entry.updated_by && (
              <div className="flex items-center justify-between border-b border-slate-100 py-2">
                <span className="text-sm text-slate-500">
                  {isApproved ? "Approved / Updated By" : "Updated By"}
                </span>
                <span className="font-medium text-slate-800">
                  {entry.updated_by}
                </span>
              </div>
            )}
            {entry.updated_at && entry.updated_at !== entry.created_at && (
              <div className="flex items-center justify-between border-b border-slate-100 py-2">
                <span className="text-sm text-slate-500">
                  {isApproved ? "Approved At" : "Updated At"}
                </span>
                <span className="font-medium text-slate-800">
                  {new Date(entry.updated_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default JournalEntryDetail;
