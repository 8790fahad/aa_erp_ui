import { useEffect, useState } from "react";
import { Table } from "react-bootstrap";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import CustomCard from "@/common/Custom/CustomCard2";
import { useLocation } from "react-router-dom";
import { formatNumber1 } from "@/components/router/utilities";

const SupplierIndividualLedger = () => {
  const [trialBalanceData, setTrialBalanceData] = useState([]);
  const location = useLocation();
  const queryParam = new URLSearchParams(location.search);
  const account_code = queryParam.get("account_code");
  // const navigate = useNavigate();
  useEffect(() => {
    _postApi(
      `/get_cash_report?query_type=supplier_individual_ledger&code=${account_code}`,
      {},
      (data) => {
        console.log(data);
        setTrialBalanceData(data.results);
      },
      (err) => {
        console.log(err);
      }
    );
  }, []);
  return (
    <CustomCard back header={`${trialBalanceData[0]?.account_description?.toUpperCase()} LEDGER`}>
      {/* {JSON.stringify(trialBalanceData)} */}
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
              {/* <th>Item Name</th> */}
              <th className="text-center">Description</th>
              <th  className="text-center">DR(₦)</th>
              <th  className="text-center">CR(₦)</th>
              <th  className="text-center">Balance(₦)</th>
            </tr>
          </thead>
          <tbody>
            {trialBalanceData?.map((item, idx) => (
              <tr key={item.sn}>
                <td className="text-center">{idx + 1}</td>
                <td className="text-right">{item.transaction_date}</td>
                <td>{item.account_description}</td>
                <td className="text-right">
                  {item.debit !== 0
                    ? formatNumber1(Math.abs(item.debit))
                    : "-"}
                </td>
                <td className="text-right">
                  {item.credit !== 0
                    ? formatNumber1(Math.abs(item.credit))
                    : "-"}
                </td>
                <td className="text-right">
                  {item.balance !== 0
                    ? formatNumber1(Math.abs(item.balance))
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </CustomCard>
  );
};

export default SupplierIndividualLedger;
