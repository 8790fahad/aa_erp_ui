/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Input, Label, Row } from "reactstrap";
import { useSelector } from "react-redux";
import { Eye } from "lucide-react";
import moment from "moment";
import { Plus } from "lucide-react";
import { _fetchApi } from "@/redux/actions/api";
import CustomButton from "@/common/Custom/CustomButton";
import { useNavigate } from "react-router-dom";
import Loading from "@/common/Custom/Loading";
import CustomTable1 from "@/common/Custom/CustomTable1";
import CustomModal from "@/common/Custom/CustomModal";
import CustomCard from "@/common/Custom/CustomCard2";
import { Button } from "@/components/ui/button";

function PaymentVoucher() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [memos, setMemos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const getMemos = useCallback(() => {
    _fetchApi(
      `/account/get-memo/${activeBusiness.id}/approved/${user.id}/list`,
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
  useEffect(() => {
    getMemos();
  }, [getMemos]);

  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState({});
  const toggle = (item) => {
    setItems(item);
    setIsOpen(!isOpen);
  };
  const fields = [
    {
      value: "date",
      title: "Date",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-sm">
          {item.date ? moment(item.date).format("YYYY-MM-DD") : "-"}
        </div>
      ),
    },
    {
      value: "memo_id",
      title: "Memo No.",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="font-medium">{item.memo_id}</div>
      ),
    },
    {
      value: "from_name",
      title: "From",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-sm">{item.from_name || "-"}</div>
      ),
    },
    {
      value: "status",
      title: "Status",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="flex justify-center">
          <Badge color="success">{item.status}</Badge>
        </div>
      ),
    },
    {
      value: "action",
      title: "Action",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="flex justify-center gap-2 flex-wrap">
          <CustomButton
            color="success"
            size="sm"
            className="m-1 d-flex align-items-center"
            handleSubmit={() => {
              history(
                `/app/account/payment-voucher/memo-pdf/${item.id}?id=${item.memo_id}`
              );
            }}
          >
            <Eye size={16} className="mr-1" /> Process Memo
          </CustomButton>
          <CustomButton
            color="primary"
            size="sm"
            className="m-1 d-flex align-items-center"
            handleSubmit={() => {
              history("/app/account/new");
            }}
          >
            <Plus size={16} className="mr-1" /> Direct PV
          </CustomButton>
        </div>
      ),
    },
  ];
  const history = useNavigate();

  const filteredMemos = memos.filter((memo) => {
    return searchTerm
      ? memo.from_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          memo.memo_id.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
  });

  return (
    <CustomCard header="Payment Voucher">
      {/* {JSON.stringify(memos)} */}
      <div className="mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <CustomButton
          size="sm"
          color="primary"
          onClick={() => {
            history("/app/account/new");
          }}
        >
          <Plus className="mr-1" size={16} />
          Create Direct PV
        </CustomButton>
        <div className="d-flex align-items-center gap-2">
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
      </div>
      <Row className="mx-0">
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
            message="No payment vouchers found"
          />
        ) : (
          <center>
            <Alert className="mt-3" color="info">
              No data to view
            </Alert>
          </center>
        )}
      </Row>
      <CustomModal isOpen={isOpen} toggle={toggle} header="Preview">
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
              {activeBusiness.business_name}
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
                The Managing Director,
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
                From: <b>{items?.from_name}</b>
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
                Date: <b>{moment().format(items?.date)}</b>
              </div>
            </div>
          </div>

          <div
            style={{ flexDirection: "column", width: "100%", marginBottom: 60 }}
          >
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
          </div>
        </div>
      </CustomModal>
    </CustomCard>
  );
}

export default PaymentVoucher;
