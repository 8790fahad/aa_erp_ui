import { ArrowRightLeft } from "lucide-react";
import GoodsTransfer from "@/components/pages/purchase/GoodsTransfer";

export default function PurchaseInventory() {
  return (
    <div className="p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold"> Good Transfer</h1>
        <p className="text-muted-foreground">
         Transfer goods across locations
        </p>
      </div>


      {/* <div className="bg-white rounded-lg border border-gray-200 p-4"> */}
        <GoodsTransfer />
      {/* </div> */}
    </div>
  );
}
