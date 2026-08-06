// import React, { useCallback, useEffect, useState } from "react";
// import {
//   Document,
//   Page,
//   PDFViewer,
//   StyleSheet,
//   View,
//   Text,
//   Font,
// } from "@react-pdf/renderer";

// export default function PurchaseOrderPdf() {

//   return (
//     <>
//       {/* {JSON.stringify(logs.approved?.name)} */}
//       <Container>
//         <CustomCard back header="Memo PDF">
//           <PDFViewer style={{ width: "100%", height: "97vh" }}>
//             <Document>
//               <Page style={styles.page} size="A4">
//                 {/* Header Section */}
//                 <View style={styles.header}>
//                   <Text style={styles.companyName}>
//                     {activeBusiness?.business_name}
//                   </Text>
//                   <Text style={styles.title}>MEMO</Text>
//                 </View>

//                 {/* Date and PO Number */}
//                 <View style={styles.datePoSection}>
//                   <Text>DATE: {moment(data1.date).format("MMMM Do YYYY")}</Text>
//                   <Text>MEMO ID: {data1.memo_id}</Text>
//                 </View>

//                 {/* Vendor Section */}
//                 <View style={styles.section}>
//                   {/* <Text style={styles.sectionTitle}>HEADER</Text> */}
//                   <Text>TO: {data1.recipient}</Text>
//                   <Text>FROM: {data1.raise_by}</Text>
//                   <Text>SUBJECT: {data1.subject}</Text>
//                 </View>

//                 {/* Ship To Section */}
//                 <View style={styles.section}>
//                   {/* <Text style={styles.sectionTitle}>BODY</Text> */}
//                   <Text>DESCRIPTION: {data1.purpose}</Text>
//                 </View>

//                 {/* Shipping Info */}
//                 <View style={styles.shippingInfo}>
//                   <Text>DETAILS OF EXPENSES</Text>
//                 </View>

//                 {/* Items Table Header */}
//                 <View style={styles.tableHeader}>
//                   {/* <Text style={styles.tableHeaderCell}>SN</Text> */}
//                   <Text style={styles.tableHeaderCell}>ITEM NAME</Text>
//                   <Text style={styles.tableHeaderCell}>QTY</Text>
//                   <Text style={styles.tableHeaderCell}>UNIT PRICE (NGN)</Text>
//                   <Text style={styles.tableHeaderCell}>TOTAL (NGN)</Text>
//                 </View>

//                 {itemList.map((item, index) => (
//                   <View style={styles.itemRow} key={index}>
//                     {/* <Text style={styles.itemCellSn}>{index + 1}</Text> */}
//                     <Text style={styles.itemCellLeft}>{item.item_name}</Text>
//                     <Text style={styles.itemCell}>{item.quantity}</Text>
//                     <Text style={styles.itemCellNum}>
//                       {formatNumber1(item.unit_cost)}
//                     </Text>
//                     <Text style={styles.itemCellNum}>
//                       {formatNumber1(item.quantity * item.unit_cost)}
//                     </Text>
//                   </View>
//                 ))}

//                 {/* Totals */}
//                 <View style={styles.totalsSection}>
//                   <View style={styles.totalRow}>
//                     <Text>TOTAL (NGN):</Text>
//                     <Text>{formatNumber1(data1.total)}</Text>
//                   </View>
//                 </View>

//                 {/* Comments */}
//                 <View style={styles.commentsSection}>
//                   <Text>Final remarks:</Text>
//                   <Text>{data1.remark}</Text>
//                 </View>

//                 <View style={styles.signing}>
//                   {/* Reviewed By */}
//                   <View style={styles.signSection}>
//                     <View style={styles.signRow}>
//                       <Text style={{ marginBottom: 10 }}>
//                         Reviewed by: {data1.review_by}
//                       </Text>
//                       <Text>_________________________</Text>
//                     </View>
//                     <View style={styles.signRow}>
//                       <Text>
//                         Date: {moment(logs.reviewed?.date).format("DD/MM/YYYY")}
//                       </Text>
//                     </View>
//                   </View>

//                   {/* Approved By */}
//                   <View style={styles.signSection}>
//                     <View style={styles.signRow}>
//                       <Text style={{ marginBottom: 10 }}>
//                         Approved by: {logs?.approved?.name}
//                       </Text>
//                       <Text>_________________________</Text>
//                     </View>
//                     <View style={styles.signRow}>
//                       <Text>
//                         Date:{" "}
//                         {moment(logs?.approved?.date).format("DD/MM/YYYY")}
//                       </Text>
//                     </View>
//                   </View>
//                 </View>

