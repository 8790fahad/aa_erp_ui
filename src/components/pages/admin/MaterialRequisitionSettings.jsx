/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import moment from "moment";
import { RefreshCcw, Pencil, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { UPDATE_BUSINESS_SETTINGS } from "@/redux/actions/actionTypes";

const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

function statusBadgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved" || s === "completed")
    return "bg-green-100 text-green-800 border-green-200";
  if (s === "pending") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "rejected") return "bg-red-100 text-red-800 border-red-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Apply qty/date edits onto the same GL rows (date, dr, cr only — no "new" columns).
 */
function buildLedgerPreview(ledgerEntries, items, transactionDate) {
  if (!Array.isArray(ledgerEntries) || !ledgerEntries.length) return [];
  const nextDate = transactionDate
    ? moment(transactionDate).format("YYYY-MM-DD")
    : null;

  return ledgerEntries.map((gl) => {
    const desc = String(gl.transaction_description || "").trim().toLowerCase();
    const glAmt = Math.max(parseFloat(gl.dr || 0), parseFloat(gl.cr || 0));
    const match = (items || []).find((it) => {
      const name = String(it.product_name || "").trim().toLowerCase();
      const oldQty = parseFloat(it.original_qty ?? it.store_qty ?? 0) || 0;
      const unitCost = parseFloat(it.unit_cost || 0) || 0;
      const oldAmount = Number((oldQty * unitCost).toFixed(4));
      if (name && desc === name) return true;
      if (oldAmount > 0 && Math.abs(glAmt - oldAmount) < 0.02) return true;
      return false;
    });

    let dr = parseFloat(gl.dr || 0) || 0;
    let cr = parseFloat(gl.cr || 0) || 0;
    if (match) {
      const newQty = parseFloat(match.approved_qty ?? match.store_qty ?? 0) || 0;
      const unitCost = parseFloat(match.unit_cost || 0) || 0;
      const newAmount = Number((newQty * unitCost).toFixed(4));
      if (dr > 0) dr = newAmount;
      if (cr > 0) cr = newAmount;
    }

    const date =
      nextDate ||
      (gl.transaction_date
        ? moment(gl.transaction_date).format("YYYY-MM-DD")
        : "");

    return {
      ...gl,
      display_date: date,
      display_dr: dr,
      display_cr: cr,
    };
  });
}

