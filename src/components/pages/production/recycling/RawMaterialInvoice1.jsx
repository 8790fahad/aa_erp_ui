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
import { Printer } from "lucide-react";
// import FinalInvoice from "@/components/pages/sales/InvoiceTemp/FinalInvoice";
// import BackButton from "../../../app/components/BackButton";

function RawMaterialInvoice1() {
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
      <CustomCard back header="Material Receive Invoice" id="non-print">
        {!printRec && !preview ? (
          <>
            {/* Header Info */}
            <div className="mb-3 md:mb-1 mt-3 text-center md:!text-left pb-3">
              <h4 className="font-bold">{activeBusiness.business_name}</h4>
              <p className="text-sm text-gray-500">
                Date: {moment(date).format("Do MMMM, YYYY. hh:mm a")}
              </p>
              <p className="text-sm">
                Invoice No: <strong>{receiptNo}</strong>
              </p>
              <p className="text-sm">
                Customer: <strong>{_customerName}</strong>{" "}
                {_customer_id && `(${_customer_id})`}
              </p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto mb-4 md:!mb-1">
              <Table bordered size="sm">
                <tr>
                  <th className="text-center">S/N</th>
                  <th className="text-center">Date</th>
                  <th className="text-center">Item</th>
                  <th className="text-center">Quantity</th>
                  {/* <th className="text-right">Price</th>
                  <th className="text-right">Amount(₦)</th> */}
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
                        {/* <td className="text-right">
                          {formatNumber(item.rate)}
                        </td>
                        <td className="text-right">
                          {formatNumber(item.amount)}
                        </td> */}
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
                        <td className="text-center">
                          {moment(item.receive_date).format("DD MMM YYYY")}
                        </td>
                        <td className="text-center">{item.material_type}</td>
                        <td className="text-center">
                          {formatNumber(item.quantity_in)} {item.unit}
                        </td>
                        {/* <td className="text-right">
                          {formatNumber(item.rate)}
                        </td>
                        <td className="text-right">
                          {formatNumber(
                            parseInt(item.rate) * parseInt(item.quantity_in)
                          )}
                        </td> */}
                      </tr>
                    );
                  }
                })}
              </Table>
            </div>

            {/* Totals Section */}
            {/* <div className="mt-1 pt-2">
              <div className="flex justify-end text-sm space-y-1 flex-col items-end">
                <div>
                  <span className="font-medium mr-3 fw-bold">Total:</span>
                  {formatNumber1(totalAmount)}
                </div>
                <div>
                  <span className="font-medium mr-3 fw-bold">Discount:</span>
                  {formatNumber1(info.discount)}
                </div>
                <div>
                  <span className="font-medium mr-3 fw-bold">Grand Total:</span>
                  {formatNumber1(grandTotal)}
                </div>
                <div>
                  <span className="font-medium mr-3 fw-bold">Balance:</span>
                  {formatNumber1(balance)}
                </div>
              </div>
            </div> */}

            {/* Action Buttons */}
            <div className="mt-5 flex flex-wrap gap-3 justify-center">
              <CustomButton color="primary" className="flex items-center gap-2">
                <MdPrint size={20} /> Pair Bluetooth
              </CustomButton>

              <CustomButton
                color="primary"
                className="flex items-center gap-2"
                onClick={printInvoice}
              >
                <MdPrint size={20} /> Print Invoice
              </CustomButton>

              {/* <CustomButton
                color="primary"
                className="flex items-center gap-2"
                onClick={printBtn}
              >
                <MdPrint size={20} /> Print Receipt
              </CustomButton> */}

              <CustomButton color="primary" className="flex items-center gap-2">
                <AiOutlineShareAlt size={20} /> Share
              </CustomButton>
            </div>
          </>
        ) : printRec ? (
          <div className="d-flex flex-col w-full justify-center">
            <div className="m-2">
              <Button color="danger" onClick={printInvoice} className="px-3">
                Close
              </Button>
            </div>
            <div className="d-flex justify-center">
            {/* {JSON.stringify(txnList)} */}
            <PDFViewer height="700" width="600">
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
        <div className="d-flex justify-content-end mb-3 mt-3 sm:mt-1">
          <Button onClick={() => print()} color="primary" id="print-btn">
            <Printer className="w-4 h-4"/>
          </Button>
        </div>
        <div
          id="print"
          className="h-[40%] w-full sm:w-[60%] flex flex-row flex-wrap"
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
export default RawMaterialInvoice1;
