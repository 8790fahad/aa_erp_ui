/* eslint-disable no-unused-vars */
import CustomButton from "@/common/Custom/CustomButton";
import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "reactstrap/lib";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { accountTypes } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SupplierBankDetails = ({
  closeModal,
  empty,
  showModal,
  getList,
  selectedSupplier,
  editing,
  selectedBankDetail = null // New prop for editing specific bank detail
}) => {
  const facilityId = useSelector((state) => state.auth.activeBusiness.id);
  const [loading, setLoading] = useState(false);
  const [payableCode, setPayableCode] = useState([]);
  const [errors, setErrors] = useState({});
  const [bankList, setBankList] = useState([]);
  
  // Updated form state with all necessary fields
  const [form, setForm] = useState({
    supplier_number: "",
    bank_code: "",
    bank_name: "",
    bank_cbn_code: "",
    account_number: "",
    account_name: "",
    code: "",
    account_bank_type: "",
    bank_detail_id: null // For editing existing bank details
  });

  const getBankList = useCallback(() => {
    _fetchApi(
      `/bank/list`,
      (data) => {
        if (data.success) {
          setBankList(data.results);
        }
      },
      (err) => {
        console.error(err);
        toast.error("Failed to load bank list");
      }
    );
  }, []);

  useEffect(() => {
    getBankList();
  }, []);

  // Initialize form when component opens
  useEffect(() => {
    if (selectedSupplier) {
      setForm((prev) => ({
        ...prev,
        supplier_number: selectedSupplier.supplier_number,
      }));
    }

    // If editing existing bank detail, populate form
    if (editing && selectedBankDetail) {
      setForm({
        supplier_number: selectedSupplier?.supplier_number || "",
        bank_code: selectedBankDetail.bank_code || "",
        bank_name: selectedBankDetail.bank_name || "",
        bank_cbn_code: selectedBankDetail.bank_cbn_code || "",
        account_number: selectedBankDetail.account_number || "",
        account_name: selectedBankDetail.account_name || "",
        code: selectedBankDetail.code || "",
        account_bank_type: selectedBankDetail.account_bank_type || "",
        bank_detail_id: selectedBankDetail.id || null
      });
    }
  }, [selectedSupplier, selectedBankDetail, editing]);

  const getPayableItems = () => {
    if (!facilityId) return;
    _postApi(
      `/inventory/product-list?query_type=payable`,
      { facilityId: facilityId },
      (resp) => {
        if (resp.success) {
          setPayableCode(
            resp.results.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
            }))
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    getPayableItems();
  }, []);

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({
      ...p,
      [name]: value,
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  // Validation function
  const validateForm = () => {
    const newErrors = {};

    if (!form.bank_code) {
      newErrors.bank = "Bank selection is required";
    }
    if (!form.account_number) {
      newErrors.account_number = "Account number is required";
    }
    if (!form.account_name) {
      newErrors.account_name = "Account name is required";
    }
    if (!form.code) {
      newErrors.type = "Account type is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const success_callback = () => {
    setLoading(false);
    getList();
    closeModal();
    empty();
    // Reset form
    setForm({
      supplier_number: "",
      bank_code: "",
      bank_name: "",
      bank_cbn_code: "",
      account_number: "",
      account_name: "",
      code: "",
      account_bank_type: "",
      bank_detail_id: null
    });
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      toast.error("Please fill all required fields");
      return;
    }

    if (!selectedSupplier?.supplier_number) {
      toast.error("Supplier information is required");
      return;
    }

    setLoading(true);
    
    try {
      const obj = {
        ...form,
        query_type: editing ? "update_bank_detail" : "create_bank_detail",
        facilityId,
      };

      const api = editing
        ? `/update/supplier_bank_detail`
        : `/create/supplier_bank_detail`;

      _postApi(
        api,
        obj,
        (res) => {
          if (!res.success) {
            setLoading(false);
            toast.error(res.message || "An error occurred!");
            return;
          } else {
            const action = editing ? "updated" : "added";
            toast.success(
              `Bank details ${action} successfully for ${selectedSupplier.name || 'supplier'}`
            );
            success_callback();
          }
        },
        (err) => {
          setLoading(false);
          console.error(err);
          toast.error("An error occurred while saving bank details!");
        }
      );
    } catch (err) {
      console.error(err);
      toast.error("An error occurred!");
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    closeModal();
    empty();
    setForm({
      supplier_number: "",
      bank_code: "",
      bank_name: "",
      bank_cbn_code: "",
      account_number: "",
      account_name: "",
      code: "",
      account_bank_type: "",
      bank_detail_id: null
    });
    setErrors({});
  };

  return (
    <>
      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg rounded-xl shadow-xl border bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-2xl font-bold text-gray-800">
                  {editing ? "Edit Supplier Bank Details" : "Add Supplier Bank Details"}
                </CardTitle>
                <CardDescription>
                  {editing
                    ? "Update supplier bank details"
                    : "Add new supplier bank details"}
                  {selectedSupplier && (
                    <span className="block text-sm font-medium mt-1">
                      Supplier: {selectedSupplier.name}
                    </span>
                  )}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleModalClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <div className="p-6 pt-3">
              {/* Bank Selection */}
              <div className="my-2">
                <Label htmlFor="bank">
                  Select Bank<span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.bank_code}
                  onValueChange={(value) => {
                    const selectedBank = bankList.find(
                      (bank) => bank.bank_code === value
                    );
                    if (selectedBank) {
                      setForm({
                        ...form,
                        bank_code: selectedBank.bank_code,
                        bank_name: selectedBank.bank_name,
                        bank_cbn_code: selectedBank.bank_cbn_code,
                      });
                      // Clear bank error
                      if (errors.bank) {
                        setErrors(prev => ({ ...prev, bank: "" }));
                      }
                    }
                  }}
                >
                  <SelectTrigger
                    className={errors.bank ? "border-red-500" : ""}
                  >
                    <SelectValue placeholder="Select bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankList.map((item, index) => (
                      <SelectItem key={index} value={item.bank_code}>
                        {item.bank_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.bank && (
                  <p className="text-sm text-red-500 mt-1">{errors.bank}</p>
                )}
              </div>

              {/* Account Number */}
              <div className="my-2">
                <Label htmlFor="account_number">
                  Account Number<span className="text-red-500">*</span>
                </Label>
                <Input
                  id="account_number"
                  name="account_number"
                  type="text"
                  placeholder="0000000000"
                  value={form.account_number}
                  onChange={handleChange}
                  className={errors.account_number ? "border-red-500" : ""}
                />
                {errors.account_number && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.account_number}
                  </p>
                )}
              </div>

              {/* Account Name */}
              <div className="my-2">
                <Label htmlFor="account_name">
                  Account Name<span className="text-red-500">*</span>
                </Label>
                <Input
                  id="account_name"
                  name="account_name"
                  type="text"
                  placeholder="John Doe"
                  value={form.account_name}
                  onChange={handleChange}
                  className={errors.account_name ? "border-red-500" : ""}
                />
                {errors.account_name && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.account_name}
                  </p>
                )}
              </div>

              {/* Account Type */}
              <div className="my-2">
                <Label htmlFor="type">
                  Account Type<span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.code}
                  onValueChange={(value) => {
                    const selectedType = accountTypes.find(
                      (type) => type.code === value
                    );
                    if (selectedType) {
                      setForm({
                        ...form,
                        code: selectedType.code,
                        account_bank_type: selectedType.title,
                      });
                      // Clear type error
                      if (errors.type) {
                        setErrors(prev => ({ ...prev, type: "" }));
                      }
                    }
                  }}
                >
                  <SelectTrigger
                    className={errors.type ? "border-red-500" : ""}
                  >
                    <SelectValue placeholder="Select Bank Account Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypes.map((item, index) => (
                      <SelectItem key={index} value={item.code}>
                        {item.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-sm text-red-500 mt-1">{errors.type}</p>
                )}
              </div>
            </div>

            <center className="mt-1">
              <CustomButton
                loading={loading}
                size="2"
                className="mb-3"
                onClick={handleSubmit}
              >
                {editing ? "Update Details" : "Save Details"}
              </CustomButton>
            </center>
          </Card>
        </div>
      )}
    </>
  );
};

export default SupplierBankDetails;