//                 {/* Footer */}
//                 <View style={styles.footer}>
//                   <Text>
//                     If you have any questions about this memo, please contact
//                   </Text>
//                   <Text>
//                     https://ph1sh3rm4n.vercel.app/ Memo Template © 2025
//                     ph1sh3rm4n.vercel.app
//                   </Text>
//                 </View>
//               </Page>
//             </Document>
//           </PDFViewer>
//         </CustomCard>
//       </Container>
//     </>
//   );
// }

// const styles = StyleSheet.create({
//   page: {
//     padding: 40,
//     position: "relative",
//     fontFamily: "DM_SANS",
//     fontSize: 10,
//   },
//   header: {
//     marginBottom: 10,
//     alignItems: "center",
//   },
//   companyName: {
//     fontSize: 14,
//     fontWeight: "bold",
//     marginBottom: 5,
//   },
//   title: {
//     fontSize: 12,
//     fontWeight: "bold",
//   },
//   addressSection: {
//     marginBottom: 15,
//     lineHeight: 1.5,
//   },
//   datePoSection: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     marginBottom: 20,
//   },
//   section: {
//     marginBottom: 15,
//     lineHeight: 1.5,
//   },
//   sectionTitle: {
//     fontWeight: "bold",
//     marginTop: 15,
//     marginBottom: 5,
//   },
//   shippingInfo: {
//     marginBottom: 15,
//   },
//   tableHeader: {
//     flexDirection: "row",
//     borderBottomWidth: 1,
//     borderBottomColor: "#000",
//     paddingBottom: 5,
//     marginBottom: 5,
//   },
//   tableHeaderCell: {
//     flex: 1,
//     fontWeight: "bold",
//     textAlign: "center",
//   },
//   itemRow: {
//     flexDirection: "row",
//     marginBottom: 5,
//   },
//   itemCell: {
//     flex: 1,
//     textAlign: "center",
//   },
//   itemCellSn: {
//     flex: 1,
//     textAlign: "center",
//     width: "10%",
//   },
//   itemCellLeft: {
//     flex: 1,
//     textAlign: "left",
//   },
//   itemCellNum: {
//     flex: 1,
//     textAlign: "right",
//   },
//   commentsSection: {
//     marginTop: 10,
//     marginBottom: 10,
//   },
//   totalsSection: {
//     marginTop: 20,
//     width: "50%",
//     marginLeft: "auto",
//   },
//   totalRow: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     marginBottom: 5,
//   },

//   signing: {
//     position: "absolute",
//     bottom: 100,
//     left: 40,
//     right: 40,
//     flexDirection: "row",
//     justifyContent: "space-between",
//   },

//   signSection: {
//     marginTop: 20,
//     width: "50%",
//     display: "flex",
//     alignItems: "center",
//     // marginLeft: "auto",
//   },
//   signRow: {
//     flexDirection: "column",
//     justifyContent: "center",
//     marginBottom: 5,
//   },
//   footer: {
//     position: "absolute",
//     bottom: 20,
//     left: 40,
//     right: 40,
//     fontSize: 8,
//     textAlign: "center",
//   },
// });

import React, { useState, useEffect, useCallback } from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
  PDFViewer,
  Font,
} from "@react-pdf/renderer";
import DM_SANS_NORMAL from "../../../assets/DM_Sans/DM_Sans/static/DMSans_24pt-SemiBold.ttf";
import DM_SANS_BOLD from "../../../assets/DM_Sans/DM_Sans/static/DMSans_24pt-Bold.ttf";
import DM_SANS_ITALIC from "../../../assets/DM_Sans/DM_Sans/static/DMSans-Italic.ttf";
import useQuery from "@/common/Custom/Hook/useQuery";
import { useSelector } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import moment from "moment";
import { formatNumber1 } from "@/components/router/utilities";
import { toast } from "sonner";
import { Container } from "reactstrap";
import CustomCard from "@/common/Custom/CustomCard2";
import { data } from "autoprefixer";
import { formatNumber } from "@/utilities";

