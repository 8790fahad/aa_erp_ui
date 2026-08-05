/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import { Table } from "antd";

const Datatable = ({ columns, dataSource, Selection }) => {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [Selections, setSelections] = useState(true);
  const [filteredDataSource, setFilteredDataSource] = useState(dataSource);

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const handleSearch = (value) => {
    setSearchText(value);
    const filteredData = dataSource.filter((record) =>
      Object.values(record).some((field) =>
        String(field).toLowerCase().includes(value.toLowerCase())
      )
    );
    setFilteredDataSource(filteredData);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  useEffect(() => {
    setSelections(Selection);
  }, [Selection]);

  return (
    <>
      <div className="table-top-data d-flex px-3 justify-content-between">
        <div className="page-range"></div>
        <div className="serch-global text-right">
          <input
            type="search"
            className="form-control form-control-sm mb-3 w-auto float-end"
            value={searchText}
            placeholder="Search"
            onChange={(e) => handleSearch(e.target.value)}
            aria-controls="DataTables_Table_0"
          />
        </div>
      </div>
      {!Selections ? (
        <div className="table-responsive">
        <Table
          className="table datanew dataTable no-footer"
          columns={columns}
          rowHoverable={false}
          dataSource={filteredDataSource}
          pagination={{
            locale: { items_per_page: "" },
            nextIcon: <span>Next</span>,
            prevIcon: <span>Prev</span>,
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "30"],
          }}
        />
        </div>
      ) : (
        <div className="table-responsive">
        <Table
          className="table datanew dataTable no-footer"
          rowSelection={rowSelection}
          columns={columns}
          rowHoverable={false}
          dataSource={filteredDataSource}
          pagination={{
            locale: { items_per_page: "" },
            nextIcon: <span>Next</span>,
            prevIcon: <span>Prev</span>,
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "30"],
          }}
        />
        </div>
      )}
    </>
  );
};

export default Datatable;
