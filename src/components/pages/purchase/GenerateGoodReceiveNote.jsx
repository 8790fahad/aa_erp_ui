/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { FaEye } from "react-icons/fa";
import moment from "moment";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import { formatNumber1 } from "@/components/router/utilities";
import { Button, Input, Label, Badge } from "reactstrap";

function GenerateGoodReceiveNote() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [pr, setPr] = useState([]);
  const [remark, setRemark] = useState("");
  const [itemList, setItemList] = useState([]);
  const [truckNumber, setTruckNumber] = useState("");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [unitOfMeasurement, setUnitOfMeasurement] = useState("");
  const [additionalCostItem, setAdditionalCostItem] = useState("");
  const [additionalCostValue, setAdditionalCostValue] = useState("");

  const _form = {
    date: moment().format("YYYY-MM-DD"),
    purpose: "",
    from: "",
  };
  const [form, setForm] = useState(_form);

  const getPR = useCallback(() => {
    _postApi(
      `/account/purchase-requisition`,
      {
        query_type: "select-approved",
        requisitor: user.fullname,
        facilityId: activeBusiness.id,
      },
      (data) => {
        setLoading(false);
        if (data.success) {
          setPr(data.results);
        }
      },
      (err) => {
        setLoading(false);
        console.log(err);
      }
    );
  }, [activeBusiness.id, user.id]);
  const [loading1, setLoading1] = useState(false);

  const approveMemo = () => {
    setLoading1(true);
    _postApi(
      `/account/update-purchase-requisition`,
      {
        query_type: "update",
        pr_no: items.pr_no,
        status: "approved",
        facilityId: activeBusiness.id,
      },
      (data) => {
        setLoading(false);
        toast.success("Successfully Approved");
        getPR();
        setIsOpen(false);
        // if (data.success) {
        //   setPr(data.results);
        // }
      },
      (err) => {
        setLoading(false);
        console.log(err);
        setIsOpen(false);
      }
    );
  };

  useEffect(() => {
    getPR();
  }, [getPR]);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState({});

  return (
    <CustomCard header="Generate Good Receive Note" back="true">
      {/* <Row className="mx-0">
        <div className="d-flex justify-content-end align-items-center gap-2 mb-3">
          <Label for="searchFilter" className="mb-0 mr-2">
            Search:
          </Label>
          <Input
            id="searchFilter"
            type="text"
            bsSize="sm"
            placeholder="Search by warehouse name or requisition ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading && <Loading />}
        {!loading ? (
          <CustomTable
            data={filteredMemos}
            fields={fields}
            className={"mb-0"}
          />
        ) : (
          <Alert className="mt-3" color="info">
            No data to view
          </Alert>
        )}
      </Row> */}
      <div
        style={{
          marginBottom: 10,
          fontSize: 14,
          textTransform: "uppercase",
          marginRight: 10,
        }}
      >
        <div className="row mb-3">
          <div className="col-md-4">
            <Label>Truck Number</Label>
            <Input
              type="text"
              value={truckNumber || ""}
              onChange={(e) => setTruckNumber(e.target.value)}
              placeholder="Enter truck number"
            />
          </div>
          <div className="col-md-4">
            <Label>Waybill Number</Label>
            <Input
              type="text"
              value={waybillNumber || ""}
              onChange={(e) => setWaybillNumber(e.target.value)}
              placeholder="Enter waybill number"
            />
          </div>
          <div className="col-md-4">
            <Label>Unit of Measurement</Label>
            <Input
              type="text"
              value={unitOfMeasurement || ""}
              onChange={(e) => setUnitOfMeasurement(e.target.value)}
              placeholder="Enter unit of measurement"
            />
          </div>
        </div>
        <div className="d-flex justify-content-between mt-4">
          <b>Receive Details:  </b>
          {formatNumber1(items.total)}
        </div>
        <br />
        <table className="table table-bordered">
          <thead>
            <tr>
              <th className="text-center">S/N</th>
              <th className="text-center">Item Name</th>
              <th className="text-center">Unit Cost (₦)</th>
              <th className="text-center">Order Quantity</th>
              <th className="text-center">Receive Quantity</th>
              <th className="text-center">Total Cost (₦)</th>
              <th className="text-center">Expiry Date</th>
              <th className="text-center">Approve</th>
            </tr>
          </thead>
          <tbody>
            {itemList.map((item, idx) => (
              <tr key={item.item_list_id}>
                <td>{idx + 1}</td>
                <td>{item.item_name}</td>
                <td className="text-right">{formatNumber1(item.est_cost)}</td>
                <td className="text-center">{item.quantity}</td>
                <td className="text-center">
                  <Input
                    type="number"
                    style={{ width: "80px", margin: "0 auto" }}
                    value={item.receivedQuantity || item.quantity}
                    onChange={(e) => {
                      const receivedQty = parseInt(e.target.value) || 0;
                      setItemList((prev) =>
                        prev.map((listItem) =>
                          listItem.id === item.id
                            ? { ...listItem, receivedQuantity: receivedQty }
                            : listItem
                        )
                      );
                    }}
                  />
                </td>
                <td className="text-right">
                  {formatNumber1(
                    item.est_cost * (item.receivedQuantity || item.quantity)
                  )}
                </td>
                <td className="text-center">
                  <Input
                    type="date"
                    style={{ width: "150px", margin: "0 auto" }}
                    value={item.expiryDate || ""}
                    onChange={(e) => {
                      setItemList((prev) =>
                        prev.map((listItem) =>
                          listItem.id === item.id
                            ? { ...listItem, expiryDate: e.target.value }
                            : listItem
                        )
                      );
                    }}
                  />
                </td>
                <td className="text-center">
                  <input
                    type="checkbox"
                    checked={item.approved}
                    onChange={() => {
                      setItemList((prev) =>
                        prev.map((listItem) =>
                          listItem.id === item.id
                            ? { ...listItem, approved: !listItem.approved }
                            : listItem
                        )
                      );
                    }}
                  />
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={7} className="text-right fw-bold">
                Total:
              </td>
              <td className="text-right">
                {formatNumber1(
                  itemList
                    .filter((item) => item.approved)
                    .reduce(
                      (sum, item) =>
                        sum +
                        item.est_cost *
                          (item.receivedQuantity || item.quantity),
                      0
                    )
                )}
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ flexDirection: "row", width: "100%" }}>
          <div
            style={{
              marginBottom: 0,
              fontSize: 14,
              textTransform: "uppercase",
              marginRight: 10,
            }}
          >
            <Label>
              <b>Additional Costing</b>
            </Label>
            <div className="row mb-3">
              <div className="col-md-6">
                <Label>Item Name</Label>
                <Input
                  type="text"
                  value={additionalCostItem || ""}
                  onChange={(e) => setAdditionalCostItem(e.target.value)}
                  placeholder="Enter item name"
                />
              </div>
              <div className="col-md-6">
                <Label>Cost (₦)</Label>
                <Input
                  type="number"
                  value={additionalCostValue || ""}
                  onChange={(e) => setAdditionalCostValue(e.target.value)}
                  placeholder="Enter cost amount"
                />
              </div>
            </div>
            <Label>Remark</Label>
            <Input
              value={remark}
              type="textarea"
              onChange={({ target: { value } }) => {
                setRemark(value);
              }}
            />
          </div>
        </div>

        <center>
          <div className="pt-4">
            <Button
              color="primary"
              // onClick={() => handleRejectAll()}
            >
              Submit
            </Button>
          </div>
        </center>
      </div>
    </CustomCard>
  );
}

export default GenerateGoodReceiveNote;
