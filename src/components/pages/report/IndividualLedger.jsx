import { useEffect, useState } from "react";
import { Table } from "react-bootstrap";
import { formatNumber1 } from "@/components/router/utilities";
import { _postApi } from "@/redux/actions/api";
import CustomCard from "@/common/Custom/CustomCard2";
import { useLocation, useNavigate } from "react-router-dom";

const IndividualLedger = () => {
  const [trialBalanceData, setTrialBalanceData] = useState([]);
  const [data, setData] = useState([]);
  const location = useLocation();
  const queryParam = new URLSearchParams(location.search);
  const account_subhead = queryParam.get("subhead");
  const description = queryParam.get("description");
  const navigate = useNavigate();
  useEffect(() => {
    _postApi(
      `/get_cash_report?query_type=individual_ledger&subhead=${account_subhead}`,
      {},
      (data) => {
        if (data.success){
          console.log(data);
          setData(data)
          setTrialBalanceData(data.results);
        }
        else {
          console.log("something is wrong");
        }
      },
      (err) => {
        console.log("Stupid error:", err);
      }
    );
  }, [account_subhead]);
  return (
    <CustomCard back header={`${description.toUpperCase()} LEDGER`}>
      {/* {JSON.stringify(data)} */}
      <div className="container-fluid p-0">
        <style>
          {`
            h1{
              font-size: 20px;
              text-align: center;
            }
            .balance{
              border-bottom: 3px solid black;
              border-top: 3px solid black;
            }
          `}
        </style>

        <Table striped hover bordered>
          <thead>
            <tr>
              <th className="text-center">S/N</th>
              <th className="text-center">Date</th>
              <th className="text-center">Description</th>
              <th className="text-center">Debit(₦)</th>
              <th className="text-center">Credit(₦)</th>
              <th className="text-center">Balance(₦)</th>
            </tr>
          </thead>
          <tbody>
            {trialBalanceData.length > 0 ? (trialBalanceData?.map((item, idx) => (
              <tr key={item.sn}>
                <td className="text-center">{idx + 1}</td>
                <td className="text-right">{item.transaction_date}</td>
                <td
                  className="individualhover"
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    navigate(
                      `/app/reports/supplier_individual_ledger?account_code=${item.account_code}`
                    )
                  }
                >
                  {item.account_description}
                </td>
                <td className="text-right">
                  {item.debit !== 0 ? formatNumber1(item.debit) : "-"}
                </td>
                <td className="text-right">
                  {item.credit !== 0 ? formatNumber1(item.credit) : "-"}
                </td>
                <td className="text-right">
                  {item.balance !== 0
                    ? formatNumber1(Math.abs(item.balance))
                    : "-"}
                </td>
              </tr>) 
              ))
              :
              (
                <tr >
                <td colSpan={6} className="text-center fw-bold">No data found.</td>
                </tr>
              )
            }
          </tbody>
        </Table>
      </div>
    </CustomCard>
  );
};

export default IndividualLedger;
