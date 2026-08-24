/* eslint-disable react/no-unescaped-entities */
/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import moment from "moment";
import { FaEye } from "react-icons/fa";
import { Alert, Badge, Input, Label, Row } from "reactstrap";

import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import CustomMemoModal from "@/common/Custom/CustomMemoModal";
import Loading from "@/common/Custom/Loading";

import { _fetchApi, _postApi, apiURL } from "@/redux/actions/api";
import { toast } from "sonner";
import { formatNumber1 } from "@/components/router/utilities";
import CustomTable1 from "@/common/Custom/CustomTable1";

function ApprovalByMD() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [memos, setMemos] = useState([]);
  const [itemList, setItemList] = useState([]);
  const [files, setFiles] = useState([]);
  const [logs, setLogs] = useState({});
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState({});

  const toggle = (item) => {
    setItems(item || {});
    setIsOpen((prev) => !prev);
  };

  const getMemos = useCallback(() => {
    if (!activeBusiness?.id || !user?.id) {
      setMemos([]);
      return;
    }
    setLoading(true);
    _fetchApi(
      `/account/get-memo/${activeBusiness.id}/reviewed/${user.id}/re_list`,
      (data) => {
        setLoading(false);
        if (data?.success) {
          setMemos(Array.isArray(data.results) ? data.results : []);
        } else {
          setMemos([]);
        }
      },
      (err) => {
        setLoading(false);
        setMemos([]);
        console.log(err);
      },
    );
  }, [activeBusiness?.id, user?.id]);

  useEffect(() => {
    getMemos();
  }, [getMemos]);

  const approveMemo = () => {
    const balance = items?.total - items?.amount;
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
        review_by: items.review_by,
        verify_by: items.verify_by,
        description: items.description,
        status: "approved",
        amount: items.amount,
        remark: remark,
        logStatus: "approved",
        query_type: "approval",
        balance: balance,
        total: items.total,
        paid_amount: items.amount,
      },
      (res) => {
        if (res.success) {
          toast.success("Successfully Submit");
          setAmount("");
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
        toast.error("Error occurred");
        console.log(err);
        setLoading1(false);
      },
    );
  };

  const reject = () => {
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
        remark: remark,
        logStatus: "rejected",
        query_type: "rejected",
      },
      (res) => {
        if (res.success) {
          toast.error("Rejected");
          setLoading1(false);
          toggle();
          getMemos();
        } else {
          setLoading1(false);
          toast.error(res.message || "Reject failed");
        }
      },
      (err) => {
        toast.error("Error occurred");
        console.log(err);
        setLoading1(false);
      },
    );
  };

  const getLogs = useCallback(
    (memoId) => {
      if (!memoId || !activeBusiness?.id) return;
      setLoading2(true);
      _fetchApi(
        `/account/get-logs?id=${memoId}&facilityId=${activeBusiness.id}`,
        (data) => {
          setLoading2(false);
          if (data?.success) {
            setLogs(data.results || {});
          }
        },
        (err) => {
          setLoading2(false);
          console.log(err);
        },
      );
    },
    [activeBusiness?.id],
  );

  const viewList = (item) => {
    toggle(item);
    getLogs(item.memo_id);
    _postApi(
      "/account/memo-item-list",
      {
        query_type: "new_select",
        memo_id: item.memo_id,
        date: moment().format("YYYY-MM-DD"),
        user_id: user.id,
        reference_number: item.reference_number,
      },
      (res) => {
        if (res.success) {
          setItemList(Array.isArray(res.results) ? res.results : []);
          const serverFiles = (res.attachments || []).map((doc) => ({
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
        console.log(err);
        toast.error("Error Occurred");
      },
    );
  };

  const filteredMemos = (Array.isArray(memos) ? memos : []).filter((memo) =>
    searchTerm
      ? String(memo?.from_name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        String(memo?.memo_id || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      : true,
  );

  const fields = [
    {
      title: "Date",
      custom: true,
      component: (item) => (
        <div className="text-center">{moment().format(item.date)}</div>
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
      title: "Total amount (₦)",
      custom: true,
      component: (item) => (
        <div className="text-right">
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
        <div className="text-center">
          <Badge color="secondary">{item.status}</Badge>
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
            size="sm"
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
    <CustomCard header="Internal Audit">
      <Row className="mx-0">
        <div className="d-flex justify-content-end align-items-center gap-2 mb-3">
          <Label for="searchFilter" className="mb-0 mr-2">
            Search:
          </Label>
          <Input
            id="searchFilter"
            type="text"
            bsSize="sm"
            placeholder="Search by branch name or memo ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading && <Loading />}
        {!loading ? (
          <CustomTable1
            data={filteredMemos}
            fields={fields}
            message="No Memo found"
            className="mb-0"
          />
        ) : (
          <Alert className="mt-3" color="info">
            No data to view
          </Alert>
        )}
      </Row>

      <CustomMemoModal
        isOpen={isOpen}
        toggle={toggle}
        header="Approve memo"
        itemList={itemList}
        items={items}
        files={files}
        activeBusiness={activeBusiness}
        approveMemo={approveMemo}
        reject={reject}
        loading1={loading1}
        remark={remark}
        setRemark={setRemark}
        amount={amount}
        setAmount={setAmount}
        logs={logs}
        mode="approve"
      />
    </CustomCard>
  );
}

export default ApprovalByMD;
