import ReportTotalEco from "./ReportTotalEco";

import CustomCard from "@/common/Custom/CustomCard2";

const listdata = [
  { value: "total_revenue_by_economic", title: "Total Revenue by Economic" },
  // { value: "mda_revenue_by_eco", title: "MDA Revenue by Economic" },
];
function StatementOfFinancial() {
  return (
    <CustomCard header="Statement of Financial">

        <ReportTotalEco
          type="total_revenue_by_economic"
          route="/reports"
          options={listdata}
          title="Total Revenue by Economic"
        />
    </CustomCard>
  );
}

export default StatementOfFinancial;
