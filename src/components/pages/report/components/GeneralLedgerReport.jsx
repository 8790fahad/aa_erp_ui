import React, { useState, useEffect } from "react";
import {
  Table,
  Card,
  Row,
  Col,
  Alert,
  Spinner,
  Button,
  Badge,
} from "react-bootstrap";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";

const GeneralLedgerReport = ({ facilityId, asOfDate, loading, setLoading }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (facilityId && asOfDate && loading) {
      generateReport();
    }
  }, [facilityId, asOfDate, loading]);

  const generateReport = () => {
    _postApi(
      "/accounting/general-ledger-summary",
      {
        asOfDate,
      },
      (response) => {
        if (response.success) {
          setData(response.data);
        } else {
          setError(
            response.message || "Failed to generate general ledger summary"
          );
        }
        setLoading(false);
      },
      (err) => {
        setError("Error generating general ledger summary: " + err.message);
        setLoading(false);
      }
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (!data) return;

    const csvContent = [
      ["General Ledger Summary", ""],
      ["As at", data.asOfDate],
      ["", ""],
      [
        "Account Code",
        "Account Name",
        "Account Type",
        "Total Debit",
        "Total Credit",
        "Net Balance",
        "Transaction Count",
        "First Transaction",
        "Last Transaction",
        "Age Category",
      ],
      ...data.summary.map((account) => [
        account.account_code,
        account.account_name,
        account.account_type,
        formatNumber1(account.total_debit),
        formatNumber1(account.total_credit),
        formatNumber1(account.net_balance),
        account.transaction_count,
        account.first_transaction,
        account.last_transaction,
        account.age_category,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `general_ledger_summary_${asOfDate}.csv`;
    a.click();
  };

  const getAgeBadgeVariant = (ageCategory) => {
    switch (ageCategory) {
      case "Current":
        return "success";
      case "7-30 Days":
        return "info";
      case "30-60 Days":
        return "warning";
      case "60-90 Days":
        return "danger";
      case "Over 90 Days":
        return "dark";
      default:
        return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <Spinner animation="border" />
        <p className="mt-2">Generating General Ledger Summary...</p>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  if (!data) {
    return (
      <Alert variant="info">
        Click "Generate Reports" to create the General Ledger Summary
      </Alert>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>General Ledger Summary as at {data.asOfDate}</h4>
        <div>
          <Button
            variant="outline-primary"
            onClick={handleExport}
            className="me-2"
          >
            Export CSV
          </Button>
          <Button variant="outline-secondary" onClick={handlePrint}>
            Print
          </Button>
        </div>
      </div>

      <Card>
        <Card.Body>
          <Table striped bordered hover responsive>
            <thead className="table-dark">
              <tr>
                <th>S/N</th>
                <th>Account Code</th>
                <th>Account Name</th>
                <th>Account Type</th>
                <th className="text-end">Total Debit (₦)</th>
                <th className="text-end">Total Credit (₦)</th>
                <th className="text-end">Net Balance (₦)</th>
                <th className="text-center">Transactions</th>
                <th className="text-center">Last Activity</th>
                <th className="text-center">Age</th>
              </tr>
            </thead>
            <tbody>
              {data.summary.map((account, index) => (
                <tr key={account.account_code}>
                  <td>{index + 1}</td>
                  <td>{account.account_code}</td>
                  <td>{account.account_name}</td>
                  <td>
                    <span
                      className={`badge ${
                        account.account_type === "Assets"
                          ? "bg-primary"
                          : account.account_type === "Liabilities"
                          ? "bg-warning"
                          : account.account_type === "Equity"
                          ? "bg-success"
                          : account.account_type === "Revenue"
                          ? "bg-info"
                          : "bg-secondary"
                      }`}
                    >
                      {account.account_type}
                    </span>
                  </td>
                  <td className="text-end">
                    {formatNumber1(account.total_debit)}
                  </td>
                  <td className="text-end">
                    {formatNumber1(account.total_credit)}
                  </td>
                  <td
                    className={`text-end ${
                      parseFloat(account.net_balance) < 0
                        ? "text-danger"
                        : "text-success"
                    }`}
                  >
                    {formatNumber1(account.net_balance)}
                  </td>
                  <td className="text-center">{account.transaction_count}</td>
                  <td className="text-center">{account.last_transaction}</td>
                  <td className="text-center">
                    <Badge bg={getAgeBadgeVariant(account.age_category)}>
                      {account.age_category}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="table-dark">
              <tr>
                <th colSpan="4">TOTAL</th>
                <th className="text-end">
                  {formatNumber1(data.totals.totalDebit)}
                </th>
                <th className="text-end">
                  {formatNumber1(data.totals.totalCredit)}
                </th>
                <th className="text-end">
                  {formatNumber1(data.totals.netBalance)}
                </th>
                <th colSpan="3"></th>
              </tr>
            </tfoot>
          </Table>

          {/* Aged Analysis */}
          <div className="mt-4">
            <h5>Aged Analysis</h5>
            <Row>
              {Object.entries(data.agedAnalysis).map(
                ([ageCategory, ageData]) => (
                  <Col md={6} lg={4} key={ageCategory} className="mb-3">
                    <Card className="h-100">
                      <Card.Header
                        className={`bg-${getAgeBadgeVariant(
                          ageCategory
                        )} text-white`}
                      >
                        <h6 className="mb-0">{ageCategory}</h6>
                      </Card.Header>
                      <Card.Body>
                        <p>
                          <strong>Accounts:</strong> {ageData.accounts.length}
                        </p>
                        <p>
                          <strong>Total Balance:</strong> ₦
                          {formatNumber1(ageData.total)}
                        </p>
                        <p>
                          <strong>Average Balance:</strong> ₦
                          {formatNumber1(
                            ageData.total / ageData.accounts.length
                          )}
                        </p>
                      </Card.Body>
                    </Card>
                  </Col>
                )
              )}
            </Row>
          </div>

          <Row className="mt-4">
            <Col md={6}>
              <Card className="bg-light">
                <Card.Body>
                  <h6>Summary Statistics</h6>
                  <p>
                    <strong>Total Accounts:</strong> {data.summary.length}
                  </p>
                  <p>
                    <strong>Total Debits:</strong> ₦
                    {formatNumber1(data.totals.totalDebit)}
                  </p>
                  <p>
                    <strong>Total Credits:</strong> ₦
                    {formatNumber1(data.totals.totalCredit)}
                  </p>
                  <p>
                    <strong>Net Balance:</strong> ₦
                    {formatNumber1(data.totals.netBalance)}
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="bg-light">
                <Card.Body>
                  <h6>Account Health</h6>
                  <p>
                    <strong>Active Accounts:</strong>{" "}
                    {data.summary.filter((a) => a.transaction_count > 0).length}
                  </p>
                  <p>
                    <strong>Dormant Accounts:</strong>{" "}
                    {
                      data.summary.filter((a) => a.transaction_count === 0)
                        .length
                    }
                  </p>
                  <p>
                    <strong>Recent Activity:</strong>{" "}
                    {
                      data.summary.filter((a) => a.age_category === "Current")
                        .length
                    }
                  </p>
                  <p>
                    <strong>Stale Accounts:</strong>{" "}
                    {
                      data.summary.filter(
                        (a) => a.age_category === "Over 90 Days"
                      ).length
                    }
                  </p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
};

export default GeneralLedgerReport;
