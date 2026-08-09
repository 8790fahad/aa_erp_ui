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

const VATReport = ({ facilityId, fromDate, toDate, loading, setLoading }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (facilityId && toDate && loading) {
      generateReport();
    }
  }, [facilityId, fromDate, toDate, loading]);

  const generateReport = () => {
    _postApi(
      "/tax/vat-report",
      {
        fromDate,
        toDate,
      },
      (response) => {
        if (response.success) {
          setData(response.data);
        } else {
          setError(response.message || "Failed to generate VAT report");
        }
        setLoading(false);
      },
      (err) => {
        setError("Error generating VAT report: " + err.message);
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
      ["VAT Report - FIRS Compliant", ""],
      ["Period", `${data.period.from} to ${data.period.to}`],
      ["", ""],
      ["INPUT VAT", ""],
      [
        "Date",
        "Description",
        "Reference",
        "Payee",
        "Gross Amount",
        "Net Amount",
        "VAT Amount",
      ],
      ...data.inputVAT.transactions.map((txn) => [
        txn.transaction_date,
        txn.transaction_description,
        txn.reference_number,
        txn.payee,
        formatNaira(txn.gross_amount),
        formatNaira(txn.net_amount),
        formatNaira(txn.vat_amount),
      ]),
      [
        "Total Input VAT",
        "",
        "",
        "",
        "",
        "",
        formatNaira(data.inputVAT.total),
      ],
      ["", ""],
      ["OUTPUT VAT", ""],
      [
        "Date",
        "Description",
        "Reference",
        "Payee",
        "Gross Amount",
        "Net Amount",
        "VAT Amount",
      ],
      ...data.outputVAT.transactions.map((txn) => [
        txn.transaction_date,
        txn.transaction_description,
        txn.reference_number,
        txn.payee,
        formatNaira(txn.gross_amount),
        formatNaira(txn.net_amount),
        formatNaira(txn.vat_amount),
      ]),
      [
        "Total Output VAT",
        "",
        "",
        "",
        "",
        "",
        formatNaira(data.outputVAT.total),
      ],
      ["", ""],
      ["VAT SUMMARY", ""],
      ["Total Input VAT", formatNaira(data.summary.totalInputVAT)],
      ["Total Output VAT", formatNaira(data.summary.totalOutputVAT)],
      ["Net VAT Payable/Refundable", formatNaira(data.summary.netVATPayable)],
      ["Status", data.summary.status],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vat_report_${fromDate}_to_${toDate}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <Spinner animation="border" />
        <p className="mt-2">Generating VAT Report...</p>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  if (!data) {
    return (
      <Alert variant="info">
        Click "Generate Reports" to create the VAT Report
      </Alert>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>
          VAT Report - FIRS Compliant for the period {data.period.from} to{" "}
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
          {/* Input VAT */}
          <div className="mb-4">
            <h5 className="text-primary">INPUT VAT (VAT on Purchases)</h5>
            <Table striped bordered hover responsive>
              <thead className="table-primary">
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th>Payee</th>
                  <th className="text-end">Gross Amount (₦)</th>
                  <th className="text-end">Net Amount (₦)</th>
                  <th className="text-end">VAT Amount (₦)</th>
                </tr>
              </thead>
              <tbody>
                {data.inputVAT.transactions.length > 0 ? (
                  data.inputVAT.transactions.map((txn, index) => (
                    <tr key={index}>
                      <td>{txn.transaction_date}</td>
                      <td>{txn.transaction_description}</td>
                      <td>{txn.reference_number}</td>
                      <td>{txn.payee}</td>
                      <td className="text-end">
                        {formatNaira(txn.gross_amount)}
                      </td>
                      <td className="text-end">
                        {formatNaira(txn.net_amount)}
                      </td>
                      <td className="text-end text-success">
                        {formatNaira(txn.vat_amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center text-muted">
                      No input VAT transactions recorded
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="table-primary">
                <tr>
                  <th colSpan="6">Total Input VAT</th>
                  <th className="text-end">
                    {formatNaira(data.inputVAT.total)}
                  </th>
                </tr>
              </tfoot>
            </Table>
          </div>

          {/* Output VAT */}
          <div className="mb-4">
            <h5 className="text-danger">OUTPUT VAT (VAT on Sales)</h5>
            <Table striped bordered hover responsive>
              <thead className="table-danger">
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th>Payee</th>
                  <th className="text-end">Gross Amount (₦)</th>
                  <th className="text-end">Net Amount (₦)</th>
                  <th className="text-end">VAT Amount (₦)</th>
                </tr>
              </thead>
              <tbody>
                {data.outputVAT.transactions.length > 0 ? (
                  data.outputVAT.transactions.map((txn, index) => (
                    <tr key={index}>
                      <td>{txn.transaction_date}</td>
                      <td>{txn.transaction_description}</td>
                      <td>{txn.reference_number}</td>
                      <td>{txn.payee}</td>
                      <td className="text-end">
                        {formatNaira(txn.gross_amount)}
                      </td>
                      <td className="text-end">
                        {formatNaira(txn.net_amount)}
                      </td>
                      <td className="text-end text-danger">
                        {formatNaira(txn.vat_amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center text-muted">
                      No output VAT transactions recorded
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="table-danger">
                <tr>
                  <th colSpan="6">Total Output VAT</th>
                  <th className="text-end">
                    {formatNaira(data.outputVAT.total)}
                  </th>
                </tr>
              </tfoot>
            </Table>
          </div>

          {/* VAT Summary */}
          <div className="mb-4">
            <h5 className="text-info">VAT SUMMARY</h5>
            <Table striped bordered hover>
              <tbody>
                <tr>
                  <th>Total Input VAT</th>
                  <td className="text-end text-success">
                    {formatNaira(data.summary.totalInputVAT)}
                  </td>
                </tr>
                <tr>
                  <th>Total Output VAT</th>
                  <td className="text-end text-danger">
                    {formatNaira(data.summary.totalOutputVAT)}
                  </td>
                </tr>
                <tr className="table-warning">
                  <th>Net VAT Payable/Refundable</th>
                  <td
                    className={`text-end ${
                      parseFloat(data.summary.netVATPayable) > 0
                        ? "text-danger"
                        : "text-success"
                    }`}
                  >
                    {formatNaira(data.summary.netVATPayable)}
                  </td>
                </tr>
                <tr>
                  <th>Status</th>
                  <td className="text-end">
                    <Badge
                      bg={
                        parseFloat(data.summary.netVATPayable) > 0
                          ? "danger"
                          : "success"
                      }
                    >
                      {data.summary.status}
                    </Badge>
                  </td>
                </tr>
              </tbody>
            </Table>
          </div>

          {/* VAT Accounts */}
          {data.vatAccounts.length > 0 && (
            <div className="mb-4">
              <h5 className="text-secondary">VAT ACCOUNT BALANCES</h5>
              <Table striped bordered hover>
                <thead className="table-secondary">
                  <tr>
                    <th>Account Code</th>
                    <th>Account Name</th>
                    <th className="text-end">Balance (₦)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.vatAccounts.map((account, index) => (
                    <tr key={account.account_code}>
                      <td>{account.account_code}</td>
                      <td>{account.account_name}</td>
                      <td className="text-end">
                        {formatNaira(account.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          <Row className="mt-4">
            <Col md={6}>
              <Card className="bg-light">
                <Card.Body>
                  <h6>VAT Summary</h6>
                  <p>
                    <strong>Input VAT:</strong> ₦
                    {formatNaira(data.summary.totalInputVAT)}
                  </p>
                  <p>
                    <strong>Output VAT:</strong> ₦
                    {formatNaira(data.summary.totalOutputVAT)}
                  </p>
                  <p>
                    <strong>Net VAT:</strong> ₦
                    {formatNaira(data.summary.netVATPayable)}
                  </p>
                  <p>
                    <strong>Status:</strong> {data.summary.status}
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="bg-light">
                <Card.Body>
                  <h6>FIRS Compliance</h6>
                  <p>
                    <strong>VAT Rate:</strong> {data.compliance.vatRate}
                  </p>
                  <p>
                    <strong>Reporting Period:</strong>{" "}
                    {data.compliance.reportingPeriod}
                  </p>
                  <p>
                    <strong>Due Date:</strong> {data.compliance.dueDate}
                  </p>
                  <p>
                    <strong>Penalty Rate:</strong> {data.compliance.penaltyRate}
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

export default VATReport;
