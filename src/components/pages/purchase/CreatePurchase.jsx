/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Row, Form, Table, Button } from "reactstrap";
import { useDispatch, useSelector } from "react-redux";
import { FaCartPlus } from "react-icons/fa";
import CustomButton from "@/common/Custom/CustomButton";
import CustomForm from "@/common/Custom/CustomForm";
import validator from "validator";
import {
  CASH,
  CUSTOMER_TYPES,
  MODES_OF_PAYMENT,
  STORE,
  TRANSACTION_TYPES,
} from "@/constants";
import { v4 as UUIDV4 } from "uuid";
import { getSuppliers } from "@/redux/actions/suppliers";
import { FiDelete } from "react-icons/fi";
import { saveTransaction } from "@/redux/actions/transactions";
import moment from "moment";
import { getPurchasedItems, saveNewPurchase } from "@/redux/actions/purchase";
import { useNavigate, useLocation } from "react-router";
import CustomCard from "@/common/Custom/CustomCard2";
import SearchSupplierInput from "./SearchSuppliers";
import SearchItemInput from "../sales/make-sales/SearchItem";
import {
  formSettingSetup,
  saveFormSetup,
  updateFormSetup,
} from "@/redux/actions/formSetup";
import { formatNumber } from "@/utilities";
import StoreSelection from "@/common/Custom/StoreSelection";
import CustomSuccessAlert from "@/common/Custom/CustomSuccessAlert";
import CustomNotifyAlert from "@/common/Custom/CustomNotifyAlert";
import useQuery from "@/common/Custom/Hook/useQuery";
import { _postApi } from "@/redux/actions/api";
import { Typeahead } from "react-bootstrap-typeahead";
import { toast } from "sonner";

