// components/PDFReceipt.jsx
import { useEffect, useState } from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFViewer,
  Image,
} from "@react-pdf/renderer";
import moment from "moment";
import { _fetchApi } from "@/redux/actions/api";
import { useSelector } from "react-redux";
import useQuery from "@/common/Custom/Hook/useQuery";
import CustomCard from "@/common/Custom/CustomCard2";
import { Button } from "reactstrap";
import { useNavigate } from "react-router-dom";
import { formatNumber1 } from "@/components/router/utilities";
import { numberToWords } from "@/utils/numberUtils";
import { PrinterIcon } from "lucide-react";
import { toWordsconver } from "@/utilities";

// React PDF Styling - Compact Payment Voucher Design
const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    padding: 0,
    margin: 0,
    backgroundColor: "#ffffff",
  },
  container: {
    backgroundColor: "white",
    width: "100%",
    flexDirection: "column",
    border: "1px solid #e5e7eb",
    // borderRadius: 0,
    overflow: "hidden",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    minHeight: "43vh",
    justifyContent: "space-between",
  },
  header: {
    backgroundColor: "white",
    color: "#1f2937",
    padding: 12,
    textAlign: "center",
  },
  businessName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  businessAddress: {
    fontSize: 10,
    color: "#374151",
    marginBottom: 2,
    textAlign: "center",
  },
  businessPhone: {
    fontSize: 10,
    color: "#374151",
    textAlign: "center",
  },
  phoneLabel: {
    fontWeight: "bold",
  },
  voucherTitle: {
    backgroundColor: "#f4f4f4",
    color: "#374151",
    padding: 8,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  mainContent: {
    padding: 15,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  receiptInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    paddingBottom: 8,
    borderBottom: "1px solid #e5e7eb",
  },
  receiptInfoWithTitle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    paddingBottom: 8,
    borderBottom: "1px solid #e5e7eb",
  },
  voucherTitleInline: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 1,
    flex: 1,
    textAlign: "center",
  },
  receiptRef: {
    fontSize: 10,
    // fontWeight: "bold",
    color: "#6b7280",
  },
  receiptDate: {
    fontSize: 10,
    color: "#6b7280",
  },
  payToSection: {
    marginBottom: 4,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 0,
    textTransform: "uppercase",
  },
  supplierName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 2,
  },
  supplierAddress: {
    fontSize: 10,
    color: "#6b7280",
    lineHeight: 1.2,
  },
  transactionAndSignatureRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 0,
    marginBottom: 4,
  },
  transactionDetails: {
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 8,
    flex: 1,
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  description: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  paymentMethod: {
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 8,
  },
  methodLabel: {
    textTransform: "uppercase",
    fontWeight: "bold",
  },
  amountSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
    paddingBottom: 8,
    borderBottom: "1px solid #e2e8f0",
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#374151",
  },
  amountValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#374151",
  },
  amountInWords: {
    backgroundColor: "#fef3c7",
    padding: 10,
    borderRadius: 6,
    marginTop: 5,
    marginBottom: 0,
    border: "1px solid #fde68a",
  },
  amountInWordsText: {
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "center",
    color: "#1f2937",
    lineHeight: 1.2,
  },
  amountInWordsLabel: {
    color: "#374151",
    fontWeight: "bold",
  },
  amountInWordsValue: {
    fontStyle: "italic",
    fontWeight: "bold",
  },
  signatureSection: {
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 8,
    flex: 1,
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
  },
  signatureLeft: {
    width: "100%",
    textAlign: "center",
    marginBottom: 0,
  },
  signatureRight: {
    width: "100%",
    alignItems: "center",
  },
  authorizedBy: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 4,
  },
  signatureImage: {
    width: 80,
    height: 30,
    objectFit: "contain",
  },
  signatureLine: {
    borderTop: "1px solid #9ca3af",
    width: "100%",
    marginTop: 2,
  },
  footer: {
    backgroundColor: "#f3f4f6",
    padding: 8,
    textAlign: "center",
    marginTop: 0,
  },
  footerText: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 2,
  },
  footerBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

// Helper function to validate and clean base64 data
const cleanBase64Data = (base64String) => {
  if (!base64String) return null;

  // Remove data URL prefix if present
  const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, "");

  // Validate base64 format
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(base64Data)) {
    console.warn("Invalid base64 signature data");
    return null;
  }

  // Return the cleaned base64 string
  return `data:image/png;base64,${base64Data}`;
};

