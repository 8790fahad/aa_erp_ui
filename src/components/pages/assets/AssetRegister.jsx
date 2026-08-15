import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus,
  X,
  Search,
  Wrench,
  ArrowRightLeft,
  Trash2,
  Tag,
  ChevronRight,
  Building2,
  Package,
  Car,
  Monitor,
  Sofa,
  Boxes,
  Loader2,
} from "lucide-react";
import { apiURL, _fetchApi } from "@/redux/actions/api";

// ---------- Category config: name, icon, GL account mapping ----------
const CATEGORIES = {
  "Land & Building": {
    icon: Building2,
    cost: "1500",
    accDep: "1510",
    depExp: "5510",
  },
  "Plant & Machinery": {
    icon: Package,
    cost: "1520",
    accDep: "1530",
    depExp: "5520",
  },
  "Motor Vehicles": { icon: Car, cost: "1540", accDep: "1550", depExp: "5530" },
  "Furniture & Fittings": {
    icon: Sofa,
    cost: "1560",
    accDep: "1570",
    depExp: "5540",
  },
  "IT Equipment": {
    icon: Monitor,
    cost: "1580",
    accDep: "1590",
    depExp: "5550",
  },
  "Office Equipment": {
    icon: Boxes,
    cost: "1600",
    accDep: "1610",
    depExp: "5560",
  },
};

const STATUS_STYLE = {
  Active: { bg: "#E9F6EF", fg: "#1F9D6B", dot: "#1F9D6B" },
  "Under Maintenance": { bg: "#FBF1E3", fg: "#B4740E", dot: "#D98C2B" },
  Disposed: { bg: "#F1EEF9", fg: "#6952B3", dot: "#8B72D9" },
  "Written Off": { bg: "#FBEAEA", fg: "#C24444", dot: "#C24444" },
};

const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 });