Font.register({
  family: "DM_SANS",
  fonts: [
    { src: DM_SANS_NORMAL, fontWeight: 700 },
    { src: DM_SANS_BOLD, fontStyle: "bold" },
    { src: DM_SANS_ITALIC, fontStyle: "italic" },
  ],
});
// Enhanced PDF Styles for Corporate Memo
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 0,
    fontSize: 10,
    fontFamily: "Helvetica",
  },

  // Modern Header Design
  headerContainer: {
    backgroundColor: "#7c3aed",
    background: "linear-gradient(135deg, #7c3aed 0%, #3730a3 100%)",
    padding: 20,
    color: "white",
    marginBottom: 0,
  },

  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  companySection: {
    flex: 1,
  },

  companyName: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 3,
    color: "white",
  },

  companySubtitle: {
    fontSize: 10,
    color: "#c4b5fd",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  memoIdBox: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    padding: 10,
    borderRadius: 6,
    textAlign: "center",
    minWidth: 100,
  },

  memoIdLabel: {
    fontSize: 8,
    color: "#c4b5fd",
    marginBottom: 2,
  },

  memoId: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },

  // Info Bar
  infoBar: {
    backgroundColor: "#f3f4f6",
    padding: 12,
    borderBottom: "2 solid #e5e7eb",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },

  infoItem: {
    flex: 1,
    alignItems: "center",
  },

  infoIcon: {
    width: 8,
    height: 8,
    backgroundColor: "#7c3aed",
    borderRadius: 4,
    marginBottom: 3,
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

  priorityHigh: {
    color: "#dc2626",
  },

  // Main Content
  contentContainer: {
    padding: "0 20 20 20",
  },

  // Routing Section
  routingContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 15,
  },

  routingBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    border: "1 solid #e2e8f0",
    borderRadius: 8,
    padding: 12,
  },

  routingBoxTo: {
    backgroundColor: "#eff6ff",
    border: "1 solid #bfdbfe",
  },

  routingBoxFrom: {
    backgroundColor: "#f0fdf4",
    border: "1 solid #bbf7d0",
  },

  routingHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  routingIcon: {
    width: 8,
    height: 8,
    backgroundColor: "#3b82f6",
    borderRadius: 4,
    marginRight: 6,
  },

  routingIconFrom: {
    backgroundColor: "#10b981",
  },

  routingTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#1e40af",
    textTransform: "uppercase",
  },

  routingTitleFrom: {
    color: "#059669",
  },

  routingField: {
    marginBottom: 4,
  },

  routingName: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1f2937",
  },

  routingDetail: {
    fontSize: 8,
    color: "#6b7280",
  },

  // Subject Section
  subjectSection: {
    backgroundColor: "#faf5ff",
    border: "1 solid #d8b4fe",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },

  subjectTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#7c3aed",
    marginBottom: 6,
    textTransform: "uppercase",
  },

  subjectText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1f2937",
  },

  // Description Section
  descriptionSection: {
    backgroundColor: "#f9fafb",
    border: "1 solid #e5e7eb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },

  descriptionTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 6,
    textTransform: "uppercase",
  },

  descriptionText: {
    fontSize: 9,
    color: "#4b5563",
    lineHeight: 1.4,
  },

  // Financial Section
  financialSection: {
    backgroundColor: "#f0fdf4",
    border: "1 solid #16a34a",
    borderRadius: 10,
    marginBottom: 10,
    overflow: "hidden",
  },

  financialHeader: {
    backgroundColor: "#bbf7d0",
    padding: 8,
    textAlign: "center",
  },

  financialTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#166534",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  financialContent: {
    padding: 12,
  },

  categorySection: {
    marginBottom: 12,
  },

  categoryHeader: {
    backgroundColor: "white",
    border: "1 solid #e5e7eb",
    borderRadius: 4,
    padding: 6,
    marginBottom: 6,
  },

  categoryTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#374151",
  },

  expenseTable: {
    marginBottom: 8,
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    padding: 4,
    borderRadius: 3,
    marginBottom: 4,
  },

  tableHeaderCell: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#374151",
    textAlign: "center",
  },

  tableRow: {
    flexDirection: "row",
    paddingVertical: 2,
    borderBottom: "0.5 solid #f3f4f6",
  },

  tableCell: {
    fontSize: 9,
    color: "#1f2937",
    paddingHorizontal: 2,
  },

  tableCellName: {
    flex: 2,
  },

  tableCellQty: {
    flex: 0.5,
    textAlign: "center",
  },

  tableCellPrice: {
    flex: 1,
    textAlign: "right",
  },

  tableCellTotal: {
    flex: 1,
    textAlign: "right",
    fontWeight: "bold",
  },

  subtotalRow: {
    flexDirection: "row",
    borderTop: "1 solid #16a34a",
    paddingTop: 4,
    marginTop: 4,
  },

  subtotalLabel: {
    flex: 3.5,
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "right",
    color: "#374151",
  },

  subtotalAmount: {
    flex: 1,
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "right",
    color: "#166534",
  },

  grandTotalSection: {
    borderTop: "2 solid #16a34a",
    paddingTop: 2,
    marginTop: 2,
  },

  grandTotalRow: {
    flexDirection: "row",
    backgroundColor: "#dcfce7",
    padding: 8,
    borderRadius: 6,
  },

  grandTotalLabel: {
    flex: 3.5,
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "right",
    color: "#166534",
  },

  grandTotalAmount: {
    flex: 1,
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "right",
    color: "#15803d",
  },

  // Justification Section
  justificationSection: {
    backgroundColor: "#fffbeb",
    border: "1 solid #f59e0b",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },

  justificationTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#92400e",
    marginBottom: 8,
    textTransform: "uppercase",
  },

  justificationList: {
    marginLeft: 2,
  },

  justificationItem: {
    flexDirection: "row",
    marginBottom: 2,
  },

  justificationBullet: {
    width: 3,
    height: 3,
    backgroundColor: "#f59e0b",
    borderRadius: 2,
    marginTop: 3,
    marginRight: 6,
  },

  justificationText: {
    fontSize: 8,
    color: "#78350f",
    flex: 1,
    lineHeight: 1.3,
  },

  // Authorization Section
  authorizationSection: {
    backgroundColor: "#faf5ff",
    border: "2 solid #8b5cf6",
    borderRadius: 10,
    marginBottom: 15,
    overflow: "hidden",
  },

  authHeader: {
    backgroundColor: "#e9d5ff",
    padding: 10,
  },

  authTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#7c3aed",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  authContent: {
    padding: 12,
  },

  remarksSection: {
    backgroundColor: "#dcfce7",
    border: "1 solid #16a34a",
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
  },

  remarksTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#166534",
    marginBottom: 4,
  },

  remarksText: {
    fontSize: 8,
    color: "#15803d",
    lineHeight: 1.3,
  },

  signaturesContainer: {
    flexDirection: "row",
    gap: 12,
  },

  signatureBox: {
    flex: 1,
    backgroundColor: "white",
    border: "1 solid #d1d5db",
    borderRadius: 6,
    padding: 10,
    textAlign: "center",
    minHeight: 60,
  },

  signatureBoxApproved: {
    backgroundColor: "#f0fdf4",
    border: "1 solid #16a34a",
  },

  signatureRole: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#6b7280",
    marginBottom: 4,
    textTransform: "uppercase",
  },

  signatureRoleApproved: {
    color: "#166534",
  },

  signatureName: {
    fontSize: 8,
    color: "#1f2937",
    fontWeight: "bold",
    marginBottom: 6,
  },

  signatureTitle: {
    fontSize: 7,
    color: "#6b7280",
    marginBottom: 8,
  },

  signatureLine: {
    borderBottom: "1 dashed #9ca3af",
    height: 12,
    marginBottom: 3,
  },

  signatureDate: {
    fontSize: 7,
    color: "#6b7280",
  },

  // Footer
  footer: {
    backgroundColor: "#f8fafc",
    padding: 12,
    textAlign: "center",
    borderTop: "1 solid #e2e8f0",
    marginTop: 15,
  },

  footerText: {
    fontSize: 7,
    color: "#64748b",
    marginBottom: 2,
  },

  footerBrand: {
    fontSize: 6,
    color: "#9ca3af",
    fontWeight: "bold",
  },

  // Watermark
  watermark: {
    position: "absolute",
    top: "35%",
    left: "25%",
    fontSize: 50,
    color: "#f3f4f6",
    opacity: 0.1,
    transform: "rotate(-45deg)",
    zIndex: -1,
  },
});

