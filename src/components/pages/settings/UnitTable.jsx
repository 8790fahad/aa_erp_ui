
import { Table } from "reactstrap";
export default function UnitTable({ data }) {
  return (
    <>
      {/* {JSON.stringify(data)} */}
      <Table bordered size='sm' striped>
        <thead>
          <tr>
            <th>S/N</th>
            <th>Unit Name</th>
            <th>Measure</th>
            <th>Quantity In Unit</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{item.unitName}</td>
              <td>{item.measure}</td>
              <td>{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
