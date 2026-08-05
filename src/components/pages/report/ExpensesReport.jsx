/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import DaterangeSelector from "@/common/Custom/DaterangeSelector";
import SearchBar from "@/common/Custom/SearchBar";
import SearchStoresInput from "@/common/Custom/SearchStoresInput";
import { CURRENCY } from "@/constants";
import { getAllReport } from "@/redux/actions/reports";
import { formatNumber, today } from "@/utilities";
import moment from "moment";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import {
  Card,
  CardHeader,
  CardBody,
  Table,
  Row,
  Col,
} from "reactstrap";
export default function ExpensesReport() {
  // const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const options = useSelector((state) => state.stores.storeList);
  // const data = useSelector((state) => state.purchase.purchaseList);
  const history = useNavigate();
  const [activeStore, setActiveStore] = useState(
    options.length ? options[0].storeName : ""
  );
  const dispatch = useDispatch();
  const [list, setList] = useState([]);
  const aMonthAgo = moment().subtract(1, "month").format("YYYY-MM-DD");
  const facilityId = useSelector((state) => state.auth.activeBusiness.id);
  const [range, setRange] = useState({
    from: aMonthAgo,
    to: today,
  });
  const getReports = useCallback(() => {
    dispatch(
      getAllReport(setList, range.from, range.to, "Expenses category summary")
    );
  }, [dispatch, range]);

  useEffect(() => {
    getReports();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getReports]);
  const handleChange = ({ target: { name, value } }) => {
    setRange((p) => ({ ...p, [name]: value }));
  };
  const rows = [];
  list.length ? (
    list.forEach((item, i) => {
      if (
        item.description
          .toString()
          .toLowerCase()
          .indexOf(searchText.toLowerCase()) === -1 &&
        item.amount
          .toString()
          .toLowerCase()
          .indexOf(searchText.toLowerCase()) === -1 &&
        item.receive_date
          .toString()
          .toLowerCase()
          .indexOf(searchText.toLowerCase()) === -1
      )
        return;

      rows.push(
        <tr key={i}>
          <td>{i + 1}</td>
          <td>{item.receive_date}</td>
          <td>{item.description}</td>
          <td className="text-right">{formatNumber(item.amount)}</td>
          {/* <td className="text-right">
            {parseInt(item.qty_in) * parseInt(item.unit_price)}
          </td> */}
        </tr>
      );
    })
  ) : (
    <tr>
      <td colSpan={6}>
        <h4 className="text-center">
          There is no data, please check back later
        </h4>
      </td>
    </tr>
  );

  return (
    <>
      <CustomCard header="Expenses Report">
        <CardHeader>
          <Row>
            <Col md={6}>
              <CustomButton
                onClick={() => history("/app/reports/expenses-report-form")}
              >
                ADD NEW EXPENSES
              </CustomButton>{" "}
            </Col>{" "}
            <Col md={6} className="text-center">
            
            </Col>
          </Row>
        </CardHeader>
        {/* {loading&& <Loading />} */}
        <CardBody>
          <DaterangeSelector
            handleChange={handleChange}
            from={range.from}
            to={range.to}
          />
          <Row className="">
            <Col md="6">
              <SearchStoresInput
                onChange={(selected) => {
                  setActiveStore(selected.storeName);
                }}
                activeStore={activeStore}
                defaultStore={activeStore}
              />
            </Col>
            <Col md="6">
              <SearchBar placeholder="search for daily report" />
            </Col>
          </Row>
          <Table bordered className="mt-3">
            <tr>
              <th>S/N</th>
              <th>Date</th>
              <th>Description</th>
              <th>Amount ({CURRENCY})</th>
            </tr>
            {rows}
            <tr>
              <td colSpan={3} className="text-right">
                <strong>Total:</strong>
              </td>
              <td className="text-right">
                <strong>
                  {list.length
                    ? list.reduce(
                        (cost, item) =>
                          parseFloat(cost) + parseInt(item.amount),
                        0
                      )
                    : "-"}
                </strong>
              </td>
            </tr>
          </Table>
        </CardBody>
      </CustomCard>
    </>
  );
}
