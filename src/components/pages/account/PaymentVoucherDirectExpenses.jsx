import React, { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Container } from "reactstrap";
import {
  Document,
  Page,
  PDFViewer,
  StyleSheet,
  Text,
  View,
  Font,
  Image,
} from "@react-pdf/renderer";
import { _fetchApi } from "@/redux/actions/api";
import useQuery from "@/common/Custom/Hook/useQuery";
import { toWordsconver } from "@/utilities";
import CustomCard from "@/common/Custom/CustomCard2";
import DM_SANS_NORMAL from "../../../assets/DM_Sans/DM_Sans/static/DMSans_24pt-SemiBold.ttf";
import DM_SANS_BOLD from "../../../assets/DM_Sans/DM_Sans/static/DMSans_24pt-Bold.ttf";
import DM_SANS_ITALIC from "../../../assets/DM_Sans/DM_Sans/static/DMSans-Italic.ttf";
import { formatNumber1 } from "@/components/router/utilities";

Font.register({
  family: "DM_SANS",
  fonts: [
    { src: DM_SANS_NORMAL, fontWeight: 700 },
    { src: DM_SANS_BOLD, fontStyle: "bold" },
    { src: DM_SANS_ITALIC, fontStyle: "italic" },
  ],
});

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 0,
    fontSize: 10,
    fontFamily: "Helvetica",
    position: "relative",
  },

  // Header with gradient effect (simulated with colors)
  headerContainer: {
    backgroundColor: "#1e40af",
    padding: 20,
    color: "white",
    marginBottom: 0,
    position: "relative",
  },

  // Watermark
  watermark: {
    position: "absolute",
    top: "30%",
    left: "25%",
    fontSize: 48,
    color: "#f3f4f6",
    opacity: 0.1,
    transform: "rotate(-45deg)",
    zIndex: -1,
  },

  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    position: "relative",
    zIndex: 1,
  },

  companySection: {
    flex: 1,
  },

  companyName: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 3,
    color: "white",
  },

  companyTagline: {
    fontSize: 9,
    color: "#bfdbfe",
    fontStyle: "italic",
  },

  voucherNumberBox: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    padding: 10,
    borderRadius: 6,
    textAlign: "center",
    minWidth: 100,
  },

  voucherNumberLabel: {
    fontSize: 8,
    color: "#bfdbfe",
    marginBottom: 2,
  },

  voucherNumber: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },

  // Info Bar
  infoBar: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderBottom: "2 solid #e5e7eb",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  infoItem: {
    flex: 1,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },

  infoIcon: {
    width: 8,
    height: 8,
    backgroundColor: "#3b82f6",
    borderRadius: 4,
    marginRight: 6,
  },

  infoContent: {
    alignItems: "center",
  },

  infoLabel: {
    fontSize: 7,
    color: "#6b7280",
    marginBottom: 1,
    textAlign: "center",
  },

  infoValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1f2937",
    textAlign: "center",
  },

  // Content Container
  contentContainer: {
    padding: "0 20 100 20", 
    position: "relative",
  },

  // Amount Section
  amountSection: {
    backgroundColor: "#ecfdf5",
    border: "2 solid #10b981",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    textAlign: "center",
  },

  amountLabel: {
    fontSize: 8,
    color: "#374151",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  amountNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#059669",
    marginBottom: 8,
  },

  amountWordsContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    padding: 8,
    borderRadius: 4,
    border: "1 solid #6ee7b7",
  },

  amountWords: {
    fontSize: 9,
    color: "#047857",
    fontWeight: "bold",
    textAlign: "center",
    fontStyle: "italic",
  },

  // Parties Section
  partiesContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },

  partyBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    border: "1 solid #e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
  },

  partyBoxSource: {
    backgroundColor: "#eff6ff",
    border: "1 solid #bfdbfe",
  },

  partyBoxBeneficiary: {
    backgroundColor: "#f0fdf4",
    border: "1 solid #bbf7d0",
  },

  partyHeader: {
    padding: 8,
    textAlign: "center",
  },

  partyHeaderSource: {
    backgroundColor: "#dbeafe",
  },

  partyHeaderBeneficiary: {
    backgroundColor: "#dcfce7",
  },

  partyTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#374151",
    textAlign: "center",
  },

  partyTitleSource: {
    color: "#1e40af",
  },

  partyTitleBeneficiary: {
    color: "#166534",
  },

  partyContent: {
    padding: 10,
  },

  // Seal styles
  sealContainer: {
    position: 'absolute',
    left: '50%',
    bottom: 120,
    width: 80,
    height: 80,
    zIndex: 10,
    marginLeft: -40,
  },

  sealImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },

  partyField: {
    marginBottom: 6,
  },

  fieldLabel: {
    fontSize: 7,
    color: "#6b7280",
    fontWeight: "bold",
    marginBottom: 2,
  },

  fieldValue: {
    fontSize: 8,
    color: "#1f2937",
    backgroundColor: "white",
    padding: 3,
    borderRadius: 2,
    border: "0.5 solid #e5e7eb",
  },

  fieldValueMono: {
    fontSize: 8,
    color: "#1f2937",
    backgroundColor: "white",
    padding: 3,
    borderRadius: 2,
    border: "0.5 solid #e5e7eb",
    fontFamily: "Courier",
  },

  // Payment Details Section
  paymentDetailsSection: {
    backgroundColor: "#f9fafb",
    border: "1 solid #e5e7eb",
    borderRadius: 8,
    marginBottom: 16,
    overflow: "hidden",
  },

  sectionHeader: {
    backgroundColor: "#e5e7eb",
    padding: 8,
  },

  sectionTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#374151",
    textAlign: "center",
    textTransform: "uppercase",
  },

  sectionContent: {
    padding: 10,
  },

  purposeLabel: {
    fontSize: 7,
    color: "#6b7280",
    fontWeight: "bold",
    marginBottom: 3,
  },

  purposeContainer: {
    backgroundColor: "white",
    padding: 8,
    borderRadius: 4,
    border: "1 solid #e5e7eb",
  },

  purposeText: {
    fontSize: 8,
    color: "#374151",
    lineHeight: 1.4,
  },

  // Supporting Documents Section
  supportingDocsSection: {
    backgroundColor: "#fffbeb",
    border: "1 solid #fbbf24",
    borderRadius: 8,
    marginBottom: 16,
    overflow: "hidden",
  },

  supportingDocsHeader: {
    backgroundColor: "#fef3c7",
    padding: 8,
  },

  supportingDocsTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#92400e",
    textAlign: "center",
    textTransform: "uppercase",
  },

  supportingDocsContent: {
    padding: 10,
  },

  docsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },

  docItem: {
    flexDirection: "row",
    alignItems: "center",
    width: "48%",
    marginBottom: 4,
  },

  docIcon: {
    width: 4,
    height: 4,
    backgroundColor: "#10b981",
    borderRadius: 2,
    marginRight: 4,
  },

  docText: {
    fontSize: 7,
    color: "#374151",
    flex: 1,
  },

  // Authorization Section
  authorizationSection: {
    backgroundColor: "#faf5ff",
    border: "2 solid #a855f7",
    borderRadius: 8,
    marginBottom: 16,
    overflow: "hidden",
  },

  authHeader: {
    backgroundColor: "#e9d5ff",
    padding: 10,
  },

  authTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#7c3aed",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  authContent: {
    padding: 10,
  },

  authGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },

  authBox: {
    flex: 1,
    backgroundColor: "white",
    border: "1 solid #d1d5db",
    borderRadius: 6,
    padding: 8,
    textAlign: "center",
    minHeight: 60,
  },

  authBoxRequested: {
    backgroundColor: "#eff6ff",
    border: "1 solid #3b82f6",
  },

  authBoxReviewed: {
    backgroundColor: "#fffbeb",
    border: "1 solid #f59e0b",
  },

  authBoxApproved: {
    backgroundColor: "#f0fdf4",
    border: "1 solid #10b981",
  },

  authStepTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#6b7280",
    marginBottom: 4,
    textTransform: "uppercase",
  },

  authName: {
    fontSize: 8,
    color: "#1f2937",
    fontWeight: "bold",
    marginBottom: 2,
  },

  authPosition: {
    fontSize: 7,
    color: "#6b7280",
    marginBottom: 6,
  },

  authSignatureLine: {
    borderBottom: "1 dashed #9ca3af",
    height: 12,
    marginBottom: 3,
  },

  authDateLabel: {
    fontSize: 6,
    color: "#6b7280",
  },

  // Verification Section
  verificationSection: {
    marginTop: 8,
  },

  verificationItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    backgroundColor: "white",
    padding: 6,
    borderRadius: 4,
    border: "1 solid #e5e7eb",
  },

  verificationIcon: {
    width: 4,
    height: 4,
    backgroundColor: "#10b981",
    borderRadius: 2,
    marginRight: 6,
  },

  verificationText: {
    fontSize: 7,
    color: "#374151",
    flex: 1,
  },

  verificationStatus: {
    fontSize: 6,
    color: "#059669",
    fontWeight: "bold",
  },

  // Footer
  footer: {
    backgroundColor: "#f1f5f9",
    padding: 12,
    textAlign: "center",
    borderRadius: 6,
    border: "1 solid #e5e7eb",
    marginTop: 16,
    position: "relative", // Add this line
    zIndex: 1,
  },

  footerText: {
    fontSize: 7,
    color: "#64748b",
    marginBottom: 2,
  },

  footerBrand: {
    fontSize: 6,
    color: "#94a3b8",
  },
});

