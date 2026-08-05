import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomTable1 from "@/common/Custom/CustomTable1";
import Loading from "@/common/Custom/Loading";
// import { formatNumber1 } from "@/components/router/utilities";
import { _postApi } from "@/redux/actions/api";

import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { Eye } from "lucide-react";
//import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Alert,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  Row,
} from "reactstrap";
import { Badge } from "reactstrap/lib";

export default function CollectionList() {
  // const { activeBusiness, user } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemList, setItemList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState({});
  const [pr, setPr] = useState([]);
  const navigate = useNavigate();

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
        // date: moment().format("YYYY-MM-DD"),
        // user_id: user.id,
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
      `/v1/materials/get_collections`,
      {
        query_type: "select",
        status: "approved",
      },
      (res) => {
        if (res.success && res.results) {
          setPr(res.results);
        }
        setLoading(false);
      },
      (err) => {
        toast.error("Error Occurred");
        console.error(err);
        setLoading(false);
      }
    );
  }, []);

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
          {moment(item.date).format("YYYY-MM-DD")}
        </div>
      ),
    },
    {
      value: "collection_id",
      title: "Collection No.",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="font-medium">{item.collection_id}</div>
      ),
    },
    {
      value: "customer_name",
      title: "Customer Name",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-sm">{item.customer_name || "-"}</div>
      ),
    },
    {
      value: "status",
      title: "Status",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="flex">
          <Badge color={item.status === "pending" ? "primary" : "primary"}>
            {item.status}
          </Badge>
        </div>
      ),
    },
    {
      value: "action",
      title: "Action",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="flex justify-center">
          {item.status !== "awaiting_approval" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                navigate(
                  `/app/production/collection/collection-invoice?customerName=${item.customer_name}&receiptNo=${item.collection_id}&pass=${item.pass}`
                );
              }}
              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const filteredPr = pr.filter((pr) => {
    return searchTerm
      ? pr.collection_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pr.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
  });
  return (
    <>
      <CustomCard header="Production Collection">
        <div className="d-flex align-items-center justify-content-between">
          <CustomButton
            size="sm"
            color="primary"
            className="mb-2"
            onClick={() => {
              navigate("/app/production/collection/form");
            }}
          >
            Add Collection
          </CustomButton>
          <span className="d-flex justify-content-end align-items-center gap-2 mb-2 ml-auto">
            <Label for="searchFilter" className="mb-0 mr-2">
              Search:
            </Label>
            <Input
              id="searchFilter"
              type="text"
              bsSize="sm"
              placeholder="Search by Collection number"
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
              message="No collections found"
            />
          ) : (
            <Alert className="mt-3" color="info">
              No data to view
            </Alert>
          )}
        </Row>

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
                  Product Name: <b>{items?.product_name}</b>
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
                  Collection Details: <br />
                  <table className="table table-bordered">
                    <thead>
                      <tr>
                        <th className="text-center">S/N</th>
                        <th className="text-center">Item Name</th>
                        <th className="text-center">Initiated Qty </th>
                        <th className="text-center">Unit Category</th>
                        <th className="text-center">Unit of Measure</th>
                        {/* <th className="text-center">Unit Cost (₦)</th>
                        <th className="text-center">Total Cost (₦)</th> */}
                      </tr>
                    </thead>
                    {/* {JSON.stringify(itemList)} */}
                    <tbody>
                      {itemList?.map((item, idx) => (
                        <tr key={item.item_list_id}>
                          <td>{idx + 1}</td>
                          <td>{item?.item_name}</td>
                          <td className="text-center">
                            {Number(item?.initiated_qty)?.toLocaleString()}
                          </td>
                          <td className="text-center">{item?.unit_category}</td>
                          <td className="text-center">
                            {item?.initiated_unit_measure}
                          </td>
                        </tr>
                      ))}
                      {/* <tr>
                        <td colSpan={4} className="text-right fw-bold">
                          Total:
                        </td>
                        <td className="text-right">
                          {formatNumber1(items?.total)}
                        </td>
                      </tr> */}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </ModalBody>
        </Modal>
      </CustomCard>
    </>
  );
}
