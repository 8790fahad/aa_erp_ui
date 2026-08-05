import { useEffect, useState } from "react";
import { searchTransactionByReceipt } from "@/redux/actions/transactions";
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
// import FinalInvoice from "@/components/pages/sales/InvoiceTemp/FinalInvoice";
// import BackButton from "../../../app/components/BackButton";

function PostSalePage() {
  const query = useQuery();
  const receiptNo = query.get("transaction_id");
  const customerName = query.get("customerName");
  const page = query.get("page");
  const [txnList, setTxnList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [printRec, setPrintRec] = useState(false);

  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const users = useSelector((state) => state.auth.user);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      searchTransactionByReceipt(
        receiptNo,
        (data) => {
          // alert(JSON.stringify(data));
          setTxnList(data);
          setLoading(false);
        },
        () => {
          setLoading(false);
        }
      );
    }, 1500);
  }, [receiptNo]);

  let info = txnList.length ? txnList[txnList.length - 1] : {};

  let totalAmount = txnList.reduce(
    (a, b) => a + parseFloat(b.selling_price * b.qty_out),
    0
  );
  let amountPaid = txnList.reduce(
    (a, b) => a + parseFloat(b.amount),
    0
  );
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
  return (
    <Container>
      {/* {JSON.stringify(txnList)} */}
      {/* {JSON.stringify(activeBusiness)} */}
      <CustomCard back header="Transaction Invoice">
        {!printRec && !preview ? (
          <>
            <center>
              <h4>{activeBusiness.business_name}</h4>
            </center>
            <div>Date: {moment(info.createdAt).format("DD/MM/YYYY HH:mm")}</div>
            <div>Invoice No: {receiptNo}</div>
            <div>Customer Name: {_customerName}</div>
            <div>Payment Method: {info.modeOfPayment || "Cash"}</div>
            <div>Operator: {users.username}</div>
            {/* {JSON.stringify({ info, activeBusiness })} */}
            <Table bordered size="sm">
              <tr>
                <th className="text-center">S/N</th>
                <th className="text-center">Item</th>
                <th className="text-center">Quantity</th>
                <th className="text-center">Price</th>
                <th className="text-center">Amount(₦)</th>
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
                      <td className="text-center">{item.item_name}</td>
                      <td className="text-center">
                        {formatNumber(item.qty_out)}
                      </td>
                      <td className="text-right">
                        {formatNumber(item.selling_price)}
                      </td>
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
                      <td className="text-center">{item.item_name}</td>
                      <td className="text-center">
                        {formatNumber(item.qty_out)}
                      </td>
                      <td className="text-right">
                        {formatNumber(item.selling_price)}
                      </td>
                      <td className="text-right">
                        {formatNumber(
                          parseInt(item.selling_price) * parseInt(item.qty_out)
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
                  {formatNumber(totalAmount)}
                </th>
              </tr>
              <tr>
                <th colSpan={4} className="text-right" style={style}>
                  Discount
                </th>
                <th className="text-right" style={style}>
                  {formatNumber(info.discount)}
                </th>
              </tr>
              <tr>
                <th colSpan={4} className="text-right" style={style}>
                  Grand Total
                </th>
                <th className="text-right" style={style}>
                  {formatNumber(grandTotal)}
                </th>
              </tr>
              <tr>
                <th colSpan={4} className="text-right" style={style}>
                  Amount Paid
                </th>
                <th className="text-right" style={style}>
                  {formatNumber(totalAmount)}
                </th>
              </tr>
              <tr>
                <th colSpan={4} className="text-right" style={style}>
                  Balance
                </th>
                <th className="text-right" style={style}>
                  {formatNumber(balance)}
                </th>
              </tr>
            </Table>
            <center>
              <CustomButton
                color="primary"
                className="mr-2 col-md-2"
                // onClick={() => {
                //   onClick();
                // }}
              >
                <MdPrint size={20} className="mr-2" />
                Pair bluetooth
              </CustomButton>

              <CustomButton
                color="primary"
                className="mr-2 col-md-2"
                onClick={printInvoice}
              >
                <MdPrint size={20} className="mr-2" />
                Print Invoice
              </CustomButton>

              <CustomButton
                color="primary"
                className="mr-2 col-md-2"
                onClick={() => {
                  printBtn();
                }}
              >
                <MdPrint size={20} className="mr-2" />
                Print Receipt
              </CustomButton>
              {/* {device && <span>{device.name}</span>} */}
              <CustomButton color="primary" className="col-md-2">
                <AiOutlineShareAlt size={20} className="mr-2" />
                Share
              </CustomButton>
            </center>
          </>
        ) : printRec ? (
          <div className="d-flex">
            {/* <h1>Hello World</h1> */}
            <div className="m-2">
              <Button color="danger" onClick={printInvoice} className="px-3">
                Close
              </Button>
            </div>
            <PDFViewer height="700" width="1100">
              {/* <FinalInvoice
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
              /> */}
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
              {/* <SalesReceipt
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
              /> */}
            </PDFViewer>
          </div>
        ) : null}
      </CustomCard>
    </Container>
  );
}
export default PostSalePage;
// 221242249
