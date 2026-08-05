import  { useCallback, useEffect, useRef, useState } from "react";
// import { AiOutlineTransaction } from "react-icons/ai";
import { useDispatch, useSelector } from "react-redux";
// import { useHistory } from "react-router";
import {  Row, Col } from "reactstrap";
// import CustomButton from "../../app/components/Button";
import { getStoresList } from "@/redux/actions/stores";

import PurchaseTable from "../purchase/PurchaseTable";

import useQuery from "@/hooks/useQuery";
import { TransferTabs } from "./transfer/TranferTabs";
import TransferForm from "./transfer/TransferForm";
// import TransferForm from "./transfer/TransferForm";

export default function Transfer() {
  const query = useQuery();
  const store = query.get("store");
  const dispatch = useDispatch();
  const users = useSelector((state) => state.auth);
  const options = useSelector((state) => state.stores.storeList);
  const ref_from = useRef();
  const onGetStore = useCallback((item) => {
    console.log(item);
  }, []);
  useEffect(() => {
    dispatch(getStoresList());
    onGetStore();
  }, [dispatch, onGetStore, store]);

  const _users = useSelector((state) => state.auth.user);
  const stores = _users.store;
  let nerStore = stores?.split(",");
  const buz_id = useSelector(
    (state) => state.auth.activeBusiness.business_admin
  );
  const user_id = useSelector((state) => state.auth.user);
  const check = parseInt(buz_id) === parseInt(user_id.id);
  return (
    <>
      <Row>
        {/* {JSON.stringify(nerStore)} */}
        <Col md={3}>
          <TransferTabs options={check ? options : nerStore} ref_from={ref_from} />
        </Col>

        <Col md={8}>
          {store ? (
   
            <TransferForm
              ref_from={ref_from}
              store={store}
              defaultStore={users.user.store || "Main Store"}
            />
          ) : (
         
            <PurchaseTable type="display"/>
          )}
        </Col>
        <Col md={1}></Col>
      </Row>
    </>
  );
}
