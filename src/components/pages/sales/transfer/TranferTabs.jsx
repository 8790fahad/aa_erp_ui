import React from "react";
import { AiFillUsb } from "react-icons/ai";
// import { useSelector } from "react-redux";

import useQuery from "@/hooks/useQuery";
import VerticalMenu from "@/common/ui-elements/vertical-menu/VerticalMenu";


export const TransferTabs = ({ options = [], ref_from }) => {
  const query = useQuery();
  const store = query.get("tab");
  const storeName = query.get("store");

  return (
    <React.Fragment>
      <VerticalMenu title="List of stores">
        {options.map((item) => (
          <div
          key={item.id}
            onClick={() =>
              ref_from.current &&
              ref_from.current.setState({ text: item.storeName })
            }
          >
           {/* {JSON.stringify(storeName)} 
            {JSON.stringify()} */}
            {/* <HorizontalMenu
              route={`/app/sales/transfer?tab=${store}&store=${item.storeName}`}
              active={storeName===item.storeName?true:false}
            >
              <div>
                <AiFillUsb size={26} style={{ marginRight: 5 }} />
                {item.storeName}
              </div>
            </HorizontalMenu> */}
          </div>
        ))}
      </VerticalMenu>
    </React.Fragment>
  );
};
