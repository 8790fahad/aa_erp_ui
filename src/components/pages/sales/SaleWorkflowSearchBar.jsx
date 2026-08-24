import { useCallback, useRef, useState } from "react";
import { ScanLine, Search } from "lucide-react";
import { toast } from "sonner";
import useScanDetection from "@/hooks/useScanDetection";
import { _fetchApi } from "@/redux/actions/api";

/**
 * Search + barcode-scan lookup for sale / pack codes (and customer name filter) in sales process UIs.
 */
export default function SaleWorkflowSearchBar({
  facilityId,
  rows = [],
  getRowCode = (r) => r.sale_code,
  onSelect,
  onQueryChange,
  placeholder = "Search or scan sale / customer…",
  className = "",
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  const setQueryValue = useCallback(
    (value) => {
      setQuery(value);
      onQueryChange?.(value);
    },
    [onQueryChange],
  );

  const resolveAndSelect = useCallback(
    (raw, { fromScan = false } = {}) => {
      const code = String(raw || "").trim();
      if (!code) return;

      const needle = code.toLowerCase();
      const list = rows || [];

      const exactCodeMatch = list.find(
        (r) =>
          String(getRowCode(r) || "").toLowerCase() === needle ||
          String(r.sale_code || "").toLowerCase() === needle ||
          String(r.pack_code || "").toLowerCase() === needle,
      );
      if (exactCodeMatch) {
        onSelect?.(exactCodeMatch, code);
        setQueryValue(code);
        toast.success(`Found ${exactCodeMatch.sale_code || code}`);
        return;
      }

      const customerMatches = list.filter((r) => {
        const name = String(r.customer_name || "").toLowerCase();
        const no = String(r.customer_no || "").toLowerCase();
        return name.includes(needle) || no.includes(needle);
      });
      if (customerMatches.length === 1) {
        const match = customerMatches[0];
        onSelect?.(match, match.sale_code || code);
        setQueryValue(code);
        toast.success(`Found ${match.sale_code || code}`);
        return;
      }
      if (customerMatches.length > 1) {
        setQueryValue(code);
        if (fromScan) {
          toast.message(`${customerMatches.length} matches`, {
            description: "Refine by invoice code or customer name",
          });
        }
        return;
      }

      // Typed customer filter with no exact hit — keep query for list filtering.
      if (!fromScan && code.length >= 2) {
        setQueryValue(code);
        return;
      }

      if (!facilityId) {
        toast.error(`No match for ${code}`);
        return;
      }

      _fetchApi(
        `/api/v1/sale-workflows/one?facilityId=${encodeURIComponent(
          facilityId,
        )}&saleCode=${encodeURIComponent(code)}`,
        (res) => {
          if (res?.success && (res.results || res.result)) {
            const found = res.results || res.result;
            onSelect?.(found, code);
            setQueryValue(code);
            toast.success(`Opened ${code}`);
          } else {
            toast.error(res?.message || `No sale found for ${code}`);
          }
        },
        () => toast.error(`No sale found for ${code}`),
      );
    },
    [facilityId, getRowCode, onSelect, rows, setQueryValue],
  );

  const handleBarcodeScan = useCallback(
    (code) => {
      const tag = String(document.activeElement?.tagName || "").toLowerCase();
      if (tag === "textarea") return;
      resolveAndSelect(code, { fromScan: true });
    },
    [resolveAndSelect],
  );

  useScanDetection({
    onComplete: handleBarcodeScan,
    minLength: 3,
  });

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQueryValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            resolveAndSelect(query);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-10 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
        autoComplete="off"
      />
      <button
        type="button"
        title="Scan barcode / focus for USB scanner"
        aria-label="Scan barcode"
        onClick={() => {
          inputRef.current?.focus();
          toast.message("Ready to scan", {
            description: "Scan a sale barcode with your scanner",
          });
        }}
        className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-blue-600 hover:bg-slate-100"
      >
        <ScanLine className="h-4 w-4" />
      </button>
    </div>
  );
}
