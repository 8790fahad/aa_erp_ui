import { PDFViewer } from "@react-pdf/renderer";
import moment from "moment";
import  { useEffect, useState, useCallback } from "react";
import { AiTwotonePrinter } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import CustomCard from "@/common/Custom/CustomCard2";
import { useSelector } from "react-redux";
import { _postApi } from "@/redux/actions/api";
import { Button, Table } from "reactstrap/lib";
import { formatNumber1, formatNaira } from "@/components/router/utilities";
import useQuery from "@/hooks/useQuery";
import FinalInvoice from "./FinalInvoice";

export default function ViewInvoice() {
  const [data, setData] = useState([]);
  const query = useQuery();
  const invoice_no = query.get("invoice_no");
  const [preview, setPreview] = useState(false);
  const history = useNavigate();
  const users = useSelector((state) => state.auth.user);
  const user = useSelector((state) => state.auth.activeBusiness);

  const getData = useCallback(() => {
    _postApi(
      "/customer/get-invoice",
      { query_type: "select_one", invoice_no },
      (data) => {
        setData(data.results);
      },
      (err) => {
        console.log(err);
      }
    );
  }, [invoice_no]);

  useEffect(() => {
    getData();
  }, [getData]);

  let details = data && data.length ? data[0] : {};
  const total = data.reduce((it, i) => it + parseFloat(i.amount), 0);
  return (
    <div>
      {!preview ? (
        <CustomCard
          back
          header="Invoice Details"
        //   headerRight={`Invoice No: ${details.invoice_no}`}
        >
          {/* {JSON.stringify(total)} */}
          <div className="flex justify-end">
            <Button
              color="primary"
              className="px-3 flex justify-center items-center"
              onClick={() => setPreview(true)}
            >
              <AiTwotonePrinter className="mr-2" />
              Print
            </Button>
          </div>
          <center>
            <h5>Invoice Number: {details.invoice_no}</h5>
          </center>
          <div className="d-flex justify-content-between">
            <div>
              Customer Name: <h5>{details.name}</h5>
            </div>
            <div>
              Invoice type: <h5>{details.type}</h5>
            </div>
            <div>
              Phone No: <h5>{details.phone}</h5>
            </div>
          </div>
          <Table bordered>
            <thead>
              <tr>
                <th>S/N</th>
                <th>Date</th>
                <th>Description</th>
                <th>Cost</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>{moment(item.created_at).format("DD-MM-YYYY")}</td>
                  <td>{item.item_name}</td>
                  <td>{formatNumber1(item.cost)}</td>
                  <td>{formatNumber1(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CustomCard>
      ) : (
        <div className="d-flex">
          <div className="m-2">
            <Button
              color="danger"
              onClick={() => {
                // history("/app/report/invoice-list");
                setPreview(false);
              }}
            >
              Close
            </Button>
          </div>
          <PDFViewer height="700" width="1100">
            <FinalInvoice
              data={data}
              info={details}
              //  page={page}
              receiptNo={details.invoice_no}
              busInfo={user}
              users={users}
              _customerName={details.name}
              total={total}
            />
          </PDFViewer>
        </div>
      )}
    </div>
  );
}
