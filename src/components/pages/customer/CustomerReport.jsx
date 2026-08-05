import moment from "moment";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Col, Table } from "reactstrap";
import DaterangeSelector from "@/common/Custom/DaterangeSelector";
import useQuery from "@/common/Custom/Hook/useQuery";
import { formatNumber } from "@/utilities";
import Loading from "@/common/Custom/Loading";
import CustomScrollbar from "@/common/Custom/CustomScrollBar";
import CustomCard from "@/common/Custom/CustomCard2";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";

export default function CustomerReport() {
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

  const { from, to } = form;
  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({ ...p, [name]: value }));
  };

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    _fetchApi(
      `/custormer-reports/${customer_id}/${activeBusiness.id}`,
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
    <CustomCard back header={"Customer Report"}>
      <DaterangeSelector
        handleChange={(e) => handleChange(e)}
        from={from}
        to={to}
      />
      <Col md={12}>
        <div className={"font-weight-bold"}>
          Customer Name: <span>{name}</span>
        </div>
      </Col>
      <Col
        md={12}
        className="d-flex mt-1 flex-direction-row justify-content-between"
      >
        <div className={"font-weight-bold"}></div>
        <div className={"font-weight-bold"}>
          Total Balance: ₦
          {formatNumber1(data?.reduce((a, b) => a + b.dr - b.cr, 0))}
        </div>
      </Col>

      {loading ? <Loading /> : false}
      <div>
        <CustomScrollbar height="55vh">
          <Table bordered className="mt-3" size="sm">
            <thead>
              <tr>
                <th className="text-center">S/N</th>
                <th className="text-center">Date</th>
                <th className="text-center">Description</th>
                <th className="text-center">Debit</th>
                <th className="text-center">Credit</th>
                <th className="text-center">Balance</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((item, i) => {
                return (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="text-end">
                      {moment(item.created).format("DD-MM-YYYY")}
                    </td>
                    <td className="text-left">{item.description}</td>

                    <td className="text-right">
                      {item.cr === 0 || item.cr === null
                        ? "-"
                        : formatNumber1(item.cr)}
                    </td>
                    <td className="text-right">
                      {item.dr === 0 || item.dr === null
                        ? "-"
                        : formatNumber1(item.dr)}
                    </td>
                    <td className="text-right">
                      {Math.abs(item.balance) === 0 || item.balance === null
                        ? "-"
                        : formatNumber(Math.abs(item.balance))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </CustomScrollbar>
      </div>
    </CustomCard>
  );
}
