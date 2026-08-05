import React, { useState, useEffect } from "react";
import useQuery from "@/hooks/useQuery";
import CustomCard from "@/common/Custom/CustomCard2";
import { Row, Col, Table, Spinner } from "reactstrap";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber } from "@/utilities";

export default function ProcessDetails() {
  const query = useQuery();
  const id = query.get("id");
  const [loading, setLoading] = useState(false);
  const [productionData, setProductionData] = useState(null);

  useEffect(() => {
    fetchProductionData();
  }, [id]);

  const fetchProductionData = () => {
    setLoading(true);
    _fetchApi(
      `/products/${id}`,
      (data) => {
        setLoading(false);
        if (data.success) {
          setProductionData(data.data);
        }
      },
      (err) => {
        setLoading(false);
        console.error("Error fetching production data:", err);
      }
    );
  };

  return (
    <>
      <CustomCard header="Production Details" back>
        {loading ? (
          <div className="text-center">
            <Spinner color="secondary" />
            <p>Loading production details...</p>
          </div>
        ) : productionData ? (
          <Row className="mx-0">
            <Col md="5">
              <h5>Product Information</h5>
              <p>
                <strong>Production ID:</strong> {productionData.production_id}
              </p>
              <p>
                <strong>Product Name:</strong> {productionData.production_name}
              </p>
              <p>
                <strong>Store:</strong> {productionData.store}
              </p>
              <p>
                <strong>Date:</strong>{" "}
                {new Date(productionData.created_at).toLocaleString()}
              </p>
            </Col>
            <Col md="7">
              <h5>Cost Breakdown</h5>
              <Table responsive bordered>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Quantity</th>
                    <th>Price/Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {productionData.raw_materials.map((material, index) => (
                    <tr key={`raw-${index}`}>
                      <td>Raw Material</td>
                      <td>{material.name}</td>
                      <td className="text-right">{material.quantity}</td>
                      <td className="text-right">
                        ₦{formatNumber(parseFloat(material.price).toFixed(2))}
                      </td>
                    </tr>
                  ))}
                  {productionData.expenses.map((expense, index) => (
                    <tr key={`expense-${index}`}>
                      <td>Expense</td>
                      <td>{expense.name}</td>
                      <td>-</td>
                      <td className="text-right">
                        ₦{formatNumber(parseFloat(expense.amount).toFixed(2))}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan="3" className="text-right">
                      <strong>Total Cost:</strong>
                    </td>
                    <td className="text-right">
                      ₦
                      {formatNumber(
                        productionData.raw_materials.reduce(
                          (total, material) =>
                            total +
                            material.quantity * parseFloat(material.price),
                          0
                        ) +
                          productionData.expenses.reduce(
                            (total, expense) =>
                              total + parseFloat(expense.amount),
                            0
                          )
                      )}
                    </td>
                  </tr>
                </tbody>
              </Table>
            </Col>
          </Row>
        ) : (
          <div className="text-center">
            <p>No production details found.</p>
          </div>
        )}
      </CustomCard>
    </>
  );
}
