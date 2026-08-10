import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle2,
  FileStack,
  Printer,
  RefreshCw,
  SplitSquareVertical,
} from "lucide-react";
import moment from "moment";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { Button } from "@/components/ui/button";
import { formatNumber1 } from "@/components/router/utilities";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getFulfillmentStatusMeta,
  getWorkflowStatusMeta,
  normalizeWorkflowHistory,
  WorkflowStatusBadge,
} from "@/lib/saleWorkflowStatus.js";
import SaleWorkflowSearchBar from "./SaleWorkflowSearchBar";

export default function InvoiceSeparation() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const saleFromUrl = searchParams.get("sale_code") || "";

  const [loading, setLoading] = useState(false);
  const [packsLoading, setPacksLoading] = useState(false);
  const [separating, setSeparating] = useState(false);
  const [approvingCredit, setApprovingCredit] = useState(false);
  const [printingId, setPrintingId] = useState(null);
  const [printingAll, setPrintingAll] = useState(false);
  const [rows, setRows] = useState([]);
  const [selectedCode, setSelectedCode] = useState(saleFromUrl);
  const [packs, setPacks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchList = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    const params = new URLSearchParams({
      facilityId: activeBusiness.id,
      status:
        "payment_confirmed,invoice_separation,awaiting_credit_approval,credit_approved,final_invoice",
    });
    _fetchApi(
      `/api/v1/sale-workflows?${params.toString()}`,
      (res) => {
        setLoading(false);
        if (res.success) {
          const list = res.results || [];
          setRows(list);
          setSelectedCode((prev) => {
            if (prev && list.some((r) => r.sale_code === prev)) return prev;
            if (saleFromUrl && list.some((r) => r.sale_code === saleFromUrl)) {
              return saleFromUrl;
            }
            return list[0]?.sale_code || "";
          });
        } else {
          toast.error(res.message || "Failed to load separation queue");
          setRows([]);
        }
      },
      () => {
        setLoading(false);
        toast.error("Failed to load separation queue");
        setRows([]);
      },
    );
  }, [activeBusiness?.id, saleFromUrl]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const selected = useMemo(
    () => rows.find((r) => r.sale_code === selectedCode) || null,
    [rows, selectedCode],
  );

  const selectedHistory = useMemo(
    () => normalizeWorkflowHistory(selected?.history),
    [selected?.history],
  );

  const visibleRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.sale_code || "")
          .toLowerCase()
          .includes(q) ||
        String(r.customer_name || "")
          .toLowerCase()
          .includes(q) ||
        String(r.customer_no || "")
          .toLowerCase()
          .includes(q),
    );
  }, [rows, searchQuery]);

  const handleSearchSelect = useCallback(
    (row, code) => {
      const saleCode = row?.sale_code || code;
      if (!saleCode) return;
      setRows((prev) => {
        if (prev.some((r) => r.sale_code === saleCode)) return prev;
        return [{ ...row, sale_code: saleCode }, ...prev];
      });
      setSelectedCode(saleCode);
      const next = new URLSearchParams(searchParams);
      next.set("sale_code", saleCode);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const fetchPacks = useCallback(() => {
    if (!activeBusiness?.id || !selectedCode) {
      setPacks([]);
      return;
    }
    setPacksLoading(true);
    const params = new URLSearchParams({
      facilityId: activeBusiness.id,
      saleCode: selectedCode,
    });
    _fetchApi(
      `/api/v1/sale-workflows/fulfillments?${params.toString()}`,
      (res) => {
        setPacksLoading(false);
        if (res.success) {
          setPacks(res.results || []);
        } else {
          setPacks([]);
        }
      },
      () => {
        setPacksLoading(false);
        setPacks([]);
      },
    );
  }, [activeBusiness?.id, selectedCode]);

  useEffect(() => {
    fetchPacks();
  }, [fetchPacks]);

  const selectRow = (code) => {
    setSelectedCode(code);
    const next = new URLSearchParams(searchParams);
    if (code) next.set("sale_code", code);
    else next.delete("sale_code");
    setSearchParams(next, { replace: true });
  };

  const openBranchInvoice = (pack) => {
    if (!activeBusiness?.id || !pack) return;
    setPrintingId(pack.id);
    _postApi(
      "/api/v1/sale-workflows/fulfillment/print",
      {
        facilityId: activeBusiness.id,
        id: pack.id,
        packCode: pack.pack_code,
        updated_by: user?.id,
      },
      (res) => {
        setPrintingId(null);
        if (res.success) {
          fetchPacks();
          // Same in-app invoice preview as "Full invoice" (no new tab / popup).
          navigate(
            `/app/sales/invoice-preview?sale_code=${encodeURIComponent(
              pack.sale_code,
            )}&branch_id=${pack.branch_id}&pack_code=${encodeURIComponent(
              pack.pack_code,
            )}&branch_name=${encodeURIComponent(
              pack.branch_name || `Warehouse ${pack.branch_id}`,
            )}`,
          );
        } else {
          toast.error(res.message || "Could not open branch invoice");
        }
      },
      () => {
        setPrintingId(null);
        toast.error("Could not open branch invoice");
      },
    );
  };

  const printAllInvoices = () => {
    if (!activeBusiness?.id || !selected || packs.length === 0) return;
    setPrintingAll(true);

    let remaining = packs.length;
    let failed = false;

    const finish = () => {
      remaining -= 1;
      if (remaining > 0) return;
      setPrintingAll(false);
      fetchPacks();
      if (failed) {
        toast.error("Some copies could not be marked printed");
      }
      navigate(
        `/app/sales/invoice-preview?sale_code=${encodeURIComponent(
          selected.sale_code,
        )}&print_all=1`,
      );
    };

    packs.forEach((pack) => {
      _postApi(
        "/api/v1/sale-workflows/fulfillment/print",
        {
          facilityId: activeBusiness.id,
          id: pack.id,
          packCode: pack.pack_code,
          updated_by: user?.id,
        },
        (res) => {
          if (!res.success) failed = true;
          finish();
        },
        () => {
          failed = true;
          finish();
        },
      );
    });
  };

  const markSeparated = () => {
    if (!activeBusiness?.id || !selected) return;
    if (!packs.length) {
      toast.error("No branch copies to separate");
      return;
    }
    setSeparating(true);
    _postApi(
      "/api/v1/sale-workflows/complete-separation",
      {
        facilityId: activeBusiness.id,
        saleCode: selected.sale_code,
        updated_by: user?.id,
        note: `Separated into ${packs.length} branch invoice copies`,
      },
      (res) => {
        setSeparating(false);
        if (res.success) {
          toast.success(res.message || "Marked separated");
          setPacks([]);
          fetchList();
        } else {
          toast.error(res.message || "Could not mark separated");
        }
      },
      () => {
        setSeparating(false);
        toast.error("Could not mark separated");
      },
    );
  };

  const approveCredit = () => {
    if (!activeBusiness?.id || !selected) return;
    setApprovingCredit(true);
    _postApi(
      "/api/v1/sale-workflows/advance",
      {
        facilityId: activeBusiness.id,
        saleCode: selected.sale_code,
        action: "advance",
        note: "Credit approved",
        updated_by: user?.id,
      },
      (res) => {
        setApprovingCredit(false);
        if (res.success) {
          toast.success(res.message || "Credit approved");
          fetchList();
          fetchPacks();
        } else {
          toast.error(res.message || "Could not approve credit");
        }
      },
      () => {
        setApprovingCredit(false);
        toast.error("Could not approve credit");
      },
    );
  };

  const needsCreditApproval =
    selected?.status === "awaiting_credit_approval";
  const canSeparate =
    selected &&
    !needsCreditApproval &&
    [
      "payment_confirmed",
      "invoice_separation",
      "credit_approved",
      "final_invoice",
    ].includes(selected.status);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <SplitSquareVertical className="w-8 h-8 text-violet-600" />
                Invoice Separation
              </h1>
              <p className="text-gray-600 mt-1">
                Approve credit sales, then split invoices into warehouse copies
                and send to collection
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  fetchList();
                  fetchPacks();
                }}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
              <Link
                to="/app/sales/warehouse-requests"
                className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Warehouse
              </Link>
              <Link
                to="/app/sales/process"
                className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Sales Process
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 space-y-2">
              <div className="font-semibold text-gray-800">
                Awaiting separation ({visibleRows.length})
              </div>
              <SaleWorkflowSearchBar
                facilityId={activeBusiness?.id}
                rows={rows}
                onSelect={handleSearchSelect}
                onQueryChange={setSearchQuery}
                placeholder="Search or scan invoice, customer…"
              />
            </div>
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No paid invoices waiting. After cashier confirms payment, sales
                appear here to split by branch.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
                {visibleRows.map((row) => {
                  const active = row.sale_code === selectedCode;
                  return (
                    <li key={row.sale_code}>
                      <button
                        type="button"
                        onClick={() => selectRow(row.sale_code)}
                        className={`w-full text-left px-4 py-3 hover:bg-violet-50/60 ${
                          active ? "bg-violet-50 border-l-4 border-violet-500" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-gray-900 font-mono text-sm">
                              {row.sale_code}
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5">
                              {row.customer_name || "—"}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {moment(row.updated_at || row.updatedAt).format(
                                "DD MMM YYYY HH:mm",
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-gray-900">
                              ₦{formatNumber1(Number(row.amount || 0))}
                            </div>
                            <div className="mt-1">
                              <WorkflowStatusBadge
                                status={row.status}
                                paymentType={row.payment_type}
                              />
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="lg:col-span-3 bg-white rounded-lg shadow-sm p-6 min-h-[420px]">
            {!selected ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 py-16">
                <FileStack className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-sm">
                  Select a sale to view branch invoice copies.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 font-mono">
                      {selected.sale_code}
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {selected.customer_name || "—"} · ₦
                      {formatNumber1(Number(selected.amount || 0))}
                    </p>
                    <div className="mt-2">
                      <WorkflowStatusBadge
                        status={selected.status}
                        paymentType={selected.payment_type}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/app/sales/invoice-preview?sale_code=${encodeURIComponent(
                        selected.sale_code,
                      )}`}
                      className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      Full invoice
                    </Link>
                    {needsCreditApproval ? (
                      <Button
                        type="button"
                        disabled={approvingCredit}
                        onClick={approveCredit}
                        style={{ backgroundColor: "#4267B2" }}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {approvingCredit ? "Approving…" : "Approve Credit"}
                      </Button>
                    ) : null}
                    {canSeparate && packs.length > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={printingAll || packsLoading}
                        onClick={printAllInvoices}
                        className="flex items-center gap-2"
                      >
                        <Printer className="w-4 h-4" />
                        {printingAll
                          ? "Opening…"
                          : `Print all (${packs.length})`}
                      </Button>
                    ) : null}
                    {canSeparate ? (
                      <Button
                        type="button"
                        disabled={separating || packs.length === 0}
                        onClick={markSeparated}
                        style={{ backgroundColor: "#4267B2" }}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {separating ? "Separating…" : "Mark Separated"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {needsCreditApproval ? (
                  <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    This credit sale needs approval before warehouse copies are
                    created. Click <strong>Approve Credit</strong> to continue.
                  </div>
                ) : null}

                <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-4 mb-4">
                  <h3 className="text-sm font-semibold text-violet-900 uppercase tracking-wide mb-1">
                    Warehouse invoice copies
                  </h3>
                  <p className="text-xs text-violet-800 mb-3">
                    {needsCreditApproval
                      ? "Branch copies appear after credit is approved."
                      : "One copy per warehouse branch. Use Print all to print every branch (A4 or thermal from system settings). Then mark separated to send packs to warehouse."}
                  </p>

                  {!needsCreditApproval && packs.length > 1 ? (
                    <div className="mb-3">
                      <Button
                        type="button"
                        size="sm"
                        disabled={printingAll}
                        onClick={printAllInvoices}
                        className="h-8"
                        style={{ backgroundColor: "#4267B2" }}
                      >
                        <Printer className="w-3.5 h-3.5 mr-1" />
                        {printingAll
                          ? "Opening…"
                          : `Print all ${packs.length} invoices`}
                      </Button>
                    </div>
                  ) : null}

                  {packsLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : packs.length === 0 ? (
                    <p className="text-sm text-violet-800">
                      {needsCreditApproval
                        ? "No branch copies yet — approve credit first."
                        : "No branch lines found on this invoice yet."}
                    </p>
                  ) : (
                    <ul className="space-y-4">
                      {packs.map((pack, idx) => {
                        const fMeta = getFulfillmentStatusMeta(pack.status);
                        const lines = pack.lines || [];
                        return (
                          <li
                            key={pack.id}
                            className="rounded-md border border-violet-100 bg-white px-4 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                              <div>
                                <div className="font-medium text-gray-900 text-sm">
                                  Copy {idx + 1} of {packs.length} ·{" "}
                                  {pack.branch_name ||
                                    `Warehouse ${pack.branch_id}`}
                                </div>
                                <div className="text-xs text-gray-500 font-mono">
                                  {pack.pack_code}
                                </div>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${fMeta.badge}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${fMeta.dot}`}
                                />
                                {fMeta.label}
                              </span>
                            </div>

                            <table className="w-full text-sm mb-3">
                              <thead>
                                <tr className="text-left text-xs text-gray-500 border-b">
                                  <th className="py-1 font-medium">Item</th>
                                  <th className="py-1 font-medium text-right">
                                    Qty
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {lines.map((line) => (
                                  <tr
                                    key={line.id}
                                    className="border-b border-gray-50"
                                  >
                                    <td className="py-1.5 text-gray-800">
                                      {line.item_name || line.product_id}
                                    </td>
                                    <td className="py-1.5 text-right text-gray-700">
                                      {formatNumber1(Number(line.qty || 0))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={printingId === pack.id}
                              onClick={() => openBranchInvoice(pack)}
                              className="h-8"
                            >
                              <Printer className="w-3.5 h-3.5 mr-1" />
                              {printingId === pack.id
                                ? "Opening…"
                                : "Print branch invoice"}
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {canSeparate && packs.length > 0 ? (
                  <p className="text-xs text-gray-500">
                    After you print the copies, click{" "}
                    <strong>Mark Separated</strong> to move this sale to
                    Warehouse Requests.
                  </p>
                ) : null}

                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    Process history
                  </h3>
                  {selectedHistory.length ? (
                    <ul className="text-xs text-gray-600 space-y-2 max-h-48 overflow-y-auto rounded-md border border-gray-100 bg-gray-50 p-3">
                      {[...selectedHistory].reverse().map((h, i) => {
                        const hMeta = getWorkflowStatusMeta(h.status);
                        return (
                          <li
                            key={`${h.at}-${i}`}
                            className="flex flex-wrap items-start gap-x-2 gap-y-1 border-b border-gray-100 pb-2 last:border-0 last:pb-0"
                          >
                            <span className="font-mono text-gray-400 shrink-0">
                              {h.at
                                ? moment(h.at).format("DD MMM YYYY HH:mm")
                                : "—"}
                            </span>
                            <WorkflowStatusBadge
                              status={h.status}
                              label={hMeta.label}
                            />
                            {h.by ? (
                              <span className="text-gray-500">by {h.by}</span>
                            ) : null}
                            {h.note ? (
                              <span className="w-full text-gray-500">{h.note}</span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500 rounded-md border border-dashed border-gray-200 px-3 py-4">
                      No history recorded for this sale yet.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
