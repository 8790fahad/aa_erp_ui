/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Table, Spinner } from "reactstrap";
import { Card } from "reactstrap/lib";
import { Pencil, Trash2, Landmark, X } from "lucide-react";
import { toast } from "sonner";
import { FaPlus } from "react-icons/fa";
import { _fetchApi, _postApi, _putApi, _deleteApi } from "@/redux/actions/api";
import CustomButton from "@/common/Custom/CustomButton";
import { Label as ShadcnLabel } from "@/components/ui/label";

const emptyForm = () => ({
  bank_name: "",
  bank_code: "",
  bank_cbn_code: "",
  old_bank_code: "",
  old_bank_cbn_code: "",
});

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent";

/**
 * Facility bank directory (`bank_list`): list, add, edit, delete.
 * Add/Edit modal matches Supplier registration modal styling (SupplierTable).
 */
export default function BankListSettings() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const loadBanks = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    _fetchApi(
      `/bank/list?facilityId=${encodeURIComponent(activeBusiness.id)}`,
      (response) => {
        setLoading(false);
        if (response.success) {
          setRows(Array.isArray(response.results) ? response.results : []);
        } else {
          toast.error("Failed to load bank list");
          setRows([]);
        }
      },
      () => {
        setLoading(false);
        toast.error("Could not load bank list");
        setRows([]);
      }
    );
  }, [activeBusiness?.id]);

  /** Refetch list after create/update/delete (no full-page loading lock). */
  const refreshList = useCallback(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/bank/list?facilityId=${encodeURIComponent(activeBusiness.id)}`,
      (response) => {
        if (response.success) {
          setRows(Array.isArray(response.results) ? response.results : []);
        }
      },
      () => {
        toast.error("Could not refresh bank list");
      }
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    loadBanks();
  }, [loadBanks]);

  const openCreate = () => {
    setIsEdit(false);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setIsEdit(true);
    setForm({
      bank_name: row.bank_name || "",
      bank_code: row.bank_code || "",
      bank_cbn_code: row.bank_cbn_code || "",
      old_bank_code: row.bank_code || "",
      old_bank_cbn_code: row.bank_cbn_code || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(emptyForm());
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const name = String(form.bank_name || "").trim();
    const bc = String(form.bank_code || "").trim();
    const cbn = String(form.bank_cbn_code || "").trim();
    if (!name) {
      toast.error("Bank name is required");
      return;
    }
    if (!bc) {
      toast.error("Bank code is required");
      return;
    }
    if (!cbn) {
      toast.error("CBN code is required");
      return;
    }
    if (!activeBusiness?.id) return;

    setSaving(true);
    if (isEdit) {
      _putApi(
        "/api/bank-list",
        {
          bank_name: name,
          bank_code: bc,
          bank_cbn_code: cbn,
          old_bank_code: form.old_bank_code,
          old_bank_cbn_code: form.old_bank_cbn_code,
        },
        (response) => {
          setSaving(false);
          if (response.success) {
            toast.success(response.message || "Bank updated");
            closeModal();
            refreshList();
          } else {
            toast.error(response.message || "Update failed");
          }
        },
        (err) => {
          setSaving(false);
          toast.error(err?.message || "Update failed");
        }
      );
    } else {
      _postApi(
        "/api/bank-list",
        {
          bank_name: name,
          bank_code: bc,
          bank_cbn_code: cbn,
        },
        (response) => {
          setSaving(false);
          if (response.success) {
            toast.success(response.message || "Bank added");
            closeModal();
            refreshList();
          } else {
            toast.error(response.message || "Could not add bank");
          }
        },
        (err) => {
          setSaving(false);
          toast.error("Could not add bank");
        }
      );
    }
  };

  const handleDelete = (row) => {
    if (
      !window.confirm(
        `Remove "${row.bank_name}" from this facility’s bank list?`
      )
    ) {
      return;
    }
    if (!activeBusiness?.id) return;
    setLoading(true);
    _deleteApi(
      "/api/bank-list",
      {
        bank_code: String(row.bank_code),
        bank_cbn_code: String(row.bank_cbn_code),
        facilityId: activeBusiness.id,
      },
      (response) => {
        setLoading(false);
        if (response.success) {
          toast.success(response.message || "Bank removed");
          refreshList();
        } else {
          toast.error(response.message || "Delete failed");
        }
      },
      (err) => {
        setLoading(false);
        toast.error(err?.message || "Delete failed");
      }
    );
  };

  return (
    <Card className="shadow-sm border-0">
      <div className="card-header bg-white border-0 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <Landmark className="text-primary" size={22} />
          <div>
            <h5 className="mb-0 fw-bold">Bank list</h5>
            <small className="text-muted">
              Banks available when adding bank accounts (per business)
            </small>
          </div>
        </div>
        <CustomButton
          color="primary"
          size="sm"
          className="d-flex align-items-center"
          onClick={openCreate}
        >
          <FaPlus className="me-2" />
          Add bank
        </CustomButton>
      </div>
      <div className="card-body pt-0">
        {loading && rows.length === 0 ? (
          <div className="d-flex justify-content-center py-5">
            <Spinner color="primary" />
          </div>
        ) : (
          <div className="table-responsive">
            <Table hover size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>Bank name</th>
                  <th>Bank code</th>
                  <th>CBN code</th>
                  <th className="text-end" style={{ width: "120px" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-muted text-center py-4">
                      No banks yet. Click &quot;Add bank&quot; to create one.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={`${row.bank_code}-${row.bank_cbn_code}-${row.facilityId}`}>
                      <td className="fw-medium">{row.bank_name}</td>
                      <td>
                        <code className="small">{row.bank_code}</code>
                      </td>
                      <td>
                        <code className="small text-center">{row.bank_cbn_code}</code>
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-1 me-1 text-primary"
                          onClick={() => openEdit(row)}
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-1 text-danger"
                          onClick={() => handleDelete(row)}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      {/* Same modal shell as SupplierRegisteration (SupplierTable) */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">
                    {isEdit ? "Edit bank" : "Add bank"}
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">
                    {isEdit
                      ? "Update bank name and codes for this facility"
                      : "Add a bank to your facility’s directory"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-1.5 hover:bg-white/20 rounded transition-all"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <form
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="mb-4">
                  <ShadcnLabel
                    htmlFor="bank-list-name"
                    className="text-sm font-semibold text-gray-700 mb-1 block"
                  >
                    Bank name <span className="text-red-500">*</span>
                  </ShadcnLabel>
                  <input
                    id="bank-list-name"
                    type="text"
                    value={form.bank_name}
                    onChange={(e) => handleChange("bank_name", e.target.value)}
                    placeholder="e.g. Keystone Bank"
                    className={inputClass}
                  />
                </div>
                <div className="mb-4">
                  <ShadcnLabel
                    htmlFor="bank-list-code"
                    className="text-sm font-semibold text-gray-700 mb-1 block"
                  >
                    Bank code <span className="text-red-500">*</span>
                  </ShadcnLabel>
                  <input
                    id="bank-list-code"
                    type="text"
                    value={form.bank_code}
                    onChange={(e) => handleChange("bank_code", e.target.value)}
                    placeholder="e.g. 082121038"
                    className={inputClass}
                  />
                </div>
                <div className="mb-0">
                  <ShadcnLabel
                    htmlFor="bank-list-cbn"
                    className="text-sm font-semibold text-gray-700 mb-1 block"
                  >
                    CBN code <span className="text-red-500">*</span>
                  </ShadcnLabel>
                  <input
                    id="bank-list-cbn"
                    type="text"
                    value={form.bank_cbn_code}
                    onChange={(e) =>
                      handleChange("bank_cbn_code", e.target.value)
                    }
                    placeholder="e.g. 082"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="border-t bg-gray-50 p-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
                  disabled={saving}
                >
                  <X className="w-4 h-4 inline mr-2" />
                  Cancel
                </button>
                <CustomButton
                  loading={saving}
                  size="2"
                  type="submit"
                  className="px-4 py-2"
                >
                  {isEdit ? "Update" : "Save"}
                </CustomButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
