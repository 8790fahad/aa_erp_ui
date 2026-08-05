import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, Trash2, CalendarClock } from "lucide-react";
import moment from "moment";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function InvoiceCorrection() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const facilityId = activeBusiness?.id;
  const navigate = useNavigate();

  const [invoiceRef, setInvoiceRef] = useState("");
  const [newDate, setNewDate] = useState("");
  const [search, setSearch] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [confirmUpdateOpen, setConfirmUpdateOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const loadInvoices = useCallback(() => {
    if (!facilityId) return;
    setListLoading(true);
    const q = encodeURIComponent((search || "").trim());
    _fetchApi(
      `/account/invoice-correction/invoices?facilityId=${facilityId}&q=${q}&limit=30`,
      (resp) => {
        setListLoading(false);
        if (resp.success) {
          setRows(resp.results || []);
        } else {
          toast.error(resp.message || "Failed to load invoices");
        }
      },
      () => {
        setListLoading(false);
        toast.error("Could not load invoices");
      }
    );
  }, [facilityId, search]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handlePick = (row) => {
    setSelectedRow(row);
    setInvoiceRef(String(row.invoice_ref || ""));
    const d = row.transaction_date
      ? moment(row.transaction_date).format("YYYY-MM-DD")
      : "";
    setNewDate(d);
    setEditModalOpen(true);
  };

  const doUpdateDate = () => {
    if (!invoiceRef.trim() || !newDate) {
      toast.error("Select invoice and new date");
      return;
    }
    setSaving(true);
    _postApi(
      "/account/invoice-correction/update-date",
      { invoiceRef: invoiceRef.trim(), newTransactionDate: newDate },
      (resp) => {
        setSaving(false);
        if (resp.success) {
          toast.success("Invoice date updated with ledger");
          loadInvoices();
          setConfirmUpdateOpen(false);
        } else {
          toast.error(resp.message || "Could not update invoice date");
        }
      },
      () => {
        setSaving(false);
        toast.error("Could not update invoice date");
      }
    );
  };

  const doDeleteInvoice = () => {
    if (!invoiceRef.trim()) {
      toast.error("Select invoice first");
      return;
    }
    setSaving(true);
    _postApi(
      "/account/invoice-correction/delete",
      { invoiceRef: invoiceRef.trim() },
      (resp) => {
        setSaving(false);
        if (resp.success) {
          toast.success("Invoice and linked ledger entries deleted");
          setInvoiceRef("");
          loadInvoices();
          setConfirmDeleteOpen(false);
        } else {
          toast.error(resp.message || "Could not delete invoice");
        }
      },
      () => {
        setSaving(false);
        toast.error("Could not delete invoice");
      }
    );
  };

  const handleOpenInvoiceContext = (row) => {
    const type = String(row?.type || "").toLowerCase();
    const invoiceRefValue = String(row?.invoice_ref || "").trim();
    if (type === "sales") {
      navigate(
        `/app/sales/invoice-preview?sale_code=${encodeURIComponent(
          invoiceRefValue
        )}`
      );
      return;
    }
    if (type === "purchase") {
      navigate(
        `/app/expenses/billing/operating-expense-bill-pdf?invoice_ref=${encodeURIComponent(
          invoiceRefValue
        )}`
      );
      return;
    }
    toast.info("No route mapping available for this invoice type");
  };

  const isOpeningBalanceInvoice = (row) => {
    const ref = String(row?.invoice_ref || "").toLowerCase();
    const desc = String(row?.description || "").toLowerCase();
    return (
      ref.startsWith("ob-") ||
      ref.includes("opening") ||
      desc.includes("opening balance")
    );
  };

  return (
    <div className="card shadow-sm border-0">
      <div className="card-header bg-white border-0 d-flex align-items-center justify-content-between">
        <div>
          <h5 className="mb-0 fw-bold">Invoice Correction</h5>
          <small className="text-muted">
            Update invoice date or delete invoice (syncs invoices and general ledger)
          </small>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadInvoices}
          disabled={listLoading}
        >
          <RefreshCcw className={`h-4 w-4 ${listLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      <div className="card-body space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>Search Invoice</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by invoice ref"
            />
          </div>
          <div>
            <Button type="button" variant="outline" onClick={loadInvoices} disabled={listLoading}>
              Search
            </Button>
          </div>
        </div>

        <div
          className={`border rounded overflow-auto max-h-72 ${
            editModalOpen || confirmUpdateOpen || confirmDeleteOpen ? "hidden" : ""
          }`}
        >
          <table className="table table-sm mb-0">
            <thead className="table-light sticky-top">
              <tr>
                <th>Date</th>
                <th>Invoice Ref</th>
                <th>Detail</th>
                <th className="text-end">Amount</th>
                <th>Type</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.invoice_id}>
                  <td>{r.transaction_date ? moment(r.transaction_date).format("DD/MM/YYYY") : "-"}</td>
                  <td>
                    {isOpeningBalanceInvoice(r) ? (
                      <span className="font-medium text-gray-800">{r.invoice_ref}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenInvoiceContext(r)}
                        className="text-blue-700 hover:text-blue-900 hover:underline font-medium"
                        title="Open source module"
                      >
                        {r.invoice_ref}
                      </button>
                    )}
                  </td>
                  <td>
                    <div className="leading-tight">
                      <div className="font-medium">{r.person_name || "-"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        ID: {r.ref_number || "-"}
                      </div>
                    </div>
                  </td>
                  <td className="text-end">{Number(r.amount || 0).toLocaleString()}</td>
                  <td>
                    <Badge
                      variant="outline"
                      className={
                        String(r.type || "").toLowerCase() === "purchase"
                          ? "bg-orange-100 text-orange-800 border-orange-200"
                          : String(r.type || "").toLowerCase() === "sales"
                            ? "bg-blue-100 text-blue-800 border-blue-200"
                            : "bg-gray-100 text-gray-800 border-gray-200"
                      }
                    >
                      {r.type || "-"}
                    </Badge>
                  </td>
                  <td className="text-end">
                    <Button type="button" size="sm" variant="outline" onClick={() => handlePick(r)}>
                      Select
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && !listLoading && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-3">
                    No invoices found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={confirmUpdateOpen} onOpenChange={setConfirmUpdateOpen}>
        <DialogContent className="max-w-md z-[1200]">
          <DialogHeader>
            <DialogTitle>Confirm Invoice Date Update</DialogTitle>
            <DialogDescription>
              Update <strong>{invoiceRef}</strong> to{" "}
              <strong>{newDate ? moment(newDate).format("DD/MM/YYYY") : "-"}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmUpdateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doUpdateDate} disabled={saving}>
              Confirm Update
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="max-w-md z-[1200]">
          <DialogHeader>
            <DialogTitle>Confirm Invoice Deletion</DialogTitle>
            <DialogDescription>
              Delete <strong>{invoiceRef}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doDeleteInvoice} disabled={saving}>
              Delete Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-lg z-[1200]">
          <DialogHeader>
            <DialogTitle>Invoice Correction</DialogTitle>
            <DialogDescription>
              Update date or delete selected invoice and linked entries.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRow && (
              <div className="rounded border bg-gray-50 p-3">
                <div className="text-xs font-semibold uppercase text-gray-600 mb-2">
                  Invoice Record
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Date:</span>{" "}
                    <span className="font-medium">
                      {selectedRow.transaction_date
                        ? moment(selectedRow.transaction_date).format("DD/MM/YYYY")
                        : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Invoice Ref:</span>{" "}
                    {selectedRow.invoice_ref ? (
                      <button
                        type="button"
                        onClick={() => handleOpenInvoiceContext(selectedRow)}
                        className="font-medium text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        {selectedRow.invoice_ref}
                      </button>
                    ) : (
                      <span className="font-medium">-</span>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500">Type:</span>{" "}
                    <span className="font-medium text-capitalize">
                      {selectedRow.type || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Amount:</span>{" "}
                    <span className="font-medium">
                      {Number(selectedRow.amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-gray-500">Detail:</span>{" "}
                    <span className="font-medium">
                      {selectedRow.person_name || "-"}
                    </span>
                    <span className="text-gray-500"> (ID: {selectedRow.ref_number || "-"})</span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Invoice Ref</Label>
                <div className="h-10 rounded border border-gray-300 bg-gray-50 px-3 flex items-center">
                  {invoiceRef ? (
                    <button
                      type="button"
                      onClick={() => selectedRow && handleOpenInvoiceContext(selectedRow)}
                      className="text-blue-700 hover:text-blue-900 hover:underline font-medium"
                    >
                      {invoiceRef}
                    </button>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </div>
              </div>
              <div>
                <Label>Type</Label>
                <Input value={selectedRow?.type || "-"} readOnly />
              </div>
            </div>
            <div>
              <Label>New Transaction Date</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!invoiceRef.trim() || !newDate) {
                    toast.error("Select invoice and new date");
                    return;
                  }
                  setConfirmUpdateOpen(true);
                }}
                disabled={saving}
              >
                <CalendarClock className="h-4 w-4" />
                Update Date
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (!invoiceRef.trim()) {
                    toast.error("Select invoice first");
                    return;
                  }
                  setConfirmDeleteOpen(true);
                }}
                disabled={saving}
              >
                <Trash2 className="h-4 w-4" />
                Delete Invoice
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