const initialForm = {
  uom: "Unit",
  quantity: "",
  cost: "",
  expiry_date: "",
  reorder: "0",
  saveAsNewItem: true,
  account: "",
  modeOfPayment: MODES_OF_PAYMENT.CASH,
  selling_price: "",
  item_code: "",
  truckNo: "",
  otherDetails: "",
  waybillNo: "",
  item_name: "",
  source_account: "",
  barcode: "",
  bank: "",
  brand: "",
  size: "",
  color: "",
  material: "",
};
export default function CreatePurchase() {
  const store = useQuery().get("store");
  const dispatch = useDispatch();
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const formSetup = useSelector(
    (state) => state.formSettingSetup.purchaseSetup
  );
  const storeList = useSelector((state) => state.stores.storeList);
  const item_nameRef = useRef();

  useEffect(() => {
    dispatch(formSettingSetup("Purchase Form"));
  }, [dispatch]);
  const _formsetUp = formSetup.length ? formSetup[0] : {};

  const location = useLocation();
  const setupCond = location.pathname === "/app/setting/page";
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [setUp, setSetup] = useState(_formsetUp);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summiting, setSummiting] = useState(false);
  const [option, setOption] = useState([]);
  const [category, setCategory] = useState("");
  const [inventoryList, setInventoryList] = useState([]);
  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({
      ...p,
      [name]: value,
    }));
  };

  const getCategory = () => {
    const query = "get";

    _postApi(
      `/inventory/new-category/${query}`,
      {
        store: activeBusiness.business_name,
      },
      (data) => {
        // if (data.success) {
        setOption(data.results.map((item) => ({ name: item.category })));
        // }
      },
      (err) => {
        console.error(err);
      }
    );
  };

  useEffect(() => {
    getCategory();
  }, []);

  const getInventoryItems = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=inventory`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setInventoryList(
            resp.results.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
            }))
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };

  useEffect(() => {
    getInventoryItems();
  }, []);

  const user = useSelector((state) => state.auth.user);

  const formIsValid =
    form.item_name !== "" && form.quantity !== "" && form.cost !== "";

  const saveItem = (saveAsNew = true) => {
    form._id = UUIDV4();
    form.transaction_id = UUIDV4();
    let _markup = parseFloat(form.selling_price) - parseFloat(form.cost);
    let _markupTypes = [
      { customerCategory: CUSTOMER_TYPES.WALKIN, markup: _markup },
    ];
    if (!form.receivedTo || form.receivedTo === "") {
      if (storeList && storeList.length) {
        form.receivedTo = storeList[0]?.storeName;
        form.storeId = storeList[0]._id;
        setForm((p) => ({
          ...p,
          receivedTo: storeList[0]?.storeName,
          storeId: storeList[0]._id,
        }));
      }
    }

    setData((p) => [
      ...p,
      {
        _id: form._id,
        supplierName: form.supplier_name,
        item_name: item_name,
        item_category: form.itemCategory,
        uom: uom,
        quantity: quantity,
        quantity_available: quantity,
        propose_quantity: quantity,
        cost: cost,
        price: selling_price,
        markup: _markup && _markup !== "" ? _markup : 0,
        mark_up: _markup && _markup !== "" ? _markup : 0,
        item_code: form.item_code !== "" ? form.item_code : form._id,
        expiry_date: expiry_date,
        reorder: reorder && reorder !== "" ? reorder : 0,
        busName: user.busName ? user.busName : user.facilityId,
        branch_name: form.receivedTo ? form.receivedTo : user.branch_name,
        receivedTo: form.receivedTo || store,
        markupTypes: _markupTypes,
        saveAsNewItem: saveAsNew ? form.saveAsNewItem : false,
        exisitingId: null,
        truckNo: form.truckNo,
        waybillNo: form.waybillNo,
        otherDetails: form.otherDetails,
        modeOfPayment: form.modeOfPayment,
        source_account: form.source_account,
        bank: form.bank,
        account: form.account,
        supplier_code: form.supplier_code
          ? form.supplier_code
          : form.new_supplier_code,
        supplier_name: form.supplier_name,
        barcode: form.barcode,
        storeId: form.storeId,
        category: category,
        brand: form.brand,
        size: form.size,
        color: form.color,
        material: form.material,
      },
    ]);

    setForm((p) => ({ ...p, ...initialForm }));
    item_nameRef.current.clear();
  };

  const handleAdd = () => {
    if (
      validator.isEmpty(form.item_name) ||
      !validator.isLength(form.item_name, 2, 50)
    ) {
      CustomNotifyAlert("Invalid item name");
    } else if (validator.isEmpty(form.supplier_name)) {
      CustomNotifyAlert("Select supplier");
    } else if (!validator.isNumeric(form.cost)) {
      CustomNotifyAlert("Cost Price is not valid");
    } else if (!validator.isNumeric(form.selling_price)) {
      CustomNotifyAlert("Selling Price is not valid");
    } else if (!validator.isNumeric(form.quantity)) {
      CustomNotifyAlert("Quantity is not valid");
    } else if (
      form.receivedTo === "" ||
      form.receivedTo === null ||
      form.receivedTo === undefined
    ) {
      CustomNotifyAlert("Receiving store must be enter");
    } else if (formIsValid) {
      saveItem(true);
    } else {
      CustomNotifyAlert("Please complete the form");
    }
  };

  const getSupplierList = useCallback(() => {
    dispatch(getSuppliers());
  }, [dispatch]);

  useEffect(() => {
    getSupplierList();
    setForm((p) => ({
      ...p,
      receivedTo: store,
    }));
  }, [getSupplierList, store]);

  const handleDelete = (i) => {
    const new_items = data.filter((item, index) => i !== index);
    setData(new_items);
  };

  let total = data.reduce(
    (it, id) => it + parseFloat(parseInt(id.cost) * parseInt(id.quantity)),
    0
  );

  const {
    uom,
    quantity,
    cost,
    expiry_date,
    reorder,
    itemCategory,
    selling_price,
    modeOfPayment,
    receivedTo,
    truckNo,
    otherDetails,
    item_name,
    waybillNo,
  } = form;

  const fields = [
    {
      label: "Supplier Name",
      name: "supplier_name",
      type: "custom",
      component: () => (
        <SearchSupplierInput
          label="Supplier Name"
          onInputChange={(v) =>
            setForm((p) => ({
              ...p,
              supplier_name: v,
              supplier_code: UUIDV4(),
              supplier_subhead: v,
            }))
          }
          onChange={(s) =>
            setForm((p) => ({
              ...p,
              supplier_name: s.name,
              supplier_code: s.supplier_code,
              supplier_subhead: s.supplier_subhead,
              supplier_number: s.supplier_number,
            }))
          }
        />
      ),
      col: 3,
      switch: setupCond ? true : false,
      required: true,
    },
    {
      label: "Item Category",
      labelkey: "item",
      name: "itemCategory",
      type: "custom",
      component: () => (
        <>
          <label className={`font-weight-bold mb-2`}>Item category</label>
          <Typeahead
            id="single-select-typeahead"
            size={"md"}
            className="col-md-12 pl-0 pr-0 custom-typeahead-border"
            options={option}
            placeholder="Select category..."
            onChange={(selectedItems) => {
              setCategory(selectedItems[0]?.name || "");
            }}
            selected={category ? [{ name: category }] : []}
            labelKey="name"
          />
        </>
      ),
      col: 3,
    },
    {
      label: "Brand",
      name: "brand",
      type: "text",
      value: form.brand,
      col: 3,
    },
    {
      label: "Size",
      name: "size",
      type: "select",
      options: ["XS", "S", "M", "L", "XL", "XXL"],
      value: form.size,
      col: 3,
    },
    {
      label: "Color",
      name: "color",
      type: "text",
      value: form.color,
      col: 3,
    },
    {
      label: "Material Type",
      name: "material",
      type: "text",
      value: form.material,
      col: 3,
    },
    {
      label: "Item Name",
      name: "item_name",
      value: form.item_name,
      col: 3,
      type: "text",
    },
    {
      label: "Unit of Measurement",
      labelkey: "label",
      options: [{ label: "--unit--" }, { label: "Other" }],
      name: "uom",
      value: uom,
      col: 3,
      switch: setupCond ? true : false,
    },
    {
      label: "Bar code number",
      name: "barcode",
      value: form.barcode,
      col: 3,
      type: "text",
    },
    {
      label: `Cost Price (${formatNumber(form.cost)})`,
      type: "number",
      name: "cost",
      value: form.cost,
      col: 3,
      required: true,
    },
    {
      label: "Quantity",
      type: "number",
      name: "quantity",
      placeholder: "QTY",
      value: quantity,
      required: true,
      col: 3,
    },
    {
      label: `Selling Price (${formatNumber(form.selling_price)})`,
      type: "number",
      name: "selling_price",
      value: selling_price,
      required: true,
      col: 3,
    },
    {
      label: "Reorder Level",
      type: "number",
      name: "reorder",
      value: reorder,
      placeholder: "0",
      col: 3,
      switch: setupCond ? true : false,
    },
    {
      label: "Expiry Date",
      type: "date",
      name: "expiry_date",
      value: expiry_date,
      col: 3,
      switch: setupCond ? true : false,
    },
    {
      label: "Mode Of Payment",
      type: "select",
      options: Object.values(MODES_OF_PAYMENT),
      name: "modeOfPayment",
      value: modeOfPayment,
      col: 3,
      switch: setupCond ? true : false,
    },
    {
      label: "Receiving Store",
      type: "custom",
      required: true,
      component: () => (
        <StoreSelection
          label="Receiving Store"
          activeStore={form.receivedTo || store}
          selectStore={(s) => {
            if (s && s.storeName)
              setForm((p) => ({
                ...p,
                receivedTo: s.storeName,
                storeId: s._id,
              }));
          }}
          onDefaultSelect={(v) => {
            if (v && v.storeName) {
              setForm((p) => ({
                ...p,
                receivedTo: v.storeName,
                storeId: v._id,
              }));
            }
          }}
        />
      ),
      name: "receivedTo",
      value: receivedTo,
      col: 3,
      switch: setupCond ? true : false,
    },
    {
      label: "Truck No.",
      name: "truckNo",
      value: truckNo,
      placeholder: "Enter truck number",
      col: 3,
      switch: setupCond ? true : false,
    },
    {
      label: "Waybill No.",
      name: "waybillNo",
      value: waybillNo,
      placeholder: "Enter truck number",
      col: 3,
      switch: setupCond ? true : false,
    },
    {
      label: "Other Details",
      name: "otherDetails",
      size: 4,
      value: otherDetails,
      placeholder: "Other details if any...",
      col: 3,
      switch: setupCond ? true : false,
    },
  ];

  const handleSubmitSetUp = () => {
    const success_callback = () => {
      dispatch(formSettingSetup("Purchase Form"));
      CustomSuccessAlert("Successfully Update");
    };
    if (setUp._id) {
      updateFormSetup(setUp._id, setUp, success_callback, (e) =>
        console.log(e)
      );
    } else {
      saveFormSetup(
        { type: "Purchase Form", ...setUp },
        success_callback,
        (e) => console.log(e)
      );
    }
  };

  // const totalAmount = data

  const handleSubmit = () => {
    if (!activeBusiness?.payable_code) {
      toast.error("Payable code is not set");
      return;
    }

    const createEntry = (
      amount,
      account_description,
      account_head,
      account_subhead,
      query_type
    ) => ({
      amount,
      account_description,
      account_head,
      account_subhead,
      query_type,
    });

    const customerEntry = createEntry(
      total,
      form?.supplier_name,
      form?.supplier_code,
      form?.supplier_subhead,
      "net"
    );

    const inventoryEntries = (inventoryList || []).map((item) =>
      createEntry(total, item.name, item.code, item.chart_code, "tax")
    );

    setLoading(true);

    _postApi(
      `/account/purchase-stock`,
      {
        data,
        facilityId: activeBusiness._id,
      },
      (res) => {
        if (res.success) {
          _postApi(
            `/v1/materials/insertCollectionProductionLedger`,
            {
              customerEntries: customerEntry,
              inventoryEntries,
              facilityId: activeBusiness._id,
            },
            (ledgerRes) => {
              if (ledgerRes.success) {
                console.log("Ledger entry successful", ledgerRes);
                navigate(`/app/production/collection`);
              } else {
                toast.error("Error in ledger entry");
                console.error("Ledger response:", ledgerRes);
              }
              setLoading(false);
            },
            (ledgerErr) => {
              toast.error("Error in ledger entry");
              console.error(ledgerErr);
              setLoading(false);
            }
          );
        } else {
          toast.error("Purchase stock failed");
          console.error("Purchase response:", res);
          setLoading(false);
        }
      },
      (err) => {
        toast.error("Error creating purchase stock");
        console.error(err);
        setLoading(false);
      }
    );
  };

  return (
    <CustomCard back header={setupCond ? "" : "Stock Purchase"}>
      {/* {JSON.stringify({ data, total, inventoryList }, null, 2)} */}
      <Form>
        <Row>
          <CustomForm
            fields={fields}
            handleChange={handleChange}
            setState={setSetup}
            state={setUp}
          />
        </Row>
        {!setupCond ? (
          <center>
            <CustomButton
              onClick={() => handleAdd()}
              className="mb-2 px-5 d-flex align-items-center"
            >
              <FaCartPlus className="mr-2" />
              Add to Cart
            </CustomButton>
          </center>
        ) : (
          <center>
            <CustomButton onClick={handleSubmitSetUp}>
              Save the changes
            </CustomButton>
          </center>
        )}
        <h5 className="text-right">Total: {formatNumber(total)}</h5>
        {data.length ? (
          <Table bordered striped size="sm">
            <thead>
              <tr>
                <th>#</th>
                <th>Item name</th>
                <th>Brand</th>
                <th>Size</th>
                <th>QTY</th>
                <th>Price</th>
                <th>Total</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{item.item_name}</td>
                  <td>{item.brand}</td>
                  <td>{item.size}</td>
                  <td>{formatNumber(item.quantity)}</td>
                  <td>{formatNumber(item.cost)}</td>
                  <td>
                    {formatNumber(
                      parseInt(item.cost) * parseInt(item.quantity)
                    )}
                  </td>
                  <td className="text-center">
                    <Button
                      size="sm"
                      onClick={() => handleDelete(i)}
                      className="btn btn-danger"
                    >
                      <FiDelete />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          ""
        )}

        <div
          className="text-center"
          style={{
            marginLeft: "45%",
          }}
        >
          {data.length ? (
            <CustomButton
              onClick={handleSubmit}
              loading={loading}
              className="px-5 d-flex align-items-center"
            >
              <FaCartPlus className="mr-2" />{" "}
              {data.length < 1 && data.length === 0 ? "" : data.length} Submit
            </CustomButton>
          ) : (
            ""
          )}
        </div>
      </Form>
    </CustomCard>
  );
}
