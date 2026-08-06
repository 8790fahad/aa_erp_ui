import React, { useCallback, useEffect, useState } from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";
import moment from "moment";
// import { toCamelCase } from '../../utils/helpers';
import customRobotoItalic from "../../../fonts/Roboto-Italic.ttf";
import customRobotoNormal from "../../../fonts/Roboto-Regular.ttf";
import customRobotoBold from "../../../fonts/Roboto-Bold.ttf";
import {
  
  formatNumber,
  
} from "../../../components/UI/helpers";
import ReceiptHeader from "../Receipt/ReceiptHeader";
const SalesReceipt = ({
  logo = "",
  data = [],
  total = 0,
  name = "",
  receiptNo = "",
  modeOfPayment = "Cash",
  cashier = "",
  discount = 0,
  balance = 0,
  grandTotal = 0,
  customerType,
  paymentStatus,
  customerInfo = {},
  amountPaid,
  state,
  busName,
  address,
  phone,
  activeBusiness = {},
}) => {
  // const facilityId = store.getState().auth.user.facilityId;
  // const facility = store.getState().auth.activeBusiness;
  // const [results, setResults] = useState([])
  // const getIds = useCallback(() => {
  //   // let id = params.id;
  //   _postApi(
  //     `/${endpoint}/v1/biz?query_type=select&id=${facilityId}`,
  //     // form,
  //     {},
  //     (data) => {
  //       setResults(data.results);
  //       console.log({ form: data.results[0] });
  //       if (data.results.length) {
  //         let val = data.results && data.results[0][0]

  //         // setForm(p=>({...p, store_id:results.business_name}))
  //       }
  //     },
  //   )
  //   // )

  // }, [facilityId]);
  // useEffect(() => {
  //   getIds();

  // }, [getIds]);

  return (
    <Document>
      <Page size={{ width: 200 }} style={styles.body} wrap={false}>
        <View>
          <ReceiptHeader activeBusiness={activeBusiness} />
          {/* <View style={styles.headerContainer}>
          {facility.business_logo === "" ? null:<Image
              style={styles.image}
              src={facility.business_logo}
            />}           
            <Text style={styles.title}>{facility.business_name}</Text>
            <Text style={styles.subtitle}>{facility.business_address}</Text>
            <Text style={styles.subtitle}>{facility.business_type}</Text>
          </View> */}
          <View style={styles.dateContainer}>
            <Text style={styles.receiptNo}>Receipt No: {receiptNo}</Text>
            <View style={[styles.item, { marginVertical: 0 }]}>
              <Text style={styles.mr5} />
              <Text>{moment().format("DD-MM-YY - hh:mm")}</Text>
            </View>
          </View>
          {name ? (
            <View style={styles.item}>
              <Text style={styles.mr5}>Name:</Text>
              <View>
                {/* <Text>{name}</Text> */}
                <Text>{name && name !== "" ? name : customerInfo.name}</Text>
              </View>
            </View>
          ) : null}
          <View style={styles.item}>
            <Text style={styles.mr5}>Customer Type:</Text>
            {/* <Text></Text> */}
            <View>
              <Text>{name ? "Registered" : "walk-in"}</Text>
            </View>
          </View>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={styles.tableCol1Header}>
                <Text style={styles.tableCellHeader}>Drug</Text>
              </View>
              <View style={styles.tableColHeader}>
                <Text style={styles.tableCellHeader}>Cost</Text>
              </View>
              <View style={styles.tableColHeader}>
                <Text style={[styles.tableCellHeader]}>Qty</Text>
              </View>
              <View style={styles.tableColHeader}>
                <Text style={[styles.tableColAmtHeader]}>Amount (₦)</Text>
              </View>
            </View>
            {data &&
              data?.map((item, index) => (
                <View key={index} style={styles.tableRow}>
                  <View style={styles.tableCol1}>
                    <Text style={styles.tableCell}>{item.item_name}</Text>
                  </View>
                  <View style={styles.tableCol}>
                    <Text style={[styles.tableCell]}>
                      {item.price && item.price.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.tableCol}>
                    <Text style={[styles.tableCell]}>
                      {item.qtty && item.qtty.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.tableColAmt}>
                    <Text style={[styles.tableCell, styles.textRight]}>
                      {item.amount1 && item.amount1.toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            <View style={styles.tableRow}>
              <View style={styles.tableCol1}>
                <Text style={styles.tableCell}>Total</Text>
              </View>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell} />
              </View>

              <View style={[styles.tableColTotal, styles.fontWeightBold]}>
                <Text style={[styles.tableCell, styles.textRight]}>
                  {`₦ ${formatNumber(total)}`}
                </Text>
              </View>
            </View>

            {parseInt(discount) <= 0 ? null : (
              <View style={[styles.tableRow, styles.mt1]}>
                <View style={styles.tableCol1}>
                  <Text style={styles.tableCell}>Discount</Text>
                </View>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell} />
                </View>

                <View style={[styles.tableColTotal, styles.fontWeightBold]}>
                  <Text style={[styles.tableCell, styles.textRight]}>
                    {`₦ ${formatNumber(discount)}`}
                  </Text>
                </View>
              </View>
            )}

            <View style={[styles.tableRow, styles.mt1]}>
              <View style={styles.tableCol1}>
                <Text style={styles.tableCell}>Grand Total</Text>
              </View>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell} />
              </View>

              {/* {parseInt(total - discount) <= 0 ? ( */}
              <View style={[styles.tableColTotal, styles.fontWeightBold]}>
                <Text
                  style={[
                    styles.tableCell,
                    styles.textRight,
                    styles.grandTotal,
                  ]}
                >
                  {`₦ ${formatNumber(grandTotal)}`}
                </Text>
              </View>
              {/* ) : null} */}
            </View>
            {paymentStatus !== "Full Payment" ? (
              <View style={[styles.tableRow]}>
                <View style={styles.tableCol1}>
                  <Text style={styles.tableCell}>Amount Paid</Text>
                </View>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell} />
                </View>

                <View style={[styles.tableColTotal, styles.fontWeightBold]}>
                  <Text style={[styles.tableCell, styles.textRight]}>
                    {/* ${formatNumber(amountPaid) */}
                    {`₦ ${amountPaid || 0} `}
                  </Text>
                </View>
              </View>
            ) : null}
            {/* <Text>{paymentStatus}</Text> */}
            {paymentStatus !== "Full Payment" ? (
              <View style={[styles.tableRow, styles.mt1]}>
                <View style={styles.tableCol1}>
                  <Text style={styles.tableCell}>Balance</Text>
                </View>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell} />
                </View>

                <View style={[styles.tableColTotal, styles.fontWeightBold]}>
                  <Text
                    style={[
                      styles.tableCell,
                      styles.textRight,
                      styles.grandTotal,
                    ]}
                  >
                    {`₦ ${formatNumber(balance) || 0}`}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* 
            <View style={styles.paymentRow}>
              <View style={styles.item}>
                <Text style={styles.mr5}>Payment Status:</Text>
                <Text>{paymentStatus}</Text>
              </View>

              <View style={styles.item}>
                <Text style={styles.mr5}>Balance:</Text>
                {/* <Text>{balance}</Text>
              </View>
            </View>
          ) : null} */}

          <View style={styles.paymentRow}>
            <View style={styles.item}>
              <Text style={styles.mr5}>Mode of payment:</Text>
              <Text>{modeOfPayment}</Text>
            </View>
            <View style={styles.item}>
              <Text style={styles.mr5}>Cashier:</Text>
              <Text>{cashier}</Text>
            </View>
          </View>
        </View>
        <View style={styles.goodbyeTextContainer}>
          <Text style={styles.goodbyeText}>
            Thanks for coming, get well soon!
          </Text>
        </View>
        <Text style={styles.poweredBy}>This solution is powered by Nexifour Limited</Text>
      </Page>
    </Document>
  );
};

Font.register({
  family: "CustomRoboto",
  fonts: [
    { src: customRobotoNormal },
    {
      src: customRobotoBold,
      fontStyle: "normal",
      fontWeight: "bold",
    },
    {
      src: customRobotoItalic,
      fontStyle: "italic",
    },
  ],
});

const COL1_WIDTH = 40;
const COL_AMT_WIDTH = 20;
const COLN_WIDTH = (100 - (COL1_WIDTH + COL_AMT_WIDTH)) / 2;

const styles = StyleSheet.create({
  body: {
    paddingVertical: 5,
    fontSize: 8,
    paddingHorizontal: 10,
    fontFamily: "CustomRoboto",
  },
  image: {
    height: 40,
    width: 40,
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
    fontSize: 8,
    // textAlign: 'center',
    fontFamily: "CustomRoboto",
  },
  subtitle: {
    fontSize: 8,
    fontFamily: "CustomRoboto",
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
  },
  tableColHeader: {
    width: COLN_WIDTH + "%",
  },
  tableColAmtHeader: {
    width: COL_AMT_WIDTH + "%",
  },
  tableCol1: {
    width: COL1_WIDTH + "%",
  },
  tableColAmt: {
    width: COL_AMT_WIDTH + "%",
  },
  tableCol: {
    width: COLN_WIDTH + "%",
  },
  tableColTotal: {
    width: 2 * COLN_WIDTH + "%",
  },
  tableCellHeader: {
    // marginRight: 5,
    fontWeight: "bold",
  },
  tableCell: {
    marginVertical: 1,
    // marginRight: 4,
  },
  goodbyeText: {
    fontSize: 8,
    textTransform: "capitalize",
    textAlign: "center",
  },
  goodbyeTextContainer: {
    marginTop: 2,
  },
  docTitle: {
    marginVertical: 6,
    fontSize: 10,
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
  receiptNo: {
    fontWeight: "bold",
  },
  dateContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  poweredBy: {
    fontSize: 8,
    marginTop: 6,
    textAlign: "center",
    fontFamily: "CustomRoboto",
    fontStyle: "italic",
  },
  amtCol: {},
});

export default SalesReceipt;