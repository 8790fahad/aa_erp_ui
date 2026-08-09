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

const CITReport = ({ facilityId, fromDate, toDate, loading, setLoading }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (facilityId && toDate && loading) {
      generateReport();
    }
  }, [facilityId, fromDate, toDate, loading]);

  const generateReport = () => {
    _postApi(
      "/tax/cit-computation",
      {
        fromDate,
        toDate,
      },
      (response) => {
        if (response.success) {
          setData(response.data);
        } else {
          setError(response.message || "Failed to generate CIT computation");
        }
        setLoading(false);
      },
      (err) => {
        setError("Error generating CIT computation: " + err.message);
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
      ["Company Income Tax (CIT) Computation - FIRS Compliant", ""],
      ["Period", `${data.period.from} to ${data.period.to}`],
      ["", ""],
      ["COMPUTATION", "Amount (₦)"],
      ["Gross Revenue", formatNaira(data.computation.grossRevenue)],
      ["", ""],
      ["Allowable Deductions", ""],
      [
        "Operating Expenses",
        formatNaira(data.computation.allowableDeductions.operatingExpenses),
      ],
      [
        "Capital Allowances",
        formatNaira(data.computation.allowableDeductions.capitalAllowances),
      ],
      [
        "Total Allowable Deductions",
        formatNaira(data.computation.allowableDeductions.total),
      ],
      ["", ""],
      ["Adjusted Profit", formatNaira(data.computation.adjustedProfit)],
      ["", ""],
      ["CIT CALCULATION", ""],
      ["CIT Rate", data.computation.citCalculation.citRate],
      [
        "CIT on Profit",
        formatNaira(data.computation.citCalculation.citOnProfit),
      ],
      [
        "Minimum Tax",
        formatNaira(data.computation.citCalculation.minimumTax),
      ],
      [
        "Final CIT Liability",
        formatNaira(data.computation.citCalculation.finalCITLiability),
      ],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cit_computation_${fromDate}_to_${toDate}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <Spinner animation="border" />
        <p className="mt-2">Generating CIT Computation...</p>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  if (!data) {
    return (
      <Alert variant="info">
        Click "Generate Reports" to create the CIT Computation
      </Alert>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>
          Company Income Tax (CIT) Computation - FIRS Compliant for the period{" "}
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
          {/* CIT Computation */}
          <div className="mb-4">
            <h5 className="text-primary">CIT COMPUTATION</h5>
            <Table striped bordered hover>
              <tbody>
                <tr className="table-success">
                  <th>Gross Revenue</th>
                  <td className="text-end">
                    {formatNaira(data.computation.grossRevenue)}
                  </td>
                </tr>
                <tr>
                  <th colSpan="2" className="text-center bg-light">
                    Less: Allowable Deductions
                  </th>
                </tr>
                <tr>
                  <td className="ps-4">Operating Expenses</td>
                  <td className="text-end">
                    (
                    {formatNaira(
                      data.computation.allowableDeductions.operatingExpenses
                    )}
                    )
                  </td>
                </tr>
                <tr>
                  <td className="ps-4">Capital Allowances</td>
                  <td className="text-end">
                    (
                    {formatNaira(
                      data.computation.allowableDeductions.capitalAllowances
                    )}
                    )
                  </td>
                </tr>
                <tr className="table-warning">
                  <th>Total Allowable Deductions</th>
                  <td className="text-end">
                    ({formatNaira(data.computation.allowableDeductions.total)}
                    )
                  </td>
                </tr>
                <tr className="table-info">
                  <th>Adjusted Profit</th>
                  <td className="text-end">
                    {formatNaira(data.computation.adjustedProfit)}
                  </td>
                </tr>
              </tbody>
            </Table>
          </div>

          {/* CIT Calculation */}
          <div className="mb-4">
            <h5 className="text-danger">CIT CALCULATION</h5>
            <Table striped bordered hover>
              <tbody>
                <tr>
                  <th>CIT Rate</th>
                  <td className="text-end">
                    {data.computation.citCalculation.citRate}
                  </td>
                </tr>
                <tr>
                  <th>CIT on Profit</th>
                  <td className="text-end">
                    {formatNaira(data.computation.citCalculation.citOnProfit)}
                  </td>
                </tr>
                <tr>
                  <th>Minimum Tax (1% of gross turnover)</th>
                  <td className="text-end">
                    {formatNaira(data.computation.citCalculation.minimumTax)}
                  </td>
                </tr>
                <tr className="table-danger">
                  <th>Final CIT Liability (Higher of CIT or Minimum Tax)</th>
                  <td className="text-end">
                    {formatNaira(
                      data.computation.citCalculation.finalCITLiability
                    )}
                  </td>
                </tr>
              </tbody>
            </Table>
          </div>

          {/* Deductions Breakdown */}
          <div className="mb-4">
            <h5 className="text-info">DEDUCTIONS BREAKDOWN</h5>
            <Table striped bordered hover>
              <thead className="table-info">
                <tr>
                  <th>Category</th>
                  <th className="text-end">Amount (₦)</th>
                </tr>
              </thead>
              <tbody>
                {data.breakdown.deductions.map((deduction, index) => (
                  <tr key={index}>
                    <td>{deduction.account_category}</td>
                    <td className="text-end">
                      {formatNaira(deduction.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="table-info">
                <tr>
                  <th>Total Operating Expenses</th>
                  <th className="text-end">
                    {formatNaira(
                      data.computation.allowableDeductions.operatingExpenses
                    )}
                  </th>
                </tr>
              </tfoot>
            </Table>
          </div>

          {/* Capital Allowances */}
          <div className="mb-4">
            <h5 className="text-warning">
              CAPITAL ALLOWANCES (20% Straight-line)
            </h5>
            <Table striped bordered hover>
              <thead className="table-warning">
                <tr>
                  <th>Asset Type</th>
                  <th className="text-end">Cost (₦)</th>
                  <th className="text-end">Annual Allowance (₦)</th>
                </tr>
              </thead>
              <tbody>
                {data.breakdown.capitalAllowances.map((allowance, index) => (
                  <tr key={index}>
                    <td>{allowance.asset_type}</td>
                    <td className="text-end">
                      {formatNaira(allowance.cost)}
                    </td>
                    <td className="text-end">
                      {formatNaira(allowance.annual_allowance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="table-warning">
                <tr>
                  <th>Total Capital Allowances</th>
                  <th className="text-end">
                    {formatNaira(
                      data.computation.allowableDeductions.capitalAllowances
                    )}
                  </th>
                  <th className="text-end">
                    {formatNaira(
                      data.computation.allowableDeductions.capitalAllowances
                    )}
                  </th>
                </tr>
              </tfoot>
            </Table>
          </div>

          <Row className="mt-4">
            <Col md={6}>
              <Card className="bg-light">
                <Card.Body>
                  <h6>Tax Summary</h6>
                  <p>
                    <strong>Gross Revenue:</strong> ₦
                    {formatNaira(data.computation.grossRevenue)}
                  </p>
                  <p>
                    <strong>Total Deductions:</strong> ₦
                    {formatNaira(data.computation.allowableDeductions.total)}
                  </p>
                  <p>
                    <strong>Adjusted Profit:</strong> ₦
                    {formatNaira(data.computation.adjustedProfit)}
                  </p>
                  <p>
                    <strong>CIT Liability:</strong> ₦
                    {formatNaira(
                      data.computation.citCalculation.finalCITLiability
                    )}
                  </p>
                  <p>
                    <strong>Effective Tax Rate:</strong>{" "}
                    {data.computation.grossRevenue > 0
                      ? (
                          (parseFloat(
                            data.computation.citCalculation.finalCITLiability
                          ) /
                            parseFloat(data.computation.grossRevenue)) *
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
                  <h6>FIRS Compliance</h6>
                  <p>
                    <strong>Tax Year:</strong> {data.compliance.taxYear}
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
                  <p>
                    <strong>Advance Payment:</strong>{" "}
                    {data.compliance.advancePayment}
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

export default CITReport;
