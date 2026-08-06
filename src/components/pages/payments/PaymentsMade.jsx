import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import moment from "moment";
import { toast } from "sonner";
import { Col, Row } from "reactstrap";
import { Input } from "antd";
import {
  CreditCard,
  HandCoins,
  MoreVerticalIcon,
  Printer,
} from "lucide-react";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ApplySupplierDeposit from "@/components/pages/payments/ApplySupplierDeposit";

/**
 * Pay Bills — payment history list, matching Bill / app list layout.
 */
export default function PaymentsMade() {
  const navigate = useNavigate();
  const { activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;

  const [searchInput, setSearchInput] = useState("");
  const [modeFilter, setModeFilter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [applyDepositOpen, setApplyDepositOpen] = useState(false);
  const pageSize = 20;

  const fetchList = useCallback(() => {
    if (!facilityId) return;
    setLoading(true);
    const params = new URLSearchParams({
      facilityId,
      limit: "500",
    });

    _fetchApi(
      `/api/v1/get-supplier-advance-history?${params.toString()}`,
      (resp) => {
        setLoading(false);
        if (!resp?.success) {
          toast.error(resp?.message || "Failed to load payments");
          setRows([]);
          return;
        }
        setRows(Array.isArray(resp.results) ? resp.results : []);
      },
      () => {
        setLoading(false);
        toast.error("Failed to load payments");
        setRows([]);
      },
    );
  }, [facilityId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
    setPage(1);
  };

  const handleModeFilter = (e) => {
    const value = e.target.value;
    setModeFilter(value === "all" ? null : value);
    setPage(1);
  };

  const filteredRows = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return rows.filter((r) => {
      if (modeFilter) {
        const mode = String(r.mode_of_payment || "").toLowerCase();
        if (mode !== modeFilter) return false;
      }
      if (!q) return true;
      const hay = [
        r.receipt_no,
        r.supplier_name,
        r.supplier_no,
        r.mode_of_payment,
        r.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, searchInput, modeFilter]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const openReceipt = (item) => {
    const ref = item.receipt_no || "";
    navigate(
      `/app/purchase/supplier-payment-receipt?ref_number=${encodeURIComponent(
        ref,
      )}&pv_code=${encodeURIComponent(ref)}&supplier_no=${encodeURIComponent(
        item.supplier_no || "",
      )}`,
    );
  };

  const fields = [
    {
      title: "Payment #",
      component: (item) => (
        <button
          type="button"
          className="text-sm font-medium text-blue-600 hover:underline"
          onClick={() => openReceipt(item)}
        >
          {item.receipt_no || "-"}
        </button>
      ),
    },
    {
      title: "Vendor",
      component: (item) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {item.supplier_name || "-"}
          </div>
          <div className="text-xs text-gray-500">{item.supplier_no || ""}</div>
        </div>
      ),
    },
    {
      title: "Payment Date",
      component: (item) => (
        <span className="text-sm text-gray-700">
          {item.date ? moment(item.date).format("MM/DD/YYYY") : "-"}
        </span>
      ),
    },
    {
      title: "Mode",
      component: (item) => (
        <span className="text-sm capitalize text-gray-700">
          {item.mode_of_payment || "-"}
        </span>
      ),
    },
    {
      title: "Amount (₦)",
      component: (item) => (
        <span className="text-sm font-semibold text-gray-900">
          {formatNumber1(item.amount || 0)}
        </span>
      ),
    },
    {
      title: "Action",
      component: (item) => (
        <div className="flex justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-slate-500 data-[state=open]:bg-slate-100"
              >
                <MoreVerticalIcon className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => openReceipt(item)}>
                <Printer className="mr-2 h-4 w-4" />
                View receipt
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="p-2">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pay Bills</h1>
          <p className="text-muted-foreground">
            Record and track vendor bill payments
          </p>
        </div>
      </div>

      <Row className="mb-3">
        <Col md="6">
          <Input.Search
            placeholder="Search by payment #, vendor, or reference"
            value={searchInput}
            onChange={handleSearchChange}
          />
        </Col>
        <Col md="6">
          <div className="flex items-center justify-end gap-2">
            <select
              value={modeFilter || "all"}
              onChange={handleModeFilter}
              className="h-9 min-w-[9rem] rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#4267B2] focus:ring-1 focus:ring-[#4267B2]"
              aria-label="Filter by payment mode"
            >
              <option value="all">All</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="cheque">Cheque</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setApplyDepositOpen(true)}
            >
              Apply Deposit
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex h-9 items-center gap-2 bg-[#4267B2] shadow-none hover:bg-[#5A7EC1]"
              onClick={() => navigate("/app/payments/pay-bills/new")}
            >
              <HandCoins className="h-4 w-4" />
              New Payment
            </Button>
          </div>
        </Col>
      </Row>

      <div className="mt-3">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                {fields.map((field, idx) => (
                  <th
                    key={idx}
                    className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700"
                  >
                    {field.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {fields.map((_, fieldIdx) => (
                      <td key={fieldIdx} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={fields.length} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                        <CreditCard className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-lg text-gray-500">
                        {searchInput || modeFilter
                          ? "No payments found"
                          : "No payments recorded yet"}
                      </p>
                      {!searchInput && !modeFilter && (
                        <Button
                          variant="default"
                          size="sm"
                          className="flex items-center gap-2 bg-[#4267B2] shadow-none hover:bg-[#5A7EC1]"
                          onClick={() => navigate("/app/payments/pay-bills/new")}
                        >
                          <HandCoins className="h-4 w-4" />
                          New Payment
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => (
                  <tr
                    key={item.entry_id || item.receipt_no || idx}
                    className="hover:bg-gray-50"
                  >
                    {fields.map((field, fieldIdx) => (
                      <td
                        key={fieldIdx}
                        className="px-4 py-3 text-sm text-gray-900"
                      >
                        {field.component
                          ? field.component(item)
                          : item[field.value]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredRows.length > pageSize && (
          <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, filteredRows.length)} of{" "}
              {filteredRows.length}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={applyDepositOpen} onOpenChange={setApplyDepositOpen}>
        <DialogContent className="max-h-[92vh] w-[95vw] max-w-5xl overflow-y-auto border-0 bg-transparent p-0 shadow-none [&>button]:right-8 [&>button]:top-6 [&>button]:z-10">
          <DialogHeader className="sr-only">
            <DialogTitle>Apply Deposit</DialogTitle>
            <DialogDescription>
              Apply a vendor deposit to unpaid bills
            </DialogDescription>
          </DialogHeader>
          {applyDepositOpen ? (
            <ApplySupplierDeposit
              asModal
              onCancel={() => setApplyDepositOpen(false)}
              onSuccess={() => {
                setApplyDepositOpen(false);
                fetchList();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
