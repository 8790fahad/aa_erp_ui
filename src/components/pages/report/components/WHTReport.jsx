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
import { formatNumber1, formatNaira } from "@/components/router/utilities";

const WHTReport = ({ facilityId, fromDate, toDate, loading, setLoading }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (facilityId && toDate && loading) {
      generateReport();
    }
  }, [facilityId, fromDate, toDate, loading]);

  const generateReport = () => {
    _postApi(
      "/tax/wht-report",
      {
        fromDate,
        toDate,
      },
      (response) => {
        if (response.success) {
          setData(response.data);
        } else {
          setError(response.message || "Failed to generate WHT report");
        }
        setLoading(false);
      },
      (err) => {
        setError("Error generating WHT report: " + err.message);
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
      ["Withholding Tax (WHT) Report - FIRS Compliant", ""],
      ["Period", `${data.period.from} to ${data.period.to}`],
      ["", ""],
      ["WHT TRANSACTIONS", ""],
      [
        "Date",
        "Description",
        "Reference",
        "Payee",
        "Gross Payment",
        "WHT Rate",
        "WHT Amount",
        "Net Payment",
      ],
      ...data.whtTransactions.map((txn) => [
        txn.transaction_date,
        txn.transaction_description,
        txn.reference_number,
        txn.payee,
        formatNaira(txn.gross_payment),
        txn.wht_rate,
        formatNaira(txn.wht_amount),
        formatNaira(txn.net_payment),
      ]),
      ["", ""],
      ["WHT SUMMARY", ""],
      ["Total Gross Payments", formatNaira(data.summary.totalGrossPayments)],
      ["Total WHT Deductions", formatNaira(data.summary.totalWHTDeductions)],
      ["Total Net Payments", formatNaira(data.summary.totalNetPayments)],
      ["Average WHT Rate", data.summary.averageWHTRate],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wht_report_${fromDate}_to_${toDate}.csv`;
    a.click();
  };

  const getWHTBadgeVariant = (rate) => {
    switch (rate) {
      case "5%":
        return "success";
      case "10%":
        return "warning";
      case "0%":
        return "secondary";
      default:
        return "info";
    }
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <Spinner animation="border" />
        <p className="mt-2">Generating WHT Report...</p>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  if (!data) {
    return (
      <Alert variant="info">
        Click "Generate Reports" to create the WHT Report
      </Alert>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>
          Withholding Tax (WHT) Report - FIRS Compliant for the period{" "}
          {data.period.from} to {data.period.to}
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
          {/* WHT Transactions */}
          <div className="mb-4">
            <h5 className="text-primary">WHT TRANSACTIONS</h5>
            <Table striped bordered hover responsive>
              <thead className="table-primary">
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th>Payee</th>
                  <th className="text-end">Gross Payment (₦)</th>
                  <th className="text-center">WHT Rate</th>
                  <th className="text-end">WHT Amount (₦)</th>
                  <th className="text-end">Net Payment (₦)</th>
                </tr>
              </thead>
              <tbody>
                {data.whtTransactions.length > 0 ? (
                  data.whtTransactions.map((txn, index) => (
                    <tr key={index}>
                      <td>{txn.transaction_date}</td>
                      <td>{txn.transaction_description}</td>
                      <td>{txn.reference_number}</td>
                      <td>{txn.payee}</td>
                      <td className="text-end">
                        {formatNaira(txn.gross_payment)}
                      </td>
                      <td className="text-center">
                        <Badge bg={getWHTBadgeVariant(txn.wht_rate)}>
                          {txn.wht_rate}
                        </Badge>
                      </td>
                      <td className="text-end text-danger">
                        {formatNaira(txn.wht_amount)}
                      </td>
                      <td className="text-end text-success">
                        {formatNaira(txn.net_payment)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="text-center text-muted">
                      No WHT transactions recorded
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>

          {/* WHT by Rate */}
          <div className="mb-4">
            <h5 className="text-info">WHT BY RATE</h5>
            <Row>
              {Object.entries(data.whtByRate).map(([rate, rateData]) => (
                <Col md={6} lg={4} key={rate} className="mb-3">
                  <Card className="h-100">
                    <Card.Header
                      className={`bg-${getWHTBadgeVariant(rate)} text-white`}
                    >
                      <h6 className="mb-0">{rate} WHT</h6>
                    </Card.Header>
                    <Card.Body>
                      <p>
                        <strong>Transactions:</strong> {rateData.count}
                      </p>
                      <p>
                        <strong>Total WHT:</strong> ₦
                        {formatNaira(rateData.total)}
                      </p>
                      <p>
                        <strong>Average per Transaction:</strong> ₦
                        {formatNaira(rateData.total / rateData.count)}
                      </p>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>

          {/* WHT Summary */}
          <div className="mb-4">
            <h5 className="text-warning">WHT SUMMARY</h5>
            <Table striped bordered hover>
              <tbody>
                <tr>
                  <th>Total Gross Payments</th>
                  <td className="text-end">
                    {formatNaira(data.summary.totalGrossPayments)}
                  </td>
                </tr>
                <tr>
                  <th>Total WHT Deductions</th>
                  <td className="text-end text-danger">
                    {formatNaira(data.summary.totalWHTDeductions)}
                  </td>
                </tr>
                <tr>
                  <th>Total Net Payments</th>
                  <td className="text-end text-success">
                    {formatNaira(data.summary.totalNetPayments)}
                  </td>
                </tr>
                <tr className="table-info">
                  <th>Average WHT Rate</th>
                  <td className="text-end">{data.summary.averageWHTRate}</td>
                </tr>
              </tbody>
            </Table>
          </div>

          <Row className="mt-4">
            <Col md={6}>
              <Card className="bg-light">
                <Card.Body>
                  <h6>WHT Summary</h6>
                  <p>
                    <strong>Total Gross Payments:</strong> ₦
                    {formatNaira(data.summary.totalGrossPayments)}
                  </p>
                  <p>
                    <strong>Total WHT Deductions:</strong> ₦
                    {formatNaira(data.summary.totalWHTDeductions)}
                  </p>
                  <p>
                    <strong>Total Net Payments:</strong> ₦
                    {formatNaira(data.summary.totalNetPayments)}
                  </p>
                  <p>
                    <strong>Average WHT Rate:</strong>{" "}
                    {data.summary.averageWHTRate}
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="bg-light">
                <Card.Body>
                  <h6>FIRS Compliance</h6>
                  <p>
                    <strong>WHT Rates:</strong>{" "}
                    {data.compliance.whtRates.join(", ")}
                  </p>
                  <p>
                    <strong>Remittance Period:</strong>{" "}
                    {data.compliance.remittancePeriod}
                  </p>
                  <p>
                    <strong>Due Date:</strong> {data.compliance.dueDate}
                  </p>
                  <p>
                    <strong>Penalty Rate:</strong> {data.compliance.penaltyRate}
                  </p>
                  <p>
                    <strong>Interest Rate:</strong>{" "}
                    {data.compliance.interestRate}
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

export default WHTReport;
