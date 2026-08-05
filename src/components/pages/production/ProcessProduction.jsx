import  { useState, useEffect } from "react";
import { Button, Table } from "reactstrap";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import CustomCard from "@/common/Custom/CustomCard2";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber } from "@/utilities";

export default function ProcessProduction() {
  const navigate = useNavigate();
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [productionData, setProductionData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProductionData();
  }, []);

  const fetchProductionData = () => {
    setLoading(true);
    _fetchApi(
      `/products/store/${activeBusiness.business_name}`,
      (data) => {
        setLoading(false);
        if (data.success) {
          setProductionData(data.data);
        }
      },
      (err) => {
        setLoading(false);
        console.log(err);
      }
    )
  };

  const handleView = (item) => {
    navigate(`/app/production/process/details?id=${item.production_id}`);
  };

  const handleProcess = (item) => {
    // console.log("Processing:", item);
  };

  return (
    <CustomCard header="Process Production">
      <div className="parent-component">
        <Table responsive bordered hover>
          <thead>
            <tr>
              <th>S/N</th>
              <th className="text-center">Product Name</th>
              <th className="text-center">Total Cost</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" className="text-center">
                  Loading...
                </td>
              </tr>
            ) : productionData.length > 0 ? (
              productionData.map((item, index) => {
                // Calculate total cost directly in the render method
                const rawMaterialCost = item.raw_materials.reduce(
                  (total, material) => total + material.quantity * parseFloat(material.price),
                  0
                );
                const expenseCost = item.expenses.reduce(
                  (total, expense) => total + parseFloat(expense.amount),
                  0
                );
                const totalCost = rawMaterialCost + expenseCost;

                return (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{item.production_name}</td>
                    <td className="text-right">₦{formatNumber(totalCost.toFixed(2))}</td>
                    <td className="d-flex justify-content-center">
                      <Button
                        color="primary"
                        size="sm"
                        className="mr-2"
                        onClick={() => handleView(item)}
                      >
                        View
                      </Button>
                      <Button
                        color="success"
                        size="sm"
                        onClick={() => handleProcess(item)}
                      >
                        Process
                      </Button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="4" className="text-center">
                  No production records found.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </CustomCard>
  );
}
