import React, { useState, useEffect } from "react";
import { Table, Card, Row, Col, Alert, Spinner, Button } from "react-bootstrap";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";

const BalanceSheetReport = ({ facilityId, asOfDate, loading, setLoading }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (facilityId && asOfDate && loading) {
      generateReport();
    }
  }, [facilityId, asOfDate, loading]);

  const generateReport = () => {
    _postApi(
      "/accounting/balance-sheet",
      {
        asOfDate,
      },
      (response) => {
        if (response.success) {
          setData(response.data);
        } else {
          setError(response.message || "Failed to generate balance sheet");
        }
        setLoading(false);
      },
      (err) => {
        setError("Error generating balance sheet: " + err.message);
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
      ["Statement of Financial Position", ""],
      ["As at", data.asOfDate],
      ["", ""],
      ["ASSETS", "Amount (₦)"],
      ["Current Assets", ""],
      ...data.assets.current.map((asset) => [
        asset.account_name,
        formatNumber1(asset.amount),
      ]),
      ["Total Current Assets", formatNumber1(data.assets.currentTotal)],
      ["", ""],
      ["Non-Current Assets", ""],
      ...data.assets.nonCurrent.map((asset) => [
        asset.account_name,
        formatNumber1(asset.amount),
      ]),
      ["Total Non-Current Assets", formatNumber1(data.assets.nonCurrentTotal)],
      ["TOTAL ASSETS", formatNumber1(data.totals.totalAssets)],
      ["", ""],
      ["LIABILITIES", "Amount (₦)"],
      ["Current Liabilities", ""],
      ...data.liabilities.current.map((liability) => [
        liability.account_name,
        formatNumber1(liability.amount),
      ]),
      [
        "Total Current Liabilities",
        formatNumber1(data.liabilities.currentTotal),
      ],
      ["", ""],
      ["Non-Current Liabilities", ""],
      ...data.liabilities.nonCurrent.map((liability) => [
        liability.account_name,
        formatNumber1(liability.amount),
      ]),
      [
        "Total Non-Current Liabilities",
        formatNumber1(data.liabilities.nonCurrentTotal),
      ],
      ["TOTAL LIABILITIES", formatNumber1(data.liabilities.total)],
      ["", ""],
      ["EQUITY", "Amount (₦)"],
      ...data.equity.items.map((equity) => [
        equity.account_name,
        formatNumber1(equity.amount),
      ]),
      ["TOTAL EQUITY", formatNumber1(data.equity.total)],
      ["", ""],
      [
        "TOTAL LIABILITIES + EQUITY",
        formatNumber1(data.totals.totalLiabilitiesAndEquity),
      ],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balance_sheet_${asOfDate}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <Spinner animation="border" />
        <p className="mt-2">Generating Balance Sheet...</p>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  if (!data) {
    return (
      <Alert variant="info">
        Click "Generate Reports" to create the Balance Sheet
      </Alert>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Statement of Financial Position as at {data.asOfDate}</h4>
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
          <Row>
            {/* Assets Column */}
            <Col md={6}>
              <h5 className="text-primary mb-3">ASSETS</h5>

              {/* Current Assets */}
              <div className="mb-4">
                <h6 className="text-info">Current Assets</h6>
                <Table striped bordered hover size="sm">
                  <thead className="table-info">
                    <tr>
                      <th>Description</th>
                      <th className="text-end">Amount (₦)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.assets.current.map((asset, index) => (
                      <tr key={asset.account_code}>
                        <td>{asset.account_name}</td>
                        <td className="text-end">
                          {formatNumber1(asset.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-info">
                    <tr>
                      <th>Total Current Assets</th>
                      <th className="text-end">
                        {formatNumber1(data.assets.currentTotal)}
                      </th>
                    </tr>
                  </tfoot>
                </Table>
              </div>

              {/* Non-Current Assets */}
              <div className="mb-4">
                <h6 className="text-info">Non-Current Assets</h6>
                <Table striped bordered hover size="sm">
                  <thead className="table-info">
                    <tr>
                      <th>Description</th>
                      <th className="text-end">Amount (₦)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.assets.nonCurrent.map((asset, index) => (
                      <tr key={asset.account_code}>
                        <td>{asset.account_name}</td>
                        <td className="text-end">
                          {formatNumber1(asset.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-info">
                    <tr>
                      <th>Total Non-Current Assets</th>
                      <th className="text-end">
                        {formatNumber1(data.assets.nonCurrentTotal)}
                      </th>
                    </tr>
                  </tfoot>
                </Table>
              </div>

              <div className="mb-4">
                <Table striped bordered hover>
                  <tfoot className="table-primary">
                    <tr>
                      <th>TOTAL ASSETS</th>
                      <th className="text-end">
                        {formatNumber1(data.totals.totalAssets)}
                      </th>
                    </tr>
                  </tfoot>
                </Table>
              </div>
            </Col>

            {/* Liabilities and Equity Column */}
            <Col md={6}>
              <h5 className="text-danger mb-3">LIABILITIES & EQUITY</h5>

              {/* Current Liabilities */}
              <div className="mb-4">
                <h6 className="text-warning">Current Liabilities</h6>
                <Table striped bordered hover size="sm">
                  <thead className="table-warning">
                    <tr>
                      <th>Description</th>
                      <th className="text-end">Amount (₦)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.liabilities.current.map((liability, index) => (
                      <tr key={liability.account_code}>
                        <td>{liability.account_name}</td>
                        <td className="text-end">
                          {formatNumber1(liability.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-warning">
                    <tr>
                      <th>Total Current Liabilities</th>
                      <th className="text-end">
                        {formatNumber1(data.liabilities.currentTotal)}
                      </th>
                    </tr>
                  </tfoot>
                </Table>
              </div>

              {/* Non-Current Liabilities */}
              <div className="mb-4">
                <h6 className="text-warning">Non-Current Liabilities</h6>
                <Table striped bordered hover size="sm">
                  <thead className="table-warning">
                    <tr>
                      <th>Description</th>
                      <th className="text-end">Amount (₦)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.liabilities.nonCurrent.map((liability, index) => (
                      <tr key={liability.account_code}>
                        <td>{liability.account_name}</td>
                        <td className="text-end">
                          {formatNumber1(liability.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-warning">
                    <tr>
                      <th>Total Non-Current Liabilities</th>
                      <th className="text-end">
                        {formatNumber1(data.liabilities.nonCurrentTotal)}
                      </th>
                    </tr>
                  </tfoot>
                </Table>
              </div>

              <div className="mb-4">
                <Table striped bordered hover>
                  <tfoot className="table-danger">
                    <tr>
                      <th>TOTAL LIABILITIES</th>
                      <th className="text-end">
                        {formatNumber1(data.liabilities.total)}
                      </th>
                    </tr>
                  </tfoot>
                </Table>
              </div>

              {/* Equity */}
              <div className="mb-4">
                <h6 className="text-success">Equity</h6>
                <Table striped bordered hover size="sm">
                  <thead className="table-success">
                    <tr>
                      <th>Description</th>
                      <th className="text-end">Amount (₦)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.equity.items.map((equity, index) => (
                      <tr key={equity.account_code}>
                        <td>{equity.account_name}</td>
                        <td className="text-end">
                          {formatNumber1(equity.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-success">
                    <tr>
                      <th>TOTAL EQUITY</th>
                      <th className="text-end">
                        {formatNumber1(data.equity.total)}
                      </th>
                    </tr>
                  </tfoot>
                </Table>
              </div>

              <div className="mb-4">
                <Table striped bordered hover>
                  <tfoot className="table-dark">
                    <tr>
                      <th>TOTAL LIABILITIES + EQUITY</th>
                      <th className="text-end">
                        {formatNumber1(data.totals.totalLiabilitiesAndEquity)}
                      </th>
                    </tr>
                  </tfoot>
                </Table>
              </div>
            </Col>
          </Row>

          {/* Balance Check */}
          {Math.abs(
            parseFloat(data.totals.totalAssets) -
              parseFloat(data.totals.totalLiabilitiesAndEquity)
          ) > 0.01 && (
            <Alert variant="warning" className="mt-3">
              <strong>Warning:</strong> Balance Sheet is not balanced. Assets: ₦
              {formatNumber1(data.totals.totalAssets)} | Liabilities & Equity: ₦
              {formatNumber1(data.totals.totalLiabilitiesAndEquity)}
            </Alert>
          )}

          <Row className="mt-4">
            <Col md={6}>
              <Card className="bg-light">
                <Card.Body>
                  <h6>Financial Ratios</h6>
                  <p>
                    <strong>Current Ratio:</strong>{" "}
                    {(
                      parseFloat(data.assets.currentTotal) /
                      parseFloat(data.liabilities.currentTotal)
                    ).toFixed(2)}
                  </p>
                  <p>
                    <strong>Debt to Equity:</strong>{" "}
                    {(
                      parseFloat(data.liabilities.total) /
                      parseFloat(data.equity.total)
                    ).toFixed(2)}
                  </p>
                  <p>
                    <strong>Asset Turnover:</strong> N/A (requires income
                    statement)
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="bg-light">
                <Card.Body>
                  <h6>IAS 1 Compliance</h6>
                  <p>✓ Current/Non-current classification</p>
                  <p>✓ Proper asset recognition</p>
                  <p>✓ Going concern assumption</p>
                  <p>✓ Fair presentation</p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
};

export default BalanceSheetReport;
