import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import moment from "moment";
import { formatNumber } from "../../app/utilities";
import { capitalizeFirstLetter, numToWords } from "../../app/components/utils";

const SalesReceipt = ({
  data = [],
  total = 0,
  info,
  busInfo,
  grandTotal,
  balance,
  page,
  receiptNo,
  users,
  _customerName,
}) => {
  return (
    <Document>
      <Page style={styles.body}>
        <View>
          <View style={styles.headerContainer}>
            {/* <Text style={styles.title}>{JSON.stringify(busInfo)}</Text> */}
          </View>
          <View style={styles.headerContainer}>
            <Text style={styles.address}>{busInfo?.business_name}</Text>
          </View>
          <View style={styles.headerContainer}>
            <Text style={styles.address}>
              Address: {busInfo?.business_address}
            </Text>
          </View>
          {/* <Text>{JSON.stringify(data)}</Text>  */}
          <Text style={styles.receipt}>Receipt No.:{receiptNo}</Text>
          <View style={styles.item}>
            <Text style={styles.mr5}>Date:</Text>
            <Text>{moment().format("DD-MM-YYYY - hh:mm a")}</Text>
          </View>
          <View style={styles.item}>
            <Text style={styles.mr5}>Customer Name:</Text>
            <View>
              <Text> {_customerName}</Text>
            </View>
          </View>

          <View style={styles.item}>
            <Text style={styles.mr5}>Operator:</Text>
            <View>
              <Text> {info.userName || users.username}</Text>
            </View>
          </View>
          {/* <View>
            <Text> {JSON.stringify({ data, total: total })} </Text>
          </View> */}
          {/* <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={[styles.tableCol1Header, styles.boderIt]}>
                <Text style={styles.tableCellHeader}>Item Description</Text>
              </View>
              <View style={[styles.tableColHeader, styles.boderIt]}>
                <Text style={[styles.tableCellHeader, styles.textRight]}>
                  Price
                </Text>
              </View>
              <View style={[styles.tableColHeader, styles.boderIt]}>
                <Text style={[styles.tableCellHeader, styles.textCenter]}>
                  Qty
                </Text>
              </View>
              <View style={[styles.tableColHeader, styles.boderIt]}>
                <Text style={[styles.tableCellHeader, styles.textRight]}>
                  Amount
                </Text>
              </View>
              {page ? (
                <View style={[styles.tableColHeader, styles.boderIt]}>
                  <Text style={[styles.tableCellHeader, styles.textRight]}>
                    Status
                  </Text>
                </View>
              ) : null}
            </View>
            {data.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <View style={[styles.tableCol1, styles.boderIt]}>
                  <Text style={styles.tableCell}>{item.description}</Text>
                  {/* {item.item} 
                </View>
                <View style={[styles.tableCol, styles.boderIt]}>
                  <Text style={[styles.tableCell, styles.textRight]}>
                    {formatNumber(item.selling_price)}
                  </Text>
                </View>
                <View style={[styles.tableCol, styles.boderIt]}>
                  <Text style={[styles.tableCell, styles.textCenter]}>
                    {formatNumber(item.quantity)}
                  </Text>
                </View>

                <View style={[styles.tableCol, styles.boderIt]}>
                  <Text style={[styles.tableCell, styles.textRight]}>
                    {formatNumber(item.amount)}
                  </Text>
                </View>
                {page ? (
                  <View style={[styles.tableCol, styles.boderIt]}>
                    <Text style={[styles.tableCell, styles.textRight]}>
                      {formatNumber(item.amount)}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}

            <View style={styles.tableRow}>
              <View style={[styles.tableCol1, styles.boderIt]}>
                <Text style={styles.tableCell}>Total</Text>
              </View>
              <View style={[styles.tableCol, styles.boderIt]}>
                <Text style={styles.tableCell} />
              </View>

              <View
                style={[
                  styles.tableColTotal,
                  styles.fontWeightBold,
                  styles.boderIt,
                ]}
              >
                <Text style={[styles.tableCell, styles.textRight]}>
                  {`${formatNumber(total)}`}
                </Text>
              </View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableCol1}>
                <Text style={styles.tableCell}>Discount</Text>
              </View>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell} />
              </View>

              <View style={[styles.tableColTotal, styles.fontWeightBold]}>
                <Text style={[styles.tableCell, styles.textRight]}>
                  {`${formatNumber(info.discount)}`}
                </Text>
              </View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableCol1}>
                <Text style={styles.tableCell}>Grand Total</Text>
              </View>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell} />
              </View>

              <View style={[styles.tableColTotal, styles.fontWeightBold]}>
                <Text style={[styles.tableCell, styles.textRight]}>
                  {`${formatNumber(grandTotal)}`}
                </Text>
              </View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableCol1}>
                <Text style={styles.tableCell}> Amount Paid</Text>
              </View>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell} />
              </View>

              <View style={[styles.tableColTotal, styles.fontWeightBold]}>
                <Text style={[styles.tableCell, styles.textRight]}>
                  {`${formatNumber(info.amountPaid)}`}
                </Text>
              </View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableCol1}>
                <Text style={styles.tableCell}>Balance</Text>
              </View>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell} />
              </View>

              <View style={[styles.tableColTotal, styles.fontWeightBold]}>
                <Text style={[styles.tableCell, styles.textRight]}>
                  {`${formatNumber(balance)}`}
                </Text>
              </View>
            </View>
          </View> */}
          <View style={styles.item}>
            <Text style={styles.mr5}>Total Amount Paid: </Text>
            <Text>N{formatNumber(total)}</Text>
          </View>
          <View style={styles.item}>
            <Text style={styles.mr5}>Amount in words: </Text>
            <Text>{capitalizeFirstLetter(numToWords(total))} naira only</Text>
          </View>
          <View style={styles.item}>
            <Text style={styles.mr5}>Mode of payment:</Text>
            <Text>{info.modeOfPayment || "Cash"}</Text>
          </View>
        </View>
        <View style={styles.goodbyeTextContainer}>
          <Text style={styles.goodbyeText}>Thanks for patronizing us !</Text>
        </View>
        <View style={styles.goodbyeTextContainer}>
          <Text style={styles.goodbyeText}>Powered by: brainstormng.com</Text>
        </View>
      </Page>
    </Document>
  );
};

