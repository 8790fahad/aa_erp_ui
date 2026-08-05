import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, Trash2, CalendarClock, Save, Scale } from "lucide-react";
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
  POSTING_DATE_MIN,
  getPostingDateMax,
  validatePostingDateClient,
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
  if (parsed === "" || parsed == null) return 0;
  const n = parseFloat(parsed);
  return Number.isFinite(n) ? n : 0;
}

function computeLineTotals(lineList, drafts, excludeId = null) {
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lineList) {
    if (excludeId != null && line.transaction_id === excludeId) continue;
    const draft = drafts[line.transaction_id];
    totalDebit += parseDraftAmount(draft?.dr ?? line.dr);
    totalCredit += parseDraftAmount(draft?.cr ?? line.cr);
  }
  return { totalDebit, totalCredit };
}

function isTotalsBalanced(totalDebit, totalCredit) {
  return Math.abs(totalDebit - totalCredit) < 0.01;
}

export default function JournalCorrection() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const facilityId = activeBusiness?.id;

  const [search, setSearch] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [linesLoading, setLinesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [lines, setLines] = useState([]);
  const [lineDrafts, setLineDrafts] = useState({});
  const [batchDate, setBatchDate] = useState("");
  const [confirmDeleteLineId, setConfirmDeleteLineId] = useState(null);
  const [confirmDeleteBatchOpen, setConfirmDeleteBatchOpen] = useState(false);
  const [confirmUpdateDateOpen, setConfirmUpdateDateOpen] = useState(false);

  const loadEntries = useCallback(() => {
    if (!facilityId) return;
    setListLoading(true);
    const q = encodeURIComponent((search || "").trim());
    _fetchApi(
      `/account/journal-correction/entries?facilityId=${facilityId}&q=${q}&limit=40`,
      (resp) => {
        setListLoading(false);
        if (resp.success) {
          setRows(resp.results || []);
        } else {
          toast.error(resp.message || "Failed to load journal entries");
        }
      },
      () => {
        setListLoading(false);
        toast.error("Could not load journal entries");
      }
    );
  }, [facilityId, search]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const hydrateLineDrafts = (ledgerLines) => {
    const drafts = {};
    ledgerLines.forEach((line) => {
      drafts[line.transaction_id] = {
        transaction_date: line.transaction_date
          ? moment(line.transaction_date).format("YYYY-MM-DD")
          : "",
        dr: formatAmountInput(line.dr || 0),
        cr: formatAmountInput(line.cr || 0),
      };
    });
    setLineDrafts(drafts);
  };

  const loadLines = (transactionRef) => {
    if (!facilityId || !transactionRef) return;
    setLinesLoading(true);
    _fetchApi(
      `/account/journal-correction/lines?facilityId=${facilityId}&transactionRef=${encodeURIComponent(
        transactionRef
      )}`,
      (resp) => {
        setLinesLoading(false);
        if (resp.success) {
          setLines(resp.results || []);
          hydrateLineDrafts(resp.results || []);
          const d = resp.summary?.transaction_date
            ? moment(resp.summary.transaction_date).format("YYYY-MM-DD")
            : "";
          setBatchDate(d);
        } else {
          toast.error(resp.message || "Failed to load journal lines");
          setLines([]);
        }
      },
      () => {
        setLinesLoading(false);
        toast.error("Could not load journal lines");
        setLines([]);
      }
    );
  };

  const handlePick = (row) => {
    setSelectedRow(row);
    setEditModalOpen(true);
    loadLines(row.transaction_ref);
  };

  const setLineDraft = (transactionId, field, value) => {
    setLineDrafts((prev) => {
      const current = prev[transactionId] || {};
      if (field === "dr" || field === "cr") {
        return {
          ...prev,
          [transactionId]: {
            ...current,
            [field]: formatAmountInput(value),
          },
        };
      }
      return {
        ...prev,
        [transactionId]: { ...current, [field]: value },
      };
    });
  };

  const saveLine = (transactionId) => {
    const draft = lineDrafts[transactionId];
    if (!draft) return;

    const { totalDebit, totalCredit } = computeLineTotals(
      lines,
      lineDrafts,
      null
    );
    if (!isTotalsBalanced(totalDebit, totalCredit)) {
      toast.error(
        `Cannot save — entry would be unbalanced. Debit ₦${totalDebit.toLocaleString()} vs Credit ₦${totalCredit.toLocaleString()}.`
      );
      return;
    }

    const dateErr = validatePostingDateClient(draft.transaction_date, {
      field: "Transaction date",
    });
    if (dateErr) {
      toast.error(dateErr);
      return;
    }

    setSaving(true);
    _postApi(
      "/account/journal-correction/update-line",
      {
        facilityId,
        transactionId,
        transactionDate: draft.transaction_date,
        dr: parseDraftAmount(draft.dr),
        cr: parseDraftAmount(draft.cr),
      },
      (resp) => {
        setSaving(false);
        if (resp.success) {
          toast.success("Line updated");
          if (selectedRow?.transaction_ref) {
            loadLines(selectedRow.transaction_ref);
            loadEntries();
          }
        } else {
          toast.error(resp.message || resp.error || "Could not update line");
        }
      },
      () => {
        setSaving(false);
        toast.error("Could not update line");
      }
    );
  };

  const doUpdateBatchDate = () => {
    if (!selectedRow?.transaction_ref || !batchDate) {
      toast.error("Select entry and new date");
      return;
    }
    const dateErr = validatePostingDateClient(batchDate, {
      field: "Transaction date",
    });
    if (dateErr) {
      toast.error(dateErr);
      return;
    }
    setSaving(true);
    _postApi(
      "/account/journal-correction/update-date",
      {
        facilityId,
        transactionRef: selectedRow.transaction_ref,
        newTransactionDate: batchDate,
      },
      (resp) => {
        setSaving(false);
        if (resp.success) {
          toast.success("Journal date updated for all lines");
          loadLines(selectedRow.transaction_ref);
          loadEntries();
          setConfirmUpdateDateOpen(false);
        } else {
          toast.error(resp.message || "Could not update date");
        }
      },
      () => {
        setSaving(false);
        toast.error("Could not update date");
      }
    );
  };

  const doDeleteLine = (transactionId) => {
    setSaving(true);
    _postApi(
      "/account/journal-correction/delete-line",
      { facilityId, transactionId },
      (resp) => {
        setSaving(false);
        if (resp.success) {
          toast.success("Line deleted");
          setConfirmDeleteLineId(null);
          if (selectedRow?.transaction_ref) {
            loadLines(selectedRow.transaction_ref);
            loadEntries();
          }
        } else {
          toast.error(resp.message || resp.error || "Could not delete line", {
            description: resp.hint,
          });
        }
      },
      () => {
        setSaving(false);
        toast.error("Could not delete line");
      }
    );
  };

  const doDeleteBatch = () => {
    if (!selectedRow?.transaction_ref) {
      toast.error("Select entry first");
      return;
    }
    setSaving(true);
    _postApi(
      "/account/journal-correction/delete",
      {
        facilityId,
        transactionRef: selectedRow.transaction_ref,
      },
      (resp) => {
        setSaving(false);
        if (resp.success) {
          toast.success("Journal entry deleted");
          setConfirmDeleteBatchOpen(false);
          setEditModalOpen(false);
          setSelectedRow(null);
          setLines([]);
          loadEntries();
        } else {
          toast.error(resp.message || "Could not delete journal entry");
        }
      },
      () => {
        setSaving(false);
        toast.error("Could not delete journal entry");
      }
    );
  };

  const draftTotalDebit = lines.reduce((s, l) => {
    const draft = lineDrafts[l.transaction_id];
    return s + parseDraftAmount(draft?.dr ?? l.dr);
  }, 0);
  const draftTotalCredit = lines.reduce((s, l) => {
    const draft = lineDrafts[l.transaction_id];
    return s + parseDraftAmount(draft?.cr ?? l.cr);
  }, 0);
  const isBalanced = isTotalsBalanced(draftTotalDebit, draftTotalCredit);

  const deletePreview =
    confirmDeleteLineId != null
      ? computeLineTotals(lines, lineDrafts, confirmDeleteLineId)
      : null;
  const deleteWouldBalance =
    deletePreview == null ||
    lines.length <= 1 ||
    isTotalsBalanced(deletePreview.totalDebit, deletePreview.totalCredit);

  const handleModalOpenChange = (open) => {
    setEditModalOpen(open);
    if (!open) {
      setSelectedRow(null);
      setLines([]);
      setLineDrafts({});
      setBatchDate("");
      setConfirmDeleteLineId(null);
      setConfirmDeleteBatchOpen(false);
      setConfirmUpdateDateOpen(false);
    }
  };

  return (
    <div className="card shadow-sm border-0">
      <div className="card-header bg-[#2C5CC5] text-white border-0 d-flex align-items-center justify-content-between">
        <div>
          <h5 className="mb-0 fw-bold text-white">Journal Correction</h5>
          <small className="text-blue-100">
            Search ledger entries, edit line amounts and dates, or delete lines
            or whole entries
          </small>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadEntries}
          disabled={listLoading}
          className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
        >
          <RefreshCcw
            className={`h-4 w-4 ${listLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>
      <div className="card-body space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>Search journal entry</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Reference, transaction ref, description…"
            />
          </div>
          <div>
            <Button
              type="button"
              onClick={loadEntries}
              disabled={listLoading}
              className="bg-[#2C5CC5] hover:bg-[#1e4ba8] text-white"
            >
              Search
            </Button>
          </div>
        </div>

        <div
          className={`border border-blue-100 rounded-lg overflow-auto max-h-72 ${
            editModalOpen ? "hidden" : ""
          }`}
        >
          <table className="table table-sm mb-0">
            <thead className="sticky-top" style={{ backgroundColor: "#2C5CC5" }}>
              <tr className="text-white">
                <th className="text-white border-0">Date</th>
                <th className="text-white border-0">Reference</th>
                <th className="text-white border-0">Description</th>
                <th className="text-end text-white border-0">Debit</th>
                <th className="text-end text-white border-0">Credit</th>
                <th className="text-white border-0">Lines</th>
                <th className="text-end text-white border-0">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.transaction_ref}>
                  <td>
                    {r.transaction_date
                      ? moment(r.transaction_date).format("DD/MM/YYYY")
                      : "-"}
                  </td>
                  <td>
                    <div className="font-medium">{r.reference_number || "-"}</div>
                    <div className="text-xs text-muted font-monospace">
                      {r.transaction_ref}
                    </div>
                  </td>
                  <td className="small">{r.purpose_of_payment || "-"}</td>
                  <td className="text-end">
                    {Number(r.total_debit || 0).toLocaleString()}
                  </td>
                  <td className="text-end">
                    {Number(r.total_credit || 0).toLocaleString()}
                  </td>
                  <td>
                    <Badge variant="outline">{r.line_count || 0}</Badge>
                  </td>
                  <td className="text-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handlePick(r)}
                      className="bg-[#2C5CC5] hover:bg-[#1e4ba8] text-white"
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && !listLoading && (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-3">
                    No journal entries found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={editModalOpen} onOpenChange={handleModalOpenChange}>
        <DialogContent className="max-w-5xl z-[1200] p-0 overflow-hidden max-h-[92vh] flex flex-col gap-0 [&>button]:text-white [&>button]:hover:bg-white/20 [&>button]:top-4">
          <div className="bg-gradient-to-r from-[#2C5CC5] via-[#3470d4] to-[#1e4ba8] text-white px-6 py-5 pr-12 shrink-0">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-xl font-bold text-white">
                Journal Correction
              </DialogTitle>
              <DialogDescription className="text-blue-100">
                Edit debit/credit and date per line, update all line dates, or
                delete the entry.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1 bg-slate-50">
            {selectedRow && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-sm space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <span className="text-xs uppercase tracking-wide text-[#2C5CC5] font-semibold">
                      Reference
                    </span>
                    <p className="font-semibold text-gray-900 mt-0.5">
                      {selectedRow.reference_number || "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-[#2C5CC5] font-semibold">
                      Transaction ref
                    </span>
                    <p className="font-mono text-gray-900 mt-0.5">
                      {selectedRow.transaction_ref}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-[#2C5CC5] font-semibold">
                      Description
                    </span>
                    <p className="text-gray-800 mt-0.5">
                      {selectedRow.purpose_of_payment || "-"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-white rounded-xl border border-gray-200 p-4">
              <div>
                <Label className="text-gray-700 font-medium">
                  Update date (all lines)
                </Label>
                <Input
                  type="date"
                  value={batchDate}
                  min={POSTING_DATE_MIN}
                  max={getPostingDateMax()}
                  onChange={(e) => setBatchDate(e.target.value)}
                  className="border-gray-200 mt-1"
                />
              </div>
              <div>
                <Button
                  type="button"
                  onClick={() => setConfirmUpdateDateOpen(true)}
                  disabled={saving || !batchDate}
                  className="bg-[#2C5CC5] hover:bg-[#1e4ba8] text-white w-full md:w-auto"
                >
                  <CalendarClock className="h-4 w-4" />
                  Apply date to all lines
                </Button>
              </div>
              <div className="text-end">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmDeleteBatchOpen(true)}
                  disabled={saving}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete entire entry
                </Button>
              </div>
            </div>

            {linesLoading ? (
              <div className="text-center text-gray-500 py-8 bg-white rounded-xl border border-gray-200">
                Loading lines…
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="overflow-auto max-h-[min(50vh,420px)]">
                  <table className="table table-sm mb-0">
                    <thead className="sticky-top" style={{ backgroundColor: "#2C5CC5" }}>
                      <tr>
                        <th className="text-white border-0">Account</th>
                        <th className="text-white border-0">Description</th>
                        <th className="text-white border-0">Date</th>
                        <th className="text-end text-white border-0">Debit</th>
                        <th className="text-end text-white border-0">Credit</th>
                        <th className="text-end text-white border-0">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => {
                        const draft = lineDrafts[line.transaction_id] || {};
                        return (
                          <tr key={line.transaction_id} className="hover:bg-blue-50/40">
                            <td className="small font-monospace align-middle">
                              {line.account_code || "-"}
                            </td>
                            <td className="small align-middle max-w-[220px]">
                              {line.transaction_description || "-"}
                            </td>
                            <td className="align-middle">
                              <Input
                                type="date"
                                className="h-8 border-gray-200"
                                value={draft.transaction_date || ""}
                                min={POSTING_DATE_MIN}
                                max={getPostingDateMax()}
                                onChange={(e) =>
                                  setLineDraft(
                                    line.transaction_id,
                                    "transaction_date",
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                            <td className="align-middle">
                              <Input
                                type="text"
                                inputMode="decimal"
                                className="h-8 text-end border-gray-200 tabular-nums"
                                value={draft.dr || ""}
                                onChange={(e) =>
                                  setLineDraft(
                                    line.transaction_id,
                                    "dr",
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                            <td className="align-middle">
                              <Input
                                type="text"
                                inputMode="decimal"
                                className="h-8 text-end border-gray-200 tabular-nums"
                                value={draft.cr || ""}
                                onChange={(e) =>
                                  setLineDraft(
                                    line.transaction_id,
                                    "cr",
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                            <td className="text-end align-middle">
                              <div className="d-flex gap-1 justify-content-end">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => saveLine(line.transaction_id)}
                                  disabled={saving}
                                  className="bg-[#2C5CC5] hover:bg-[#1e4ba8] text-white"
                                  title="Save line"
                                >
                                  <Save className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    setConfirmDeleteLineId(line.transaction_id)
                                  }
                                  disabled={saving}
                                  title="Delete line"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!lines.length && (
                        <tr>
                          <td colSpan={6} className="text-center text-muted py-6">
                            No lines
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {lines.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-100 border-t-2 border-[#2C5CC5]">
                          <td colSpan={3} className="fw-semibold text-gray-800">
                            Totals
                          </td>
                          <td className="text-end fw-bold tabular-nums text-gray-900">
                            {draftTotalDebit.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="text-end fw-bold tabular-nums text-gray-900">
                            {draftTotalCredit.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {lines.length > 0 && (
              <div
                className={`rounded-xl border-2 p-4 flex items-center justify-between gap-3 ${
                  isBalanced
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-amber-300 bg-amber-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      isBalanced ? "bg-emerald-100" : "bg-amber-100"
                    }`}
                  >
                    <Scale
                      className={`h-5 w-5 ${
                        isBalanced ? "text-emerald-700" : "text-amber-700"
                      }`}
                    />
                  </div>
                  <div>
                    <p
                      className={`text-sm font-bold ${
                        isBalanced ? "text-emerald-800" : "text-amber-900"
                      }`}
                    >
                      {isBalanced ? "Entry is balanced" : "Entry is out of balance"}
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${
                        isBalanced ? "text-emerald-700" : "text-amber-800"
                      }`}
                    >
                      Debit ₦
                      {draftTotalDebit.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      · Credit ₦
                      {draftTotalCredit.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      {!isBalanced && (
                        <>
                          {" "}
                          · Difference ₦
                          {Math.abs(draftTotalDebit - draftTotalCredit).toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <Badge
                  className={
                    isBalanced
                      ? "bg-emerald-600 hover:bg-emerald-600"
                      : "bg-amber-600 hover:bg-amber-600"
                  }
                >
                  {isBalanced ? "Balanced" : "Unbalanced"}
                </Badge>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmDeleteLineId != null}
        onOpenChange={(open) => !open && setConfirmDeleteLineId(null)}
      >
        <DialogContent className="max-w-md z-[1200] border-blue-100">
          <DialogHeader>
            <DialogTitle className="text-[#2C5CC5]">Delete ledger line?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>This removes one line from the journal entry. This cannot be undone.</p>
                {deletePreview && lines.length > 1 && (
                  <div
                    className={`rounded-lg border p-3 text-xs ${
                      deleteWouldBalance
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-amber-200 bg-amber-50 text-amber-900"
                    }`}
                  >
                    {deleteWouldBalance ? (
                      <p className="font-semibold">
                        ✓ Remaining entry stays balanced (Debit ₦
                        {deletePreview.totalDebit.toLocaleString()} = Credit ₦
                        {deletePreview.totalCredit.toLocaleString()})
                      </p>
                    ) : (
                      <>
                        <p className="font-semibold">
                          ⚠ Remaining entry would be unbalanced
                        </p>
                        <p className="mt-1">
                          After delete: Debit ₦
                          {deletePreview.totalDebit.toLocaleString()} · Credit ₦
                          {deletePreview.totalCredit.toLocaleString()} · Difference ₦
                          {Math.abs(
                            deletePreview.totalDebit - deletePreview.totalCredit
                          ).toLocaleString()}
                        </p>
                        <p className="mt-1">
                          Delete the matching offset line too, adjust amounts first,
                          or use Delete entire entry.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteLineId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => doDeleteLine(confirmDeleteLineId)}
              disabled={saving || (lines.length > 1 && !deleteWouldBalance)}
            >
              Delete line
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmUpdateDateOpen} onOpenChange={setConfirmUpdateDateOpen}>
        <DialogContent className="max-w-md z-[1200] border-blue-100">
          <DialogHeader>
            <DialogTitle className="text-[#2C5CC5]">Update journal date</DialogTitle>
            <DialogDescription>
              Set all lines to{" "}
              <strong>
                {batchDate ? moment(batchDate).format("DD/MM/YYYY") : "-"}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmUpdateDateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={doUpdateBatchDate}
              disabled={saving}
              className="bg-[#2C5CC5] hover:bg-[#1e4ba8] text-white"
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteBatchOpen} onOpenChange={setConfirmDeleteBatchOpen}>
        <DialogContent className="max-w-md z-[1200] border-blue-100">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete entire journal entry?</DialogTitle>
            <DialogDescription>
              Delete all ledger lines for{" "}
              <strong>{selectedRow?.reference_number || selectedRow?.transaction_ref}</strong>?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteBatchOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doDeleteBatch} disabled={saving}>
              Delete entry
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