// ---------- Brand color helpers ----------
function hexToRgb(hex) {
  if (!hex || typeof hex !== "string") return { r: 30, g: 86, b: 160 };
  let h = hex.replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return { r: 30, g: 86, b: 160 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function shadeColor(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (v) =>
    Math.max(
      0,
      Math.min(
        255,
        Math.round(v + (percent / 100) * (percent < 0 ? v : 255 - v)),
      ),
    );
  const nr = clamp(r);
  const ng = clamp(g);
  const nb = clamp(b);
  return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
}

function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---------- API helpers ----------
const authHeaders = () => ({
  "Content-Type": "application/json",
  authorization: localStorage.getItem("@@__token"),
});

const toApiDepreciationMethod = (m) =>
  m === "Reducing Balance" ? "Reducing Balance" : "Straight Line";
const fromApiDepreciationMethod = (m) =>
  m === "Reducing Balance" ? "Reducing Balance" : "Straight-line";

// Map an API asset row -> the shape this UI expects.
function mapApiAsset(a, existingMaintenance = []) {
  if (!a) return null;
  const apiNbv = a.netBookValue ?? a.net_book_value;
  const apiAccDep = a.accumulatedDepreciation ?? a.accumulated_depreciation;
  return {
    id: a.id,
    code: a.asset_code || a.assetCode || "",
    name: a.asset_name || a.assetName || a.description || "Untitled asset",
    category: a.category || "Office Equipment",
    acquisitionDate: (a.acquisition_date || a.acquisitionDate || "").slice(
      0,
      10,
    ),
    cost: Number(a.acquisition_cost ?? a.acquisitionCost) || 0,
    vendor: a.supplier_name || a.supplierName || "",
    supplierNumber: a.supplier_number || a.supplierNumber || "",
    invoiceRef: a.invoice_ref || a.invoiceRef || "",
    location: a.location || "",
    department: a.department_id || a.departmentId || "",
    custodian: a.custodian || "",
    depreciationMethod: fromApiDepreciationMethod(
      a.depreciation_method || a.depreciationMethod,
    ),
    usefulLife: Number(a.useful_life_years ?? a.usefulLife) || 0,
    rate: Number(a.depreciation_rate ?? a.depreciationRate) || 0,
    residualValue: Number(a.residual_value ?? a.residualValue) || 0,
    status: a.status || "Active",
    notes: a.notes || "",
    disposalDate:
      a.disposal_date || a.disposalDate || ""
        ? (a.disposal_date || a.disposalDate).slice(0, 10)
        : null,
    proceeds:
      a.disposal_proceeds != null
        ? Number(a.disposal_proceeds)
        : a.disposalProceeds != null
          ? Number(a.disposalProceeds)
          : undefined,
    gainLoss: a.gainLoss != null ? Number(a.gainLoss) : undefined,
    apiNbv: apiNbv != null ? Number(apiNbv) : undefined,
    apiAccDep: apiAccDep != null ? Number(apiAccDep) : 0,
    maintenance: existingMaintenance,
  };
}

function computeNBV(asset) {
  const cost = Number(asset.cost) || 0;
  // Carrying amount = cost − accumulated depreciation (from posted runs only)
  const accDep = Math.max(
    0,
    Number(
      asset.apiAccDep != null && !Number.isNaN(Number(asset.apiAccDep))
        ? asset.apiAccDep
        : 0,
    ),
  );
  return { nbv: Math.max(0, cost - accDep), accDep };
}

const emptyDraft = {
  name: "",
  category: "IT Equipment",
  acquisitionDate: new Date().toISOString().slice(0, 10),
  cost: "",
  vendor: "",
  supplierNumber: "",
  invoiceRef: "",
  location: "",
  department: "",
  custodian: "",
  depreciationMethod: "Straight-line",
  usefulLife: "5",
  rate: "",
  residualValue: "0",
  status: "Active",
  notes: "",
};

function makeEmptyDraft(depreciationMethod = "Straight-line") {
  return {
    ...emptyDraft,
    acquisitionDate: new Date().toISOString().slice(0, 10),
    invoiceRef: "",
    supplierNumber: "",
    depreciationMethod:
      depreciationMethod === "Reducing Balance"
        ? "Reducing Balance"
        : "Straight-line",
  };
}

const ASSET_TABS = [
  { id: "register", label: "Register" },
  { id: "add", label: "Add Asset" },
];

export default function AssetRegister() {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const [searchParams, setSearchParams] = useSearchParams();
  const facilityId = activeBusiness?.id || user?.facilityId;
  const primaryColor = activeBusiness?.primary_color || "#4267B2";
  const secondaryColor = activeBusiness?.secondary_color;
  const darkColor = useMemo(
    () => shadeColor(primaryColor, -38),
    [primaryColor],
  );
  const primaryAlpha = useMemo(
    () => hexToRgba(primaryColor, 0.12),
    [primaryColor],
  );
  const gradientEnd =
    secondaryColor && String(secondaryColor).toLowerCase() !== "#ffffff"
      ? secondaryColor
      : primaryColor;
  const headerGradient = `linear-gradient(to right, ${primaryColor}, ${gradientEnd})`;
  const defaultDepreciationMethod = fromApiDepreciationMethod(
    activeBusiness?.depreciation_method || "Straight Line",
  );

  const tabParam = searchParams.get("tab") || "register";
  const tab = ASSET_TABS.some((t) => t.id === tabParam) ? tabParam : "register";

  const setTab = useCallback(
    (nextTab) => {
      const next = new URLSearchParams(searchParams);
      if (!nextTab || nextTab === "register") next.delete("tab");
      else next.set("tab", nextTab);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const [assets, setAssets] = useState([]);
  const [journal, setJournal] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState(null); // asset id for detail panel
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [draft, setDraft] = useState(() =>
    makeEmptyDraft(
      fromApiDepreciationMethod(
        activeBusiness?.depreciation_method || "Straight Line",
      ),
    ),
  );
  const [maintDraft, setMaintDraft] = useState({
    date: new Date().toISOString().slice(0, 10),
    cost: "",
    vendor: "",
    description: "",
  });
  const [saveState, setSaveState] = useState("idle");
  const [depRunning, setDepRunning] = useState(false);

  // ---- load ----
  const loadAssets = useCallback(() => {
    if (!facilityId) {
      setLoaded(true);
      return;
    }
    setLoaded(false);
    fetch(`${apiURL}/api/assets?facilityId=${facilityId}&limit=1000`, {
      headers: authHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          const list = data.data?.assets || [];
          setAssets((prev) => {
            const prevMaint = new Map(
              prev.map((a) => [a.id, a.maintenance || []]),
            );
            return list.map((a) => mapApiAsset(a, prevMaint.get(a.id) || []));
          });
        } else {
          toast.error(data?.message || "Failed to load assets");
        }
      })
      .catch(() => toast.error("Failed to load assets"))
      .finally(() => setLoaded(true));
  }, [facilityId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (tabParam !== tab) {
      setTab("register");
    }
  }, [tabParam, tab, setTab]);

  useEffect(() => {
    if (tab !== "register") setSelected(null);
    if (tab === "add") {
      setDraft(makeEmptyDraft(defaultDepreciationMethod));
    }
  }, [tab, defaultDepreciationMethod]);

  useEffect(() => {
    if (!facilityId) return;
    _fetchApi(
      `/account/get/branches?facilityId=${facilityId}`,
      (res) => {
        if (res?.success) setBranches(res.results || []);
      },
      (err) => console.error("Error fetching warehouses:", err),
    );
    _fetchApi(
      `/api/get/department?facilityId=${facilityId}`,
      (data) => {
        if (data?.success) setDepartments(data.results || []);
      },
      (err) => console.error("Error fetching departments:", err),
    );
  }, [facilityId]);

  // Optionally pull the maintenance log for the asset opened in the detail panel.
  useEffect(() => {
    if (!selected) return;
    fetch(`${apiURL}/api/assets/${selected}/maintenance`, {
      headers: authHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success) return;
        const records = (data.data?.records || []).map((r) => ({
          id: r.id,
          date: (r.actualDate || r.scheduledDate || "").slice(0, 10),
          cost: Number(r.cost) || 0,
          vendor: r.vendor || "",
          description: r.description || "",
        }));
        setAssets((prev) =>
          prev.map((a) =>
            a.id === selected ? { ...a, maintenance: records } : a,
          ),
        );
      })
      .catch(() => {});
  }, [selected]);

  const postEntry = (next, entry) => [
    { ...entry, id: Date.now() + Math.random().toString(36).slice(2, 7) },
    ...next,
  ];

  const addAsset = () => {
    if (!draft.name.trim() || !draft.cost) {
      toast.error("Asset name and cost are required");
      return;
    }
    if (!facilityId) {
      toast.error("No active facility found");
      return;
    }
    const isReducing = draft.depreciationMethod === "Reducing Balance";
    if (isReducing && !(Number(draft.rate) > 0)) {
      toast.error("Rate (%) is required for Reducing Balance");
      return;
    }
    if (!isReducing && !(Number(draft.usefulLife) > 0)) {
      toast.error("Useful life (years) is required for Straight-line");
      return;
    }
    const cost = Number(draft.cost) || 0;
    setSaveState("saving");
    fetch(`${apiURL}/api/assets`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        facilityId,
        description: draft.name,
        assetName: draft.name,
        category: draft.category,
        acquisitionDate: draft.acquisitionDate,
        acquisitionCost: cost,
        usefulLife: Number(draft.usefulLife) || (isReducing ? 1 : 0),
        residualValue: Number(draft.residualValue) || 0,
        depreciationMethod: toApiDepreciationMethod(draft.depreciationMethod),
        depreciationRate: Number(draft.rate) || 0,
        location: draft.location,
        departmentId: draft.department || undefined,
        custodian: draft.custodian,
        supplierName: draft.vendor,
        supplierNumber: draft.supplierNumber || undefined,
        invoiceRef: draft.invoiceRef || undefined,
        notes: draft.notes,
        status: draft.status,
        // Register only — ledger / account treatment happens when depreciation is run
        postToLedger: false,
        recordedInPurchase: false,
        createdBy: user?.id,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          const asset = mapApiAsset(data.data);
          setAssets((prev) => [asset, ...prev]);
          setJournal((prev) =>
            postEntry(prev, {
              date: asset.acquisitionDate,
              memo: `Register ${asset.name} (${asset.code}) — no GL until depreciation`,
              journalRef: null,
            }),
          );
          toast.success(
            "Asset recorded (ledger posts when you run depreciation)",
          );
          setDraft(makeEmptyDraft(defaultDepreciationMethod));
          setTab("register");
          setSaveState("saved");
        } else {
          toast.error(data?.message || "Failed to save asset");
          setSaveState("error");
        }
      })
      .catch(() => {
        toast.error("Failed to save asset");
        setSaveState("error");
      })
      .finally(() => setTimeout(() => setSaveState("idle"), 1200));
  };

  const disposeAsset = (id, proceeds) => {
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;
    const disposalDate = new Date().toISOString().slice(0, 10);
    const proceedsNum = Number(proceeds) || 0;
    fetch(`${apiURL}/api/assets/${id}/dispose`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        disposalProceeds: proceedsNum,
        disposalDate,
        facilityId,
        disposalMethod: "Sale",
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          const updated = mapApiAsset(data.data?.asset, asset.maintenance);
          setAssets((prev) =>
            prev.map((a) =>
              a.id === id ? { ...updated, gainLoss: data.gainLoss } : a,
            ),
          );
          setJournal((prev) =>
            postEntry(prev, {
              date: disposalDate,
              memo: `Dispose ${asset.name} (${asset.code}) — proceeds ${naira(proceedsNum)}${data.gainLoss != null ? `, ${data.gainLoss >= 0 ? "gain" : "loss"} of ${naira(Math.abs(data.gainLoss))}` : ""}`,
              journalRef: data.journalRef || null,
            }),
          );
          toast.success(
            data.ledgerWarning
              ? "Asset disposed, but ledger posting failed"
              : "Asset disposed successfully",
          );
        } else {
          toast.error(data?.message || "Failed to dispose asset");
        }
      })
      .catch(() => toast.error("Failed to dispose asset"));
  };

  const writeOffAsset = (id) => {
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;
    const disposalDate = new Date().toISOString().slice(0, 10);
    fetch(`${apiURL}/api/assets/${id}/write-off`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        writeOffDate: disposalDate,
        facilityId,
        createdBy: user?.id,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          const updated = mapApiAsset(data.data?.asset, asset.maintenance);
          setAssets((prev) => prev.map((a) => (a.id === id ? updated : a)));
          setJournal((prev) =>
            postEntry(prev, {
              date: disposalDate,
              memo: `Write off ${asset.name} (${asset.code})`,
              journalRef: data.journalRef || null,
            }),
          );
          toast.success(
            data.ledgerWarning
              ? "Asset written off, but ledger posting failed"
              : "Asset written off successfully",
          );
          setSelected(null);
        } else {
          toast.error(data?.message || "Failed to write off asset");
        }
      })
      .catch(() => toast.error("Failed to write off asset"));
  };

  const toggleMaintenance = (id) => {
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;
    const nextStatus =
      asset.status === "Under Maintenance" ? "Active" : "Under Maintenance";
    fetch(`${apiURL}/api/assets/${id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ status: nextStatus, facilityId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          setAssets((prev) =>
            prev.map((a) => (a.id === id ? { ...a, status: nextStatus } : a)),
          );
          toast.success(
            nextStatus === "Under Maintenance"
              ? "Asset sent to maintenance"
              : "Asset marked as active",
          );
        } else {
          toast.error(data?.message || "Failed to update asset status");
        }
      })
      .catch(() => toast.error("Failed to update asset status"));
  };

  const addMaintenanceEntry = (id) => {
    if (!maintDraft.description.trim()) {
      toast.error("Enter a maintenance description");
      return;
    }
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;
    const costNum = Number(maintDraft.cost) || 0;
    fetch(`${apiURL}/api/assets/${id}/maintenance`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        actualDate: maintDraft.date,
        cost: costNum,
        vendor: maintDraft.vendor,
        description: maintDraft.description,
        maintenanceType: "Corrective",
        status: "Completed",
        facilityId,
        createdBy: user?.id,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          const record = data.data || {};
          const entry = {
            id: record.id || Date.now(),
            date: (record.actualDate || maintDraft.date || "").slice(0, 10),
            cost: costNum,
            vendor: maintDraft.vendor,
            description: maintDraft.description,
          };
          setAssets((prev) =>
            prev.map((a) =>
              a.id === id
                ? { ...a, maintenance: [entry, ...(a.maintenance || [])] }
                : a,
            ),
          );
          if (costNum > 0) {
            setJournal((prev) =>
              postEntry(prev, {
                date: maintDraft.date,
                memo: `Maintenance — ${asset.name} (${asset.code}): ${maintDraft.description}`,
                journalRef: null,
              }),
            );
          }
          toast.success("Maintenance entry added");
          setMaintDraft({
            date: new Date().toISOString().slice(0, 10),
            cost: "",
            vendor: "",
            description: "",
          });
        } else {
          toast.error(data?.message || "Failed to add maintenance entry");
        }
      })
      .catch(() => toast.error("Failed to add maintenance entry"));
  };

  const runDepreciation = () => {
    if (!facilityId) return;
    const freq = activeBusiness?.auto_depreciation_frequency || "monthly";
    const periodMonths =
      freq === "yearly" ? 12 : freq === "quarterly" ? 3 : 1;
    const today = new Date();
    const periodEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    const periodEndDate = periodEnd.toISOString().slice(0, 10);

    if (
      !window.confirm(
        `Run depreciation for active assets?\n\nPeriod: last ${periodMonths} month(s) ending ${periodEndDate}`,
      )
    ) {
      return;
    }

    setDepRunning(true);
    fetch(`${apiURL}/api/assets/depreciation/bulk`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        facilityId,
        periodEndDate,
        periodMonths,
        createdBy: user?.id,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          const {
            processedAssets = 0,
            totalBookDepreciation = 0,
            journalRef,
          } = data.data || {};
          if (processedAssets > 0) {
            setJournal((prev) =>
              postEntry(prev, {
                date: periodEndDate,
                memo: `Depreciation run — ${processedAssets} asset${processedAssets === 1 ? "" : "s"}, ${naira(totalBookDepreciation)}`,
                journalRef: journalRef || null,
              }),
            );
            toast.success(data.message || "Depreciation run completed");
            loadAssets();
          } else {
            toast.info("No assets were due for depreciation");
          }
        } else {
          toast.error(data?.message || "Failed to run depreciation");
        }
      })
      .catch(() => toast.error("Failed to run depreciation"))
      .finally(() => setDepRunning(false));
  };

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (catFilter !== "All" && a.category !== catFilter) return false;
      if (statusFilter !== "All" && a.status !== statusFilter) return false;
      if (
        query &&
        !(
          a.name.toLowerCase().includes(query.toLowerCase()) ||
          a.code.toLowerCase().includes(query.toLowerCase())
        )
      )
        return false;
      return true;
    });
  }, [assets, catFilter, statusFilter, query]);

  const selectedAsset = assets.find((a) => a.id === selected);

  return (
    <div
      className="flex flex-col gap-0 min-h-full"
      style={{
        "--ar-primary": primaryColor,
        "--ar-dark": darkColor,
        "--ar-primary-alpha": primaryAlpha,
      }}
    >
      <style>{`
        .ar-font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .ar-input {
          width: 100%; padding: 9px 11px; border-radius: 0.75rem;
          border: 1px solid #e2e8f0; background: #fff; font-size: 13.5px;
          color: #0f172a; outline: none; box-sizing: border-box;
        }
        .ar-input:focus { border-color: var(--ar-primary); box-shadow: 0 0 0 3px var(--ar-primary-alpha); }
        .ar-label { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 5px; display: block; }
        .ar-btn-primary {
          background: var(--ar-primary); color: white; border: none; border-radius: 0.75rem;
          padding: 10px 18px; font-weight: 700; font-size: 12px; cursor: pointer;
          display: inline-flex; align-items: center; gap: 6px; transition: opacity 0.15s;
          text-transform: uppercase; letter-spacing: 0.04em;
        }
        .ar-btn-primary:hover { opacity: 0.92; }
        .ar-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .ar-btn-ghost {
          background: transparent; color: #475569; border: 1px solid #e2e8f0; border-radius: 0.75rem;
          padding: 9px 14px; font-weight: 700; font-size: 12px; cursor: pointer;
          display: inline-flex; align-items: center; gap: 6px;
        }
        .ar-btn-ghost:hover { background: #f8fafc; }
        .ar-table-row:hover { background: #F8FAFC; cursor: pointer; }
        .ar-tag {
          display: inline-flex; align-items: center; gap: 5px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px; font-weight: 500;
          padding: 3px 8px 3px 6px; border-radius: 6px;
          background: var(--ar-primary-alpha); color: var(--ar-primary);
          border: 1px solid color-mix(in srgb, var(--ar-primary) 25%, transparent);
        }
      `}</style>

      {/* Page title — matches Attendance / Payroll */}
      <div className="px-1 pb-3">
        <h1 className="text-2xl font-black tracking-tight text-foreground italic uppercase">
          Asset Register
        </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            Register assets without ledger impact; account treatment posts when
            you run depreciation
            {activeBusiness?.auto_depreciation_enabled
              ? " · auto-run enabled"
              : ""}
          </p>
      </div>

      {/* Tab bar */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-muted px-0 pt-1 pb-0 mb-4">
        <div className="flex items-end gap-1 overflow-x-auto">
          {ASSET_TABS.map((t) => {
            const active = tab === t.id;
            const to =
              t.id === "register" ? "/app/assets" : `/app/assets?tab=${t.id}`;
            return (
              <Link
                key={t.id}
                to={to}
                className={`
                  flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest
                  border-b-2 rounded-t-xl transition-all no-underline
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
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Brand action strip */}
      <div
        className="rounded-2xl px-5 py-4 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white relative overflow-hidden"
        style={{ background: headerGradient }}
      >
        <div className="absolute right-4 top-2 opacity-10 pointer-events-none">
          <Building2 className="size-20" />
        </div>
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/70">
            Workflow
          </p>
          <p className="text-sm font-black italic tracking-tight">
            Asset control panel
          </p>
          {activeBusiness?.auto_depreciation_enabled ? (
            <p className="text-[10px] text-white/80 mt-1">
              Auto depreciation: {activeBusiness.auto_depreciation_frequency || "monthly"}{" "}
              on day {activeBusiness.auto_depreciation_day || 1}
              {activeBusiness.auto_depreciation_last_run
                ? ` · last ${String(activeBusiness.auto_depreciation_last_run).slice(0, 10)}`
                : ""}
            </p>
          ) : (
            <p className="text-[10px] text-white/70 mt-1">
              Enable auto-run in Admin → Settings → Depreciation
            </p>
          )}
        </div>
        <div className="relative z-10 flex flex-wrap gap-2">
          <button
            type="button"
            className="h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest bg-white/15 hover:bg-white/25 border border-white/25 transition-colors"
            onClick={runDepreciation}
            disabled={depRunning}
          >
            {depRunning ? (
              <Loader2 size={14} className="inline animate-spin mr-1.5" />
            ) : null}
            Run Depreciation
          </button>
          <button
            type="button"
            className="h-10 px-5 rounded-xl text-xs font-black uppercase tracking-widest bg-white hover:bg-white/90 transition-opacity"
            style={{ color: primaryColor }}
            onClick={() => {
              setSelected(null);
              setTab("add");
            }}
          >
            <Plus size={14} className="inline mr-1.5" /> Add Asset
          </button>
        </div>
      </div>

      <div className="pb-16">
        {tab === "register" && !selectedAsset && (
          <div className="bg-white border border-muted rounded-2xl overflow-hidden shadow-sm">
            {/* Filters */}
            <div className="flex gap-2.5 p-3.5 border-b border-muted flex-wrap bg-slate-50/40">
              <div style={{ position: "relative", flex: "1 1 220px" }}>
                <Search
                  size={14}
                  style={{
                    position: "absolute",
                    left: 10,
                    top: 10,
                    color: "#94A3B8",
                  }}
                />
                <input
                  className="ar-input"
                  style={{ paddingLeft: 30 }}
                  placeholder="Search name or asset code"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <select
                className="ar-input"
                style={{ width: 180 }}
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
              >
                <option>All</option>
                {Object.keys(CATEGORIES).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                className="ar-input"
                style={{ width: 170 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>All</option>
                {Object.keys(STATUS_STYLE).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            {!loaded ? (
              <div
                style={{
                  padding: "60px 20px",
                  textAlign: "center",
                  color: "#94A3B8",
                }}
              >
                <Loader2
                  size={22}
                  className="animate-spin"
                  style={{ marginBottom: 8 }}
                />
                <div style={{ fontSize: 13.5 }}>Loading assets…</div>
              </div>
            ) : filtered.length === 0 ? (
              <div
                style={{
                  padding: "60px 20px",
                  textAlign: "center",
                  color: "#94A3B8",
                }}
              >
                {assets.length === 0 ? (
                  <>
                    <Tag
                      size={26}
                      style={{
                        marginBottom: 10,
                        opacity: 0.55,
                        color: primaryColor,
                      }}
                    />
                    <div className="text-sm font-black italic tracking-tight text-foreground">
                      No assets recorded yet
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      Record your first asset to start the register.
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13.5 }}>
                    No assets match these filters.
                  </div>
                )}
              </div>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13.5,
                }}
              >
                <thead>
                  <tr style={{ background: "#FAFBFD", textAlign: "left" }}>
                    {["Asset", "Category", "Warehouse", "Carrying amount", "Status", ""].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 14px",
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: "#8996A8",
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                            borderBottom: "1px solid #EDF1F6",
                          }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => {
                    const Icon = CATEGORIES[a.category]?.icon || Package;
                    const { nbv } = computeNBV(a);
                    const st = STATUS_STYLE[a.status] || STATUS_STYLE.Active;
                    return (
                      <tr
                        key={a.id}
                        className="ar-table-row"
                        onClick={() => setSelected(a.id)}
                        style={{ borderBottom: "1px solid #F2F5F9" }}
                      >
                        <td style={{ padding: "11px 14px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 9,
                            }}
                          >
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 7,
                                background: "#EEF2F7",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--ar-primary)",
                              }}
                            >
                              <Icon size={15} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600 }}>{a.name}</div>
                              <div
                                className="ar-font-mono"
                                style={{ fontSize: 11.5, color: "#94A3B8" }}
                              >
                                {a.code}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "11px 14px", color: "#475569" }}>
                          {a.category}
                        </td>
                        <td style={{ padding: "11px 14px", color: "#475569" }}>
                          {a.location || "—"}
                        </td>
                        <td
                          className="ar-font-mono"
                          style={{ padding: "11px 14px", fontWeight: 600 }}
                        >
                          {naira(nbv)}
                        </td>
                        <td style={{ padding: "11px 14px" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              background: st.bg,
                              color: st.fg,
                              padding: "3px 10px",
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: st.dot,
                              }}
                            />
                            {a.status}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "11px 14px",
                            textAlign: "right",
                            color: "#C7D0DC",
                          }}
                        >
                          <ChevronRight size={16} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "ledger" && (
          <div className="bg-white border border-muted rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3.5 border-b border-muted text-xs text-muted-foreground bg-slate-50/40">
              A local summary of actions this session. Account treatment
              (depreciation expense / accumulated depreciation) posts to the
              ledger when you <b>Run Depreciation</b>. Full double-entry
              appears in <b>Account → General Ledger</b>.
            </div>
            {journal.length === 0 ? (
              <div
                style={{
                  padding: "60px 20px",
                  textAlign: "center",
                  color: "#94A3B8",
                }}
              >
                <div
                  style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}
                >
                  No entries posted yet
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  Register assets without ledger impact. Run depreciation,
                  maintenance, or dispose to see postings here.
                </div>
              </div>
            ) : (
              <div>
                {journal.map((e) => (
                  <div
                    key={e.id}
                    style={{
                      padding: "14px 16px",
                      borderBottom: "1px solid #F2F5F9",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "var(--ar-dark)",
                        }}
                      >
                        {e.memo}
                      </div>
                      <div
                        className="ar-font-mono"
                        style={{
                          fontSize: 12,
                          color: "#94A3B8",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {e.date}
                      </div>
                    </div>
                    <div
                      style={{ marginTop: 6, fontSize: 12, color: "#94A3B8" }}
                    >
                      {e.journalRef ? (
                        <>
                          Posted to ledger — ref{" "}
                          <span className="ar-tag">{e.journalRef}</span>
                        </>
                      ) : (
                        "Postings appear in Account → General Ledger"
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Detail panel */}
        {selectedAsset && (
          <AssetDetail
            asset={selectedAsset}
            departments={departments}
            onBack={() => setSelected(null)}
            onDispose={disposeAsset}
            onToggleMaintenance={toggleMaintenance}
            onWriteOff={writeOffAsset}
            maintDraft={maintDraft}
            setMaintDraft={setMaintDraft}
            onAddMaintenance={addMaintenanceEntry}
          />
        )}

        {/* Add asset form */}
        {tab === "add" && (
          <div className="bg-white border border-muted rounded-2xl p-5 shadow-sm">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <div
                className="text-base font-black italic tracking-tight uppercase"
                style={{ color: primaryColor }}
              >
                Add Asset
              </div>
              <button
                className="ar-btn-ghost"
                onClick={() => setTab("register")}
              >
                <X size={14} /> Cancel
              </button>
            </div>

            <div
              className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600"
            >
              Register only — no ledger posting until you{" "}
              <span className="font-semibold text-slate-800">Run Depreciation</span>.
              Carrying amount starts as Cost (accum. dep = ₦0).
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="ar-label">Asset name</label>
                <input
                  className="ar-input"
                  placeholder="e.g. Toyota Hilux — Sales Fleet"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft({ ...draft, name: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="ar-label">Category</label>
                <select
                  className="ar-input"
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
                >
                  {Object.keys(CATEGORIES).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ar-label">Acquisition date</label>
                <input
                  type="date"
                  className="ar-input"
                  value={draft.acquisitionDate}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      acquisitionDate: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="ar-label">Cost (₦)</label>
                <input
                  type="number"
                  className="ar-input"
                  placeholder="0.00"
                  value={draft.cost}
                  onChange={(e) =>
                    setDraft({ ...draft, cost: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="ar-label">Vendor / supplier</label>
                <input
                  className="ar-input"
                  value={draft.vendor}
                  onChange={(e) =>
                    setDraft({ ...draft, vendor: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="ar-label">Invoice ref (optional)</label>
                <input
                  className="ar-input"
                  placeholder="e.g. INV-2041"
                  value={draft.invoiceRef}
                  onChange={(e) =>
                    setDraft({ ...draft, invoiceRef: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="ar-label">Warehouse</label>
                <select
                  className="ar-input"
                  value={draft.location}
                  onChange={(e) =>
                    setDraft({ ...draft, location: e.target.value })
                  }
                >
                  <option value="">Select warehouse</option>
                  {branches
                    .filter((b) => b.branch_name)
                    .map((b) => (
                      <option key={b.id} value={b.branch_name}>
                        {b.branch_name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="ar-label">Department</label>
                <select
                  className="ar-input"
                  value={draft.department}
                  onChange={(e) =>
                    setDraft({ ...draft, department: e.target.value })
                  }
                >
                  <option value="">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.departmentName}
                      {dept.departmentCode
                        ? ` (${dept.departmentCode})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ar-label">Custodian</label>
                <input
                  className="ar-input"
                  placeholder="Staff responsible for this asset"
                  value={draft.custodian}
                  onChange={(e) =>
                    setDraft({ ...draft, custodian: e.target.value })
                  }
                />
              </div>

              <div
                style={{
                  gridColumn: "1 / -1",
                  borderTop: "1px dashed #E4E9F0",
                  paddingTop: 14,
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "var(--ar-dark)",
                    marginBottom: 10,
                  }}
                >
                  Depreciation setup
                </div>
              </div>

              <div>
                <label className="ar-label">Method</label>
                <select
                  className="ar-input"
                  value={draft.depreciationMethod}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      depreciationMethod: e.target.value,
                    })
                  }
                >
                  <option>Straight-line</option>
                  <option>Reducing Balance</option>
                </select>
              </div>
              {draft.depreciationMethod === "Reducing Balance" ? (
                <div>
                  <label className="ar-label">Rate (%)</label>
                  <input
                    type="number"
                    className="ar-input"
                    placeholder="e.g. 15"
                    value={draft.rate}
                    onChange={(e) =>
                      setDraft({ ...draft, rate: e.target.value })
                    }
                  />
                </div>
              ) : (
                <div>
                  <label className="ar-label">Useful life (years)</label>
                  <input
                    type="number"
                    className="ar-input"
                    placeholder="e.g. 5"
                    value={draft.usefulLife}
                    onChange={(e) =>
                      setDraft({ ...draft, usefulLife: e.target.value })
                    }
                  />
                </div>
              )}

              <div>
                <label className="ar-label">Residual value (₦)</label>
                <input
                  type="number"
                  className="ar-input"
                  value={draft.residualValue}
                  onChange={(e) =>
                    setDraft({ ...draft, residualValue: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="ar-label">Status</label>
                <select
                  className="ar-input"
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value })
                  }
                >
                  <option>Active</option>
                  <option>Idle</option>
                </select>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                  <div className="font-semibold text-slate-800">
                    Carrying amount = Cost − Accumulated depreciation
                  </div>
                  <div className="mt-1">
                    On save: Cost{" "}
                    <span className="font-mono font-semibold text-slate-800">
                      {draft.cost !== "" && draft.cost != null
                        ? naira(Number(draft.cost) || 0)
                        : "—"}
                    </span>
                    {" − "}Accum. dep{" "}
                    <span className="font-mono font-semibold text-slate-800">
                      {naira(0)}
                    </span>
                    {" = "}
                    <span className="font-mono font-semibold text-slate-800">
                      {draft.cost !== "" && draft.cost != null
                        ? naira(Number(draft.cost) || 0)
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label className="ar-label">Notes</label>
                <input
                  className="ar-input"
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft({ ...draft, notes: e.target.value })
                  }
                />
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                className="ar-btn-ghost"
                onClick={() => setTab("register")}
              >
                Cancel
              </button>
              <button
                className="ar-btn-primary"
                onClick={addAsset}
                disabled={saveState === "saving"}
              >
                <Plus size={15} /> Save Asset
              </button>
            </div>
          </div>
        )}

        {loaded && saveState !== "idle" && (
          <div
            style={{
              position: "fixed",
              bottom: 18,
              right: 18,
              background: saveState === "error" ? "#C24444" : "var(--ar-dark)",
              color: "#fff",
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "error"
                ? "Save failed — try again"
                : "Saved"}
          </div>
        )}
      </div>
    </div>
  );
}

function AssetDetail({
  asset,
  departments = [],
  onBack,
  onDispose,
  onToggleMaintenance,
  onWriteOff,
  maintDraft,
  setMaintDraft,
  onAddMaintenance,
}) {
  const { nbv, accDep } = computeNBV(asset);
  const st = STATUS_STYLE[asset.status] || STATUS_STYLE.Active;
  const [proceeds, setProceeds] = useState("");
  const [confirmDispose, setConfirmDispose] = useState(false);
  const gl = CATEGORIES[asset.category] || CATEGORIES["Office Equipment"];
  const departmentName =
    departments.find((d) => String(d.id) === String(asset.department))
      ?.departmentName || null;

  return (
    <div className="bg-white border border-muted rounded-2xl p-5 shadow-sm">
      <button
        className="ar-btn-ghost"
        style={{ marginBottom: 16 }}
        onClick={onBack}
      >
        ← Back to register
      </button>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div className="ar-tag" style={{ marginBottom: 8 }}>
            <Tag size={12} /> {asset.code}
          </div>
          <div
            className="text-xl font-black italic tracking-tight"
            style={{ color: "var(--ar-primary)" }}
          >
            {asset.name}
          </div>
          <div style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>
            {asset.category}
            {asset.location ? ` · ${asset.location}` : " · No location set"}
            {departmentName ? ` · ${departmentName}` : ""}
            {asset.invoiceRef ? ` · Ref ${asset.invoiceRef}` : ""}
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: st.bg,
            color: st.fg,
            padding: "4px 12px",
            borderRadius: 20,
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: st.dot,
            }}
          />
          {asset.status}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
          margin: "20px 0",
        }}
      >
        {[
          ["Cost", naira(asset.cost)],
          ["Accum. depreciation", naira(accDep)],
          ["Carrying amount", naira(nbv)],
          ["Custodian", asset.custodian || "—"],
        ].map(([l, v]) => (
          <div
            key={l}
            style={{
              background: "#F8FAFC",
              border: "1px solid #EDF1F6",
              borderRadius: 8,
              padding: "10px 12px",
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: "#94A3B8",
                textTransform: "uppercase",
              }}
            >
              {l}
            </div>
            <div
              className="ar-font-mono"
              style={{
                fontSize: 15,
                fontWeight: 600,
                marginTop: 3,
                color: "var(--ar-dark)",
              }}
            >
              {v}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{ display: "flex", gap: 22, marginBottom: 20, flexWrap: "wrap" }}
      >
        <div style={{ fontSize: 13, color: "#475569" }}>
          <b>GL cost a/c:</b> <span className="ar-font-mono">{gl.cost}</span>
        </div>
        <div style={{ fontSize: 13, color: "#475569" }}>
          <b>Acc. dep a/c:</b> <span className="ar-font-mono">{gl.accDep}</span>
        </div>
        <div style={{ fontSize: 13, color: "#475569" }}>
          <b>Dep. expense a/c:</b>{" "}
          <span className="ar-font-mono">{gl.depExp}</span>
        </div>
        <div style={{ fontSize: 13, color: "#475569" }}>
          <b>Method:</b> {asset.depreciationMethod}
        </div>
      </div>

      {asset.status !== "Disposed" && asset.status !== "Written Off" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <button
            className="ar-btn-ghost"
            onClick={() => onToggleMaintenance(asset.id)}
          >
            <Wrench size={14} />{" "}
            {asset.status === "Under Maintenance"
              ? "Mark as Active"
              : "Send to Maintenance"}
          </button>
          <button
            className="ar-btn-ghost"
            onClick={() => setConfirmDispose(!confirmDispose)}
          >
            <ArrowRightLeft size={14} /> Dispose asset
          </button>
          <button
            className="ar-btn-ghost"
            style={{
              color: "#C24444",
              borderColor: "#F1D3D3",
              marginLeft: "auto",
            }}
            onClick={() => onWriteOff(asset.id)}
          >
            <Trash2 size={14} /> Write off
          </button>
        </div>
      )}

      {confirmDispose && (
        <div
          style={{
            background: "#F8FAFC",
            border: "1px solid #EDF1F6",
            borderRadius: 8,
            padding: 14,
            marginBottom: 22,
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: 1 }}>
            <label className="ar-label">Sale proceeds (₦)</label>
            <input
              type="number"
              className="ar-input"
              value={proceeds}
              onChange={(e) => setProceeds(e.target.value)}
            />
          </div>
          <button
            className="ar-btn-primary"
            onClick={() => {
              onDispose(asset.id, proceeds);
              setConfirmDispose(false);
            }}
          >
            Confirm disposal
          </button>
        </div>
      )}

      {asset.status === "Disposed" && (
        <div
          style={{
            background: "#F1EEF9",
            borderRadius: 8,
            padding: 14,
            marginBottom: 22,
            fontSize: 13.5,
          }}
        >
          Disposed on {asset.disposalDate} for {naira(asset.proceeds)}
          {asset.gainLoss != null && (
            <>
              {" "}
              — {asset.gainLoss >= 0 ? "gain" : "loss"} of{" "}
              {naira(Math.abs(asset.gainLoss))}
            </>
          )}
        </div>
      )}

      {asset.status === "Written Off" && (
        <div
          style={{
            background: "#FBEAEA",
            borderRadius: 8,
            padding: 14,
            marginBottom: 22,
            fontSize: 13.5,
            color: "#C24444",
          }}
        >
          Written off on {asset.disposalDate || "record"}.
        </div>
      )}

      {/* Maintenance log */}
      <div style={{ borderTop: "1px dashed #E4E9F0", paddingTop: 16 }}>
        <div
          className="text-sm font-black italic tracking-tight uppercase"
          style={{
            color: "var(--ar-primary)",
            marginBottom: 10,
          }}
        >
          Maintenance log
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px 110px 1fr 100px auto",
            gap: 8,
            marginBottom: 14,
            alignItems: "end",
          }}
        >
          <div>
            <label className="ar-label">Date</label>
            <input
              type="date"
              className="ar-input"
              value={maintDraft.date}
              onChange={(e) =>
                setMaintDraft({ ...maintDraft, date: e.target.value })
              }
            />
          </div>
          <div>
            <label className="ar-label">Cost (₦)</label>
            <input
              type="number"
              className="ar-input"
              value={maintDraft.cost}
              onChange={(e) =>
                setMaintDraft({ ...maintDraft, cost: e.target.value })
              }
            />
          </div>
          <div>
            <label className="ar-label">Description</label>
            <input
              className="ar-input"
              placeholder="e.g. Oil change and brake pads"
              value={maintDraft.description}
              onChange={(e) =>
                setMaintDraft({ ...maintDraft, description: e.target.value })
              }
            />
          </div>
          <div>
            <label className="ar-label">Vendor</label>
            <input
              className="ar-input"
              value={maintDraft.vendor}
              onChange={(e) =>
                setMaintDraft({ ...maintDraft, vendor: e.target.value })
              }
            />
          </div>
          <button
            className="ar-btn-primary"
            onClick={() => onAddMaintenance(asset.id)}
          >
            <Plus size={14} />
          </button>
        </div>

        {(asset.maintenance || []).length === 0 ? (
          <div style={{ fontSize: 13, color: "#94A3B8" }}>
            No maintenance entries yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {asset.maintenance.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  borderBottom: "1px solid #F2F5F9",
                  paddingBottom: 8,
                }}
              >
                <div>
                  <b>{m.date}</b> — {m.description}{" "}
                  {m.vendor && (
                    <span style={{ color: "#94A3B8" }}>({m.vendor})</span>
                  )}
                </div>
                <div className="ar-font-mono">{naira(m.cost)}</div>
              </div>
            ))}
            <div style={{ marginTop: 4, fontSize: 12.5, color: "#64748B" }}>
              Total maintenance cost:{" "}
              <span className="ar-font-mono" style={{ fontWeight: 600 }}>
                {naira(
                  asset.maintenance.reduce(
                    (s, m) => s + Number(m.cost || 0),
                    0,
                  ),
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
