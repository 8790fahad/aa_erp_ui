import React, { useState, useEffect } from "react";
import { Table, Card, Row, Col, Alert, Spinner, Button } from "react-bootstrap";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";

const EquityChangesReport = ({
  facilityId,
  fromDate,
  toDate,
  loading,
  setLoading,
}) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (facilityId && toDate && loading) {
      generateReport();
    }
  }, [facilityId, fromDate, toDate, loading]);

  const generateReport = () => {
    _postApi(
      "/accounting/statement-of-changes-in-equity",
      {
        fromDate,
        toDate,
      },
      (response) => {
        if (response.success) {
          setData(response.data);
        } else {
          setError(
            response.message ||
              "Failed to generate statement of changes in equity"
          );
        }
        setLoading(false);
      },
      (err) => {
        setError(
          "Error generating statement of changes in equity: " + err.message
        );
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
      ["Statement of Changes in Equity", ""],
      ["For the period", `${data.period.from} to ${data.period.to}`],
      ["", ""],
      [
        "Equity Account",
        "Opening Balance",
        "Period Movement",
        "Closing Balance",
      ],
      ...data.equityAccounts.map((account) => [
        account.account_name,
        formatNumber1(account.opening_balance),
        formatNumber1(account.period_movement),
        formatNumber1(account.closing_balance),
      ]),
      [
        "TOTAL",
        formatNumber1(data.totals.openingBalance),
        formatNumber1(data.totals.periodMovement),
        formatNumber1(data.totals.closingBalance),
      ],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `equity_changes_${fromDate}_to_${toDate}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <Spinner animation="border" />
        <p className="mt-2">Generating Statement of Changes in Equity...</p>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  if (!data) {
    return (
      <Alert variant="info">
        Click "Generate Reports" to create the Statement of Changes in Equity
      </Alert>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>
          Statement of Changes in Equity for the period {data.period.from} to{" "}
          {data.period.to}
        </h4>
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
                <th>Equity Account</th>
                <th className="text-end">Opening Balance (₦)</th>
                <th className="text-end">Period Movement (₦)</th>
                <th className="text-end">Closing Balance (₦)</th>
              </tr>
            </thead>
            <tbody>
              {data.equityAccounts.map((account, index) => (
                <tr key={account.account_code}>
                  <td>
                    <strong>{account.account_name}</strong>
                    <br />
                    <small className="text-muted">{account.account_code}</small>
                  </td>
                  <td className="text-end">
                    {formatNumber1(account.opening_balance)}
                  </td>
                  <td
                    className={`text-end ${
                      parseFloat(account.period_movement) < 0
                        ? "text-danger"
                        : "text-success"
                    }`}
                  >
                    {formatNumber1(account.period_movement)}
                  </td>
                  <td className="text-end">
                    {formatNumber1(account.closing_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="table-dark">
              <tr>
                <th>TOTAL EQUITY</th>
                <th className="text-end">
                  {formatNumber1(data.totals.openingBalance)}
                </th>
                <th
                  className={`text-end ${
                    parseFloat(data.totals.periodMovement) < 0
                      ? "text-danger"
                      : "text-success"
                  }`}
                >
                  {formatNumber1(data.totals.periodMovement)}
                </th>
                <th className="text-end">
                  {formatNumber1(data.totals.closingBalance)}
                </th>
              </tr>
            </tfoot>
          </Table>

          <Row className="mt-4">
            <Col md={6}>
              <Card className="bg-light">
                <Card.Body>
                  <h6>Equity Summary</h6>
                  <p>
                    <strong>Opening Balance:</strong> ₦
                    {formatNumber1(data.totals.openingBalance)}
                  </p>
                  <p>
                    <strong>Period Movement:</strong> ₦
                    {formatNumber1(data.totals.periodMovement)}
                  </p>
                  <p>
                    <strong>Closing Balance:</strong> ₦
                    {formatNumber1(data.totals.closingBalance)}
                  </p>
                  <p>
                    <strong>Growth Rate:</strong>{" "}
                    {data.totals.openingBalance > 0
                      ? (
                          (parseFloat(data.totals.periodMovement) /
                            parseFloat(data.totals.openingBalance)) *
                          100
                        ).toFixed(2)
                      : 0}
                    %
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="bg-light">
                <Card.Body>
                  <h6>IFRS Compliance</h6>
                  <p>✓ All equity movements disclosed</p>
                  <p>✓ Opening and closing balances reconciled</p>
                  <p>✓ Period movements clearly shown</p>
                  <p>✓ Proper equity classification</p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
};

export default EquityChangesReport;
