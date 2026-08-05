import { View, Text, Document, Page, StyleSheet } from "@react-pdf/renderer";
import PropTypes from "prop-types";
import moment from "moment";
import { formatNumber } from "@/utilities";

const SalesReceipt = ({
  data = [],
  total = 0,
  grandTotal = 0,
  balance = 0,
  info = {},
  receiptNo = "",
  busInfo = {},
  users = {},
  _customerName = "",
}) => {
  return (
    <Document>
      <Page style={styles.body}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.businessName}>{busInfo?.business_name}</Text>
          <Text style={styles.receiptTitle}>SALES RECEIPT</Text>
          <Text style={styles.businessInfo}>
            {busInfo?.business_address} • Tel: {busInfo?.business_phone}
          </Text>
        </View>

        {/* Receipt Info */}
        <View style={styles.receiptInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Receipt No:</Text>
            <Text style={styles.infoValue}>{receiptNo}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date:</Text>
            <Text style={styles.infoValue}>
              {moment(info?.createdAt).format("DD/MM/YYYY h:mm A")}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Customer:</Text>
            <Text style={styles.infoValue}>{_customerName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Attendant:</Text>
            <Text style={styles.infoValue}>{users?.username}</Text>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, styles.colItem]}>ITEM</Text>
            <Text style={[styles.tableCell, styles.colQty]}>QTY</Text>
            {/* <Text style={[styles.tableCell, styles.colPrice]}>PRICE</Text> */}
            <Text style={[styles.tableCell, styles.colAmount]}>AMOUNT</Text>
          </View>

          {/* Table Rows */}
          {data.map((item, index) => (
            <View style={styles.tableRow} key={index}>
              <Text style={[styles.tableCell, styles.colItem]}>
                {(item.type && item.material_type)
                  ? `${item.type} - ${item.material_type}`
                  : item.item_name}
              </Text>
              <Text style={[styles.tableCell, styles.colQty]}>
                {item.quantity_in > 0
                  ? formatNumber(item.quantity_in)
                  : formatNumber(item.quantity_out)}
              </Text>
              {/* <Text style={[styles.tableCell, styles.colPrice]}>
                {formatNumber(item.selling_price || item.cost)}
              </Text> */}
              <Text style={[styles.tableCell, styles.colAmount]}>
                {formatNumber(item.amount)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>{formatNumber(total)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax:</Text>
            <Text style={styles.totalValue}>
              {formatNumber(grandTotal - total)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL:</Text>
            <Text style={styles.grandTotalValue}>
              {formatNumber(grandTotal)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Amount Paid:</Text>
            <Text style={styles.totalValue}>
              {formatNumber(grandTotal - balance)}
            </Text>
          </View>
          {balance > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.balanceLabel}>Balance Due:</Text>
              <Text style={styles.balanceValue}>{formatNumber(balance)}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Thank you for your patronage!</Text>
          <Text style={styles.footerNote}>
            Goods sold are not returnable except with original receipt
          </Text>
        </View>

        {/* Page Number */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
};

// Prop Types
SalesReceipt.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      description: PropTypes.string,
      item_name: PropTypes.string,
      selling_price: PropTypes.number,
      cost: PropTypes.number,
      quantity: PropTypes.number,
    })
  ),
  total: PropTypes.number,
  grandTotal: PropTypes.number,
  balance: PropTypes.number,
  info: PropTypes.shape({
    createdAt: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(Date),
    ]),
  }),
  receiptNo: PropTypes.string,
  busInfo: PropTypes.shape({
    business_name: PropTypes.string,
    business_address: PropTypes.string,
    business_phone: PropTypes.string,
  }),
  users: PropTypes.shape({
    username: PropTypes.string,
  }),
  _customerName: PropTypes.string,
};

// Styles
const styles = StyleSheet.create({
  body: {
    padding: 30,
    fontSize: 12,
    lineHeight: 1.4,
  },
  header: {
    marginBottom: 20,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    borderBottomStyle: "solid",
    paddingBottom: 10,
  },
  businessName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  receiptTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  businessInfo: {
    fontSize: 10,
    color: "#555",
  },
  receiptInfo: {
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  infoLabel: {
    width: 80,
    fontWeight: "bold",
  },
  infoValue: {
    flex: 1,
  },
  table: {
    width: "100%",
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    borderBottomStyle: "solid",
    paddingBottom: 5,
    marginBottom: 5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    borderBottomStyle: "solid",
  },
  tableCell: {
    padding: 2,
    fontSize: 10,
  },
  colItem: {
    width: "50%",
  },
  colQty: {
    width: "25%",
    textAlign: "right",
  },
  colPrice: {
    width: "20%",
    textAlign: "right",
  },
  colAmount: {
    width: "25%",
    textAlign: "right",
    fontWeight: "bold",
  },
  totals: {
    marginTop: 10,
    marginLeft: "auto",
    width: "40%",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  totalLabel: {
    fontWeight: "bold",
  },
  totalValue: {
    textAlign: "right",
  },
  grandTotalLabel: {
    fontWeight: "bold",
    fontSize: 14,
  },
  grandTotalValue: {
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "right",
  },
  balanceLabel: {
    fontWeight: "bold",
    color: "#d9534f",
  },
  balanceValue: {
    color: "#d9534f",
    textAlign: "right",
  },
  footer: {
    marginTop: 30,
    textAlign: "center",
    fontSize: 10,
    color: "#555",
  },
  footerText: {
    fontWeight: "bold",
    marginBottom: 5,
  },
  footerNote: {
    fontStyle: "italic",
  },
  pageNumber: {
    position: "absolute",
    fontSize: 10,
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: "center",
    color: "#999",
  },
});

export default SalesReceipt;
