/* eslint-disable no-unused-vars */
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
import Loading from "@/common/Custom/Loading";
import { _fetchApi } from "@/redux/actions/api";
import FinalInvoice from "../../report/FinalInvoice";
import SalesReceipt from "../../report/SalesReceipt";
import { Printer, X } from "lucide-react";

function CollectionInvoice() {
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
        console.error(err);
        setLoading(false);
      }
    );
  }, [receiptNo, facilityId]);

  const info = txnList.length ? txnList[txnList.length - 1] : {};

  const totalAmount = txnList.reduce(
    (a, b) => a + parseFloat(b.rate * b.quantity_out),
    0
  );

  const amountPaid = 0;
  const grandTotal =
    parseFloat(totalAmount) - (info.discount ? parseFloat(info.discount) : 0);
  const balance = parseFloat(grandTotal) - amountPaid;
  const totalQty = txnList.reduce((a, b) => a + b.quantity_out, 0);

  const _customerName =
    customerName && customerName !== "undefined"
      ? customerName
      : "Walk - In Customer";

  const _customer_id =
    customer_id && customer_id !== "undefined" ? customer_id : "";

  const printBtn = () => setPreview((p) => !p);
  const printInvoice = () => setPrintRec((p) => !p);

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
              @page { size: 60mm 40mm; margin: 0; }
              body { margin: 0; padding: 0; }
              .printable-area { width: 100%; height: 100%; page-break-after: always; }
            }
            body { font-family: sans-serif; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div id="print">${printContents}</div>
        </body>
      </html>
    `);
    popupWindow.document.close();
  };

  return (
    <Container>
      <CustomCard back header="Collection Invoice" id="non-print">
        {!printRec && !preview ? (
          <>
            {/* Header Info */}
            <div className="mb-3 mt-3 text-center md:!text-left pb-3">
              <h4 className="font-bold">{activeBusiness.business_name}</h4>
              <p className="text-sm text-gray-500">
                Date: {moment(date || info.createdAt).format("Do MMMM, YYYY. hh:mm a")}
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
            <div className="overflow-x-auto mb-4">
              <Table bordered size="sm">
                <thead>
                  <tr>
                    <th className="text-center">S/N</th>
                    <th className="text-left">Item</th>
                    <th className="text-center">Quantity</th>
                    {page ? (
                      <>
                        <th className="text-right">Price</th>
                        <th className="text-right">Amount</th>
                        <th className="text-center">Status</th>
                      </>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {loading && <Loading />}
                  {txnList.map((item, i) => (
                    <tr key={i}>
                      <td className="text-center">{i + 1}</td>
                      <td className="text-left">
                        {item.material_type} - {item.type}
                      </td>
                      <td className="text-center">
                        {formatNumber(item.quantity_out)}
                      </td>
                      {page ? (
                        <>
                          <td className="text-right">{formatNumber(item.rate)}</td>
                          <td className="text-right">{formatNumber(item.amount)}</td>
                          <td>{item.type}</td>
                        </>
                      ) : null}
                    </tr>
                  ))}
                  <tr>
                    <td></td>
                    <td className="text-right font-bold">Total</td>
                    <td className="text-center">{formatNumber(totalQty)}</td>
                  </tr>
                </tbody>
              </Table>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex flex-wrap gap-3 justify-center">
              <CustomButton color="primary" className="flex items-center gap-2">
                <MdPrint size={20} /> Pair Bluetooth
              </CustomButton>
              <CustomButton color="primary" onClick={printInvoice} className="flex items-center gap-2">
                <MdPrint size={20} /> Print Invoice
              </CustomButton>
              <CustomButton color="primary" onClick={printBtn} className="flex items-center gap-2">
                <MdPrint size={20} /> Print Receipt
              </CustomButton>
              <CustomButton color="primary" className="flex items-center gap-2">
                <AiOutlineShareAlt size={20} /> Share
              </CustomButton>
            </div>
          </>
        ) : printRec ? (
          <div className="flex flex-col w-full justify-center">
            <div className="m-2">
              <Button color="danger" onClick={printInvoice} className="rounded-full">
                <span className="hidden md:inline">Close</span>
                <X className="inline md:hidden"/>
              </Button>
            </div>
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
        ) : preview ? (
          <div className="flex flex-col w-full justify-center">
            <div className="m-2">
              <Button color="danger" onClick={printBtn} className="rounded-full">
                <span className="hidden md:inline">Close</span>
                <X className="inline md:hidden"/>
              </Button>
            </div>
            <PDFViewer height="300" width="350">
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

        {/* Print Button */}
        <div className="flex justify-end mb-3 mt-3">
          <Button onClick={print} color="primary">
            <Printer className="w-4 h-4" />
          </Button>
        </div>

        {/* Print Area */}
        <div id="print" className="w-full sm:w-[60%] flex flex-wrap">
          {txnList.map((item, i) => (
            <div
              key={i}
              className="printable-area mx-auto mt-3 px-4 py-3 bg-white rounded-lg shadow-lg border border-gray-300 w-full"
            >
              <div>
                <span className="text-gray-600">
                  {moment(item.date).format("DD/MM/YYYY")}
                </span>
              </div>
              <span className="text-center">{item.entrie_id}</span>
              <div className="flex items-center justify-between">
                <p className="font-semibold inline">
                  {_customerName} {_customer_id && `(${_customer_id})`}
                </p>
              </div>
              <div className="mt-3">
                <div className="flex justify-between border-t border-b py-2 text-sm">
                  <div>
                    <strong>Material Type:</strong>
                    <span className="text-gray-600"> {item.material_type} - {item.type}</span>
                  </div>
                  <div>
                    <strong>Quantity:</strong>
                    <span className="text-gray-600"> {formatNumber(item.quantity_out)} (KG)</span>
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

export default CollectionInvoice;
