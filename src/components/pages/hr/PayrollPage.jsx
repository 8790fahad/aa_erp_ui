import React, { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import RunPayrollTab from "./RunPayrollTab";
import PayrollHistory from "./PayrollHistory";
import { DollarSign, History, CreditCard } from "lucide-react";

const PAYROLL_TAB_PRIVILEGES = [
  "Run Payroll",
  "Payroll History",
  "Payroll Payment",
];

const ALL_TABS = [
  { id: "run", label: "Run Payroll", icon: DollarSign, privilege: "Run Payroll" },
  { id: "history", label: "History", icon: History, privilege: "Payroll History" },
  {
    id: "payment",
    label: "Payroll Payment",
    icon: CreditCard,
    privilege: "Payroll Payment",
  },
];

const parseFunctionalities = (raw) => {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const PayrollPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "run";
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const primaryColor = activeBusiness?.primary_color || "#1a2d5e";
  const secondaryColor =
    activeBusiness?.secondary_color &&
    String(activeBusiness.secondary_color).toLowerCase() !== "#ffffff"
      ? activeBusiness.secondary_color
      : primaryColor;

  const functionalities = useMemo(() => {
    return [
      ...new Set([
        ...parseFunctionalities(activeBusiness?.functionalities),
        ...parseFunctionalities(user?.functionalities),
      ]),
    ];
  }, [activeBusiness?.functionalities, user?.functionalities]);

  const canViewTab = useCallback(
    (privilege) => {
      if (functionalities.includes(privilege)) return true;
      // Legacy: parent only (no sub-keys yet) → full access
      const hasAnySub = PAYROLL_TAB_PRIVILEGES.some((p) =>
        functionalities.includes(p)
      );
      return (
        !hasAnySub && functionalities.includes("Payroll Processing")
      );
    },
    [functionalities]
  );

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((t) => canViewTab(t.privilege)),
    [canViewTab]
  );

  const setTab = (newTab) => {
    setSearchParams({ tab: newTab });
  };

  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!visibleTabs.some((t) => t.id === tab)) {
      setSearchParams({ tab: visibleTabs[0].id }, { replace: true });
    }
  }, [tab, visibleTabs, setSearchParams]);

  if (!visibleTabs.length) {
    return (
      <div className="rounded-2xl border border-muted bg-white p-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          You do not have permission to view payroll. Ask an admin to grant Run
          Payroll, History, or Payroll Payment access.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-0"
      style={{
        ["--app-primary"]: primaryColor,
        ["--app-secondary"]: secondaryColor,
      }}
    >
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-muted px-0 pt-3 pb-0">
        <div className="flex items-end gap-1">
          {visibleTabs.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`
                  flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest
                  border-b-2 transition-all duration-200 rounded-t-xl
                  ${
                    active
                      ? "bg-slate-50"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50/60"
                  }
                `}
                style={
                  active
                    ? { borderBottomColor: primaryColor, color: primaryColor }
                    : undefined
                }
              >
                <Icon className="size-3.5 shrink-0" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-2 px-0 pt-6">
        {tab === "run" && canViewTab("Run Payroll") && <RunPayrollTab />}
        {tab === "history" && canViewTab("Payroll History") && (
          <PayrollHistory mode="history" />
        )}
        {tab === "payment" && canViewTab("Payroll Payment") && (
          <PayrollHistory mode="payment" />
        )}
      </div>
    </div>
  );
};

export default PayrollPage;
