/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Col, Input, Label, Row } from "reactstrap";
import { useSelector } from "react-redux";
import { FaEdit, FaEye } from "react-icons/fa";
import moment from "moment";
import { _fetchApi, _postApi, apiURL } from "@/redux/actions/api";
import { toast } from "sonner";

import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import Loading from "@/common/Custom/Loading";
import CustomTable from "@/common/Custom/CustomTable";
import CustomModal from "@/common/Custom/CustomModal";
import CustomMemoModal from "@/common/Custom/CustomMemoModal";

import { formatNumber } from "@/utilities";
import { formatNumber1 } from "@/components/router/utilities";

import CustomTable1 from "@/common/Custom/CustomTable1";
import MemoNav from "./MemoNav";
import { FileText, Search } from "lucide-react";

function MemoReviewal() {
  const { activeBusiness, user } = useSelector((state) => state.auth);

  // States
  const [loading, setLoading] = useState(false);
  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);

  const [memos, setMemos] = useState([]);
  const [remark, setRemark] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [itemList, setItemList] = useState([]);
  const [logs, setLogs] = useState([]);

  const [items, setItems] = useState({});
  const [items2, setItems2] = useState({});
  const [files, setFiles] = useState([]);
  const [amount, setAmount] = useState();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const [isOpen, setIsOpen] = useState(false);
  const [isOpen2, setIsOpen2] = useState(false);

  const _form = {
    date: moment().format("YYYY-MM-DD"),
    purpose: "",
    from: "",
  };
  const [form, setForm] = useState(_form);

  // Derived values
  const total = itemList.reduce(
    (sum, item) => sum + item.unit_cost * item.quantity,
    0
  );
  const initiatedAmount = parseInt(memos[0]?.amount || 0, 10);
  const balance = parseFloat(memos[0]?.total || 0) - initiatedAmount;

  // Side Effects
  useEffect(() => {
    if (memos) {
      setAmount(initiatedAmount === 0 ? total : balance);
    } else {
      setAmount(total);
    }
  }, [memos, total, initiatedAmount, balance]);

  // Functions
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

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
          toast.success("Successfully Submit");
          setLoading2(false);
        }
      },
      (err) => {
        toast.error("error occurred");
        console.log(err);
        setLoading2(false);
      }
    );
  };

  const getMemos = useCallback(() => {
    setLoading(true);
    _fetchApi(
      `/account/get-memo/${activeBusiness.id}/pending/${user.id}/review`,
      (data) => {
        setLoading(false);
        if (data.success) {
          setMemos(data.results);
        }
      },
      (err) => {
        setLoading(false);
        console.log(err);
      }
    );
  }, [activeBusiness.id, user.id]);

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
        remark,
        status: "returned",
        review_by: user.fullname || user.username,
        approve_by: "",
        query_type: "review",
        logStatus: "Review",
      },
      (res) => {
        if (res.success) {
          toast.success("Successfully Submitted");
          setRemark("");
          setLoading1(false);
          toggle();
          getMemos();
        }
      },
      (err) => {
        toast.error("error occurred");
        console.log(err);
        setLoading1(false);
      }
    );
  };

  const approveMemo = () => {
    setLoading1(true);
    const actor = user.fullname || user.username;
    _postApi(
      "/account/insert-approved-memo",
      {
        facilityId: activeBusiness.id,
        type: "memo",
        name: actor,
        role: user.role,
        id_link: items.memo_id,
        user_id: user.id,
        review_by: actor,
        approve_by: actor,
        description: items.description,
        status: "approved",
        amount: amount,
        amount1: items.amount || 0,
        remark,
        logStatus: "approved",
        query_type: "approval",
        total: items.total,
        paid_amount: amount,
      },
      (res) => {
        if (res.success) {
          toast.success("Memo approved");
          setRemark("");
          setLoading1(false);
          toggle();
          getMemos();
        } else {
          setLoading1(false);
          toast.error(res.message || "Approval failed");
        }
      },
      (err) => {
        toast.error("Error Occurred");
        console.error(err);
        setLoading1(false);
      }
    );
  };

  const rejectMemo = () => {
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
        status: "rejected",
        amount: 0,
        remark,
        logStatus: "rejected",
        query_type: "rejected",
      },
      (res) => {
        if (res.success) {
          toast.error("Memo rejected");
          setRemark("");
          setLoading1(false);
          toggle();
          getMemos();
        } else {
          setLoading1(false);
        }
      },
      (err) => {
        toast.error("Error occurred");
        console.log(err);
        setLoading1(false);
      }
    );
  };

  const toggle = (item) => {
    setItems(item);
    setIsOpen(!isOpen);
  };

  const cancel = () => {
    setItems({});
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

  const getLogs = useCallback((memoId) => {
    if (!memoId) return;
    _fetchApi(
      `/account/get-logs?id=${memoId}&facilityId=${activeBusiness.id}`,
      (data) => {
        setLoading2(false);
        if (data.success) {
          setLogs(data.results);
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
    getLogs(item.memo_id);
    _postApi(
      "/account/memo-item-list",
      {
        query_type: "select",
        memo_id: item.memo_id,
        date: moment().format("YYYY-MM-DD"),
        user_id: user.id,
      },
      (res) => {
        if (res.success) {
          setItemList(res.results);
          const serverFiles = res.attachments.map((doc) => ({
            name: doc.original_name,
            type: doc.mime_type,
            size: doc.file_size,
            preview: `${apiURL}/public/uploads/${doc.file_path}`,
            fromServer: true,
          }));
          setFiles(serverFiles);
        }
      },
      (err) => {
        toast.error("Error Occurred");
      }
    );
  };

  useEffect(() => {
    getMemos();
  }, [getMemos]);

  const filteredMemos = memos.filter((memo) =>
    searchTerm
      ? String(memo.from_name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        String(memo.memo_id || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      : true
  );

  const fields = [
    {
      title: "Date",
      custom: true,
      component: (item) => (
        <div className="text-right">{moment().format(item.date)}</div>
      ),
    },
    {
      title: "Memo No.",
      custom: true,
      component: (item) => <div className="text-center">{item.memo_id}</div>,
    },
    {
      title: "Subject",
      custom: true,
      component: (item) => <div className="text-left">{item.subject}</div>,
    },
    {
      title: "Remarks",
      custom: true,
      component: (item) => (
        <div className="text-left">
          {item.last_return_remark
            ? item.last_return_remark.length > 30
              ? `${item.last_return_remark.substring(0, 30)}...`
              : item.last_return_remark
            : ""}
        </div>
      ),
    },
    {
      title: "Amount (₦)",
      custom: true,
      component: (item) => (
        <div className="text-right">
          {formatNumber1(
            parseInt(item.amount) === 0 ? item.total : item.amount
          )}
        </div>
      ),
    },
    {
      title: "Status",
      custom: true,
      component: (item) => (
        <div className="d-flex justify-content-center align-items-center">
          <Badge color={item.status === "pending" ? "primary" : "danger"}>
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
            handleSubmit={() => viewList(item)}
          >
            <FaEye size="20" />
          </CustomButton>
        </div>
      ),
    },
  ];

  return (
    <div className="h-fit w-full">
      <div className="mx-auto h-fit max-w-7xl">
        <div className="h-fit overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
                <FileText className="h-5 w-5 text-[var(--aa-accent)]" />
                Initiate Memo
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                Approve pending memos
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                id="searchFilter"
                type="text"
                placeholder="Search by warehouse or memo ID…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-56 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
              />
            </div>
          </div>

          <MemoNav />

          <div className="p-4">
            <Row className="mx-0">
              {loading && <Loading />}
              {!loading ? (
                <CustomTable1
                  data={filteredMemos}
                  fields={fields}
                  className="mb-0"
                  message="No pending memos to review"
                />
              ) : (
                <Alert className="mt-3" color="info">
                  No data to view
                </Alert>
              )}
            </Row>
          </div>
        </div>
      </div>

      <CustomMemoModal
        isOpen={isOpen}
        toggle={toggle}
        header="Approve Memo"
        itemList={itemList}
        items={items}
        files={files}
        activeBusiness={activeBusiness}
        cancel={cancel}
        returnMemo={returnMemo}
        approveMemo={approveMemo}
        reject={rejectMemo}
        loading1={loading1}
        remark={remark}
        setRemark={setRemark}
        logs={logs}
        mode="approve"
        loading2={loading2}
        amount={amount}
        setAmount={setAmount}
      />

      <CustomModal isOpen={isOpen2} toggle={toggle2} header="Review rejected">
        <Row>
          <Col md={6}>
            <Label>From</Label>
            <Input type="text" name="from" value={items2?.from_name} disabled />
          </Col>
          <Col md={6}>
            <Label>Date</Label>
            <Input
              type="date"
              name="date"
              value={moment().format(form.date)}
              disabled
            />
          </Col>
          <Col md={12}>
            <Label>Purpose</Label>
            <Input
              type="textarea"
              name="purpose"
              value={form.purpose}
              onChange={handleChange}
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

export default MemoReviewal;
