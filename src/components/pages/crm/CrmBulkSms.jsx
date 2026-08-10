import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { Send } from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchCustomerInput from "@/components/pages/customer/components/SearchCustomerInput";
import { useCrmFacilityId } from "./CrmLayout";

export default function CrmBulkSms() {
  const facilityId = useCrmFacilityId();
  const user = useSelector((s) => s.auth?.user);
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [manualPhone, setManualPhone] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/api/v1/crm/sms/templates?facilityId=${facilityId}`,
      (res) => setTemplates((res?.results || []).filter((t) => t.is_active)),
      () => {},
    );
    _fetchApi(
      `/api/v1/crm/sms/logs?facilityId=${facilityId}&limit=40`,
      (res) => setLogs(res?.results || []),
      () => {},
    );
  }, [facilityId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!templateId) return;
    const t = templates.find((x) => String(x.id) === String(templateId));
    if (t) setMessage(t.body || "");
  }, [templateId, templates]);

  const addCustomer = (c) => {
    if (!c) return;
    const no = c.customerNo || c.customer_no;
    const phone = c.mobile || c.phone;
    if (!no) return;
    setRecipients((prev) => {
      if (prev.some((r) => r.customer_no === no)) return prev;
      return [
        ...prev,
        {
          customer_no: no,
          customer_name: c.fullname || c.customer_name || no,
          phone: phone || "",
        },
      ];
    });
  };

  const addManual = () => {
    const phone = manualPhone.trim();
    if (!phone) return;
    setRecipients((prev) => [...prev, { phone, customer_name: phone }]);
    setManualPhone("");
  };

  const send = (dryRun) => {
    if (!message.trim() || !recipients.length) {
      toast.error("Message and at least one recipient required");
      return;
    }
    setSending(true);
    _postApi(
      `/api/v1/crm/sms/send`,
      {
        facilityId,
        message,
        template_id: templateId || null,
        recipients,
        dry_run: dryRun,
        sent_by: user?.id,
      },
      (res) => {
        setSending(false);
        if (dryRun) {
          toast.success(`Dry-run OK for ${res?.count || 0} recipients`);
          return;
        }
        toast.success(`Sent ${res?.sent || 0}, failed ${res?.failed || 0}`);
        setRecipients([]);
        load();
      },
      (err) => {
        setSending(false);
        toast.error(err?.error || "Send failed");
      },
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1a2d5e]">Bulk SMS</h2>
          <p className="text-sm text-slate-500">
            Send via existing BulkSMS. Use {"{{customer_name}}"} / {"{{customer_no}}"}.
          </p>
        </div>

        <div className="rounded-xl border border-[#1a2d5e]/10 bg-white p-4 shadow-sm space-y-3">
          <select
            className="h-10 w-full rounded-md border px-3 text-sm"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">Custom message</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <textarea
            className="min-h-[140px] w-full rounded-md border p-3 text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hello {{customer_name}}, thank you for being a valued customer…"
          />

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Recipients</p>
            <SearchCustomerInput onChange={addCustomer} />
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Or add phone manually"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
              />
              <Button variant="outline" onClick={addManual}>
                Add
              </Button>
            </div>
            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">
              {recipients.map((r, i) => (
                <li
                  key={`${r.customer_no || r.phone}-${i}`}
                  className="flex items-center justify-between rounded border px-2 py-1"
                >
                  <span>
                    {r.customer_name || r.customer_no}{" "}
                    <span className="text-slate-400">{r.phone || "no phone"}</span>
                  </span>
                  <button
                    type="button"
                    className="text-xs text-rose-600"
                    onClick={() =>
                      setRecipients((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
              {!recipients.length ? (
                <li className="text-slate-400">No recipients yet.</li>
              ) : null}
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={sending}
              onClick={() => send(true)}
            >
              Dry run
            </Button>
            <Button
              className="bg-[#1a2d5e] hover:bg-[#15254d]"
              disabled={sending}
              onClick={() => send(false)}
            >
              <Send className="mr-1.5 h-4 w-4" />
              {sending ? "Sending…" : "Send SMS"}
            </Button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <h3 className="mb-3 font-semibold text-[#1a2d5e]">Recent sends</h3>
        <div className="rounded-xl border border-[#1a2d5e]/10 bg-white shadow-sm">
          <ul className="max-h-[520px] divide-y overflow-y-auto text-sm">
            {logs.map((l) => (
              <li key={l.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{l.phone}</span>
                  <span
                    className={
                      l.status === "sent"
                        ? "text-emerald-600"
                        : l.status === "failed"
                          ? "text-rose-600"
                          : "text-slate-500"
                    }
                  >
                    {l.status}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs text-slate-500">{l.message}</p>
              </li>
            ))}
            {!logs.length ? (
              <li className="px-3 py-6 text-center text-slate-400">No SMS logs yet.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
