import moment from "moment";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Col, Row, Table } from "reactstrap";
import DaterangeSelector from "@/common/Custom/DaterangeSelector";
import useQuery from "@/common/Custom/Hook/useQuery";
import { formatNumber } from "@/utilities";
import Loading from "@/common/Custom/Loading";
import CustomScrollbar from "@/common/Custom/CustomScrollBar";
import CustomCard from "@/common/Custom/CustomCard2";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import CustomTable1 from "@/common/Custom/CustomTable1";

export default function CustomerEntries() {
  const today = moment().format("YYYY-MM-DD");
  const aMonthAgo = moment().subtract(1, "month").format("YYYY-MM-DD");
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const query = useQuery();
  const name = query.get("customer_name");
  const customer_id = query.get("customer_id");
  const [data, setData] = useState([]);

  const [form, setForm] = useState({
    from: aMonthAgo,
    to: today,
    searchTxt: "",
  });

  const fields = [
    {
      title: "Date",
      value: "created",
      //   className: "text-end",
      custom: true,
      component: (item) => <div className="text-center">{moment(item.created).format("DD-MM-YYYY")}</div>,
    },
    {
        title: "Material type",
        // value: "created",
        //   className: "text-end",
        custom: true,
        component: (item) => item.material_type,
      },
      {
        title: "Rate",
        // value: "cr",
        //   className: "text-right",
        custom: true,
        component: (item) =>
          <div className="text-end">{formatNumber1(item.rate)}</div>,
      },
      {
        title: "Quantity",
        // value: "created",
        //   className: "text-end",
        custom: true,
        component: (item) => <div className="text-end">{`${formatNumber(item.quantity)} ${item.unit}`}</div>,
      },
      {
        title: "Amount",
        // value: "created",
        //   className: "text-end",
        custom: true,
        component: (item) => <div className="text-end">{`₦${formatNumber(item.amount)}`}</div>,
      },
  ];

  const { from, to } = form;
  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({ ...p, [name]: value }));
  };

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    _postApi(
      `/v1/materials/getByCustomerNo`,
      {customerNo: customer_id},
      (data) => {
        console.log(data);
        setData(data.results);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        console.log(err);
      }
    );
  }, [activeBusiness.id, customer_id]);

  return (
    <CustomCard back header={"Customer Entries"}>
      <DaterangeSelector
        handleChange={(e) => handleChange(e)}
        from={from}
        to={to}
      />
      <div className="mb-2 flex flex-col md:flex-row justify-between gap-2">
        <div className="w-full md:w-1/2 font-semibold">
          Customer Name: <span>{name}</span>
        </div>
        <div className="w-full md:w-1/2 mt-1 flex justify-between md:justify-end">
          <div className="font-semibold"></div>
          <div className="font-semibold">
            Total Balance: ₦
            {formatNumber1(data?.reduce((a, b) => a + b.dr - b.cr, 0))}
          </div>
        </div>
      </div>

      {loading ? <Loading /> : null}

      <CustomTable1
        data={data || []}
        loading={loading}
        message="No transactions found"
        fields={fields}
      />
    </CustomCard>
  );
}
