/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React from "react";
import { FaSearch } from "react-icons/fa";
import { useSelector } from "react-redux";
import "./custom.css";

export default function SearchBar({
  placeholder = "",
  filterText = "",
  onFilterTextChange = (f) => f,
  inputRef,
}) {
  const handleFilterTextChange = (e) => {
    onFilterTextChange(e.target.value);
  };
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  return (
    <div className="form-group has-search d-flex align-items-center">
      <span className="form-control-feedback d-flex align-items-center justify-content-center">
        <FaSearch />
      </span>
      <input
        ref={inputRef}
        name="filterText"
        value={filterText}
        onChange={handleFilterTextChange}
        type="text"
        className="form-control"
        style={{
          borderWidth: 2,
          borderColor: activeBusiness?.primary_color,
        }}
        placeholder={
          placeholder !== "" ? placeholder : "Search for a patient..."
        }
      />
    </div>
  );
}