// PDF Document Component - Compact Payment Voucher
const PaymentReceiptPDF = ({ receiptData }) => {
  // Clean and validate the signature data
  const cleanedSignature = cleanBase64Data(receiptData?.data?.signature);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.businessName}>
              {receiptData?.business_name}
            </Text>
            <Text style={styles.businessAddress}>
              {receiptData?.business_address}
            </Text>
            <Text style={styles.businessPhone}>
              <Text style={styles.phoneLabel}>Phone:</Text>{" "}
              {receiptData?.business_phone}
            </Text>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            {/* Receipt Info with Title */}
            <View style={styles.receiptInfoWithTitle}>
              <Text style={styles.receiptRef}>
                #{receiptData?.invoice_ref?.toUpperCase()}
              </Text>
              <Text style={styles.voucherTitleInline}>PAYMENT VOUCHER</Text>
              <Text style={styles.receiptDate}>
                {moment(receiptData?.data?.transaction_date).format(
                  "DD MMMM, YYYY"
                )}
              </Text>
            </View>

            {/* Pay To Section */}
            <View style={styles.payToSection}>
              <View
                style={{
                  flexDirection: "column",
                  alignItems: "flex-start",
                  marginBottom: 4,
                }}
              >
                <Text style={styles.sectionLabel}>Pay To:</Text>
                <Text style={styles.supplierName}>
                  {receiptData?.data?.supplier_name}
                </Text>
                {receiptData?.data?.address && (
                  <Text style={styles.supplierAddress}>
                    {receiptData.data.address}
                  </Text>
                )}
              </View>
              <View
                style={{ flexDirection: "column", alignItems: "flex-start" }}
              >
                <Text style={styles.sectionLabel}>Description:</Text>
                <Text style={styles.description}>
                  {receiptData?.data?.description}
                </Text>
                <Text style={styles.paymentMethod}>
                  Payment Method:{" "}
                  <Text style={styles.methodLabel}>
                    {receiptData?.data?.payment_method}
                  </Text>
                </Text>
              </View>
            </View>

            {/* Transaction Details and Signature Section */}
            <View style={styles.transactionAndSignatureRow}>
              {/* Transaction Details */}
              <View style={styles.transactionDetails}>
                <View style={styles.amountSection}>
                  <Text style={styles.amountLabel}>Amount:</Text>
                  <Text style={styles.amountValue}>
                    NGN{formatNumber1(receiptData?.data?.dr)}
                  </Text>
                </View>

                <View style={styles.amountInWords}>
                  <Text style={styles.amountInWordsText}>
                    <Text style={styles.amountInWordsLabel}>
                      AMOUNT IN WORDS:
                    </Text>
                    <Text style={styles.amountInWordsValue}>
                      {" "}
                      {toWordsconver(
                        receiptData?.data?.dr?.toString().split(".")[0]
                      )?.toUpperCase()}
                      NAIRA
                      {receiptData?.data?.dr?.toString().split(".")[1] !== "00"
                        ? ` and ${toWordsconver(
                            receiptData?.data?.dr?.toString().split(".")[1]
                          )} kobo`
                        : null}{" "}
                      ONLY
                    </Text>
                  </Text>
                </View>
              </View>

              {/* Signature Section */}
              <View style={styles.signatureSection}>
                <View style={styles.signatureLeft}>
                  <Text style={styles.authorizedBy}>
                    Authorized By: {receiptData?.data?.firstname}{" "}
                    {receiptData?.data?.lastname}
                  </Text>
                </View>
                <View style={styles.signatureRight}>
                  {cleanedSignature ? (
                    <Image
                      src={cleanedSignature}
                      style={styles.signatureImage}
                      cache={false}
                    />
                  ) : (
                    <View style={styles.signatureImage}>
                      <Text
                        style={{
                          textAlign: "center",
                          color: "#6b7280",
                          fontSize: 8,
                        }}
                      >
                        Signature
                      </Text>
                    </View>
                  )}
                  <View style={styles.signatureLine} />
                </View>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Computer-generated document • Generated:{" "}
              {new Date().toLocaleDateString("en-GB")}
            </Text>
            <Text style={styles.footerBold}>
              {receiptData?.business_name?.toUpperCase()} • CONFIDENTIAL
              DOCUMENT
            </Text>
            <Text style={styles.footerBold}>THIS SOLUTION IS POWERED BY NEXIFOUR LIMITED · NDPC | ISO 27001 | ISO 9001</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

