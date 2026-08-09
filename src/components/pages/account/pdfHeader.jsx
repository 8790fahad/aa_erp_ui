import { StyleSheet, Text, View, Image } from "@react-pdf/renderer";
import moment from "moment";

/**
 * React-PDF company header. Respects business.document_header_style: text | logo.
 */
const CompanyHeader = ({
  name,
  description,
  business_address,
  rc,
  business_phone,
  fax,
  business_email,
  business_logo,
  document_header_style,
  title,
  requestNumber,
  requestDate,
}) => {
  const useLogo =
    String(document_header_style || "").toLowerCase() === "logo" &&
    Boolean(business_logo);

  return (
    <View style={styles.modernHeader}>
      <View style={styles.headerTop}>
        <View
          style={[
            styles.companySection,
            useLogo ? { flexDirection: "row", gap: 10, alignItems: "flex-start" } : {},
          ]}
        >
          {useLogo ? (
            <View style={styles.logoBox}>
              <Image src={business_logo} style={styles.logoImage} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <View
              style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}
            >
              <Text style={styles.modernCompanyName}>
                {name?.toUpperCase()}
              </Text>
              {rc ? (
                <Text style={styles.headerCompanyDetails}>RC. {rc}</Text>
              ) : null}
            </View>
            <Text style={styles.companyTagline}>{description || title}</Text>
            <Text style={styles.addressText}>{business_address || "N/A"}</Text>
            <Text style={styles.companyTagline}>
              Tel: {business_phone || "N/A"} | Fax: {fax || "N/A"} | Email:{" "}
              {business_email || "N/A"}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <View style={styles.voucherNumberBox}>
            <Text style={styles.voucherNumberLabel}>{title}</Text>
            <Text style={styles.voucherNumber}>No: {requestNumber}</Text>
          </View>
          <Text style={styles.dateText}>
            Date: {moment(requestDate).format("D MMM, YYYY")}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modernHeader: {
    backgroundColor: "#1a2d5e",
    padding: 10,
    color: "white",
    marginBottom: 0,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  companySection: {
    flex: 1,
  },
  logoBox: {
    width: 52,
    height: 52,
    backgroundColor: "#ffffff",
    borderRadius: 4,
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  logoImage: {
    width: 44,
    height: 44,
    objectFit: "contain",
  },
  modernCompanyName: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 3,
    color: "white",
  },
  companyTagline: {
    fontSize: 10,
    color: "#bfdbfe",
    fontStyle: "italic",
    marginBottom: 2,
  },
  headerCompanyDetails: {
    fontSize: 12,
    color: "#bfdbfe",
    fontWeight: "bold",
  },
  addressText: {
    fontSize: 9,
    color: "#bfdbfe",
    marginBottom: 2,
  },
  voucherNumberBox: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    padding: 10,
    borderRadius: 6,
    textAlign: "center",
    minWidth: 120,
  },
  voucherNumberLabel: {
    fontSize: 9,
    color: "#bfdbfe",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  voucherNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  dateText: {
    fontSize: 10,
    color: "#bfdbfe",
    marginTop: 8,
    textAlign: "center",
    fontWeight: "bold",
  },
});

export default CompanyHeader;
export { styles as companyHeaderStyles };
