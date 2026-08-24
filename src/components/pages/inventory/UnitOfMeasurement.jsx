/* eslint-disable no-unused-vars */
import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomTable1 from "@/common/Custom/CustomTable1";
import Loading from "@/common/Custom/Loading";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { useSelector } from "react-redux";
import React, { useCallback, useEffect, useState } from "react";
import { Trash2, Plus, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Input, Label, Row, Table } from "reactstrap";
import { toast } from "sonner";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";

export default function UnitOfMeasurement() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [pr, setPr] = useState([]);
  const rowsPerPage = 15;

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: "",
    unit: "",
    status: "active",
  });
  const [submitting, setSubmitting] = useState(false);
  const [distinctCategories, setDistinctCategories] = useState([]);

  const getMeasurement = useCallback(() => {
    setLoading(true);
    _fetchApi(
      `/inventory/get-all-measure/${activeBusiness.id}`,
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
  }, [activeBusiness.id]);

  useEffect(() => {
    getMeasurement();
  }, [getMeasurement]);

  // Extract distinct categories from existing data
  useEffect(() => {
    const categories = [
      ...new Set(pr.map((item) => item.category).filter(Boolean)),
    ];
    setDistinctCategories(
      categories.map((cat) => ({ value: cat, label: cat }))
    );
  }, [pr]);

  const filteredPr = pr.filter((item) => {
    return searchTerm
      ? item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.unit?.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
  });

  const fields = [
    {
      value: "category",
      title: "Category",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-sm font-medium">{item.category}</div>
      ),
    },
    {
      value: "unit",
      title: "Unit",
      custom: true,
      className: "text-left",
      component: (item) => <div className="text-sm">{item.unit}</div>,
    },
    {
      value: "status",
      title: "Status",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="flex justify-center items-center">
          <Badge color={item.status === "inactive" ? "danger" : "primary"}>
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // You can handle view or delete here
              // console.log("Clicked item:", item);
            }}
            className="text-red-600 hover:text-red-800 hover:bg-red-50"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <CustomCard header="Unit of Measurements">
        <div className="d-flex align-items-center justify-content-between">
          <CustomButton className="m-1" onClick={() => setIsModalOpen(true)}>
            Add Unit
          </CustomButton>

          <span className="d-flex justify-content-end align-items-center gap-2 mb-2 ml-auto">
            <Label for="searchFilter" className="mb-0 mr-2">
              Search:
            </Label>
            <Input
              id="searchFilter"
              type="text"
              bsSize="sm"
              placeholder="Search by category or unit"
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
          ) : (
            <>
              {filteredPr.length ? (
                <CustomTable1
                  data={filteredPr}
                  fields={fields}
                  loading={loading}
                  pageSize={rowsPerPage}
                  message="No unit of measurements found"
                />
              ) : (
                <Alert className="mt-3" color="info">
                  No data to view
                </Alert>
              )}
            </>
          )}
        </Row>

      </CustomCard>

        {/* Add Unit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="bg-[var(--aa-navy)] text-white p-6 rounded-t-lg flex items-center justify-between">
                <h2 className="text-2xl font-bold">Add Unit of Measurement</h2>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormData({ category: "", unit: "", status: "active" });
                  }}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                {/* Input Fields */}
                <div className="grid grid-cols-1 md:grid-cols- gap-4 mb-6">
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Category <span className="text-red-500">*</span>
                    </Label>
                    <TypeaheadCustom
                      options={distinctCategories}
                      placeholder="Select or type a category..."
                      labelKey="label"
                      allowNew
                      newSelectionPrefix="Add new: "
                      onChange={(selectedItems) => {
                        if (selectedItems.length > 0) {
                          const selected = selectedItems[0];
                          // Handle both object and string values
                          const categoryValue =
                            typeof selected === "string"
                              ? selected
                              : selected.label || selected.value || selected;
                          setFormData((prev) => ({
                            ...prev,
                            category: categoryValue,
                          }));
                        } else {
                          setFormData((prev) => ({
                            ...prev,
                            category: "",
                          }));
                        }
                      }}
                      selected={
                        formData.category
                          ? distinctCategories.find(
                              (cat) => cat.value === formData.category
                            )
                            ? [
                                {
                                  value: formData.category,
                                  label: formData.category,
                                },
                              ]
                            : [
                                {
                                  value: formData.category,
                                  label: formData.category,
                                },
                              ]
                          : []
                      }
                      fixed={true}
                      flip={true}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Unit <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      name="unit"
                      value={formData.unit}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          unit: e.target.value,
                        }))
                      }
                      placeholder="Enter unit"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Status
                    </Label>
                    <Input
                      type="select"
                      name="status"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          status: e.target.value,
                        }))
                      }
                      className="w-full"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </Input>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsModalOpen(false);
                      setFormData({ category: "", unit: "", status: "active" });
                    }}
                    disabled={submitting}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      const { category, unit } = formData;
                      if (!category.trim() || !unit.trim()) {
                        toast.error("Please fill all required fields");
                        return;
                      }

                      setSubmitting(true);
                      const payload = {
                        facilityId: activeBusiness.id,
                        query_type: "insert",
                        items: [
                          {
                            category: formData.category,
                            unit: formData.unit,
                            status: formData.status,
                          },
                        ],
                      };

                      _postApi(
                        `/inventory/unit-of-measure`,
                        payload,
                        (response) => {
                          setSubmitting(false);
                          if (response.success) {
                            toast.success(
                              "Unit of measurement added successfully"
                            );
                            setIsModalOpen(false);
                            setFormData({
                              category: "",
                              unit: "",
                              status: "active",
                            });
                            getMeasurement(); // Refresh the list
                          } else {
                            toast.error(
                              response.message || "Failed to add unit"
                            );
                          }
                        },
                        (error) => {
                          setSubmitting(false);
                          console.error("Error:", error);
                          toast.error("Failed to add unit of measurement");
                        }
                      );
                    }}
                    disabled={
                      submitting ||
                      !formData.category.trim() ||
                      !formData.unit.trim()
                    }
                    style={{ backgroundColor: "var(--aa-navy)" }}
                  >
                    {submitting ? (
                      "Submitting..."
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Submit
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
