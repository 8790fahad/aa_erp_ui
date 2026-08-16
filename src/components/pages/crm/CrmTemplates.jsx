import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { Plus, Trash2 } from "lucide-react";
import { _fetchApi, _postApi, _putApi, _deleteApi } from "@/redux/actions/api";
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

export default function CrmTemplates() {
  const facilityId = useCrmFacilityId();
  const user = useSelector((s) => s.auth?.user);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    channel: "sms",
    subject: "",
    body: "",
    is_active: true,
  });

  const load = useCallback(() => {
    if (!facilityId) return;
    setLoading(true);
    _fetchApi(
      `/api/v1/crm/sms/templates?facilityId=${facilityId}`,
      (res) => {
        setRows(res?.results || []);
        setLoading(false);
      },
      (err) => {
        toast.error(err?.error || "Failed to load templates");
        setLoading(false);
      },
    );
  }, [facilityId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      channel: "sms",
      subject: "",
      body: "",
      is_active: true,
    });
    setOpen(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setForm({
      name: t.name,
      channel: t.channel === "email" ? "email" : "sms",
      subject: t.subject || "",
      body: t.body,
      is_active: !!t.is_active,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim() || !form.body.trim()) {
      toast.error("Name and body required");
      return;
    }
    if (form.channel === "email" && !form.subject.trim()) {
      toast.error("Subject required for email templates");
      return;
    }
    if (editing) {
      _putApi(
        `/api/v1/crm/sms/templates/${editing.id}?facilityId=${facilityId}`,
        { facilityId, ...form },
        () => {
          toast.success("Updated");
          setOpen(false);
          load();
        },
        (err) => toast.error(err?.error || "Failed"),
      );
      return;
    }
    _postApi(
      `/api/v1/crm/sms/templates`,
      { facilityId, ...form, created_by: user?.id },
      () => {
        toast.success("Created");
        setOpen(false);
        load();
      },
      (err) => toast.error(err?.error || "Failed"),
    );
  };

  const remove = (id) => {
    _deleteApi(
      `/api/v1/crm/sms/templates/${id}?facilityId=${facilityId}`,
      {},
      () => {
        toast.success("Deleted");
        load();
      },
      (err) => toast.error(err?.error || "Failed"),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1a2d5e]">
            Outreach templates
          </h2>
          <p className="text-sm text-slate-500">
            SMS and email templates with {"{{customer_name}}"} variables.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-[#1a2d5e] hover:bg-[#15254d]"
          onClick={openCreate}
        >
          <Plus className="mr-1 h-4 w-4" />
          New template
        </Button>
      </div>

      <div className="space-y-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))
          : rows.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-[#1a2d5e]/10 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1a2d5e]">{t.name}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        {t.channel === "email" ? "Email" : "SMS"}
                      </span>
                    </div>
                    {t.channel === "email" && t.subject ? (
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {t.subject}
                      </p>
                    ) : null}
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                      {t.body}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {t.is_active ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                      Edit
                    </Button>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-rose-600"
                      onClick={() => remove(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
        {!loading && !rows.length ? (
          <p className="text-sm text-slate-500">No templates yet.</p>
        ) : null}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? "Edit template" : "New template"}</SheetTitle>
            <SheetDescription>
              Variables: {"{{customer_name}}"}, {"{{customer_no}}"}.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            <Input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={form.channel}
              onChange={(e) =>
                setForm((f) => ({ ...f, channel: e.target.value }))
              }
            >
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
            {form.channel === "email" ? (
              <Input
                placeholder="Subject"
                value={form.subject}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subject: e.target.value }))
                }
              />
            ) : null}
            <textarea
              className="min-h-[140px] w-full rounded-md border p-3 text-sm"
              placeholder="Message body"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_active: e.target.checked }))
                }
              />
              Active
            </label>
            <Button className="w-full bg-[#1a2d5e]" onClick={save}>
              Save
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
