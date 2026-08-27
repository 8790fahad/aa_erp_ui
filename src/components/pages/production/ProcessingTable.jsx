import React from "react";
import { Table, Button } from "reactstrap";

export default function ProcessingTable({ data, onView, onProcess }) {
  return (
    <>
      <Table responsive bordered hover>
        <thead>
          <tr>
            <th>SZN</th>
            <th className="text-center">Product Name</th>
            <th className="text-center">Total Cost</th>
            <th className="text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((item, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{item.productName}</td>
                <td className="text-right">₦{item.totalCost.toFixed(2)}</td>
                <td className="d-flex justify-content-center">
                  <Button
                    color="primary"
                    size="sm"
                    className="mr-2"
                    onClick={onView(item)}
                  >
                    View
                  </Button>
                  <Button
                    color="success"
                    size="sm"
                    onClick={() => onProcess(item)}
                  >
                    Process
                  </Button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="text-center">
                No production records found.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </>
  );
}
