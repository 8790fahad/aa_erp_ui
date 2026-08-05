/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Col, Input, Label, Row } from "reactstrap";
import { useSelector } from "react-redux";
import { FaEdit, FaEye } from "react-icons/fa";
import moment from "moment";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import Loading from "@/common/Custom/Loading";
import CustomTable from "@/common/Custom/CustomTable";
import CustomModal from "@/common/Custom/CustomModal";
import { formatNumber } from "@/utilities";
import { formatNumber1 } from "@/components/router/utilities";
import CustomMemoModal from "@/common/Custom/CustomMemoModal";
import CustomRequisitionModal from "@/common/Custom/CustomRequisitionModal";
import { Typeahead } from "react-bootstrap-typeahead";
import { toast } from "sonner";

function GenerateMemo() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState([]);
  const [errors, setErrors] = useState({
    from_name: "",
    subject: "",
    purpose: "",
  });
  const [pr, setPr] = useState([]);
  const [remark, setRemark] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [itemList, setItemList] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading2, setLoading2] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [items2, setItems2] = useState({});
  const [isOpen2, setIsOpen2] = useState(false);
  const [truckNumber, setTruckNumber] = useState("");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [modeCode, setModeCode] = useState([]);
  const [payableCode, setPayableCode] = useState([]);

  const total = itemList.reduce(
    (sum, item) =>
      sum + item.est_cost * (item.receivedQuantity || item.quantity),
    0
  );

  const [form, setForm] = useState({
    date: moment().format("YYYY-MM-DD"),
    recipient: "Managing Director",
    raise_by: user.fullname || user.username,
    from_name: "",
    subject: "",
    purpose: "",
    amount_to_pay: null,
    expenses: [],
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      amount_to_pay: total,
    }));
  }, [total]);

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({ ...p, [name]: value }));
  };

  useEffect(() => {
    _fetchApi(
      `/branches/get?facilityId=${activeBusiness.id}&query_type=list`,
      (data) => {
        if (data.success) {
          setStores(data.results.map((store) => store.branch_name));
        }
      }
    );
  }, [activeBusiness.id]);

  const getPR = useCallback(() => {
    _postApi(
      `/account/get-purchase-requisition`,
      {
        query_type: "select-pending-payment",
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

  const getModeCode = () => {
    _postApi(
      `/account/expenditure?query_type=inventory`,
      { store: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setModeCode(resp.results);
          // setDefaultValues(resp.results);
        } else {
          toast.error("Failed to load chart data.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
    _postApi(
      `/account/expenditure?query_type=payable`,
      { store: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          // console.log(resp)
          setPayableCode(resp.results);
          // setDefaultValues(resp.results);
        } else {
          toast.error("Failed to load chart data.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };
  useEffect(() => {
    getModeCode();
  }, []);

  const approveMemo = (itemList) => {
    setLoading1(true);

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
        toast.success("Successfully Approved");
        getPR();
        setIsOpen(false);
        // if (data.success) {
        //   setPr(data.results);
        // }
      },
      (err) => {
        setLoading(false);
        console.log(err);
        setIsOpen(false);
      }
    );
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    console.log({
      ...form,
      query_type: "insert",
      prefix: activeBusiness.prefix,
      expenses: itemList.map((item) => ({
        item: item.item_name,
        unitCost: item.est_cost,
        quantity: item.quantity,
      })),
      user_id: user.id,
    });

    _postApi(
      "/account/insert-memo",
      {
        ...form,
        query_type: "insert",
        pr_no: items.pr_no,
        prefix: activeBusiness.prefix,
        expenses: itemList.map((item) => ({
          item: item.item_name,
          unitCost: item.est_cost,
          quantity: item.quantity,
        })),
        user_id: user.id,
        total: itemList.reduce(
          (sum, item) =>
            sum + item.est_cost * (item.receivedQuantity || item.quantity),
          0
        ),
      },
      (res) => {
        if (res.success) {
          toast.success(res.results[0].memo_id);
          toast.success(
            `${res.message}, Memo no. is: ${res.results[0].memo_id}`
          );
          setIsOpen(false);
          //   navigate(-1);
        }
        setLoading(false);
      },
      (err) => {
        toast.error("Error Occurred");
        console.error(err);
        setLoading(false);
      }
    );
  };

  const validateForm = () => {
    const newErrors = {
      from_name: "",
      subject: "",
      purpose: "",
    };

    let isValid = true;

    // Validate Branch (from_name)
    if (!form.from_name) {
      newErrors.from_name = "Branch is required";
      isValid = false;
    }

    // Validate Subject
    if (!form.subject) {
      newErrors.subject = "Subject is required";
      isValid = false;
    }

    // Validate Purpose
    if (!form.purpose) {
      newErrors.purpose = "Purpose is required";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  useEffect(() => {
    getPR();
  }, [getPR]);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState({});
  const toggle = (item) => {
    setItems(item);

    setForm((prev) => ({
      ...prev,
      subject: item.reason,
      purpose: item.reason,
      from_name: item.branch,
    }));
    setIsOpen(!isOpen);
  };

  const fields = [
    {
      title: "Date",
      custom: true,
      component: (item) => (
        <div className="text-center">{moment().format(item.date)}</div>
      ),
    },
    {
      title: "PO NO.",
      custom: true,
      component: (item) => <div className="text-center">{item.po_no}</div>,
    },
    {
      title: "Subject",
      custom: true,
      component: (item) => <div className="text-left">{item.reason}</div>,
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
            handleSubmit={() => {
              viewList(item);
            }}
          >
            <FaEye size="20" />
          </CustomButton>
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
          setItemList(res.results.map((item) => ({ ...item })));
        }
      },
      (err) => {
        toast.error("Error Occurred");
      }
    );
  };

  const filteredMemos = pr?.filter((memo) => {
    return searchTerm
      ? memo.from_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          memo.memo_id.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
  });

  return (
    <CustomCard header="Generate Memo">
      {/* {JSON.stringify(itemList)} */}
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

        {loading && <Loading />}
        {!loading ? (
          <CustomTable
            data={filteredMemos}
            fields={fields}
            className={"mb-0"}
          />
        ) : (
          <Alert className="mt-3" color="info">
            No data to view
          </Alert>
        )}
      </Row>
      <CustomModal
        size="xl"
        isOpen={isOpen}
        toggle={toggle}
        header="Initiate Memo"
      >
        {/* {JSON.stringify(items)} */}
        <Row>
          <Col md={6}>
            <Label>Date</Label>
            <Input type="date" name="date" value={form.date} disabled />
          </Col>
          <Col md={6}>
            <Label>Recipient</Label>
            <Input
              type="text"
              name="recipient"
              value={form.recipient}
              disabled
            />
          </Col>
          <Col md={6} className="mt-2">
            <Label>Sender</Label>
            <Input type="text" name="raise_by" value={form.raise_by} disabled />
          </Col>
          <Col md={6} className="mt-2">
            <Label>Warehouse</Label>
            <Typeahead
              id="single-select-typeahead"
              size="sm"
              className="col-md-12 pl-0 pr-0 custom-typeahead-border"
              options={stores.map((store) => ({ name: store }))}
              placeholder="Select warehouse..."
              onChange={(selectedItems) =>
                setForm((prev) => ({
                  ...prev,
                  from_name: selectedItems[0]?.name || "",
                }))
              }
              selected={form.from_name ? [{ name: form.from_name }] : []}
              labelKey="name"
              style={{
                borderRadius: "7px",
              }}
            />

            {errors.from_name && (
              <span className="text-danger">{errors.from_name}</span>
            )}
          </Col>
          <Col md={12} className="mt-2">
            <Label>Subject</Label>
            <Input
              name="subject"
              value={form.subject}
              onChange={handleChange}
              invalid={!!errors.subject} // Highlight invalid field
            />
            {errors.subject && (
              <span className="text-danger">{errors.subject}</span>
            )}
          </Col>
          <Col md={12} className="mt-2">
            <Label>Description</Label>
            <Input
              type="textarea"
              name="purpose"
              value={form.purpose}
              onChange={handleChange}
              invalid={!!errors.purpose} // Highlight invalid field
            />
            {errors.purpose && (
              <span className="text-danger">{errors.purpose}</span>
            )}
          </Col>
          <Col md={12} className="mt-2">
            <div className="d-flex justify-content-between">
              <Label>
                Amount to be Paid: <b>(₦{formatNumber1(total)})</b>
              </Label>
              <Label>
                Balance: <b>(₦{formatNumber1(total - form.amount_to_pay)})</b>
              </Label>
            </div>
            <Input
              type="number"
              name="amount_to_pay"
              value={form.amount_to_pay}
              onChange={handleChange}
              invalid={!!errors.amount_to_pay} // Highlight invalid field
            />
            {errors.amount_to_pay && (
              <span className="text-danger">{errors.amount_to_pay}</span>
            )}
          </Col>
        </Row>
        <Row className="px-3 mt-4">
          <table className="table table-bordered">
            <thead>
              <tr>
                {/* <th className="text-center">S/N</th> */}
                <th className="text-center">Item Name</th>
                <th className="text-center">Unit Cost (₦)</th>
                {/* <th className="text-center">Order Qty</th> */}
                <th className="text-center">Receive Qty</th>
                <th className="text-center">Total Cost (₦)</th>
                {/* <th className="text-center">Expiry Date</th> */}
                {/* <th className="text-center">Approve</th> */}
              </tr>
            </thead>
            <tbody>
              {/* {JSON.stringify(itemList)} */}
              {itemList.map((item, idx) => (
                <tr key={item.item_list_id}>
                  {/* <td>{idx + 1}</td> */}
                  <td>{item.item_name}</td>
                  <td className="text-right">{formatNumber(item.est_cost)}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right">
                    {formatNumber(
                      item.est_cost * (item.receivedQuantity || item.quantity)
                    )}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="text-right fw-bold">
                  Total:
                </td>
                <td className="text-right">₦{formatNumber1(total)}</td>
              </tr>
            </tbody>
          </table>
        </Row>
        <center>
          <CustomButton
            loading={loading2}
            className="mt-3"
            onClick={handleSubmit}
          >
            Initiate Memo
          </CustomButton>
        </center>
      </CustomModal>
    </CustomCard>
  );
}

export default GenerateMemo;
