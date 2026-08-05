/* eslint-disable no-unused-vars */
import CustomButton from "@/common/Custom/CustomButton";
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import PropTypes from "prop-types";
import { X } from "lucide-react";
import { _putApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { Label as ShadcnLabel } from "@/components/ui/label";

const FollowUpModal = ({
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
            follow_up_status: "",
        }),
        []
    );

    const [form, setForm] = useState(() => getInitialFormValues());

    // Initialize form when editing
    useEffect(() => {
        if (selectedProject) {
            setForm({
                id: selectedProject.id || "",
                follow_up_status: selectedProject.follow_up_status || "",
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

        if (!form.follow_up_status.trim()) {
            newErrors.follow_up_status = "Follow up status is required";
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
            // Prepare payload - only follow-up status
            const payload = {
                follow_up_status: form.follow_up_status,
            };

            // Update existing project with follow-up status
            _putApi(
                `/api/projects/${facilityId}/${selectedProject.id}`,
                payload,
                (res) => {
                    setLoading(false);
                    if (!res.success) {
                        toast.error(res.message || "An error occurred!");
                        return;
                    }
                                    toast.success(`Follow up status updated successfully`);
                    success_callback();
                },
                (err) => {
                    setLoading(false);
                    console.error(err);
                    toast.error("An error occurred while updating follow up status!");
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
                                        Update Follow Up Status
                                    </h3>
                                    <p className="text-blue-100 text-sm mt-1">
                                        Update follow up status for this project
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
                                {/* Follow Up Status */}
                                <div className="mb-4">
                                    <ShadcnLabel
                                        htmlFor="follow_up_status"
                                        className="text-sm font-semibold text-gray-700 mb-1 block"
                                    >
                                        Follow Up Status <span className="text-red-500">*</span>
                                    </ShadcnLabel>
                                    <select
                                        id="follow_up_status"
                                        name="follow_up_status"
                                        value={form.follow_up_status}
                                        onChange={handleChange}
                                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.follow_up_status ? "border-red-500" : ""
                                            }`}
                                    >
                                        <option value="">Select follow up status</option>
                                        <option value="Head office">Head office</option>
                                        <option value="Raise Valuation">Raise Valuation</option>
                                        <option value="POINT OF COLLECTION EDP">POINT OF COLLECTION EDP</option>
                                        <option value="PMS">PMS</option>
                                        <option value="CONSULTANCY REPORT">CONSULTANCY REPORT</option>
                                        <option value="COMPARISING">COMPARISING</option>
                                        <option value="INTRIME PAYMENT CERTIFICATE">INTRIME PAYMENT CERTIFICATE</option>
                                        <option value="THEN AUDIT">THEN AUDIT</option>
                                        <option value="PLANING">PLANING</option>
                                        <option value="PMS PROJETC MONITORING AND SUPERVISION">PMS PROJETC MONITORING AND SUPERVISION</option>
                                        <option value="EDP">EDP</option>
                                        <option value="FINANCE EX DIRECTOR">FINANCE EX DIRECTOR</option>
                                        <option value="TREASURY">TREASURY</option>
                                        <option value="ACCOUNT PAYABLE">ACCOUNT PAYABLE</option>
                                    </select>
                                    {errors.follow_up_status && (
                                        <p className="text-sm text-red-500 mt-1">
                                            {errors.follow_up_status}
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
                                    Update Follow Up
                                </CustomButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

FollowUpModal.propTypes = {
    closeModal: PropTypes.func.isRequired,
    empty: PropTypes.func.isRequired,
    showModal: PropTypes.bool.isRequired,
    getList: PropTypes.func.isRequired,
    selectedProject: PropTypes.object,
};

export default FollowUpModal;
