import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useSearchParams } from "react-router-dom";
import { Tabs } from "@/components/ui/tabs";
import { _postApi, _fetchApi, _deleteApi, _putApi } from "@/redux/actions/api";
import { toast } from "sonner";
import moment from "moment";
import {
  SETTINGS_TABS,
  SETTINGS_HASH_TO_TAB,
  SETTINGS_CATEGORIES,
} from "@/components/pages/admin/settingsTabs";
import SettingsTabPanels from "./SettingsTabPanels";
import SettingsModals from "./SettingsModals";
import SettingsNav, { SettingsContentHeader } from "./SettingsNav";

export default function Settings() {
  const dispatch = useDispatch();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, activeBusiness } = useSelector((state) => state.auth);

  const functionalities = useMemo(() => {
    const parse = (raw) => {
      if (Array.isArray(raw)) return raw;
      if (typeof raw === "string") {
        return raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return [];
    };
    return [
      ...new Set([
        ...parse(activeBusiness?.functionalities),
        ...parse(user?.functionalities),
      ]),
    ];
  }, [activeBusiness?.functionalities, user?.functionalities]);

  const canViewTab = useCallback(
    (tab) => {
      const keys = [tab.privilege, ...(tab.altPrivileges || [])];
      return keys.some((k) => functionalities.includes(k));
    },
    [functionalities],
  );

  const visibleTabs = useMemo(
    () =>
      SETTINGS_TABS.filter((tab) => {
        if (!canViewTab(tab)) return false;
        if (
          tab.requiresProcessCosting &&
          activeBusiness?.costing_method !== "process_costing"
        ) {
          return false;
        }
        if (
          tab.requiresJobProductCosting &&
          !(
            activeBusiness?.costing_method === "job_product_costing" ||
            !activeBusiness?.costing_method
          )
        ) {
          return false;
        }
        if (tab.requiresManufacturing) {
          const types = String(activeBusiness?.business_type || "")
            .toLowerCase()
            .split(",")
            .map((t) => t.trim());
          const isManufacturing = types.some((t) =>
            ["manufacturing", "manufacturer", "manufacturers"].includes(t),
          );
          if (!isManufacturing) return false;
        }
        return true;
      }),
    [canViewTab, activeBusiness?.costing_method, activeBusiness?.business_type],
  );

  const activeTab = searchParams.get("tab") || visibleTabs[0]?.value || "";
  const handleTabChange = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== visibleTabs[0]?.value) next.set("tab", value);
    else next.delete("tab");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!visibleTabs.some((t) => t.value === activeTab)) {
      handleTabChange(visibleTabs[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    const hash = location.hash?.replace(/^#/, "");
    if (!hash) return;
    const mapped = SETTINGS_HASH_TO_TAB[hash];
    if (mapped && visibleTabs.some((t) => t.value === mapped)) {
      handleTabChange(mapped);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash, visibleTabs]);

  const [chartOfAccount, setChartOfAccount] = useState([]);
  const [showSealModal, setShowSealModal] = useState(false);
  const [showStampModal, setShowStampModal] = useState(false);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [lightboxPreview, setLightboxPreview] = useState({
    open: false,
    src: null,
    title: "",
  });
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [marketplaceLinkLoading, setMarketplaceLinkLoading] = useState(false);
  const [showTinyLinkModal, setShowTinyLinkModal] = useState(false);
  const [showSocialMediaModal, setShowSocialMediaModal] = useState(false);
  const [showLinkUserModal, setShowLinkUserModal] = useState(false);
  const [linkUserInput, setLinkUserInput] = useState("");
  const [linkUserChecking, setLinkUserChecking] = useState(false);
  const [linkUserAvailable, setLinkUserAvailable] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [imprestRows, setImprestRows] = useState([]);
  const [imprestLoading, setImprestLoading] = useState(false);
  const [deletingImprestId, setDeletingImprestId] = useState(null);
  const [updatingImprestId, setUpdatingImprestId] = useState(null);
  const [dateDrafts, setDateDrafts] = useState({});
  const [imprestDateFrom, setImprestDateFrom] = useState("");
  const [imprestDateTo, setImprestDateTo] = useState("");
  const [navSearch, setNavSearch] = useState("");

  const getChartOfAccount = useCallback(() => {
    if (!activeBusiness?.business_name) return;

    _postApi(
      `/account/chart-of-account?query_type=select`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          setChartOfAccount(resp.results || []);
        }
      },
      (err) => {
        console.error("API Error:", err);
      }
    );
  }, [activeBusiness.business_name]);

  useEffect(() => {
    getChartOfAccount();
  }, [getChartOfAccount]);

  const openImagePreview = (src, title) => {
    if (!src) return;
    setLightboxPreview({ open: true, src, title });
  };

  const closeImagePreview = () => {
    setLightboxPreview({ open: false, src: null, title: "" });
  };

  const updateDefaultReceiptType = (receiptType) => {
    if (!activeBusiness?.id || receiptLoading) return;
    const normalized = receiptType === "terminal" ? "terminal" : "pdf";
    if ((activeBusiness.default_receipt_type || "pdf") === normalized) return;

    setReceiptLoading(true);
    _postApi(
      `/account/update-default-receipt-type/${normalized}/${activeBusiness.id}/${activeBusiness.business_admin}`,
      {},
      (resp) => {
        setReceiptLoading(false);
        if (resp?.success && resp.results) {
          toast.success(
            `Default receipt set to ${normalized === "terminal" ? "thermal (80mm)" : "PDF"}`
          );
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: { business: resp.results },
          });
        } else {
          toast.error(resp?.message || "Failed to update receipt type");
        }
      },
      (err) => {
        console.error("Error updating receipt type:", err);
        setReceiptLoading(false);
        toast.error("Network error. Could not update receipt type");
      }
    );
  };

  const toggleOnlineOrdering = () => {
    if (!activeBusiness?.id) return;

    const current = !!activeBusiness.enable_online_ordering;
    const next = !current;

    setOnlineLoading(true);
    _postApi(
      `/account/update-online-ordering/${next}/${activeBusiness.id}/${activeBusiness.business_admin}`,
      {},
      (resp) => {
        setOnlineLoading(false);
        if (resp && resp.success && resp.results) {
          toast.success(
            `Online ordering ${next ? "enabled" : "disabled"} successfully`
          );
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: { business: resp.results },
          });
        } else {
          toast.error(resp.message || "Failed to update online ordering");
        }
      },
      (err) => {
        console.error("Error updating online ordering:", err);
        setOnlineLoading(false);
        toast.error("Network error. Could not update online ordering");
      }
    );
  };

  const MARKETPLACE_BASE_URL =
    import.meta.env.VITE_MARKETPLACE_PUBLIC_URL || "http://localhost:5173";

  const getMarketplaceStorefrontLink = () =>
    activeBusiness?.link_user
      ? `${MARKETPLACE_BASE_URL}/i/${activeBusiness.link_user}`
      : "";

  const getMarketplaceTinyLink = () => activeBusiness?.marketplace_tiny_link || "";

  const sanitizeLinkUserInput = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 30);

  const checkLinkUserAvailability = (username) => {
    const normalized = sanitizeLinkUserInput(username);
    if (normalized.length < 3) {
      setLinkUserAvailable(null);
      return;
    }

    setLinkUserChecking(true);
    _fetchApi(
      `/account/check-marketplace-link-user?link_user=${encodeURIComponent(normalized)}&facilityId=${encodeURIComponent(activeBusiness.id)}`,
      (resp) => {
        setLinkUserChecking(false);
        setLinkUserAvailable(resp?.available === true);
      },
      () => {
        setLinkUserChecking(false);
        setLinkUserAvailable(null);
      }
    );
  };

  const openLinkUserModal = () => {
    if (!activeBusiness?.id) return;
    if (!activeBusiness.enable_online_ordering) {
      toast.error("Enable Online Store before generating a marketplace link");
      return;
    }
    setLinkUserInput(activeBusiness.link_user || "");
    setLinkUserAvailable(null);
    setShowLinkUserModal(true);
    if (activeBusiness.link_user) {
      checkLinkUserAvailability(activeBusiness.link_user);
    }
  };

  const saveStorefrontHandle = () => {
    if (!activeBusiness?.id || marketplaceLinkLoading) return;

    const linkUser = sanitizeLinkUserInput(linkUserInput);
    if (linkUser.length < 3) {
      toast.error("Storefront handle must be at least 3 characters");
      return;
    }

    if (linkUserAvailable === false) {
      toast.error("This storefront handle is already taken");
      return;
    }

    setMarketplaceLinkLoading(true);
    _postApi(
      `/account/generate-marketplace-link/${activeBusiness.id}/${activeBusiness.business_admin}`,
      { link_user: linkUser },
      (resp) => {
        setMarketplaceLinkLoading(false);
        if (resp?.success) {
          toast.success("Storefront handle saved");
          setShowLinkUserModal(false);
          if (resp.results) {
            dispatch({
              type: "UPDATE_BUSINESS_SETTINGS",
              payload: { business: resp.results },
            });
          }
        } else {
          toast.error(resp?.message || "Failed to save storefront handle");
        }
      },
      (err) => {
        console.error("Error saving storefront handle:", err);
        setMarketplaceLinkLoading(false);
        toast.error("Network error. Could not save storefront handle");
      }
    );
  };

  const fetchImprestHistory = useCallback(() => {
    if (!activeBusiness?.id) return;
    setImprestLoading(true);
    _fetchApi(
      `/account/impress?facilityId=${encodeURIComponent(activeBusiness.id)}&limit=20&offset=0`,
      (res) => {
        setImprestLoading(false);
        if (res?.success && Array.isArray(res.results)) {
          const rows = res.results;
          setImprestRows(rows);
          const nextDrafts = {};
          rows.forEach((row) => {
            if (row?.id) {
              nextDrafts[row.id] = row?.transaction_date
                ? moment(row.transaction_date).format("YYYY-MM-DD")
                : "";
            }
          });
          setDateDrafts(nextDrafts);
        } else {
          setImprestRows([]);
          setDateDrafts({});
        }
      },
      () => {
        setImprestLoading(false);
        setImprestRows([]);
        setDateDrafts({});
      }
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    fetchImprestHistory();
  }, [fetchImprestHistory]);

  const handleCopyImprestRef = (row) => {
    const ref = row?.reference_display || row?.ref_number || "";
    if (!ref) return;
    navigator.clipboard
      ?.writeText(String(ref))
      .then(() => toast.success("Reference copied"))
      .catch(() => toast.error("Could not copy reference"));
  };

  const handleDeleteImprest = (row) => {
    const rowId = row?.id;
    if (!rowId || !activeBusiness?.id) return;
    const ok = window.confirm(
      `Delete imprest record ${row?.reference_display || row?.ref_number || ""}?`
    );
    if (!ok) return;
    setDeletingImprestId(rowId);
    _deleteApi(
      `/account/impress/${encodeURIComponent(String(rowId))}`,
      { facilityId: activeBusiness.id },
      (res) => {
        setDeletingImprestId(null);
        if (res?.success) {
          toast.success("Imprest record deleted");
          fetchImprestHistory();
        } else {
          toast.error(res?.message || "Could not delete record");
        }
      },
      (err) => {
        setDeletingImprestId(null);
        toast.error(err?.message || "Could not delete record");
      }
    );
  };

  const handleDateDraftChange = (id, value) => {
    setDateDrafts((prev) => ({ ...prev, [id]: value }));
  };

  const handleUpdateImprestDate = (row) => {
    const rowId = row?.id;
    const nextDate = rowId ? dateDrafts[rowId] : "";
    if (!rowId || !activeBusiness?.id || !nextDate) {
      toast.error("Select a valid date first");
      return;
    }
    setUpdatingImprestId(rowId);
    _putApi(
      `/account/impress/${encodeURIComponent(String(rowId))}/date`,
      {
        facilityId: activeBusiness.id,
        transaction_date: nextDate,
      },
      (res) => {
        setUpdatingImprestId(null);
        if (res?.success) {
          toast.success("Imprest date updated");
          fetchImprestHistory();
        } else {
          toast.error(res?.message || "Could not update date");
        }
      },
      (err) => {
        setUpdatingImprestId(null);
        toast.error(err?.message || "Could not update date");
      }
    );
  };

  const filteredImprestRows = imprestRows.filter((row) => {
    const txDate = row?.transaction_date
      ? moment(row.transaction_date).format("YYYY-MM-DD")
      : "";
    if (!txDate) return !imprestDateFrom && !imprestDateTo;
    if (imprestDateFrom && txDate < imprestDateFrom) return false;
    if (imprestDateTo && txDate > imprestDateTo) return false;
    return true;
  });

  const activeTabMeta = visibleTabs.find((t) => t.value === activeTab);
  const activeTabLabel = activeTabMeta?.label || "Settings";
  const activeCategoryLabel =
    SETTINGS_CATEGORIES.find((c) => c.id === activeTabMeta?.category)?.label ||
    "";

  return (
    <div className="p-4 pt-0 max-w-[1600px]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold text-slate-800 mb-1">
            Account Settings
          </h2>
          <p className="text-slate-500 text-sm max-w-xl">
            Configure accounts, inventory, pricing, banking, and other business
            preferences.
          </p>
        </div>
        {activeBusiness?.business_name && (
          <div className="hidden md:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-slate-700">
              {activeBusiness.business_name}
            </span>
          </div>
        )}
      </div>

      {visibleTabs.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-center text-amber-800">
          You do not have permission to access any settings sections on this
          account.
        </div>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,280px)_1fr] gap-4 lg:gap-6 items-start">
            <SettingsNav
              visibleTabs={visibleTabs}
              activeTab={activeTab}
              onSelect={handleTabChange}
              search={navSearch}
              onSearchChange={setNavSearch}
            />
            <div className="min-w-0">
              <SettingsContentHeader
                activeLabel={activeTabLabel}
                categoryLabel={activeCategoryLabel}
                categoryId={activeTabMeta?.category}
              />
              <SettingsTabPanels
                tabVisible={(value) => visibleTabs.some((t) => t.value === value)}
                activeBusiness={activeBusiness}
                chartOfAccount={chartOfAccount}
                onlineLoading={onlineLoading}
                toggleOnlineOrdering={toggleOnlineOrdering}
                receiptLoading={receiptLoading}
                updateDefaultReceiptType={updateDefaultReceiptType}
                getMarketplaceTinyLink={getMarketplaceTinyLink}
                getMarketplaceStorefrontLink={getMarketplaceStorefrontLink}
                openLinkUserModal={openLinkUserModal}
                setShowTinyLinkModal={setShowTinyLinkModal}
                setShowSocialMediaModal={setShowSocialMediaModal}
                setShowLogoModal={setShowLogoModal}
                setShowSealModal={setShowSealModal}
                setShowStampModal={setShowStampModal}
                openImagePreview={openImagePreview}
                dispatch={dispatch}
                imprestRows={imprestRows}
                imprestLoading={imprestLoading}
                filteredImprestRows={filteredImprestRows}
                imprestDateFrom={imprestDateFrom}
                imprestDateTo={imprestDateTo}
                setImprestDateFrom={setImprestDateFrom}
                setImprestDateTo={setImprestDateTo}
                dateDrafts={dateDrafts}
                handleDateDraftChange={handleDateDraftChange}
                handleUpdateImprestDate={handleUpdateImprestDate}
                handleCopyImprestRef={handleCopyImprestRef}
                handleDeleteImprest={handleDeleteImprest}
                updatingImprestId={updatingImprestId}
                deletingImprestId={deletingImprestId}
              />
            </div>
          </div>
        </Tabs>
      )}

      <SettingsModals
        showLogoModal={showLogoModal}
        setShowLogoModal={setShowLogoModal}
        showLinkUserModal={showLinkUserModal}
        setShowLinkUserModal={setShowLinkUserModal}
        showTinyLinkModal={showTinyLinkModal}
        setShowTinyLinkModal={setShowTinyLinkModal}
        showSocialMediaModal={showSocialMediaModal}
        setShowSocialMediaModal={setShowSocialMediaModal}
        showSealModal={showSealModal}
        setShowSealModal={setShowSealModal}
        showStampModal={showStampModal}
        setShowStampModal={setShowStampModal}
        lightboxPreview={lightboxPreview}
        closeImagePreview={closeImagePreview}
        activeBusiness={activeBusiness}
        linkUserInput={linkUserInput}
        setLinkUserInput={setLinkUserInput}
        linkUserChecking={linkUserChecking}
        linkUserAvailable={linkUserAvailable}
        setLinkUserAvailable={setLinkUserAvailable}
        checkLinkUserAvailability={checkLinkUserAvailability}
        sanitizeLinkUserInput={sanitizeLinkUserInput}
        marketplaceLinkLoading={marketplaceLinkLoading}
        saveStorefrontHandle={saveStorefrontHandle}
        getMarketplaceStorefrontLink={getMarketplaceStorefrontLink}
        MARKETPLACE_BASE_URL={MARKETPLACE_BASE_URL}
      />
    </div>
  );
}