// Font.register({
//   family: 'CustomRoboto',
//   fonts: [
//     { src: customRobotoNormal },
//     {
//       src: customRobotoBold,
//       fontStyle: 'normal',
//       fontWeight: 'bold',
//     },
//   ],
// });

const COL1_WIDTH = 40;
const COLN_WIDTH = (100 - COL1_WIDTH) / 3;

const styles = StyleSheet.create({
  body: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 25,
    height: 50,
    width: 50,
  },
  image: {
    height: 50,
    width: 50,
  },
  headerContainer: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  item: {
    flexDirection: "row",
    marginVertical: 3,
  },
  title: {
    fontSize: 40,
    fontWeight: "bold",
    marginVertical: 2,
    marginTop: 15,
  },
  title1: {
    // fontSize: 7,
    alignItems: "left",
    // textAlign: 'center',
    // fontFamily: 'CustomRoboto',
  },

  receipt: {
    // fontSize: 6,
    // fontFamily: 'CustomRoboto',
    marginVertical: 5,
  },
  address: {
    fontSize: 26,
    // fontFamily: 'CustomRoboto',
  },
  table: {
    display: "table",
    width: "100%",
    marginVertical: 6,
  },
  tableRow: {
    flexDirection: "row",
  },
  tableRowTotal: {
    flexDDirection: "row",
  },
  tableCol1Header: {
    width: COL1_WIDTH + "%",
    fontWeight: "bold",
    backgroundColor: "#f1f1f1",
    padding: 5,
    borderRight: 2,
  },
  tableColHeader: {
    width: COLN_WIDTH + "%",
    fontWeight: "bold",
    backgroundColor: "#f1f1f1",
    padding: 5,
    borderRight: 2,
  },
  tableCol1: {
    width: COL1_WIDTH + "%",
  },
  tableCol: {
    width: COLN_WIDTH + "%",
  },
  tableColTotal: {
    width: 2 * COLN_WIDTH + "%",
  },
  tableCellHeader: {
    marginRight: 5,
    fontWeight: "bold",
  },
  tableCell: {
    marginVertical: 1,
    marginRight: 4,
    display: "flex",
  },
  goodbyeText: {
    textTransform: "capitalize",
    textAlign: "center",
    fontSize: 13,
  },
  goodbyeTextContainer: { marginTop: 2 },
  docTitle: {
    marginVertical: 6,
    // fontSize: 9,
    fontWeight: "bold",
  },
  textRight: { textAlign: "right" },
  textCenter: { textAlign: "center" },
  mr5: { marginRight: 5 },
  fontWeightBold: { fontWeight: "bold" },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: "#000",
    borderTopStyle: "solid",
    paddingTop: 3,
  },
  mt1: {
    marginTop: 2,
  },
  boderIt: {
    borderRight: 1,
  },
});

export default SalesReceipt;
