/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Col, Input, Label, Row } from "reactstrap";
import { useSelector } from "react-redux";
import { Eye } from "lucide-react";
import moment from "moment";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import Loading from "@/common/Custom/Loading";
import CustomTable1 from "@/common/Custom/CustomTable1";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/utilities";
import { formatNumber1 } from "@/components/router/utilities";
import CustomMemoModal from "@/common/Custom/CustomMemoModal";
import CustomRequisitionModal from "@/common/Custom/CustomRequisitionModal";
import { X } from "lucide-react";

function GoodsReceive() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [pr, setPr] = useState([]);
  const [remark, setRemark] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [itemList, setItemList] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState({});
  const [logs, setLogs] = useState([]);
  const [loading2, setLoading2] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [items2, setItems2] = useState({});
  const [isOpen2, setIsOpen2] = useState(false);
  const [truckNumber, setTruckNumber] = useState("");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [modeCode, setModeCode] = useState([]);
  const [unit, setUnit] = useState([]);
  const [payableCode, setPayableCode] = useState([]);
  const [newExpense, setNewExpense] = useState({});

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

  const getPR = useCallback(() => {
    _postApi(
      `/account/get-purchase-requisition`,
      {
        query_type: "select-grn",
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
  }, [activeBusiness.id, user.fullname]);

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
          // getMemos();
        }
      },
      (err) => {
        toast.error("error occured");
        console.log(err);
        setLoading1(false);
      }
    );
  };

  const totalAmount = itemList
    .filter((item) => item.approved)
    .reduce(
      (sum, item) =>
        sum + item.est_cost * (item.receivedQuantity || item.quantity),
      0
    );

  const getPayableCode = useCallback(() => {
    // if (!items.supplier_code) {
    //   toast.error("Payable code is not set");
    //   return;
    // }
    _fetchApi(
      `/account/get-account-head/${items.supplier_code}/${activeBusiness.id}`,
      (resp) => {
        if (resp.success) {
          setPayableCode(resp.results);
        } else {
          toast.error("Failed to load chart data.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  }, [items.supplier_code, activeBusiness.id]);
  useEffect(() => {
    getPayableCode();
  }, [getPayableCode]);

  const getModeCode = useCallback(() => {
    if (!itemList[0]?.chart_code) {
      toast.error("Head is not set");
      return;
    }

    _fetchApi(
      `/account/get-account-head/${itemList[0]?.chart_code}/${activeBusiness.id}`,
      (resp) => {
        if (resp.success) {
          setModeCode(resp.results);
        } else {
          toast.error("Failed to load chart data.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  }, [itemList, activeBusiness.id]);
  useEffect(() => {}, [getModeCode]);

  // const getUnitOfMeasurement = useCallback(() => {
  //   _fetchApi(
  //     `/inventory/get-all-measure/${activeBusiness.id}`,
  //     (resp) => {
  //       if (resp.success) {
  //         setUnit(resp.results);
  //       } else {
  //         toast.error("Failed to load chart data.");
  //       }
  //     },
  //     (err) => {
  //       console.error("API Error:", err);
  //       toast.error("Something went wrong while fetching data.");
  //     }
  //   );
  // }, [activeBusiness.id]);
  // useEffect(() => {
  //   getUnitOfMeasurement();
  // }, []);

  const approveMemo = (
    itemList,
    additionalCostItem,
    additionalCostValue,
    remark
  ) => {
    if (!activeBusiness.payable_code) {
      toast.error("Payable code is not set");
      return;
    }

    setLoading1(true);
    setLoading(true);

    // Prepare items with their additional costs
    const itemsWithAdditionalCosts = itemList.map((item) => ({
      ...item,
    }));

    _postApi(
      `/account/generate-good-receive`,
      {
        supplier_code: items.supplier_code,
        waybill_no: waybillNumber,
        truck_no: truckNumber,
        items: itemsWithAdditionalCosts,
        pr_no: items.pr_no,
        po_no: items.po_no,
        supplier_id: items.supplier_id,
        facilityId: activeBusiness.id,
        user_id: user.id,
        purpose: items.reason,
        remark: remark,
        payable_accural_code: activeBusiness?.payable_accural_code,
        payable_code: activeBusiness?.payable_code,
      },
      (data) => {
        if (data.success) {
          toast.success("Good Receive Note generated successfully");

          // Update purchase requisition status
          _postApi(
            `/account/update-purchase-requisition`,
            {
              query_type: "update-pending",
              pr_no: items.pr_no,
              status: "pending payment",
              facilityId: activeBusiness.id,
            },
            (data) => {
              setLoading(false);
              setLoading1(false);
              toast.success("Purchase requisition approved successfully");
              getPR();
              setIsOpen(false);
            },
            (err) => {
              setLoading(false);
              setLoading1(false);
              console.error("Error updating requisition:", err);
              toast.error("Failed to update purchase requisition");
              setIsOpen(false);
            }
          );
        } else {
          setLoading(false);
          setLoading1(false);
          toast.error(data.message || "Failed to generate Good Receive Note");
          setIsOpen(false);
        }
      },
      (err) => {
        setLoading(false);
        setLoading1(false);
        console.error("Error generating GRN:", err);
        toast.error("Failed to generate Good Receive Note");
        setIsOpen(false);
      }
    );
  };

  useEffect(() => {
    getPR();
  }, [getPR]);

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
      className: "text-center",
      component: (item) => (
        <div className="text-sm">
          {item.date ? moment(item.date).format("YYYY-MM-DD") : "-"}
        </div>
      ),
    },
    {
      value: "po_no",
      title: "PO NO.",
      custom: true,
      className: "text-center",
      component: (item) => <div className="font-medium">{item.po_no}</div>,
    },
    {
      value: "reason",
      title: "Subject",
      custom: true,
      className: "text-left",
      component: (item) => <div className="text-sm">{item.reason}</div>,
    },
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              viewList(item);
            }}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const getLogs = useCallback(
    (memoId) => {
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
    },
    [activeBusiness.id]
  );

  const viewList = (item) => {
    toggle(item);
    console.log(item);
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
          setItemList(res.results.map((item) => ({ ...item })));
        }
      },
      (err) => {
        toast.error("Error Occurred");
      }
    );
  };
  useEffect(() => {
    if (itemList.length === 0) return;
    getModeCode();
  }, [itemList, getModeCode]);

  const filteredMemos = pr?.filter((memo) => {
    return searchTerm
      ? memo.from_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          memo.memo_id.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
  });

  return (
    <>
      <CustomCard header="Goods receive note ">
        {/* {JSON.stringify(unit)} */}
        <Row className="mx-0">
          <div className="d-flex justify-content-end align-items-center gap-2 mb-3">
            <Label for="searchFilter" className="mb-0 mr-2">
              Search:
            </Label>
            <Input
              id="searchFilter"
              type="text"
              bsSize="sm"
              placeholder="Search by warehouse name or requisition ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="d-flex justify-content-center my-5">
              <Loading />
            </div>
          ) : filteredMemos && filteredMemos.length > 0 ? (
            <CustomTable1
              data={filteredMemos}
              fields={fields}
              loading={loading}
              pageSize={10}
              message="No goods receive notes found"
            />
          ) : (
            <Alert className="mt-3" color="info">
              No data to view
            </Alert>
          )}
        </Row>
      </CustomCard>
      <CustomRequisitionModal
        isOpen={isOpen}
        toggle={toggle}
        header="Review Goods Note"
        itemList={itemList}
        setItemList={setItemList}
        items={items}
        activeBusiness={activeBusiness}
        cancel={cancel}
        returnMemo={returnMemo}
        approveMemo={approveMemo}
        loading1={loading1}
        remark={remark}
        setRemark={setRemark}
        newExpense={newExpense}
        setNewExpense={setNewExpense}
        logs={logs}
        payableCode={payableCode}
        mode="receive"
        loading2={loading2}
        waybillNumber={waybillNumber}
        truckNumber={truckNumber}
        setWaybillNumber={setWaybillNumber}
        setTruckNumber={setTruckNumber}
      />

      {/* Review Rejected Modal */}
      {isOpen2 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Review Rejected</h3>
                  <p className="text-blue-100 text-sm mt-1">
                    Review and update rejected requisition
                  </p>
                </div>
                <button
                  onClick={toggle2}
                  className="p-1.5 hover:bg-white/20 rounded transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6 flex-1 overflow-y-auto">
              <Row>
                <Col md={6}>
                  <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                    From
                  </Label>
                  <Input
                    type="text"
                    name="from"
                    value={items2?.from_name}
                    disabled={true}
                    className="w-full"
                  />
                </Col>
                <Col md={6}>
                  <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                    Date
                  </Label>
                  <Input
                    type="date"
                    name="date"
                    value={moment().format(form.date)}
                    disabled={true}
                    className="w-full"
                  />
                </Col>
                <Col md={12} className="mt-3">
                  <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                    Purpose
                  </Label>
                  <Input
                    onChange={handleChange}
                    name="purpose"
                    value={form.purpose}
                    type="textarea"
                    rows={4}
                    className="w-full"
                  />
                </Col>
              </Row>
            </div>

            {/* Footer Actions */}
            <div className="border-t bg-gray-50 p-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={toggle2}
                className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
                disabled={loading2}
              >
                Cancel
              </button>
              <CustomButton
                loading={loading2}
                onClick={handleEdit}
                className="px-4 py-2"
              >
                Submit
              </CustomButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default GoodsReceive;
