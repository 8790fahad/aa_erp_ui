/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import moment from "moment";
import { useNavigate, useLocation } from "react-router-dom";
import { _fetchApi, apiURL } from "@/redux/actions/api";
import { toast } from "sonner";
import useQuery from "@/common/Custom/Hook/useQuery";
import { FileText, Loader2 } from "lucide-react";
import MemoNav from "./MemoNav";
import { formatNumber1 } from "@/components/router/utilities";

/**
 * Simple memo create/edit: subject, note, amount.
 * Submits as pending → Approve tab (one step).
 */
export default function Memo() {
  const { user = {}, activeBusiness = {} } = useSelector((state) => state.auth);
  const query = useQuery();
  const location = useLocation();
  const navigate = useNavigate();
  const memoId = query.get("id");
  const isEditMode = Boolean(memoId) || location.pathname.includes("/edit");

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({
    date: moment().format("YYYY-MM-DD"),
    from_name: "",
    subject: "",
    purpose: "",
    amount: "",
    priority: "Medium",
  });
  const [errors, setErrors] = useState({});

  const handleChange = ({ target: { name, value } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const next = {};
    if (!form.subject.trim()) next.subject = "Subject is required";
    if (!form.purpose.trim()) next.purpose = "Note is required";
    if (!form.amount || Number(form.amount) <= 0)
      next.amount = "Amount must be greater than 0";
    if (!form.from_name.trim()) next.from_name = "Department is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const fetchBranches = useCallback(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/branches/get?facilityId=${activeBusiness.id}&query_type=list`,
      (data) => {
        const names = (data.results || [])
          .map((b) => b.storeName || b.branch_name || b.name)
          .filter(Boolean);
        setBranches(names);
        setForm((prev) =>
          prev.from_name ? prev : { ...prev, from_name: names[0] || "General" }
        );
      },
      () => {
        setBranches(["General"]);
        setForm((prev) =>
          prev.from_name ? prev : { ...prev, from_name: "General" }
        );
      }
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    if (!isEditMode || !memoId || !activeBusiness?.id) return;
    setLoadingData(true);
    _fetchApi(
      `/account/get-memo-by-id/${activeBusiness.id}/returned?memo_id=${memoId}`,
      (response) => {
        setLoadingData(false);
        if (!response.success || !response.memo) {
          toast.error("Failed to load memo");
          navigate(-1);
          return;
        }
        const m = response.memo;
        setForm({
          date: moment(m.date).format("YYYY-MM-DD"),
          from_name: m.from_name || "General",
          subject: m.subject || "",
          purpose: m.purpose || "",
          amount: String(m.total || m.amount || ""),
          priority: m.priority || "Medium",
        });
      },
      () => {
        setLoadingData(false);
        toast.error("Error loading memo");
        navigate(-1);
      }
    );
  }, [isEditMode, memoId, activeBusiness?.id, navigate]);

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);

    const total = Number(form.amount);
    const raiseBy =
      [user.firstname, user.lastname].filter(Boolean).join(" ") ||
      user.username ||
      "User";

    const submitData = {
      date: form.date,
      from_name: form.from_name,
      subject: form.subject.trim(),
      purpose: form.purpose.trim(),
      details: form.purpose.trim(),
      recipient: "Managing Director",
      raise_by: raiseBy,
      priority: form.priority || "Medium",
      query_type: isEditMode ? "update" : "insert",
      prefix: activeBusiness.prefix,
      facilityId: activeBusiness.id,
      user_id: user.id,
      total,
      amount: 0,
      remark: "",
      description: "",
      pr_no: null,
      reference_number: "",
      status: "pending",
      supplier_name: "",
      supplier_code: "",
      supplier_number: "",
      account_code: "",
      expenses: [
        {
          item: form.subject.trim(),
          description: form.purpose.trim() || form.subject.trim(),
          unitCost: total,
          quantity: 1,
          item_code: "",
          chart_code: "",
        },
      ],
      justificationPoints: [],
      existing_document_ids: [],
    };

    if (isEditMode && memoId) submitData.memo_id = memoId;

    const endpoint = isEditMode
      ? "/account/update-memo"
      : "/account/insert-memo";

    const formData = new FormData();
    formData.append("memo_data", JSON.stringify(submitData));

    try {
      const response = await fetch(`${apiURL}${endpoint}`, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const res = await response.json();
      if (res.success) {
        const createdId = res.results?.[0]?.memo_id;
        toast.success(
          isEditMode
            ? "Memo updated"
            : createdId
              ? `Memo ${createdId} created`
              : "Memo submitted"
        );
        navigate("/app/account/administrative-review");
      } else {
        toast.error(res.message || "Error occurred");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error Occurred");
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading memo…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <FileText className="h-5 w-5 text-[var(--aa-accent)]" />
            {isEditMode ? "Edit Memo" : "Record Memo"}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Create a memo, then approve it in one step
          </p>
        </div>

        <MemoNav />

        <div className="space-y-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Date</span>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Department
              </span>
              <select
                name="from_name"
                value={form.from_name}
                onChange={handleChange}
                className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
              >
                {(branches.length ? branches : ["General"]).map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              {errors.from_name && (
                <span className="text-xs text-red-500">{errors.from_name}</span>
              )}
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Subject <span className="text-red-500">*</span>
            </span>
            <input
              name="subject"
              value={form.subject}
              onChange={handleChange}
              placeholder="e.g. Office supplies"
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
            />
            {errors.subject && (
              <span className="text-xs text-red-500">{errors.subject}</span>
            )}
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Note <span className="text-red-500">*</span>
            </span>
            <textarea
              name="purpose"
              value={form.purpose}
              onChange={handleChange}
              rows={3}
              placeholder="Brief reason for this memo"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
            />
            {errors.purpose && (
              <span className="text-xs text-red-500">{errors.purpose}</span>
            )}
          </label>

          <label className="block text-sm sm:max-w-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Amount (₦) <span className="text-red-500">*</span>
            </span>
            <input
              type="number"
              name="amount"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={handleChange}
              placeholder="0.00"
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
            />
            {errors.amount && (
              <span className="text-xs text-red-500">{errors.amount}</span>
            )}
            {form.amount > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Total: ₦{formatNumber1(Number(form.amount))}
              </p>
            )}
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="h-10 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--aa-accent)] px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditMode ? "Update" : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
