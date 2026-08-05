import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const JournalEntryDetail = () => {
  const navigate = useNavigate();
  const { transaction_ref } = useParams();

  const { activeBusiness, user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const userId = user?.id || user?.email;
  // Try multiple sources for user role - default to admin for permissions
  const userRole = user?.role || user?.user_role || activeBusiness?.user_role || "admin";

  console.log("Journal Entry Detail - User info:", { user, facilityId, userRole, userId });

  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(false);

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
      }
    );
  };

  const handlePost = () => {
    if (
      !window.confirm(
        "Are you sure you want to post this journal entry? This action cannot be undone."
      )
    ) {
      return;
    }

    _postApi(
      `/api/journals/${transaction_ref}/post`,
      {
        facility_id: facilityId,
        user_id: userId,
        user_role: userRole,
      },
      (resp) => {
        if (resp.success) {
          toast.success("Journal entry posted successfully");
          fetchEntry();
        } else {
          toast.error(resp.message || "Failed to post journal entry");
        }
      },
      (err) => {
        console.error("Error posting journal entry:", err);
        toast.error(err.message || "Failed to post journal entry");
      },
      "POST"
    );
  };

  const handleReverse = () => {
    const reversalDate = window.prompt(
      "Enter reversal date (YYYY-MM-DD):",
      new Date().toISOString().split("T")[0]
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
      "POST"
    );
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case "draft":
      case "saved":
        return "secondary";
      case "posted":
        return "default";
      case "reversed":
        return "destructive";
      default:
        return "outline";
    }
  };

  const isDraft = entry?.status === "draft" || entry?.status === "saved";
  const canEdit = (userRole === "admin" || userRole === "accountant") && isDraft;
  const canPost = (userRole === "admin" || userRole === "accountant") && isDraft;
  const canReverse = (userRole === "admin" || userRole === "accountant") && entry?.status === "posted";
  const formatAmount = (value) => formatNumber1(parseFloat(value || 0));

  if (loading || !entry) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-8">
            <div className="text-center">Loading journal entry...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-6 w-6" />
              Journal Entry Details
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="default"
                className="bg-white text-gray-900 border border-gray-300 hover:bg-gray-100 shadow-sm"
                onClick={() => navigate("/app/account/journal-entries")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to List
              </Button>
              {canEdit && (
                <Button
                  onClick={() =>
                    navigate(`/app/account/journal-entries/${transaction_ref}/edit`)
                  }
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              {canPost && (
                <Button onClick={handlePost} variant="default">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Post Entry
                </Button>
              )}
              {canReverse && (
                <Button onClick={handleReverse} variant="destructive">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reverse
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Entry Information */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <div className="text-sm text-gray-500">Reference Number</div>
              <div className="font-semibold">{entry.reference_number}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Entry Date</div>
              <div className="font-semibold">{entry.entry_date}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Status</div>
              <Badge variant={getStatusBadgeVariant(entry.status)}>
                {(entry.status === "saved" ? "DRAFT" : entry.status).toUpperCase()}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-gray-500">Currency</div>
              <div className="font-semibold">{entry.currency || "NGN"}</div>
            </div>
          </div>

          {entry.description && (
            <div className="mb-4">
              <div className="text-sm text-gray-500">Description</div>
              <div className="mt-1">{entry.description}</div>
            </div>
          )}

          {entry.notes && (
            <div className="mb-4">
              <div className="text-sm text-gray-500">Notes</div>
              <div className="mt-1">{entry.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Line Items Card */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
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
                  <TableCell className="font-medium">{line.account_code}</TableCell>
                  <TableCell>{line.description || "—"}</TableCell>
                  <TableCell className="text-right">
                    {parseFloat(line.debit) > 0
                      ? formatAmount(line.debit)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {parseFloat(line.credit) > 0
                      ? formatAmount(line.credit)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="bg-gray-50 font-bold">
                <TableCell colSpan={3} className="text-right">
                  TOTALS
                </TableCell>
                <TableCell className="text-right">
                  ₦{formatAmount(entry.total_debit)}
                </TableCell>
                <TableCell className="text-right">
                  ₦{formatAmount(entry.total_credit)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Audit Trail Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">Created By</span>
              <span className="font-medium">{entry.created_by}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">Created At</span>
              <span className="font-medium">
                {new Date(entry.created_at).toLocaleString()}
              </span>
            </div>
            {entry.updated_by && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-500">Updated By</span>
                <span className="font-medium">{entry.updated_by}</span>
              </div>
            )}
            {entry.updated_at && entry.updated_at !== entry.created_at && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-500">Updated At</span>
                <span className="font-medium">
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

