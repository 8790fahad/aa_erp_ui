import { useState, useEffect, useCallback } from "react";
import { _fetchApi } from "@/redux/actions/api";
import { useSelector } from "react-redux";

/**
 * Reusable department select dropdown.
 *
 * Props:
 *   value        — selected value ("all" or department id as string/number)
 *   onChange     — callback(value: string)
 *   facilityId   — override the activeBusiness id (optional)
 *   placeholder  — first option label (default: "All Departments")
 *   required     — marks field required
 *   className    — extra classes for the <select>
 *   disabled     — disables the select
 *   size         — "sm" | "md" (default "md") — controls padding/height
 */
export default function DepartmentSelect({
  value = "all",
  onChange,
  facilityId: facilityIdProp,
  placeholder = "All Departments",
  required = false,
  className = "",
  disabled = false,
  size = "md",
}) {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const facilityId = facilityIdProp || activeBusiness?.id;

  // Managerial roles that can select any department
  const MANAGERIAL_ROLES = [
    "Admin",
    "admin",
    "Store Owner",
    "Manager",
    "manager",
    "Management",
    "super_admin",
    "superAdmin",
    "Super Administrator",
  ];

  const isManagerial = MANAGERIAL_ROLES.includes(user?.role);
  const isStoreKeeper = user?.role === "Store Keeper";

  // If not managerial or is a restricted Store Keeper, they should use their assigned department
  const isRestricted = !isManagerial || isStoreKeeper;

  // Override the value if the user is restricted and has an assigned department
  const finalValue =
    isRestricted && user?.departmentId ? user.departmentId : value;

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchDepartments = useCallback(() => {
    if (!facilityId) return;
    setLoading(true);
    _fetchApi(
      `/api/get/department?facilityId=${facilityId}`,
      (res) => {
        setLoading(false);
        if (res.results) setDepartments(res.results);
      },
      (err) => {
        setLoading(false);
        console.error("DepartmentSelect: failed to load departments", err);
      }
    );
  }, [facilityId]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const sizeClass = size === "sm" ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm";

  return (
    <select
      value={finalValue}
      onChange={(e) => {
        // Double security: prevent change if restricted
        if (!isRestricted && onChange) {
          onChange(e.target.value);
        }
      }}
      disabled={disabled || loading || isRestricted}
      required={required}
      className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white ${sizeClass} ${className} ${
        isRestricted ? "bg-gray-50 cursor-not-allowed" : ""
      }`}
    >
      {!isRestricted && (
        <option value="all">{loading ? "Loading..." : placeholder}</option>
      )}
      {departments.map((dept) => (
        <option key={dept.id} value={dept.id}>
          {dept.departmentName}
        </option>
      ))}
    </select>
  );
}
