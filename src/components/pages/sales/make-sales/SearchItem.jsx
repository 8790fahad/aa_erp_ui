/* eslint-disable react/prop-types */

import CustomTypeahead from "@/common/Custom/Customtypeahead";
import { getItemList } from "@/redux/actions/purchase";
import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";


function SearchItemInput(props) {
  const dispatch = useDispatch();
  const [itemList, setItemList] = useState([]);

  // Fetch items and update state
  const getList = useCallback(() => {
    dispatch(getItemList(props.category, 
      (data) => {
        console.log("Items fetched:", data);
        setItemList(data); 
      },
      (error) => console.error("Error fetching items:", error) 
    ));
  }, [dispatch, props.category]);

  useEffect(() => {
    getList();
  }, [props.category, getList]);

  // Filter unique item names
  const filteredItems = itemList.filter(
    (item, index, self) =>
      index === self.findIndex((t) => t.item_name === item.item_name) 
  );

  return (
    <>
    {/* {JSON.stringify(filteredItems)} */}
      <CustomTypeahead
        {...props}
        _ref={props._ref}
        allowNew={props.allowNew}
        placeholder="Search items by name"
        labelKey="item_name"
        options={filteredItems}
        onInputChange={(v) => {
          if (v.length) {
            console.log("User typed:", v);
            props.onInputChange(v);
          }
        }}
        onChange={(v) => {
          if (v.length) {
            console.log("Selected:", v[0]);
            props.onChange(v[0]);
          }
        }}
      />
    </>
  );
}

export default SearchItemInput;
