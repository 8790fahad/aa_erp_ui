/* eslint-disable react-hooks/exhaustive-deps */
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
import { _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import { toast } from "sonner";

export default function SupplierReport() {
  const today = moment().format("YYYY-MM-DD");
  const aMonthAgo = moment().subtract(1, "month").format("YYYY-MM-DD");
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const query = useQuery();
  const supplier_name = query.get("supplier_name");
  const supplier_number = query.get("supplier_number");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    from: aMonthAgo,
    to: today,
    searchTxt: "",
  });

  const { from, to } = form;
  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({ ...p, [name]: value }));
  };

  const getSupplierReport = () => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    _postApi(
      `/inventory/product-list?query_type=supplier_entries&memo_id=${supplier_number}`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setData(resp.results);
          setLoading(false);
        } else {
          toast.error("Failed to load list of items.");
          setLoading(false);
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
        setLoading(false);
      }
    );
  };

  useEffect(() => {
    getSupplierReport();
  }, []);

  return (
    <CustomCard back header={"Supplier Report"}>
      <DaterangeSelector
        handleChange={(e) => handleChange(e)}
        from={from}
        to={to}
      />
      <Col md={12}>
        <div className={" font-weight-bold"}>
          Supplier Name: <span>{supplier_name}</span>
        </div>
        <div className={" font-weight-bold"}>
          Supplier Number: <span>{supplier_number}</span>
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
