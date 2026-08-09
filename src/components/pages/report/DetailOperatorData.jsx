/* eslint-disable no-unused-vars */
import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomTable from "@/common/Custom/CustomTable";
import CustomTable1 from "@/common/Custom/CustomTable1";
import Loading from "@/common/Custom/Loading";
import { formatNumber1, formatNaira } from "@/components/router/utilities";
import { _postApi } from "@/redux/actions/api";

import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { FaEye } from "react-icons/fa";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Alert, Input, Label, Row } from "reactstrap";
import { Col } from "reactstrap/lib";
import { toast } from "sonner";

export default function DetailOperatorData() {
  // const { activeBusiness, user } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const team_id = queryParams.get("team_id");
  const [pr, setPr] = useState([]);
  const { activeBusiness = {} } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  const getInventory = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=details_rate`,
      { facilityId: activeBusiness.id, team_id: team_id },
      (resp) => {
        if (resp.success) {
          setPr(resp.results);
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
    getInventory();
  }, []);

  const fields = [
    {
      title: "Date",
      custom: true,
      component: (item) => <div className="text-center">{item.date}</div>,
    },
    {
      title: "Team ID",
      custom: true,
      component: (item) => <div className="text-center">{item.team_id}</div>,
    },
    {
      title: "Team Leader",
      custom: true,
      component: (item) => <div>{item.team_leader}</div>,
    },
    {
      title: "Customer Name",
      custom: true,
      component: (item) => <div>{item.customer_name}</div>,
    },
    {
      title: "Shift",
      custom: true,
      component: (item) => <div>{item.shift}</div>,
    },
    {
      title: "Type of Goods",
      custom: true,
      component: (item) => <div>{item.type_of_goods}</div>,
    },
    {
      title: "Operator rate",
      custom: true,
      component: (item) => (
        <div className="text-center">{formatNumber1(item.oprators_rate)}</div>
      ),
    },
    {
      title: "Qty Produce",
      custom: true,
      component: (item) => (
        <div className="text-center">{formatNumber1(item.qty_produce)}</div>
      ),
    },
    {
      title: "Debit(₦)",
      custom: true,
      component: (item) => (
        <div className="text-right">{formatNumber1(item.dr)}</div>
      ),
    },
    {
      title: "Credit(₦)",
      custom: true,
      component: (item) => (
        <div className="text-right">{formatNumber1(item.cr)}</div>
      ),
    },
  ];

  const filteredPr = pr.filter((item) => {
    const matchesSearch = searchTerm
      ? item.team_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.team_leader.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    return matchesSearch;
  });

  return (
    <>
      <CustomCard back header="Detail Operator Summary">
        {/* {JSON.stringify({ team_id, pr })} */}
        <div className="d-flex align-items-center justify-content-between">
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
        <Row className="mx-0">
          {loading && <Loading />}
          {!loading ? (
            <CustomTable1
              data={filteredPr}
              fields={fields}
              className={"mb-0"}
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
