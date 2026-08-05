import { useEffect, useState } from "react";
import { Table } from "react-bootstrap";
import { _postApi } from "@/redux/actions/api";
import CustomCard from "@/common/Custom/CustomCard2";
import { useNavigate } from "react-router-dom";
import { formatNumber1 } from "@/components/router/utilities";

const Trailbalance = () => {
  const [trialBalanceData, setTrialBalanceData] = useState([]);
  const navigate = useNavigate();
  useEffect(() => {
    _postApi(
      `/get_cash_report?query_type=Trial_Balance&code=210`,
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
    <CustomCard header="TRIAL BALANCE">
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
          {/* {JSON.stringify(trialBalanceData)} */}
          <thead>
            <tr>
              <th className="text-center">S/N</th>
              <th className="text-center">Description</th>
              <th className="text-center">Debit</th>
              <th className="text-center">Credit</th>
            </tr>
          </thead>
          <tbody>
            {trialBalanceData?.map((item, idx) => (
              <tr key={item.sn}>
                <td className="text-center">{idx + 1}</td>
                <td
                  onClick={() =>
                    navigate(
                      `/app/reports/individual_ledger?subhead=${item.account_subhead}&description=${item.description}`
                    )
                  }
                  className="individualhover"
                  style={{ cursor: "pointer" }}
                >
                  {item.description}
                </td>
                <td className="text-right">
                  {item.debit !== 0 ? formatNumber1(item.debit) : "-"}
                </td>
                <td className="text-right">
                  {item.credit !== 0 ? formatNumber1(item.credit) : "-"}
                </td>
              </tr>
            ))}
            <tr>
              <td></td>
              <td></td>
              <td
                className="balance text-right"
                style={{
                  borderBottom: "3px solid black",
                  borderTop: "3px solid black",
                }}
              >
                {formatNumber1(
                  trialBalanceData.reduce((acc, item) => acc + item.debit, 0)
                )}
              </td>
              <td
                className="balance text-right"
                style={{
                  borderBottom: "3px solid black",
                  borderTop: "3px solid black",
                }}
              >
                {formatNumber1(
                  trialBalanceData.reduce((acc, item) => acc + item.credit, 0)
                )}
              </td>
            </tr>
          </tbody>
        </Table>
      </div>
    </CustomCard>
  );
};

export default Trailbalance;
