/* eslint-disable no-unused-vars */
import CustomButton from "@/common/Custom/CustomButton";
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import PropTypes from "prop-types";
import { X } from "lucide-react";
import { _putApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { Label as ShadcnLabel } from "@/components/ui/label";

const ProgressStatusModal = ({
    closeModal,
    empty,
    showModal,
    getList,
    selectedProject,
}) => {
    const { activeBusiness } = useSelector((state) => state.auth);
    const facilityId = activeBusiness?.id;
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // Helper function to get initial form values
    const getInitialFormValues = useCallback(
        () => ({
            progress_status: "",
        }),
        []
    );

    const [form, setForm] = useState(() => getInitialFormValues());

    // Initialize form when editing
    useEffect(() => {
        if (selectedProject) {
            setForm({
                id: selectedProject.id || "",
                progress_status: selectedProject.progress_status || "",
            });
        } else {
            setForm(getInitialFormValues());
        }
        setErrors({});
    }, [selectedProject, getInitialFormValues]);

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

        if (!form.progress_status.trim()) {
            newErrors.progress_status = "Project status is required";
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
            // Prepare payload - only progress status
            const payload = {
                progress_status: form.progress_status,
            };

            // Update existing project with progress status
            _putApi(
                `/api/projects/${facilityId}/${selectedProject.id}`,
                payload,
                (res) => {
                    setLoading(false);
                    if (!res.success) {
                        toast.error(res.message || "An error occurred!");
                        return;
                    }
                    toast.success(`Project status updated successfully`);
                    success_callback();
                },
                (err) => {
                    setLoading(false);
                    console.error(err);
                    toast.error("An error occurred while updating project status!");
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
        setForm(getInitialFormValues());
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
                                        Update Project Status
                                    </h3>
                                    <p className="text-blue-100 text-sm mt-1">
                                        Update progress status for this project
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
                                {/* Project Status */}
                                <div className="mb-4">
                                    <ShadcnLabel
                                        htmlFor="progress_status"
                                        className="text-sm font-semibold text-gray-700 mb-1 block"
                                    >
                                        Project Status <span className="text-red-500">*</span>
                                    </ShadcnLabel>
                                    <select
                                        id="progress_status"
                                        name="progress_status"
                                        value={form.progress_status}
                                        onChange={handleChange}
                                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.progress_status ? "border-red-500" : ""
                                            }`}
                                    >
                                        <option value="">Select project status</option>
                                        <option value="not-started">Not Started</option>
                                        <option value="in-progress">In Progress</option>
                                        <option value="on-hold">On Hold</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                    {errors.progress_status && (
                                        <p className="text-sm text-red-500 mt-1">
                                            {errors.progress_status}
                                        </p>
                                    )}
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
                                    Update Status
                                </CustomButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

ProgressStatusModal.propTypes = {
    closeModal: PropTypes.func.isRequired,
    empty: PropTypes.func.isRequired,
    showModal: PropTypes.bool.isRequired,
    getList: PropTypes.func.isRequired,
    selectedProject: PropTypes.object,
};

export default ProgressStatusModal;
