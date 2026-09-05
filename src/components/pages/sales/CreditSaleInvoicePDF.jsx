import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFViewer,
} from "@react-pdf/renderer";
import moment from "moment";
import { formatNumber1 } from "@/components/router/utilities";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Times-Roman",
    backgroundColor: "#F5F5DC",
  },
  header: {
    textAlign: "center",
    marginBottom: 5,
  },
  companyName: {
    fontSize: 20,
    letterSpacing: 3,
    fontFamily: "Times-Bold",
  },
  subHeader: {
    fontSize: 9,
    marginTop: 2,
  },
  rcNumber: {
    position: "absolute",
    right: 0,
    top: 0,
    fontSize: 10,
  },
  contactInfo: {
    fontSize: 7,
    textAlign: "center",
    marginBottom: 15,
  },
  infoSection: {
    flexDirection: "row",
    marginBottom: 15,
  },
  leftBox: {
    width: "50%",
    paddingRight: 10,
  },
  rightBox: {
    width: "50%",
    paddingLeft: 10,
  },
  row: {
    flexDirection: "row",
    borderBottom: "1px solid #000",
    paddingVertical: 3,
  },
  label: {
    width: "40%",
    fontFamily: "Times-Bold",
  },
  value: {
    width: "60%",
    backgroundColor: "#D3D3D3",
    paddingLeft: 5,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1px solid #000",
    paddingBottom: 3,
    marginBottom: 5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 2,
  },
  col1: {
    width: "50%",
  },
  col2: {
    width: "15%",
    textAlign: "right",
  },
  col3: {
    width: "18%",
    textAlign: "right",
  },
  col4: {
    width: "17%",
    textAlign: "right",
  },
  discountRow: {
    marginTop: 5,
    paddingVertical: 3,
    borderTop: "1px solid #000",
  },
  totalSection: {
    marginTop: 10,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    width: "50%",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  grandTotal: {
    borderTop: "2px solid #000",
    borderBottom: "2px solid #000",
    paddingVertical: 3,
    fontFamily: "Times-Bold",
  },
  footer: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerLeft: {
    width: "40%",
  },
  footerRight: {
    width: "55%",
  },
  footerRow: {
    flexDirection: "row",
    paddingVertical: 2,
  },
  footerLabel: {
    width: "45%",
  },
  signature: {
    marginTop: 15,
    fontSize: 12,
    fontFamily: "Times-Bold",
  },
  note: {
    marginTop: 10,
    fontSize: 7,
    fontStyle: "italic",
  },
  divider: {
    borderTop: "2px solid #000",
    marginVertical: 25,
  },
  deliveryHeader: {
    fontSize: 18,
    fontFamily: "Times-Bold",
    textAlign: "center",
  },
  deliveryNumber: {
    position: "absolute",
    right: 0,
    fontSize: 14,
    fontFamily: "Times-Bold",
  },
  deliveryRow: {
    flexDirection: "row",
    paddingVertical: 2,
  },
  deliveryLabel: {
    width: "40%",
    fontFamily: "Times-Bold",
  },
  deliveryValue: {
    width: "60%",
  },
  descriptionBox: {
    border: "1px solid #000",
    minHeight: 80,
    marginVertical: 10,
    padding: 5,
  },
  vehicleRow: {
    flexDirection: "row",
    borderTop: "1px solid #000",
    borderBottom: "1px solid #000",
    paddingVertical: 3,
    marginVertical: 5,
  },
  vehicleCol: {
    width: "50%",
    fontFamily: "Times-Bold",
  },
  receivedSection: {
    marginTop: 10,
    border: "1px solid #000",
    padding: 5,
  },
  receivedRow: {
    flexDirection: "row",
  },
  receivedLabel: {
    width: "70%",
    fontFamily: "Times-Bold",
  },
  noteSection: {
    marginTop: 10,
    fontSize: 7,
  },
});

