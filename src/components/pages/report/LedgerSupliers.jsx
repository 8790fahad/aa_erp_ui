import { useEffect, useState } from "react";
import { Table } from "react-bootstrap";

import { _fetchApi } from "@/redux/actions/api";
import CustomCard from "@/common/Custom/CustomCard2";
import { useLocation, useNavigate } from "react-router-dom";
import { formatNumber1, formatNaira } from "@/components/router/utilities";

const LedgerSupliers = () => {
  const [trialBalanceData, setTrialBalanceData] = useState([]);
  const location = useLocation();
  const queryParam = new URLSearchParams(location.search);
  const account_description = queryParam.get("account_description");
  const navigate = useNavigate();
  useEffect(() => {
    _fetchApi(
      `/get_cash_report?query_type=individual_ledger&account_description==${account_description}`,
      (data) => {
        console.log(data);
        setTrialBalanceData(data.results);
      },
      (err) => {
        console.log(err);
      }
    );
  }, [account_description]);
  return (
    <CustomCard header="LEDGER SUPPLIERS">
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
              <th>S/N</th>
              <th>Description</th>
              <th>Debit</th>
              <th>Credit</th>
            </tr>
          </thead>
          <tbody>
            {trialBalanceData?.map((item, idx) => (
              <tr key={item.sn}>
                <td className="text-center">{idx + 1}</td>
                <td
                  onClick={() =>
                    navigate(
                      `/app/report/ledger_suppliers? account_description=${item.description}`
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

export default LedgerSupliers;
