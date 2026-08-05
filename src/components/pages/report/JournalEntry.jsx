/* eslint-disable no-unused-vars */
import { formatNumber } from "@/components/router/utilities";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Table, Input, Row, Col } from "reactstrap";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import { _fetchApi } from "@/redux/actions/api";
import { toast } from "sonner";

export default function JournalEntries() {
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const [inventoryData, setInventoryData] = useState([]);

  // const inventoryData = [
  //   {
  //     id: 1,
  //     date: "2023-01-01",
  //     description: "Laptop Repairment",
  //     amount: 100000,
  //     amountPaid: 50000,
  //   },
  //   {
  //     id: 2,
  //     date: "2023-01-02",
  //     description: "Macbook Repairment",
  //     amount: 200000,
  //     amountPaid: 100000,
  //   },
  //   {
  //     id: 3,
  //     date: "2023-01-03",
  //     description: "Mainframe Repairment",
  //     amount: 300000,
  //     amountPaid: 150000,
  //   },
  //   {
  //     id: 4,
  //     date: "2023-01-04",
  //     description: "Purchase of printer",
  //     amount: 400000,
  //     amountPaid: 600000,
  //   },
  //   {
  //     id: 5,
  //     date: "2023-01-05",
  //     description: "Purchase of scanner",
  //     amount: 500000,
  //     amountPaid: 255400,
  //   },
  // ];

  const filteredData = inventoryData.filter((item) =>
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getJournalEntries = () => {
    _fetchApi(`/account/get-transactions`, (resp) => {
      if (resp.success) {
        console.log(resp.results);
        setInventoryData(resp.results);
      } else {
        toast.error("Failed to load chart data.");
      }
    });
  };

  React.useEffect(() => {
    getJournalEntries();
  }, []);

  const handlePostClick = (item) => {
    localStorage.setItem("selectedJournalEntry", JSON.stringify(item));
    navigate("/app/reports/journal-entries-form");
  };

  return (
    <Container>
      {JSON.stringify(filteredData)}
      <CustomCard header="Accounting Dashboard">
        <Row className="mb-3">
          <Col md={12}>
            <Input
              type="text"
              placeholder="Search through journal entry..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Col>
        </Row>
        <Table striped bordered responsive>
          <thead>
            <tr>
              <th className="text-center">SN</th>
              <th className="text-center">Date</th>
              <th className="text-center">Description</th>
              <th className="text-center">Amount(₦)</th>
              <th className="text-center">Amount Paid( ₦)</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr key={item.id}>
                <td className="text-center">{index + 1}</td>
                <td>{item.transaction_date}</td>
                <td>{item.description}</td>
                <td className="text-right">{formatNumber(item.amount_paid)}</td>
                <td className="text-right">{formatNumber(item.amount)}</td>
                <td className="d-flex justify-content-center">
                  <CustomButton
                    size="sm"
                    className="m-1 ml-2"
                    onClick={() => handlePostClick(item)}
                  >
                    Post
                  </CustomButton>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </CustomCard>
    </Container>
  );
}
