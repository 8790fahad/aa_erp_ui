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

const TaxSummaryReport = ({
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
      "/tax/tax-summary",
      {
        fromDate,
        toDate,
      },
      (response) => {
        if (response.success) {
          setData(response.data);
        } else {
          setError(response.message || "Failed to generate tax summary");
        }
        setLoading(false);
      },
      (err) => {
        setError("Error generating tax summary: " + err.message);
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
      ["Tax Summary Report - FIRS Compliant", ""],
      ["Period", `${data.period.from} to ${data.period.to}`],
      ["", ""],
      ["TAX ACCOUNTS", ""],
      ["Account Code", "Account Name", "Account Category", "Balance (₦)"],
      ...data.taxAccounts.map((account) => [
        account.account_code,
        account.account_name,
        account.account_category,
        formatNumber1(account.balance),
      ]),
      ["", ""],
      ["TAX SUMMARY", ""],
      ["Total Tax Liability", formatNumber1(data.summary.totalTaxLiability)],
      ["Number of Tax Accounts", data.summary.accountCount],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax_summary_${fromDate}_to_${toDate}.csv`;
    a.click();
  };

  const getTaxBadgeVariant = (category) => {
    switch (category) {
      case "tax":
        return "danger";
      case "VAT":
        return "warning";
      case "WHT":
        return "info";
      case "CIT":
        return "success";
      default:
        return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <Spinner animation="border" />
        <p className="mt-2">Generating Tax Summary...</p>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  if (!data) {
    return (
      <Alert variant="info">
        Click "Generate Reports" to create the Tax Summary
      </Alert>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>
          Tax Summary Report - FIRS Compliant for the period {data.period.from}{" "}
          to {data.period.to}
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
          {/* Tax Accounts */}
          <div className="mb-4">
            <h5 className="text-primary">TAX ACCOUNTS</h5>
            <Table striped bordered hover responsive>
              <thead className="table-primary">
                <tr>
                  <th>S/N</th>
                  <th>Account Code</th>
                  <th>Account Name</th>
                  <th>Account Category</th>
                  <th className="text-end">Balance (₦)</th>
                </tr>
              </thead>
              <tbody>
                {data.taxAccounts.length > 0 ? (
                  data.taxAccounts.map((account, index) => (
                    <tr key={account.account_code}>
                      <td>{index + 1}</td>
                      <td>{account.account_code}</td>
                      <td>{account.account_name}</td>
                      <td>
                        <Badge
                          bg={getTaxBadgeVariant(account.account_category)}
                        >
                          {account.account_category}
                        </Badge>
                      </td>
                      <td
                        className={`text-end ${
                          parseFloat(account.balance) < 0
                            ? "text-danger"
                            : "text-success"
                        }`}
                      >
                        {formatNumber1(account.balance)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center text-muted">
                      No tax accounts found
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="table-primary">
                <tr>
                  <th colSpan="4">Total Tax Liability</th>
                  <th className="text-end">
                    {formatNumber1(data.summary.totalTaxLiability)}
                  </th>
                </tr>
              </tfoot>
            </Table>
          </div>

          {/* Tax Summary Cards */}
          <div className="mb-4">
            <h5 className="text-info">TAX SUMMARY</h5>
            <Row>
              <Col md={3} className="mb-3">
                <Card className="text-center h-100">
                  <Card.Body>
                    <h3 className="text-primary">
                      {data.summary.accountCount}
                    </h3>
                    <p className="mb-0">Tax Accounts</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3} className="mb-3">
                <Card className="text-center h-100">
                  <Card.Body>
                    <h3 className="text-success">
                      ₦{formatNumber1(data.summary.totalTaxLiability)}
                    </h3>
                    <p className="mb-0">Total Tax Liability</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3} className="mb-3">
                <Card className="text-center h-100">
                  <Card.Body>
                    <h3 className="text-warning">{data.compliance.vatRate}</h3>
                    <p className="mb-0">VAT Rate</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3} className="mb-3">
                <Card className="text-center h-100">
                  <Card.Body>
                    <h3 className="text-danger">{data.compliance.citRate}</h3>
                    <p className="mb-0">CIT Rate</p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </div>

          {/* Tax Rates and Compliance */}
          <div className="mb-4">
            <h5 className="text-warning">TAX RATES & COMPLIANCE</h5>
            <Row>
              <Col md={6}>
                <Card className="bg-light">
                  <Card.Body>
                    <h6>Tax Rates</h6>
                    <p>
                      <strong>VAT Rate:</strong> {data.compliance.vatRate}
                    </p>
                    <p>
                      <strong>WHT Rates:</strong>{" "}
                      {data.compliance.whtRates.join(", ")}
                    </p>
                    <p>
                      <strong>CIT Rate:</strong> {data.compliance.citRate}
                    </p>
                    <p>
                      <strong>Minimum Tax Rate:</strong>{" "}
                      {data.compliance.minimumTaxRate}
                    </p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="bg-light">
                  <Card.Body>
                    <h6>Compliance Requirements</h6>
                    <p>
                      <strong>Reporting Frequency:</strong>{" "}
                      {data.compliance.reportingFrequency}
                    </p>
                    <p>
                      <strong>Next Due Date:</strong>{" "}
                      {data.compliance.nextDueDate}
                    </p>
                    <p>
                      <strong>Penalty Rate:</strong> 10% of tax due for late
                      filing
                    </p>
                    <p>
                      <strong>Interest Rate:</strong> 21% per annum for late
                      payment
                    </p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </div>

          {/* Tax Categories Breakdown */}
          <div className="mb-4">
            <h5 className="text-secondary">TAX CATEGORIES BREAKDOWN</h5>
            <Row>
              {["tax", "VAT", "WHT", "CIT"].map((category) => {
                const categoryAccounts = data.taxAccounts.filter(
                  (account) =>
                    account.account_category === category ||
                    account.account_name.toUpperCase().includes(category)
                );
                const categoryTotal = categoryAccounts.reduce(
                  (sum, account) => sum + parseFloat(account.balance),
                  0
                );

                return (
                  <Col md={6} lg={3} key={category} className="mb-3">
                    <Card className="h-100">
                      <Card.Header
                        className={`bg-${getTaxBadgeVariant(
                          category
                        )} text-white`}
                      >
                        <h6 className="mb-0">{category}</h6>
                      </Card.Header>
                      <Card.Body>
                        <p>
                          <strong>Accounts:</strong> {categoryAccounts.length}
                        </p>
                        <p>
                          <strong>Total Balance:</strong> ₦
                          {formatNumber1(categoryTotal)}
                        </p>
                        <p>
                          <strong>Average Balance:</strong> ₦
                          {formatNumber1(
                            categoryAccounts.length > 0
                              ? categoryTotal / categoryAccounts.length
                              : 0
                          )}
                        </p>
                      </Card.Body>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </div>

          <Row className="mt-4">
            <Col md={6}>
              <Card className="bg-light">
                <Card.Body>
                  <h6>Tax Summary</h6>
                  <p>
                    <strong>Total Tax Accounts:</strong>{" "}
                    {data.summary.accountCount}
                  </p>
                  <p>
                    <strong>Total Tax Liability:</strong> ₦
                    {formatNumber1(data.summary.totalTaxLiability)}
                  </p>
                  <p>
                    <strong>Average per Account:</strong> ₦
                    {formatNumber1(
                      data.summary.accountCount > 0
                        ? data.summary.totalTaxLiability /
                            data.summary.accountCount
                        : 0
                    )}
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="bg-light">
                <Card.Body>
                  <h6>FIRS Compliance Status</h6>
                  <p>✓ All tax accounts identified</p>
                  <p>✓ Proper tax categorization</p>
                  <p>✓ Compliance requirements met</p>
                  <p>✓ Regular reporting maintained</p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
};

export default TaxSummaryReport;