export default function MaterialRequisitionSettings() {
  const dispatch = useDispatch();
  const activeBusiness = useSelector((state) => state.auth.activeBusiness) || {};
  const user = useSelector((state) => state.auth.user) || {};
  const facilityId = activeBusiness?.id;
  const primary = activeBusiness?.primary_color || "var(--aa-navy)";
  const enabled = activeBusiness?.enable_material_requisition !== false;

  const [toggleLoading, setToggleLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [form, setForm] = useState({
    priority: "medium",
    notes: "",
    transactionDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const ledgerPreview = useMemo(
    () => buildLedgerPreview(ledgerEntries, items, form.transactionDate),
    [ledgerEntries, items, form.transactionDate],
  );

  const qtyChanged = useMemo(
    () =>
      items.some((it) => {
        const orig = parseFloat(it.original_qty ?? it.store_qty ?? 0) || 0;
        const next = parseFloat(it.approved_qty ?? 0) || 0;
        return Math.abs(orig - next) > 0.0001;
      }),
    [items],
  );

  const loadRows = useCallback(() => {
    if (!facilityId) return;
    setListLoading(true);
    _fetchApi(
      `/api/production/material-requisitions?facilityId=${facilityId}&status=approved&page=1&limit=50`,
      (resp) => {
        setListLoading(false);
        if (resp?.success) {
          setRows(resp.data?.requisitions || []);
        } else {
          toast.error(resp?.message || "Failed to load requisitions");
          setRows([]);
        }
      },
      () => {
        setListLoading(false);
        toast.error("Could not load requisitions");
        setRows([]);
      },
    );
  }, [facilityId]);

  useEffect(() => {
    if (enabled) loadRows();
  }, [enabled, loadRows]);

  const toggleEnabled = () => {
    if (!facilityId) return;
    const userId = user?.id || activeBusiness.business_admin;
    const next = !enabled;
    setToggleLoading(true);
    _postApi(
      `/account/update-enable-material-requisition/${next ? "1" : "0"}/${facilityId}/${userId}`,
      {},
      (resp) => {
        setToggleLoading(false);
        if (resp?.success && resp.results) {
          dispatch({
            type: UPDATE_BUSINESS_SETTINGS,
            payload: { business: resp.results },
          });
          toast.success(resp.message || "Setting updated");
          if (next) loadRows();
        } else {
          toast.error(resp?.message || "Failed to update setting");
        }
      },
      (err) => {
        setToggleLoading(false);
        toast.error(err?.message || "Network error");
      },
    );
  };

  const loadItems = useCallback(
    (row) => {
      if (!facilityId || !row?.id) {
        setItems([]);
        setLedgerEntries([]);
        return;
      }
      setItemsLoading(true);
      setItems([]);
      setLedgerEntries([]);
      _fetchApi(
        `/api/production/material-requisitions/${encodeURIComponent(row.id)}/postings?facilityId=${facilityId}`,
        (resp) => {
          setItemsLoading(false);
          if (resp?.success) {
            const loaded = (resp.data?.items || []).map((it) => {
              const storeQty =
                parseFloat(it.store_qty ?? it.approved_qty ?? it.quantity_approved ?? 0) ||
                0;
              return {
                ...it,
                original_qty: storeQty,
                approved_qty: storeQty,
                unit_cost: parseFloat(it.unit_cost || 0) || 0,
              };
            });
            setItems(loaded);
            setLedgerEntries(resp.data?.ledgerEntries || []);
            const req = resp.data?.requisition;
            if (req) {
              setSelected((prev) => ({ ...(prev || row), ...req }));
              setForm((f) => ({
                ...f,
                priority: req.priority || f.priority,
                notes: req.notes ?? f.notes,
                transactionDate: req.approved_at
                  ? moment(req.approved_at).format("YYYY-MM-DD")
                  : f.transactionDate,
              }));
            }
          } else {
            toast.error(resp?.message || "Failed to load postings");
          }
        },
        () => {
          setItemsLoading(false);
          toast.error("Could not load store / ledger postings");
        },
      );
    },
    [facilityId],
  );

  const setItemQty = (itemId, value) => {
    const cleaned = String(value || "").replace(/,/g, "");
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, approved_qty: cleaned === "" ? "" : cleaned }
          : it,
      ),
    );
  };

  const openEdit = (row) => {
    setSelected(row);
    setForm({
      priority: row.priority || "medium",
      notes: row.notes || "",
      transactionDate: row.approved_at
        ? moment(row.approved_at).format("YYYY-MM-DD")
        : row.created_at
          ? moment(row.created_at).format("YYYY-MM-DD")
          : moment().format("YYYY-MM-DD"),
    });
    setConfirmDeleteOpen(false);
    setEditOpen(true);
    loadItems(row);
  };

  const openDelete = (row) => {
    setSelected(row);
    setForm({
      priority: row.priority || "medium",
      notes: row.notes || "",
      transactionDate: row.approved_at
        ? moment(row.approved_at).format("YYYY-MM-DD")
        : row.created_at
          ? moment(row.created_at).format("YYYY-MM-DD")
          : moment().format("YYYY-MM-DD"),
    });
    setEditOpen(true);
    setConfirmDeleteOpen(true);
    loadItems(row);
  };

  const closeEdit = () => {
    if (saving || deleting) return;
    setEditOpen(false);
    setConfirmDeleteOpen(false);
    setSelected(null);
    setItems([]);
    setLedgerEntries([]);
  };

  const saveEdit = () => {
    if (!selected?.id || !facilityId) return;
    if (!form.transactionDate) {
      toast.error("Transaction date is required");
      return;
    }
    for (const it of items) {
      const q = parseFloat(it.approved_qty);
      if (!Number.isFinite(q) || q < 0) {
        toast.error(`Invalid approved qty for ${it.product_name || it.sku}`);
        return;
      }
    }
    setSaving(true);
    _postApi(
      "/api/production/material-requisitions/correct",
      {
        id: selected.id,
        facilityId,
        priority: form.priority,
        notes: form.notes,
        transactionDate: form.transactionDate,
        items: items.map((it) => ({
          sku: it.sku || it.product_code || it.product_id,
          product_code: it.product_code || it.sku,
          quantity_approved: parseFloat(it.approved_qty) || 0,
          unit_cost: parseFloat(it.unit_cost) || 0,
        })),
      },
      (resp) => {
        setSaving(false);
        if (resp?.success) {
          const storeN = resp.data?.store_entries_updated ?? 0;
          const ledgerN = resp.data?.ledger_entries_updated ?? 0;
          if (Array.isArray(resp.data?.ledgerEntries)) {
            setLedgerEntries(resp.data.ledgerEntries);
          }
          toast.success(
            resp.message ||
              `Updated (${storeN} store, ${ledgerN} ledger entries)`,
          );
          setEditOpen(false);
          setSelected(null);
          setItems([]);
          setLedgerEntries([]);
          loadRows();
        } else {
          toast.error(resp?.message || "Update failed");
        }
      },
      (err) => {
        setSaving(false);
        toast.error(err?.message || "Update failed");
      },
    );
  };

  const deleteRecord = () => {
    if (!selected?.id || !facilityId) return;
    setDeleting(true);
    _postApi(
      "/api/production/material-requisitions/delete-with-postings",
      { id: selected.id, facilityId },
      (resp) => {
        setDeleting(false);
        if (resp?.success) {
          toast.success(
            resp.message ||
              `Deleted (${resp.data?.deleted_store_entries || 0} store, ${
                resp.data?.deleted_ledger_entries || 0
              } ledger)`,
          );
          setConfirmDeleteOpen(false);
          setEditOpen(false);
          setSelected(null);
          setItems([]);
          setLedgerEntries([]);
          loadRows();
        } else {
          toast.error(resp?.message || "Delete failed");
        }
      },
      (err) => {
        setDeleting(false);
        toast.error(err?.message || "Delete failed");
      },
    );
  };

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(r.id || "").toLowerCase().includes(q) ||
      String(r.product_name || "").toLowerCase().includes(q) ||
      String(r.product_code || "").toLowerCase().includes(q) ||
      String(r.status || "").toLowerCase().includes(q) ||
      String(r.creator_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="card shadow-sm border-0">
      <div
        className="card-header border-0 text-white"
        style={{
          background: "var(--aa-navy)",
          padding: "1rem 1.25rem",
        }}
      >
        <h5 className="mb-0 fw-bold">Material Requisition</h5>
        <small className="opacity-75">
          Correct approved requisitions (syncs store entries and ledger) or
          delete them
        </small>
      </div>

      <div className="card-body space-y-4">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 p-3 rounded border bg-light">
          <div className="flex-grow-1" style={{ minWidth: 220 }}>
            <div className="fw-semibold text-dark mb-1">Show in Production menu</div>
            <p className="text-muted small mb-0">
              When on, Material Requisition appears under Production and can
              issue raw materials to WIP.
            </p>
          </div>
          <div className="form-check form-switch m-0 d-flex align-items-center gap-2">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="enableMaterialRequisition"
              checked={enabled}
              onChange={toggleEnabled}
              disabled={toggleLoading}
              style={{ width: "2.75rem", height: "1.35rem", accentColor: primary }}
            />
            <label
              className="form-check-label small fw-semibold text-nowrap"
              htmlFor="enableMaterialRequisition"
            >
              {toggleLoading ? "Saving…" : enabled ? "Enabled" : "Disabled"}
            </label>
          </div>
        </div>

        {enabled && (
          <>
            <div className="d-flex flex-wrap gap-2 align-items-end justify-content-between">
              <div className="flex-grow-1" style={{ maxWidth: 360 }}>
                <Label className="small text-muted">Search</Label>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by id, product, status…"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadRows}
                disabled={listLoading}
              >
                <RefreshCcw
                  className={`h-4 w-4 mr-1 ${listLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>

            <div
              className={`border rounded overflow-auto max-h-96 ${
                editOpen || confirmDeleteOpen ? "hidden" : ""
              }`}
            >
              <table className="table table-sm mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Requisition</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.approved_at
                          ? moment(r.approved_at).format("DD/MM/YYYY")
                          : r.created_at
                            ? moment(r.created_at).format("DD/MM/YYYY")
                            : "—"}
                      </td>
                      <td>
                        <div className="font-medium text-sm">{r.id}</div>
                        <div className="text-xs text-muted">
                          {r.creator_name || "—"}
                        </div>
                      </td>
                      <td className="text-capitalize">{r.priority || "—"}</td>
                      <td>
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(r.status)}
                        >
                          {r.status || "—"}
                        </Badge>
                      </td>
                      <td className="text-end">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                            onClick={() => openDelete(r)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filtered.length && !listLoading && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        No approved material requisitions found
                      </td>
                    </tr>
                  )}
                  {listLoading && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        Loading…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {editOpen && selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative z-[201]">
            <div
              className="text-white p-5 flex-shrink-0"
              style={{
                background: "var(--aa-navy)",
              }}
            >
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h3 className="text-xl font-bold">Correct Requisition</h3>
                  <p className="text-white/80 text-sm mt-1 break-all">
                    {selected.id}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving || deleting}
                  onClick={closeEdit}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {!confirmDeleteOpen ? (
              <>
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  <p className="text-sm text-slate-600">
                    Saving updates this requisition and syncs linked{" "}
                    <strong>store entries</strong> and existing{" "}
                    <strong>general ledger</strong> date, Dr, and Cr.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Transaction / approval date</Label>
                      <Input
                        type="date"
                        className="mt-1"
                        value={form.transactionDate}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            transactionDate: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <select
                        className="form-select mt-1"
                        value={form.priority}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, priority: e.target.value }))
                        }
                      >
                        {PRIORITY_OPTIONS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <textarea
                      className="form-control mt-1"
                      rows={2}
                      value={form.notes}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, notes: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="mb-0">
                        Items (qty from store entries)
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {itemsLoading
                          ? "Loading…"
                          : `${items.length} line${items.length === 1 ? "" : "s"}`}
                      </span>
                    </div>
                    <div className="border rounded overflow-auto max-h-56">
                      <table className="table table-sm mb-0 align-middle">
                        <thead className="table-light">
                          <tr>
                            <th>Item</th>
                            <th>SKU</th>
                            <th>UOM</th>
                            <th className="text-end" style={{ minWidth: 120 }}>
                              Approved qty
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => (
                            <tr key={item.id}>
                              <td>
                                <div className="font-medium text-sm">
                                  {item.product_name || "—"}
                                </div>
                                <div className="text-xs text-muted">
                                  Store qty:{" "}
                                  {Number(item.original_qty || 0).toLocaleString()}
                                </div>
                              </td>
                              <td className="text-sm">
                                {item.product_code ||
                                  item.sku ||
                                  item.product_id ||
                                  "—"}
                              </td>
                              <td className="text-sm">
                                {item.unit_of_measure || "—"}
                              </td>
                              <td className="text-end">
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  className="h-8 text-end ms-auto"
                                  style={{ maxWidth: 130 }}
                                  value={item.approved_qty}
                                  onChange={(e) =>
                                    setItemQty(item.id, e.target.value)
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                          {!itemsLoading && items.length === 0 && (
                            <tr>
                              <td
                                colSpan={4}
                                className="text-center text-muted py-4"
                              >
                                No store-posted items found
                              </td>
                            </tr>
                          )}
                          {itemsLoading && (
                            <tr>
                              <td
                                colSpan={4}
                                className="text-center text-muted py-4"
                              >
                                Loading store entries…
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="mb-0">General ledger</Label>
                      <span className="text-xs text-muted-foreground">
                        {ledgerEntries.length} entr
                        {ledgerEntries.length === 1 ? "y" : "ies"}
                        {qtyChanged ? " · amounts update with qty" : ""}
                      </span>
                    </div>
                    <div className="border rounded overflow-auto max-h-56">
                      <table className="table table-sm mb-0 align-middle">
                        <thead className="table-light">
                          <tr>
                            <th>Date</th>
                            <th>Account</th>
                            <th>Description</th>
                            <th className="text-end">Dr</th>
                            <th className="text-end">Cr</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerPreview.map((gl) => (
                            <tr key={gl.transaction_id}>
                              <td className="text-sm whitespace-nowrap">
                                {gl.display_date
                                  ? moment(gl.display_date).format("DD/MM/YYYY")
                                  : "—"}
                              </td>
                              <td className="text-sm">
                                <div className="font-medium">
                                  {gl.account_code}
                                </div>
                                <div className="text-xs text-muted">
                                  {gl.account_description || ""}
                                </div>
                              </td>
                              <td className="text-sm">
                                {gl.transaction_description || "—"}
                              </td>
                              <td className="text-end text-sm">
                                {fmtMoney(gl.display_dr)}
                              </td>
                              <td className="text-end text-sm">
                                {fmtMoney(gl.display_cr)}
                              </td>
                            </tr>
                          ))}
                          {!itemsLoading && ledgerPreview.length === 0 && (
                            <tr>
                              <td
                                colSpan={5}
                                className="text-center text-muted py-4"
                              >
                                No ledger entries found for this requisition
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t flex flex-wrap justify-between gap-3 flex-shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    disabled={saving || deleting}
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving || deleting}
                      onClick={closeEdit}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={saving || deleting}
                      style={{ backgroundColor: primary }}
                      className="text-white hover:opacity-90"
                      onClick={saveEdit}
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="p-6 space-y-3 overflow-y-auto">
                  <h4 className="font-semibold text-slate-800">
                    Delete {selected.id}?
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    This permanently removes the requisition and all linked{" "}
                    <strong>store entries</strong> and{" "}
                    <strong>ledger postings</strong>
                    {items.length > 0
                      ? ` (${items.length} item line${items.length === 1 ? "" : "s"})`
                      : ""}
                    . This cannot be undone.
                  </p>
                  {items.length > 0 && (
                    <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1 max-h-40 overflow-y-auto">
                      {items.map((item) => (
                        <li key={item.id}>
                          {item.product_name ||
                            item.product_code ||
                            item.sku ||
                            "Item"}{" "}
                          — qty{" "}
                          {Number(
                            item.quantity_approved ??
                              item.quantity_requested ??
                              0,
                          ).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="p-4 bg-slate-50 border-t flex justify-end gap-3 flex-shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deleting}
                    onClick={() => setConfirmDeleteOpen(false)}
                  >
                    Go back
                  </Button>
                  <Button
                    type="button"
                    disabled={deleting}
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={deleteRecord}
                  >
                    {deleting ? "Deleting…" : "Delete now"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
