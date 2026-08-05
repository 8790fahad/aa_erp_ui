import moment from "moment";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Col, Table } from "reactstrap";
import useQuery from "@/common/Custom/Hook/useQuery";
import Loading from "@/common/Custom/Loading";
// import CustomCard from '../components/CustomCard'
import CustomScrollbar from "@/common/Custom/CustomScrollBar";
// import CustomAlert from "../../components/CustomAlert";
import CustomCard from "@/common/Custom/CustomCard2";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import { toWordsconver } from "@/utilities";
import CustomButton from "@/common/Custom/CustomButton";
import { useNavigate } from "react-router-dom";

export default function CustomerReceipt() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const query = useQuery();
  const invoice_ref = query.get("invoice_ref");
  const customer_no = query.get("customer_no");
  const [data, setData] = useState([]);
  const history = useNavigate();
  const [loading, setLoading] = useState(false);
  const filteredData = data?.filter((d) => Number(d.dr) > 0);

  useEffect(() => {
    _fetchApi(
      `/api/v1/get-customer-deposit/${invoice_ref}/${activeBusiness.id}/${customer_no}`,
      (data) => {
        if (data.success) {
          setData(data.results);
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        console.log(err);
      }
    );
  }, [activeBusiness.id, customer_no, invoice_ref]);

  return (
    <CustomCard back>
      <Col md={12}>
        <div className={" font-weight-bold"}>
          Customer Name: <span>{name}</span>
        </div>
      </Col>
      {loading ? <Loading /> : false}
      <div>
        <CustomScrollbar height="55vh">
          {/* {list.length ? ( */}
          <Table bordered className="mt-3" size="sm">
            <thead>
              <tr>
                <th className="text-center">S/N</th>
                <th className="text-center">Date</th>
                <th className="text-center">Description</th>
                <th className="text-center">Amount</th>
                <th className="text-center">Amount in Words</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData?.length > 0 ? (
                filteredData?.map((item, i) => {
                  return (
                    <tr key={i}>
                      <td className="text-center">{i + 1}</td>
                      <td className="text-end">
                        {moment(item.created).format("DD-MM-YYYY")}
                      </td>
                      <td className="text-left">{item.description}</td>

                      {/* <td className="text-right">
                        {item.cr === 0 || item.cr === null
                            ? "-"
                            : formatNumber1(item.cr)}
                      </td> */}
                      <td className="text-right">
                        {item.dr === 0 || item.dr === null
                          ? "-"
                          : formatNumber1(item.dr)}
                      </td>
                      <td
                        className="text-left"
                        style={{ maxWidth: "200px", wordWrap: "break-word" }}
                      >
                        {item.dr === 0 || item.dr === null
                          ? "-"
                          : toWordsconver(item.dr) + " naira only"}
                      </td>
                      <td>
                        <div className="d-flex items-center justify-center">
                          <CustomButton
                            size="sm"
                            className={"mb-0"}
                            onClick={() =>
                              history(
                                `/app/customers/view-receipt/print?entry_id=${item.entry_id}`
                              )
                            }
                          >
                            View
                          </CustomButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="text-center text-gray-500 py-2">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </CustomScrollbar>
      </div>
    </CustomCard>
  );
}
