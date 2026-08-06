/* eslint-disable no-unused-vars */
/* eslint-disable no-unsafe-optional-chaining */
import { useCallback, useEffect, useState } from "react";
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
import { pdf } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
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
  },

  // Header with gradient effect (simulated with colors)
  headerContainer: {
    backgroundColor: "#1e40af",
    padding: 10,
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
    padding: "0 20 20 20",
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
    marginBottom: 0,
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

  // Signature styles
  signatureContainer: {
    height: 35,
    marginBottom: 4,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 4,
    border: "1 solid #e5e7eb",
    position: "relative",
  },

  signatureImage: {
    maxWidth: "90%",
    maxHeight: "90%",
    objectFit: "contain",
  },

  authSignatureLine: {
    borderBottom: "2 solid #374151",
    height: 15,
    marginBottom: 4,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 2,
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

  // Seal styles
  sealContainer: {
    position: 'absolute',
    right: '50%',
    bottom: 58,
    width: 80,
    height: 80,
    marginRight: "-40"
  },

  sealImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },

  // Footer
  footer: {
    backgroundColor: "#f1f5f9",
    padding: 3,
    textAlign: "center",
    borderRadius: 6,
    border: "1 solid #e5e7eb",
    marginTop: 5,
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

import PropTypes from "prop-types";
import { accountTypes } from "@/lib/utils";

VoucherDocument.propTypes = {
  voucherData: PropTypes.object.isRequired,
  activeBusiness: PropTypes.object,
};

export function VoucherDocument({ voucherData, activeBusiness }) {
  // Helper function to render signature or fallback
  const renderSignature = (person) => {
    if (person?.signature) {
      return (
        <View style={styles.signatureContainer}>
          <Image 
            src={person.signature} 
            style={styles.signatureImage}
          />
        </View>
      );
    } else {
      return <View style={styles.authSignatureLine}></View>;
    }
  };

  return (
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
                  {(voucherData.business_name || activeBusiness?.business_name)?.toUpperCase()}
                </Text>
                <Text style={styles.companyTagline}>
                  {activeBusiness?.description || "Payment Voucher"}
                </Text>
              </View>
            </View>
            <View style={styles.voucherNumberBox}>
              <Text style={styles.voucherNumberLabel}>Voucher No.</Text>
              <Text style={styles.voucherNumber}>{voucherData.voucherNo}</Text>
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
              <Text style={styles.infoValue}>{voucherData.reference}</Text>
            </View>
          </View>
          <View style={styles.infoItem}>
            <View style={styles.infoIcon}></View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Method</Text>
              <Text style={styles.infoValue}>
                {voucherData.mode_of_payment.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.contentContainer}>
          {/* Amount Section */}
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Payment Amount</Text>
            <Text style={styles.amountNumber}>
              {voucherData.currency} {formatNumber1(voucherData.amount)}
            </Text>
            <View style={styles.amountWordsContainer}>
              <Text style={styles.amountWords}>
                {toWordsconver(
                  voucherData.amount.toString().split(".")[0]
                )?.toUpperCase()}
                NAIRA
                {voucherData.amount.toString().split(".")[1] !== "00"
                  ? ` and ${toWordsconver(
                      voucherData.amount.toString().split(".")[1]
                    )} kobo`?.toUpperCase()
                  : null}{" "}
                ONLY
              </Text>
            </View>
          </View>

          {/* Parties Section */}
          <View style={styles.partiesContainer}>
            {/* Source */}
            <View style={[styles.partyBox, styles.partyBoxSource]}>
              <View style={[styles.partyHeader, styles.partyHeaderSource]}>
                <Text style={[styles.partyTitle, styles.partyTitleSource]}>
                  SOURCE / PAYER
                </Text>
              </View>
              <View style={styles.partyContent}>
                <View style={styles.partyField}>
                  <Text style={styles.fieldLabel}>Payer Name</Text>
                  <Text style={styles.fieldValue}>
                    {voucherData?.source?.name.toUpperCase()}
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
                    {voucherData.source.bank.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.partyField}>
                  <Text style={styles.fieldLabel}>Account Type</Text>
                  <Text style={styles.fieldValue}>
                    {accountTypes
                      .find((item) => item.code === voucherData?.source?.taxId)
                      ?.title.toUpperCase() || ""}
                  </Text>
                </View>
              </View>
            </View>

            {/* Beneficiary */}
            <View style={[styles.partyBox, styles.partyBoxBeneficiary]}>
              <View style={[styles.partyHeader, styles.partyHeaderBeneficiary]}>
                <Text style={[styles.partyTitle, styles.partyTitleBeneficiary]}>
                  BENEFICIARY / PAYEE
                </Text>
              </View>
              <View style={styles.partyContent}>
                <View style={styles.partyField}>
                  <Text style={styles.fieldLabel}>Payee Name</Text>
                  <Text style={styles.fieldValue}>
                    {voucherData.beneficiary.name.toUpperCase()}
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
                    {voucherData.beneficiary.bank.toUpperCase()}
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
                <Text style={styles.purposeText}>{voucherData.purpose}</Text>
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
                    {voucherData.requestedBy.name}
                  </Text>
                  <Text style={styles.authPosition}>
                    {voucherData.requestedBy.title || ""}
                  </Text>
                  {renderSignature(voucherData.requestedBy)}
                  {/* <Text style={styles.authDateLabel}>Signature </Text> */}
                  <Text style={styles.authDateLabel}>
                    {voucherData.requestedBy.date}
                  </Text>
                </View>

                <View style={[styles.authBox, styles.authBoxReviewed]}>
                  <Text style={styles.authStepTitle}>Reviewed By</Text>
                  <Text style={styles.authName}>
                    {voucherData.reviewedBy.name}
                  </Text>
                  <Text style={styles.authPosition}>
                    {voucherData.reviewedBy.title || ""}
                  </Text>
                  {renderSignature(voucherData.reviewedBy)}
                  {/* <Text style={styles.authDateLabel}>Signature </Text> */}
                  <Text style={styles.authDateLabel}>
                    {voucherData.reviewedBy.date}
                  </Text>
                </View>

                <View style={[styles.authBox, styles.authBoxApproved]}>
                  <Text style={styles.authStepTitle}>Approved By</Text>
                  <Text style={styles.authName}>
                    {voucherData.approvedBy.name}
                  </Text>
                  <Text style={styles.authPosition}>
                    {voucherData.approvedBy.title || ""}
                  </Text>
                  {renderSignature(voucherData.approvedBy)}
                  {/* <Text style={styles.authDateLabel}>Signature</Text> */}
                  <Text style={styles.authDateLabel}>
                    {" "}
                    {voucherData.approvedBy.date || ""}
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
                  <Text style={styles.verificationStatus}>✓ VERIFIED</Text>
                </View>
                <View style={styles.verificationItem}>
                  <View style={styles.verificationIcon}></View>
                  <Text style={styles.verificationText}>
                    Calculations and amounts cross-checked
                  </Text>
                  <Text style={styles.verificationStatus}>✓ VERIFIED</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Business Seal */}
          {activeBusiness?.seal && (
            <View style={styles.sealContainer}>
              <Image 
                src={activeBusiness.seal} 
                style={styles.sealImage}
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
              THIS SOLUTION IS POWERED BY NEXIFOUR LIMITED
              {" · NDPC | ISO 27001 | ISO 9001"}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export default function PaymentVoucherPdf() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const query = useQuery();
  const pv = query.get("pv");
  const memo_id = query.get("memo_id");
  const [voucherData, setData] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  const businessName = activeBusiness?.business_name?.toUpperCase();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Download on mobile
  const handleDownload = async () => {
    if (!voucherData) return;
    const blob = await pdf(
      <VoucherDocument voucherData={voucherData} activeBusiness={activeBusiness} />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PaymentVoucher-${voucherData.voucherNo}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getPaymentVoucher = useCallback(() => {
    _fetchApi(
      `/get/payment/voucher?memo_id=${memo_id}&pv=${pv}&facilityId=${activeBusiness.id}`,
      (data) => {
        if (data.success) {
          setData(data.data);
        }
      }
    );
  }, [activeBusiness.id, pv, memo_id]);

  useEffect(() => {
    getPaymentVoucher();
  }, [getPaymentVoucher]);

  return (
    <Container>
      <CustomCard
        back
        to="/app/account/list-of-memos"
        header="Payment Voucher PDF"
      >
        {!voucherData ? (
          <p className="text-center text-muted">Loading voucher...</p>
        ) : isMobile ? (
          <div className="text-center">
            <Button color="primary" onClick={handleDownload}>
              Download Payment Voucher
            </Button>
          </div>
        ) : (
          <PDFViewer
            style={{ width: "100%", height: "97vh" }}
            className="border-0 rounded-2xl"
          >
            <VoucherDocument voucherData={voucherData} activeBusiness={activeBusiness} />
          </PDFViewer>
        )}
      </CustomCard>
    </Container>
  );
}