export default function PaymentVoucherDirectExpenses() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const query = useQuery();
  const pv = query.get("pv");
  const [data, setData] = useState({});
  const [logs, setLogs] = useState([]);

  const businessName = activeBusiness?.business_name?.toUpperCase();

  const getPvs = useCallback(() => {
    _fetchApi(`/account/get-pv-by-id?pv=${pv}`, (data) => {
      if (data.success) {
        setData(data.results[0]);
      }
    });
  }, [pv]);
  const getLogs = useCallback(() => {
    if (!pv) return;

    _fetchApi(
      `/account/get-logs?id=${pv}&facilityId=${activeBusiness.id}`,
      (data) => {
        if (data.success) {
          const logsData = data.results[0];
          
          // Extract unique user_ids from logs
          const userIds = [];
          if (Array.isArray(logsData)) {
            logsData.forEach(log => {
              if (log.user_id && !userIds.includes(log.user_id)) {
                userIds.push(log.user_id);
              }
            });
          } else if (logsData && typeof logsData === 'object') {
            // Handle case where logsData is an object with user_id properties
            Object.values(logsData).forEach(log => {
              if (log && log.user_id && !userIds.includes(log.user_id)) {
                userIds.push(log.user_id);
              }
            });
          }

          // If no user_ids found, just set the logs without signatures
          if (userIds.length === 0) {
            setLogs(logsData);
            return;
          }

          // Fetch signatures for all users
          const signaturePromises = userIds.map(userId => 
            new Promise((resolve) => {
              _fetchApi(
                `/account/get-user-signature?user_id=${userId}`,
                (signatureData) => {
                  if (signatureData.success) {
                    resolve({ user_id: userId, signature: signatureData.signature });
                  } else {
                    resolve({ user_id: userId, signature: null });
                  }
                },
                (err) => {
                  console.error(`Error fetching signature for user ${userId}:`, err);
                  resolve({ user_id: userId, signature: null });
                }
              );
            })
          );

          // Wait for all signature requests to complete
          Promise.all(signaturePromises).then(signatures => {
            // Create a map of user_id to signature for quick lookup
            const signatureMap = {};
            signatures.forEach(({ user_id, signature }) => {
              signatureMap[user_id] = signature;
            });

            // Merge signatures into logs
            let updatedLogs;
            if (Array.isArray(logsData)) {
              updatedLogs = logsData.map(log => ({
                ...log,
                signature: log.user_id ? signatureMap[log.user_id] : null
              }));
            } else if (logsData && typeof logsData === 'object') {
              updatedLogs = {};
              Object.keys(logsData).forEach(key => {
                const log = logsData[key];
                updatedLogs[key] = {
                  ...log,
                  signature: log && log.user_id ? signatureMap[log.user_id] : null
                };
              });
            } else {
              updatedLogs = logsData;
            }

            setLogs(updatedLogs);
          });
        }
      },
      (err) => {
        console.error("Error fetching logs:", err);
      }
    );
  }, [pv, activeBusiness.id]);

  useEffect(() => {
    getPvs();
    getLogs();
  }, [getPvs, getLogs]);

  const renderAmountInWords = () => {
    if (!data?.amount) return "Amount not available";

    const [naira, kobo] = data.amount.toString().split(".");
    const nairaWords = toWordsconver(naira)?.toUpperCase();
    const koboWords = kobo !== "00" ? toWordsconver(kobo || "0") : "ZERO";

    return `${nairaWords} NAIRA ${koboWords} KOBO ONLY`;
  };

  const voucherData = {
    voucherNo: "PV541",
    date: "2025-07-01",
    amount: "864,192.00",
    currency: "NGN",
    amountWords:
      "EIGHT HUNDRED SIXTY FOUR THOUSAND ONE HUNDRED NINETY TWO NAIRA ONLY",

    source: {
      name: "BRAINSTORM MAIN GROUP",
      address: "Lagos Business District, Victoria Island, Lagos, Nigeria",
      accountNo: "0123456789",
      bank: "First Bank of Nigeria Plc",
      taxId: "TIN: 12345678-0001",
      contactPerson: "Finance Director",
    },

    beneficiary: {
      name: "ABC SUPPLIERS LIMITED",
      address: "Plot 15, Industrial Estate, Ikeja, Lagos, Nigeria",
      accountNo: "0987654321",
      bank: "Access Bank Plc",
      sortCode: "044150149",
      taxId: "TIN: 87654321-0001",
      email: "accounts@abcsuppliers.com",
    },

    paymentMethod: "Bank Transfer (Electronic)",
    purpose:
      "Payment for office equipment and supplies as per invoice INV-2025-0456 dated June 15, 2025. This payment covers the procurement of 15 desktop computers, 3 printers, office furniture, and related accessories for the new Lagos branch office setup.",
    reference: "REF/BMG/2025/0541",
    exchangeRate: "1.00 (NGN to NGN)",

    requestedBy: "John Adebayo - Procurement Manager",
    checkedBy: "Sarah Ibrahim - Finance Officer",
    reviewedBy: "Michael Okafor - Finance Manager",
    approvedBy: "Dr. Amina Hassan - Chief Financial Officer",

    supportingDocs: [
      "Purchase Order PO-2025-0123",
      "Supplier Invoice INV-2025-0456",
      "Goods Received Note GRN-2025-0089",
      "Tax Clearance Certificate",
      "Vendor Registration Certificate",
      "Bank Account Verification",
      "Board Resolution (if applicable)",
      "Insurance Certificate",
    ],
  };

  return (
    <Container>
      <CustomCard back header="Payment voucher PDF">
        <PDFViewer style={{ width: "100%", height: "97vh" }}>
          <Document>
            <Page size="A4" style={styles.page}>
              {/* Watermark */}
              <Text style={styles.watermark}>OFFICIAL</Text>

              {/* Header */}
              <View style={styles.headerContainer}>
                <View style={styles.headerTop}>
                  <View
                    style={[
                      styles.companySection,
                      activeBusiness?.document_header_style === "logo" &&
                      activeBusiness?.business_logo
                        ? { flexDirection: "row", gap: 8, alignItems: "center" }
                        : {},
                    ]}
                  >
                    {activeBusiness?.document_header_style === "logo" &&
                    activeBusiness?.business_logo ? (
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          backgroundColor: "#fff",
                          borderRadius: 4,
                          padding: 3,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Image
                          src={activeBusiness.business_logo}
                          style={{ width: 42, height: 42, objectFit: "contain" }}
                        />
                      </View>
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.companyName}>
                        {(
                          voucherData.business_name ||
                          activeBusiness?.business_name ||
                          businessName
                        )?.toUpperCase()}
                      </Text>
                      <Text style={styles.companyTagline}>
                        {activeBusiness?.description || "Payment Voucher"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.voucherNumberBox}>
                    <Text style={styles.voucherNumberLabel}>Voucher No.</Text>
                    <Text style={styles.voucherNumber}>
                      {voucherData.voucherNo}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Info Bar */}
              <View style={styles.infoBar}>
                <View style={styles.infoItem}>
                  <View style={styles.infoIcon}></View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Issue Date</Text>
                    <Text style={styles.infoValue}>{voucherData.date}</Text>
                  </View>
                </View>
                <View style={styles.infoItem}>
                  <View style={styles.infoIcon}></View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Reference</Text>
                    <Text style={styles.infoValue}>
                      {voucherData.reference}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoItem}>
                  <View style={styles.infoIcon}></View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Method</Text>
                    <Text style={styles.infoValue}>Electronic</Text>
                  </View>
                </View>
              </View>

              <View style={styles.contentContainer}>
                {/* Amount Section */}
                <View style={styles.amountSection}>
                  <Text style={styles.amountLabel}>Payment Amount</Text>
                  <Text style={styles.amountNumber}>
                    NGN {voucherData.amount}
                  </Text>
                  <View style={styles.amountWordsContainer}>
                    <Text style={styles.amountWords}>
                      {voucherData.amountWords}
                    </Text>
                  </View>
                </View>

                {/* Parties Section */}
                <View style={styles.partiesContainer}>
                  {/* Source */}
                  <View style={[styles.partyBox, styles.partyBoxSource]}>
                    <View
                      style={[styles.partyHeader, styles.partyHeaderSource]}
                    >
                      <Text
                        style={[styles.partyTitle, styles.partyTitleSource]}
                      >
                        SOURCE / PAYER
                      </Text>
                    </View>
                    <View style={styles.partyContent}>
                      <View style={styles.partyField}>
                        <Text style={styles.fieldLabel}>Company Name</Text>
                        <Text style={styles.fieldValue}>
                          {voucherData.source.name}
                        </Text>
                      </View>
                      <View style={styles.partyField}>
                        <Text style={styles.fieldLabel}>Account</Text>
                        <Text style={styles.fieldValueMono}>
                          {voucherData.source.accountNo}
                        </Text>
                      </View>
                      <View style={styles.partyField}>
                        <Text style={styles.fieldLabel}>Bank</Text>
                        <Text style={styles.fieldValue}>
                          {voucherData.source.bank}
                        </Text>
                      </View>
                      <View style={styles.partyField}>
                        <Text style={styles.fieldLabel}>Tax ID</Text>
                        <Text style={styles.fieldValue}>
                          {voucherData.source.taxId}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Beneficiary */}
                  <View style={[styles.partyBox, styles.partyBoxBeneficiary]}>
                    <View
                      style={[
                        styles.partyHeader,
                        styles.partyHeaderBeneficiary,
                      ]}
                    >
                      <Text
                        style={[
                          styles.partyTitle,
                          styles.partyTitleBeneficiary,
                        ]}
                      >
                        BENEFICIARY / PAYEE
                      </Text>
                    </View>
                    <View style={styles.partyContent}>
                      <View style={styles.partyField}>
                        <Text style={styles.fieldLabel}>Company Name</Text>
                        <Text style={styles.fieldValue}>
                          {voucherData.beneficiary.name}
                        </Text>
                      </View>
                      <View style={styles.partyField}>
                        <Text style={styles.fieldLabel}>Account</Text>
                        <Text style={styles.fieldValueMono}>
                          {voucherData.beneficiary.accountNo}
                        </Text>
                      </View>
                      <View style={styles.partyField}>
                        <Text style={styles.fieldLabel}>Bank</Text>
                        <Text style={styles.fieldValue}>
                          {voucherData.beneficiary.bank}
                        </Text>
                      </View>
                      <View style={styles.partyField}>
                        <Text style={styles.fieldLabel}>Sort Code</Text>
                        <Text style={styles.fieldValue}>
                          {voucherData.beneficiary.sortCode}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Payment Details */}
                <View style={styles.paymentDetailsSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Payment Details</Text>
                  </View>
                  <View style={styles.sectionContent}>
                    <Text style={styles.purposeLabel}>Purpose of Payment:</Text>
                    <View style={styles.purposeContainer}>
                      <Text style={styles.purposeText}>
                        {voucherData.purpose}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Supporting Documents */}
                <View style={styles.supportingDocsSection}>
                  <View style={styles.supportingDocsHeader}>
                    <Text style={styles.supportingDocsTitle}>
                      Supporting Documentation
                    </Text>
                  </View>
                  <View style={styles.supportingDocsContent}>
                    <View style={styles.docsGrid}>
                      {voucherData.supportingDocs
                        .slice(0, 6)
                        .map((doc, index) => (
                          <View key={index} style={styles.docItem}>
                            <View style={styles.docIcon}></View>
                            <Text style={styles.docText}>{doc}</Text>
                          </View>
                        ))}
                    </View>
                  </View>
                </View>

                {/* Authorization Section */}
                <View style={styles.authorizationSection}>
                  <View style={styles.authHeader}>
                    <Text style={styles.authTitle}>
                      Authorization & Approval Workflow
                    </Text>
                  </View>
                  <View style={styles.authContent}>
                    <View style={styles.authGrid}>
                      <View style={[styles.authBox, styles.authBoxRequested]}>
                        <Text style={styles.authStepTitle}>Requested By</Text>
                        <Text style={styles.authName}>
                          {voucherData.requestedBy.split(" - ")[0]}
                        </Text>
                        <Text style={styles.authPosition}>
                          {voucherData.requestedBy.split(" - ")[1] || ""}
                        </Text>
                        <View style={styles.authSignatureLine}></View>
                        <Text style={styles.authDateLabel}>
                          Signature & Date
                        </Text>
                      </View>

                      <View style={[styles.authBox, styles.authBoxReviewed]}>
                        <Text style={styles.authStepTitle}>Reviewed By</Text>
                        <Text style={styles.authName}>
                          {voucherData.reviewedBy.split(" - ")[0]}
                        </Text>
                        <Text style={styles.authPosition}>
                          {voucherData.reviewedBy.split(" - ")[1] || ""}
                        </Text>
                        <View style={styles.authSignatureLine}></View>
                        <Text style={styles.authDateLabel}>
                          Signature & Date
                        </Text>
                      </View>

                      <View style={[styles.authBox, styles.authBoxApproved]}>
                        <Text style={styles.authStepTitle}>Approved By</Text>
                        <Text style={styles.authName}>
                          {voucherData.approvedBy.split(" - ")[0]}
                        </Text>
                        <Text style={styles.authPosition}>
                          {voucherData.approvedBy.split(" - ")[1] || ""}
                        </Text>
                        <View style={styles.authSignatureLine}></View>
                        <Text style={styles.authDateLabel}>
                          Signature & Date
                        </Text>
                      </View>
                    </View>

                    {/* Verification Items */}
                    <View style={styles.verificationSection}>
                      <View style={styles.verificationItem}>
                        <View style={styles.verificationIcon}></View>
                        <Text style={styles.verificationText}>
                          Supporting documentation attached and verified
                        </Text>
                        <Text style={styles.verificationStatus}>
                          ✓ VERIFIED
                        </Text>
                      </View>
                      <View style={styles.verificationItem}>
                        <View style={styles.verificationIcon}></View>
                        <Text style={styles.verificationText}>
                          Calculations and amounts cross-checked
                        </Text>
                        <Text style={styles.verificationStatus}>
                          ✓ VERIFIED
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {activeBusiness?.seal && (
                <View style={styles.sealContainer}>
                  <Image 
                    src={activeBusiness.seal} 
                    style={styles.sealImage}
                    cache={false} 
                  />
                </View>
              )}

                {/* Footer */}
                <View style={styles.footer}>
                  <Text style={styles.footerText}>
                    Computer-generated document • Generated:{" "}
                    {new Date().toLocaleDateString("en-GB")}
                  </Text>
                  <Text style={styles.footerBrand}>
                    BRAINSTORM MAIN GROUP • CONFIDENTIAL DOCUMENT • AUTHORIZED
                    PERSONNEL ONLY
                  </Text>
                  <Text style={styles.footerBrand}>
                    THIS SOLUTION IS POWERED BY NEXIFOUR LIMITED · NDPC | ISO 27001 | ISO 9001
                  </Text>
                </View>
              </View>
              
            </Page>
          </Document>
        </PDFViewer>
      </CustomCard>
    </Container>
  );
}
