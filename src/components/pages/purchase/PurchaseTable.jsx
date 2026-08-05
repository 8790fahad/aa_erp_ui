/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { Button, Col, Row, Table } from "reactstrap";
import { useNavigate } from "react-router-dom";
import { FaPlus } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import CustomButton from "@/common/Custom/CustomButton";
import SearchBar from "@/common/Custom/CustomSearch";
import Loading from "@/common/Custom/Loading";
import ViewItem from "./ViewItem";
import CustomCard from "@/common/Custom/CustomCard2";
import { Checkbox } from "evergreen-ui";
import CustomScrollbar from "@/common/Custom/CustomScrollBar";
import { formatNumber } from "@/utilities";
import { getPurchasedItems } from "@/redux/actions/purchase";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";

export default function PurchaseTable({ type = "" }) {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [preview, setPreview] = useState(false);
  const [item_name, setItem_name] = useState("");
  const [selected, setSelected] = useState({});
  const [showAllPurchase, setShowAllPurchase] = useState(false);
  const data = useSelector((state) => state.purchase.purchaseList);
  const [activeStore, setActiveStore] = useState(null);
  const navigate = useNavigate();
  const items = data.length > 0 && showAllPurchase ? data : data.slice(-15);
  const [isOpen, setIsOpen] = useState(false);
  const [toggle, setToggle] = useState(false);

  const toggleModal = useCallback(() => {
    setToggle(!toggle);
    setIsOpen(!isOpen);
  }, [setIsOpen, setToggle, isOpen, toggle]);

  useEffect(() => {
    setLoading(true);
    dispatch(getPurchasedItems());
    setLoading(false);
  }, [dispatch, activeStore]);

  const handleDelete = (item) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${item.item_name}" stock?`
      )
    ) {
      setLoading(true);
      _postApi(
        `/account/delete-stock`,
        { ...item, query_type: "delete" },
        (res) => {
          setLoading(false);
          dispatch(getPurchasedItems());
          toast.success("Deleted");
          toggleModal();
        },
        (err) => {
          setLoading(false);
          toast.error("Error: " + err.toString());
          toggleModal();
        }
      );
    }
  };

  const list =
    searchText.length > 2 && items.length
      ? items.filter((item) => {
          return (
            item.item_name?.toLowerCase()?.includes(searchText.toLowerCase()) ||
            item.supplierName.toLowerCase().includes(searchText)
          );
        })
      : items;

  const pageTitle = preview ? "Item Details" : "Stock Balances";

  const total_saling_price = items.reduce(
    (a, b) =>
      parseFloat(a) + parseFloat(b.selling_price) * parseFloat(b.quantity),
    0
  );

  return (
    <div>
      {preview ? (
        <CustomButton
          onClick={() => setPreview(false)}
        >{`< Back`}</CustomButton>
      ) : (
        ""
      )}
      <CustomCard
        header={
          preview ? (
            <Row className="row m-0 d-flex align-items-center">
              <Col md={12} className="col-md-6 text-center">
                <h4>Stock Purchase</h4> {/* Changed from h5 to h4 */}
              </Col>
            </Row>
          ) : (
            <h4 className="text-center">{pageTitle}</h4> // Changed from h5 to h4
          )
        }
      >
        {!preview ? (
          <>
            {type === "display" ? null : (
              <CustomButton
                className="mb-1 d-flex flex-direction-row align-items-center"
                onClick={() =>
                  navigate(
                    `/app/purchase/purchase-list/new?store=${activeStore}`
                  )
                }
              >
                <FaPlus className="mr-1" /> Add New Stock
              </CustomButton>
            )}
            {loading ? <Loading /> : false}

            {/* <OtherOptions
            activeStore={activeStore}
            total_selling_price={total_saling_price}
            items={items}
            setActiveStore={setActiveStore}
          /> */}
            <Row>
              <Col md={10}>
                <SearchBar
                  placeholder="Search by supplier name"
                  onFilterTextChange={(val) => setSearchText(val)}
                  filterText={searchText}
                />
              </Col>
              <Col className="d-flex flex-direction-row align-items-center">
                <Checkbox
                  label="Show All Items"
                  checked={showAllPurchase}
                  onChange={() => setShowAllPurchase((p) => !p)}
                />
              </Col>
            </Row>
            <CustomScrollbar height="68vh">
              <Table bordered style={{ padding: 0 }}>
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Item name </th>
                    <th>Supplier</th>
                    <th>Qty Available</th>
                    <th>Selling price (₦)</th>
                    <th>Amount (₦)</th>
                    <th>Expiry date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((item, i) => (
                    <tr key={i}>
                      <th scope="row">{i + 1}</th>
                      <td>{item.item_name}</td>
                      <td>{item.supplierName}</td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-right">
                        {formatNumber1(item.selling_price)}
                      </td>
                      <td className="text-right">
                        {formatNumber1(
                          parseInt(item.selling_price) * parseInt(item.quantity)
                        )}
                      </td>
                      <td className="text-center">
                        {item.expiry_date === "" ? "-" : item.expiry_date}
                      </td>
                      <td>
                        <CustomButton
                          size="sm"
                          color="primary"
                          onClick={() => {
                            setPreview(true);
                            setSelected(item);
                            setItem_name(item.item_name);
                            navigate(
                              `/app/purchase/purchase-list?supplier_code=${item.supplier_code}&item_name=${item.item_name}&store=${item.storeName}`
                            );
                          }}
                        >
                          View
                        </CustomButton>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          color="danger"
                          onClick={() => handleDelete(item)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CustomScrollbar>
          </>
        ) : (
          <ViewItem
            info={selected}
            setPreview={setPreview}
            item_name={item_name}
          />
        )}
      </CustomCard>
    </div>
  );
}
