import moment from "moment";
import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Table, Input, Row, Col } from "reactstrap";
// import CustomButton from '../../app/components/Button'
import DaterangeSelector from "@/common/DateRangeSelector";
import Loading from "@/common/Custom/Loading";
import { today, formatNumber } from "@/utilities";
import CustomScrollbar from "@/common/Custom/CustomScrollBar";
import useQuery from "@/hooks/useQuery";
import { _fetchApi } from "@/redux/actions/api";
import store from "@/redux/store";
import RadioGroup from "@/common/Custom/Radio/RadioGroup";

export default function VieItem({ info, setPreview }) {
  const query = useQuery();
  const item_name = query.get("item_name");
  const _store = query.get("store");

  const aMonthAgo = moment(today)
    .subtract(1, "months")
    .endOf("month")
    .format("YYYY-MM-DD");
  const [form, setForm] = useState({
    from: aMonthAgo,
    to: today,
    formType: "all",
  });
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
  const [balance, setBalance] = useState(0);
  const dispatch = useDispatch();

  const handleTypeChange = (name, val) => {
    setForm((p) => ({ ...p, formType: val }));
  };

  const facilityId = store.getState().auth.activeBusiness.id;

  const { from, to, formType } = form;
  const getPurchaseList = useCallback(() => {
    setLoading(true)
    _fetchApi(
      `/inventory/get-item-history?item_name=${item_name}&store=${_store}&facilityId=${facilityId}&from=${from}&to=${to}&query_type=get_details`,
      (data) => {
        console.log(data);
        if (data && data.results) {
          setList(data.results);
          setLoading(false)
        }
      },
      (err) => {
        console.log(err);
        setLoading(false)
      }
    );
    setLoading(false)
  }, [item_name, _store, facilityId, from, to]);

  //   const data = useSelector((state) => state.purchase.purchaseItemGroup);

  const total =
    (parseFloat(info.cost) + parseFloat(info.markup)) * parseFloat(balance);
  // {info.cost} {info.markup}

  // const _getItemHistoryStatement = useCallback(() => {
  //   getItemHistory(info.item_code, _store, from, to, (data) => {
  //     setList(data);
  //   });
  // }, [info.item_code, _store, from, to]);

  // const enableEdit = (ind) => {
  //   const arr = [];
  //   const _list = list[item_name];
  //   _list.forEach((item, index) => {
  //     if (ind === index) {
  //       arr.push({ ...item, enable: true });
  //     } else {
  //       arr.push(item);
  //     }
  //     setList({ [item_name]: arr });
  //   });
  // };

  // const _getItemBalance = useCallback(() => {
  //   getItemBalance(info.item_name, (val) => {
  //     setBalance(val)
  //   })
  // }, [info.item_name])

  useEffect(() => {
    getPurchaseList();
    // _getItemHistoryStatement();
    // _getItemBalance()
  }, [getPurchaseList]);
  // let newItem = data.filter((i) => i.item_name === info.item_name)

  const showWayBill =
    useSelector(
      (state) => state.auth.activeBusiness.business_includes_logistics
    ) || false;

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({ ...p, [name]: value }));
  };
  const newStyle = {
    // color: theme.tertiary_color,
    fontSize: 20,
    fontWeight: "bold",
    alignSelf: "flex-end",
  };
  // var total_selling_price = 0;
  // let total_selling_price = list[item_name]
  //   .filter((ite) => ite != null)
  //   .reduce((a, b) => a + parseInt(b && b.selling_price), 0);
  // Object.keys(list).map((item, idx) => {
  //   let totalQtyIn = list[item].reduce(
  //     (a, b) => a + parseInt(b && b.qty_in),
  //     0
  //   );

  // return (
  //   <>

  const radioList = [
    {
      label: "All",
      name: "all",
    },
    {
      label: "Sales",
      name: "sales",
    },
    {
      label: "Purchase Order",
      name: "Purchase",
    },
    {
      label: "Transfer",
      name: "Transfer",
    },
    {
      label: "Return",
      name: "return",
    },
    {
      label: "Replace",
      name: "replace",
    },
  ];
  let newData = list && list.filter((i) => i.sales_type.includes(formType));
  let newList = formType === "all" ? list : newData;
  return (
    <>
      {/* {JSON.stringify({ type: form.formType, newData })} */}
      {loading ? <Loading /> : false}
      <DaterangeSelector handleChange={handleChange} from={from} to={to} />
      <div className="d-flex justify-content-center">
        <RadioGroup
          label="Filter-by"
          value={formType}
          name="formType"
          onChange={handleTypeChange}
          options={radioList}
        />
      </div>
      <CustomScrollbar height="55vh">
        <div className="d-flex justify-content-between m-2">
          <div style={newStyle}> </div>
          <div style={newStyle}>
            {" "}
            {/* Total Selling Price: {formatNumber(total_selling_price)} */}
          </div>
        </div>
        <Table bordered striped>
          <thead>
            <tr>
              <th className="text-center">Date</th>
              <th className="text-center">Item Name</th>
              <th className="text-center">Store</th>
              <th className="text-center">Qty In</th>
              <th className="text-center">Qty Out</th>
              <th className="text-center">Selling Price (₦)</th>
              <th className="text-center">Trans. Type</th>
              {/* under development */}
              {/* <th className="text-center">Action</th> */}

              {showWayBill ? (
                <>
                  <th>Truck No.</th>
                  <th>Way Bill No.</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {newList &&
              newList.map((it, index) => (
                <tr
                  key={index}
                  className={`bg-${
                    it && it.sales_type.includes("Transfer")
                      ? "success text-white"
                      : ""
                  }`}
                >
                  <td className="text-center">
                    {moment(it && it.created_at).format("DD/MM/YY")}
                  </td>
                  <td className="text-left">{it && it.item_name}</td>
                  <td className="text-left">{it && it.location_from}</td>
                  <td className="text-center">
                    {it.enable ? (
                      <div className="m-0 p-0">
                        <Input
                          className="text-center"
                          value={it.selling_price}
                        />
                      </div>
                    ) : (
                      formatNumber(it && it.qty_in) || 0
                    )}
                  </td>
                  <td className="text-center">
                    {formatNumber(it && it.qty_out) || 0}
                  </td>
                  <td className="text-right">
                    {it.enable ? (
                      <div className="m-0 p-0">
                        <Input
                          className="text-right"
                          value={it.selling_price}
                        />
                      </div>
                    ) : (
                      formatNumber(it && it.selling_price) || 0
                    )}
                  </td>
                  <td>{it && it.sales_type}</td>
                  {/* under development */}
                  {/* <td className="text-center">
                      {it.enable ? (
                        <CustomButton>Update</CustomButton>
                      ) : (
                        <>
                          <CustomButton
                            size="sm"
                            color="primary"
                            onClick={() => {
                              enableEdit(index);
                            }}
                          >
                            Edit
                          </CustomButton>
                          <Button size="sm" color="danger" className="ml-1">
                            Delete
                          </Button>
                        </>
                      )}
                    </td> */}
                </tr>
              ))}
          </tbody>
        </Table>
      </CustomScrollbar>
    </>
  );
}
