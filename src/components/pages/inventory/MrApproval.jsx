import CustomButton from "@/common/Custom/CustomButton";
import CustomTable1 from "@/common/Custom/CustomTable1";
import Loading from "@/common/Custom/Loading";
import { _fetchApi, _postApi } from "@/redux/actions/api";

import { toast } from "sonner";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { Eye, X } from "lucide-react";
import { useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
import { Col, Row, Input, Badge } from "reactstrap";
import { Input as AntdInput } from "antd";

export default function MrApproval() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState({});
  const [pr, setPr] = useState([]);
  const [approvalDate, setApprovalDate] = useState(
    moment().format("YYYY-MM-DD")
  );
  const [editableItems, setEditableItems] = useState([]);

  // Convenience: keep approved-qty inputs the user already typed in when we
  // refetch on source-branch change, so they don't lose their work.
  const mergeApprovedQty = (newItems, prevItems) => {
    const prevById = new Map(prevItems.map((p) => [p.id, p]));
    return newItems.map((itm) => {
      const prev = prevById.get(itm.id);
      const approvedQty =
        prev && prev.approved_qty !== "" && prev.approved_qty != null
          ? parseFloat(prev.approved_qty)
          : parseFloat(itm.quantity_approved ?? 0);
      const hasQty = approvedQty >= 0.0001;
      return {
        ...itm,
        approved_qty: hasQty ? approvedQty : "",
        approved_qty_formatted: hasQty
          ? formatNumberWithCommas(approvedQty.toString())
          : "",
      };
    });
  };

  // Format number with commas (for display) - supports 4 decimal places
  const formatNumberWithCommas = (value) => {
    if (!value || value === "") return "";

    // Remove all non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, "");

    // Check if the value ends with a decimal point (user is typing decimal)
    const endsWithDot = numericValue.endsWith(".");

    // Split into integer and decimal parts
    const parts = numericValue.split(".");
    const integerPart = parts[0] || "";
    let decimalPart = parts[1] || "";

    // Limit decimal part to 4 places
    if (decimalPart.length > 4) {
      decimalPart = decimalPart.substring(0, 4);
    }

    // Add commas to integer part
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    // Combine with decimal part if exists, or preserve trailing dot
    if (decimalPart) {
      return `${formattedInteger}.${decimalPart}`;
    } else if (endsWithDot && integerPart) {
      // Preserve the decimal point if user just typed it
      return `${formattedInteger}.`;
    } else {
      return formattedInteger;
    }
  };

  // Parse formatted number (remove commas for calculations)
  const parseNumberFromFormatted = (value) => {
    if (!value || value === "") return "";
    // If value is already a number, return it as string
    if (typeof value === "number") {
      return value.toString();
    }
    // Remove commas and keep only numbers and decimal point
    return value.replace(/,/g, "");
  };

  const formatQtyDisplay = (value) => {
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return formatNumberWithCommas("0.0000");
    return formatNumberWithCommas(n.toFixed(4));
  };

  const toggle = (item) => {
    setItems(item);
    setIsOpen(!isOpen);
  };

  const handleChange = (index, field, value, item) => {
    const updated = [...editableItems];
    if (field === "approved_qty") {
      // Allow empty string for clearing the field
      if (value === "" || value === null || value === undefined) {
        updated[index][field] = "";
        updated[index][field + "_formatted"] = "";
        setEditableItems(updated);
        return;
      }

      // Format with commas for display
      const formattedValue = formatNumberWithCommas(value);
      updated[index][field + "_formatted"] = formattedValue;

      // Parse the value, preserving decimal places
      const numericValue = parseFloat(parseNumberFromFormatted(value));

      // Check if it's a valid number
      if (isNaN(numericValue)) {
        return; // Don't update if not a valid number
      }

      // Allow values >= 0.0001 to support 4 decimal places
      if (numericValue < 0.0001) {
        toast.error("Approved quantity must be at least 0.0001");
        return;
      }

      if (numericValue > parseFloat(item.quantity_balance || 0)) {
        toast.error(
          "Approved quantity cannot be greater than available quantity"
        );
        return;
      }

      if (numericValue > parseFloat(item.quantity_requested || 0)) {
        toast.error(
          "Approved quantity cannot be greater than requested quantity"
        );
        return;
      }

      updated[index][field] = numericValue;
    } else {
      updated[index][field] = value;
    }
    setEditableItems(updated);
  };

  const viewList = (item) => {
    setItems(item);
    setIsOpen(true);
    setApprovalDate(moment().format("YYYY-MM-DD"));
    setEditableItems([]);
  };

  // Load items with facility-wide raw material availability.
  useEffect(() => {
    if (!isOpen || !items?.id || !activeBusiness?.id) return;
    _fetchApi(
      `/api/production/material-requisitions/${items.id}?facilityId=${activeBusiness.id}`,
      (res) => {
        if (res.success) {
          setEditableItems((prev) => mergeApprovedQty(res.data.items, prev));
          setItems(res.data.requisition);
        }
      },
      (err) => {
        toast.error("Error Occurred");
        console.log(err);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, items?.id, activeBusiness?.id]);

  const getPR = useCallback(() => {
    setLoading(true);
    _fetchApi(
      `/api/production/material-requisitions?facilityId=${activeBusiness.id}&status=pending`,
      (data) => {
        setLoading(false);
        if (data.success) {
          setPr(data.data.requisitions);
        }
      },
      (err) => {
        setLoading(false);
        console.log(err);
        toast.error("Error fetching requisitions");
      }
    );
  }, [activeBusiness.id]);

  useEffect(() => {
    getPR();
  }, [getPR]);

  const handleApprove = () => {
    if (!items.id) {
      toast.error("Missing Requisition ID");
      return;
    }

    if (!activeBusiness?.id) {
      toast.error("Missing Facility ID");
      return;
    }

    if (!user?.id) {
      toast.error("Missing User ID");
      return;
    }
    if (!activeBusiness.wip) {
      toast.error("Missing WIP Account");
      return;
    }
    // Filter items that can be approved (Available Qty > 0 and Approved Qty >= 0.0001)
    const validItems = editableItems.filter(
      (m) =>
        parseFloat(m.quantity_balance || 0) > 0 &&
        m.approved_qty !== null &&
        m.approved_qty !== undefined &&
        m.approved_qty !== "" &&
        parseFloat(m.approved_qty) >= 0.0001
    );

    if (validItems.length === 0) {
      toast.error(
        "No valid items to approve. Items must have Available Qty > 0 and Approved Qty >= 0.0001"
      );
      return;
    }

    if (!approvalDate) {
      toast.error("Please select an approval date");
      return;
    }

    const payload = {
      id: items.id,
      facilityId: activeBusiness.id,
      approvedBy: user.id,
      wip: activeBusiness.wip,
      approval_date: approvalDate,
      items: validItems.map((m) => ({
        id: m.id,
        product_id: m.product_code,
        mr_no: items.id,
        quantity_approved: parseFloat(m.approved_qty),
      })),
    };

    console.log("Approval Payload:", payload);

    setLoading(true);
    _postApi(
      "/api/production/material-requisitions/approve",
      payload,
      (res) => {
        setLoading(false);
        if (res.success) {
          toast.success(res.message || "Approval Successful");
          setIsOpen(false);
          getPR();
        } else {
          toast.error(res.message || "Approval failed");
        }
      },
      (err) => {
        console.error("Approval Error:", err);
        toast.error(err?.message || "Error Occurred");
        setLoading(false);
      }
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "approved":
        return "success";
      case "pending":
        return "warning";
      case "completed":
        return "primary";
      case "rejected":
        return "danger";
      default:
        return "secondary";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "approved":
        return "Approved";
      case "pending":
        return "Pending";
      case "completed":
        return "Completed";
      case "rejected":
        return "Rejected";
      default:
        return status;
    }
  };

  const fields = [
    {
      value: "created_at",
      title: "Date",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-sm">
          {moment(item.created_at).format("YYYY-MM-DD")}
        </div>
      ),
    },
    {
      value: "id",
      title: "MR No.",
      custom: true,
      className: "text-center",
      component: (item) => <div className="font-medium">{item.id}</div>,
    },
    {
      value: "notes",
      title: "Note",
      custom: true,
      className: "text-left",
      component: (item) => <div className="text-sm">{item.notes || "-"}</div>,
    },
    {
      value: "creator_name",
      title: "Requestor",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-sm">{item.creator_name || "-"}</div>
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

  const filteredPr = pr.filter((p) => {
    if (!searchTerm) return true;
    const term = String(searchTerm || "").toLowerCase();
    const safeStr = (v) => String(v ?? "").toLowerCase();
    return (
      safeStr(p.branch).includes(term) ||
      safeStr(p.requisition_number).includes(term) ||
      safeStr(p.product_name).includes(term) ||
      safeStr(p.creator_name).includes(term)
    );
  });

  return (
    <div className="p-2">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Material Requisition Approval</h1>
          <p className="text-muted-foreground">
            Review and approve pending material requisitions
          </p>
        </div>
      </div>

      <Row>
        <Col md="12" className="flex items-center">
          <AntdInput.Search
            placeholder="Search by MR number, product, or requestor"
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%" }}
          />
        </Col>
      </Row>

      {loading && <Loading />}

      <div className="mt-2">
        <CustomTable1
          data={filteredPr}
          fields={fields}
          loading={loading}
          pageSize={10}
          message="No pending requisitions found"
        />
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">
                    <i className="fa fa-file-alt me-2"></i>
                    Approve Material Requisition
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">
                    Review and approve pending material requisitions
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
            {/* {JSON.stringify()} */}
            {/* Form Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50">
              <div className="p-6 flex-1 overflow-y-auto">
                {/* Requisition Information */}
                <div className="mb-4 bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                  <div className="flex items-center mb-3 pb-2 border-b border-gray-200">
                    <div className="w-1 h-5 bg-blue-600 rounded-full mr-2"></div>
                    <h4 className="text-base font-bold text-gray-800">
                      Requisition Details
                    </h4>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-0.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Date
                        </label>
                        <div className="text-sm font-semibold text-gray-900 py-1">
                          {items.created_at
                            ? moment(items.created_at).format("YYYY-MM-DD")
                            : "-"}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          MR No.
                        </label>
                        <div className="text-sm font-semibold text-blue-600 py-1">
                          {items.id || "-"}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Status
                        </label>
                        <div className="py-1">
                          <Badge
                            color={getStatusColor(items.status)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-full"
                          >
                            {getStatusText(items.status)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Note
                      </label>
                      <div className="text-sm font-medium text-gray-900 py-1 break-words">
                        {items.notes || "-"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Approval Date */}
                <div className="mb-4 bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                  <div className="flex items-center mb-3 pb-2 border-b border-gray-200">
                    <div className="w-1 h-5 bg-blue-600 rounded-full mr-2"></div>
                    <h4 className="text-base font-bold text-gray-800">
                      Approval Date
                    </h4>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Approval Date{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={approvalDate}
                      onChange={(e) => setApprovalDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This date will be used for the transaction date in General
                      Ledger entries
                    </p>
                  </div>
                </div>

                {/* Materials Table */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-2 py-2 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center mb-1">
                      <div className="w-1 h-5 bg-blue-600 rounded-full mr-2"></div>
                      <h4 className="text-lg font-bold text-gray-800">
                        Materials for Approval
                      </h4>
                    </div>
                    <p className="text-sm text-gray-600 ml-4 mt-1">
                      Review and adjust approved quantities as needed
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {/* <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                            #
                          </th> */}
                          <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                            SKU
                          </th>
                          <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                            Item Name
                          </th>
                          {/* <th className="px-5 py-3.5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                        Unit of Measure
                          </th> */}
                          <th className="px-5 py-3.5 text-right text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                            Requested Qty
                          </th>
                          <th className="px-5 py-3.5 text-right text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                            Available Qty
                          </th>
                          <th className="px-5 py-3.5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                            Approved Qty
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {editableItems.map((item, idx) => (
                          <tr
                            key={idx}
                            className={`transition-colors ${
                              parseFloat(item.quantity_balance || 0) <= 0
                                ? "bg-red-50/70"
                                : "hover:bg-blue-50/50"
                            }`}
                          >
                            {/* <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                              {idx + 1}
                            </td> */}
                            <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                              {item.product_code}
                            </td>
                            <td className="px-5 py-4 text-sm font-medium text-gray-900">
                              {item.product_name || "-"} ({item.unit_of_measure}
                              )
                            </td>
                            {/* <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-600 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {item.category} ({item.unit_of_measure})
                              </span>
                            </td> */}
                            <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right tabular-nums">
                              {formatQtyDisplay(item.quantity_requested)}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap text-right">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold tabular-nums ${
                                  parseFloat(item.quantity_balance || 0) <= 0
                                    ? "bg-blue-100 text-blue-700"
                                    : "text-gray-900"
                                }`}
                              >
                                {formatQtyDisplay(item.quantity_balance)}
                                {parseFloat(item.quantity_balance || 0) <=
                                  0 && (
                                  <span className="ml-1 text-xs">
                                    (Out of Stock)
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="flex justify-end">
                                {parseFloat(item.quantity_balance || 0) <= 0 ? (
                                  <span className="text-blue-600 text-sm font-medium italic">
                                    N/A
                                  </span>
                                ) : (
                                  <Input
                                    type="text"
                                    value={
                                      item.approved_qty_formatted !== undefined
                                        ? item.approved_qty_formatted
                                        : item.approved_qty !== null &&
                                          item.approved_qty !== undefined &&
                                          item.approved_qty !== "" &&
                                          parseFloat(item.approved_qty) >=
                                            0.0001
                                        ? formatNumberWithCommas(
                                            parseFloat(
                                              item.approved_qty
                                            ).toString()
                                          )
                                        : ""
                                    }
                                    onChange={(e) =>
                                      handleChange(
                                        idx,
                                        "approved_qty",
                                        e.target.value,
                                        item
                                      )
                                    }
                                    placeholder="0.0000"
                                    className="w-full text-right border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    inputMode="decimal"
                                  />
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {editableItems.length === 0 && (
                          <tr>
                            <td
                              colSpan="5"
                              className="px-5 py-12 text-center text-sm text-gray-500"
                            >
                              <div className="flex flex-col items-center">
                                <i className="fa fa-inbox text-4xl text-gray-300 mb-2"></i>
                                <p className="font-medium">
                                  No materials found
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Info Message */}
              <div className="border-t border-gray-200 bg-blue-50 px-6 py-3">
                <div className="flex items-center gap-2 text-blue-700">
                  <i className="fa fa-info-circle text-lg"></i>
                  <p className="text-sm font-medium">
                    Only items with{" "}
                    <span className="font-bold">Available Qty {">"} 0</span> and{" "}
                    <span className="font-bold">
                      Approved Qty {">="} 0.0001
                    </span>{" "}
                    will be submitted for approval. Items with zero available
                    quantity are highlighted and cannot be approved.
                  </p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="border-t border-gray-200 bg-white px-6 py-4 flex justify-end gap-3 shadow-sm">
                <button
                  type="button"
                  onClick={toggle}
                  className="px-6 py-2.5 text-sm font-semibold bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  Cancel
                </button>
                <CustomButton
                  loading={loading}
                  size="2"
                  color="success"
                  onClick={handleApprove}
                  className="px-6 py-2.5 text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                  disabled={
                    loading ||
                    editableItems.filter(
                      (item) =>
                        parseFloat(item.quantity_balance || 0) > 0 &&
                        item.approved_qty !== null &&
                        item.approved_qty !== undefined &&
                        item.approved_qty !== "" &&
                        parseFloat(item.approved_qty) >= 0.0001
                    ).length === 0
                  }
                >
                  {loading ? (
                    <>Approving...</>
                  ) : (
                    <>
                      <i className="fa fa-check me-2"></i>
                      Approve Requisition
                    </>
                  )}
                </CustomButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
