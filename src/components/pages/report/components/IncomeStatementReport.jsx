import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  Card,
  Row,
  Col,
  Alert,
  Spinner,
  Button,
  Accordion,
} from "react-bootstrap";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";

const IncomeStatementReport = ({
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
  }, [facilityId, fromDate, toDate, loading, generateReport]);

  const generateReport = useCallback(() => {
    _postApi(
      "/accounting/income-statement",
      {
        fromDate,
        toDate,
      },
      (response) => {
        if (response.success) {
          setData(response.data);
        } else {
          setError(response.message || "Failed to generate income statement");
        }
        setLoading(false);
      },
      (err) => {
        setError("Error generating income statement: " + err.message);
        setLoading(false);
      }
    );
  }, [fromDate, toDate, setLoading]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (!data) return;

    const csvContent = [
      ["Description", "Amount (₦)"],
      ["REVENUE", ""],
      ...data.revenue.items.map((item) => [
        item.account_name,
        formatNumber1(item.amount),
      ]),
      ["Total Revenue", formatNumber1(data.revenue.total)],
      ["", ""],
      ["EXPENSES", ""],
      ...Object.entries(data.expenses.byCategory)
        .map(([category, categoryData]) => [`${category}`, ""])
        .concat(
          ...Object.entries(data.expenses.byCategory).flatMap(
            ([category, categoryData]) => [
              ...categoryData.items.map((item) => [
                `  ${item.account_name}`,
                formatNumber1(item.amount),
              ]),
              [`  Total ${category}`, formatNumber1(categoryData.total)],
              ["", ""],
            ]
          )
        ),
      ["Total Expenses", formatNumber1(data.expenses.total)],
      ["", ""],
      ["NET PROFIT/LOSS", formatNumber1(data.profit.netProfit)],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `income_statement_${fromDate}_to_${toDate}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <Spinner animation="border" />
        <p className="mt-2">Generating Income Statement...</p>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  if (!data) {
    return (
      <Alert variant="info">
        Click "Generate Reports" to create the Income Statement
      </Alert>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>
          Income Statement for the period {data.period.from} to {data.period.to}
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
          {/* Revenue Section */}
          <div className="mb-4">
            <h5 className="text-primary">REVENUE</h5>
            <Table striped bordered hover>
              <thead className="table-primary">
                <tr>
                  <th>Account Code</th>
                  <th>Description</th>
                  <th className="text-end">Amount (₦)</th>
                </tr>
              </thead>
              <tbody>
                {data.revenue.items.map((item, index) => (
                  <tr key={item.account_code}>
                    <td>{item.account_code}</td>
                    <td>{item.account_name}</td>
                    <td className="text-end">{formatNumber1(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="table-primary">
                <tr>
                  <th colSpan="2">TOTAL REVENUE</th>
                  <th className="text-end">
                    {formatNumber1(data.revenue.total)}
                  </th>
                </tr>
              </tfoot>
            </Table>
          </div>

          {/* Expenses Section */}
          <div className="mb-4">
            <h5 className="text-danger">EXPENSES</h5>
            <Accordion>
              {Object.entries(data.expenses.byCategory).map(
                ([category, categoryData], index) => (
                  <Accordion.Item eventKey={index.toString()} key={category}>
                    <Accordion.Header>
                      {category} - ₦{formatNumber1(categoryData.total)}
                    </Accordion.Header>
                    <Accordion.Body>
                      <Table striped bordered hover size="sm">
                        <thead>
                          <tr>
                            <th>Account Code</th>
                            <th>Description</th>
                            <th className="text-end">Amount (₦)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryData.items.map((item, itemIndex) => (
                            <tr key={item.account_code}>
                              <td>{item.account_code}</td>
                              <td>{item.account_name}</td>
                              <td className="text-end">
                                {formatNumber1(item.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th colSpan="2">Total {category}</th>
                            <th className="text-end">
                              {formatNumber1(categoryData.total)}
                            </th>
                          </tr>
                        </tfoot>
                      </Table>
                    </Accordion.Body>
                  </Accordion.Item>
                )
              )}
            </Accordion>

            <Table striped bordered hover className="mt-3">
              <tfoot className="table-danger">
                <tr>
                  <th colSpan="2">TOTAL EXPENSES</th>
                  <th className="text-end">
                    {formatNumber1(data.expenses.total)}
                  </th>
                </tr>
              </tfoot>
            </Table>
          </div>

          {/* Profit/Loss Section */}
          <div className="mb-4">
            <Table striped bordered hover>
              <tbody>
                <tr className="table-success">
                  <th colSpan="2">GROSS PROFIT</th>
                  <th className="text-end">
                    {formatNumber1(data.profit.grossProfit)}
                  </th>
                </tr>
                <tr className="table-success">
                  <th colSpan="2">NET PROFIT/LOSS</th>
                  <th className="text-end">
                    {formatNumber1(data.profit.netProfit)}
                  </th>
                </tr>
              </tbody>
            </Table>
          </div>

          <Row className="mt-4">
            <Col md={6}>
              <Card className="bg-light">
                <Card.Body>
                  <h6>Financial Summary</h6>
                  <p>
                    <strong>Total Revenue:</strong> ₦
                    {formatNumber1(data.revenue.total)}
                  </p>
                  <p>
                    <strong>Total Expenses:</strong> ₦
                    {formatNumber1(data.expenses.total)}
                  </p>
                  <p>
                    <strong>Net Profit/Loss:</strong> ₦
                    {formatNumber1(data.profit.netProfit)}
                  </p>
                  <p>
                    <strong>Profit Margin:</strong>{" "}
                    {data.revenue.total > 0
                      ? (
                          (parseFloat(data.profit.netProfit) /
                            parseFloat(data.revenue.total)) *
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
                  <h6>IFRS 15 Compliance</h6>
                  <p>
                    ✓ Revenue recognized when performance obligation is
                    satisfied
                  </p>
                  <p>✓ Revenue measured at transaction price</p>
                  <p>✓ Expenses classified by nature</p>
                  <p>✓ Accrual basis accounting applied</p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
};

export default IncomeStatementReport;
