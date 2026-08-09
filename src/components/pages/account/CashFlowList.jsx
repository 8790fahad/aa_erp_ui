import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Eye, Pencil, ArrowLeftRight, Search } from "lucide-react";
import moment from "moment";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { formatNumber1 } from "@/components/router/utilities";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import CustomTable1 from "@/common/Custom/CustomTable1";
import CashFlowForm from "./CashFlowForm";

const getTransferStatusStyles = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "pending" || normalized === "initial") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }
  if (normalized === "returned" || normalized === "re_list") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (
    normalized === "approved" ||
    normalized === "completed" ||
    normalized === "list"
  ) {
    return "border-[var(--aa-navy,#0f2744)]/25 bg-[var(--aa-sidebar-active,#eff4fb)] text-[var(--aa-navy,#0f2744)]";
  }
  if (normalized === "reviewed" || normalized === "review") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-slate-200 bg-slate-100 text-slate-700";
};

export default function CashFlowList() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const { user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [cashTransfers, setCashTransfers] = useState([]);
  const [items, setItems] = useState({});
  const [isOpen, setIsOpen] = useState(false);
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [message, setMessage] = useState("No cash transfers found");
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("all");
  const [accountNameByCode, setAccountNameByCode] = useState({});
  const navigate = useNavigate();

  const getCashTransfers = useCallback(() => {
    if (!activeBusiness?.id || !user?.id) return;
    setLoading(true);
    _fetchApi(
      `/get-cash-transfers/${activeBusiness.id}/${status}/${user.id}/list`,
      (data) => {
        setLoading(false);
        if (data.success && data.results.length > 0) {
          setCashTransfers(data.results);
        } else {
          setCashTransfers([]);
          setMessage(
            status === "all"
              ? "No cash transfers found"
              : `No cash transfers found for ${status}`,
          );
        }
      },
      (err) => {
        setLoading(false);
        console.log(err);
      },
    );
  }, [activeBusiness?.id, user?.id, status]);

  useEffect(() => {
    getCashTransfers();
  }, [getCashTransfers]);

  const getAccountLookup = useCallback(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/account/chart-of-accounts/${activeBusiness.id}`,
      (resp) => {
        if (!resp?.success || !Array.isArray(resp.results)) return;
        const lookup = {};
        resp.results.forEach((acc) => {
          const code = String(
            acc?.account_code || acc?.head || acc?.code || "",
          ).trim();
          if (!code) return;
          lookup[code] = acc?.description || acc?.account_description || code;
        });
        setAccountNameByCode(lookup);
      },
      () => {},
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    getAccountLookup();
  }, [getAccountLookup]);

  const formatAccountLabel = useCallback(
    (code) => {
      const normalized = String(code || "").trim();
      if (!normalized) return "—";
      const description = accountNameByCode[normalized];
      return description ? `${description} (${normalized})` : normalized;
    },
    [accountNameByCode],
  );

  const closePreview = () => {
    setItems({});
    setIsOpen(false);
  };

  const viewList = (item) => {
    setItems(item);
    setIsOpen(true);
    _postApi(
      "/cash-transfer-item-list",
      {
        query_type: "select",
        transfer_id: item.transfer_id,
        date: moment().format("YYYY-MM-DD"),
        user_id: user.id,
      },
      () => {},
      () => {
        toast.error("Error Occurred");
      },
    );
  };

  const toggleFormModal = () => {
    setIsOpenForm((open) => !open);
  };

  const fields = [
    {
      title: "Date",
      custom: true,
      component: (item) => (
        <div className="tabular-nums text-slate-700">
          {moment(item.date).format("YYYY-MM-DD")}
        </div>
      ),
    },
    {
      title: "Transfer ID",
      custom: true,
      component: (item) => (
        <div className="font-medium text-slate-800">{item.transfer_id}</div>
      ),
    },
    {
      title: "From Account",
      custom: true,
      component: (item) => (
        <div className="text-slate-700">
          {formatAccountLabel(item.from_account)}
        </div>
      ),
    },
    {
      title: "To Account",
      custom: true,
      component: (item) => (
        <div className="text-slate-700">
          {formatAccountLabel(item.to_account)}
        </div>
      ),
    },
    {
      title: "Amount (₦)",
      className: "text-right",
      custom: true,
      component: (item) => (
        <div className="text-right tabular-nums text-slate-800">
          {formatNumber1(
            parseInt(item.amount) === 0 ? item.total : item.amount,
          )}
        </div>
      ),
    },
    {
      title: "Status",
      custom: true,
      component: (item) => (
        <Badge
          variant="outline"
          className={`capitalize ${getTransferStatusStyles(item.status)}`}
        >
          {item.status || "—"}
        </Badge>
      ),
    },
    {
      title: "Action",
      className: "text-right",
      custom: true,
      component: (item) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--aa-navy,#0f2744)] text-white shadow-sm hover:opacity-90"
            onClick={() => viewList(item)}
            title="View"
          >
            <Eye className="h-4 w-4" />
          </button>
          {item.status === "returned" ? (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--aa-navy,#0f2744)]/30 bg-white text-[var(--aa-navy,#0f2744)] hover:opacity-90"
              onClick={() =>
                navigate(
                  `/app/account/cash-transfer?id=${item.transfer_id}&mode=edit`,
                )
              }
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const getLogs = useCallback(
    (transferId) => {
      if (!transferId || !activeBusiness?.id) return;
      _fetchApi(
        `/account/get-logs?id=${transferId}&facilityId=${activeBusiness.id}`,
        (data) => {
          if (data.success) {
            const rows = Array.isArray(data.results)
              ? data.results
              : Array.isArray(data.results?.[0])
                ? data.results[0]
                : [];
            setLogs(rows);
          }
        },
        (err) => {
          console.log(err);
        },
      );
    },
    [activeBusiness?.id],
  );

  const filteredCashTransfers = cashTransfers.filter((transfer) => {
    if (!searchTerm) return true;
    const needle = searchTerm.toLowerCase();
    const haystack = [
      transfer.from_account,
      transfer.to_account,
      transfer.transfer_id,
      transfer.created_by,
      transfer.creator?.name,
      transfer.creator?.firstname,
      transfer.creator?.lastname,
      transfer.creator?.email,
      transfer.creator?.username,
      accountNameByCode[String(transfer.from_account || "").trim()],
      accountNameByCode[String(transfer.to_account || "").trim()],
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });

  const refreshList = () => {
    getCashTransfers();
  };

  const previewDescription =
    items?.remarks || items?.purpose || items?.details || "—";

  const previewAmount = Number(items?.amount ?? items?.total ?? 0) || 0;

  const previewCreatorName =
    items?.creator?.name ||
    [items?.creator?.firstname, items?.creator?.lastname]
      .filter(Boolean)
      .join(" ") ||
    items?.creator?.email ||
    items?.creator?.username ||
    "—";

  const renderPreviewDetail = (label, value) => (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="break-words text-sm font-medium text-slate-900">{value}</p>
    </div>
  );

  return (
    <div className="min-h-[70vh] px-3 py-4 sm:px-4 lg:px-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
            <ArrowLeftRight className="h-5 w-5 text-[var(--aa-navy,#0f2744)]" />
            Funds Transfer
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Manage your cash transfers between accounts
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-2 border-0 bg-[var(--aa-navy,#0f2744)] text-white shadow-none hover:opacity-90"
          onClick={toggleFormModal}
        >
          Move cash
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
          <p className="text-sm font-medium text-slate-800">Transfers</p>
          <p className="text-xs text-slate-500">
            {loading
              ? "Loading…"
              : `${filteredCashTransfers.length} transfer${
                  filteredCashTransfers.length === 1 ? "" : "s"
                }`}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50/50 p-4 md:grid-cols-[1fr_12rem]">
          <div className="min-w-0">
            <Label
              htmlFor="transfer-search"
              className="mb-1.5 text-xs font-medium text-slate-600"
            >
              Search
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="transfer-search"
                type="search"
                placeholder="Search by account or transfer ID"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 border-slate-200 bg-white pl-9 text-sm focus-visible:border-[var(--aa-navy,#0f2744)] focus-visible:ring-[var(--aa-navy,#0f2744)]/20"
              />
            </div>
          </div>
          <div>
            <Label
              htmlFor="transfer-status"
              className="mb-1.5 text-xs font-medium text-slate-600"
            >
              Status
            </Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger
                id="transfer-status"
                className="h-9 border-slate-200 bg-white text-sm focus:ring-[var(--aa-navy,#0f2744)]/20"
              >
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="initial">Pending</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="re_list">Audit</SelectItem>
                <SelectItem value="list">Transfer List</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <CustomTable1
          data={filteredCashTransfers}
          fields={fields}
          loading={loading}
          message={message}
          emptyHint="Try another status or clear the search."
        />
      </div>

      <CashFlowForm
        showModal={isOpenForm}
        closeModal={toggleFormModal}
        getList={refreshList}
        onSuccess={refreshList}
      />

      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) closePreview();
        }}
      >
        <SheetContent
          side="right"
          className="!inset-y-0 !right-0 !left-auto flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l border-slate-200 p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:!max-w-xl md:!max-w-2xl [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:bg-white/10 [&>button]:hover:opacity-100"
        >
          <SheetHeader className="shrink-0 space-y-1 border-b border-slate-200 bg-[var(--aa-navy,#0f2744)] px-5 py-4 pr-12 text-left">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md bg-white/10 p-2">
                <ArrowLeftRight className="h-4 w-4 text-white/90" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-lg font-semibold leading-tight text-white">
                  Funds Transfer Preview
                </SheetTitle>
                <SheetDescription className="mt-0.5 text-xs text-white/70">
                  {items?.transfer_id || "—"} ·{" "}
                  {items?.date
                    ? moment(items.date).format("DD MMM YYYY")
                    : "—"}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-5 py-5">
            <div className="rounded-lg bg-[var(--aa-navy,#0f2744)] px-4 py-3 text-white shadow-sm">
              <p className="text-xs uppercase tracking-wider text-white/80">
                {activeBusiness?.business_name || "Business"}
              </p>
              <h3 className="mt-1 text-lg font-semibold">Funds Transfer</h3>
              <p className="mt-1 text-sm text-white/90">
                {items?.transfer_id || "—"} ·{" "}
                {items?.date ? moment(items.date).format("DD MMM YYYY") : "—"}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--aa-navy,#0f2744)]/20 bg-[var(--aa-sidebar-active,#eff4fb)] px-4 py-3">
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">
                  Transfer amount
                </p>
                <p className="text-2xl font-semibold tabular-nums text-[var(--aa-navy,#0f2744)]">
                  ₦{formatNumber1(previewAmount)}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getTransferStatusStyles(
                  items?.status,
                )}`}
              >
                {items?.status || "—"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {renderPreviewDetail("Transfer ID", items?.transfer_id || "—")}
              {renderPreviewDetail(
                "Date",
                items?.date ? moment(items.date).format("YYYY-MM-DD") : "—",
              )}
              {renderPreviewDetail(
                "From account",
                formatAccountLabel(items?.from_account),
              )}
              {renderPreviewDetail(
                "To account",
                formatAccountLabel(items?.to_account),
              )}
              {renderPreviewDetail(
                "Reference",
                items?.reference_number || items?.transfer_id || "—",
              )}
              {renderPreviewDetail("Created by", previewCreatorName)}
            </div>

            <div>
              <Label className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Description / remarks
              </Label>
              <div className="min-h-[4.5rem] whitespace-pre-wrap rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800">
                {previewDescription}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-slate-200 bg-white text-slate-700"
              onClick={closePreview}
            >
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
