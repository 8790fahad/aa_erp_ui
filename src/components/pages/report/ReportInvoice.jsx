/* eslint-disable no-unused-vars */
import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import DaterangeSelector from "@/common/Custom/DaterangeSelector";
import SearchBar from "@/common/Custom/SearchBar";
import { _postApi } from "@/redux/actions/api";
import { formatNumber, today } from "@/utilities";
import moment from "moment";
import React, { useCallback, useEffect, useState } from "react";
import { AiFillEye } from "react-icons/ai";
import { FiPlus } from "react-icons/fi";
import { useNavigate } from "react-router";
import { CardHeader, CardBody, Table, Button } from "reactstrap";

export default function TransactionReport() {
  const history = useNavigate();
  const [data, setData] = useState([]);
  const [filterText, setFilterText] = useState("");
  const aMonthAgo = moment().subtract(1, "month").format("YYYY-MM-DD");
  const [range, setRange] = useState({
    from: aMonthAgo,
    to: today,
  });
  const handleChange = ({ target: { name, value } }) => {
    setRange((p) => ({ ...p, [name]: value }));
  };
  const getData = useCallback(() => {
    _postApi(
      "/customer/get-invoice",
      { query_type: "select", date_from: aMonthAgo, date_to: today },
      (data) => {
        setData(data.results);
      },
      (err) => {
        console.log(err);
      }
    );
  }, [aMonthAgo]);

  useEffect(() => {
    getData();
  }, [getData]);

  let rows = [];
  data &&
    data.forEach((item, i) => {
      if (
        item.invoice_no.toLowerCase().indexOf(filterText.toLowerCase()) ===
          -1 &&
        item.name.toLowerCase().indexOf(filterText.toLowerCase()) === -1
      )
        return;

      rows.push(item);
    });

  return (
    <>
      {/* {JSON.stringify(data)} */}

      <CustomCard header="Invoices">
        <CardHeader>
          <CustomButton
            onClick={() => history("/app/reports/invoice-report-new")}
            className="m-2 d-flex align-items-center"
          >
            <FiPlus /> Add New Invoice
          </CustomButton>
        </CardHeader>
        <CardBody>
          <DaterangeSelector
            handleChange={handleChange}
            from={range.from}
            to={range.to}
          />
          <SearchBar
            placeholder="Search by invoice or customer name"
            onFilterTextChange={(val) => setFilterText(val)}
            filterText={filterText}
          />
          <Table bordered className="mt-3">
            <thead>
              <tr>
                <th>S/N</th>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Custormer Name</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>{item.invoice_no}</td>
                  <td>{moment(item.created_at).format("DD-MM-YYYY")}</td>
                  <td>{item.name}</td>
                  <td>{item.item_name}</td>
                  <td>{formatNumber(item.amount)}</td>
                  <td className="text-right">
                    <Button
                      color="success"
                      className="flex gap-1 justify-center items-center"
                      size="sm"
                      onClick={() =>
                        history(
                          `/app/reports/view-invoice?invoice_no=${item.invoice_no}`
                        )
                      }
                    >
                      <AiFillEye className="mr-1" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </CustomCard>
    </>
  );
}
