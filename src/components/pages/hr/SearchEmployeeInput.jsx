/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import CustomTypeahead from "@/common/Custom/Customtypeahead";

export default function SearchEmployeeInput(props) {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId || "";
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchEmployees = useCallback(async () => {
    if (!facilityId) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/hr/employees?facilityId=${facilityId}`
      );
      const data = await response.json();

      if (data.success) {
        // The API returns data.data.employees for the employees array
        const employeeData = Array.isArray(data.data?.employees) ? data.data.employees : [];
        setEmployees(employeeData);
      } else {
        console.error("Error fetching employees:", data.message);
        setEmployees([]);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Filter valid employees - ensure employees is an array before filtering
  const validEmployees = Array.isArray(employees) 
    ? employees.filter(
        (emp) => emp && typeof emp.firstName === "string" && typeof emp.lastName === "string"
      )
    : [];
  

  return (
    <>
      <CustomTypeahead
        {...props}
        options={validEmployees}
        labelKey={(option) => `${option.firstName} ${option.lastName} - ${option.employeeId}`}
        isLoading={loading}
        placeholder="Search employees..."
        selected={props.value ? [props.value] : []}
        onInputChange={(v) => {
          if (v.length) {
            props.onInputChange && props.onInputChange(v);
          }
        }}
        edge={props.edge}
        onChange={(v) => {
          if (v.length > 0) {
            props.onChange && props.onChange(v[0]);
          } else {
            // Handle clearing - when v is empty array
            props.onChange && props.onChange(null);
          }
        }}
      />
    </>
  );
}