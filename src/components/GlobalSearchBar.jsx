import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  Building2,
  FileText,
  Loader2,
  Package,
  Search,
  Users,
  X,
} from "lucide-react";
import { _fetchApi } from "@/redux/actions/api";
import { getSidebarByAppType } from "@/components/sidebars/sidebarModules";
import { canAccessPrivileges, getUserFunctionalities, privilegeKeysForItem } from "@/lib/access";

const DEBOUNCE_MS = 280;
const MIN_QUERY = 1;

function buildPageShortcuts(appType, functionalities) {
  const modules = getSidebarByAppType(appType || "retailers") || [];
  const pages = [];
  for (const mod of modules) {
    const leafItems =
      mod.items?.length > 0
        ? mod.items
        : mod.url && mod.url !== "#"
          ? [mod]
          : [];
    for (const item of leafItems) {
      if (!item?.url || item.url === "#") continue;
      if (!canAccessPrivileges(privilegeKeysForItem(item), functionalities)) {
        continue;
      }
      pages.push({
        type: "page",
        id: item.url,
        title: item.title,
        subtitle: mod.title === item.title ? "Workspace" : mod.title,
        href: item.url,
      });
    }
  }
  return pages;
}

const GROUP_META = {
  pages: { label: "Pages", icon: Search },
  invoices: { label: "Invoices", icon: FileText },
  customers: { label: "Customers", icon: Users },
  suppliers: { label: "Suppliers", icon: Building2 },
  products: { label: "Products", icon: Package },
};

/**
 * Top-bar system search: pages + invoices / customers / suppliers / products.
 */
export default function GlobalSearchBar() {
  const navigate = useNavigate();
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiResults, setApiResults] = useState({
    invoices: [],
    customers: [],
    suppliers: [],
    products: [],
  });

  const functionalities = useMemo(
    () => getUserFunctionalities(user, activeBusiness),
    [user, activeBusiness],
  );

  const pageShortcuts = useMemo(
    () =>
      buildPageShortcuts(activeBusiness?.business_type, functionalities),
    [activeBusiness?.business_type, functionalities],
  );

  const pageMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < MIN_QUERY) return [];
    return pageShortcuts
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          String(p.subtitle || "")
            .toLowerCase()
            .includes(q),
      )
      .slice(0, 8);
  }, [pageShortcuts, query]);

  const runSearch = useCallback(
    (raw) => {
      const q = String(raw || "").trim();
      if (!facilityId || q.length < MIN_QUERY) {
        setApiResults({
          invoices: [],
          customers: [],
          suppliers: [],
          products: [],
        });
        setLoading(false);
        return;
      }
      setLoading(true);
      const params = new URLSearchParams({
        facilityId,
        q,
      });
      _fetchApi(
        `/api/v1/global-search?${params.toString()}`,
        (res) => {
          setLoading(false);
          if (res?.success && res.results) {
            setApiResults({
              invoices: res.results.invoices || [],
              customers: res.results.customers || [],
              suppliers: res.results.suppliers || [],
              products: res.results.products || [],
            });
          } else {
            setApiResults({
              invoices: [],
              customers: [],
              suppliers: [],
              products: [],
            });
          }
        },
        () => {
          setLoading(false);
          setApiResults({
            invoices: [],
            customers: [],
            suppliers: [],
            products: [],
          });
        },
      );
    },
    [facilityId],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < MIN_QUERY) {
      setApiResults({
        invoices: [],
        customers: [],
        suppliers: [],
        products: [],
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => runSearch(q), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = useMemo(() => {
    const list = [
      { key: "pages", items: pageMatches },
      { key: "invoices", items: apiResults.invoices },
      { key: "customers", items: apiResults.customers },
      { key: "suppliers", items: apiResults.suppliers },
      { key: "products", items: apiResults.products },
    ];
    return list.filter((g) => g.items.length > 0);
  }, [pageMatches, apiResults]);

  const totalHits = groups.reduce((n, g) => n + g.items.length, 0);
  const showPanel = open && query.trim().length >= MIN_QUERY;

  const goTo = (href) => {
    if (!href) return;
    setOpen(false);
    setQuery("");
    navigate(href);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (groups[0]?.items?.[0]?.href) {
      goTo(groups[0].items[0].href);
      return;
    }
    const q = query.trim();
    if (!q) return;
    // Fallback: invoices list search
    goTo(`/app/sales/invoices?search=${encodeURIComponent(q)}`);
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <form onSubmit={onSubmit} className="relative flex w-full items-center">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-white/55" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search invoices, customers, pages… (⌘K)"
          className="h-9 w-full rounded-full border-0 bg-[#13244d] pl-9 pr-9 text-sm text-white placeholder:text-white/50 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[var(--aa-accent)]"
          autoComplete="off"
          aria-label="System search"
          aria-expanded={showPanel}
          aria-controls="global-search-results"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setApiResults({
                invoices: [],
                customers: [],
                suppliers: [],
                products: [],
              });
              inputRef.current?.focus();
            }}
            className="absolute right-2 inline-flex size-6 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </form>

      {showPanel ? (
        <div
          id="global-search-results"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[min(70vh,420px)] overflow-y-auto rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl"
        >
          {loading && totalHits === 0 ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" />
              Searching…
            </div>
          ) : null}

          {!loading && totalHits === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              No results for &ldquo;{query.trim()}&rdquo;
            </div>
          ) : null}

          {groups.map((group) => {
            const meta = GROUP_META[group.key] || {
              label: group.key,
              icon: Search,
            };
            const Icon = meta.icon;
            return (
              <div key={group.key} className="border-b border-slate-100 last:border-0">
                <div className="sticky top-0 flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <Icon className="size-3.5" />
                  {meta.label}
                </div>
                <ul className="py-1">
                  {group.items.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <button
                        type="button"
                        onClick={() => goTo(item.href)}
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-[var(--aa-sidebar-active,#eff6ff)]"
                      >
                        <span className="text-sm font-medium text-slate-900">
                          {item.title}
                        </span>
                        {item.subtitle ? (
                          <span className="text-xs text-slate-500">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {loading && totalHits > 0 ? (
            <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-400">
              <Loader2 className="size-3 animate-spin" />
              Updating…
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
