/* eslint-disable no-unused-vars */
import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomTable from "@/common/Custom/CustomTable";
import CustomTable1 from "@/common/Custom/CustomTable1";
import Loading from "@/common/Custom/Loading";
import { _postApi } from "@/redux/actions/api";

import { Eye } from "lucide-react";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { FaEye } from "react-icons/fa";
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

export default function ProductionList() {
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

  const getPR = useCallback(() => {
    _postApi(
      `/v1/materials/getRecordProduction`,
      {},
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
        <div className="text-center">{moment().format(item.date)}</div>
      ),
    },
    {
      title: "Team",
      custom: true,
      component: (item) => <div className="text-center">{item.team}</div>,
    },
    {
      title: "Shift",
      custom: true,
      component: (item) => <div className="text-left">{item.shift}</div>,
    },
    {
      title: "Customer Name",
      custom: true,
      component: (item) => (
        <div className="text-left">{item.customer_name}</div>
      ),
    },
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
              navigate(
                `/app/production/production-invoice?customerName=${item.customer_name}&customer_id=${item.customer_id}&receiptNo=${item.production_id}`
              );
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
      ? pr.branch.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pr.mr_no.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
  });

  return (
    <>
      <CustomCard header="Production List">
        <div className="d-flex align-items-center justify-content-between">
          <CustomButton
            size="sm"
            color="primary"
            className="mb-2"
            onClick={() => {
              navigate("/app/production/produce");
            }}
          >
            <span className="hidden md:inline">Record Production</span>
            <span className="inline md:hidden">Produce</span>
          </CustomButton>
          <span className="d-flex justify-content-end align-items-center gap-2 mb-2 ml-auto">
            <Label for="searchFilter" className="mb-0 mr-2">
              Search:
            </Label>
            <Input
              id="searchFilter"
              type="text"
              bsSize="sm"
              placeholder="Search by Production no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </span>
        </div>

        <Row className="mx-0 px-0">
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

        <Modal isOpen={isOpen} toggle={toggle} size="xl">
          <ModalHeader toggle={toggle}>
            View manufacturing requisition
          </ModalHeader>
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
