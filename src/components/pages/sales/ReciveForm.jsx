import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomTable1 from "@/common/Custom/CustomTable1";
import SearchBar from "@/common/Custom/SearchBar";
import { getPendingItems, updatePendingItems } from "@/redux/actions/sales";
import { formatNumber } from "@/utilities";
import  { useEffect } from "react";
import { Check, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Container } from "reactstrap";
import { Button as UIButton } from "@/components/ui/button";


function ReciveForm() {
  const store = useSelector((state) => state.auth.user.store);
  const sales = useSelector((state) => state.sales.pendingItems);
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(getPendingItems(store));
  }, [dispatch, store]);
  const fields = [
    { 
      value: "item_name",
      title: "Item Name",
      className: "text-left"
    },
    {
      value: "qty_in",
      title: "Qty",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-sm">{formatNumber(item.qty_in)}</div>
      ),
    },
    {
      value: "selling_price",
      title: "Price",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-sm">{formatNumber(item.selling_price)}</div>
      ),
    },
    { 
      value: "location_from",
      title: "Transfer From",
      className: "text-left"
    },
    {
      value: "action",
      title: "Receive",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="flex justify-center gap-2">
          <UIButton
            variant="ghost"
            size="sm"
            onClick={() => {
              let query_type = "accept";
              dispatch(
                updatePendingItems(item.trn_number, item.id, store, query_type)
              );
            }}
            className="text-green-600 hover:text-green-800 hover:bg-green-50"
            title="Accept"
          >
            <Check className="h-4 w-4" />
          </UIButton>
          <UIButton
            variant="ghost"
            size="sm"
            onClick={() => {
              let query_type = "reject";
              dispatch(
                updatePendingItems(item.trn_number, item.id, store, query_type)
              );
            }}
            className="text-red-600 hover:text-red-800 hover:bg-red-50"
            title="Reject"
          >
            <X className="h-4 w-4" />
          </UIButton>
        </div>
      ),
    },
  ];
  return (
    <Container>
      <CustomCard header="Receive Form">
        <SearchBar placeholder="Search for Recieved item" />
        <CustomTable1 fields={fields} data={sales} pageSize={10} message="No pending items found" />
        {/* <Button color="success">Recive All</Button>
        <Button color="danger" className="float-right" outline>
          Reject All
        </Button> */}
      </CustomCard>
    </Container>
  );
}

export default ReciveForm;
