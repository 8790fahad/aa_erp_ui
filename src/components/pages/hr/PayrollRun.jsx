import React, { useState } from "react";
import { useSelector } from "react-redux";
import RunPayrollTab from "./RunPayrollTab";
import PayrollHistory from "./PayrollHistory";
import { DollarSign, History } from "lucide-react";

const PayrollContainer = () => {
  const [activeTab, setActiveTab] = useState("run");
  const { activeBusiness } = useSelector((state) => state.auth);
  const primaryColor = activeBusiness?.primary_color || "#4267B2";
  const secondaryColor =
    activeBusiness?.secondary_color &&
    String(activeBusiness.secondary_color).toLowerCase() !== "#ffffff"
      ? activeBusiness.secondary_color
      : primaryColor;

  return (
    <div
      className="min-h-screen bg-transparent"
      style={{
        ["--app-primary"]: primaryColor,
        ["--app-secondary"]: secondaryColor,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Payroll Management</h1>
            <p className="text-sm text-gray-500 mt-1">Process current salaries and view past payment batches.</p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg self-start md:self-auto">
            <button
              onClick={() => setActiveTab("run")}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "run"
                  ? "bg-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              style={activeTab === "run" ? { color: primaryColor } : undefined}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Run Payroll
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "history"
                  ? "bg-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              style={activeTab === "history" ? { color: primaryColor } : undefined}
            >
              <History className="w-4 h-4 mr-2" />
              Payroll History
            </button>
          </div>
        </div>

        <div>
          {activeTab === "run" ? <RunPayrollTab /> : <PayrollHistory />}
        </div>
      </div>
    </div>
  );
};

export default PayrollContainer;
