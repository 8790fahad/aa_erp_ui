import { ArrowRightLeft } from "lucide-react";
import GoodsTransfer from "@/components/pages/purchase/GoodsTransfer";

export default function PurchaseInventory() {
  return (
    <div className="min-h-[70vh] px-3 py-4 sm:px-4 lg:px-6">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
          <ArrowRightLeft className="h-5 w-5 text-[#4267B2]" />
          Goods
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Finished Good, Resalable &amp; By-Product stock by warehouse
        </p>
      </div>
      <GoodsTransfer />
    </div>
  );
}
