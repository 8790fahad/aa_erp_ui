import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomTable from "@/common/Custom/CustomTable";
import Loading from "@/common/Custom/Loading";
import { formatNumber1 } from "@/components/router/utilities";
import { _fetchApi, _postApi } from "@/redux/actions/api";

import { toast } from "sonner";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { FaEye } from "react-icons/fa";
import { useSelector } from "react-redux";
// import { useSelector } from "react-redux";
import {
  Alert,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  Row,
} from "reactstrap";
import { Badge, Button } from "reactstrap/lib";
import { useDispatch } from "react-redux";
import { getCustomers } from "@/redux/actions/customer";
import CustomTable1 from "@/common/Custom/CustomTable1";
import { Eye } from "lucide-react";

export default function CollectionApproval() {
  const dispatch = useDispatch();
  const options = useSelector((state) => state.customer.customerList) || [];

  const getList = useCallback(() => {
    dispatch(getCustomers());
  }, [dispatch]);
  useEffect(() => {
    getList();
  }, [getList]);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemList, setItemList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState({});
  const [pr, setPr] = useState([]);
  const facilityId = useSelector((state) => state.auth.activeBusiness.id);

  const toggle = (item) => {
    setItems(item);
    setIsOpen(!isOpen);
  };

  const viewList = (item) => {
    const customer = options.find((opt) => opt.customerNo === item.customer_id);
    if (customer) {
      console.log(customer.balance, item);
      toggle({ ...item, balance: customer.balance });
    } else {
      toggle(item);
    }
    _fetchApi(
      `/v1/materials/get/${item.collection_id}/${facilityId}`,
      (data) => {
        if (data && data.results) {
          setItemList(data.results);
          setLoading(false);
        }
      },
      (err) => {
        console.log(err);
        setLoading(false);
      }
    );
    // _postApi(
    //   "/production/select-details",
    //   {
    //     query_type: "select-details",
    //     mr_no: item.collection_id,
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
      `/v1/materials/get_collections`,
      {
        query_type: "select",
        status: "awaiting_approval",
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
      title: "Date",
      custom: true,
      component: (item) => (
        <div className="text-center">
          {moment(item.date).format("YYYY-MM-DD")}
        </div>
      ),
    },
    {
      title: "Collection No.",
      custom: true,
      component: (item) => (
        <div className="text-center">{item.collection_id}</div>
      ),
    },
    {
      title: "Pass No.",
      custom: true,
      component: (item) => <div className="text-center">{item.pass}</div>,
    },
    {
      title: "Customer Name",
      custom: true,
      component: (item) => (
        <div className="text-left">{item.customer_name}</div>
      ),
    },
    {
      title: "Status",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <Badge color={item.status === "pending" ? "primary" : "primary"}>
            {" "}
            {item.status}
          </Badge>
        </div>
      ),
    },
    // {
    //   title: "Discount",
    //   custom: true,
    //   component: (item) => (
    //     <div className="d-flex justify-content-center align-items-center">
    //       {/* <Badge color={item.discount === "pending" ? "primary" : "primary"}> */}
    //       {formatNumber1(item.discount)}
    //       {/* </Badge> */}
    //     </div>
    //   ),
    // },
    {
      title: "Action",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <CustomButton
            color="success"
            size={"sm"}
            className="m-1"
            handleSubmit={() => {
              viewList(item);
            }}
          >
            <Eye className="w-4 h-4" />
          </CustomButton>
        </div>
      ),
    },
  ];

  const filteredPr = pr.filter((pr) => {
    return searchTerm
      ? pr.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pr.collection_id.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
  });
  const handleReject = () => {
    setIsOpen(!isOpen);
  };
  const handleApprove = () => {
    setIsOpen(!isOpen);
    _postApi(
      "/v1/materials/approve_collection",
      {
        query_type: "approve",
        collection_id: items.collection_id,
        status: "approved",
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
      <CustomCard header="Production Collection">
        <div className="d-flex align-items-center justify-content-between">
          {/* <CustomButton
            size="sm"
            color="primary"
            className="mb-2"
            onClick={() => {
              navigate("/app/production/collection/form");
            }}
          >
            Add Collection
          </CustomButton> */}
          <span className="d-flex justify-content-end align-items-center gap-2 mb-2 ml-auto">
            <Label for="searchFilter" className="mb-0 mr-2">
              Search:
            </Label>
            <Input
              id="searchFilter"
              type="text"
              bsSize="sm"
              placeholder="Search by collection number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </span>
        </div>

        <Row className="mx-0">
          {loading && <Loading />}
          {!loading ? (
            <CustomTable1
              data={filteredPr}
              fields={fields}
              className={"mb-0"}
            />
          ) : (
            <Alert className="mt-3" color="info">
              No data to view
            </Alert>
          )}
        </Row>

        <Modal isOpen={isOpen} toggle={toggle} size="lg">
          <ModalHeader toggle={toggle}>View collection requisition</ModalHeader>
          {/* {JSON.stringify(itemList)} */}
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
                    Date: <b>{moment(items?.date).format("YYYY-MM-DD")}</b>
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
                    Pass No.: <b>{items?.pass}</b>
                  </div>
                </div>
              </div>

              <div
                style={{
                  flexDirection: "row",
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 14,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  Customer Name:{" "}
                  <b>
                    {items?.customer_name} ({items?.customer_id})
                  </b>
                </div>
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 14,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  Customer Liability: <b>{formatNumber1(items?.balance)}</b>
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
                        {/* <th className="text-center">Material Type</th> */}
                        <th className="text-center">Unit Category</th>
                        <th className="text-center">Initiated Qty </th>
                        {/* <th className="text-center">Unit of Measure</th> */}
                        {/* <th className="text-center">Unit Cost (₦)</th>
                        <th className="text-center">Total Cost (₦)</th> */}
                      </tr>
                    </thead>
                    {/* {JSON.stringify(itemList)} */}
                    <tbody>
                      {itemList
                        ?.filter((item) => item?.status !== "material_lost")
                        .map((item, idx) => (
                          <tr key={item.item_list_id}>
                            <td>{idx + 1}</td>
                            {/* <td>{item?.material_type}</td> */}
                            <td className="text-center">{item?.type}</td>
                            <td className="text-center">
                              {Number(item?.quantity_out)?.toLocaleString()}{" "}
                              (KG)
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
                <div className="d-flex justify-content-center">
                  <Button
                    color="danger"
                    size="md"
                    className="m-1"
                    onClick={() => handleReject()}
                  >
                    Reject
                  </Button>
                  <Button
                    color="primary"
                    size="md"
                    className="m-1"
                    onClick={() => handleApprove()}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            </div>
          </ModalBody>
        </Modal>
      </CustomCard>
    </>
  );
}
