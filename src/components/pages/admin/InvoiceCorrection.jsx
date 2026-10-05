import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, Trash2, CalendarClock, Package, Plus } from "lucide-react";
import moment from "moment";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  filterJournalAmountInput,
  formatNumberWithCommas,
  parseNumberFromFormatted,
} from "@/utilities";

function formatAmountInput(value) {
  const raw = filterJournalAmountInput(String(value ?? "").replace(/,/g, ""));
  if (!raw) return "";
  const parts = raw.split(".");
  const intPart = parts[0] ? formatNumberWithCommas(parts[0]) : "";
  if (parts.length > 1) return `${intPart}.${parts[1]}`;
  return intPart;
}

function parseDraftAmount(value) {
  const parsed = parseNumberFromFormatted(value);
  if (parsed === "" || parsed == null) return NaN;
  const n = parseFloat(parsed);
  return Number.isFinite(n) ? n : NaN;
}

export default function InvoiceCorrection() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const facilityId = activeBusiness?.id;
  const navigate = useNavigate();

  const [invoiceRef, setInvoiceRef] = useState("");
  const [newDate, setNewDate] = useState("");
  const [search, setSearch] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [linesLoading, setLinesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [lineRows, setLineRows] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [confirmUpdateOpen, setConfirmUpdateOpen] = useState(false);
  const [confirmQtyOpen, setConfirmQtyOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteLineOpen, setConfirmDeleteLineOpen] = useState(false);
  const [lineToDelete, setLineToDelete] = useState(null);
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [addQty, setAddQty] = useState("");
  const [addCost, setAddCost] = useState("");
  const [addSell, setAddSell] = useState("");

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

  const loadLines = useCallback(
    (ref) => {
      if (!facilityId || !ref) {
        setLineRows([]);
        return;
      }
      setLinesLoading(true);
      _fetchApi(
        `/account/invoice-correction/lines?facilityId=${facilityId}&invoiceRef=${encodeURIComponent(
          ref
        )}`,
        (resp) => {
          setLinesLoading(false);
          if (resp.success) {
            setLineRows(
              (resp.results || []).map((line) => ({
                ...line,
                edit_qty: formatAmountInput(line.qty || 0),
                edit_cost: formatAmountInput(line.cost_price || 0),
              }))
            );
          } else {
            setLineRows([]);
            toast.error(resp.message || "Failed to load invoice lines");
          }
        },
        () => {
          setLinesLoading(false);
          setLineRows([]);
          toast.error("Could not load invoice lines");
        }
      );
    },
    [facilityId]
  );

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const searchProducts = useCallback(
    (q) => {
      if (!facilityId) return;
      setProductLoading(true);
      _fetchApi(
        `/account/invoice-correction/products?facilityId=${facilityId}&q=${encodeURIComponent(
          q || ""
        )}&limit=20`,
        (resp) => {
          setProductLoading(false);
          if (resp.success) setProductOptions(resp.results || []);
          else setProductOptions([]);
        },
        () => {
          setProductLoading(false);
          setProductOptions([]);
        }
      );
    },
    [facilityId]
  );

  useEffect(() => {
    if (!editModalOpen) {
      setProductOptions([]);
      setProductLoading(false);
      return;
    }
    const q = (productSearch || "").trim();
    if (!q || selectedProduct) {
      setProductOptions([]);
      setProductLoading(false);
      return;
    }
    const t = setTimeout(() => searchProducts(q), 250);
    return () => clearTimeout(t);
  }, [editModalOpen, productSearch, selectedProduct, searchProducts]);

  const isPurchaseInvoice =
    String(selectedRow?.type || "").toLowerCase() === "purchase";

  const changedLines = useMemo(
    () =>
      lineRows.filter((line) => {
        const nextQty = parseDraftAmount(line.edit_qty);
        const prevQty = Number(line.qty);
        const nextCost = parseDraftAmount(line.edit_cost);
        const prevCost = Number(line.cost_price);
        const qtyChanged =
          Number.isFinite(nextQty) &&
          nextQty > 0 &&
          Math.abs(nextQty - prevQty) > 0.00005;
        const costChanged =
          Number.isFinite(nextCost) &&
          nextCost >= 0 &&
          Math.abs(nextCost - prevCost) > 0.00005;
        return qtyChanged || costChanged;
      }),
    [lineRows]
  );

  const previewTotal = useMemo(
    () =>
      lineRows.reduce((sum, line) => {
        const qty = parseDraftAmount(line.edit_qty);
        const unit = isPurchaseInvoice
          ? parseDraftAmount(line.edit_cost)
          : Number(line.selling_price || line.unit_price || 0);
        if (!Number.isFinite(qty) || qty <= 0) return sum;
        if (!Number.isFinite(unit)) return sum;
        return sum + qty * unit;
      }, 0),
    [lineRows, isPurchaseInvoice]
  );

  const resetAddLineForm = () => {
    setProductSearch("");
    setProductOptions([]);
    setSelectedProduct(null);
    setAddQty("");
    setAddCost("");
    setAddSell("");
    setProductLoading(false);
  };

  const handlePick = (row) => {
    setSelectedRow(row);
    setInvoiceRef(String(row.invoice_ref || ""));
    const d = row.transaction_date
      ? moment(row.transaction_date).format("YYYY-MM-DD")
      : "";
    setNewDate(d);
    resetAddLineForm();
    setEditModalOpen(true);
    loadLines(String(row.invoice_ref || ""));
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
          if (selectedRow) {
            setSelectedRow({
              ...selectedRow,
              transaction_date: newDate,
            });
          }
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

  const doUpdateQty = () => {
    if (!invoiceRef.trim()) {
      toast.error("Select invoice first");
      return;
    }
    if (!changedLines.length) {
      toast.error("Change quantity or cost first");
      return;
    }
    for (const line of changedLines) {
      const qty = parseDraftAmount(line.edit_qty);
      const cost = parseDraftAmount(line.edit_cost);
      if (!(qty > 0)) {
        toast.error(`Quantity for ${line.item_name || line.product_id} must be greater than zero`);
        return;
      }
      if (!(cost >= 0)) {
        toast.error(`Cost for ${line.item_name || line.product_id} must be zero or greater`);
        return;
      }
    }
    setSaving(true);
    _postApi(
      "/account/invoice-correction/update-qty",
      {
        invoiceRef: invoiceRef.trim(),
        lines: changedLines.map((line) => ({
          storeEntryId: line.store_entry_id,
          qty: parseDraftAmount(line.edit_qty),
          cost: parseDraftAmount(line.edit_cost),
        })),
      },
      (resp) => {
        setSaving(false);
        if (resp.success) {
          toast.success("Invoice lines updated with stock and ledger");
          loadInvoices();
          loadLines(invoiceRef.trim());
          setConfirmQtyOpen(false);
          if (selectedRow) {
            setSelectedRow({
              ...selectedRow,
              amount: resp.result?.amount ?? selectedRow.amount,
              description: resp.result?.description ?? selectedRow.description,
            });
          }
        } else {
          toast.error(resp.message || "Could not update invoice lines");
        }
      },
      () => {
        setSaving(false);
        toast.error("Could not update invoice lines");
      }
    );
  };

  const doDeleteLine = () => {
    if (!invoiceRef.trim() || !lineToDelete?.store_entry_id) {
      toast.error("Select a line to delete");
      return;
    }
    if (lineRows.length <= 1) {
      toast.error("Cannot delete the last line. Delete the invoice instead.");
      return;
    }
    setSaving(true);
    _postApi(
      "/account/invoice-correction/delete-line",
      {
        invoiceRef: invoiceRef.trim(),
        storeEntryId: lineToDelete.store_entry_id,
      },
      (resp) => {
        setSaving(false);
        if (resp.success) {
          toast.success("Line deleted with stock and ledger");
          setConfirmDeleteLineOpen(false);
          setLineToDelete(null);
          loadInvoices();
          loadLines(invoiceRef.trim());
          if (selectedRow) {
            setSelectedRow({
              ...selectedRow,
              amount: resp.result?.amount ?? selectedRow.amount,
              description: resp.result?.description ?? selectedRow.description,
            });
          }
        } else {
          toast.error(resp.message || "Could not delete line");
        }
      },
      () => {
        setSaving(false);
        toast.error("Could not delete line");
      }
    );
  };

  const doAddLine = () => {
    if (!invoiceRef.trim()) {
      toast.error("Select invoice first");
      return;
    }
    if (!selectedProduct?.sku) {
      toast.error("Select a product to add");
      return;
    }
    const qty = parseDraftAmount(addQty);
    const cost = parseDraftAmount(addCost);
    const sell = parseDraftAmount(addSell);
    if (!(qty > 0)) {
      toast.error("Quantity must be greater than zero");
      return;
    }
    if (!(cost >= 0)) {
      toast.error("Cost must be zero or greater");
      return;
    }
    if (!isPurchaseInvoice && !(sell > 0)) {
      toast.error("Selling price must be greater than zero");
      return;
    }
    setSaving(true);
    _postApi(
      "/account/invoice-correction/add-line",
      {
        invoiceRef: invoiceRef.trim(),
        productId: selectedProduct.sku,
        qty,
        cost,
        sellingPrice: isPurchaseInvoice ? cost : sell,
      },
      (resp) => {
        setSaving(false);
        if (resp.success) {
          toast.success("Line added with stock and ledger");
          setSelectedProduct(null);
          setProductSearch("");
          setAddQty("");
          setAddCost("");
          setAddSell("");
          loadInvoices();
          loadLines(invoiceRef.trim());
          if (selectedRow) {
            setSelectedRow({
              ...selectedRow,
              amount: resp.result?.amount ?? selectedRow.amount,
              description: resp.result?.description ?? selectedRow.description,
            });
          }
        } else {
          toast.error(resp.message || "Could not add line");
        }
      },
      () => {
        setSaving(false);
        toast.error("Could not add line");
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
          setSelectedRow(null);
          setLineRows([]);
          setEditModalOpen(false);
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
            Update date, quantity, or cost; add or delete lines on sales and purchase invoices
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
            editModalOpen ||
            confirmUpdateOpen ||
            confirmQtyOpen ||
            confirmDeleteOpen ||
            confirmDeleteLineOpen
              ? "hidden"
              : ""
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

      <Dialog open={confirmQtyOpen} onOpenChange={setConfirmQtyOpen}>
        <DialogContent className="max-w-md z-[1200]">
          <DialogHeader>
            <DialogTitle>Confirm Line Update</DialogTitle>
            <DialogDescription>
              Update quantity/cost on <strong>{invoiceRef}</strong> for{" "}
              <strong>{changedLines.length}</strong> line
              {changedLines.length === 1 ? "" : "s"}? Stock, ledger, and invoice
              amount will be recalculated.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmQtyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doUpdateQty} disabled={saving}>
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

      <Dialog
        open={confirmDeleteLineOpen}
        onOpenChange={(open) => {
          setConfirmDeleteLineOpen(open);
          if (!open) setLineToDelete(null);
        }}
      >
        <DialogContent className="max-w-md z-[1200]">
          <DialogHeader>
            <DialogTitle>Confirm Line Deletion</DialogTitle>
            <DialogDescription>
              Remove <strong>{lineToDelete?.item_name || lineToDelete?.product_id}</strong>{" "}
              from <strong>{invoiceRef}</strong>? Stock and ledger will be updated.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDeleteLineOpen(false);
                setLineToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={doDeleteLine} disabled={saving}>
              Delete Line
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editModalOpen}
        onOpenChange={(open) => {
          setEditModalOpen(open);
          if (!open) resetAddLineForm();
        }}
      >
        <DialogContent
          className="max-w-3xl z-[1200]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Invoice Correction</DialogTitle>
            <DialogDescription>
              Edit date, quantity, or cost; add or delete lines on the selected invoice.
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

            <div className="rounded border">
              <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
                <div className="text-sm font-semibold">Line quantity and cost</div>
                <div className="text-xs text-muted-foreground">
                  Preview total: {Number(previewTotal || 0).toLocaleString()}
                </div>
              </div>
              <div className="overflow-auto max-h-56">
                <table className="table table-sm mb-0">
                  <thead className="table-light sticky-top">
                    <tr>
                      <th>Item</th>
                      <th className="text-end w-28">Cost</th>
                      {!isPurchaseInvoice && (
                        <th className="text-end w-28">Sell</th>
                      )}
                      <th className="text-end w-24">Qty</th>
                      <th className="text-end w-28">Line</th>
                      <th className="text-end w-28">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineRows.map((line) => {
                      const qty = parseDraftAmount(line.edit_qty);
                      const cost = parseDraftAmount(line.edit_cost);
                      const sell = Number(line.selling_price || 0);
                      const unit = isPurchaseInvoice ? cost : sell;
                      const lineTotal =
                        Number.isFinite(qty) && qty > 0 && Number.isFinite(unit)
                          ? qty * unit
                          : 0;
                      return (
                        <tr key={line.store_entry_id}>
                          <td>
                            <div className="font-medium">{line.item_name || line.product_id}</div>
                            <div className="text-xs text-muted-foreground">
                              {line.product_id}
                            </div>
                          </td>
                          <td className="text-end align-middle">
                            <Input
                              type="text"
                              inputMode="decimal"
                              className="h-8 text-end border-gray-200 tabular-nums"
                              value={line.edit_cost}
                              onChange={(e) => {
                                const value = formatAmountInput(e.target.value);
                                setLineRows((prev) =>
                                  prev.map((row) =>
                                    row.store_entry_id === line.store_entry_id
                                      ? { ...row, edit_cost: value }
                                      : row
                                  )
                                );
                              }}
                            />
                          </td>
                          {!isPurchaseInvoice && (
                            <td className="text-end">{sell.toLocaleString()}</td>
                          )}
                          <td className="text-end align-middle">
                            <Input
                              type="text"
                              inputMode="decimal"
                              className="h-8 text-end border-gray-200 tabular-nums"
                              value={line.edit_qty}
                              onChange={(e) => {
                                const value = formatAmountInput(e.target.value);
                                setLineRows((prev) =>
                                  prev.map((row) =>
                                    row.store_entry_id === line.store_entry_id
                                      ? { ...row, edit_qty: value }
                                      : row
                                  )
                                );
                              }}
                            />
                          </td>
                          <td className="text-end">{lineTotal.toLocaleString()}</td>
                          <td className="text-end align-middle">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-red-700 border-red-200 hover:bg-red-50"
                              disabled={saving || lineRows.length <= 1}
                              onClick={() => {
                                setLineToDelete(line);
                                setConfirmDeleteLineOpen(true);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {!lineRows.length && !linesLoading && (
                      <tr>
                        <td
                          colSpan={isPurchaseInvoice ? 5 : 6}
                          className="text-center text-muted py-3"
                        >
                          No stock lines found for this invoice
                        </td>
                      </tr>
                    )}
                    {linesLoading && (
                      <tr>
                        <td
                          colSpan={isPurchaseInvoice ? 5 : 6}
                          className="text-center text-muted py-3"
                        >
                          Loading lines...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="border-t bg-slate-50 px-2 py-2">
                <div
                  className={`grid gap-2 items-start ${
                    isPurchaseInvoice
                      ? "grid-cols-[minmax(0,1fr)_7rem_6rem_6rem_7rem]"
                      : "grid-cols-[minmax(0,1fr)_7rem_7rem_6rem_6rem_7rem]"
                  }`}
                >
                  <div className="relative min-w-0">
                    <Input
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setSelectedProduct(null);
                      }}
                      placeholder="Search product to add..."
                      className="h-8"
                    />
                    {productLoading && (
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Searching...
                      </div>
                    )}
                    {!!productOptions.length && !selectedProduct && (
                      <div className="absolute left-0 right-0 z-30 mt-1 max-h-40 overflow-auto rounded border bg-white shadow-md">
                        {productOptions.map((p) => (
                          <button
                            key={p.sku}
                            type="button"
                            className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-blue-50 border-b last:border-b-0"
                            onClick={() => {
                              setSelectedProduct(p);
                              setProductSearch(`${p.name} (${p.sku})`);
                              setAddCost(formatAmountInput(p.cost_price || 0));
                              setAddSell(formatAmountInput(p.selling_price || 0));
                              if (!addQty) setAddQty(formatAmountInput(1));
                            }}
                          >
                            <div className="font-medium leading-tight">{p.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {p.sku} · cost{" "}
                              {Number(p.cost_price || 0).toLocaleString()}
                              {!isPurchaseInvoice && (
                                <>
                                  {" "}
                                  · sell{" "}
                                  {Number(p.selling_price || 0).toLocaleString()}
                                </>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="h-8 text-end border-gray-200 tabular-nums"
                    value={addCost}
                    onChange={(e) => setAddCost(formatAmountInput(e.target.value))}
                    placeholder="Cost"
                  />
                  {!isPurchaseInvoice && (
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="h-8 text-end border-gray-200 tabular-nums"
                      value={addSell}
                      onChange={(e) => setAddSell(formatAmountInput(e.target.value))}
                      placeholder="Sell"
                    />
                  )}
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="h-8 text-end border-gray-200 tabular-nums"
                    value={addQty}
                    onChange={(e) => setAddQty(formatAmountInput(e.target.value))}
                    placeholder="Qty"
                  />
                  <div className="h-8 flex items-center justify-end text-xs text-muted-foreground tabular-nums">
                    {(() => {
                      const qty = parseDraftAmount(addQty);
                      const cost = parseDraftAmount(addCost);
                      const sell = parseDraftAmount(addSell);
                      const unit = isPurchaseInvoice ? cost : sell;
                      if (!(qty > 0) || !Number.isFinite(unit) || unit < 0) {
                        return "—";
                      }
                      return (qty * unit).toLocaleString();
                    })()}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={doAddLine}
                      disabled={saving || !selectedProduct}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
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
                variant="secondary"
                onClick={() => {
                  if (!changedLines.length) {
                    toast.error("Change quantity or cost first");
                    return;
                  }
                  setConfirmQtyOpen(true);
                }}
                disabled={saving || linesLoading}
              >
                <Package className="h-4 w-4" />
                Update Lines
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
