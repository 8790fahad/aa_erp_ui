/* eslint-disable no-unused-vars */
import CustomButton from "@/common/Custom/CustomButton";
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import PropTypes from "prop-types";
import { X } from "lucide-react";
import { _fetchApi, _postApi, _putApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { Label as ShadcnLabel } from "@/components/ui/label";
import { Input } from "reactstrap";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";

const ProjectRegistration = ({
    closeModal,
    empty,
    showModal,
    getList,
    selectedProject,
}) => {
    const { activeBusiness } = useSelector((state) => state.auth);
    const { user } = useSelector((state) => state.auth);
    const facilityId = activeBusiness?.id;
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    // Helper function to get initial form values
    const getInitialFormValues = useCallback(
        () => ({
            project_name: "",
            customer: "",
            start_date: "",
            end_date: "",
            progress_status: "",
            notes: "",
        }),
        []
    );

    const [form, setForm] = useState(() => getInitialFormValues());

    // Initialize form when editing
    useEffect(() => {
        if (selectedProject) {
            setForm({
                id: selectedProject.id || "",
                project_name: selectedProject.project_name || "",
                customer: selectedProject.customer || "",
                start_date: selectedProject.start_date || "",
                end_date: selectedProject.end_date || "",
                progress_status: selectedProject.progress_status || "",
                notes: selectedProject.notes || "",
            });
            // Find and set the selected customer object
            const customer = customers.find(
                (c) => c.name === selectedProject.customer || c.customerNo === selectedProject.customer
            );
            setSelectedCustomer(customer || null);
        } else {
            setForm(getInitialFormValues());
            setSelectedCustomer(null);
        }
        setErrors({});
    }, [selectedProject, getInitialFormValues, customers]);

    // Get customers list
    const getCustomers = useCallback(() => {
        _fetchApi(
            `/api/v1/get-customers-list/${facilityId}`,
            (response) => {
                if (response.success) {
                    const customersList = response.results || response.data || [];
                    setCustomers(
                        customersList.map((customer) => ({
                            id: customer.customerNo || customer.id,
                            name: customer.fullname || customer.name,
                            customerNo: customer.customerNo,
                        }))
                    );
                }
            },
            (err) => {
                console.error("Error loading customers:", err);
            }
        );
    }, [facilityId]);

    useEffect(() => {
        getCustomers();
    }, [getCustomers]);

    const handleChange = ({ target: { name, value } }) => {
        setForm((prev) => ({
            ...prev,
            [name]: value,
        }));

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors((prev) => ({
                ...prev,
                [name]: "",
            }));
        }
    };



    // Form validation
    const validateForm = () => {
        const newErrors = {};

        if (!form.project_name.trim()) {
            newErrors.project_name = "Project name is required";
        }
        if (!form.customer.trim()) {
            newErrors.customer = "Customer is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const success_callback = () => {
        setLoading(false);
        getList();
        closeModal();
        empty();

        // Reset form with initial state values
        setForm(getInitialFormValues());
        setErrors({});
    };

    const handleSubmit = (e) => {
        e?.preventDefault();

        if (!validateForm()) {
            toast.error("Please fix the errors before submitting");
            return;
        }

        setLoading(true);

        try {
            // Prepare payload
            const payload = {
                project_name: form.project_name,
                customer: form.customer,
                start_date: form.start_date || null,
                end_date: form.end_date || null,
                progress_status: form.progress_status || "not-started",
                notes: form.notes || "",
                facilityId,
                created_by: user.id,
            };

            if (selectedProject) {
                // Update existing project
                _putApi(
                    `/api/projects/${facilityId}/${selectedProject.id}`,
                    payload,
                    (res) => {
                        setLoading(false);
                        if (!res.success) {
                            toast.error(res.message || "An error occurred!");
                            return;
                        }
                        toast.success(`Project ${form.project_name} updated successfully`);
                        success_callback();
                    },
                    (err) => {
                        setLoading(false);
                        console.error(err);
                        toast.error("An error occurred while updating project!");
                    }
                );
            } else {
                // Create new project
                _postApi(
                    `/api/projects`,
                    payload,
                    (res) => {
                        setLoading(false);
                        if (!res.success) {
                            toast.error(res.message || "An error occurred!");
                            return;
                        }
                        toast.success(`Project ${form.project_name} added successfully`);
                        success_callback();
                    },
                    (err) => {
                        setLoading(false);
                        console.error(err);
                        toast.error("An error occurred while saving project!");
                    }
                );
            }
        } catch (err) {
            console.error(err);
            toast.error("An error occurred!");
            setLoading(false);
        }
    };

    const handleModalClose = () => {
        closeModal();
        empty();
        setForm(getInitialFormValues());
        setSelectedCustomer(null);
        setErrors({});
    };

    return (
        <>
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold">
                                        {selectedProject ? "Edit Project" : "Create New Project"}
                                    </h3>
                                    <p className="text-blue-100 text-sm mt-1">
                                        {selectedProject
                                            ? "Update project details"
                                            : "Add new project to your list"}
                                    </p>
                                </div>
                                <button
                                    onClick={handleModalClose}
                                    className="p-1.5 hover:bg-white/20 rounded transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Form Content */}
                        <form
                            onSubmit={handleSubmit}
                            className="flex-1 flex flex-col min-h-0 overflow-hidden"
                        >
                            <div className="p-6 flex-1 overflow-y-auto">
                                {/* Project Name */}
                                <div className="mb-4">
                                    <ShadcnLabel
                                        htmlFor="project_name"
                                        className="text-sm font-semibold text-gray-700 mb-1 block"
                                    >
                                        Project Name <span className="text-red-500">*</span>
                                    </ShadcnLabel>
                                    <input
                                        id="project_name"
                                        name="project_name"
                                        type="text"
                                        value={form.project_name}
                                        placeholder="What's the project?"
                                        onChange={handleChange}
                                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.project_name ? "border-red-500" : ""
                                            }`}
                                    />
                                    {errors.project_name && (
                                        <p className="text-sm text-red-500 mt-1">
                                            {errors.project_name}
                                        </p>
                                    )}
                                </div>

                                {/* Customer */}
                                <div className="mb-4">
                                    <ShadcnLabel
                                        htmlFor="customer"
                                        className="text-sm font-semibold text-gray-700 mb-1 block"
                                    >
                                        Customer <span className="text-red-500">*</span>
                                    </ShadcnLabel>
                                    <TypeaheadCustom
                                        options={customers}
                                        placeholder="Search customers..."
                                        labelKey={(customer) =>
                                            `${customer.name} (${customer.customerNo || customer.id})`
                                        }
                                        onChange={(selectedItems) => {
                                            const selected =
                                                selectedItems.length > 0 ? selectedItems[0] : null;
                                            setSelectedCustomer(selected);
                                            // Update form with customer name
                                            setForm((prev) => ({
                                                ...prev,
                                                customer: selected ? selected.name : "",
                                            }));
                                            // Clear error
                                            if (errors.customer) {
                                                setErrors((prev) => ({
                                                    ...prev,
                                                    customer: "",
                                                }));
                                            }
                                        }}
                                        selected={selectedCustomer ? [selectedCustomer] : []}
                                    />
                                    {errors.customer && (
                                        <p className="text-sm text-red-500 mt-1">
                                            {errors.customer}
                                        </p>
                                    )}
                                </div>

                                {/* Grid for Start and End Date */}
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    {/* Start Date */}
                                    <div>
                                        <ShadcnLabel
                                            htmlFor="start_date"
                                            className="text-sm font-semibold text-gray-700 mb-1 block"
                                        >
                                            Start Date
                                        </ShadcnLabel>
                                        <Input
                                            id="start_date"
                                            name="start_date"
                                            type="date"
                                            value={form.start_date}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    {/* End Date */}
                                    <div>
                                        <ShadcnLabel
                                            htmlFor="end_date"
                                            className="text-sm font-semibold text-gray-700 mb-1 block"
                                        >
                                            End Date
                                        </ShadcnLabel>
                                        <Input
                                            id="end_date"
                                            name="end_date"
                                            type="date"
                                            value={form.end_date}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                {/* Progress Status */}
                                <div className="mb-4">
                                    <ShadcnLabel
                                        htmlFor="progress_status"
                                        className="text-sm font-semibold text-gray-700 mb-1 block"
                                    >
                                        Progress Status
                                    </ShadcnLabel>
                                    <select
                                        id="progress_status"
                                        name="progress_status"
                                        value={form.progress_status}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="">Select status</option>
                                        <option value="not-started">Not Started</option>
                                        <option value="in-progress">In Progress</option>
                                        <option value="on-hold">On Hold</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>

                                {/* Notes */}
                                <div className="mb-4">
                                    <ShadcnLabel
                                        htmlFor="notes"
                                        className="text-sm font-semibold text-gray-700 mb-1 block"
                                    >
                                        Notes
                                    </ShadcnLabel>
                                    <textarea
                                        id="notes"
                                        name="notes"
                                        value={form.notes}
                                        placeholder="Add any additional notes..."
                                        onChange={handleChange}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="border-t bg-gray-50 p-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={handleModalClose}
                                    className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
                                    disabled={loading}
                                >
                                    <X className="w-4 h-4 inline mr-2" />
                                    Cancel
                                </button>
                                <CustomButton
                                    loading={loading}
                                    size="2"
                                    onClick={handleSubmit}
                                    className="px-4 py-2"
                                >
                                    {selectedProject ? "Update" : "Submit"}
                                </CustomButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

ProjectRegistration.propTypes = {
    closeModal: PropTypes.func.isRequired,
    empty: PropTypes.func.isRequired,
    showModal: PropTypes.bool.isRequired,
    getList: PropTypes.func.isRequired,
    selectedProject: PropTypes.object,
};

export default ProjectRegistration;
