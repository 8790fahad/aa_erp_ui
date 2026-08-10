import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { Plus, Trash2 } from "lucide-react";
import { _fetchApi, _postApi, _deleteApi } from "@/redux/actions/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useCrmFacilityId } from "./CrmLayout";

export default function CrmSegments() {
  const facilityId = useCrmFacilityId();
  const user = useSelector((s) => s.auth?.user);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", crm_status: "" });

  const load = useCallback(() => {
    if (!facilityId) return;
    setLoading(true);
    _fetchApi(
      `/api/v1/crm/segments?facilityId=${facilityId}`,
      (res) => {
        setRows(res?.results || []);
        setLoading(false);
      },
      (err) => {
        toast.error(err?.error || "Failed to load segments");
        setLoading(false);
      },
    );
  }, [facilityId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = () => {
    if (!form.name.trim()) {
      toast.error("Name required");
      return;
    }
    _postApi(
      `/api/v1/crm/segments`,
      {
        facilityId,
        name: form.name,
        description: form.description,
        filters: form.crm_status ? { crm_status: form.crm_status } : null,
        created_by: user?.id,
      },
      () => {
        toast.success("Segment created");
        setOpen(false);
        setForm({ name: "", description: "", crm_status: "" });
        load();
      },
      (err) => toast.error(err?.error || "Failed"),
    );
  };

  const remove = (id) => {
    _deleteApi(
      `/api/v1/crm/segments/${id}?facilityId=${facilityId}`,
      {},
      () => {
        toast.success("Deleted");
        load();
      },
      (err) => toast.error(err?.error || "Cannot delete"),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1a2d5e]">Segments</h2>
          <p className="text-sm text-slate-500">
            Built-in and custom customer groups for outreach.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-[#1a2d5e] hover:bg-[#15254d]"
          onClick={() => setOpen(true)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Custom segment
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))
          : rows.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-[#1a2d5e]/10 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-[#1a2d5e]">{s.name}</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      {s.segment_key}
                      {s.is_builtin ? " · built-in" : ""}
                    </p>
                  </div>
                  {!s.is_builtin ? (
                    <button
                      type="button"
                      className="text-slate-400 hover:text-rose-600"
                      onClick={() => remove(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {s.description || "No description"}
                </p>
                <Link
                  to={`/app/crm/customers?segment=${encodeURIComponent(s.segment_key)}`}
                  className="mt-3 inline-block text-sm text-[#4267B2] hover:underline"
                >
                  View customers
                </Link>
              </div>
            ))}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Custom segment</SheetTitle>
            <SheetDescription>
              Create a named segment. Assign customers from the Customers page.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            <Input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <textarea
              className="min-h-[90px] w-full rounded-md border p-3 text-sm"
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
            <Button className="w-full bg-[#1a2d5e]" onClick={save}>
              Create
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
