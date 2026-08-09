import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomTable1 from "@/common/Custom/CustomTable1";
import Loading from "@/common/Custom/Loading";
import { formatNumber1, formatNaira } from "@/components/router/utilities";
import { _postApi } from "@/redux/actions/api";

import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
// import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Alert, Input, Label, Row } from "reactstrap";
import { Col } from "reactstrap/lib";

export default function OperationDashboard() {
  // const { activeBusiness, user } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [pr, setPr] = useState([]);
  const { activeBusiness } = useSelector((state) => state.auth);
  const today = moment().format("YYYY-MM-DD");
  const janFirst = moment().startOf("year").format("YYYY-MM-DD");
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState(janFirst);
  const [toDate, setToDate] = useState(today);

  const getInventory = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    _postApi(
      `/inventory/product-list?query_type=operate_rate`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setPr(resp.results);
        } else {
          toast.error("Failed to load chart data.");
        }
        setLoading(false);
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
        setLoading(false);
      }
    );
  }, [activeBusiness]);

  useEffect(() => {
    getInventory();
  }, [getInventory]);

  const fields = [
    {
      value: "date",
      title: "Date",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-sm">{item.date || "-"}</div>
      ),
    },
    {
      value: "team_id",
      title: "Team ID",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="font-medium">{item.team_id || "-"}</div>
      ),
    },
    {
      value: "team_leader",
      title: "Team Leader",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-sm">{item.team_leader || "-"}</div>
      ),
    },
    {
      value: "debit",
      title: "Debit(₦)",
      custom: true,
      className: "text-right",
      component: (item) => (
        <div className="text-sm font-semibold">{formatNumber1(item.debit || 0)}</div>
      ),
    },
    {
      value: "credit",
      title: "Credit(₦)",
      custom: true,
      className: "text-right",
      component: (item) => (
        <div className="text-sm font-semibold">{formatNumber1(item.credit || 0)}</div>
      ),
    },
    {
      value: "balance",
      title: "Balance(₦)",
      custom: true,
      className: "text-right",
      component: (item) => (
        <div className="text-sm font-semibold">
          {formatNumber1(Math.abs(item.balance || 0))}
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
              navigate(
                `/app/reports/detail-operator-data?team_id=${item.team_id}`
              );
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

  const filteredPr = pr.filter((item) => {
    const itemDate = moment(item.date);
    const isWithinRange =
      itemDate.isSameOrAfter(fromDate) && itemDate.isSameOrBefore(toDate);

    const matchesSearch = searchTerm
      ? item.team_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.team_leader.toLowerCase().includes(searchTerm.toLowerCase())
      : true;

    return isWithinRange && matchesSearch;
  });

  return (
    <>
      <CustomCard header="Operation Dashboard">
        {/* {JSON.stringify({ pr })} */}
        <div className="d-flex align-items-center justify-content-between">
          <CustomButton
            size="sm"
            color="primary"
            className="mb-2"
            onClick={() => {
              navigate("/app/reports/operation-deposit");
            }}
          >
            Operation Deposit
          </CustomButton>
          <span className="d-flex justify-content-end align-items-center gap-2 mb-2 ml-auto">
            <Label for="searchFilter" className="mb-0 mr-2">
              Search:
            </Label>
            <Input
              id="searchFilter"
              type="text"
              bsSize="sm"
              placeholder="Search by Team ID, Team Leader"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </span>
        </div>
        <Row className="mb-4">
          <Col md={6}>
            <Label>From Date</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </Col>
          <Col md={6}>
            <Label>To Date</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </Col>
        </Row>
        <Row className="mx-0">
          {loading ? (
            <div className="d-flex justify-content-center my-5">
              <Loading />
            </div>
          ) : filteredPr && filteredPr.length > 0 ? (
            <CustomTable1
              data={filteredPr}
              fields={fields}
              loading={loading}
              pageSize={10}
              message="No operation data found"
            />
          ) : (
            <Alert className="mt-3" color="info">
              No data to view
            </Alert>
          )}
        </Row>
      </CustomCard>
    </>
  );
}
