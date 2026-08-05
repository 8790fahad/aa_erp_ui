import React from "react";
import { Table } from "react-bootstrap";
import { checkStrEmpty } from "utils/index";
import { themeClass } from "../../variables";

function CustomTable(props) {
  const { fields = [], data = [], className = "" } = props;
  return (
    <Table className={`${themeClass} ${className}`} {...props} bordered>
      <thead>
        <tr>
          {fields.map((_item, _idx) => (
            <th key={_idx} className="text-center">
              {_item.title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((item, idx) => (
          <tr key={idx}>
            {fields.map((_item, _idx) => {
              let val = item[_item.value] || "";
              let value_alt = (_item.value_alt && item[_item.value_alt]) || "";
              if (_item.custom) {
                return (
                  <td key={_idx} className={_item.className}>
                    {_item.component(item)}
                  </td>
                );
              } else {
                return (
                  <td key={_idx} className={_item.className}>
                    {checkStrEmpty(val) ? value_alt : val}
                  </td>
                );
              }
            })}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default CustomTable;
