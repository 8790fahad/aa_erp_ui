/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import { useSelector } from "react-redux";
import { Form } from "react-bootstrap";
import { cn } from "@/lib/utils";

function SelectInput({ 
  label, 
  options, 
  className, 
  container, 
  required = false,
  value,
  onChange,
  ...props
}) {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  const handleValueChange = (event) => {
    if (onChange) {
      onChange(event);
    }
  };

  return (
    <div className={cn("mb-3", container)}>
      {label && (
        <Form.Label className="fw-bold">
          {label} {required && <span className="text-danger">*</span>}
        </Form.Label>
      )}
      <Form.Select 
        value={value} 
        onChange={handleValueChange} 
        className={cn("border-2", className)}
        style={{ borderColor: activeBusiness?.primary_color || 'currentColor' }}
      >
        <option value="">--select--</option>
        {options?.map((item, index) => (
          <option key={index} value={item}>
            {item}
          </option>
        ))}
      </Form.Select>
    </div>
  );
}

export default SelectInput;
