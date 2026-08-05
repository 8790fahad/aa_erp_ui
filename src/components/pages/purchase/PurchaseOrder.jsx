import { useEffect, useCallback, useState } from "react";
import {
  Alert,
  Badge,
  Col,
  Container,
  Input,
  Label,
  Row,
  Table,
  CardBody,
} from "reactstrap";
import { useSelector } from "react-redux";
import { Eye, PrinterIcon, X } from "lucide-react";
import moment from "moment";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import Loading from "@/common/Custom/Loading";
import CustomTable1 from "@/common/Custom/CustomTable1";
import { formatNumber1 } from "@/components/router/utilities";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function PurchaseOrder1() {
  const _form = {
    date: moment().format("YYYY-MM-DD"),
    item_name: "",
    status: "purchased",
    po_number: "",
    size: "",
    type: "",
    supplier: "",
  };
  // const navigate = useNavigate();
  const [form, setForm] = useState(_form);
  // const [order, setOrder] = useState({});
  const [loading, setLoading] = useState(false);
  const user = useSelector((state) => state.auth.user.busName);
  // const { activeBusiness } = (state) => state.auth.activeBusiness;
  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({ ...p, [name]: value }));
  };

  const getPurReq = useCallback(() => {
    _fetchApi(`/get_purchase_requisition`, (res) => {
      // console.log(res.results[0].length, "resuklt");
      if (res.results[0].length > 0) {
        // setOrder(res.results[0]);
      }
    });
  }, []);

  useEffect(() => {
    getPurReq();
  }, [getPurReq]);

  // const rand = Array.from({ length: 4 }, () =>
  //   Math.floor(Math.random() * 10)
  // ).join("");
  // const prefix = user.slice(0, 2).toUpperCase();
  // const POId = prefix + "-" + rand;
  // console.log(rand, "active business", POId, order);

  const handleAdd = () => {
    setLoading(true);
    // alert(JSON.stringify(form))
    // console.log(form);
    // _postApi(
    //   "api/purchase_order",
    //   {
    //     ...form, id: POId
    //   },
    //   (res) => {
    //     if (res.success) {
    //       toast.success("Successfully Submit");
    //       setLoading(false);
    //       navigate(-1);
    //       setForm(_form)
    //     }
    //   },
    //   (err) => {
    //     toast.error("error occured");
    //     console.log(err);
    //     setLoading(false);
    //   }
    // );
  };

  return (
    <>
      <CustomCard header="Purchase Order">
        <Container>
          <CardBody>
            <Row>
              <Col md={4}>
                <Label>Item name</Label>
                <input
                  name="item_name"
                  type="text"
                  className="form-control"
                  style={{
                    borderWidth: 2,
                    borderColor: activeBusiness?.primary_color,
                  }}
                  value={form.item_name}
                  onChange={handleChange}
                />
              </Col>
              <Col md={4}>
                <Label>Date</Label>
                <input
                  type="date"
                  name="date"
                  className="form-control"
                  style={{
                    borderWidth: 2,
                    borderColor: activeBusiness?.primary_color,
                  }}
                  value={form.date}
                  onChange={handleChange}
                />
              </Col>
              <Col md={4}>
                <Label>Purchase order no.</Label>
                <input
                  name="po_number"
                  type="text"
                  className="form-control"
                  style={{
                    borderWidth: 2,
                    borderColor: activeBusiness?.primary_color,
                  }}
                  value={form.po_number}
                  onChange={handleChange}
                />
              </Col>
              <Col md={4}>
                <Label>Type / category</Label>
                <input
                  name="type"
                  type="text"
                  className="form-control"
                  style={{
                    borderWidth: 2,
                    borderColor: activeBusiness?.primary_color,
                  }}
                  value={form.type}
                  onChange={handleChange}
                />
              </Col>
              <Col md={4}>
                <Label>Select supplier name</Label>
                <input
                  name="supplier"
                  type="text"
                  className="form-control"
                  style={{
                    borderWidth: 2,
                    borderColor: activeBusiness?.primary_color,
                  }}
                  value={form.supplier}
                  onChange={handleChange}
                />
              </Col>
              <Col md={4}>
                <Label>Size</Label>
                <input
                  name="size"
                  type="text"
                  className="form-control"
                  style={{
                    borderWidth: 2,
                    borderColor: activeBusiness?.primary_color,
                  }}
                  value={form.size}
                  onChange={handleChange}
                />
              </Col>
            </Row>
            <center>
              <CustomButton
                loading={loading}
                className="mt-3"
                onClick={handleAdd}
              >
                Create
              </CustomButton>
            </center>
          </CardBody>
        </Container>
      </CustomCard>
    </>
  );
}

/* eslint-disable no-unused-vars */

