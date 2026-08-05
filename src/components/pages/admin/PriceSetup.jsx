/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import CustomCard from "@/common/Custom/CustomCard2";
import { CardBody, Input, Button } from "reactstrap";
import { Search, Save, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { _fetchApi, _postApi, _putApi } from "@/redux/actions/api";
import { UPDATE_BUSINESS_SETTINGS } from "@/redux/actions/actionTypes";
import {
  formatNumberWithCommas,
  parseNumberFromFormatted,
  filterJournalAmountInput,
} from "@/utilities";
const ITEM_TYPES = ["Finished Good", "By-Product", "Resalable"];

/**
 * @param {{ embedded?: boolean }} props — When true, render as a settings card (no back link / full-page chrome).
 */
export default function PriceSetup({ embedded = false }) {
  const dispatch = useDispatch();
  const { activeBusiness = {} } = useSelector((state) => state.auth);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [priceSetupPurchaseLoading, setPriceSetupPurchaseLoading] =
    useState(false);

  const load = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    const q = new URLSearchParams({
      itemTypes: ITEM_TYPES.join(","),
      status: "Active",
      limit: "5000",
      sortBy: "name",
      sortOrder: "ASC",
    });
    _fetchApi(
      `/api/products/list/${activeBusiness.id}?${q.toString()}`,
      (resp) => {
        setLoading(false);
        if (resp.success && Array.isArray(resp.data)) {
          setRows(resp.data);
          setDrafts({});
        } else {
          toast.error(resp.message || "Failed to load products");
          setRows([]);
        }
      },
      () => {
        setLoading(false);
        toast.error("Could not load products");
        setRows([]);
      }
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(t) ||
        (p.sku || "").toLowerCase().includes(t) ||
        (p.category || "").toLowerCase().includes(t)
    );
  }, [rows, search]);

  const setDraft = (id, field, value) => {
    const withoutCommas = String(value || "").replace(/,/g, "");
    const sanitizedValue = filterJournalAmountInput(withoutCommas);
    const parts = sanitizedValue.split(".");
    const numericValue =
      parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : sanitizedValue;
    const formattedValue = formatNumberWithCommas(numericValue);

    setDrafts((d) => ({
      ...d,
      [id]: { ...d[id], [field]: formattedValue },
    }));
  };

  const displayPrice = (p, field) => {
    const d = drafts[p.id];
    if (d && d[field] !== undefined && d[field] !== "") return d[field];
    const v = p[field];
    if (v === null || v === undefined || v === "") return "";
    return formatNumberWithCommas(String(v));
  };

  const saveRow = (p) => {
    const draft = drafts[p.id];
    const selling =
      draft?.selling_price !== undefined
        ? draft.selling_price
        : p.selling_price;
    const sellNum = parseFloat(parseNumberFromFormatted(String(selling)));
    if (selling === "" || Number.isNaN(sellNum) || sellNum < 0) {
      toast.error("Enter a valid selling price");
      return;
    }

    const costSrc =
      draft?.cost_price !== undefined ? draft.cost_price : p.cost_price;
    const costNum = parseFloat(parseNumberFromFormatted(String(costSrc)));
    if (costSrc === "" || Number.isNaN(costNum) || costNum < 0) {
      toast.error("Enter a valid cost");
      return;
    }

    setSavingId(p.id);
    _putApi(
      `/api/products/${activeBusiness.id}/${p.id}`,
      { selling_price: sellNum, cost_price: costNum },
      (resp) => {
        setSavingId(null);
        if (resp.success) {
          toast.success("Cost and price updated");
          setRows((prev) =>
            prev.map((r) =>
              r.id === p.id
                ? { ...r, selling_price: sellNum, cost_price: costNum }
                : r
            )
          );
          setDrafts((d) => {
            const next = { ...d };
            delete next[p.id];
            return next;
          });
        } else {
          toast.error(resp.message || "Update failed");
        }
      },
      () => {
        setSavingId(null);
        toast.error("Network error");
      }
    );
  };

  const togglePriceSetupOnSupplierBill = () => {
    if (!activeBusiness?.id || !activeBusiness?.business_admin) return;
    const next = !activeBusiness.price_setup_resalable_on_purchase;
    setPriceSetupPurchaseLoading(true);
    _postApi(
      `/account/update-price-setup-resalable-purchase/${next}/${activeBusiness.id}/${activeBusiness.business_admin}`,
      {},
      (resp) => {
        setPriceSetupPurchaseLoading(false);
        if (resp?.success && resp.results) {
          toast.success(
            next
              ? "Supplier bills will sync selling price to sales (for sales) for Finished Good, Resalable, and By-Product lines."
              : "Selling price setup on supplier bill turned off."
          );
          dispatch({
            type: UPDATE_BUSINESS_SETTINGS,
            payload: { business: resp.results },
          });
        } else {
          toast.error(resp?.message || "Could not update setting");
        }
      },
      () => {
        setPriceSetupPurchaseLoading(false);
        toast.error("Network error");
      }
    );
  };

  const body = (
    <>
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3 p-3 rounded border bg-light">
          <div className="flex-grow-1" style={{ minWidth: 220 }}>
            <div className="fw-semibold text-dark mb-1">
              Selling price setup (supplier bill → sales)
            </div>
            <p className="text-muted small mb-0">
              When on, <strong>Product Supplier Bill</strong> postings create{" "}
              <code className="small">for sales</code> store rows for{" "}
              <strong>Finished Good</strong>, <strong>Resalable</strong>, and{" "}
              <strong>By-Product</strong> lines (using each product&apos;s selling
              price). Configure once here instead of on each bill.
            </p>
          </div>
          <div className="form-check form-switch m-0 d-flex align-items-center gap-2">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="priceSetupResalableOnPurchase"
              checked={!!activeBusiness.price_setup_resalable_on_purchase}
              onChange={togglePriceSetupOnSupplierBill}
              disabled={priceSetupPurchaseLoading}
            />
            <label
              className="form-check-label small fw-semibold text-nowrap"
              htmlFor="priceSetupResalableOnPurchase"
            >
              {priceSetupPurchaseLoading ? "Saving…" : "Enable"}
            </label>
          </div>
        </div>

        <p className="text-muted small mb-3">
          Edit <strong>cost</strong> and <strong>selling price</strong> for{" "}
          <strong>Finished Good</strong>, <strong>By-Product</strong>, and{" "}
          <strong>Resalable</strong> products.
        </p>

        <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
          <div className="position-relative flex-grow-1" style={{ maxWidth: 360 }}>
            <Search
              size={16}
              className="position-absolute text-muted"
              style={{ left: 10, top: "50%", transform: "translateY(-50%)" }}
            />
            <Input
              type="search"
              placeholder="Search by name, SKU, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-4"
            />
          </div>
          <span className="text-muted small">
            {filtered.length} product{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="d-flex align-items-center gap-2 text-muted py-5 justify-content-center">
            <Loader2 className="animate-spin" size={22} />
            Loading products…
          </div>
        ) : (
          <div className="table-responsive border rounded">
            <table className="table table-hover table-sm align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Type</th>
                  <th className="text-end">Cost</th>
                  <th className="text-end" style={{ minWidth: 140 }}>
                    Selling price
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      <Package className="mb-2 opacity-50" size={28} />
                      <div>No matching products.</div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id}>
                      <td className="fw-medium">{p.name}</td>
                      <td className="font-monospace small">{p.sku}</td>
                      <td>
                        <span
                          className={`badge ${
                            p.item_type === "Finished Good"
                              ? "bg-primary"
                              : p.item_type === "By-Product"
                              ? "bg-warning text-dark"
                              : "bg-info"
                          }`}
                        >
                          {p.item_type}
                        </span>
                      </td>
                      <td className="text-end">
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="text-end"
                          style={{ maxWidth: 140, marginLeft: "auto" }}
                          value={displayPrice(p, "cost_price")}
                          onChange={(e) =>
                            setDraft(p.id, "cost_price", e.target.value)
                          }
                        />
                      </td>
                      <td className="text-end">
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="text-end"
                          style={{ maxWidth: 140, marginLeft: "auto" }}
                          value={displayPrice(p, "selling_price")}
                          onChange={(e) =>
                            setDraft(p.id, "selling_price", e.target.value)
                          }
                        />
                      </td>
                      <td className="text-end">
                        <Button
                          color="primary"
                          size="sm"
                          outline
                          disabled={savingId === p.id}
                          onClick={() => saveRow(p)}
                          className="d-inline-flex align-items-center gap-1"
                        >
                          {savingId === p.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Save size={14} />
                          )}
                          Save
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
    </>
  );

  if (embedded) {
    return (
      <div id="price-setup" className="card shadow-sm border-0">
        <div className="card-header bg-white border-0 pb-0">
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: "1.5rem" }}>💲</span>
            <div>
              <h5 className="mb-0 fw-bold">Price Set-up</h5>
              <small className="text-muted">
                Finished Good, By-Product &amp; Resalable — edit cost and selling
                price per product
              </small>
            </div>
          </div>
        </div>
        <div className="card-body pt-2">{body}</div>
      </div>
    );
  }

  return (
    <CustomCard back header="Price Set-up">
      <CardBody>{body}</CardBody>
    </CustomCard>
  );
}
