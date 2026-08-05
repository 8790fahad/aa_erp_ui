/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable react/no-unescaped-entities */
import React, { useEffect, useState } from "react";
import { Table } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import { _fetchApi } from "@/redux/actions/api";
import CustomButton from "@/common/Custom/CustomButton";

const CashFlows = () => {
  const [revenue, setRevenue] = useState([]);
  const [revenueEx, setRevenueEx] = useState([]);
  const [expense, setExpense] = useState([]);
  const [mdaRev, setMdaRev] = useState([]);

  const navigate = useNavigate();
  const [asset, setAsset] = useState([]);
  const [aidAndGrant, setAidAndGrant] = useState([]);
  const notes = ["1a", "1b", "2", "3", "4", "6", "7"];


  const handleRowClick = (note, description, economicCode) => {
    // navigate(.reports.noteReport, {
    //   state: {
    //     note: note,
    //     description: description,
    //     economicCode: economicCode,
    //   },
    // });
  };

  useEffect(() => {
    // _fetchApi(`/get_cash_report?query_type=non_exchange&code=1101`
    //   ,(data) => {
    //     console.log(data);
    //     setRevenue(data.result);
    //   }
    //   ,(err) => {
    //     console.log(err);
    //   });
    _fetchApi(`/get_cash_report?query_type=Expenditure&code=220`
      ,(data) => {
        // console.log(data);
        // alert(JSON.stringify(data.filter((item) => item.amount !== 0)));
        setExpense(data.result);
      }
      ,(err) => {
        console.log(err);
      });
    // _fetchApi(`/get_cash_report?query_type=exchange&code=120`
    //   ,(data) => {
    //     console.log(data);
    //     setRevenueEx(data.result);
    //   }
    //   ,(err) => {
    //     console.log(err);
    //   });

    _fetchApi(`/get_cash_report?query_type=mda_rev`
      ,(data) => {
        // console.log(data);
        setMdaRev(data.result);
      }
      ,(err) => {
        console.log(err);
      });

    _fetchApi(`/get_cash_report?query_type=asset&code=320`
      ,(data) => {
        // console.log(data);
        setAsset(data.result);
      }
      ,(err) => {
        console.log(err);
      });
    _fetchApi(`/get_cash_report?query_type=asset&code=130`
      ,(data) => {
        // console.log(data);
        setAidAndGrant(data.result);
      }
      ,(err) => {
        console.log(err);
      });
  }, []);

  const sur = revenue?.reduce(
    (sum, item) => sum + (item.amount || 0),
    0 - expense?.reduce((sum, item) => sum + (item.amount || 0), 0)
  );

  const amount = {
    textAlign: "right",
    borderRight: "none",
  };

  // const totalAsset = calculateTotal(asset);

  const downloadPDF = () => {
    const input = document.getElementById("cashflow-table");
    html2canvas(input),((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new 2("l", "mm", "a4");
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save("cashflow-report.pdf");
    });
  };
  
  const calculateTotal = (asset) => {
    return asset?.reduce((total, item) => {
      const amount = item.credit > 0 ? item.credit : -item.debit;
      return total + amount;
    }, 0);
  };

  const totalAsset = calculateTotal(asset);
  return (
    <div className="">
      <div className="d-flex justify-content-end align-items-center mr-4">

      <CustomButton
        onClick={downloadPDF}
      >
        Download as PDF
      </CustomButton>
      </div>
      <style>
        {`
             .description {
               font-weight: bolder;
             }
             .subtotal-row {
               font-weight: bold;
               // background-color: #fff;
             }
             .total-row {
               // border-top: 3px solid #000;
               // border-bottom: 3px solid #000;
               font-weight: bold;
               // background-color: #ddd;
             }
               h1{
               color: #4267B2;
               font-size: 20px;
               margin: 0;
               padding: 0;
               padding-bottom: 10px;
               text-align: center;
               }
               footer {
               background: linear-gradient(to right, #4267B2,rgb(130, 167, 240));
               padding: 20px;
               }
           `}
      </style>
      <div id="cashflow-table" className="p-3">
        <div
          style={{
            background: "linear-gradient(to right, #4267B2,rgb(130, 167, 240)",
            padding: "40px 50px 2px 50px",
            borderBottom: "4px solid #4267B2",
            marginBottom: "15px",
            textAlign: "center",
          }}
        >
          Report of the Accountant General with IPSAS Accrual Financial
          Statements for the Year Ended 31st December, 2023
        </div>
        {/* <h1>Katsina State Government of Nigeria</h1> */}
        <h1>
          Consolidated Statement of Financial Performance (Income & Expenditure)
          for the Year Ended 31st December, 2023
        </h1>
        <Table
          hover
          bordered
          responsive
          striped
          style={{
            fontSize: "15px",
          }}
        >
          <thead>
            <tr>
              <th>Description</th>
              <th>Notes</th>
              <th>2023 (N'000)</th>
              <th>2022 (N'000)</th>
            </tr>
          </thead>
          <tbody
            
          >
            <React.Fragment>
              <>
                <tr>
                  <td
                    colSpan="4"
                    className=" font-weight-bold "
                    style={{
                      fontWeight: "bold",
                      fontSize: "15px",
                      textTransform: "uppercase",
                      width: "50%",
                      paddingLeft: "20%",
                    }}
                  >
                    Cash Flows from operating Activities
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan="4"
                    className="bg-light font-weight-bold"
                    style={{
                      fontWeight: "bold",
                      fontSize: "15px",
                      textTransform: "uppercase",
                    }}
                  >
                    Revenue:
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan="4"
                    className="bg-light font-weight-bold"
                    style={{
                      fontWeight: "bold",
                      fontSize: "15px",
                      textTransform: "uppercase",
                    }}
                  >
                    Revenue from Non-Exchange
                    Transactions:
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan="4"
                    className="bg-light font-weight-bold"
                    style={{
                      fontWeight: "bold",
                      fontSize: "15px",
                      textTransform: "uppercase",
                    }}
                  >
                    FGN:
                  </td>
                </tr>
                {revenue?.map((item, subIndex) => (
                  <tr
                    key={subIndex}
                    onClick={() =>
                      handleRowClick(
                        notes[subIndex],
                        item.description,
                        item.economic_code
                      )
                    }
                  >
                    <td style={{ borderRight: "none" }}>{item?.description}</td>
                    <td style={amount}>{notes[subIndex]}</td>
                    <td style={amount} className="text-right">
                      {item.amount?.toLocaleString()}
                    </td>
                    <td style={amount} className="text-right">
                      {item.amount?.toLocaleString()}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td
                    className="font-weight-bold"
                    style={{
                      fontWeight: "700",
                      fontSize: "14px",
                      textTransform: "uppercase",
                    }}
                  >
                    SubTotal
                  </td>
                  <td></td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "3px solid black",
                      borderBottom: "3px solid black",
                      fontWeight: "bold",
                      textAlign: "right",
                    }}
                  >
                    {revenue
                      ?.reduce((sum, item) => sum + (item.amount || 0), 0)
                      .toLocaleString()}
                  </td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "3px solid black",
                      borderBottom: "3px solid black",
                      fontWeight: "bold",
                      textAlign: "right",
                    }}
                  >
                    {revenue
                      ?.reduce((sum, item) => sum + (item.amount || 0), 0)
                      .toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan="4"
                    className="bg-light font-weight-bold"
                    style={{
                      fontWeight: "bold",
                      fontSize: "15px",
                      textTransform: "uppercase",
                    }}
                  >
                    State:
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan="4"
                    className="bg-light font-weight-bold"
                    style={{
                      fontWeight: "bold",
                      fontSize: "15px",
                      textTransform: "uppercase",
                    }}
                  >
                    Revenue from Non-Exchange Transactions
                  </td>
                </tr>
                {revenueEx?.map((item, subIndex) => (
                  <tr key={subIndex}>
                    <td style={{ borderRight: "none" }}>{item?.description}</td>
                    <td style={amount}>{item?.notes}</td>
                    <td style={amount} className="text-right">
                      {item.amount?.toLocaleString()}
                    </td>
                    <td style={amount} className="text-right">
                      {item.amount?.toLocaleString()}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td
                    className="font-weight-bold"
                    style={{
                      fontWeight: "700",
                      fontSize: "14px",
                      textTransform: "uppercase",
                    }}
                  >
                    Sub Total
                  </td>
                  <td></td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "3px solid black",
                      borderBottom: "3px solid black",
                      fontWeight: "bold",
                      textAlign: "right",
                    }}
                  >
                    {revenueEx
                      ?.reduce((sum, item) => sum + (item.amount || 0), 0)
                      .toLocaleString()}
                  </td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "3px solid black",
                      borderBottom: "3px solid black",
                      fontWeight: "bold",
                      textAlign: "right",
                    }}
                  >
                    {revenueEx
                      ?.reduce((sum, item) => sum + (item.amount || 0), 0)
                      .toLocaleString()}
                  </td>
                </tr>

                <tr>
                  <td
                    className="font-weight-bold"
                    style={{
                      fontWeight: "700",
                      fontSize: "14px",
                      textTransform: "uppercase",
                    }}
                  >
                    Total Revenue From Non-Exchange Transactions:
                  </td>
                  <td></td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "4px solid black",
                      borderBottom: "4px solid black",
                      fontWeight: "bolder",
                      textAlign: "right",
                    }}
                  >
                    {(
                      revenueEx?.reduce(
                        (sum, item) => sum + (item.amount || 0),
                        0
                      ) +
                      revenue?.reduce(
                        (sum, item) => sum + (item.amount || 0),
                        0
                      )
                    ).toLocaleString()}
                  </td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "4px solid black",
                      borderBottom: "4px solid black",
                      fontWeight: "bold",
                      textAlign: "right",
                    }}
                  >
                    {(
                      revenueEx?.reduce(
                        (sum, item) => sum + (item.amount || 0),
                        0
                      ) +
                      revenue?.reduce(
                        (sum, item) => sum + (item.amount || 0),
                        0
                      )
                    ).toLocaleString()}
                  </td>
                </tr>

                <tr>
                  <td
                    colSpan="4"
                    className="bg-light font-weight-bold"
                    style={{
                      fontWeight: "bold",
                      fontSize: "15px",
                      textTransform: "uppercase",
                    }}
                  >
                    Revenue from Exchange Transactions
                  </td>
                </tr>
                {mdaRev?.map((item, subIndex) => (
                  <tr key={subIndex}>
                    <td style={{ borderRight: "none" }}>{item?.description}</td>
                    <td style={amount}>{item?.notes}</td>
                    <td style={amount} className="text-right">
                      {item.amount?.toLocaleString()}
                    </td>
                    <td style={amount} className="text-right">
                      {item.amount?.toLocaleString()}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td
                    className="font-weight-bold"
                    style={{
                      fontWeight: "700",
                      fontSize: "14px",
                      textTransform: "uppercase",
                    }}
                  >
                    Total Revenue From Exchange Transactions:
                  </td>
                  <td></td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "3px solid black",
                      borderBottom: "3px solid black",
                      fontWeight: "bold",
                      textAlign: "right",
                    }}
                  >
                    {mdaRev
                      ?.reduce((sum, item) => sum + (item.amount || 0), 0)
                      .toLocaleString()}
                  </td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "3px solid black",
                      borderBottom: "3px solid black",
                      fontWeight: "bold",
                      textAlign: "right",
                    }}
                  >
                    {mdaRev
                      ?.reduce((sum, item) => sum + (item.amount || 0), 0)
                      .toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td
                    className="font-weight-bold"
                    style={{
                      fontWeight: "700",
                      fontSize: "14px",
                      textTransform: "uppercase",
                    }}
                  >
                    Total Inflows From Operating Activities
                  </td>
                  <td></td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "4px solid black",
                      borderBottom: "4px solid black",
                      fontWeight: "bolder",
                      textAlign: "right",
                    }}
                  >
                    {(
                      revenueEx?.reduce(
                        (sum, item) => sum + (item.amount || 0),
                        0
                      ) +
                      revenue?.reduce(
                        (sum, item) => sum + (item.amount || 0),
                        0
                      ) +
                      mdaRev?.reduce((sum, item) => sum + (item.amount || 0), 0)
                    ).toLocaleString()}
                  </td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "4px solid black",
                      borderBottom: "4px solid black",
                      fontWeight: "bold",
                      textAlign: "right",
                    }}
                  >
                    {(
                      revenueEx?.reduce(
                        (sum, item) => sum + (item.amount || 0),
                        0
                      ) +
                      revenue?.reduce(
                        (sum, item) => sum + (item.amount || 0),
                        0
                      )
                    ).toLocaleString()}
                  </td>
                </tr>

                {/* Total Expense: Exchange Transactions */}

                <tr>
                  <td
                    colSpan="4"
                    className="bg-light font-weight-bold"
                    style={{
                      fontWeight: "bold",
                      fontSize: "15px",
                      textTransform: "uppercase",
                    }}
                  >
                    OutFlows:
                  </td>
                </tr>
                {expense?.map((item, subIndex) => (
                  <tr key={subIndex}>
                    <td style={{ borderRight: "none" }}>{item?.description}</td>
                    <td style={amount}>{item?.notes}</td>
                    <td style={amount} className="text-right">
                      ({item.amount?.toLocaleString()})
                    </td>
                    <td style={amount} className="text-right">
                      ({item.amount?.toLocaleString()})
                    </td>
                  </tr>
                ))}

                <tr>
                  <td
                    className="font-weight-bold"
                    style={{
                      fontWeight: "700",
                      fontSize: "14px",
                      textTransform: "uppercase",
                    }}
                  >
                    Total OutFlows From Operating Activities
                  </td>
                  <td></td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "3px solid black",
                      borderBottom: "3px solid black",
                      fontWeight: "bold",
                      textAlign: "right",
                    }}
                  >
                    (
                    {expense
                      ?.reduce((sum, item) => sum + (item.amount || 0), 0)
                      .toLocaleString()}
                    )
                  </td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "3px solid black",
                      borderBottom: "3px solid black",
                      fontWeight: "bold",
                      textAlign: "right",
                    }}
                  >
                    (
                    {expense
                      ?.reduce((sum, item) => sum + (item.amount || 0), 0)
                      .toLocaleString()}
                    )
                  </td>
                </tr>
                <tr>
                  <td
                    className="font-weight-bold"
                    style={{
                      fontWeight: "700",
                      fontSize: "14px",
                      textTransform: "uppercase",
                    }}
                  >
                    Net Cash Flows from Operating Activities
                  </td>
                  <td></td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "4px solid black",
                      borderBottom: "4px solid black",
                      fontWeight: "bold",
                      textAlign: "right",
                    }}
                  >
                    {Math.sign(sur) === -1
                      ? `(${Math.abs(sur)?.toLocaleString()})`
                      : sur?.toLocaleString()}
                  </td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "4px solid black",
                      borderBottom: "4px solid black",
                      fontWeight: "bold",
                      textAlign: "right",
                    }}
                  >
                    {Math.sign(sur) === -1
                      ? `(${Math.abs(sur)?.toLocaleString()})`
                      : sur?.toLocaleString()}
                  </td>
                </tr>

                <tr>
                  <td
                    colSpan="4"
                    className="bg-light font-weight-bold"
                    style={{
                      fontWeight: "bold",
                      fontSize: "15px",
                      textTransform: "uppercase",
                    }}
                  >
                    Cash Flows from Investing Activities
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan="4"
                    className="bg-light font-weight-bold"
                    style={{
                      fontWeight: "bold",
                      fontSize: "15px",
                      textTransform: "uppercase",
                    }}
                  >
                    capital Expenditure:
                  </td>
                </tr>
                {asset?.map((item, subIndex) => (
                  <tr key={subIndex}>
                    <td style={{ borderRight: "none" }}>{item?.description}</td>
                    <td style={amount}>{item?.notes}</td>
                    <td style={amount} className="text-right">
                      {item.credit > 0 ? item.credit : `(${item.debit})`}
                    </td>
                    <td style={amount} className="text-right">
                      {item.credit > 0 ? item.credit : `(${item.debit})`}
                    </td>
                  </tr>
                ))}

                <tr>
                  <td
                    className="font-weight-bold"
                    style={{
                      fontWeight: "700",
                      fontSize: "14px",
                      textTransform: "uppercase",
                    }}
                  >
                    Total Outflow From Investing Activities
                  </td>
                  <td></td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "4px solid black",
                      borderBottom: "4px solid black",
                      fontWeight: "bolder",
                      textAlign: "right",
                    }}
                  >
                    {totalAsset?.toLocaleString()}
                  </td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "4px solid black",
                      borderBottom: "4px solid black",
                      fontWeight: "bold",
                      textAlign: "right",
                    }}
                  >
                    {totalAsset?.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan="4"
                    className="bg-light font-weight-bold"
                    style={{
                      fontWeight: "bold",
                      fontSize: "15px",
                      textTransform: "uppercase",
                    }}
                  >
                    Cash flows from financing activities
                  </td>
                </tr>
                {aidAndGrant?.map((item, subIndex) => (
                  <tr key={subIndex}>
                    <td style={{ borderRight: "none" }}>{item?.description}</td>
                    <td style={amount}>{item?.notes}</td>
                    <td style={amount} className="text-right">
                      {item.credit > 0 ? item.credit : `(${item.debit})`}
                    </td>
                    <td style={amount} className="text-right">
                      {item.credit > 0 ? item.credit : `(${item.debit})`}
                    </td>
                  </tr>
                ))}

                <tr>
                  <td
                    className="font-weight-bold"
                    style={{
                      fontWeight: "700",
                      fontSize: "14px",
                      textTransform: "uppercase",
                    }}
                  >
                    Total Outflow From Investing Activities
                  </td>
                  <td></td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "4px solid black",
                      borderBottom: "4px solid black",
                      fontWeight: "bolder",
                      textAlign: "right",
                    }}
                  >
                    {aidAndGrant
                      ?.reduce((sum, item) => sum + (item.credit || 0), 0)
                      .toLocaleString()}
                  </td>
                  <td
                    className="font-weight-bold text-right"
                    style={{
                      borderTop: "4px solid black",
                      borderBottom: "4px solid black",
                      fontWeight: "bold",
                      textAlign: "right",
                    }}
                  >
                    {aidAndGrant
                      ?.reduce((sum, item) => sum + (item.credit || 0), 0)
                      ?.toLocaleString()}
                  </td>
                </tr>
              </>
            </React.Fragment>
          </tbody>
        </Table>
        <footer>
          <div
            style={{
              background: "white",
              padding: "5px",
              width: "30px",
              height: "30px",
              textAlign: "center",
            }}
          >
            1
          </div>
        </footer>
      </div>
    </div>
  );
};

export default CashFlows;
