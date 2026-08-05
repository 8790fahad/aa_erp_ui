import { useEffect, useState } from "react";

import useQuery from "@/hooks/useQuery";
import { Button, Container, Table } from "reactstrap";
import { AiOutlineShareAlt } from "react-icons/ai";
import CustomButton from "@/common/Custom/CustomButton";
import { useSelector } from "react-redux";
import { formatNumber } from "@/utilities";
import moment from "moment";
import CustomCard from "@/common/Custom/CustomCard2";
import { MdPrint } from "react-icons/md";
import { PDFViewer } from "@react-pdf/renderer";
// import SalesReceipt from "@/pdf-template/sales-receipt";
// import { useRequestDevice } from "react-web-bluetooth";
import Loading from "@/common/Custom/Loading";
import { _fetchApi } from "@/redux/actions/api";
// import Barcode from "react-barcode";
import { formatNumber1 } from "@/components/router/utilities";
import SalesReceipt from "../../report/SalesReceipt";
import FinalInvoice from "../../report/FinalInvoice";
// import FinalInvoice from "@/components/pages/sales/InvoiceTemp/FinalInvoice";
// import BackButton from "../../../app/components/BackButton";

function RawMaterialInvoice() {
  const query = useQuery();
  const receiptNo = query.get("receiptNo");
  const customerName = query.get("customerName");
  const customer_id = query.get("customer_id");
  const date = query.get("date");
  const page = query.get("page");
  const [txnList, setTxnList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [printRec, setPrintRec] = useState(false);

  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const users = useSelector((state) => state.auth.user);
  const facilityId = useSelector((state) => state.auth.activeBusiness.id);

  useEffect(() => {
    setLoading(true);

    _fetchApi(
      `/v1/materials/get/${receiptNo}/${facilityId}`,
      (data) => {
        if (data && data.results) {
          setTxnList(data.results);
          setLoading(false);
        }
      },
      (err) => {
        console.log(err);
        setLoading(false);
      }
    );
  }, [receiptNo, facilityId]);

  let info = txnList.length ? txnList[txnList.length - 1] : {};

  let totalAmount = txnList.reduce(
    (a, b) => a + parseFloat(b.rate * b.quantity_in),
    0
  );
  let amountPaid = txnList.reduce((a, b) => a + parseFloat(b.amount), 0);
  let grandTotal =
    parseFloat(totalAmount) - (info.discount ? parseFloat(info.discount) : 0);
  let balance = parseFloat(grandTotal) - amountPaid;
  const style = {
    borderRightStyle: "hidden",
    borderLeftStyle: "hidden",
    borderBottomStyle: "hidden",
  };

  const printBtn = () => {
    setPreview((p) => !p);
  };

  const printInvoice = () => {
    setPrintRec((p) => !p);
    // alert("DDDDDDDD");
  };

  // console.error({ info });
  let _customerName =
    customerName !== "undefined" && customerName
      ? customerName
      : "Walk - In Customer";
  let _customer_id =
    customer_id !== "undefined" && customer_id ? customer_id : "";
  const print = () => {
    const printContents = document.getElementById("print").innerHTML;

    const popupWindow = window.open("", "_blank", "width=600,height=400");

    popupWindow.document.open();
    popupWindow.document.write(`
    <html>
      <head>
        <title>Print Label</title>
        <style>
          @media print {
            @page {
              size: 60mm 40mm;
              margin: 0;
            }

            body {
              margin: 0;
              padding: 0;
            }

            .printable-area {
              width: 100%;
              height: 100%;
              page-break-after: always;
              box-sizing: border-box;
            }
          }

          body {
            font-family: sans-serif;
          }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        <div id="print">
          ${printContents}
        </div>
      </body>
    </html>
  `);
    popupWindow.document.close();
  };

  return (
    <Container>
      {/* {JSON.stringify(txnList)} */}
      {/* {JSON.stringify(activeBusiness)} */}
      <CustomCard back header="Raw Material Invoice" id="non-print">
        {!printRec && !preview ? (
          <>
            <center>
              <h4>{activeBusiness.business_name}</h4>
            </center>
            <div>Date: {moment(date).format("Do MMMM, YYYY. hh:mm a")}</div>
            <div>Invoice No: {receiptNo}</div>
            <div>
              Customer Name: {_customerName} ({_customer_id})
            </div>
            {/* <div>Payment Method: {info.modeOfPayment || "Cash"}</div> */}
            {/* <div>Operator: {users.username}</div> */}
            {/* {JSON.stringify({ info, activeBusiness })} */}
            <Table bordered size="sm">
              <tr>
                <th className="text-center">S/N</th>
                <th className="text-center">Date</th>
                <th className="text-center">Item</th>
                <th className="text-center">Quantity</th>
                <th className="text-right">Price</th>
                <th className="text-right">Amount(₦)</th>
                {page ? <th className="text-center">Status</th> : null}
              </tr>
              {loading && <Loading />}
              {txnList.map((item, i) => {
                if (page) {
                  // if (item.type === "return") {
                  //   return null;
                  // } else {
                  return (
                    <tr key={i}>
                      <td className="text-center">{i + 1}</td>
                      <td className="text-center">{item.receive_date}</td>
                      <td className="text-center">{item.material_type}</td>
                      <td className="text-center">
                        {formatNumber(item.quantity)}
                      </td>
                      <td className="text-right">{formatNumber(item.rate)}</td>
                      <td className="text-right">
                        {formatNumber(item.amount)}
                      </td>
                      <td>{item.type}</td>
                    </tr>
                  );
                  // }
                } else {
                  return (
                    <tr key={i}>
                      <td className="text-center" style={{ border: "none" }}>
                        {i + 1}
                      </td>
                      <td className="text-center">{moment(item.receive_date).format("DD MMM YYYY")}</td>
                      <td className="text-center">{item.material_type}</td>
                      <td className="text-center">
                        {formatNumber(item.quantity_in)} {item.unit}
                      </td>
                      <td className="text-right">{formatNumber(item.rate)}</td>
                      <td className="text-right">
                        {formatNumber(
                          parseInt(item.rate) * parseInt(item.quantity_in)
                        )}
                      </td>
                    </tr>
                  );
                }
              })}

              <tr>
                <th colSpan={4} className="text-right" style={style}>
                  Total
                </th>
                <th className="text-right" style={style}>
                  {formatNumber1(totalAmount)}
                </th>
              </tr>
              <tr>
                <th colSpan={4} className="text-right" style={style}>
                  Discount
                </th>
                <th className="text-right" style={style}>
                  {formatNumber1(info.discount)}
                </th>
              </tr>
              <tr>
                <th colSpan={4} className="text-right" style={style}>
                  Grand Total
                </th>
                <th className="text-right" style={style}>
                  {formatNumber1(grandTotal)}
                </th>
              </tr>
              {/* <tr>
                <th colSpan={4} className="text-right" style={style}>
                  Amount Paid
                </th>
                <th className="text-right" style={style}>
                  {formatNumber(totalAmount)}
                </th>
              </tr> */}
              <tr>
                <th colSpan={4} className="text-right" style={style}>
                  Balance
                </th>
                <th className="text-right" style={style}>
                  {formatNumber1(balance)}
                </th>
              </tr>
            </Table>
            <center>
              <CustomButton color="primary" className="mr-2 col-md-2">
                <span className="flex">
                  <MdPrint size={20} className="mr-2" />
                  Pair bluetooth
                </span>
              </CustomButton>

              <CustomButton
                color="primary"
                className="mr-2 col-md-2"
                onClick={printInvoice}
              >
                <span className="flex">
                  <MdPrint size={20} className="mr-2" />
                  Print Invoice
                </span>
              </CustomButton>

              <CustomButton
                color="primary"
                className="mr-2 col-md-2"
                onClick={() => {
                  printBtn();
                }}
              >
                <span className="flex">
                  <MdPrint size={20} className="mr-2" />
                  Print Receipt
                </span>
              </CustomButton>
              <CustomButton color="primary" className="col-md-2">
                <span className="flex">
                  <AiOutlineShareAlt size={20} className="mr-2" />
                  Share
                </span>
              </CustomButton>
            </center>
          </>
        ) : printRec ? (
          <div className="d-flex">
            <div className="m-2">
              <Button color="danger" onClick={printInvoice} className="px-3">
                Close
              </Button>
            </div>
            <PDFViewer height="700" width="1100">
              <FinalInvoice
                data={txnList}
                total={totalAmount}
                grandTotal={grandTotal}
                balance={balance}
                info={info}
                page={page}
                receiptNo={receiptNo}
                busInfo={activeBusiness}
                users={users}
                _customerName={_customerName}
              />
            </PDFViewer>
          </div>
        ) : preview ? (
          <div className="d-flex pb-5 justify-content-center">
            <div className="m-2">
              <Button color="danger" onClick={printBtn} className="px-5">
                Close
              </Button>
            </div>
            <PDFViewer height="300" width="300">
              <SalesReceipt
                data={txnList}
                total={totalAmount}
                grandTotal={grandTotal}
                balance={balance}
                info={info}
                page={page}
                receiptNo={receiptNo}
                busInfo={activeBusiness}
                users={users}
                _customerName={_customerName}
              />
            </PDFViewer>
          </div>
        ) : null}

        <div className="d-flex justify-content-end mb-3">
          <Button onClick={() => print()} color="primary" id="print-btn">
            Print
          </Button>
        </div>
        {/* <div
          id="print"
          style={{
            width: "60mm", // width = landscape width
            display: "flex",
            flexDirection: "column",
          }}
        >
          {txnList.map((item, i) => (
            <div
              key={i}
              className="printable-area"
              style={{
                width: "60mm",
                height: "40mm", // height = landscape height
                padding: "2mm",
                boxSizing: "border-box",
                pageBreakAfter: "always",
                backgroundColor: "white",
                border: "1px dashed #000",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <strong>Date:</strong>{" "}
                  {moment(item.date).format("DD/MM/YYYY")}
                </div>
                <div style={{ textAlign: "center" }}>
                  <Barcode
                    value={item.entrie_id}
                    width={1}
                    height={30}
                    displayValue={false}
                  />
                </div>
              </div>
              <div style={{ fontSize: "8px" }}>
                <strong>Entry No:</strong>
                {item.entrie_id}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "9px",
                }}
              >
                <div>
                  <strong>Customer:</strong>
                  <br />
                  <span style={{ fontWeight: "bold", fontSize: "10px" }}>
                    {customerName} ({customer_id})
                  </span>
                </div>
              </div>

              <div style={{ fontSize: "9px", marginTop: "4px" }}>
                <div>
                  <strong>Material:</strong> {item.material_type}
                </div>
                <div className="font-bold text-lg">
                  <strong>Qty:</strong> {formatNumber1(item.quantity_in)}{" "}
                  {item.unit}
                </div>
              </div>
            </div>
          ))}
        </div> */}

        <div
          id="print"
          style={{
            height: "40%",
            width: "60%",
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
          }}
        >
          {txnList.length > 0 &&
            txnList.map((item, i) => (
              <div
                key={i}
                className="printable-area w-full mx-auto mt-3 px-4 py-3 bg-white rounded-lg shadow-lg border border-gray-300 w-full"
              >
                <div className="">
                  <br />
                  <span className="text-gray-600">
                    {moment(item.date).format("DD/MM/YYYY")}
                  </span>
                </div>
                <span className="text- text-center">{item.entrie_id}</span>
                <div className="flex items-center justify-between">
                  <span>
                    {/* <strong>Customer Name:</strong> */}

                    <p className=" font-semibold inline">
                      {customerName} ({customer_id})
                    </p>
                  </span>
                  {/* <div className="flex flex-col items-center text-gray-600">
                    <Barcode
                      value={item.entrie_id}
                      width={1}
                      height={20}
                      displayValue={false}
                    />
                    <span className="text-[8px] text-center">
                      {item.entrie_id}
                    </span>
                  </div> */}
                </div>

                <div className="mt-3">
                  <div className="flex justify-between border-t border-b py-2 text-sm">
                    <div className="flex flex-col">
                      <strong>Material Type:</strong>
                      <span className="text-gray-600">
                        {item.material_type}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <strong>Quantity:</strong>
                      <span className="text-gray-600">
                        {formatNumber1(item.quantity_in)} {item.unit}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </CustomCard>
    </Container>
  );
}
export default RawMaterialInvoice;
// 221242249
