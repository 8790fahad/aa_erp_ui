/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Col, Collapse, Label, Row } from "reactstrap";
import { useSelector } from "react-redux";
import { FaEdit, FaEye } from "react-icons/fa";
import moment from "moment";
import { _fetchApi, _postApi, apiURL } from "@/redux/actions/api";
import { toast } from "sonner";
import CustomButton from "@/common/Custom/CustomButton";
import { useLocation, useNavigate } from "react-router-dom";
import CustomTable from "@/common/Custom/CustomTable";
import CustomModal from "@/common/Custom/CustomModal";
import Loading from "@/common/Custom/Loading";
import CustomCard from "@/common/Custom/CustomCard2";
import { formatNumber1 } from "@/components/router/utilities";
import { cloudinaryDocumentHref } from "@/utils/cloudinaryDocuments";
import CustomMemoModal from "@/common/Custom/CustomMemoModal";
import { Input } from "antd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CustomTable1 from "@/common/Custom/CustomTable1";
import MemoNav from "./MemoNav";
import MemoFormModal from "./MemoFormModal";
import { FileText } from "lucide-react";

function MemoList() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const { user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [memos, setMemos] = useState([]);
  const [files, setFiles] = useState([]);
  const [items, setItems] = useState({});
  const [items2, setItems2] = useState({});
  const [isOpen, setIsOpen] = useState(false);
  const [isOpen2, setIsOpen2] = useState(false);
  const [isOpen3, setIsOpen3] = useState(false);
  const [selectedMemoId, setSelectedMemoId] = useState(null);
  const [message, setMessage] = useState("No Memo Found");
  const [searchTerm, setSearchTerm] = useState("");
  const [logs, setLogs] = useState([]);
  const [itemList, setItemList] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all"); // all | pending | reviewed | re_list | approved
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editMemoId, setEditMemoId] = useState(null);
  const history = useNavigate();
  const location = useLocation();
  const isHistory = new URLSearchParams(location.search).get("tab") === "history";

  // Map filter to API (status, query_type). Backend expects memo status + query_type.
  const getApiParams = useCallback(() => {
    if (isHistory) {
      return { status: "all", query_type: "list" };
    }
    switch (statusFilter) {
      case "pending":
        return { status: "pending", query_type: "list" };
      case "reviewed":
        return { status: "reviewed", query_type: "list" };
      case "re_list":
        return { status: "reviewed", query_type: "re_list" };
      case "approved":
        return { status: "approved", query_type: "list" };
      case "closed":
        return { status: "closed", query_type: "list" };
      default:
        return { status: "all", query_type: "list" };
    }
  }, [statusFilter, isHistory]);

  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateRange, setDateRange] = useState("all"); // all | today | this_month | last_month | this_year | custom

  const toggleCollapse = (memoId) => {
    setSelectedMemoId(memoId);
    setIsOpen3(!isOpen3);
    getLogs(memoId);
  };

  const _form = {
    date: moment().format("YYYY-MM-DD"),
    purpose: "",
    from: "",
  };
  const [form, setForm] = useState(_form);

  const getMemos = useCallback(() => {
    setLoading(true);
    const { status: apiStatus, query_type: apiQueryType } = getApiParams();
    _fetchApi(
      `/account/get-memo/${activeBusiness.id}/${apiStatus}/${user.id}/${apiQueryType}`,
      (data) => {
        setLoading(false);
        if (data.success && data.results.length > 0) {
          setMemos(data.results);
        } else {
          setMemos([]);
          setMessage(`No Memo found for selected status`);
        }
      },
      (err) => {
        setLoading(false);
        console.log(err);
      }
    );
  }, [activeBusiness.id, user.id, getApiParams]);

  // Initialize filters & pagination from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get("status");
    const searchParam = params.get("search");
    const rangeParam = params.get("dateRange");
    const fromParam = params.get("dateFrom");
    const toParam = params.get("dateTo");
    const limitParam = parseInt(params.get("limit"), 10);
    const pageParam = parseInt(params.get("page"), 10);

    if (statusParam) {
      setStatusFilter(statusParam);
    }
    if (typeof searchParam === "string") {
      setSearchTerm(searchParam);
    }
    if (rangeParam) {
      setDateRange(rangeParam);
    }
    if (typeof fromParam === "string") {
      setDateFrom(fromParam);
    }
    if (typeof toParam === "string") {
      setDateTo(toParam);
    }
    if (!isNaN(limitParam) && limitParam > 0) {
      setLimit(limitParam);
    }
    if (!isNaN(pageParam) && pageParam > 0) {
      setPage(pageParam);
    }
  }, [location.search]);

  useEffect(() => {
    getMemos();
  }, [getMemos]);

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleEdit = () => {
    setLoading2(true);
    _postApi(
      "/account/update-memo",
      {
        ...form,
        logStatus: "approved",
      },
      (res) => {
        if (res.success) {
          toast.success("Successfully Submitted");
          setLoading2(false);
          history.goBack();
        }
      },
      (err) => {
        toast.error("Error Occurred");
        console.log(err);
        setLoading2(false);
      }
    );
  };

  const toggle = (item) => {
    setItems(item);
    setIsOpen(!isOpen);
  };

  const toggle2 = (item) => {
    history(`/app/account/edit-memo?memo_id=${item.memo_id}`);
  };

  const viewList = (item) => {
    toggle(item);
    getLogs(item.memo_id);
    _postApi(
      "/account/memo-item-list",
      {
        query_type: "select",
        memo_id: item.memo_id,
        date: moment().format("YYYY-MM-DD"),
        user_id: user.id,
        facilityId: activeBusiness.id,
      },
      (res) => {
        if (res.success) {
          setItemList(res.results || []);
          const serverFiles = (res.attachments || []).map((doc) => ({
            name: doc.original_name,
            type: doc.mime_type,
            size: doc.file_size,
            preview: cloudinaryDocumentHref(doc),
            fromServer: true,
          }));
          setFiles(serverFiles);
        } else {
          toast.error(res.message || "Could not load memo items");
        }
      },
      (err) => {
        toast.error(err?.message || "Error Occurred");
      }
    );
  };

  const cancel = () => {
    setItems({});
    setIsOpen(!isOpen);
  };

  const fields = [
    {
      title: "Date",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-center">{moment(item.date).format("YYYY-MM-DD")}</div>
      ),
    },
    {
      title: "Memo No.",
      custom: true,
      // className: "text-left",
      component: (item) => <div className="text-center">{item.memo_id}</div>,
    },
    {
      title: "Subject",
      custom: true,
      className: "text-left",
      component: (item) => <div className="text-left">{item.subject}</div>,
    },
    // {
    //   title: "Remarks",
    //   custom: true,
    //   component: (item) => (
    //     <div className="text-left">
    //       {item.last_return_remark
    //         ? item.last_return_remark.length > 30
    //           ? `${item.last_return_remark.substring(0, 30)}...`
    //           : item.last_return_remark
    //         : ""}
    //     </div>
    //   ),
    // },
    {
      title: "Amount (₦)",
      custom: true,
      component: (item) => (
        <div className="text-center">
          {formatNumber1(
            parseInt(item.amount) === 0 ? item.total : item.amount
          )}
        </div>
      ),
    },
    {
      title: "Status",
      custom: true,
      component: (item) => {
        const statusClass =
          item.status === "pending"
            ? "bg-[var(--aa-navy,#0f2744)] text-white"
            : item.status === "returned"
              ? "bg-red-600 text-white"
              : item.status === "approved"
                ? "bg-emerald-600 text-white"
                : item.status === "reviewed"
                  ? "bg-amber-500 text-white"
                  : "bg-slate-500 text-white";
        return (
          <div className="text-center">
            <span
              className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium capitalize ${statusClass}`}
            >
              {item.status}
            </span>
          </div>
        );
      },
    },
    {
      title: "Action",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <button
            type="button"
            className="m-1 inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--aa-navy,#0f2744)] text-white hover:bg-[var(--aa-navy-hover,#243a73)]"
            onClick={() => viewList(item)}
            aria-label="View memo"
          >
            <FaEye size={16} />
          </button>
          {item.status === "returned" ? (
            <button
              type="button"
              className="m-1 ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--aa-navy,#0f2744)] text-white hover:bg-[var(--aa-navy-hover,#243a73)]"
              onClick={() => {
                setEditMemoId(item.memo_id);
                setFormModalOpen(true);
              }}
              aria-label="Edit memo"
            >
              <FaEdit size={16} />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const tableFields = [
    {
      title: "Name",
      custom: true,
      component: (item) => <div className="text-left">{item.name}</div>,
    },
    {
      title: "Ref. Number",
      custom: true,
      component: (item) => <div className="text-center">{item.id_link}</div>,
    },
    {
      title: "Remark",
      custom: true,
      component: (item) => <>{item.remark}</>,
    },
  ];

  const getLogs = useCallback(
    (memoId) => {
      if (!memoId) return;
      _fetchApi(
        `/account/get-logs?id=${memoId}&facilityId=${activeBusiness.id}`,
        (data) => {
          setLoading(false);
          if (data.success) {
            setLogs(data.results[0]);
          }
        },
        (err) => {
          setLoading(false);
          console.log(err);
        }
      );
    },
    [activeBusiness.id]
  );

  // Search + date filter
  const filteredMemos = memos.filter((memo) => {
    const matchesSearch = searchTerm
      ? memo.from_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memo.memo_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memo.raise_by.toLowerCase().includes(searchTerm.toLowerCase())
      : true;

    const memoDate = memo.date ? moment(memo.date).startOf("day") : null;
    const fromOk = dateFrom
      ? memoDate
        ? memoDate.isSameOrAfter(moment(dateFrom).startOf("day"))
        : false
      : true;
    const toOk = dateTo
      ? memoDate
        ? memoDate.isSameOrBefore(moment(dateTo).endOf("day"))
        : false
      : true;

    return matchesSearch && fromOk && toOk;
  });

  useEffect(() => {
    getLogs();
  }, [getLogs]);

  // Helper to sync filters & pagination to URL
  const updateUrl = (overrides = {}) => {
    const params = new URLSearchParams(location.search);
    const state = {
      tab: isHistory ? "history" : undefined,
      status: statusFilter,
      search: searchTerm,
      dateRange,
      dateFrom,
      dateTo,
      limit,
      page,
      ...overrides,
    };

    Object.entries(state).forEach(([key, value]) => {
      if (
        value === undefined ||
        value === null ||
        value === "" ||
        (key === "dateRange" && value === "all")
      ) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    history({ pathname: location.pathname, search: params.toString() });
  };

  const handleDateRangeChange = (value) => {
    setDateRange(value);

    let from = dateFrom;
    let to = dateTo;
    const today = moment();

    if (value === "all") {
      from = "";
      to = "";
    } else if (value === "today") {
      from = today.format("YYYY-MM-DD");
      to = from;
    } else if (value === "this_month") {
      from = today.clone().startOf("month").format("YYYY-MM-DD");
      to = today.clone().endOf("month").format("YYYY-MM-DD");
    } else if (value === "last_month") {
      const lastMonth = today.clone().subtract(1, "month");
      from = lastMonth.startOf("month").format("YYYY-MM-DD");
      to = lastMonth.endOf("month").format("YYYY-MM-DD");
    } else if (value === "this_year") {
      from = today.clone().startOf("year").format("YYYY-MM-DD");
      to = today.clone().endOf("year").format("YYYY-MM-DD");
    }

    // For non-custom ranges, update dates immediately
    if (value !== "custom") {
      setDateFrom(from);
      setDateTo(to);
      updateUrl({
        dateRange: value,
        dateFrom: from,
        dateTo: to,
      });
    } else {
      // Custom range: just update range & keep current dates
      updateUrl({
        dateRange: value,
        dateFrom,
        dateTo,
      });
    }
  };

  return (
    <div className="h-fit w-full">
      <div className="mx-auto h-fit max-w-7xl">
        <div className="h-fit overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
                <FileText className="h-5 w-5 text-[var(--aa-navy,#0f2744)]" />
                Initiate Memo
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                {isHistory
                  ? "Past memos and approval history"
                  : "Create and track memos pending approval"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isHistory && (
                <button
                  type="button"
                  className="inline-flex h-9 items-center rounded-md bg-[var(--aa-navy,#0f2744)] px-3 text-sm font-semibold text-white hover:bg-[var(--aa-navy-hover,#243a73)]"
                  onClick={() => {
                    setEditMemoId(null);
                    setFormModalOpen(true);
                  }}
                >
                  Add new memo
                </button>
              )}
            </div>
          </div>

          <MemoNav />

          <div className="p-4">
            <div className="flex gap-2 sm:flex-row flex-col align-items-center mb-3">
              <div className="w-full md:w-2/3">
                <Input.Search
                  placeholder="Search by warehouse name or memo ID"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    updateUrl({ search: e.target.value });
                  }}
                />
              </div>
              {!isHistory && (
                <div className="w-full sm:w-1/5">
                  <Select
                    className="w-full"
                    value={statusFilter}
                    onValueChange={(val) => {
                      setStatusFilter(val);
                      updateUrl({ status: val });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="reviewed">Review</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="w-full sm:w-1/5 flex gap-2">
                <Select
                  className="w-full"
                  value={dateRange}
                  onValueChange={handleDateRangeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All dates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All dates</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="this_month">This month</SelectItem>
                    <SelectItem value="last_month">Last month</SelectItem>
                    <SelectItem value="this_year">This year</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {dateRange === "custom" && (
                <div className="w-full sm:w-1/3 flex gap-2 mt-2 sm:mt-0">
                  <input
                    type="date"
                    className="form-control"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      updateUrl({
                        dateRange,
                        dateFrom: e.target.value,
                        dateTo,
                      });
                    }}
                  />
                  <input
                    type="date"
                    className="form-control"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      updateUrl({
                        dateRange,
                        dateFrom,
                        dateTo: e.target.value,
                      });
                    }}
                  />
                </div>
              )}
            </div>

            <Row className="mx-0 my-2">
              {loading && <Loading />}
              {!loading && (
                <>
                  <CustomTable1
                    data={filteredMemos}
                    fields={fields}
                    message={
                      isHistory ? "No memo history found" : message
                    }
                    pageSize={limit}
                    initialPageIndex={Math.max(page - 1, 0)}
                    onPageSizeChange={(newSize) => {
                      setLimit(newSize);
                      setPage(1);
                      updateUrl({ limit: newSize, page: 1 });
                    }}
                    onPageChange={(newPage) => {
                      setPage(newPage);
                      updateUrl({ page: newPage });
                    }}
                  />
                </>
              )}
            </Row>
          </div>
        </div>
      </div>

      <CustomMemoModal
        isOpen={isOpen}
        toggle={toggle}
        header="Preview"
        itemList={itemList}
        items={items}
        files={files}
        activeBusiness={activeBusiness}
        logs={logs}
        cancel={cancel}
        mode="preview"
      />

      <MemoFormModal
        open={formModalOpen}
        onOpenChange={(next) => {
          setFormModalOpen(next);
          if (!next) setEditMemoId(null);
        }}
        memoId={editMemoId}
        onSuccess={() => {
          getMemos();
        }}
      />

      <CustomModal
        isOpen={isOpen2}
        toggle={toggle2}
        header="Review returned memo"
      >
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
    </div>
  );
}

export default MemoList;