export default function PurchaseOrder() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [pr, setPr] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading2, setLoading2] = useState(false);
  const [items2, setItems2] = useState({});
  const [isOpen2, setIsOpen2] = useState(false);
  const [itemList, setItemList] = useState([]);
  const _form = {
    date: moment().format("YYYY-MM-DD"),
    purpose: "",
    from: "",
  };
  const [form, setForm] = useState(_form);
  const navigate = useNavigate();

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleEdit = () => {
    setLoading2(true);
    // console.log(form)
    _postApi(
      "/account/update-memo",
      {
        ...form,
        logStatus: "approved",
      },
      (res) => {
        if (res.success) {
          toast.success("Successfully Submit");
          setLoading2(false);
          // history.goBack();
        }
      },
      (err) => {
        toast.error("error occured");
        console.log(err);
        setLoading2(false);
      }
    );
  };

  const getPR = useCallback(() => {
    _postApi(
      `/account/get-purchase-requisition`,
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
  }, [activeBusiness.id, user.fullname]);

  useEffect(() => {
    getPR();
  }, [getPR]);

  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState({});
  const toggle = (item) => {
    if (item) {
      setItems(item);
      _postApi(
        "/account/purchase/getPr",
        {
          query_type: "select-exp",
          pr_no: item.pr_no,
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
    }
    setIsOpen(!isOpen);
  };
  const toggle2 = (item) => {
    setItems2(item);
    setForm((p) => ({
      ...p,
      purpose: item.purpose,
      from: item.from_name,
      busName: item.from_name,
      memo_id: item.memo_id,
    }));
    setIsOpen2(!isOpen2);
  };

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
      value: "po_no",
      title: "PO No.",
      custom: true,
      className: "text-center",
      component: (item) => <div className="font-medium">{item.po_no}</div>,
    },
    {
      value: "reason",
      title: "Subject",
      custom: true,
      className: "text-left",
      component: (item) => <div className="text-sm">{item.reason}</div>,
    },
    {
      value: "supplier_name",
      title: "Supplier",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-sm">
          {item.supplier_name ? item.supplier_name : "-"}
        </div>
      ),
    },
    // {
    //   value: "total",
    //   title: "Total amount (₦)",
    //   custom: true,
    //   className: "text-right",
    //   component: (item) => (
    //     <div className="text-sm font-semibold">
    //       {formatNumber1(item.total || 0)}
    //     </div>
    //   ),
    // },
    {
      value: "status",
      title: "Status",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="flex justify-center items-center">
          <Badge color={item.status === "Approved" ? "primary" : "warning"}>
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
        <div className="flex justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              toggle(item);
            }}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigate(`/app/purchase/purchase-order-pdf?pr_no=${item.pr_no}`);
            }}
            className="text-green-600 hover:text-green-800 hover:bg-green-50"
            title="Print PO"
          >
            <PrinterIcon className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const getLogs = useCallback(
    (memoId) => {
      if (!memoId) return;
      _fetchApi(
        `/account/get-logs?id=${memoId}&facilityId=${activeBusiness.id}`,
        (data) => {
          setLoading2(false);
          if (data.success) {
            setLogs(data.results[0]);
          }
        },
        (err) => {
          setLoading2(false);
          console.log(err);
        }
      );
    },
    [activeBusiness.id]
  );

  const filteredMemos = pr?.filter((item) => {
    return searchTerm
      ? item.po_no.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
  });

  return (
    <>
      <CustomCard header="Purchase Order">
        <Row className="mx-0">
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

          {loading ? (
            <div className="d-flex justify-content-center my-5">
              <Loading />
            </div>
          ) : filteredMemos && filteredMemos.length > 0 ? (
            <CustomTable1
              data={filteredMemos}
              fields={fields}
              loading={loading}
              pageSize={10}
              message="No purchase orders found"
            />
          ) : (
            <Alert className="mt-3" color="info">
              No data to view
            </Alert>
          )}
        </Row>
      </CustomCard>
      {/* View Details Modal - Using Markup.jsx pattern */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">View Purchase Order</h3>
                  <p className="text-blue-100 text-sm mt-1">
                    Purchase Order Details - {items?.po_no}
                  </p>
                </div>
                <button
                  onClick={toggle}
                  className="p-1.5 hover:bg-white/20 rounded transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50">
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="space-y-4">
                  {/* Order Information */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                            Date
                          </label>
                          <p className="text-sm font-medium text-gray-900">
                            {items?.date
                              ? moment(items.date).format("YYYY-MM-DD")
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                            PO No.
                          </label>
                          <p className="text-sm font-medium text-gray-900">
                            {items?.po_no || "-"}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                            Supplier
                          </label>
                          <p className="text-sm font-medium text-gray-900">
                            {items?.supplier_name
                              ? `${items.supplier_name} (${
                                  items.supplier_code || ""
                                })`
                              : "-"}
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                          Reason of Purchase
                        </label>
                        <p className="text-sm font-medium text-gray-900">
                          {items?.reason || "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200">
                      <h4 className="text-lg font-bold text-gray-900">
                        Purchase Order Items
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <Table className="mb-0">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                              S/N
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                              Item Name
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">
                              Quantity
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">
                              Unit of Measure
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {itemList && itemList.length > 0 ? (
                            itemList.map((item, idx) => (
                              <tr key={item.item_list_id || idx}>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {idx + 1}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {item?.item_name || "-"}
                                </td>
                                <td className="px-4 py-3 text-sm text-center text-gray-900">
                                  {formatNumber1(item?.quantity || 0)}
                                </td>
                                <td className="px-4 py-3 text-sm text-center text-gray-900">
                                  {item?.unit_measure || "-"}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-4 py-8 text-center text-sm text-gray-500"
                              >
                                No items found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="border-t border-gray-200 bg-white px-6 py-4 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={toggle}
                  className="px-4 py-2"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    navigate(
                      `/app/purchase/purchase-order-pdf?pr_no=${items?.pr_no}`
                    );
                  }}
                  className="px-4 py-2 flex items-center gap-2"
                  style={{ backgroundColor: "#4267B2" }}
                >
                  <PrinterIcon className="w-4 h-4" />
                  Print PO
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
