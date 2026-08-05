/* eslint-disable react/prop-types */
// Material Dashboard 2 React example components

// import Footer from "examples/Footer";

// Data
import React, { useEffect, useRef, useState } from "react";
// import Scrollbar from "components/Tree/Scrollbar";

import { FaFileDownload } from "react-icons/fa";
import { _fetchApi } from "@/redux/actions/api";
// import { useYear } from "useYearList";
// import { capitalizeWords } from "redux/action/api";
// import { unflattenTable } from "redux/action/api";
import {
  ButtonGroup,
  Button,
  Input,
  Modal,
  Spinner,
  Dropdown,
  DropdownToggle,
  DropdownItem,
  DropdownMenu,
} from "reactstrap";
// import MDAReportModal from "./MDAReportsModal";
// import { DownloadTableExcel } from "react-export-table-to-excel";
// import { headerColors } from "@/redux/actions/api";
// import { newFilter } from "./ReportsAdminShareCom";
// import htmlDocx from "html-docx-js/dist/html-docx";
// import jsPDF from "jspdf";
// import html2canvas from "html2canvas";
// import { getNextYear } from "../getBudgetYear";
import { Card, Container, Table } from "reactstrap/lib";
import { formatNumber1 } from "@/components/router/utilities";
import { useNavigate } from "react-router-dom";
import { unflatten, unflattenBalance } from "@/utilities";
import StructureTree from "../account/StructureTree";
export default function ReportTotalEco({
  type = "revenue_by_admin",
  route = "/get-report",
  options = [],
  title = "MDA Expenditure by Economic",
}) {
  const [selectMDA, setSelectMDA] = useState({});
  const [data, setData] = useState([]);
  const [modal, setModal] = useState(false);
  const tableRef = useRef();
  const toggle = () => setModal(!modal);

  const [treeData, setTreeData] = useState([]);
  const [form, setForm] = useState({
    budget_year: "",
    query_type: type,
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  // const years = useYear();
  const years = [new Date().getFullYear(), new Date().getFullYear() - 1];
  const [selectedOption, setSelectedOption] = useState({
    value: type,
    title,
  });
  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({ ...p, [name]: value }));
  };

  //  useEffect(() => {
  //    getNextYear((data) => setForm((p) => ({ ...p, budget_year: data })));
  //  }, []);

  const handleButtonClick = (value, title) => {
    setSelectedOption({ value, title });
  };

  const likeVar = selectedOption?.title.includes("Personnel")
    ? "21%"
    : selectedOption?.title.includes("Debt")
    ? "2206%"
    : selectedOption?.title.includes("Capital")
    ? "23%"
    : selectedOption?.title.includes("Over-head")
    ? "22%"
    : null;

  useEffect(() => {
    setLoading(true);
    _fetchApi(
      `/account/get-account-statement`,
      (data) => {
        setData(data?.results);
        setLoading(false);
      },
      (err) => {
        console.log(err);
        setLoading(false);
      }
    );
  }, []);

  const headers = [
    { label: "Codes", key: "code" },
    { label: "Description", key: "description" },
    { label: "MDA", key: "mda_name" },
    {
      label: `${parseInt(form.budget_year) - 2}  Actual`,
      key: "prev_year2_actual_amount",
    },
    {
      label: `${parseInt(form.budget_year) - 1} Aproved`,
      key: "prev_year1_approve_amount",
    },
    {
      label: `${parseInt(form.budget_year) - 1} Actual`,
      key: "prev_year1_actual_amount",
    },
    {
      label: `${parseInt(form.budget_year)} Budget Amount`,
      key: "budget_amount",
    },
    {
      label: `${parseInt(form.budget_year)} Approved Proposal`,
      key: "approve_amount",
    },
    {
      label: `${parseInt(form.budget_year)} Actual Proposal`,
      key: "actual_amount",
    },
  ];

  const calculateprevyear = (node) => {
    if (!node.children || node.children.length === 0) {
      return node.prev_year2_actual_amount;
    } else {
      let sum = node.prev_year2_actual_amount || 0;
      for (const child of node.children) {
        sum += calculateprevyear(child);
      }
      return sum;
    }
  };

  const calculateApprovePrev1 = (node) => {
    if (!node.children || node.children.length === 0) {
      return node.prev_year1_approve_amount;
    } else {
      let sum = node.prev_year1_approve_amount || 0;
      for (const child of node.children) {
        sum += calculateApprovePrev1(child);
      }
      return sum;
    }
  };
  const calculateActualPrev1 = (node) => {
    if (!node.children || node.children.length === 0) {
      return node.prev_year1_actual_amount;
    } else {
      let sum = node.prev_year1_actual_amount || 0;
      for (const child of node.children) {
        sum += calculateActualPrev1(child);
      }
      return sum;
    }
  };

  const calculateBudgetAmt = (node) => {
    if (!node.children || node.children.length === 0) {
      return node.budget_amount;
    } else {
      let sum = node.budget_amount || 0;
      for (const child of node.children) {
        sum += calculateBudgetAmt(child);
      }
      return sum;
    }
  };

  const calculateApproveAmt = (node) => {
    if (!node.children || node.children.length === 0) {
      return node.approve_amount;
    } else {
      let sum = node.approve_amount || 0;
      for (const child of node.children) {
        sum += calculateApproveAmt(child);
      }
      return sum;
    }
  };

  const newFilterHead = (item) => {
    return (
      calculateprevyear(item) === 0 &&
      calculateApprovePrev1(item) === 0 &&
      calculateActualPrev1(item) === 0 &&
      calculateBudgetAmt(item) === 0 &&
      calculateApproveAmt(item) === 0
    );
  };

  const generateTable2 = () => {
    const renderItems = (item, index) => {
      const isTitle =
        item.code === "0000000000000000000" ||
        item.code === "1000000000000000000" ||
        item.code === "2000000000000000000" ||
        item.code === "3000000000000000000" ||
        item.code === "5000000000000000000" ||
        item.code === "7000000000000000000" ||
        item.code === "8000000000000000000";
      return (
        <React.Fragment key={`group_${index}`}>
          {newFilterHead(item) ? null : (
            <tr
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                color: "black",
                cursor: "pointer",
              }}
              onClick={() => {
                toggle();
                setSelectMDA(item);
                console.log(item);
              }}
            >
              {/* {isTitle ? "" : item.code}selectedOption.value ==="mda_expenditure_by_eco" ? "Total MDA Expenditure by Economic" : */}
              <td
                style={{
                  backgroundColor: headerColors[item.parentHeads.length],
                  color: "black",
                }}
              >
                {isTitle ? "" : item.code}
              </td>
              <td
                style={{
                  backgroundColor: headerColors[item.parentHeads.length],
                  color: "black",
                }}
              >
                {isTitle ? selectedOption.title : item.description}

                {/* {form.type} */}
              </td>
              <td
                style={{
                  textAlign: "right",
                  backgroundColor: headerColors[item.parentHeads.length],
                  color: "black",
                }}
              >
                {isNaN(calculateprevyear(item))
                  ? "---"
                  : formatNumber1(calculateprevyear(item))}
              </td>
              <td
                style={{
                  textAlign: "right",
                  backgroundColor: headerColors[item.parentHeads.length],
                  color: "black",
                }}
              >
                {isNaN(calculateApprovePrev1(item))
                  ? "---"
                  : formatNumber1(calculateApprovePrev1(item))}
              </td>
              <td
                style={{
                  textAlign: "right",
                  backgroundColor: headerColors[item.parentHeads.length],
                  color: "black",
                }}
              >
                {isNaN(calculateActualPrev1(item))
                  ? "---"
                  : formatNumber1(calculateActualPrev1(item))}
              </td>
              <td
                style={{
                  textAlign: "right",
                  backgroundColor: headerColors[item.parentHeads.length],
                  color: "black",
                }}
              >
                {isNaN(calculateBudgetAmt(item))
                  ? "---"
                  : formatNumber1(calculateBudgetAmt(item))}
              </td>

              {/* <td
                style={{
                  textAlign: "right",
                  backgroundColor: headerColors[item.parentHeads.length],
                  color: "black",
                }}
              >
                {isNaN(calculateAdjustment(item))
                  ? "---"
                  : formatNumber(calculateAdjustment(item))}
              </td> */}

              <td
                style={{
                  textAlign: "right",
                  backgroundColor: headerColors[item.parentHeads.length],
                  color: "black",
                }}
              >
                {isNaN(calculateApproveAmt(item))
                  ? "---"
                  : formatNumber1(calculateApproveAmt(item))}
              </td>
            </tr>
          )}

          {item.children.map((child, idx) => {
            if (child.children && child.children.length) {
              return renderItems(child, idx);
            } else if (newFilter(child)) {
              return null;
            } else {
              return (
                <tr key={child.code} style={{ fontSize: "11px" }}>
                  <td>{child.code}</td>
                  <td>{child.description}</td>
                  <td style={{ textAlign: "right" }}>
                    {isNaN(child.prev_year2_actual_amount) || 0
                      ? "---"
                      : formatNumber1(child.prev_year2_actual_amount)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {isNaN(child.prev_year1_approve_amount) || 0
                      ? "---"
                      : formatNumber1(child.prev_year1_approve_amount)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {isNaN(child.prev_year1_actual_amount) || 0
                      ? "---"
                      : formatNumber1(child.prev_year1_actual_amount)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {isNaN(child.budget_amount) || 0
                      ? "---"
                      : formatNumber1(child.budget_amount)}
                  </td>
                  {/* <td style={{ textAlign: "right" }}>
                    {isNaN(child.supplementary_amount) || 0
                      ? "---"
                      : formatNumber(child.supplementary_amount)}
                  </td> */}
                  <td style={{ textAlign: "right" }}>
                    {isNaN(child.approve_amount) || 0
                      ? "---"
                      : formatNumber1(child.approve_amount)}
                  </td>
                </tr>
              );
            }
          })}
        </React.Fragment>
      );
    };

    return (
      <table className="table table-bordered" id="table2" ref={tableRef}>
        <thead>
          <tr
            style={{
              fontSize: "12px",
              borderWidth: 1,
              borderColor: "black",
              textAlign: "center",
              backgroundColor: "orange",
            }}
          >
            <th style={{ backgroundColor: "orange" }}>Code</th>
            <th style={{ backgroundColor: "orange" }}>Description</th>
            <th style={{ backgroundColor: "orange" }}>{`${
              parseInt(form.budget_year) - 2
            }  Full Year Actual(₦)`}</th>
            <th style={{ backgroundColor: "orange" }}>{`${
              parseInt(form.budget_year) - 1
            } Aproved Budget(₦)`}</th>
            <th style={{ backgroundColor: "orange" }}>{`${
              parseInt(form.budget_year) - 1
            } performance January To August(₦)`}</th>
            <th style={{ backgroundColor: "orange" }}>{`${parseInt(
              form.budget_year
            )} MDA Proposal`}</th>
            {/* <th style={{ backgroundColor: "orange" }}>{`${parseInt(
              form.budget_year
            )} Adjustments`}</th> */}
            <th style={{ backgroundColor: "orange" }}>{`${parseInt(
              form.budget_year
            )} Approved Budget`}</th>
          </tr>
        </thead>
        <tbody>{treeData.map((item, i) => renderItems(item, i))}</tbody>
        {/* {JSON.stringify(treeData.length)} */}
      </table>
    );
  };
  const [pdfLoading, setPdfLoading] = useState(false);
  const renderRows = (accounts, level = 0) => {
    return accounts.filter((acc) => acc.balance !== 0).map((acc) => {
      const isHead = acc.children && acc.children.length > 0;
      const rowStyle = isHead
        ? { backgroundColor: "#d1e7dd", fontWeight: "bold" }
        : {};
      const paddingLeft = 20 * level;

      return (
        <React.Fragment key={acc.head}>
          <tr style={rowStyle}>
            <td style={{ paddingLeft: paddingLeft + "px" }}>{acc.head}</td>
            <td>{acc.description}</td>
            {/* <td>{acc.account_type}</td> */}
            <td style={{ textAlign: "right" }}>{formatNumber1(acc.balance.toFixed(2))}</td>
            <td style={{ textAlign: "right" }}>{formatNumber1(acc.balance.toFixed(2))}</td>
          </tr>
          {acc.children &&
            acc.children.length > 0 &&
            renderRows(acc.children, level++)}
        </React.Fragment>
      );
    });
  };
  return (
    <>
      <div>
        <div style={{ paddingBottom: "30px" }}>
          <div>
            <div>
              <Modal
                isOpen={modal}
                toggle={toggle}
                size="lg"
                style={{
                  marginLeft: "30%",
                }}
              >
                {/* <MDAReportModal
                    toggle={toggle}
                    mda_name={selectMDA.description}
                  /> */}
              </Modal>
            </div>
            <div>
              <div>
                {pdfLoading && (
                  <div className="loading-container text-center">
                    <Spinner color="primary" style={{ marginTop: "20px" }} />
                    Generating PDF, please wait...
                  </div>
                )}

                {/* <div
                    className="d-flex justify-content-between m-1"
                    style={{ marginRight: 10, marginLeft: 10 }}
                  >
                    <div className="col-md-2">
                      <Input
                        type="select"
                        name="budget_year"
                        value={form.budget_year}
                        onChange={handleChange}
                      >
                        <option>--select--</option>
                        {years?.map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </Input>
                    </div>
                    <div className="col-md-8">
                      <div className="text-center">

                      </div>
                      <center>
                        <ButtonGroup>
                          {options.map((item) => (
                            <Button
                              size="sm"
                              key={item.title}
                              outline={
                                selectedOption.title !== item.title
                                  ? true
                                  : false
                              }
                              color={
                                selectedOption.title === item.title
                                  ? "primary"
                                  : "secondary"
                              }
                              onClick={() =>
                                handleButtonClick(item.value, item.title)
                              }
                            >
                              <small>{item.title}</small>
                            </Button>
                          ))}
                        </ButtonGroup>
                      </center>
                    </div>
                    <div>
                      <Dropdown isOpen={dropdownOpen} toggle={toggle1}>
                        <DropdownToggle
                          className="btn btn-primary text-white ml-3"
                          caret
                        >
                          <FaFileDownload
                            color="white"
                            size="1.2rem"
                            className="mr-5"
                          />
                          Download
                        </DropdownToggle>
                        <DropdownMenu>
                          <DropdownItem
                            onClick={() => console.log("Option 1 clicked")}
                          >
                            <DownloadTableExcel
                              filename={selectedOption.title}
                              sheet={selectedOption.title}
                              currentTableRef={tableRef.current}
                            >
                              Export to Excel
                            </DownloadTableExcel>
                          </DropdownItem>
                          <DropdownItem onClick={() => handleExportToPDF()}>
                            PDF
                          </DropdownItem>
                          <DropdownItem />
                          <DropdownItem onClick={handleExportToWord}>
                            Export Word
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    </div>
                  </div> */}
                <div className="p-3 px-0">
                  {/* {JSON.stringify(treeData)} */}
                  {/* <Scrollbar> */}

                  {loading && (
                    <div className="loading-container text-center">
                      <Spinner color="primary" style={{ marginTop: "20px" }} />{" "}
                      Loading...
                    </div>
                  )}
                  {/* {generateTable2()} */}
                  <table
                    style={{
                      borderCollapse: "collapse",
                      width: "100%",
                      fontFamily: "Arial, sans-serif",
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: "#f4f4f4" }}>
                        <th
                          style={{
                            border: "1px solid #ddd",
                            padding: "6px 12px",
                          }}
                        >
                          Head (Account)
                        </th>
                        <th
                          style={{
                            border: "1px solid #ddd",
                            padding: "6px 12px",
                          }}
                        >
                          Description
                        </th>

                        <th
                          style={{
                            border: "1px solid #ddd",
                            padding: "6px 12px",
                            textAlign: "right",
                          }}
                        >
                          {years[0]}
                        </th>
                        <th
                          style={{
                            border: "1px solid #ddd",
                            padding: "6px 12px",
                            textAlign: "right",
                          }}
                        >
                          Balance
                        </th>
                      </tr>
                    </thead>
                    {/* {JSON.stringify(unflattenBalance(data))} */}
                    <tbody>{renderRows(unflattenBalance(data), 1)}</tbody>
                  </table>
                  {/* </Scrollbar> */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
