import React, { useState } from "react";
import { useSelector } from "react-redux";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AttendanceClock from "./AttendanceClock";
import AttendanceReportCompact from "./AttendanceReportCompact";
import AttendanceBulkUpload from "./AttendanceBulkUpload";
import AttendanceReport from "./AttendanceReport";
import { Clock, UploadCloud, History } from "lucide-react";
import { getAaBrandColors } from "@/lib/aaBrand";

const AttendanceManagement = () => {
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [activeTab, setActiveTab] = useState("live");
  const { activeBusiness } = useSelector((state) => state.auth);
  const {
    primaryColor,
    secondaryColor,
    accentColor,
    headerGradient: brandHeaderGradient,
    brandButtonStyle: brandBtn,
    appColorStyle: brandAppStyle,
  } = getAaBrandColors();

  return (
    <div
      className="flex flex-col gap-0"
      style={{
        ["--app-primary"]: primaryColor,
        ["--app-secondary"]: secondaryColor,
      }}
    >
      <div className="px-1 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-foreground italic uppercase">
          Attendance Management
        </h1>
        <p className="text-xs text-muted-foreground font-medium mt-1">
          Record, track and manage employee attendance logs
        </p>
      </div>
      
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-muted px-0 pt-1 pb-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-auto bg-transparent p-0 w-full justify-start gap-1 rounded-none border-0">
            {[
              { value: "live", label: "Live Attendance", icon: Clock },
              { value: "manual", label: "Manual Upload", icon: UploadCloud },
              { value: "history", label: "History", icon: History },
            ].map(({ value, label, icon: Icon }) => {
              const active = activeTab === value;
              return (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={`
                    flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest
                    border-b-2 rounded-t-xl shadow-none data-[state=active]:shadow-none
                    ${
                      active
                        ? "bg-slate-50 text-slate-900"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50/60"
                    }
                  `}
                  style={
                    active
                      ? { borderBottomColor: primaryColor, color: primaryColor }
                      : undefined
                  }
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
          </TabsTrigger>
              );
            })}
        </TabsList>
        
          <div className="pt-6">
            <TabsContent
              value="live"
              className="mt-0 animate-in fade-in duration-500"
            >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AttendanceClock
              employee={selectedEmployee}
              isSecurityGate={true}
            />
                <AttendanceReportCompact
                  onViewFullReport={() => setActiveTab("history")}
                />
          </div>
        </TabsContent>
        
            <TabsContent
              value="manual"
              className="mt-0 animate-in fade-in duration-500"
            >
           <AttendanceBulkUpload />
        </TabsContent>

            <TabsContent
              value="history"
              className="mt-0 animate-in fade-in duration-500"
            >
              <AttendanceReport />
            </TabsContent>
          </div>
      </Tabs>
      </div>
    </div>
  );
};

export default AttendanceManagement;
