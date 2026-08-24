import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomTable1 from "@/common/Custom/CustomTable1";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { Skeleton } from "@/components/ui/skeleton";

import moment from "moment";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, X } from "lucide-react";
import { useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
import Select from "react-select";
import {
  Badge,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  Row,
} from "reactstrap";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { FaEdit, FaSave } from "react-icons/fa";
import { MdAdd, MdDelete, MdOutlineCancel } from "react-icons/md";

export default function ManufacturingRequisitionList() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemList, setItemList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState({});
  const [pr, setPr] = useState([]);

  // Create modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [productItems, setProductItems] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [editMaterial, setEditMaterial] = useState({});
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [newMaterial, setNewMaterial] = useState({
    item_name: "",
    item_code: "",
    initiated_qty: "",
    category: "",
    unit_of_measure: "",
  });
  const [form, setForm] = useState({
    date: moment().format("YYYY-MM-DD"),
    requisitor: user?.fullname || user?.username || "",
    notes: "",
  });
  const [errors, setErrors] = useState({
    notes: "",
  });

  const qtyInputRef = useRef(null);
  const materialSelectRef = useRef(null);

  // Custom styles for React Select (aligned with ProductServiceForm)
  const customSelectStyles = {
    control: (provided, state) => ({
      ...provided,
      minHeight: "38px",
      borderColor: state.isFocused ? "#3b82f6" : "#d1d5db",
      borderWidth: "1px",
      borderRadius: "0.5rem",
      boxShadow: state.isFocused ? "0 0 0 3px rgb(59 130 246 / 0.5)" : "none",
      backgroundColor: "white",
      fontSize: "14px",
      "&:hover": {
        borderColor: state.isFocused ? "#3b82f6" : "#d1d5db",
      },
    }),
    valueContainer: (provided) => ({
      ...provided,
      padding: "0.25rem 0.75rem",
    }),
    input: (provided) => ({
      ...provided,
      margin: "0",
      padding: "0",
      color: "#111827",
      fontSize: "14px",
    }),
    placeholder: (provided) => ({
      ...provided,
      color: "#9ca3af",
      fontSize: "14px",
    }),
    singleValue: (provided) => ({
      ...provided,
      color: "#111827",
      fontSize: "14px",
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 9999,
      borderRadius: "0.5rem",
      border: "1px solid #d1d5db",
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
      marginTop: "0.25rem",
    }),
    menuList: (provided) => ({
      ...provided,
      padding: "0.25rem",
      maxHeight: "300px",
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? "#eff6ff"
        : state.isFocused
          ? "#f3f4f6"
          : "white",
      color: state.isSelected ? "#1e40af" : "#374151",
      fontSize: "14px",
      padding: "8px 10px",
      cursor: "pointer",
      "&:active": {
        backgroundColor: "#eff6ff",
      },
    }),
    indicatorSeparator: (provided) => ({
      ...provided,
      backgroundColor: "#d1d5db",
    }),
    dropdownIndicator: (provided, state) => ({
      ...provided,
      color: state.isFocused ? "#6b7280" : "#9ca3af",
      "&:hover": {
        color: "#6b7280",
      },
    }),
    clearIndicator: (provided) => ({
      ...provided,
      color: "#9ca3af",
      "&:hover": {
        color: "#6b7280",
      },
    }),
    menuPortal: (provided) => ({
      ...provided,
      zIndex: 9999,
    }),
  };

  const fmtQty = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0";
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
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

  const toggle = (item) => {
    setItems(item);
    setIsOpen(!isOpen);
  };

  const toggleCreate = () => {
    setIsCreateOpen(!isCreateOpen);
    if (!isCreateOpen) {
      // Reset form when opening
      setForm({
        date: moment().format("YYYY-MM-DD"),
        requisitor: user?.fullname || user?.username || "",
        notes: "",
      });
      setMaterials([]);
      setNewMaterial({
        item_name: "",
        item_code: "",
        initiated_qty: "",
        category: "",
        unit_of_measure: "",
      });
      setErrors({ notes: "" });
    }
  };

  const viewList = (item) => {
    toggle(item);
    _fetchApi(
      `/api/production/material-requisitions/${item.id}?facilityId=${activeBusiness.id}`,
      (res) => {
        if (res.success) {
          setItemList(res.data.items);
          setItems(res.data.requisition);
        }
      },
      (err) => {
        toast.error("Error Occurred");
        console.log(err);
      },
    );
  };

  const getPR = useCallback(() => {
    setLoading(true);
    _fetchApi(
      `/api/production/material-requisitions?facilityId=${activeBusiness.id}`,
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
      },
    );
  }, [activeBusiness.id]);

  useEffect(() => {
    getPR();
  }, [getPR]);

  // Create modal functions
  const getProductList = useCallback(() => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list-2?query_type=select`,
      {
        facilityId: activeBusiness.id,
        type: "Raw Material",
      },
      (resp) => {
        if (resp.success) {
          const rawMaterials = (resp.results || []).map((item) => ({
            ...item,
            item_name: item.item_name,
            item_code: item.item_code,
            category: item.category,
            unit_of_measure: item.unit_of_measure,
            cost_price: item.cost_price,
            selling_price: item.selling_price,
            stock_quantity: item.stock_quantity,
            status: item.status,
            item_type: item.item_type || "Raw Material",
          }));

          _fetchApi(
            `/inventory/get-semifinshed-list?facilityId=${activeBusiness.id}`,
            (semiResp) => {
              const semiFinished = (
                semiResp?.data?.products ||
                semiResp?.data?.items ||
                semiResp?.results ||
                semiResp?.data ||
                []
              ).map((item) => ({
                ...item,
                item_name: item.item_name || item.name || "",
                item_code: item.item_code || item.sku || "",
                category: item.category || item.item_type || "Semi Finished",
                unit_of_measure: item.unit_of_measure || "",
                cost_price: item.cost_price || 0,
                selling_price: item.selling_price || 0,
                stock_quantity: item.stock_quantity || 0,
                status: item.status || "Active",
                item_type: item.item_type || "Semi Finished",
              }));

              const merged = [...rawMaterials];
              semiFinished.forEach((semiItem) => {
                const exists = merged.some(
                  (m) => m.item_code && m.item_code === semiItem.item_code,
                );
                if (!exists) merged.push(semiItem);
              });

              setProductItems(merged);
            },
            () => {
              // Fallback to raw materials only if semi-finished fetch fails
              setProductItems(rawMaterials);
            },
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      },
    );
  }, [activeBusiness.id]);

  useEffect(() => {
    if (isCreateOpen) {
      getProductList();
    }
  }, [isCreateOpen, getProductList]);

  const handleChange = ({ target: { name, value } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleAddMaterial = () => {
    if (newMaterial.item_name && newMaterial.initiated_qty) {
      // Parse formatted quantity to number before adding
      const parsedQty = parseFloat(
        parseNumberFromFormatted(newMaterial.initiated_qty),
      );

      if (!parsedQty || parsedQty <= 0) {
        toast.error("Please enter a valid quantity greater than 0");
        return;
      }

      setMaterials((prev) => [
        ...prev,
        {
          ...newMaterial,
          id: Date.now(),
          initiated_qty: parsedQty, // Store as number
        },
      ]);
      setNewMaterial({
        item_name: "",
        item_code: "",
        initiated_qty: "",
        category: "",
        unit_of_measure: "",
      });
      setSelectedMaterial(null);
      // After adding, move focus back to Raw Material selector
      setTimeout(() => {
        materialSelectRef.current?.focus?.();
      }, 0);
    } else {
      toast.error("Please select an item and enter quantity");
    }
  };

  const handleEditMaterial = (index) => {
    setEditIndex(index);
    const material = materials[index];
    // Format the quantity for display when editing
    setEditMaterial({
      ...material,
      initiated_qty:
        typeof material.initiated_qty === "number"
          ? formatNumberWithCommas(material.initiated_qty.toString())
          : formatNumberWithCommas(material.initiated_qty || ""),
    });
  };

  const handleSaveEdit = (index) => {
    // Parse formatted quantity to number before saving
    const parsedQty = parseFloat(
      parseNumberFromFormatted(editMaterial.initiated_qty),
    );

    if (!parsedQty || parsedQty <= 0) {
      toast.error("Please enter a valid quantity greater than 0");
      return;
    }

    const updatedMaterials = [...materials];
    updatedMaterials[index] = {
      ...editMaterial,
      initiated_qty: parsedQty, // Store as number
    };
    setMaterials(updatedMaterials);
    setEditIndex(null);
    setEditMaterial({});
  };

  const handleCancelEdit = () => {
    setEditIndex(null);
    setEditMaterial({});
  };

  const handleDeleteMaterial = (index) => {
    setMaterials((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    let isValid = true;

    if (!form.notes || form.notes.trim() === "") {
      toast.error("Note is required");
      setErrors((prev) => ({ ...prev, notes: "Note is required" }));
      isValid = false;
    }

    if (materials.length === 0) {
      toast.error("Requisition details are required");
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = () => {
    // Guard: prevent multiple submissions if a request is already in progress
    if (loading) {
      return;
    }

    if (!validateForm()) return;

    setLoading(true);

    _postApi(
      `/api/production/material-requisitions/create`,
      {
        facilityId: activeBusiness.id,
        quantityRequired: materials.reduce(
          (sum, item) => sum + (Number(item.initiated_qty) || 0),
          0,
        ),
        priority: "medium",
        notes: form.notes || "",
        materials: materials.map((item) => ({
          product_id: item.id,
          item_name: item.item_name,
          item_code: item.item_code,
          category: item.category,
          unit_of_measure: item.unit_of_measure,
          quantity_requested:
            typeof item.initiated_qty === "number"
              ? item.initiated_qty
              : parseFloat(parseNumberFromFormatted(item.initiated_qty)) || 0,
          unit_cost: Number(item.cost_price) || 0,
          notes: "",
        })),
        createdBy: user.id,
      },
      (res) => {
        setLoading(false);
        if (res.success) {
          toast.success("Material Requisition created successfully");
          setIsCreateOpen(false);
          getPR();
        } else {
          toast.error(res.message || "Failed to create material requisition");
        }
      },
      (err) => {
        toast.error(err?.message || "Error Occurred");
        console.error(err);
        setLoading(false);
      },
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
      className: "text-center",
      component: (item) => (
        <div className="text-sm">
          {item.creator_name || item.created_by || "-"}
        </div>
      ),
    },
    {
      value: "status",
      title: "Status",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="flex justify-center items-center">
          <Badge color={getStatusColor(item.status)} className="px-2 py-1">
            {getStatusText(item.status)}
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              viewList(item);
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
      ? pr.branch?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pr.requisition_number
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          pr.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (pr.creator_name &&
            pr.creator_name.toLowerCase().includes(searchTerm.toLowerCase()))
      : true;
  });

  return (
    <>
      <CustomCard header="Material Requisition List">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
          <CustomButton size="sm" color="primary" onClick={toggleCreate}>
            <i className="fa fa-plus me-1"></i> Create Requisition
          </CustomButton>
          <div className="d-flex align-items-center gap-2 w-100 w-md-auto">
            <Label for="searchFilter" className="mb-0">
              <i className="fa fa-search"></i>
            </Label>
            <Input
              id="searchFilter"
              type="text"
              bsSize="sm"
              placeholder="Search by MR number, product, or requestor"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-grow-1"
            />
          </div>
        </div>

        <Row className="mx-0">
          {loading ? (
            <div className="w-100">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                {/* Table Header Skeleton */}
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                  <div className="grid grid-cols-6 gap-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
                {/* Table Rows Skeleton */}
                <div className="divide-y divide-gray-200">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="px-4 py-4">
                      <div className="grid grid-cols-6 gap-4 items-center">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-24" />
                        <div className="flex justify-center">
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </div>
                        <div className="flex justify-center">
                          <Skeleton className="h-8 w-8 rounded" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : filteredPr.length > 0 ? (
            <CustomTable1
              data={filteredPr}
              fields={fields}
              pageSize={10}
              message="No material requisitions found"
            />
          ) : (
            <div className="mt-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 shadow-sm p-8">
                <div className="text-center">
                  <div className="mb-4">
                    <i className="fa fa-inbox text-5xl text-blue-400"></i>
                  </div>
                  <h5 className="text-xl font-bold text-gray-800 mb-2">
                    No Material Requisitions Found
                  </h5>
                  <p className="text-gray-600 mb-4">
                    There are no material requisitions matching your search
                    criteria.
                  </p>
                  <CustomButton
                    size="sm"
                    color="primary"
                    onClick={toggleCreate}
                    className="mt-2"
                  >
                    <i className="fa fa-plus me-2"></i>
                    Create New Requisition
                  </CustomButton>
                </div>
              </div>
            </div>
          )}
        </Row>

        <Modal isOpen={isOpen} toggle={toggle} size="xl">
          <ModalHeader toggle={toggle}>
            <i className="fa fa-file-alt me-2"></i>
            Material Requisition Details
          </ModalHeader>
          <ModalBody>
            <div className="mb-4">
              <div className="row mb-3">
                <div className="col-md-6">
                  <div className="d-flex">
                    <span className="text-muted me-2">Date:</span>
                    <strong>
                      {moment(items?.created_at).format("YYYY-MM-DD")}
                    </strong>
                  </div>
                </div>
                <div className="col-md-6 text-md-end">
                  <div className="d-flex justify-content-md-end">
                    <span className="text-muted me-2">MR No.:</span>
                    <strong>{items?.id}</strong>
                  </div>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <div className="d-flex">
                    <span className="text-muted me-2">Department:</span>
                    <strong>{items?.branch}</strong>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex">
                    <span className="text-muted me-2">Requestor:</span>
                    <strong>{items?.creator_name || items?.created_by}</strong>
                  </div>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <div className="d-flex">
                    <span className="text-muted me-2">Note:</span>
                    <strong>{items?.notes}</strong>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex">
                    <span className="text-muted me-2">Status:</span>
                    <Badge
                      color={getStatusColor(items?.status)}
                      className="px-2 py-1"
                    >
                      {getStatusText(items?.status)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h5>
                  <i className="fa fa-list me-2"></i>
                  Materials
                </h5>
                <div className="table-responsive">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th className="text-center" style={{ width: "5%" }}>
                          #
                        </th>
                        <th className="text-center" style={{ width: "12%" }}>
                          SKU
                        </th>
                        <th style={{ width: "25%" }}>Item Name</th>
                        <th className="text-center" style={{ width: "15%" }}>
                          Unit of Measure
                        </th>

                        <th className="text-center" style={{ width: "15%" }}>
                          Requested
                        </th>
                        <th className="text-center" style={{ width: "15%" }}>
                          Approved
                        </th>
                        <th className="text-center" style={{ width: "15%" }}>
                          Issued
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemList?.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="text-center">{idx + 1}</td>
                          <td>{item?.product_code}</td>
                          <td>{item?.product_name}</td>
                          <td className="text-center">
                            {item?.category}({item?.unit_of_measure})
                          </td>
                          <td className="text-center">{fmtQty(item?.quantity_requested)}</td>
                          <td className="text-center">{fmtQty(item?.quantity_approved)}</td>
                          <td className="text-center">{fmtQty(item?.quantity_issued)}</td>
                        </tr>
                      ))}
                      {itemList?.length === 0 && (
                        <tr>
                          <td colSpan="7" className="text-center text-muted">
                            No materials found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </ModalBody>
          <div className="modal-footer">
            <CustomButton color="secondary" onClick={toggle}>
              Close
            </CustomButton>
          </div>
        </Modal>
      </CustomCard>
      {/* Create Requisition Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-[var(--aa-navy)] text-white p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">
                    <i className="fa fa-plus me-2"></i>
                    Create Material Requisition
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">
                    Add materials and submit requisition request
                  </p>
                </div>
                <button
                  onClick={toggleCreate}
                  className="p-1.5 hover:bg-white/20 rounded transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50">
              <div className="p-6 flex-1 overflow-y-auto">
                {/* Requisition Information */}
                <div className="mb-4 bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                  <div className="flex items-center mb-3 pb-2 border-b border-gray-200">
                    <div className="w-1 h-5 bg-[var(--aa-navy)] rounded-full mr-2"></div>
                    <h4 className="text-base font-bold text-gray-800">
                      Requisition Details
                    </h4>
                  </div>
                  {/* {JSON.stringify(newMaterial, "=====")} */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-0.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Date
                        </label>
                        <div className="text-sm font-semibold text-gray-900 py-1">
                          {form.date || "-"}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Requisitor
                        </label>
                        <div className="text-sm font-semibold text-gray-900 py-1">
                          {`${user?.firstname} ${user?.lastname}`}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Note <span className="text-danger">*</span>
                      </label>
                      <Textarea
                        name="notes"
                        onChange={handleChange}
                        value={form.notes}
                        className={`mt-1 ${
                          errors.notes ? "border-red-500" : ""
                        }`}
                        rows={3}
                        placeholder="Enter notes (required)"
                        required
                      />
                      {errors.notes && (
                        <div className="text-danger mt-1 small">
                          {errors.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Materials Table */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-2 py-2 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center mb-1">
                      <div className="w-1 h-5 bg-[var(--aa-navy)] rounded-full mr-2"></div>
                      <h4 className="text-lg font-bold text-gray-800">
                        Requisition Details
                      </h4>
                    </div>
                    <p className="text-sm text-gray-600 ml-4 mt-1">
                      Add materials to the requisition
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th
                            style={{ width: "100%" }}
                            className="px-5 py-2 text-left text-sm font-bold text-gray-700  tracking-wider border-b border-gray-200"
                          >
                            Ingrediant
                          </th>
                          <th
                            style={{ width: "10%" }}
                            className="px-5 py-2 text-left text-xs font-bold text-gray-700  tracking-wider border-b border-gray-200"
                          >
                            SKU
                          </th>
                          <th
                            style={{ width: "10%" }}
                            className="px-5 py-2 text-left text-xs font-bold text-gray-700  tracking-wider border-b border-gray-200"
                          >
                            UoM
                          </th>
                          <th
                            style={{ width: "10%" }}
                            className="px-5 py-2 text-right text-xs font-bold text-gray-700  tracking-wider border-b border-gray-200"
                          >
                            Quantity
                          </th>
                          <th
                            style={{ width: "10%" }}
                            className="px-5 py-2 text-center text-xs font-bold text-gray-700  tracking-wider border-b border-gray-200"
                          >
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        <tr className="hover:bg-blue-50/50 transition-colors">
                          <td className="whitespace-nowrap text- m-0 p-0 px-1">
                            <div className="flex justify-center m-0 p-0 w-full">
                              <div className="w-full">
                                <Select
                                  ref={materialSelectRef}
                                  openMenuOnFocus
                                  value={selectedMaterial}
                                  onChange={(option) => {
                                    setSelectedMaterial(option);
                                    const selectedItem = option?.data;
                                    if (selectedItem) {
                                      setNewMaterial((prev) => ({
                                        ...prev,
                                        ...selectedItem,
                                        item_name: selectedItem.item_name || "",
                                        item_code: selectedItem.item_code || "",
                                        category: selectedItem.category || "",
                                        unit_of_measure:
                                          selectedItem.unit_of_measure || "",
                                      }));
                                      // After selecting an item, focus the quantity input
                                      setTimeout(() => {
                                        qtyInputRef.current?.focus();
                                      }, 0);
                                    } else {
                                      setNewMaterial((prev) => ({
                                        ...prev,
                                        item_name: "",
                                        item_code: "",
                                        category: "",
                                        unit_of_measure: "",
                                      }));
                                    }
                                  }}
                                  options={productItems.map((item) => ({
                                    value: item.item_code,
                                    label: `${item.item_name} (${item.item_code})`,
                                    data: item,
                                  }))}
                                  placeholder="Select ingrediant..."
                                  isClearable
                                  isSearchable
                                  styles={customSelectStyles}
                                  menuPortalTarget={document.body}
                                  menuPosition="fixed"
                                />
                              </div>
                            </div>
                          </td>
                          <td className=" whitespace-nowrap text-sm font-semibold text-blue-600 text-center">
                            {newMaterial.item_code || "-"}
                          </td>
                          <td className=" text-sm font-medium text-gray-900 text-center">
                            {newMaterial.item_name || "-"}{" "}
                            {newMaterial.unit_of_measure &&
                              `(${newMaterial.unit_of_measure})`}
                          </td>
                          <td className="whitespace-nowrap text-center">
                            <div className="flex justify-center text-center">
                              <Input
                                type="text"
                                size="sm"
                                name="initiated_qty"
                                value={newMaterial.initiated_qty}
                                innerRef={qtyInputRef}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Format with commas as user types
                                  const formatted =
                                    formatNumberWithCommas(value);
                                  setNewMaterial((prev) => ({
                                    ...prev,
                                    initiated_qty: formatted,
                                  }));
                                }}
                                placeholder="0"
                                className="form-control text-center w-24 border-0 focus:ring-0 rounded-md px-3 py-2 font-semibold"
                                inputMode="decimal"
                              />
                            </div>
                          </td>
                          <td className="whitespace-nowrap text-center">
                            <div className="flex justify-center">
                              <CustomButton
                                size="sm"
                                color="primary"
                                onClick={handleAddMaterial}
                                className="p-1"
                              >
                                <MdAdd size="14" />
                              </CustomButton>
                            </div>
                          </td>
                        </tr>

                        {materials.map((mat, index) => (
                          <tr
                            key={index}
                            className="hover:bg-blue-50/50 transition-colors"
                          >
                            {editIndex === index ? (
                              <>
                                <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-400">
                                  -
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap">
                                  <Input
                                    value={editMaterial.item_code}
                                    disabled
                                    className="w-full"
                                  />
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap">
                                  <Input
                                    value={`${editMaterial.item_name} (${editMaterial.unit_of_measure})`}
                                    disabled
                                    className="w-full"
                                  />
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap">
                                  <Input
                                    type="text"
                                    value={
                                      typeof editMaterial.initiated_qty ===
                                      "number"
                                        ? formatNumberWithCommas(
                                            editMaterial.initiated_qty.toString(),
                                          )
                                        : formatNumberWithCommas(
                                            editMaterial.initiated_qty || "",
                                          )
                                    }
                                    className="form-control text-center w-24 border-2 border-gray-300 focus:border-[var(--aa-accent)] focus:ring-2 focus:ring-blue-200 rounded-md px-3 py-2 font-semibold"
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      // Format with commas as user types
                                      const formatted =
                                        formatNumberWithCommas(value);
                                      setEditMaterial({
                                        ...editMaterial,
                                        initiated_qty: formatted,
                                      });
                                    }}
                                    inputMode="decimal"
                                  />
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                  <div className="flex justify-center gap-1">
                                    <CustomButton
                                      size="sm"
                                      color="success"
                                      onClick={() => handleSaveEdit(index)}
                                      className="p-1"
                                    >
                                      <FaSave size="14" />
                                    </CustomButton>
                                    <CustomButton
                                      size="sm"
                                      color="secondary"
                                      onClick={handleCancelEdit}
                                      className="p-1"
                                    >
                                      <MdOutlineCancel size="14" />
                                    </CustomButton>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-5 py-4 whitespace-nowrap text-sm t-400">
                                  {mat.item_name}
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                                  {mat.item_code}
                                </td>
                                <td className="px-5 py-4 text-sm font-medium text-gray-900">
                                  {mat.unit_of_measure}
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-center tabular-nums">
                                  {fmtQty(mat.initiated_qty)}
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                  <div className="flex justify-center gap-1">
                                    <CustomButton
                                      size="sm"
                                      color="warning"
                                      onClick={() => handleEditMaterial(index)}
                                      className="p-1"
                                    >
                                      <FaEdit size="14" color="white" />
                                    </CustomButton>
                                    <CustomButton
                                      size="sm"
                                      color="secondary"
                                      className="bg-red-500 p-1"
                                      onClick={() =>
                                        handleDeleteMaterial(index)
                                      }
                                    >
                                      <MdDelete size="14" color="white" />
                                    </CustomButton>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                        {materials.length === 0 && (
                          <tr>
                            <td
                              colSpan="5"
                              className="px-5 py-12 text-center text-sm text-gray-500"
                            >
                              <div className="flex flex-col items-center">
                                <i className="fa fa-inbox text-4xl text-gray-300 mb-2"></i>
                                <p className="font-medium">
                                  No materials added yet. Please add materials
                                  to the requisition.
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}
                        {materials.length > 0 && (
                          <tr className="bg-gray-50 border-t-2 border-gray-300">
                            <td
                              colSpan="3"
                              className="px-5 py-3 text-right text-sm font-bold text-gray-900"
                            >
                              Total Items:
                            </td>
                            <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">
                              {materials.length}
                            </td>
                            <td className="px-5 py-3"></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="border-t border-gray-200 bg-white px-6 py-4 flex justify-end gap-3 shadow-sm">
                <button
                  type="button"
                  onClick={toggleCreate}
                  className="px-6 py-2.5 text-sm font-semibold bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  Cancel
                </button>
                <CustomButton
                  loading={loading}
                  size="2"
                  color="primary"
                  onClick={handleSubmit}
                  className="px-6 py-2.5 text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                  disabled={loading || materials.length === 0}
                >
                  {loading ? (
                    <>Submitting...</>
                  ) : (
                    <>
                      <i className="fa fa-check me-2"></i>
                      Submit Requisition
                    </>
                  )}
                </CustomButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
