import { useCallback, useEffect, useState } from "react";
import { Badge, Col, Label, Row } from "reactstrap";
import { useSelector } from "react-redux";
import { FaEdit, FaEye } from "react-icons/fa";
import moment from "moment";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import CustomButton from "@/common/Custom/CustomButton";
import { useNavigate } from "react-router-dom";
import CustomModal from "@/common/Custom/CustomModal";
import Loading from "@/common/Custom/Loading";
import { formatNumber1 } from "@/components/router/utilities";
import { Input } from "antd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CustomTable1 from "@/common/Custom/CustomTable1";
import CashFlowForm from "./CashFlowForm";

const getTransferStatusStyles = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "pending" || normalized === "initial") {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }
  if (normalized === "returned" || normalized === "re_list") {
    return "bg-red-100 text-red-800 border-red-200";
  }
  if (
    normalized === "approved" ||
    normalized === "completed" ||
    normalized === "list"
  ) {
    return "bg-green-100 text-green-800 border-green-200";
  }
  if (normalized === "reviewed" || normalized === "review") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-gray-100 text-gray-800 border-gray-200";
};

export default function CashFlowList() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const { user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [cashTransfers, setCashTransfers] = useState([]);
  const [items, setItems] = useState({});
  const [items2] = useState({});
  const [isOpen, setIsOpen] = useState(false);
  const [isOpen2] = useState(false);
  const [isOpenForm, setIsOpenForm] = useState(false); // State for CashFlowForm modal
  const [message, setMessage] = useState("No Cash Transfers Found");
  const [searchTerm, setSearchTerm] = useState("");
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("all");
  const [accountNameByCode, setAccountNameByCode] = useState({});
  const navigate = useNavigate();

  const _form = {
    date: moment().format("YYYY-MM-DD"),
    purpose: "",
    from: "",
  };
  const [form, setForm] = useState(_form);

  // Fetch cash transfers
  const getCashTransfers = useCallback(() => {
    setLoading(true);
    _fetchApi(
      `/get-cash-transfers/${activeBusiness.id}/${status}/${user.id}/list`,
      (data) => {
        setLoading(false);
        if (data.success && data.results.length > 0) {
          setCashTransfers(data.results);
        } else {
          setCashTransfers([]);
          setMessage(`No Cash Transfers found for ${status}`);
        }
      },
      (err) => {
        setLoading(false);
        console.log(err);
      }
    );
  }, [activeBusiness.id, user.id, status]);

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
          const code = String(acc?.account_code || acc?.head || acc?.code || "").trim();
          if (!code) return;
          lookup[code] = acc?.description || acc?.account_description || code;
        });
        setAccountNameByCode(lookup);
      },
      () => {}
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
    [accountNameByCode]
  );

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleEdit = () => {
    setLoading2(true);
    _postApi(
      "/account/update-cash-transfer",
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

  const closePreview = () => {
    setItems({});
    setLogs([]);
    setIsOpen(false);
  };

  const toggle2 = (item) => {
    navigate(`/app/account/edit-cash-transfer?transfer_id=${item.transfer_id}`);
  };

  const viewList = (item) => {
    setItems(item);
    setIsOpen(true);
    getLogs(item.transfer_id);
    _postApi(
      "/cash-transfer-item-list",
      {
        query_type: "select",
        transfer_id: item.transfer_id,
        date: moment().format("YYYY-MM-DD"),
        user_id: user.id,
      },
      (res) => {
        if (res.success) {
          // no-op: preview now uses transfer payload + logs directly
        }
      },
      () => {
        toast.error("Error Occurred");
      }
    );
  };

  const toggleFormModal = () => {
    setIsOpenForm(!isOpenForm);
  };

  // Fields for the cash flow table
  const fields = [
    {
      title: "Date",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-end">{moment(item.date).format("YYYY-MM-DD")}</div>
      ),
    },
    {
      title: "Transfer ID",
      custom: true,
      component: (item) => <div className="text-center">{item.transfer_id}</div>,
    },
    {
      title: "From Account",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-left">{formatAccountLabel(item.from_account)}</div>
      ),
    },
    {
      title: "To Account",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-left">{formatAccountLabel(item.to_account)}</div>
      ),
    },
    {
      title: "Amount (₦)",
      custom: true,
      component: (item) => (
        <div className="text-right">
          {formatNumber1(parseInt(item.amount) === 0 ? item.total : item.amount)}
        </div>
      ),
    },
    {
      title: "Status",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <Badge
            color={
              item.status === "pending"
                ? "primary"
                : item.status === "returned"
                ? "danger"
                : item.status === "approved"
                ? "success"
                : item.status === "reviewed"
                ? "warning"
                : "secondary"
            }
            className="p-2"
          >
            {item.status}
          </Badge>
        </div>
      ),
    },
    {
      title: "Action",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <CustomButton
            color="success"
            size={"sm"}
            className="m-1"
            handleSubmit={() => {
              viewList(item);
            }}
          >
            <FaEye size="20" />
          </CustomButton>
          {item.status === "returned" ? (
            <CustomButton
              color="success"
              size={"sm"}
              className="m-1 ml-2"
              onClick={() => {
                navigate(`/app/account/cash-transfer?id=${item.transfer_id}&mode=edit`);
              }}
            >
              <FaEdit size="20" />
            </CustomButton>
          ) : null}
        </div>
      ),
    },
  ];

  const getLogs = useCallback((transferId) => {
    if (!transferId) return;
    _fetchApi(
      `/account/get-logs?id=${transferId}&facilityId=${activeBusiness.id}`,
      (data) => {
        setLoading(false);
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
        setLoading(false);
        console.log(err);
      }
    );
  }, [activeBusiness?.id]);

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
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });

  const total = filteredCashTransfers.reduce((sum, transfer) => {
    const amount = Number(transfer.total ?? transfer.amount) || 0;
    return sum + amount;
  }, 0);

  const refreshList = () => {
    getCashTransfers(); // Refresh the list of cash transfers
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

  const headerGradient = {
    background: `linear-gradient(to right, ${
      activeBusiness?.primary_color || "#2563eb"
    }, ${activeBusiness?.secondary_color || "#4f46e5"})`,
  };

  const renderPreviewDetail = (label, value, className = "") => (
    <div
      className={`rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 ${className}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
        {label}
      </p>
      <p className="text-sm font-medium text-gray-900 break-words">{value}</p>
    </div>
  );

  return (
    <div className="p-2">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Funds Transfer List</h1>
          <p className="text-muted-foreground">Manage your cash transfers</p>
        </div>
        <div className="flex gap-2">
          <CustomButton
            size="sm"
            color="primary"
            className="mb-2"
            onClick={toggleFormModal}
          >
            Move cash
          </CustomButton>
        </div>
      </div>
      <div className="flex gap-2 sm:flex-row flex-col align-items-center">
        <div className="w-full md:w-2/3">
          <Input.Search
            placeholder="Search by account or transfer ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-1/5">
          <Select className="w-full" value={status} onValueChange={setStatus}>
            <SelectTrigger>
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

      <Row className="mx-0 my-2">
        {loading && <Loading />}
        {!loading && (
          <>
            <div className="d-flex px-0 align-items-center justify-content-between w-full">
              <div className="text-end mb-2 fw-bold">
                Total: <span>₦{formatNumber1(parseFloat(total).toFixed(2))}</span>
              </div>
            </div>
            <CustomTable1
              data={filteredCashTransfers}
              fields={fields}
              message={message}
            />
          </>
        )}
      </Row>

      {/* Cash Flow Form Modal */}
      <CashFlowForm
        showModal={isOpenForm}
        closeModal={toggleFormModal}
        getList={refreshList}
        onSuccess={refreshList}
      />

      <CustomModal
        isOpen={isOpen}
        toggle={closePreview}
        header="Funds Transfer Preview"
        size="lg"
        footer={
          <div className="w-full flex justify-end">
            <CustomButton color="primary" onClick={closePreview}>
              Close
            </CustomButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div
            className="rounded-lg text-white px-4 py-3 shadow-sm"
            style={headerGradient}
          >
            <p className="text-xs uppercase tracking-wider text-white/80">
              {activeBusiness?.business_name || "AA ERP"}
            </p>
            <h3 className="text-lg font-bold mt-1">Funds Transfer</h3>
            <p className="text-sm text-white/90 mt-1">
              {items?.transfer_id || "—"} ·{" "}
              {items?.date ? moment(items.date).format("DD MMM YYYY") : "—"}
            </p>
          </div>

          <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-indigo-600">
                Transfer amount
              </p>
              <p className="text-2xl font-bold text-indigo-900 tabular-nums">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Description / remarks
            </Label>
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-800 min-h-[4.5rem] whitespace-pre-wrap">
              {previewDescription}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-0">
                Activity logs
              </Label>
              <span className="text-xs text-gray-500">
                {logs.length} record{logs.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="table-responsive rounded-lg border border-gray-200 overflow-hidden">
              <table className="table table-sm mb-0">
                <thead>
                  <tr
                    className="text-white text-xs uppercase"
                    style={headerGradient}
                  >
                    <th className="px-3 py-2">S/N</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Activity</th>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        No logs found
                      </td>
                    </tr>
                  ) : (
                    logs.map((log, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2">
                          {log?.date
                            ? moment(log.date).format("YYYY-MM-DD")
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {log?.status || log?.activity || "—"}
                        </td>
                        <td className="px-3 py-2">
                          {log?.user || log?.user_id || "—"}
                        </td>
                        <td className="px-3 py-2">{log?.remark || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CustomModal>

      <CustomModal
        isOpen={isOpen2}
        toggle={toggle2}
        header="Review returned cash transfer"
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