function CreditSaleInvoicePDFViewer({
  invoiceData,
  business,
  customer,
  date,
  isCustomerCopy = false,
  copyType = "ORIGINAL",
  customPricing = false,
  customPrices = {},
  customerCopyEnabled = false,
  customerCopyPrices = {},
}) {
  const {
    transaction,
    items,
    subtotal,
    totalTax,
    totalAmount,
    taxes,
    discount,
  } = invoiceData;

  // Check if customer copy pricing is different from original pricing
  const hasDifferentPricing =
    customerCopyEnabled &&
    items?.some((item) => {
      const originalPrice =
        customPricing && customPrices[item.id] !== undefined
          ? customPrices[item.id]
          : item.selling_price;
      const customerPrice =
        customerCopyPrices[item.id] !== undefined
          ? customerCopyPrices[item.id]
          : item.selling_price;
      return originalPrice !== customerPrice;
    });

  // If customer copy is enabled and has different pricing, show both PDFs
  if (customerCopyEnabled && hasDifferentPricing) {
    return (
      <div style={{ display: "flex", height: "100vh" }}>
        {/* Original PDF */}
        <div style={{ width: "50%", borderRight: "2px solid #ccc" }}>
          <PDFViewer style={{ width: "100%", height: "100vh" }}>
            <Document>
              <Page size="A4" style={styles.page}>
                {renderInvoiceContent(false)}
              </Page>
            </Document>
          </PDFViewer>
        </div>

        {/* Customer Copy PDF */}
        <div style={{ width: "50%" }}>
          <PDFViewer style={{ width: "100%", height: "100vh" }}>
            <Document>
              <Page size="A4" style={styles.page}>
                {renderInvoiceContent(true)}
              </Page>
            </Document>
          </PDFViewer>
        </div>
      </div>
    );
  }

  // Single PDF view (either original or customer copy)
  return (
    <PDFViewer style={{ width: "100%", height: "100vh" }}>
      <Document>
        <Page size="A4" style={styles.page}>
          {renderInvoiceContent(isCustomerCopy)}
        </Page>
      </Document>
    </PDFViewer>
  );

  // Extract invoice content rendering into a separate function
  function renderInvoiceContent(isCustomerCopy) {
    // Calculate actual subtotal with custom pricing if enabled
    const actualSubtotal = customPricing
      ? items.reduce((sum, item) => {
          const price =
            customPrices[item.id] !== undefined
              ? customPrices[item.id]
              : item.selling_price;
          return sum + price * item.quantity_sold;
        }, 0)
      : subtotal;

    // Calculate customer copy subtotal if customer copy is enabled
    const customerCopySubtotal =
      customerCopyEnabled && isCustomerCopy
        ? items.reduce((sum, item) => {
            const price =
              customerCopyPrices[item.id] !== undefined
                ? customerCopyPrices[item.id]
                : item.selling_price;
            return sum + price * item.quantity_sold;
          }, 0)
        : actualSubtotal;

    // Calculate customer copy tax
    const customerCopyTotalTax =
      customerCopyEnabled && isCustomerCopy
        ? (customerCopySubtotal *
            parseFloat(
              taxes?.reduce((sum, tax) => sum + parseFloat(tax.rate), 0) || 0
            )) /
          100
        : totalTax;

    // Calculate customer copy total
    const customerCopyTotalAmount =
      customerCopyEnabled && isCustomerCopy
        ? customerCopySubtotal + customerCopyTotalTax
        : totalAmount;

    return (
      <>
        {/* Invoice Section */}
        <View style={styles.header}>
          <View style={{ position: "relative" }}>
            <Text style={styles.companyName}>
              {business?.business_name || "Business Name"}
            </Text>
            <Text style={styles.rcNumber}>
              RC. {business?.registration_number || "N/A"}
            </Text>
          </View>
          <Text style={styles.subHeader}>
            Manufacturers Of Industrial / Domestic Gases
          </Text>
        </View>

        <Text style={styles.contactInfo}>
          {business?.business_address || "Address"} Tel:{" "}
          {business?.business_phone || "Phone"}, Email:{" "}
          {business?.email || "email@example.com"}
        </Text>

        <View style={styles.infoSection}>
          <View style={styles.leftBox}>
            <View style={styles.row}>
              <Text style={styles.label}>Account No.:</Text>
              <Text style={styles.value}>{customer?.customerNo || "N/A"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Account Name:</Text>
              <Text style={styles.value}>
                {customer?.customer_name || customer?.fullname || "N/A"}
              </Text>
            </View>
          </View>

          <View style={styles.rightBox}>
            <View style={styles.row}>
              <Text style={styles.label}>Invoice Customer Copy No:</Text>
              <Text style={styles.value}>{transaction?.id || "N/A"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>DATE:</Text>
              <Text style={styles.value}>
                {moment(date).format("DD/MMM/YY")}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.col1, { fontFamily: "Times-Bold", fontSize: 11 }]}>
              Description
            </Text>
            <Text style={[styles.col2, { fontFamily: "Times-Bold", fontSize: 11 }]}>
              Quantity
            </Text>
            <Text style={[styles.col3, { fontFamily: "Times-Bold", fontSize: 11 }]}>
              Unit Price
            </Text>
            <Text style={[styles.col4, { fontFamily: "Times-Bold", fontSize: 11 }]}>
              Amount
            </Text>
          </View>

          {items?.map((item, index) => {
            let displayPrice, displayAmount;

            if (customerCopyEnabled && isCustomerCopy) {
              displayPrice =
                customerCopyPrices[item.id] !== undefined
                  ? customerCopyPrices[item.id]
                  : item.selling_price;
              displayAmount = displayPrice * item.quantity_sold;
            } else {
              displayPrice =
                customPricing && customPrices[item.id] !== undefined
                  ? customPrices[item.id]
                  : item.selling_price;
              displayAmount = displayPrice * item.quantity_sold;
            }

            return (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.col1, { fontSize: 11, fontFamily: "Times-Bold" }]}>
                  {item.item_name} {item.multiplier_type}
                </Text>
                <Text style={[styles.col2, { fontSize: 10 }]}>{item.quantity_sold}</Text>
                <Text style={[styles.col3, { fontSize: 10 }]}>{formatNumber1(displayPrice)}</Text>
                <Text style={[styles.col4, { fontSize: 10 }]}>{formatNumber1(displayAmount)}</Text>
              </View>
            );
          })}

          {discount && discount.amount > 0 && (
            <View style={styles.discountRow}>
              <Text style={{ fontFamily: "Times-Bold" }}>
                LESS DISCOUNT OF{" "}
                {discount.type === "percentage"
                  ? `${discount.value}%`
                  : "FIXED"}{" "}
                ON TOTAL VALUE
              </Text>
              <Text style={{ textAlign: "right", marginTop: 3 }}>
                -{formatNumber1(discount.amount)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={{ fontFamily: "Times-Bold" }}>T O T A L:</Text>
            <Text>
              {formatNumber1(
                customerCopyEnabled && isCustomerCopy
                  ? customerCopySubtotal
                  : actualSubtotal
              )}
            </Text>
          </View>
          {taxes && taxes.length > 0 && (
            <View style={styles.totalRow}>
              <Text style={{ fontFamily: "Times-Bold" }}>
                V A T {taxes[0]?.rate}%:
              </Text>
              <Text>
                {formatNumber1(
                  customerCopyEnabled && isCustomerCopy
                    ? customerCopyTotalTax
                    : totalTax
                )}
              </Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text>GRAND T O T A L:</Text>
            <Text>
              {formatNumber1(
                customerCopyEnabled && isCustomerCopy
                  ? customerCopyTotalAmount
                  : totalAmount
              )}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>Receipt No</Text>
              <Text></Text>
            </View>
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>Delivery Order No</Text>
              <Text>{transaction?.id || "N/A"}</Text>
            </View>
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>Customer Name</Text>
              <Text>
                {customer?.customer_name || customer?.fullname || "N/A"}
              </Text>
            </View>
          </View>

          <View style={styles.footerRight}>
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>Prepared By:</Text>
              <Text>System</Text>
            </View>
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>Checked By:</Text>
              <Text></Text>
            </View>
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>Authorised By:</Text>
              <Text>System</Text>
            </View>
          </View>
        </View>

        <Text style={styles.signature}>Signature</Text>
        <Text style={{ fontSize: 11, fontFamily: "Times-Bold", marginTop: 5 }}>
          FOR {business?.business_name || "COMPANY"}
        </Text>
        <Text style={styles.note}>
          The Company will not accept refund claim on Gases or any other goods
          once they are sold to customers
        </Text>

        {/* Attachments Section */}
        {invoiceData?.attachments && invoiceData.attachments.length > 0 && (
          <View style={{ marginTop: 15, marginBottom: 10 }}>
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Times-Bold",
                marginBottom: 5,
              }}
            >
              ATTACHMENTS:
            </Text>
            {invoiceData.attachments.map((file, index) => (
              <Text
                key={index}
                style={{ fontSize: 10, marginLeft: 10, marginBottom: 2 }}
              >
                • {file.name}
              </Text>
            ))}
          </View>
        )}

        {/* Delivery Order Section */}
        <View style={styles.divider}></View>

        <View style={styles.header}>
          <View style={{ position: "relative" }}>
            <Text style={styles.companyName}>
              {business?.business_name || "Business Name"}
            </Text>
            <Text style={styles.rcNumber}>
              RC. {business?.registration_number || "N/A"}
            </Text>
          </View>
          <Text style={styles.subHeader}>
            Manufacturers Of Industrial / Domestic Gases
          </Text>
        </View>

        <Text style={styles.contactInfo}>
          {business?.business_address || "Address"} Tel:{" "}
          {business?.business_phone || "Phone"}, Email:{" "}
          {business?.email || "email@example.com"}
        </Text>

        <View style={{ position: "relative", marginBottom: 15 }}>
          <Text style={[styles.deliveryHeader, { marginBottom: 10 }]}>
            Delivery Order
          </Text>
          <Text style={[styles.deliveryNumber, { top: 0 }]}>
            No: {transaction?.id || "N/A"} D
          </Text>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.leftBox}>
            <View style={styles.deliveryRow}>
              <Text style={styles.deliveryLabel}>To:</Text>
              <Text></Text>
            </View>
            <View style={styles.deliveryRow}>
              <Text style={styles.deliveryLabel}>Account No.:</Text>
              <Text>{customer?.customerNo || "N/A"}</Text>
            </View>
            <View style={styles.deliveryRow}>
              <Text style={styles.deliveryLabel}>Account Name:</Text>
              <Text>
                {customer?.customer_name || customer?.fullname || "N/A"}
              </Text>
            </View>
          </View>

          <View style={styles.rightBox}>
            <View style={styles.deliveryRow}>
              <Text style={styles.deliveryLabel}>DATE:</Text>
              <Text>{moment(date).format("DD/MMM/YY")}</Text>
            </View>
            <View style={styles.deliveryRow}>
              <Text style={styles.deliveryLabel}>YOUR L.P.O. NO</Text>
              <Text></Text>
            </View>
            <View style={styles.deliveryRow}>
              <Text style={styles.deliveryLabel}>OUR INVOICE NO</Text>
              <Text>{transaction?.id || "N/A"}</Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", marginBottom: 5 }}>
          <Text style={[styles.col1, { fontFamily: "Times-Bold" }]}>
            DESCRIPTION
          </Text>
          <Text style={[{ width: "35%", fontFamily: "Times-Bold" }]}>
            SIZES
          </Text>
          <Text
            style={[
              { width: "15%", fontFamily: "Times-Bold", textAlign: "right" },
            ]}
          >
            Quantity
          </Text>
        </View>

        <View style={styles.descriptionBox}>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <View style={{ width: "50%" }}></View>
            <View style={{ width: "50%" }}>
              {items?.map((item, index) => (
                <Text key={item.id}>
                  {item.item_name} {item.multiplier_type} {item.quantity_sold}
                </Text>
              ))}
              <Text style={{ marginTop: 5 }}>
                Total Cylinders:{" "}
                {items?.reduce((sum, item) => sum + item.quantity_sold, 0)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.vehicleRow}>
          <Text style={styles.vehicleCol}>Vehicle No:</Text>
          <Text style={styles.vehicleCol}>DRIVER'S NAME:</Text>
        </View>

        <View style={{ flexDirection: "row", marginVertical: 5 }}>
          <View style={{ width: "50%" }}>
            <Text style={{ fontFamily: "Times-Bold" }}>
              Prepared By:{" "}
              <Text style={{ fontFamily: "Times-Roman" }}>System</Text>
            </Text>
          </View>
          <View style={{ width: "50%" }}>
            <Text style={{ fontFamily: "Times-Bold" }}>
              Authorized By:{" "}
              <Text style={{ fontFamily: "Times-Roman" }}>System</Text>
            </Text>
          </View>
        </View>

        <Text style={{ fontFamily: "Times-Bold", marginTop: 5 }}>
          DELIVERED BY STORES OFFICER:
        </Text>
        <Text style={{ marginTop: 3 }}>
          Received the above items in good condition
        </Text>

        <View style={styles.receivedSection}>
          <View style={styles.receivedRow}>
            <Text style={styles.receivedLabel}>RECEIVED BY: NAME:</Text>
            <Text style={{ fontFamily: "Times-Bold" }}>SIGNATURE</Text>
          </View>
        </View>

        <View style={styles.noteSection}>
          <Text style={{ fontFamily: "Times-Bold" }}>NOTE:</Text>
          <Text style={{ marginTop: 2 }}>
            The safety and security of the cylinders during transport or while
            at storage is the sole responsibility of the customer. They are
            expected to comply with the regulations for gas handling. The
            Company will not accept refund claim on Gases or any other goods
            once they are sold to customers. Prices are subject to Change
            without Notice.
          </Text>
        </View>
      </>
    );
  }
}

export default CreditSaleInvoicePDFViewer;
