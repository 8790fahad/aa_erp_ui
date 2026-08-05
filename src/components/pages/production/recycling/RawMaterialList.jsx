import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
// import CustomTable from "@/common/Custom/CustomTable";
import CustomTable1 from "@/common/Custom/CustomTable1";
import Loading from "@/common/Custom/Loading";
import { formatNumber1 } from "@/components/router/utilities";
import { _postApi } from "@/redux/actions/api";

import moment from "moment";
import { useCallback, useEffect, useState } from "react";
// import { FaEye } from "react-icons/fa";
// import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  Row,
} from "reactstrap";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BadgePlusIcon, MoreVerticalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function RawMaterialList() {
  // const { activeBusiness, user } = useSelector((state) => state.auth);
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

  const getPR = useCallback(() => {
    _postApi(
      `/v1/materials/get`,
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
      title: "Date",
      value: "date",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-end">
          {moment(item.date).format("Do MMMM, YYYY")}
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
      title: "Customer Name",
      custom: true,
      component: (item) => (
        <div className="text-left">{item.customer_name}</div>
      ),
    },
    // {
    //   title: "Total Amount",
    //   custom: true,
    //   component: (item) => (
    //     <div className="text-end">{formatNumber1(item.amount)}</div>
    //   ),
    // },
    // {
    //   title: "Discount",
    //   custom: true,
    //   component: (item) => (
    //     <div className="d-flex justify-content-end align-items-center">
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
        <div className="text-center flex justify-center align-items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex size-8 text-slate-500 data-[state=open]:bg-slate-100 dark:text-slate-400 dark:data-[state=open]:bg-slate-800"
                size="icon"
              >
                <MoreVerticalIcon />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  navigate(
                    `/app/production/raw-material-collected/collection-pdf?customerName=${
                      item.customer_name
                    }&customer_id=${item.customerNo}&receiptNo=${
                      item.collection_id
                    }&date=${moment(item.date).format("YYYY-MM-DD")}`
                  );
                }}
              >
                View
              </DropdownMenuItem>
              <DropdownMenuItem>Favorite</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* <CustomButton
            color="success"
            size={"sm"}
            className="m-1"
            handleSubmit={() => {
              navigate(
                `/app/production/raw-material-collected/collection-pdf?customerName=${item.customer_name}&customer_id=${item.customerNo}&receiptNo=${item.collection_id}`
              );
            }}
          >
            <FaEye size="20" />
          </CustomButton> */}
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
  return (
    <>
      {/* <Card></Card> */}
      <CustomCard header="Material Receive">
        <div className="d-flex align-items-center justify-content-between mb-3 md:!mb-1">
          <CustomButton
            size="sm"
            color="primary"
            className="mb-2 flex items-center"
            onClick={() => {
              navigate("/app/production/raw-material-collected/new");
            }}
          >
            <BadgePlusIcon className="h-5 w-5 visible md:hidden" />{" "}
            <span className="hidden md:inline">Receive Material</span>
          </CustomButton>
          <span className="d-flex justify-content-end align-items-center gap-2 mb-2 ml-auto">
            <Label for="searchFilter" className="mb-0 mr-2">
              Search:
            </Label>
            <Input
              id="searchFilter"
              type="text"
              bsSize="sm"
              placeholder="Search by Receive number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </span>
        </div>

        <Row className="mx-0">
          {loading && <Loading />}
          {!loading ? (
            <CustomTable1 data={filteredPr} fields={fields} />
          ) : (
            // <CustomTable data={filteredPr} fields={fields} className={"mb-0"} />
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
                  Materials: <br />
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
                      {/* {itemList?.map((item, idx) => (
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
                      ))} */}
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
