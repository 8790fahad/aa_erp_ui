/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useState } from "react";
import { FaPrint } from "react-icons/fa";
import { Button, Table, Row, Container, Card, CardBody } from "reactstrap";

import CustomCard from "@/common/Custom/CustomCard2";
import SearchBar from "@/common/Custom/SearchBar";
// import SearchBar from "../components/SearchBar";
// import CustomCard from "../../";


function PendingSales() {
  const [state, setState] = useState("other");
  return (
    <Container>
      {/* <Container> */}
      <CustomCard
      // eslint-disable-next-line eqeqeq
      back={state==='baga'?true:false}
        header={
          state === "other"
            ? "Pending Sales"
            : state === "baga"
            ? "Pending Sales Details"
            : state === "another"
            ? "Item Issue Receipt"
            : null
        }
      >
        {/* <Card> */}
        {state === "other" ? (
          <CardBody>
            <Row>
              <SearchBar placeholder="Search for purchase" />
              <Table bordered>
                <thead>
                  <tr>
                    <th>Customer Name </th>
                    <th>Recive No</th>
                    <th>Total Amount</th>
                    <th>Total Item</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <a href="#" onClick={() => setState("baga")}>
                        Testing
                      </a>
                    </td>
                    <td>343434</td>
                    <td>300</td>
                    <td>500</td>
                  </tr>
                </tbody>
              </Table>
            </Row>
          </CardBody>
        ) : state === "baga" ? (
          <>
            <div className="row">
              <div className="col-md-6">Date</div>
              <div className="col-md-6">Customer Code</div>
              <div className="col-md-6">Total Amount</div>
              <div className="col-md-6">Total Discount</div>
              <div className="col-md-6">Approved By</div>
              <div className="col-md-6">Receipt No</div>
            </div>
            <Table bordered>
              <thead>
                <tr>
                  <th>Item </th>

                  <th>Qty </th>
                  <th>Price</th>
                  <th>Amount</th>
                  <th>Discount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </Table>
            <center>
              <Button color="primary" onClick={() => setState("another")}>
                Issue Items
              </Button>
            </center>
          </>
        ) : state === "another" ? (
          <>
            <div className="row mt-3">
              <div className="col-md-6">Date Receipt</div>
              <div className="col-md-6">Date Issue</div>
              <div className="col-md-6">Receipt No</div>
              <div className="col-md-6">Issue No</div>
              <div className="col-md-6">-----------------------</div>
              <div className="col-md-6">-----------------------</div>
              <div className="col-md-6">-----------------------</div>
              <div className="col-md-6">-----------------------</div>
              <div className="col-md-6">-----------------------</div>
              <div className="col-md-6">-----------------------</div>
            </div>
            <Button className="ml-4">
              <FaPrint />
              Print
            </Button>
          </>
        ) : null}
      </CustomCard>
    </Container>
  );
}

export default PendingSales;
