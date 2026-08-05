import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { Badge } from "../../ui/badge";
import {
  Package,
  Factory,
  ShoppingCart,
  BarChart3,
  Settings,
  Plus,
  Eye,
  Edit,
  Trash2,
} from "lucide-react";

// Import sub-components
import PurchaseOrderForm from "./components/PurchaseOrderForm";
import GoodsReceivedNote from "./components/GoodsReceivedNote";
import RawMaterialInventory from "./components/RawMaterialInventory";
import ProductionOrderForm from "./components/ProductionOrderForm";
import ShopFloorTracking from "./components/ShopFloorTracking";
import FinishedGoodsReport from "./components/FinishedGoodsReport";
import CostingReport from "./components/CostingReport";
import COGMReport from "./components/COGMReport";
import COGSReport from "./components/COGSReport";

const ProductionAutomation = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("procurement");
  const [facilityId] = useState("ae9d49ee-3f9c-4f1e-bd6c-d2f18c61269f"); // This should come from auth context
  const [loading, setLoading] = useState(false);

  // Handle URL tab parameter
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (
      tabFromUrl &&
      ["procurement", "production", "inventory", "reports"].includes(tabFromUrl)
    ) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const tabs = [
    {
      id: "procurement",
      label: "Procurement",
      icon: ShoppingCart,
      description: "Purchase Orders & Materials",
    },
    {
      id: "production",
      label: "Production",
      icon: Factory,
      description: "BOM & Work Orders",
    },
    {
      id: "inventory",
      label: "Inventory",
      icon: Package,
      description: "Materials & Finished Goods",
    },
    {
      id: "reports",
      label: "Reports",
      icon: BarChart3,
      description: "COGM, COGS & Analytics",
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "procurement":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PurchaseOrderForm facilityId={facilityId} />
              <GoodsReceivedNote facilityId={facilityId} />
            </div>
            <RawMaterialInventory facilityId={facilityId} />
          </div>
        );
      case "production":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ProductionOrderForm facilityId={facilityId} />
              <ShopFloorTracking facilityId={facilityId} />
            </div>
          </div>
        );
      case "inventory":
        return (
          <div className="space-y-6">
            <FinishedGoodsReport facilityId={facilityId} />
          </div>
        );
      case "reports":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <COGMReport facilityId={facilityId} />
              <COGSReport facilityId={facilityId} />
            </div>
            <CostingReport facilityId={facilityId} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Production Automation
          </h1>
          <p className="text-gray-600 mt-2">
            Complete production lifecycle management from procurement to sales
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          IFRS/FIRS Compliant
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <tab.icon className="h-5 w-5" />
                  {tab.label}
                </CardTitle>
                <p className="text-sm text-gray-600">{tab.description}</p>
              </CardHeader>
              <CardContent>{renderTabContent()}</CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default ProductionAutomation;
