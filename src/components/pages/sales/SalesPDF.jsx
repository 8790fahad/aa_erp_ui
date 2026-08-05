import {
  Document,
  Page,
  PDFViewer,
  StyleSheet,
  View,
  Text,
  Font,
} from "@react-pdf/renderer";

import DM_SANS_NORMAL from "../../../assets/DM_Sans/DM_Sans/static/DMSans_24pt-SemiBold.ttf";
import DM_SANS_BOLD from "../../../assets/DM_Sans/DM_Sans/static/DMSans_24pt-Bold.ttf";
import DM_SANS_ITALIC from "../../../assets/DM_Sans/DM_Sans/static/DMSans-Italic.ttf";
import BackButton from "@/common/BackButton";
import useQuery from "@/hooks/useQuery";
import { useEffect, useState } from "react";
import { _postApi } from "@/redux/actions/api";

import { useSelector } from "react-redux";
import moment from "moment";
import { formatNumber1 } from "@/components/router/utilities";

Font.register({
  family: "DM_SANS",
  fonts: [
    { src: DM_SANS_NORMAL, fontWeight: 700 },
    { src: DM_SANS_BOLD, fontStyle: "bold" },
    { src: DM_SANS_ITALIC, fontStyle: "italic" },
  ],
});

export default function SalesPdf() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const pr_no = useQuery().get("pr_no");
  const [itemList, setItemList] = useState([]);
  const [pr, setPr] = useState([]);
  useEffect(() => {
    _postApi(
      "/account/purchase/getPr",
      {
        query_type: "select-exp",
        pr_no: pr_no,
        // date: moment().format("YYYY-MM-DD"),
        // user_id: user.id,
      },
      (res) => {
        if (res.success) {
          setItemList(res.results);
        }
      },
      (err) => {
        toast.error("Error Occurred");
      }
    );
    _postApi(
      "/account/purchase/getPr",
      {
        query_type: "select-pr",
        pr_no: pr_no,
        facilityId: activeBusiness.id,
      },
      (data) => {
        if (data.success) {
          setPr(data.results[0]);
        }
      },
      (err) => {
        console.log(err);
      }
    );
  }, [pr_no]);
  return (
    <div>
      <BackButton />
      {/* {JSON.stringify(pr)} */}
      <PDFViewer style={{ width: "100%", height: "97vh" }}>
        <Document>
          <Page size="A4" style={styles.page}>
            {/* Header Section */}
            <View style={styles.headerContainer}>
              <View style={styles.companyInfo}>
                <Text style={styles.companyName}>{pr.branch}</Text>
                {/* <Text style={styles.companyDetail}>[Street Address]</Text> */}
                <Text style={styles.companyDetail}>[City, ST ZIP]</Text>
                <Text style={styles.companyDetail}>Phone: (000) 000-0000</Text>
                <Text style={styles.companyDetail}>Fax: (000) 000-0000</Text>
                <Text style={styles.companyDetail}>Website:</Text>
              </View>
              <View style={styles.orderInfo}>
                <Text style={styles.orderTitle}>PURCHASE ORDER</Text>
                <View style={styles.orderDetails}>
                  <View style={styles.orderDetailRow}>
                    <Text style={styles.orderDetailLabel}>DATE</Text>
                    <Text style={styles.orderDetailValue}>
                      {moment(pr.created_at).format("YYYY-MM-DD")}
                    </Text>
                  </View>
                  <View style={styles.orderDetailRow}>
                    <Text style={styles.orderDetailLabel}>PO #</Text>
                    <Text style={styles.orderDetailValue}>{pr.po_no}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Vendor and Ship To Section */}
            <View style={styles.addressContainer}>
              <View style={styles.addressBox}>
                <View style={styles.addressHeader}>
                  <Text style={styles.addressHeaderText}>VENDOR</Text>
                </View>
                <View style={styles.addressContent}>
                  <Text style={styles.addressText}>{pr.supplier_name}</Text>
                  <Text style={styles.addressText}>
                    [Contact or Department]
                  </Text>
                  {/* <Text style={styles.addressText}>[Street Address]</Text>
                  <Text style={styles.addressText}>[City, ST ZIP]</Text>
                  <Text style={styles.addressText}>Phone: (000) 000-0000</Text>
                  <Text style={styles.addressText}>Fax: (000) 000-0000</Text> */}
                </View>
              </View>
              <View style={styles.addressBox1}>
                <View style={styles.addressHeader}>
                  <Text style={styles.addressHeaderText}>SHIP TO</Text>
                </View>
                <View style={styles.addressContent}>
                  <Text style={styles.addressText}>{pr.requisitor}</Text>
                  <Text style={styles.addressText}>{pr.branch}</Text>
                  {/* <Text style={styles.addressText}>[Street Address]</Text>
                  <Text style={styles.addressText}>[City, ST ZIP]</Text>
                  <Text style={styles.addressText}>[Phone]</Text> */}
                </View>
              </View>
            </View>

            {/* Shipping Information */}
            {/* <View style={styles.shippingContainer}>
              <View style={styles.shippingBox}>
                <Text style={styles.shippingHeaderText}>REQUISITIONER</Text>
              </View>
              <View style={styles.shippingBox}>
                <Text style={styles.shippingHeaderText}>SHIP VIA</Text>
              </View>
              <View style={styles.shippingBox}>
                <Text style={styles.shippingHeaderText}>F.O.B.</Text>
              </View>
              <View style={styles.shippingBoxWide}>
                <Text style={styles.shippingHeaderText}>SHIPPING TERMS</Text>
              </View>
            </View> */}

            {/* Item Table Header */}
            <View style={styles.tableHeader}>
              <View style={styles.tableHeaderCell1}>
                <Text style={styles.tableHeaderText}>ITEM </Text>
              </View>
              <View style={styles.tableHeaderCell2}>
                <Text style={styles.tableHeaderText}>DESCRIPTION</Text>
              </View>
              <View style={styles.tableHeaderCell3}>
                <Text style={styles.tableHeaderText}>QTY</Text>
              </View>
              <View style={styles.tableHeaderCell4}>
                <Text style={styles.tableHeaderText}>UNIT PRICE</Text>
              </View>
              <View style={styles.tableHeaderCell5}>
                <Text style={styles.tableHeaderText}>TOTAL</Text>
              </View>
            </View>

            {/* Item Table Rows */}

            {/* Empty Rows */}
            {
              // Array(10)
              //   .fill()
              itemList.map((_, i) => (
                <View key={i} style={styles.tableRow}>
                  <View style={styles.tableCell1}>
                    <Text>{i + 1}</Text>
                  </View>
                  <View style={styles.tableCell2}>
                    <Text>{itemList[i].item_name}</Text>
                  </View>
                  <View style={styles.tableCell3}>
                    <Text>{itemList[i].quantity}</Text>
                  </View>
                  <View style={styles.tableCell4}>
                    <Text>{itemList[i].est_cost}</Text>
                  </View>
                  <View style={styles.tableCell5}>
                    <Text>
                      {formatNumber1(
                        itemList[i].est_cost * itemList[i].quantity
                      )}
                    </Text>
                  </View>
                </View>
              ))
            }

            {/* Totals Section */}
            <View style={styles.totalsContainer}>
              <View style={styles.commentsContainer}>
                <View style={styles.commentsHeader}>
                  <Text style={styles.commentsHeaderText}>
                    Comments or Special Instructions
                  </Text>
                </View>
                <View style={styles.commentsContent}>
                  <Text style={styles.commentsText}>
                    Thank you for your business.
                  </Text>
                </View>
              </View>
              <View style={styles.totalsBox}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>SUBTOTAL</Text>
                  <Text style={styles.totalValue}>
                    {formatNumber1(pr.total)}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>TAX</Text>
                  <Text style={styles.totalValue}></Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>SHIPPING</Text>
                  <Text style={styles.totalValue}></Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>OTHER</Text>
                  <Text style={styles.totalValue}></Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabelFinal}>TOTAL</Text>
                  <Text style={styles.totalValueFinal}>
                    {formatNumber1(pr.total)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                If you have any questions about this purchase order, please
                contact
              </Text>
            </View>
          </Page>
        </Document>
      </PDFViewer>
    </div>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "DM_SANS",
    fontSize: 10,
  },
  headerContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 5,
  },
  companyDetail: {
    marginBottom: 2,
  },
  orderInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  orderTitle: {
    fontSize: 24,
    color: "#6B7DB3",
    fontWeight: "bold",
    marginBottom: 10,
  },
  orderDetails: {
    width: "70%",
  },
  orderDetailRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 5,
  },
  orderDetailLabel: {
    padding: 5,
    width: "40%",
    fontWeight: "bold",
  },
  orderDetailValue: {
    padding: 5,
    width: "60%",
    borderLeftWidth: 1,
    borderLeftColor: "#000",
  },
  addressContainer: {
    flexDirection: "row",
    marginBottom: 10,
  },
  addressBox: {
    flex: 1,
    marginRight: 10,
  },
  addressBox1: {
    flex: 1,
    marginRight: 0,
  },
  addressHeader: {
    backgroundColor: "#3F4D8A",
    padding: 5,
  },
  addressHeaderText: {
    color: "white",
    fontWeight: "bold",
  },
  addressContent: {
    borderWidth: 1,
    borderColor: "#000",
    padding: 5,
  },
  addressText: {
    marginBottom: 2,
  },
  shippingContainer: {
    flexDirection: "row",
    marginBottom: 10,
  },
  shippingBox: {
    flex: 1,
    backgroundColor: "#3F4D8A",
    padding: 5,
    marginRight: 2,
  },
  shippingBoxWide: {
    flex: 2,
    backgroundColor: "#3F4D8A",
    padding: 5,
  },
  shippingHeaderText: {
    color: "white",
    fontWeight: "bold",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#3F4D8A",
    marginBottom: 2,
  },
  tableHeaderCell1: {
    width: "15%",
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: "white",
  },
  tableHeaderCell2: {
    width: "40%",
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: "white",
  },
  tableHeaderCell3: {
    width: "10%",
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: "white",
    textAlign: "center",
  },
  tableHeaderCell4: {
    width: "15%",
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: "white",
    textAlign: "center",
  },
  tableHeaderCell5: {
    width: "20%",
    padding: 5,
    textAlign: "center",
  },
  tableHeaderText: {
    color: "white",
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
  },
  tableCell1: {
    width: "15%",
    padding: 5,
    borderLeftWidth: 1,
    borderLeftColor: "#000",
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  tableCell2: {
    width: "40%",
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  tableCell3: {
    width: "10%",
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: "#000",
    textAlign: "center",
  },
  tableCell4: {
    width: "15%",
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: "#000",
    textAlign: "right",
  },
  tableCell5: {
    width: "20%",
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: "#000",
    textAlign: "right",
  },
  tableCellText: {
    fontSize: 10,
  },
  totalsContainer: {
    flexDirection: "row",
    marginTop: 10,
  },
  commentsContainer: {
    flex: 1,
    marginRight: 10,
  },
  commentsHeader: {
    backgroundColor: "#ccc",
    padding: 5,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#000",
  },
  commentsHeaderText: {
    fontWeight: "bold",
  },
  commentsContent: {
    height: 80,
    borderWidth: 1,
    borderColor: "#000",
    padding: 5,
  },
  commentsText: {
    fontSize: 10,
  },
  totalsBox: {
    width: "30%",
  },
  totalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#000",
  },
  totalLabel: {
    width: "50%",
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: "#000",
    fontWeight: "bold",
  },
  totalLabelFinal: {
    width: "50%",
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: "#000",
    fontWeight: "bold",
    backgroundColor: "#6B7DB3",
    color: "white",
  },
  totalValue: {
    width: "50%",
    padding: 5,
    textAlign: "right",
  },
  totalValueFinal: {
    width: "50%",
    padding: 5,
    textAlign: "right",
    backgroundColor: "#6B7DB3",
    color: "white",
    fontWeight: "bold",
  },
  footer: {
    marginTop: 20,
    textAlign: "center",
  },
  footerText: {
    fontSize: 10,
  },
});
