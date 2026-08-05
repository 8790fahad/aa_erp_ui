/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Input, Label, Row, Col } from "reactstrap"; // Added Col import
import { useSelector } from "react-redux";
import { FaEye } from "react-icons/fa";
import moment from "moment";
import { Typeahead } from "react-bootstrap-typeahead";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import Loading from "@/common/Custom/Loading";
import CustomTable from "@/common/Custom/CustomTable";
import CustomModal from "@/common/Custom/CustomModal";
import { formatNumber } from "@/utilities";

function MemoAccountVerification() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [memos, setMemos] = useState([]);
  const [description, setDescription] = useState([]);
  const [remark, setRemark] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [itemList, setItemList] = useState([]);

  // Define form state
  const [form, setForm] = useState({
    heading1: "",
    code: "",
  });

  // Define handleChange function
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Define heading1 and heading arrays
  const heading1 = [
    { heading1: "10000", name: "Revenue" },
    { heading1: "20000", name: "Expenditure" },
    { heading1: "30000", name: "Asset" },
    { heading1: "40000", name: "Equity & liability" },
  ];

  const getMemos = useCallback(() => {
    _fetchApi(
      `/account/get-memo/${activeBusiness.id}/reviewed/${user.id}/list`,
      (data) => {
        setLoading(false);
        if (data.success) {
          setMemos(data.results);
        }
      },
      (err) => {
        setLoading(false);
        console.log(err);
      },
    );
  }, [activeBusiness.id, user.id]);

  const getheading1 = useCallback(() => {
    if (!form.heading1) return;
    _fetchApi(
      `/account/chart/descendant/${user.busName}/${form.heading1}`,
      (data) => {
        setLoading2(false);
        if (data.success) {
          setDescription(
            data.results.map((item) => ({ name: item.description })),
          );
        }
      },
      (err) => {
        setLoading2(false);
        console.log(err);
      },
    );
  }, [form.heading1]);

  const [loading1, setLoading1] = useState(false);

  const verifyMemo = () => {
    setLoading1(true);
    // console.log(form);
    setLoading1(false);
    _postApi(
      "/account/insert-approved-memo",
      {
        facilityId: activeBusiness.id,
        type: "memo",
        name: user.fullname || user.username,
        role: user.role,
        id_link: items.memo_id,
        remark: `Verified by ${user.username}`,
        user_id: user.id,
        amount: items.amount,
        status: "verified",
        review_by: items.review_by,
        verify_by: user.fullname || user.username,
        approve_by: "",
        description: form.description,
        query_type: "verify",
        logStatus: "Verified",
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
      },
    );
  };

  useEffect(() => {
    getMemos();
  }, [getMemos]);

  useEffect(() => {
    getheading1();
  }, [getheading1]);

  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState({});

  const toggle = (item) => {
    setItems(item);
    setIsOpen(!isOpen);
  };

  const cancel = () => {
    setItems({});
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
      title: "Memo No.",
      custom: true,
      component: (item) => <div className="text-center">{item.memo_id}</div>,
    },
    {
      title: "From",
      custom: true,
      component: (item) => (
        <div className="text-center">
          {item.from_name} <b className="ml-1">({item.raise_by})</b>
        </div>
      ),
    },
    {
      title: "Status",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <Badge color="primary">{item.status}</Badge>
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

  const viewList = (item) => {
    toggle(item);
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
          // alert(JSON.stringify(res.results))
          setItemList(res.results);
        }
      },
      (err) => {
        toast.error("Error Occurred");
      },
    );
  };

  const filteredMemos = memos.filter((memo) => {
    return searchTerm
      ? memo.from_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          memo.memo_id.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
  });

  return (
    <CustomCard header="Account verification">
      {/* {JSON.stringify(heading)} */}
      <Row className="mx-0">
        <div className="d-flex justify-content-end align-items-center gap-2 mb-3">
          <Label for="searchFilter" className="mb-0 mr-2">
            Search:
          </Label>
          <Input
            id="searchFilter"
            type="text"
            bsSize="sm"
            placeholder="Search by warehouse name or memo ID"
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
        isOpen={isOpen}
        toggle={toggle}
        itemList={itemList}
        header="Preview"
        footer={
          <>
            <Button color="danger" className="mr-1" outline onClick={cancel}>
              Skip
            </Button>
            <CustomButton
              onClick={verifyMemo}
              loading={loading1}
              disabled={form.description === "" ? true : false}
            >
              Verify
            </CustomButton>
          </>
        }
      >
        <div>
          <div
            style={{
              borderWidth: 1,
              borderColor: "#000",
              padding: 20,
              marginBottom: 20,
            }}
          >
            <h2
              style={{
                fontSize: 18,
                textAlign: "center",
                marginBottom: 10,
                textTransform: "uppercase",
              }}
            >
              {activeBusiness?.business_name}
            </h2>
            <h4
              style={{
                fontSize: 12,
                textAlign: "center",
                textTransform: "uppercase",
              }}
            >
              Internal Memo
            </h4>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ flexDirection: "row", width: "100%" }}>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 12,
                  textTransform: "uppercase",
                  marginRight: 10,
                }}
              >
                Date: <b>{moment().format(items?.date)}</b>
              </div>
            </div>
            <div style={{ flexDirection: "row", width: "100%" }}>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 12,
                  textTransform: "uppercase",
                  marginRight: 10,
                }}
              >
                Recipient: <b>The {items?.recipient},</b>
              </div>
            </div>
            <div style={{ flexDirection: "row", width: "100%" }}>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 12,
                  textTransform: "uppercase",
                  marginRight: 10,
                }}
              >
                From branch: <b>{items?.from_name}</b>
              </div>
            </div>
            <div style={{ flexDirection: "row", width: "100%" }}>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 12,
                  textTransform: "uppercase",
                  marginRight: 10,
                }}
              >
                Raised by: <b>{items?.raise_by}</b>
              </div>
            </div>
            <div style={{ flexDirection: "row", width: "100%" }}>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 14,

                  textTransform: "uppercase",
                  marginRight: 10,
                }}
              >
                Subject: <b>{items?.subject}</b>
              </div>
            </div>
            <div style={{ flexDirection: "row", width: "100%" }}>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 14,

                  textTransform: "uppercase",
                  marginRight: 10,
                }}
              >
                Purpose: <b>{items?.purpose}</b>
              </div>
            </div>
            <div style={{ flexDirection: "row", width: "100%" }}>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 14,

                  textTransform: "uppercase",
                  marginRight: 10,
                }}
              >
                Details: <br />
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>Unit Cost</th>
                      <th>Quantity</th>
                      <th>Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemList.map((item) => (
                      <tr key={item.item_list_id}>
                        <td>{item.item_name}</td>
                        <td className="text-right">
                          {Number(item.unit_cost).toLocaleString()}
                        </td>
                        <td className="text-center">
                          {Number(item.quantity).toLocaleString()}
                        </td>
                        <td className="text-right">
                          {(item.unit_cost * item.quantity).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} className="text-right fw-bold">
                        Total:
                      </td>
                      <td className="text-right">
                        {formatNumber(items?.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div
            style={{ flexDirection: "column", width: "100%", marginBottom: 60 }}
          >
            <div style={{ flexDirection: "row", width: "100%" }}>
              <Row>
                <Col md={6} className="mb-3">
                  <Label>Select Heading</Label>
                  <Input
                    onChange={handleChange}
                    size="sm"
                    name="heading1"
                    type="select"
                    autoComplete="disabled"
                    value={form.heading1}
                    className="form-control"
                  >
                    <option value="">--Select account type--</option>
                    {heading1.map((option, i) => (
                      <option value={option.heading1} key={i}>
                        {option.name}
                      </option>
                    ))}
                  </Input>
                </Col>

                <Col md={6} className="mb-3">
                  <Label>Select description</Label>
                  <Typeahead
                    id="single-select-typeahead"
                    size="sm"
                    className="col-md-12 pl-0 pr-0 custom-typeahead-border"
                    options={description}
                    placeholder="Select description..."
                    onChange={(selectedItems) =>
                      setForm((prev) => ({
                        ...prev,
                        description: selectedItems[0]?.name || "",
                      }))
                    }
                    selected={
                      form.description ? [{ name: form.description }] : []
                    }
                    labelKey="name"
                    style={{
                      borderRadius: "7px",
                    }}
                  />
                </Col>
              </Row>
            </div>
          </div>
        </div>
      </CustomModal>
    </CustomCard>
  );
}

export default MemoAccountVerification;