const SupplierPaymentReceipt = () => {
  const [receiptData, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const query = useQuery();
  const invoice_ref = query.get("invoice_ref");
  const supplier_no = query.get("supplier_no");
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const users = useSelector((state) => state.auth.user);
  const navigate = useNavigate();

  useEffect(() => {
    _fetchApi(
      `/api/v1/get-supplier-deposit/${supplier_no}/${activeBusiness.id}/${invoice_ref}/`,
      (data) => {
        if (data.success) {
          setData(data);
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        console.log(err);
      }
    );
  }, [activeBusiness.id, supplier_no, invoice_ref]);

  if (!invoice_ref) {
    return (
      <CustomCard back header={"Supplier Payment Receipt"}>
        <p>No receipt entry ID provided.</p>
      </CustomCard>
    );
  }

  if (loading) {
    return (
      <CustomCard back header={"Supplier Payment Receipt"}>
        <p>Loading receipt...</p>
      </CustomCard>
    );
  }

  return (
    <CustomCard header={"Supplier Payment Receipt"} back>
      <div className="d-flex justify-content-end mb-3">
        <div className="cursor-pointer px-4" onClick={() => window.print()}>
          <PrinterIcon />
        </div>
      </div>
      {receiptData && (
        <div className="min-h-screen bg-gray-100 py-8">
          {/* Print Styles */}{" "}
          <style>
            {`
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  .print-area, .print-area * {
                    visibility: visible;
                  }
                  .print-area {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    background: white !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                  .print-area {
                    padding: 0mm !important;
                    margin: 0 !important;
                    box-shadow: none !important;
                  }
                }
              `}
          </style>
          {/* Receipt Container */}
          <div className="max-w-3xl mx-auto print-area">
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
              {/* Header */}
              <div className="bg-white border-b-2 border-gray-200 p-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      {receiptData?.business_name}
                    </h1>
                    <div className="text-gray-600 text-sm space-y-1">
                      {
                        receiptData?.business_address
                        // ?.split(",")
                        // .map((line, i) => (
                        //   <div key={i}>{line.trim()}</div>
                        // ))
                      }
                      <div className="mt-2">
                        <span className="font-medium">Tel:</span>{" "}
                        {receiptData?.business_phone}
                        <span className="font-medium"> Fax:</span>{" "}
                        {receiptData?.business_phone}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="bg-gray-900 text-white px-4 py-2 rounded mb-2">
                      <div className="text-sm font-medium">PAYMENT VOUCHER</div>
                    </div>
                    <div className="text-xl font-bold text-gray-900">
                      #{receiptData?.invoice_ref.toUpperCase()}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {moment(receiptData.data.transaction_date).format(
                        "DD MMMM, YYYY"
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="p-8">
                {/* Supplier Info */}
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Pay To:
                  </h2>
                  <div className="bg-gray-50 p-4 rounded border">
                    <div className="font-medium text-gray-900">
                      {receiptData.data.supplier_name}
                    </div>
                    {receiptData.data.address && (
                      <div className="text-gray-600 text-sm mt-1">
                        {receiptData.data.address.split(",").map((line, i) => (
                          <div key={i}>{line.trim()}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Transaction Details */}
                <div className="mb-3">
                  <div className="border border-gray-200 rounded overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900">
                        Transaction Details
                      </h3>
                    </div>
                    <div className="pt-4 pl-4 pr-4 pb-2">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 mb-1">
                            {receiptData.data.description}
                          </div>
                          <div className="text-sm text-gray-600">
                            Payment Method:{" "}
                            <span className="uppercase font-medium">
                              {receiptData.data.payment_method}
                            </span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-2xl font-bold text-gray-900">
                            NGN{formatNumber1(receiptData.data.dr)}
                          </div>
                        </div>
                      </div>
                      <div className="mb">
                        <div className="font-medium text-center text-gray-900 text-lg lex-col items-center justify-center">
                          {/* {numberToWords(receiptData.data.cr)} */}
                          <b className="text-gray-700">AMOUNT IN WORD:</b>
                          <i>
                            <b>
                              {" "}
                              {toWordsconver(
                                receiptData?.data.dr.toString().split(".")[0]
                              )?.toUpperCase()}
                              NAIRA
                              {receiptData?.data.dr.toString().split(".")[1] !==
                              "00"
                                ? ` and ${toWordsconver(
                                    receiptData?.data.dr
                                      .toString()
                                      .split(".")[1]
                                  )} kobo`
                                : null}{" "}
                              ONLY
                            </b>
                          </i>
                        </div>
                      </div>
                      <div className="border-t border-gray-200 pt-2">
                        <div className="flex justify-between items-center text-lg font-bold mb-2">
                          <span>Total Amount:</span>
                          <span className="text-gray-900">
                            NGN{formatNumber1(receiptData.data.dr)}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-sm text-gray-600">
                          <span>Outstanding Balance:</span>
                          <span className="font-medium">
                            NGN
                            {formatNumber1(
                              receiptData.outstanding_balance || 0
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Signature Section */}
                <div>
                  <div className="flex justify-center ">
                    <div className="">
                      <div className="text-center">
                        <div className="text-base font-bold text-gray-800 mb-2">
                          Authorized By: {receiptData.data.firstname}{" "}
                          {receiptData.data.lastname}
                        </div>
                        {receiptData.data.signature && (
                          <div className=" ">
                            <img
                              src={receiptData.data.signature}
                              alt="Signature"
                              className="w-full h-10 object-contain"
                            />
                          </div>
                        )}
                        <div className="border-t border-b border-gray-200 mt-1"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className=" pt-">
                  {/* Professional Footer */}
                  <div className="mt-4">
                    <div className="bg-gray-100 rounded p-2 shadow-sm">
                      <div className="text-center space-y-1">
                        <div className="text-xs text-gray-600">
                          Computer-generated document • Generated:{" "}
                          {new Date().toLocaleDateString("en-GB")}
                        </div>
                        <div className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                          {receiptData?.business_name?.toUpperCase()} •
                          CONFIDENTIAL DOCUMENT • AUTHORIZED PERSONNEL ONLY
                        </div>
                        <div className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                          THIS SOLUTION IS POWERED BY NEXIFOUR LIMITED
                          GROUP · NDPC | ISO 27001 | ISO 9001
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

    </CustomCard>
  );
};

export default SupplierPaymentReceipt;
