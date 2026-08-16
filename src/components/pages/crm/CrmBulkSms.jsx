import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { Mail, MessageSquare, Paperclip, Send, X } from "lucide-react";
import { apiURL, _fetchApi, _postApi } from "@/redux/actions/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchCustomerInput from "@/components/pages/customer/components/SearchCustomerInput";
import { useCrmFacilityId } from "./CrmLayout";
import { cn } from "@/lib/utils";

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export default function CrmBulkSms() {
  const facilityId = useCrmFacilityId();
  const user = useSelector((s) => s.auth?.user);
  const fileInputRef = useRef(null);
  const [channel, setChannel] = useState("sms");
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [manualContact, setManualContact] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);

  const isEmail = channel === "email";

  const load = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/api/v1/crm/sms/templates?facilityId=${facilityId}&channel=${channel}`,
      (res) => setTemplates((res?.results || []).filter((t) => t.is_active)),
      () => {},
    );
    const logsPath = isEmail
      ? `/api/v1/crm/email/logs?facilityId=${facilityId}&limit=40`
      : `/api/v1/crm/sms/logs?facilityId=${facilityId}&limit=40`;
    _fetchApi(
      logsPath,
      (res) => setLogs(res?.results || []),
      () => {},
    );
  }, [facilityId, channel, isEmail]);

  useEffect(() => {
    setTemplateId("");
    setSubject("");
    setMessage("");
    setRecipients([]);
    setManualContact("");
    setAttachments([]);
    load();
  }, [load]);

  useEffect(() => {
    if (!templateId) return;
    const t = templates.find((x) => String(x.id) === String(templateId));
    if (t) {
      setMessage(t.body || "");
      if (isEmail) setSubject(t.subject || "");
    }
  }, [templateId, templates, isEmail]);

  const addCustomer = (c) => {
    if (!c) return;
    const no = c.customerNo || c.customer_no;
    if (!no) return;
    const phone = c.mobile || c.phone || "";
    const email = c.email || "";
    setRecipients((prev) => {
      if (prev.some((r) => r.customer_no === no)) return prev;
      return [
        ...prev,
        {
          customer_no: no,
          customer_name: c.fullname || c.customer_name || no,
          phone,
          email,
        },
      ];
    });
  };

  const addManual = () => {
    const value = manualContact.trim();
    if (!value) return;
    if (isEmail) {
      if (!value.includes("@")) {
        toast.error("Enter a valid email address");
        return;
      }
      setRecipients((prev) => [
        ...prev,
        { email: value, customer_name: value },
      ]);
    } else {
      setRecipients((prev) => [
        ...prev,
        { phone: value, customer_name: value },
      ]);
    }
    setManualContact("");
  };

  const onPickFiles = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setAttachments((prev) => {
      const next = [...prev];
      for (const file of files) {
        if (next.length >= MAX_ATTACHMENTS) {
          toast.error(`Max ${MAX_ATTACHMENTS} attachments`);
          break;
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          toast.error(`${file.name} is larger than 10MB`);
          continue;
        }
        if (next.some((f) => f.name === file.name && f.size === file.size)) {
          continue;
        }
        next.push(file);
      }
      return next;
    });
  };

  const sendEmail = async (dryRun) => {
    const token = localStorage.getItem("@@__token");
    const form = new FormData();
    form.append("facilityId", facilityId || "");
    form.append("message", message);
    form.append("subject", subject);
    if (templateId) form.append("template_id", templateId);
    form.append("recipients", JSON.stringify(recipients));
    form.append("dry_run", dryRun ? "true" : "false");
    if (user?.id) form.append("sent_by", user.id);
    for (const file of attachments) {
      form.append("attachments", file, file.name);
    }

    const res = await fetch(`${apiURL}/api/v1/crm/email/send`, {
      method: "POST",
      headers: { authorization: token },
      body: form,
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      data = {};
    }
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error || data?.message || "Send failed");
    }
    return data;
  };

  const send = async (dryRun) => {
    if (!message.trim() || !recipients.length) {
      toast.error("Message and at least one recipient required");
      return;
    }
    if (isEmail && !subject.trim()) {
      toast.error("Email subject is required");
      return;
    }
    setSending(true);
    try {
      if (isEmail) {
        const res = await sendEmail(dryRun);
        if (dryRun) {
          const att =
            res?.attachments?.length > 0
              ? ` · ${res.attachments.length} attachment(s)`
              : "";
          toast.success(`Dry-run OK for ${res?.count || 0} recipients${att}`);
        } else {
          toast.success(`Sent ${res?.sent || 0}, failed ${res?.failed || 0}`);
          setRecipients([]);
          setAttachments([]);
          load();
        }
      } else {
        await new Promise((resolve, reject) => {
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
              if (dryRun) {
                toast.success(`Dry-run OK for ${res?.count || 0} recipients`);
              } else {
                toast.success(
                  `Sent ${res?.sent || 0}, failed ${res?.failed || 0}`,
                );
                setRecipients([]);
                load();
              }
              resolve(res);
            },
            (err) => reject(new Error(err?.error || "Send failed")),
          );
        });
      }
    } catch (err) {
      toast.error(err?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#1a2d5e]">Outreach</h2>
            <p className="text-sm text-slate-500">
              {isEmail
                ? "Email via Mailtrap. Attach files if needed. Use {{customer_name}} / {{customer_no}}."
                : "SMS via BulkSMS Nigeria. Use {{customer_name}} / {{customer_no}}."}
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-[#1a2d5e]/15 bg-white p-0.5">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
                !isEmail
                  ? "bg-[#1a2d5e] text-white"
                  : "text-slate-600 hover:bg-slate-50",
              )}
              onClick={() => setChannel("sms")}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              SMS
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
                isEmail
                  ? "bg-[#1a2d5e] text-white"
                  : "text-slate-600 hover:bg-slate-50",
              )}
              onClick={() => setChannel("email")}
            >
              <Mail className="h-3.5 w-3.5" />
              Email
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-[#1a2d5e]/10 bg-white p-4 shadow-sm">
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

          {isEmail ? (
            <Input
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          ) : null}

          <textarea
            className="min-h-[140px] w-full rounded-md border p-3 text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hello {{customer_name}}, thank you for being a valued customer…"
          />

          {isEmail ? (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">
                  Attachments
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={attachments.length >= MAX_ATTACHMENTS}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                  Add files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={onPickFiles}
                />
              </div>
              <p className="mb-2 text-xs text-slate-400">
                Up to {MAX_ATTACHMENTS} files, 10MB each — sent via Mailtrap.
              </p>
              {attachments.length ? (
                <ul className="space-y-1 text-sm">
                  {attachments.map((file, i) => (
                    <li
                      key={`${file.name}-${i}`}
                      className="flex items-center justify-between rounded border px-2 py-1"
                    >
                      <span className="truncate">
                        {file.name}{" "}
                        <span className="text-slate-400">
                          ({Math.max(1, Math.round(file.size / 1024))} KB)
                        </span>
                      </span>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-rose-600"
                        onClick={() =>
                          setAttachments((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No attachments.</p>
              )}
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Recipients</p>
            <SearchCustomerInput onChange={addCustomer} />
            <div className="mt-2 flex gap-2">
              <Input
                placeholder={
                  isEmail ? "Or add email manually" : "Or add phone manually"
                }
                value={manualContact}
                onChange={(e) => setManualContact(e.target.value)}
              />
              <Button variant="outline" onClick={addManual}>
                Add
              </Button>
            </div>
            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">
              {recipients.map((r, i) => (
                <li
                  key={`${r.customer_no || r.email || r.phone}-${i}`}
                  className="flex items-center justify-between rounded border px-2 py-1"
                >
                  <span>
                    {r.customer_name || r.customer_no}{" "}
                    <span className="text-slate-400">
                      {isEmail
                        ? r.email || "no email"
                        : r.phone || "no phone"}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="text-xs text-rose-600"
                    onClick={() =>
                      setRecipients((prev) =>
                        prev.filter((_, idx) => idx !== i),
                      )
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
              {sending
                ? "Sending…"
                : isEmail
                  ? "Send Email"
                  : "Send SMS"}
            </Button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <h3 className="mb-3 font-semibold text-[#1a2d5e]">
          Recent {isEmail ? "emails" : "SMS"}
        </h3>
        <div className="rounded-xl border border-[#1a2d5e]/10 bg-white shadow-sm">
          <ul className="max-h-[520px] divide-y overflow-y-auto text-sm">
            {logs.map((l) => (
              <li key={l.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">
                    {isEmail ? l.email : l.phone}
                  </span>
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
                {isEmail && l.subject ? (
                  <p className="text-xs font-medium text-slate-600">
                    {l.subject}
                  </p>
                ) : null}
                <p className="line-clamp-2 text-xs text-slate-500">
                  {l.message}
                </p>
              </li>
            ))}
            {!logs.length ? (
              <li className="px-3 py-6 text-center text-slate-400">
                No {isEmail ? "email" : "SMS"} logs yet.
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
