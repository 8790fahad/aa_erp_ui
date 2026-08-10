import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { _fetchApi, _putApi, _postApi } from "@/redux/actions/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCrmFacilityId } from "./CrmLayout";

const FIELDS = [
  {
    key: "active_days",
    label: "Active within (days)",
    hint: "Purchased within this window → Active",
  },
  {
    key: "regular_days",
    label: "Regular within (days)",
    hint: "Purchased within this window → Regular (or VIP if sales threshold met)",
  },
  {
    key: "dormant_days",
    label: "Dormant after (days)",
    hint: "No purchase for this many days → Dormant",
  },
  {
    key: "inactive_days",
    label: "Inactive after (days)",
    hint: "No purchase for this many days → Inactive",
  },
  {
    key: "lost_days",
    label: "Lost after (days)",
    hint: "No purchase for this many days → Lost",
  },
  {
    key: "vip_min_sales",
    label: "VIP minimum sales (₦)",
    hint: "Lifetime sales at or above this amount can qualify as VIP",
  },
];

export default function CrmSettings() {
  const facilityId = useCrmFacilityId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  const load = useCallback(() => {
    if (!facilityId) return;
    setLoading(true);
    _fetchApi(
      `/api/v1/crm/settings?facilityId=${facilityId}`,
      (res) => {
        setForm(res?.results || {});
        setLoading(false);
      },
      (err) => {
        toast.error(err?.error || "Failed to load settings");
        setLoading(false);
      },
    );
  }, [facilityId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = () => {
    setSaving(true);
    const payload = { facilityId };
    for (const f of FIELDS) {
      payload[f.key] = Number(form[f.key]);
    }
    _putApi(
      `/api/v1/crm/settings?facilityId=${facilityId}`,
      payload,
      (res) => {
        setForm(res?.results || form);
        setSaving(false);
        toast.success("Settings saved");
      },
      (err) => {
        setSaving(false);
        toast.error(err?.error || "Save failed");
      },
    );
  };

  const classify = () => {
    _postApi(
      `/api/v1/crm/classify`,
      { facilityId },
      (res) => {
        toast.success(
          `Classified ${res?.results?.total || 0} · updated ${res?.results?.updated || 0}`,
        );
      },
      (err) => toast.error(err?.error || "Classification failed"),
    );
  };

  if (loading) {
    return <Skeleton className="h-64 w-full max-w-xl rounded-xl" />;
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[#1a2d5e]">CRM settings</h2>
        <p className="text-sm text-slate-500">
          Thresholds used by nightly classification (and manual runs).
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-[#1a2d5e]/10 bg-white p-4 shadow-sm">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-sm font-medium text-slate-700">{f.label}</label>
            <Input
              className="mt-1"
              type="number"
              value={form[f.key] ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
            />
            <p className="mt-1 text-xs text-slate-400">{f.hint}</p>
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <Button
            className="bg-[#1a2d5e] hover:bg-[#15254d]"
            disabled={saving}
            onClick={save}
          >
            {saving ? "Saving…" : "Save settings"}
          </Button>
          <Button variant="outline" onClick={classify}>
            Run classification now
          </Button>
        </div>
      </div>
    </div>
  );
}
