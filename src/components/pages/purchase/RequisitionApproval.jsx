/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Col, Input, Label, Row } from "reactstrap";
import { useSelector } from "react-redux";
import { Edit, Eye, ClipboardList, Search } from "lucide-react";
import moment from "moment";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import Loading from "@/common/Custom/Loading";
import CustomTable1 from "@/common/Custom/CustomTable1";
import CustomModal from "@/common/Custom/CustomModal";
import { Button as UIButton } from "@/components/ui/button";
import { formatNumber } from "@/utilities";
import { formatNumber1 } from "@/components/router/utilities";
import CustomMemoModal from "@/common/Custom/CustomMemoModal";
import CustomRequisitionModal from "@/common/Custom/CustomRequisitionModal";
import { toaster } from "evergreen-ui";
import { useNavigate } from "react-router-dom";
import PurchaseOrderNav from "./PurchaseOrderNav";
function RequisitionApproval() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(true);
  const [pr, setPr] = useState([]);
  const [remark, setRemark] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [itemList, setItemList] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading2, setLoading2] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [items2, setItems2] = useState({});
  const [isOpen2, setIsOpen2] = useState(false);
  const navigate = useNavigate();

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

  const getPR = useCallback(() => {
    _postApi(
      `/account/get-purchase-requisition`,
      {
        query_type: "select-pending",
        requisitor: user.fullname,
        facilityId: activeBusiness.id,
      },
      (data) => {
        setLoading(false);
        if (data.success) {
          setPr(data.results);
        }
      },
      (err) => {
        setLoading(false);
        console.log(err);
      }
    );
  }, [activeBusiness.id, user.id]);
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
    setIsOpen(!isOpen);
  };
  const fields = [
    {
      value: "date",
      title: "Date",
      custom: true,
      className: "text-right",
      component: (item) => (
        <div className="text-sm">
          {item.date ? moment(item.date).format("YYYY-MM-DD") : "-"}
        </div>
      ),
    },
    {
      value: "pr_no",
      title: "Requisition No.",
      custom: true,
      className: "text-center",
      component: (item) => <div className="font-medium">{item.pr_no}</div>,
    },
    {
      value: "reason",
      title: "Subject",
      custom: true,
      className: "text-left",
      component: (item) => <div className="text-sm">{item.reason}</div>,
    },
    // {
    //   value: "last_return_remark",
    //   title: "Remarks",
    //   custom: true,
    //   className: "text-left",
    //   component: (item) => (
    //     <div className="text-sm">
    //       {item.last_return_remark
    //         ? item.last_return_remark.length > 30
    //           ? `${item.last_return_remark.substring(0, 30)}...`
    //           : item.last_return_remark
    //         : ""}
    //     </div>
    //   ),
    // },
    {
      value: "supplier_name",
      title: "Supplier",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-sm">
          {item.supplier_name ? item.supplier_name : "-"}
        </div>
      ),
    },
    {
      value: "status",
      title: "Status",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="flex justify-center items-center">
          <Badge color={item.status === "pending" ? "primary" : "danger"}>
            {item.status}
          </Badge>
        </div>
      ),
    },
    {
      value: "action",
      title: "Action",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="flex justify-center">
          <UIButton
            variant="ghost"
            size="sm"
            onClick={() => {
              viewList(item);
            }}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </UIButton>
          {/* {item.status === "rejected" ? (
            <UIButton
              variant="ghost"
              size="sm"
              onClick={() => {
                console.log(item);
                toggle2(item);
              }}
              className="text-green-600 hover:text-green-800 hover:bg-green-50 ml-2"
              title="Edit"
            >
              <Edit className="h-4 w-4" />
            </UIButton>
          ) : null} */}
        </div>
      ),
    },
  ];

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
    getLogs(item.memo_id);
    _postApi(
      "/account/purchase/getPr",
      {
        query_type: "select-exp",
        pr_no: item.pr_no,
        // date: moment().format("YYYY-MM-DD"),
        // user_id: user.id,
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
  };

  const filteredMemos = pr?.filter((pr) => {
    return searchTerm
      ? pr.branch?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pr.pr_no?.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
  });

  const renderSkeletonFrame = () => (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header Skeleton */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <div className="h-6 bg-gray-200 animate-pulse rounded w-48 mb-4" />
          {/* Search Skeleton */}
          <div className="flex justify-end items-center gap-2 mb-3">
            <div className="h-4 bg-gray-200 animate-pulse rounded w-16" />
            <div className="h-8 bg-gray-200 animate-pulse rounded w-64" />
          </div>
          {/* Table Skeleton */}
          <div className="space-y-3">
            <div className="grid grid-cols-6 gap-2">
              {[...Array(6)].map((_, idx) => (
                <div
                  key={idx}
                  className="h-4 bg-gray-200 animate-pulse rounded"
                />
              ))}
            </div>
            {[...Array(5)].map((_, idx) => (
              <div key={idx} className="h-12 bg-gray-200 animate-pulse rounded" />
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
                  Purchase Orders
                </h1>
                <p className="mt-0.5 text-xs text-slate-500">
                  Review and approve pending purchase requisitions
                </p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by warehouse or PR…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 w-56 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                />
              </div>
            </div>

            <PurchaseOrderNav />

            <div className="p-4">
              {filteredMemos && filteredMemos.length > 0 ? (
                <CustomTable1
                  data={filteredMemos}
                  fields={fields}
                  loading={false}
                  pageSize={10}
                  message="No requisitions found"
                />
              ) : (
                <Alert className="mt-1" color="info">
                  No pending requisitions to approve
                </Alert>
              )}
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
      />
    </>
  );
}

export default RequisitionApproval;
