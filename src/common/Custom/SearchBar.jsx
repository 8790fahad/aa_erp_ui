/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React from "react";
import { FaSearch } from "react-icons/fa";
import { useSelector } from "react-redux";
import "./search.css";

export default function SearchBar({
  placeholder = "",
  filterText = "",
  onFilterTextChange = (f) => f,
  _ref,
}) {
  const handleFilterTextChange = (e) => {
    onFilterTextChange(e.target.value);
  };
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  return (
    <div className="form-group has-search d-flex">
      <span className="form-control-feedback" style={{marginTop: 12, marginLeft: 10}}>
        <FaSearch />
      </span>
      <input
        ref={_ref}
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
          placeholder !== "" ? placeholder : "Search..."
        }
      />
    </div>
  );
}