// Enhanced PDF Document Component for Memo
const CorporateMemoPDF = ({ memoData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Watermark */}
      <Text style={styles.watermark}>CONFIDENTIAL</Text>

      {/* Modern Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTop}>
          <View style={styles.companySection}>
            <Text style={styles.companyName}>{memoData.company}</Text>
            <Text style={styles.companySubtitle}>Internal Memorandum</Text>
          </View>
          <View style={styles.memoIdBox}>
            <Text style={styles.memoIdLabel}>Memo ID</Text>
            <Text style={styles.memoId}>{memoData.memoId}</Text>
          </View>
        </View>
      </View>

      {/* Info Bar */}
      <View style={styles.infoBar}>
        <View style={styles.infoItem}>
          <View style={styles.infoIcon}></View>
          <Text style={styles.infoLabel}>Date</Text>
          <Text style={styles.infoValue}>{memoData.date}</Text>
        </View>
        <View style={styles.infoItem}>
          <View style={styles.infoIcon}></View>
          <Text style={styles.infoLabel}>Priority</Text>
          <Text style={[styles.infoValue, styles.priorityHigh]}>
            {memoData.priority}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <View style={styles.infoIcon}></View>
          <Text style={styles.infoLabel}>Classification</Text>
          <Text style={styles.infoValue}>{memoData.classification}</Text>
        </View>
      </View>

      <View style={styles.contentContainer}>
        {/* Routing Information */}
        <View style={styles.routingContainer}>
          <View style={[styles.routingBox, styles.routingBoxTo]}>
            <View style={styles.routingHeader}>
              <View style={styles.routingIcon}></View>
              <Text style={styles.routingTitle}>To</Text>
            </View>
            <View style={styles.routingField}>
              <Text style={styles.routingName}>{memoData.to.name}</Text>
              <Text style={styles.routingDetail}>{memoData.to.title}</Text>
              <Text style={styles.routingDetail}>{memoData.to.department}</Text>
            </View>
          </View>

          <View style={[styles.routingBox, styles.routingBoxFrom]}>
            <View style={styles.routingHeader}>
              <View style={[styles.routingIcon, styles.routingIconFrom]}></View>
              <Text style={[styles.routingTitle, styles.routingTitleFrom]}>
                From
              </Text>
            </View>
            <View style={styles.routingField}>
              <Text style={styles.routingName}>{memoData.from.name}</Text>
              <Text style={styles.routingDetail}>{memoData.from.title}</Text>
              <Text style={styles.routingDetail}>
                {memoData.from.department}
              </Text>
            </View>
          </View>
        </View>

        {/* Subject */}
        <View style={styles.subjectSection}>
          <Text style={styles.subjectTitle}>Subject</Text>
          <Text style={styles.subjectText}>{memoData.subject}</Text>
        </View>

        {/* Description */}
        <View style={styles.descriptionSection}>
          <Text style={styles.descriptionTitle}>Executive Summary</Text>
          <Text style={styles.descriptionText}>{memoData.description}</Text>
        </View>

        {/* Financial Breakdown */}
        <View style={styles.financialSection}>
          <View style={styles.financialHeader}>
            <Text style={styles.financialTitle}>Financial Breakdown</Text>
          </View>
          <View style={styles.financialContent}>
            {memoData.expenses.map((category, categoryIndex) => (
              <View key={categoryIndex} style={styles.categorySection}>
                <View style={styles.expenseTable}>
                  <View style={styles.tableHeader}>
                    <Text
                      style={[styles.tableHeaderCell, styles.tableCellName]}
                    >
                      Description
                    </Text>
                    <Text style={[styles.tableHeaderCell, styles.tableCellQty]}>
                      Qty
                    </Text>
                    <Text
                      style={[styles.tableHeaderCell, styles.tableCellPrice]}
                    >
                      Unit Price
                    </Text>
                    <Text
                      style={[styles.tableHeaderCell, styles.tableCellTotal]}
                    >
                      Total
                    </Text>
                  </View>

                  {category.items.map((item, itemIndex) => (
                    <View key={itemIndex} style={styles.tableRow}>
                      <Text style={[styles.tableCell, styles.tableCellName]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.tableCell, styles.tableCellQty]}>
                        {formatNumber(item.qty)}
                      </Text>
                      <Text style={[styles.tableCell, styles.tableCellPrice]}>
                        {formatNumber1(item.unitPrice)}
                      </Text>
                      <Text style={[styles.tableCell, styles.tableCellTotal]}>
                        {formatNumber1(item.total)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            <View style={styles.grandTotalSection}>
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>GRAND TOTAL:</Text>
                <Text style={styles.grandTotalAmount}>
                  {formatNumber1(memoData.grandTotal)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Business Justification */}
        <View style={styles.justificationSection}>
          <Text style={styles.justificationTitle}>Business Justification</Text>
          <View style={styles.justificationList}>
            {memoData.justification.map((point, index) => (
              <View key={index} style={styles.justificationItem}>
                <View style={styles.justificationBullet}></View>
                <Text style={styles.justificationText}>{point}</Text>
              </View>
            ))}
          </View>
        </View>
        {/* Authorization Section */}
        <View style={styles.authorizationSection}>
          <View style={styles.authHeader}>
            <Text style={styles.authTitle}>Authorization</Text>
          </View>
          <View style={styles.authContent}>
            <View style={styles.remarksSection}>
              <Text style={styles.remarksTitle}>Final Remarks:</Text>
              <Text style={styles.remarksText}>{memoData.finalRemarks}</Text>
            </View>

            <View style={styles.signaturesContainer}>
              <View style={styles.signatureBox}>
                <Text style={styles.signatureRole}>Reviewed By</Text>
                <Text style={styles.signatureName}>
                  {memoData.reviewedBy.name}
                </Text>
                <Text style={styles.signatureTitle}>
                  {memoData.reviewedBy.title}
                </Text>
                <View style={styles.signatureLine}></View>
                <Text style={styles.signatureDate}>
                  Date: {memoData.reviewedBy.date}
                </Text>
              </View>

              <View style={[styles.signatureBox, styles.signatureBoxApproved]}>
                <Text
                  style={[styles.signatureRole, styles.signatureRoleApproved]}
                >
                  Approved By
                </Text>
                <Text style={styles.signatureName}>
                  {memoData.approvedBy.name}
                </Text>
                <Text style={styles.signatureTitle}>
                  {memoData.approvedBy.title}
                </Text>
                <View style={styles.signatureLine}></View>
                <Text style={styles.signatureDate}>
                  Date: {memoData.approvedBy.date}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This is a computer-generated corporate memorandum • Generated:{" "}
            {new Date().toLocaleDateString("en-GB")}
          </Text>
          <Text style={styles.footerText}>
            For questions, contact:{" "}
            {memoData.from.email || "corporate@brainstormmaingroup.com"}
          </Text>
          <Text style={styles.footerBrand}>
            {memoData.company.toUpperCase()} • {memoData.classification}{" "}
            DOCUMENT • AUTHORIZED PERSONNEL ONLY
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

// Main Application Component
const PurchaseOrderPdf = () => {
  const [isMobile, setIsMobile] = useState(false);
  const { activeBusiness } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const query = useQuery();
  const memo_id = query.get("memo_id");
  const getMemos = useCallback(() => {
    _fetchApi(
      `/account/get-memo-data-by-id?facilityId=${activeBusiness.id}&memo_id=${memo_id}`,
      (data) => {
        setLoading(false);
        if (data.success) {
          // const { data } = data;
          setData(data.data);
        }
      },
      (err) => {
        setLoading(false);
        console.log(err);
      }
    );
  }, [activeBusiness.id, memo_id]);

  useEffect(() => {
    if (activeBusiness?.id && memo_id) {
      getMemos();
    }
  }, [activeBusiness, memo_id, getMemos]);

  return (
    <div className="p-0 bg-gray-50">
      {!data ? (
        <div></div> // Or "No data available"
      ) : (
        <>
          <CustomCard back header="Memo PDF">
            {isMobile ? (
              <PDFDownloadLink
                document={<CorporateMemoPDF memoData={data} />}
                fileName={`BRAINSTORM-Corporate-Memo-${data.memoId}-Enhanced.pdf`}
                className="flex items-center gap-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 shadow-lg shadow-purple-500/25 font-semibold"
              >
                {({ loading }) => (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    {loading ? "Generating PDF..." : "Download PDF"}
                  </>
                )}
              </PDFDownloadLink>
            ) : (
              <div
                className="bg-white rounded-2xl shadow-lg overflow-hidden"
                style={{ height: "800px" }}
              >
                <PDFViewer
                  width="100%"
                  height="100%"
                  className="border-0 rounded-2xl"
                >
                  <CorporateMemoPDF memoData={data} />
                </PDFViewer>
              </div>
            )}
          </CustomCard>
        </>
      )}
    </div>
  );
};

export default PurchaseOrderPdf;
