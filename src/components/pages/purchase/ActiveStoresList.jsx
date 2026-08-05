import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import SelectInput from "@/common/SelectInput";
import { getStores } from "@/redux/actions/stores";

function ActiveStoresList({ setActiveStore = (f) => f, activeStore = "", label = "" }) {
  const [list, setList] = useState([]);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const isAdmin = parseInt(activeBusiness.business_admin) === parseInt(user.id);

  const stores = user?.store || "";
  const nerStore = stores.split(",");

  const fetchStores = useCallback(() => {
    getStores(
      "list",
      (data) => {
        if (data?.results) {
          const storeList = [...data.results, { storeName: "Show All Stores" }];
          const displayList = isAdmin ? storeList : nerStore;
          setList(displayList);

          if (storeList.length) {
            const defaultStore = user.branch_name || storeList[0].storeName;
            setActiveStore(defaultStore);
          }
        }
      },
      (error) => {
        console.error("Error fetching stores:", error);
      }
    );
  }, [setActiveStore, user, isAdmin, nerStore]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  return (
    <SelectInput
      label={label}
      value={activeStore}
      options={isAdmin ? list.map((store) => store.storeName) : nerStore}
      onChange={({ target: { value } }) => setActiveStore(value)}
    />
  );
}

export default ActiveStoresList;
