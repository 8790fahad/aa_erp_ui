import React from "react";
import { View, Text, Document, Page, StyleSheet } from "@react-pdf/renderer";
import PropTypes from "prop-types";
import moment from "moment";
import { formatNumber } from "@/utilities";

const FinalInvoice = ({
  data = [],
  total = 0,
  info = {},
  busInfo = {},
  receiptNo,
  users = {},
  _customerName = "",
}) => {

  const totalQty = data.reduce((acc, item) => {
    const qty = item.quantity_in > 0 ? item.quantity_in : item.quantity_out;
    return acc + (qty || 0);
  }, 0);

  return (
    <>
      {/* <div>{JSON.stringify(data)}</div> */}
      <Document>
        <Page style={styles.body}>
          <Text style={styles.header} fixed>
            {"Sales Invoice"}
          </Text>

          <View style={styles.addressContainer}>
            <View style={styles.addressSection}>
              <Text>From</Text>
              <Text style={styles.subtitle}>{busInfo?.business_name}</Text>
              <Text style={styles.text}>{busInfo?.business_address}</Text>
              <Text style={styles.text}>Phone: {busInfo?.business_phone}</Text>
              <Text style={styles.text}>Operator: {users?.username}</Text>
            </View>

            <View style={styles.addressSection}>
              <Text>For</Text>
              <Text style={styles.subtitle}>Customer Name:</Text>
              <Text style={styles.subtitle1}>{_customerName}</Text>
              <Text style={styles.text}>Client Address:</Text>
              <Text style={styles.subtitle1}>{info?.address}</Text>
              <Text style={styles.text}>Phone: {info?.phone || ""}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.invoiceInfo}>
            <Text style={styles.text}>Invoice Number: {receiptNo}</Text>
            <Text style={styles.text}>
              Date: {moment(info?.createdAt).format("DD/MM/YYYY")}
            </Text>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <View style={styles.tableColumn}>
                <Text style={styles.headerCell}>Description</Text>
              </View>
              {/* <View style={styles.tableColumn}>
                <Text style={styles.headerCell}>Price</Text>
              </View> */}
              <View style={styles.tableColumn}>
                <Text style={styles.headerCell}>Qty</Text>
              </View>
              <View style={styles.tableColumn}>
                <Text style={styles.headerCell}>Unit of Measure</Text>
              </View>
            </View>

            {data.map((item, index) => (
              <View style={styles.tableRow} key={index}>
                <View style={styles.tableColumn}>
                  <Text style={styles.leftAlignCell}>
                    {`${item.type} - ${item.material_type}` || item.item_name}
                  </Text>
                </View>
                {/* <View style={styles.tableColumn}>
                  <Text style={styles.rightAlignCell}>
                    {formatNumber(item.selling_price || item.cost)}
                  </Text>
                </View> */}
                <View style={styles.tableColumn}>
                  <Text style={styles.centerAlignCell}>
                    {item.quantity_in > 0
                      ? formatNumber(item.quantity_in)
                      : formatNumber(item.quantity_out)}
                  </Text>
                </View>
                <View style={styles.tableColumn}>
                  <Text style={styles.centerAlignCell}>
                    {(item.unit)}
                  </Text>
                </View>
              </View>
            ))}

            <View style={styles.summaryRow}>
              <View style={styles.summaryColumn}>
                <Text style={styles.summaryText}>
                  Total Quantity: {formatNumber(totalQty)} {data[0].unit}
                </Text>
                {/* <Text style={styles.summaryText}>Discount (0%): 0.00</Text>
                <Text style={styles.summaryText}>
                  Grand Total: N{formatNumber(total)}
                </Text> */}
              </View>
            </View>
          </View>

          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
            fixed
          />
        </Page>
      </Document>
    </>
  );
};

FinalInvoice.propTypes = {
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
  info: PropTypes.shape({
    type: PropTypes.string,
    address: PropTypes.string,
    phone: PropTypes.string,
    createdAt: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(Date),
    ]),
  }),
  busInfo: PropTypes.shape({
    business_name: PropTypes.string,
    business_address: PropTypes.string,
    business_phone: PropTypes.string,
  }),
  receiptNo: PropTypes.string,
  users: PropTypes.shape({
    username: PropTypes.string,
  }),
  _customerName: PropTypes.string,
};

const styles = StyleSheet.create({
  body: {
    paddingTop: 35,
    paddingBottom: 65,
    paddingHorizontal: 35,
  },
  header: {
    fontSize: 20,
    marginBottom: 10,
    textAlign: "center",
    color: "black",
  },
  addressContainer: {
    flexDirection: "row",
    marginTop: 10,
  },
  addressSection: {
    flex: 1,
  },
  subtitle: {
    fontSize: 18,
    marginTop: 4,
  },
  subtitle1: {
    fontSize: 13,
    marginTop: 2,
  },
  text: {
    margin: 2,
    fontSize: 14,
  },

  invoiceInfo: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  table: {
    width: "100%",
    marginTop: 20,
  },

  divider: {
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "black",
    marginTop: 20,
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: "green",
  },

  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "#ddd",
  },

  tableColumn: {
    width: "33.33%",
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: "#ddd",
  },

  headerCell: {
    margin: 5,
    fontSize: 14,
    color: "white",
    textAlign: "center",
  },
  leftAlignCell: {
    margin: 5,
    fontSize: 12,
    textAlign: "left",
  },
  centerAlignCell: {
    margin: 5,
    fontSize: 12,
    textAlign: "center",
  },
  rightAlignCell: {
    margin: 5,
    fontSize: 12,
    textAlign: "right",
  },
  summaryRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  summaryColumn: {
    width: "100%",
  },
  summaryText: {
    fontSize: 14,
    textAlign: "right",
    marginBottom: 4,
  },
  pageNumber: {
    position: "absolute",
    fontSize: 12,
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: "center",
    color: "grey",
  },
});

export default FinalInvoice;
