"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { MdAddCircle } from "react-icons/md";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Typeahead } from "react-bootstrap-typeahead";
import { Loader } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const AddProduct = ({
  closeModal,
  showModal,
  getInventory,
  editingProduct,
}) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [loading, setLoading] = useState(false);
  const [chart, setChart] = useState([]);
  const [data, setData] = useState([]);
  const [formData, setFormData] = useState({
    id: "",
    itemName: "",
    type: "",
    account_head: "",
    account_description: "",
  });
  const [category, setCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [option, setOption] = useState([]);
  const [type, setType] = useState([]);
  const [errors, setErrors] = useState({});
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  useEffect(() => {
    if (editingProduct) {
      // Populate form with editing product data
      setFormData({
        id: editingProduct.id || "",
        itemName: editingProduct.item_name || "",
        type: editingProduct.type || "",
        account_head: editingProduct.account_head || "",
        account_description: editingProduct.account_description || "",
      });
      setCategory(editingProduct.category || "");
    } else {
      // Reset form for new product
      setFormData({
        id: "",
        itemName: "",
        type: "",
        account_head: "",
        account_description: "",
      });
      setCategory("");
    }
  }, [editingProduct]);

  const getCategory = () => {
    const query = "get";
    _postApi(
      `/inventory/new-category/${query}`,
      {
        store: activeBusiness.business_name,
      },
      (data) => {
        setOption(data.results.map((item) => ({ name: item.category })));
      },
      (err) => {
        console.error(err);
      }
    );
  };

  const getType = () => {
    _fetchApi(
      `/inventory/get-product-type`,
      (data) => {
        setType(data.results.map((item) => ({ name: item.description })));
      },
      (err) => {
        console.error(err);
      }
    );
  };

  const handleCategorySubmit = (e) => {
    e.preventDefault();
    const query = "add";
    _postApi(
      `/inventory/new-category/${query}`,
      {
        category: newCategory,
        store: activeBusiness.business_name,
      },
      (res) => {
        toast.success("Successfully Submitted");
        setNewCategory("");
        getCategory();
        setCategoryModalOpen(false);
      },
      (err) => {
        toast.error("An error occurred");
        console.log(err);
      }
    );
  };

  const getACCt = () => {
    if (!activeBusiness?.business_name) return;
    _postApi(
      `/account/chart-of-account?query_type=select`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          setChart(resp.results);
        } else {
          toast.error("Failed to load chart data.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    getACCt();
    getCategory();
    getType();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = {};
    if (!formData.itemName.trim()) {
      validationErrors.itemName = "Item name is required";
    }
    if (!category.trim()) {
      validationErrors.category = "Category is required";
    }
    // if (!formData.type.trim()) {
    //   validationErrors.type = "Type is required"
    // }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    const payload = {
      ...formData,
      category: category,
      query_type: editingProduct ? "update" : "insert",
    };

    if (editingProduct) {
      payload.id = editingProduct.id;
    }

    _postApi(
      `/inventory/product-list`,
      payload,
      (resp) => {
        if (resp.success) {
          setData(resp.results);
          toaster.success(
            editingProduct
              ? "Product updated successfully."
              : "Product added successfully."
          );
          getInventory();
          closeModal();
          setFormData({
            itemName: "",
            type: "",
            account_head: "",
            account_description: "",
          });
          setCategory("");
        } else {
          toast.error(resp.message || "Failed to submit.");
        }
        setLoading(false);
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while submitting data.");
        setLoading(false);
      }
    );
  };

  return (
    <>
      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4 ">
          <Card className="w-full max-w-lg rounded-xl shadow-xl border bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-2xl font-bold text-gray-800">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </CardTitle>
                <CardDescription>
                  {editingProduct
                    ? "Update product details"
                    : "Add new product to your inventory"}
                </CardDescription>
              </div>

              <Button variant="ghost" size="sm" onClick={closeModal}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                {/* Item Name */}
                <div className="space-y-2">
                  <Label htmlFor="itemName">
                    Item Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="itemName"
                    name="itemName"
                    value={formData.itemName}
                    onChange={handleInputChange}
                    placeholder="Enter item name"
                    className={errors.itemName && "border-red-500"}
                  />
                  {errors.itemName && (
                    <p className="text-sm text-red-500">{errors.itemName}</p>
                  )}
                </div>

                {/* Type */}
                <div className="space-y-2">
                  <Label>
                    Type <span className="text-red-500">*</span>
                  </Label>
                  <Typeahead
                    id="product-type-typeahead"
                    size="sm"
                    className="w-full"
                    options={type.map((item) => ({ name: item.name }))}
                    placeholder="Select product type..."
                    onChange={(selectedItems) => {
                      if (selectedItems.length > 0) {
                        setFormData((prev) => ({
                          ...prev,
                          type: selectedItems[0].name,
                        }));
                        setErrors((prev) => ({ ...prev, type: "" }));
                      } else {
                        setFormData((prev) => ({ ...prev, type: "" }));
                        setErrors((prev) => ({
                          ...prev,
                          type: "Product type is required",
                        }));
                      }
                    }}
                    selected={formData.type ? [{ name: formData.type }] : []}
                    labelKey="name"
                    isInvalid={!!errors.type}
                  />
                  {errors.type && (
                    <p className="text-sm text-red-500">{errors.type}</p>
                  )}
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label>
                    Category <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Typeahead
                      id="category-typeahead"
                      size="sm"
                      className="w-full"
                      options={option.map((item) => ({ name: item.name }))}
                      placeholder="Select category..."
                      onChange={(selectedItems) => {
                        if (selectedItems.length > 0) {
                          setCategory(selectedItems[0].name);
                          setErrors((prev) => ({ ...prev, category: "" }));
                        } else {
                          setCategory("");
                          setErrors((prev) => ({
                            ...prev,
                            category: "Category is required",
                          }));
                        }
                      }}
                      selected={category ? [{ name: category }] : []}
                      labelKey="name"
                      isInvalid={!!errors.category}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="px-3 bg-transparent text-[#4267B2] hover:text-[#36549B]"
                      onClick={() => setCategoryModalOpen(true)}
                    >
                      <MdAddCircle className="h-4 w-4" />
                    </Button>
                  </div>
                  {errors.category && (
                    <p className="text-sm text-red-500">{errors.category}</p>
                  )}
                </div>

                {/* Inventory Account */}
                <div className="space-y-2">
                  <Label>Inventory Account</Label>
                  <Typeahead
                    id="inventory-account-typeahead"
                    size="sm"
                    className="w-full"
                    options={chart.map((account) => ({
                      head: account.head,
                      description: account.description,
                    }))}
                    placeholder="Select inventory account..."
                    onChange={(selectedItems) => {
                      if (selectedItems.length > 0) {
                        const selected = selectedItems[0];
                        setFormData((prev) => ({
                          ...prev,
                          account_head: selected.head,
                          account_description: selected.description,
                        }));
                      } else {
                        setFormData((prev) => ({
                          ...prev,
                          account_head: "",
                          account_description: "",
                        }));
                      }
                    }}
                    selected={
                      formData.account_description
                        ? [
                            {
                              head: formData.account_head,
                              description: formData.account_description,
                            },
                          ]
                        : []
                    }
                    labelKey="description"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-[#4267B2] hover:bg-[#36549B]"
                  >
                    {loading ? (
                      <Loader className="animate-spin w-4 h-4 mx-auto" />
                    ) : editingProduct ? (
                      "Update Product"
                    ) : (
                      "Add Product"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeModal}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Modal */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newCategory">Category Name</Label>
              <Input
                id="newCategory"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Enter category name"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setCategoryModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCategorySubmit}
              className="bg-[#4267B2] hover:bg-[#36549B]"
            >
              Add Category
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AddProduct;
