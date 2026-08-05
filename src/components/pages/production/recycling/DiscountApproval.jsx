import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomTable1 from "@/common/Custom/CustomTable1";
import Loading from "@/common/Custom/Loading";
import { formatNumber1 } from "@/components/router/utilities";
import { _postApi } from "@/redux/actions/api";

import { toast } from "sonner";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  //   Badge,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  Row,
} from "reactstrap";

export default function DiscountApproval() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState("");
  //   const [itemList, setItemList] = useState([]);
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
    // _postApi(
    //   "/production/select-details",
    //   {
    //     query_type: "select-details",
    //     mr_no: item.mr_no,
    //     // date: moment().format("YYYY-MM-DD"),
    //     // user_id: user.id,
    //   },
    //   (res) => {
    //     if (res.success) {
    //       setItemList(res.results);
    //     }
    //   },
    //   (err) => {
    //     toast.error("Error Occurred");
    //     console.log(err);
    //   }
    // );
  };
  const getPR = useCallback(() => {
    _postApi(
      `/v1/materials/getDiscountMaterials`,
      {
        customerNo: "",
        materials: [],
        query_type: "select",
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
          {item.date ? moment(item.date).format("YYYY-MM-DD") : "-"}
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
      value: "amount",
      title: "Total Amount",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-sm font-semibold">
          {formatNumber1(item.amount || 0)}
        </div>
      ),
    },
    {
      value: "discount",
      title: "Discount",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-sm">{formatNumber1(item.discount || 0)}</div>
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
            onClick={() => viewList(item)}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
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
      ? pr?.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pr?.collection_id?.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
  });

  const handleReject = () => {
    setIsOpen(!isOpen);
  };
  const handleApprove = () => {
    setIsOpen(!isOpen);
    // _postApi(
    //   "/v1/materials/approve_collection",
    //   {
    //     query_type: "approve",
    //     collection_id: items.collection_id,
    //     status: "approved",
    //   },
    //   (res) => {
    //     if (res.success) {
    //       toast.success(res.message);
    //       setIsOpen(!isOpen);
    //       getPR();
    //     }
    //     setLoading(false);
    //   },
    //   (err) => {
    //     toast.error("Error Occurred");
    //     console.error(err);
    //     setLoading(false);
    //   }
    // );
  };
  return (
    <>
      <CustomCard header="Discount Approval">
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
              message="No discount approvals found"
            />
          ) : (
            <Alert className="mt-3" color="info">
              No data to view
            </Alert>
          )}
        </Row>

        <Modal isOpen={isOpen} toggle={toggle} size="md">
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
                    Collection No.: <b>{items?.collection_id}</b>
                  </div>
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
                  Discount Details: <br />
                  {/* <table className="table table-bordered">
                                    <thead>
                                      <tr>
                                        <th className="text-center">S/N</th>
                        
                                        <th className="text-center">Material Name</th>
                                        <th className="text-center">Discount </th>
          
                                      </tr>
                                    </thead>

                                    <tbody>
                                      {itemList?.map((item, idx) => (
                                        <tr key={item.item_list_id}>
                                          <td>{idx + 1}</td>
                                          <td className="text-center">{item?.type}</td>
                                          <td className="text-center">
                                            {Number(item?.discount)?.toLocaleString()} (KG)
                                          </td>
                         
                                        </tr>
                                      ))}
                                  
                                    </tbody>
   </table> */}
                  <div>{items.discount}</div>
                </div>
                <div className="flex justify-center gap-3 mt-4">
                  <button
                    onClick={handleReject}
                    className="px-6 py-2 rounded-xl bg-red-600 text-white font-semibold 
               hover:bg-red-700 active:scale-95 transition-all"
                  >
                    Reject
                  </button>

                  <button
                    onClick={handleApprove}
                    className="px-6 py-2 rounded-xl bg-blue-600 text-white font-semibold 
               hover:bg-blue-700 active:scale-95 transition-all"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          </ModalBody>
        </Modal>
      </CustomCard>
    </>
  );
}
