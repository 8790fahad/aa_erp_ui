import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import moment from "moment";
import * as XLSX from "xlsx";
import { Search, MessageSquare, Tag, Download } from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useCrmFacilityId,
  formatNaira,
  CRM_STATUSES,
  statusBadgeClass,
} from "./CrmLayout";

export default function CrmCustomers() {
  const facilityId = useCrmFacilityId();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState([]);
  const [segments, setSegments] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSegment, setBulkSegment] = useState("");
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [search, setSearch] = useState(params.get("q") || "");
  const status = params.get("status") || "";
  const segment = params.get("segment") || "";

  const query = useMemo(() => {
    const q = new URLSearchParams({ facilityId: facilityId || "", limit: "100" });
    if (search.trim()) q.set("search", search.trim());
    if (status) q.set("crm_status", status);
    if (segment) q.set("segment_key", segment);
    return q.toString();
  }, [facilityId, search, status, segment]);

  const load = useCallback(() => {
    if (!facilityId) return;
    setLoading(true);
    _fetchApi(
      `/api/v1/crm/customers?${query}`,
      (res) => {
        setRows(res?.results || []);
        setTotal(res?.total || 0);
        setLoading(false);
      },
      (err) => {
        toast.error(err?.error || "Failed to load customers");
        setLoading(false);
      },
    );
  }, [facilityId, query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!facilityId) return;
    _fetchApi(
      `/api/v1/crm/segments?facilityId=${facilityId}`,
      (res) => setSegments(res?.results || []),
      () => {},
    );
  }, [facilityId]);

  const toggleAll = (checked) => {
    setSelected(checked ? rows.map((r) => r.customer_no) : []);
  };

  const toggleOne = (no) => {
    setSelected((prev) =>
      prev.includes(no) ? prev.filter((x) => x !== no) : [...prev, no],
    );
  };

  const downloadCustomers = () => {
    const source = selected.length
      ? rows.filter((r) => selected.includes(r.customer_no))
      : rows;
    if (!source.length) {
      toast.error("No customers to download");
      return;
    }

    const segmentNameByKey = Object.fromEntries(
      (segments || []).map((s) => [s.segment_key, s.name || s.segment_key]),
    );

    const data = source.map((r) => ({
      "Customer No": r.customer_no || "",
      "Customer Name": r.customer_name || "",
      Phone: r.mobile || r.phone || "",
      Email: r.email || "",
      Status: r.crm_status || "",
      Segment: segmentNameByKey[r.segment_key] || r.segment_key || "",
      "Total Sales": Number(r.total_sales) || 0,
      Outstanding: Number(r.outstanding) || 0,
      "Last Purchase": r.last_purchase
        ? moment(r.last_purchase).format("YYYY-MM-DD")
        : "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 14 },
      { wch: 28 },
      { wch: 16 },
      { wch: 24 },
      { wch: 12 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    const stamp = moment().format("YYYY-MM-DD");
    XLSX.writeFile(wb, `crm-customers-${stamp}.xlsx`);
    toast.success(
      `Downloaded ${source.length} customer${source.length === 1 ? "" : "s"}`,
    );
  };

  const applySegment = () => {
    if (!selected.length || !bulkSegment) {
      toast.error("Select customers and a segment");
      return;
    }
    _postApi(
      `/api/v1/crm/customers/bulk-meta`,
      { facilityId, customerNos: selected, segment_key: bulkSegment },
      () => {
        toast.success("Segment assigned");
        setBulkOpen(false);
        setSelected([]);
        load();
      },
      (err) => toast.error(err?.error || "Failed"),
    );
  };

  const sendSms = () => {
    if (!selected.length || !smsMessage.trim()) {
      toast.error("Select customers and enter a message");
      return;
    }
    _postApi(
      `/api/v1/crm/sms/send`,
      {
        facilityId,
        customerNos: selected,
        message: smsMessage,
      },
      (res) => {
        toast.success(`Sent ${res?.sent || 0}, failed ${res?.failed || 0}`);
        setSmsOpen(false);
        setSmsMessage("");
        setSelected([]);
      },
      (err) => toast.error(err?.error || "SMS failed"),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-8"
              placeholder="Search name, phone, customer no…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const next = new URLSearchParams(params);
                  if (search.trim()) next.set("q", search.trim());
                  else next.delete("q");
                  setParams(next);
                }
              }}
            />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-white px-3 text-sm"
            value={status}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set("status", e.target.value);
              else next.delete("status");
              setParams(next);
            }}
          >
            <option value="">All statuses</option>
            {CRM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-white px-3 text-sm"
            value={segment}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set("segment", e.target.value);
              else next.delete("segment");
              setParams(next);
            }}
          >
            <option value="">All segments</option>
            {segments.map((s) => (
              <option key={s.segment_key} value={s.segment_key}>
                {s.name}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={load}>
            Search
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || (!rows.length && !selected.length)}
            onClick={downloadCustomers}
            title={
              selected.length
                ? `Download ${selected.length} selected`
                : "Download filtered customer list"
            }
          >
            <Download className="mr-1.5 h-4 w-4" />
            Download
            {selected.length ? ` (${selected.length})` : ""}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!selected.length}
            onClick={() => setBulkOpen(true)}
          >
            <Tag className="mr-1.5 h-4 w-4" />
            Assign segment
          </Button>
          <Button
            size="sm"
            className="bg-[#1a2d5e] hover:bg-[#15254d]"
            disabled={!selected.length}
            onClick={() => setSmsOpen(true)}
          >
            <MessageSquare className="mr-1.5 h-4 w-4" />
            Send SMS
          </Button>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        {total} customers · {selected.length} selected
      </p>

      <div className="overflow-hidden rounded-xl border border-[#1a2d5e]/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#1a2d5e]/5 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={
                      rows.length > 0 && selected.length === rows.length
                    }
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Segment</th>
                <th className="px-3 py-2 font-medium text-right">Sales</th>
                <th className="px-3 py-2 font-medium text-right">Outstanding</th>
                <th className="px-3 py-2 font-medium">Last purchase</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-3 py-3">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                : rows.map((r) => (
                    <tr
                      key={r.customer_no}
                      className="border-t border-slate-100 hover:bg-slate-50/80"
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.includes(r.customer_no)}
                          onChange={() => toggleOne(r.customer_no)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          to={`/app/crm/customers/${encodeURIComponent(r.customer_no)}`}
                          className="font-medium text-[#1a2d5e] hover:underline"
                        >
                          {r.customer_name}
                        </Link>
                        <div className="text-xs text-slate-400">
                          {r.customer_no}
                          {r.phone || r.mobile
                            ? ` · ${r.mobile || r.phone}`
                            : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(r.crm_status)}`}
                        >
                          {r.crm_status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {r.segment_key || "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatNaira(r.total_sales)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatNaira(r.outstanding)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {r.last_purchase
                          ? moment(r.last_purchase).format("DD MMM YYYY")
                          : "—"}
                      </td>
                    </tr>
                  ))}
              {!loading && !rows.length ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-10 text-center text-slate-500"
                  >
                    No customers match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={bulkOpen} onOpenChange={setBulkOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Assign segment</SheetTitle>
            <SheetDescription>
              Apply a segment to {selected.length} selected customers.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={bulkSegment}
              onChange={(e) => setBulkSegment(e.target.value)}
            >
              <option value="">Select segment</option>
              {segments.map((s) => (
                <option key={s.segment_key} value={s.segment_key}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button className="w-full bg-[#1a2d5e]" onClick={applySegment}>
              Assign
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={smsOpen} onOpenChange={setSmsOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Send SMS</SheetTitle>
            <SheetDescription>
              Message {selected.length} customers. Use {"{{customer_name}}"} for
              personalization.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <textarea
              className="min-h-[140px] w-full rounded-md border p-3 text-sm"
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              placeholder="Hello {{customer_name}}, …"
            />
            <Button className="w-full bg-[#1a2d5e]" onClick={sendSms}>
              Send now
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
