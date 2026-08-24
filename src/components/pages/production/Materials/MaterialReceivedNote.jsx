/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import { useCallback, useEffect, useState } from "react";
import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomTable1 from "@/common/Custom/CustomTable1";
import Loading from "@/common/Custom/Loading";
import { _postApi } from "@/redux/actions/api";

import { toast } from "sonner";
import moment from "moment";
import { Eye } from "lucide-react";
import { useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Input, Label, Modal, ModalBody, ModalHeader, Row } from "reactstrap";
import { Alert } from "reactstrap/lib";

export default function MaterialReceivedNote() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemList, setItemList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState({});
  const [pr, setPr] = useState([]);
  const navigate = useNavigate();
  const [editableItems, setEditableItems] = useState([]);

  useEffect(() => {
    if (itemList?.length) {
      const updatedItems = itemList.map((item) => ({
        ...item,
        approved_qty: item.initiated_qty,
      }));
      setEditableItems(updatedItems);
    }
  }, [itemList]);

  const toggle = (item) => {
    setItems(item);
    setIsOpen(!isOpen);
  };

  const viewList = (item) => {
    toggle(item);
    _postApi(
      "/production/select-details",
      {
        query_type: "select-details",
        mr_no: item.mr_no,
      },
      (res) => {
        if (res.success) {
          setItemList(res.results);
        }
      },
      (err) => {
        toast.error("Error Occurred");
        console.log(err);
      }
    );
  };

  const getPR = useCallback(() => {
    _postApi(
      `/production/insert`,
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

  useEffect(() => {
    getPR();
  }, [getPR]);

  const fields = [
    {
      value: "date",
      title: "Date",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-sm">
          {item.date ? moment(item.date).format("YYYY-MM-DD") : "-"}
        </div>
      ),
    },
    {
      value: "mr_no",
      title: "MR No.",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="font-medium">{item.mr_no}</div>
      ),
    },
    {
      value: "product_name",
      title: "Product Name",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-sm">{item.product_name || "-"}</div>
      ),
    },
    {
      value: "action",
      title: "Action",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigate(`/app/production/record?mr_no=${item.mr_no}`);
              // viewList(item);
            }}
            className="text-[var(--aa-accent)] hover:text-[var(--aa-accent-hover)] hover:bg-blue-50"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const filteredPr = pr.filter((pr) => {
    return searchTerm
      ? pr.branch.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pr.mr_no.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
  });

  const handleApprove = () => {
    if (!items.mr_no || editableItems.length === 0) {
      toast.error("Missing MR No or Materials");
      return;
    }
    setLoading(true);

    _postApi(
      "/production/update",
      {
        query_type: "approve",
        mr_no: items.mr_no,
        status: "approved",
        materials: editableItems.map((m) => ({
          item_code: m.item_code,
          approved_qty: m.approved_qty,
        })),
      },
      (res) => {
        if (res.success) {
          toast.success(res.message);
          setIsOpen(!isOpen);
          getPR();
        }
        setLoading(false);
      },
      (err) => {
        toast.error("Error Occurred");
        console.error(err);
        setLoading(false);
      }
    );
  };

  return (
    <>
      <CustomCard header="Production Received Note">
        <div className="d-flex align-items-center justify-content-between">
          <span className="d-flex justify-content-end align-items-center gap-2 mb-2 ml-auto">
            <Label for="searchFilter" className="mb-0 mr-2">
              Search:
            </Label>
            <Input
              id="searchFilter"
              type="text"
              bsSize="sm"
              placeholder="Search by MR number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </span>
        </div>

        <Row className="mx-0">
          {loading ? (
            <div className="d-flex justify-content-center my-5">
              <Loading />
            </div>
          ) : filteredPr && filteredPr.length > 0 ? (
            <CustomTable1
              data={filteredPr}
              fields={fields}
              loading={loading}
              pageSize={10}
              message="No material received notes found"
            />
          ) : (
            <Alert className="mt-3" color="info">
              No data to view
            </Alert>
          )}
        </Row>

        {/* modal starts here */}
        <Modal isOpen={isOpen} toggle={toggle} size="xl">
          <ModalHeader toggle={toggle}>
            View manufacturing requisition
          </ModalHeader>
          {/* {JSON.stringify(items)} */}
          <ModalBody>
            <div style={{ marginBottom: 20 }}>
              <div
                style={{ display: "flex", flexDirection: "row", width: "100%" }}
              >
                <div style={{ flexDirection: "row", width: "100%" }}>
                  <div
                    style={{
                      marginBottom: 10,
                      fontSize: 12,
                      textTransform: "uppercase",
                      marginRight: 10,
                    }}
                  >
                    Date: <b>{moment().format(items?.date)}</b>
                  </div>
                </div>
                <div style={{ flexDirection: "row", width: "100%" }}>
                  <div
                    style={{
                      marginBottom: 10,
                      fontSize: 12,
                      textTransform: "uppercase",
                      marginRight: 10,
                      textAlign: "right",
                    }}
                  >
                    MR No.: <b>{items?.mr_no}</b>
                  </div>
                </div>
              </div>
              <div style={{ flexDirection: "row", width: "100%" }}>
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 12,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  From branch: <b>{items?.branch}</b>
                </div>
              </div>
              <div style={{ flexDirection: "row", width: "100%" }}>
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 12,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  Requisitor: <b>{items?.requisitor}</b>
                </div>
              </div>
              <div style={{ flexDirection: "row", width: "100%" }}>
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 14,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  Product name: <b>{items?.product_name}</b>
                </div>
              </div>

              <div style={{ flexDirection: "row", width: "100%" }}>
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 14,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  Materials: <br />
                  <table className="table table-bordered">
                    <thead>
                      <tr>
                        <th className="text-center">S/N</th>
                        <th className="text-center">Item Name</th>
                        <th className="text-center">Initiated Qty</th>
                        <th className="text-center">Approved Qty</th>
                        {/* <th className="text-center">Total Cost (₦)</th> */}
                      </tr>
                    </thead>
                    <tbody>
                      {/* {JSON.stringify(itemList)} */}
                      {editableItems?.map((item, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>
                            {/* <input
                              type="text"
                              value={item.item_name || ""}
                              onChange={(e) =>
                                handleChange(idx, "item_name", e.target.value)
                              }
                              className="form-control"
                            /> */}
                            {item?.item_name}
                          </td>
                          <td className="text-center">
                            {Number(item?.initiated_qty)?.toLocaleString()}
                          </td>

                          <td className="text-center">
                            {Number(item?.approved_qty)?.toLocaleString()}
                          </td>

                          {/* <td className="text-right">
                            <input
                              type="number"
                              value={item.approved_qty || ""}
                              onChange={(e) =>
                                handleChange(
                                  idx,
                                  "approved_qty",
                                  e.target.value
                                )
                              }
                              className="form-control text-center"
                            />
                          </td> */}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-center">
                    <CustomButton
                      size="sm"
                      color="success"
                      className="mb-2 pl-5 pr-5"
                      onClick={handleApprove}
                    >
                      Approve
                    </CustomButton>
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>
        </Modal>
      </CustomCard>
    </>
  );
}
