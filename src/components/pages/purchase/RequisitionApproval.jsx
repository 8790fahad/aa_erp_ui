/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Col, Input, Label, Row } from "reactstrap";
import { useSelector } from "react-redux";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileText,
  Search,
} from "lucide-react";
import moment from "moment";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import CustomButton from "@/common/Custom/CustomButton";
import CustomModal from "@/common/Custom/CustomModal";
import { Button as UIButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CustomRequisitionModal from "@/common/Custom/CustomRequisitionModal";
import { useNavigate } from "react-router-dom";
import PurchaseOrderNav, {
  usePurchaseOrderPermissions,
} from "./PurchaseOrderNav";
import PurchaseRequisitionAPI from "./purchaseRequisitionApi";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];
const todayDate = () => moment().format("YYYY-MM-DD");

function statusBadgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "pending payment") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "pending") return "bg-sky-100 text-sky-800 border-sky-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}
function RequisitionApproval() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(true);
  const [pr, setPr] = useState([]);
  const [remark, setRemark] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState(todayDate);
  const [toDate, setToDate] = useState(todayDate);
  const [appliedFromDate, setAppliedFromDate] = useState(todayDate);
  const [appliedToDate, setAppliedToDate] = useState(todayDate);
  const appliedDatesRef = useRef({ from: todayDate(), to: todayDate() });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [itemList, setItemList] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading2, setLoading2] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [items2, setItems2] = useState({});
  const [isOpen2, setIsOpen2] = useState(false);
  const navigate = useNavigate();
  const { canApprove, visibleTabs } = usePurchaseOrderPermissions();

  useEffect(() => {
    if (canApprove) return;
    const fallback = visibleTabs[0];
    if (fallback) navigate(fallback.to, { replace: true });
  }, [canApprove, visibleTabs, navigate]);

  const _form = {
    date: moment().format("YYYY-MM-DD"),
    purpose: "",
    from: "",
  };
  const [form, setForm] = useState(_form);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleEdit = () => {
    setLoading2(true);
    // console.log(form)
    _postApi(
      "/account/update-memo",
      {
        ...form,
        logStatus: "approved",
      },
      (res) => {
        if (res.success) {
          toast.success("Successfully Submit");
          setLoading2(false);
          // history.goBack();
        }
      },
      (err) => {
        toast.error("error occured");
        console.log(err);
        setLoading2(false);
      }
    );
  };

  // const getMemos = useCallback(() => {
  //   _fetchApi(
  //     `/account/get-memo/${activeBusiness.id}/pending/${user.id}/review`,
  //     (data) => {
  //       setLoading(false);
  //       if (data.success) {
  //         setMems(data.results);
  //       }
  //     },
  //     (err) => {
  //       setLoading(false);
  //       console.log(err);
  //     }
  //   );
  // }, [activeBusiness.id, user.id]);

  const getPR = useCallback(
    (from, to, pageOverride) => {
      const from_date =
        from !== undefined ? from : appliedDatesRef.current.from;
      const to_date = to !== undefined ? to : appliedDatesRef.current.to;
      const page = pageOverride !== undefined ? pageOverride : currentPage;
      _postApi(
        `/account/get-purchase-requisition`,
        {
          query_type: "select-pending",
          requisitor: user.fullname,
          facilityId: activeBusiness.id,
          from_date: from_date || undefined,
          to_date: to_date || undefined,
          page,
          pageSize,
          search: debouncedSearch || undefined,
        },
        (data) => {
          setLoading(false);
          if (data.success) {
            setPr(data.results || []);
            setTotalCount(
              typeof data.total === "number"
                ? data.total
                : (data.results || []).length,
            );
          }
        },
        (err) => {
          setLoading(false);
          console.log(err);
        },
      );
    },
    [activeBusiness.id, user.fullname, currentPage, pageSize, debouncedSearch],
  );
  const [loading1, setLoading1] = useState(false);

  const returnMemo = () => {
    setLoading1(true);
    _postApi(
      "/account/insert-approved-memo",
      {
        facilityId: activeBusiness.id,
        type: "memo",
        name: user.fullname || user.username,
        role: user.role,
        id_link: items.memo_id,
        user_id: user.id,
        amount: items.amount,
        remark: remark,
        status: "returned",
        review_by: user.fullname || user.username,
        approve_by: "",
        query_type: "review",
        logStatus: "Review",
      },
      (res) => {
        if (res.success) {
          toast.success("Successfully Submit");
          setRemark("");
          setLoading1(false);
          toggle();
          getMemos();
        }
      },
      (err) => {
        toast.error("error occured");
        console.log(err);
        setLoading1(false);
      }
    );
  };

  const approveMemo = (approvedItems = [], remarkText = "") => {
    setLoading1(true);
    const lineItems = (approvedItems.length ? approvedItems : itemList).map(
      (item) => ({
        id: item.id,
        item_code: item.item_code,
        approved_qty: parseFloat(item.approved_qty ?? item.quantity) || 0,
      })
    );

    _postApi(
      `/account/update-purchase-requisition`,
      {
        query_type: "update",
        pr_no: items.pr_no,
        status: "approved",
        facilityId: activeBusiness.id,
        items: lineItems,
        remark: remarkText || remark,
      },
      (data) => {
        setLoading1(false);
        toast.success("Successfully Approved");
        setIsOpen(false);
        getPR();
      },
      (err) => {
        setLoading1(false);
        console.log(err);
        toast.error("Error occurred while approving requisition");
        setIsOpen(false);
      }
    );
  };

  useEffect(() => {
    getPR();
  }, [getPR]);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState({});
  const [attachments, setAttachments] = useState([]);
  const toggle = (item) => {
    setItems(item);
    setIsOpen(!isOpen);
  };
  const toggle2 = (item) => {
    setItems2(item);
    setForm((p) => ({
      ...p,
      purpose: item.purpose,
      from: item.from_name,
      busName: item.from_name,
      memo_id: item.memo_id,
    }));
    setIsOpen2(!isOpen2);
  };
  const cancel = () => {
    setItems({});
    setAttachments([]);
    setIsOpen(!isOpen);
  };

  const getLogs = useCallback((memoId) => {
    if (!memoId) return;
    _fetchApi(
      `/account/get-logs?id=${memoId}&facilityId=${activeBusiness.id}`,
      (data) => {
        setLoading2(false);
        if (data.success) {
          setLogs(data.results[0]);
        }
      },
      (err) => {
        setLoading2(false);
        console.log(err);
      }
    );
  }, []);

  const viewList = (item) => {
    toggle(item);
    setAttachments([]);
    getLogs(item.memo_id);
    _postApi(
      "/account/purchase/getPr",
      {
        query_type: "select-exp",
        pr_no: item.pr_no,
        facilityId: activeBusiness.id,
      },
      (res) => {
        if (res.success) {
          setItemList(res.results);
        }
      },
      (err) => {
        toast.error("Error Occurred");
      }
    );
    if (activeBusiness?.id && item?.pr_no) {
      PurchaseRequisitionAPI.getPurchaseOrderDocuments(activeBusiness.id, {
        pr_no: item.pr_no,
        po_no: item.po_no,
      })
        .then((res) => setAttachments(res.data || []))
        .catch(() => setAttachments([]));
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const pendingCount = totalCount;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, appliedFromDate, appliedToDate]);

  const showingFrom =
    totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingTo = Math.min(safePage * pageSize, totalCount);
  const hasActiveFilters = Boolean(
    searchTerm.trim() || appliedFromDate || appliedToDate,
  );

  const runDateFilter = () => {
    appliedDatesRef.current = { from: fromDate, to: toDate };
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    setCurrentPage(1);
    getPR(fromDate, toDate, 1);
  };

  const resetDates = () => {
    const day = todayDate();
    appliedDatesRef.current = { from: day, to: day };
    setFromDate(day);
    setToDate(day);
    setAppliedFromDate(day);
    setAppliedToDate(day);
    setCurrentPage(1);
    getPR(day, day, 1);
  };

  const renderSkeletonFrame = () => (
    <div className="h-fit w-full">
      <div className="mx-auto h-fit max-w-7xl">
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-2 h-3 w-72" />
          </div>
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return renderSkeletonFrame();
  }

  return (
    <>
      <div className="h-fit w-full">
        <div className="mx-auto h-fit max-w-7xl">
          <div className="h-fit overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
                  <ClipboardList className="h-5 w-5 text-[var(--aa-accent)]" />
                  Goods received
                </h1>
                <p className="mt-0.5 text-xs text-slate-500">
                  Review and approve pending purchase requisitions
                  {pendingCount ? ` · ${pendingCount} waiting` : ""}
                </p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search warehouse, PR, supplier…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 w-56 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                />
              </div>
            </div>

            <PurchaseOrderNav />

            <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-2.5">
              <div>
                <label
                  htmlFor="approval-from-date"
                  className="mb-1 block text-[11px] font-medium text-slate-500"
                >
                  From
                </label>
                <input
                  id="approval-from-date"
                  type="date"
                  title="yyyy/mm/dd"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runDateFilter();
                  }}
                  className="h-9 w-[9.5rem] rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                />
              </div>
              <div>
                <label
                  htmlFor="approval-to-date"
                  className="mb-1 block text-[11px] font-medium text-slate-500"
                >
                  To
                </label>
                <input
                  id="approval-to-date"
                  type="date"
                  title="yyyy/mm/dd"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) => setToDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runDateFilter();
                  }}
                  className="h-9 w-[9.5rem] rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                />
              </div>
              <UIButton
                type="button"
                size="sm"
                onClick={runDateFilter}
                className="h-9 border-0 bg-[var(--aa-navy)] px-4 text-white hover:bg-[var(--aa-navy)]/90"
              >
                Run
              </UIButton>
              {(fromDate || toDate || appliedFromDate || appliedToDate) && (
                <UIButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2 text-xs text-slate-500"
                  onClick={resetDates}
                >
                  Reset dates
                </UIButton>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">PR No.</th>
                    <th className="px-4 py-2.5 font-medium">Subject</th>
                    <th className="px-4 py-2.5 font-medium">Supplier</th>
                    <th className="px-4 py-2.5 font-medium">Warehouse</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pr.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-16 text-center text-slate-500"
                      >
                        <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                        <p className="text-sm font-medium text-slate-600">
                          {hasActiveFilters
                            ? "No requisitions match these filters"
                            : "No pending requisitions to approve"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {hasActiveFilters
                            ? "Try a different date range or status"
                            : "New goods received will appear here for review"}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    pr.map((row) => (
                      <tr
                        key={row.pr_no}
                        className="border-b border-slate-100/80 bg-white hover:bg-slate-50/60"
                      >
                        <td className="whitespace-nowrap bg-white px-4 py-2.5 tabular-nums text-slate-600">
                          {row.date
                            ? moment(row.date).format("DD MMM YYYY")
                            : "—"}
                        </td>
                        <td className="bg-white px-4 py-2.5 font-mono text-[13px] font-semibold text-slate-800">
                          {row.pr_no}
                        </td>
                        <td className="max-w-[220px] truncate bg-white px-4 py-2.5 text-slate-700">
                          {row.reason || "—"}
                        </td>
                        <td className="bg-white px-4 py-2.5 text-slate-700">
                          {row.supplier_name || "—"}
                        </td>
                        <td className="bg-white px-4 py-2.5 text-slate-700">
                          {row.branch || "—"}
                        </td>
                        <td className="bg-white px-4 py-2.5">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                              row.status,
                            )}`}
                          >
                            {row.status || "—"}
                          </span>
                        </td>
                        <td className="bg-white px-4 py-2.5 text-right">
                          <UIButton
                            variant="ghost"
                            size="sm"
                            onClick={() => viewList(row)}
                            className="h-8 px-2 text-sm font-medium text-[var(--aa-accent)] hover:bg-slate-100 hover:text-[var(--aa-navy)]"
                          >
                            {String(row.status || "").toLowerCase() ===
                            "pending"
                              ? "Review"
                              : "View"}
                          </UIButton>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/40 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Showing{" "}
                <span className="font-medium text-slate-700">
                  {showingFrom}–{showingTo}
                </span>{" "}
                of{" "}
                <span className="font-medium text-slate-700">
                  {totalCount}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Rows</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      setPageSize(Number(v));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[72px] border-slate-200 bg-white text-xs shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <UIButton
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 border-slate-200 p-0"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(1)}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </UIButton>
                  <UIButton
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 border-slate-200 p-0"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </UIButton>
                  <span className="min-w-[4.5rem] text-center text-xs text-slate-600">
                    {safePage} / {totalPages}
                  </span>
                  <UIButton
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 border-slate-200 p-0"
                    disabled={safePage >= totalPages}
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </UIButton>
                  <UIButton
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 border-slate-200 p-0"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </UIButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

        <CustomModal isOpen={isOpen2} toggle={toggle2} header="Review rejected">
          <Row>
            <Col md={6}>
              <Label>From</Label>
              <Input
                type="text"
                name="from"
                value={items2?.from_name}
                disabled={true}
              />
            </Col>
            <Col md={6}>
              <Label>Date</Label>
              <Input
                type="date"
                name="date"
                value={moment().format(form.date)}
                disabled={true}
              />
            </Col>
            <Col md={12}>
              <Label>Purpose</Label>
              <Input
                onChange={handleChange}
                name="purpose"
                value={form.purpose}
                type="textarea"
              />
            </Col>
            {/* <Col md={12} className="mt-3">
            <div>
              <CustomButton
                onClick={() => toggleCollapse(items2?.memo_id)}
                className="mb-2"
              >
                {isOpen3 ? "Hide" : "Show"} memo log
              </CustomButton>
              <Collapse isOpen={isOpen3}>
                <CustomCard>
                  <CustomTable
                    data={logs}
                    fields={tableFields}
                    className="mb-0"
                  />
                </CustomCard>
              </Collapse>
            </div>
          </Col> */}
            {/* {JSON.stringify(items2)} */}
          </Row>
          <center>
            <CustomButton
              loading={loading2}
              className="mt-3"
              onClick={handleEdit}
            >
              Submit
            </CustomButton>
          </center>
        </CustomModal>

      <CustomRequisitionModal
        isOpen={isOpen}
        toggle={toggle}
        header="Requisition approval"
        itemList={itemList}
        items={items}
        activeBusiness={activeBusiness}
        cancel={cancel}
        returnMemo={returnMemo}
        approveMemo={approveMemo}
        loading1={loading1}
        remark={remark}
        setRemark={setRemark}
        logs={logs}
        mode="review"
        loading2={loading2}
        attachments={attachments}
      />
    </>
  );
}

export default RequisitionApproval;
