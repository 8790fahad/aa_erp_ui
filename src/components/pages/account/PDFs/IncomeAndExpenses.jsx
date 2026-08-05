/* eslint-disable no-unused-vars */
/* eslint-disable react/no-unescaped-entities */
import { _fetchApi } from "@/redux/actions/api";
import React, { useEffect, useState } from "react";
import { Table } from "react-bootstrap";

const IncomeExpenses = () => {
  const [revenue, setRevenue] = useState([]);
  const [revenueEx, setRevenueEx] = useState([]);
  const [expense, setExpense] = useState([]);
  const notes = ["1a", "1b", "2", "3", "4", "6", "7"];
  const sur =
    revenueEx.reduce((sum, item) => sum + (item.amount || 0), 0) +
    revenue.reduce(
      (sum, item) => sum + (item.amount || 0),
      0 - expense?.reduce((sum, item) => sum + (item.amount || 0), 0)
    );
  // alert(sur);
  useEffect(() => {

//     _fetchApi(`get_cash_report?query_type=FGN&code=1101`,
//       (data) => {

//         console.log(data);
//         setRevenue(data.result);
//       },
// (err) => {
//         console.log(err);
//       });
    _fetchApi(`/get_cash_report?query_type=Expenditure&code=210`,
      (data) => {
        // console.log(data);
        setExpense(data.results);
      },
(err) => {
        console.log(err);
      });
//     _fetchApi(`/get_cash_report?query_type=FGN&code=120`,
//       (data) => {
//         console.log(data);
//         setRevenueEx(data.result);
//       },
// (err) => {
//         console.log(err);
//       });
  }, []);

  // Function to calculate totals for a list of items
  const calculateTotals = (items) => {
    const total2023 = items.reduce((sum, item) => sum + (item[2023] || 0), 0);
    const total2022 = items.reduce((sum, item) => sum + (item[2022] || 0), 0);
    return { total2023, total2022 };
  };
  const amount = {
    textAlign: "right",
    borderRight: "none",
  };

  return (
    <div className="container-fluid py-5">
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
      <div
        style={{
          background: "linear-gradient(to right, #4267B2,rgb(130, 167, 240)",
          padding: "40px 50px 2px 50px",
          borderBottom: "4px solid #4267B2",
          marginBottom: "15px",
          textAlign: "center",
        }}
      >
        Report of the Accountant General with IPSAS Accrual Financial Statements
        for the Year Ended 31st December, 2023
      </div>
      {/* <h1>Katsina State Government of Nigeria</h1> */}
      <h1>
        Consolidated Statement of Financial Performance (Income & Expenditure)
        for the Year Ended 31st December, 2023
      </h1>
      <Table
        striped
        hover
        bordered
        responsive
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
        <tbody>
          {/* {financialData.map((section, index) => { */}
          {/* const totals = calculateTotals(section.items); */}
          {/* return ( */}
          <React.Fragment>
            <>
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
                  {/* {section.description} */}Revenue
                </td>
              </tr>
              {revenue.map((item, subIndex) => (
                <tr key={subIndex}>
                  <td style={{ borderRight: "none" }}>{item?.description}</td>
                  {/* {JSON.stringify(notes)} */}
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
                    .reduce((sum, item) => sum + (item.amount || 0), 0)
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
                    .reduce((sum, item) => sum + (item.amount || 0), 0)
                    .toLocaleString()}
                </td>
              </tr>
              {/* <tr>
                        <td className="font-weight-bold">Total</td>
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
                            .reduce((sum, item) => sum + (item.amount || 0), 0)
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
                            .reduce((sum, item) => sum + (item.amount || 0), 0)
                            .toLocaleString()}
                        </td>
                      </tr> */}
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
              {revenueEx.map((item, subIndex) => (
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
                  {revenueEx
                    .reduce((sum, item) => sum + (item.amount || 0), 0)
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
                    .reduce((sum, item) => sum + (item.amount || 0), 0)
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
                  Total
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
                  {(
                    revenueEx.reduce(
                      (sum, item) => sum + (item.amount || 0),
                      0
                    ) +
                    revenue.reduce((sum, item) => sum + (item.amount || 0), 0)
                  ).toLocaleString()}
                  {/* {revenue
                    .reduce((sum, item) => sum + (item.amount || 0), 0)
                    .toLocaleString()} */}
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
                  {(
                    revenueEx.reduce(
                      (sum, item) => sum + (item.amount || 0),
                      0
                    ) +
                    revenue.reduce((sum, item) => sum + (item.amount || 0), 0)
                  ).toLocaleString()}
                </td>
              </tr>

              {/* ********************************** */}
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
                  Expenses
                </td>
              </tr>
              {expense?.map((item, subIndex) => (
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
                  Total (Expenses)
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
                  {expense
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
                  {expense
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
                  Surplus / ( Deficit)
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
                  {Math.sign(sur) === -1
                    ? `(${Math.abs(sur).toLocaleString()})`
                    : sur.toLocaleString()}
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
                  {Math.sign(sur) === -1
                    ? `(${Math.abs(sur).toLocaleString()})`
                    : sur.toLocaleString()}
                </td>
              </tr>
            </>
          </React.Fragment>
          {/* ); */}
          {/* })} */}
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
  );
};

export default IncomeExpenses;
