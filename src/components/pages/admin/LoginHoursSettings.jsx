/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Clock, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { LOGIN_HOURS_REFRESH_EVENT, normalizeTimeInput } from "@/lib/loginHours";

const TIMEZONES = [
  { value: "Africa/Lagos", label: "Africa/Lagos (WAT)" },
  { value: "Africa/Accra", label: "Africa/Accra (GMT)" },
  { value: "UTC", label: "UTC" },
];

function userAllowsAfterHours(user) {
  const value = user?.allow_after_hours_login;
  if (value === false || value === 0 || value === "0" || value === "false") {
    return false;
  }
  return true;
}

function displayName(user) {
  const name = [user.firstname, user.lastname].filter(Boolean).join(" ").trim();
  return name || user.email || user.id || "User";
}

export default function LoginHoursSettings() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const facilityId = activeBusiness?.id;

  const [enabled, setEnabled] = useState(false);
  const [openingTime, setOpeningTime] = useState("08:00");
  const [closingTime, setClosingTime] = useState("17:00");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [staff, setStaff] = useState([]);
  const [checkedIds, setCheckedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadStaff = useCallback(() => {
    if (!facilityId) return;
    setLoadingStaff(true);
    _fetchApi(
      `/api/v1/get-users-by-facility/${facilityId}`,
      (resp) => {
        setLoadingStaff(false);
        const rows = Array.isArray(resp?.results) ? resp.results : [];
        const unique = [];
        const seen = new Set();
        rows.forEach((row) => {
          const id = String(row?.id || "").trim();
          if (!id || seen.has(id)) return;
          seen.add(id);
          unique.push(row);
        });
        unique.sort((a, b) =>
          displayName(a).localeCompare(displayName(b), undefined, {
            sensitivity: "base",
          }),
        );
        setStaff(unique);
        setCheckedIds(
          unique.filter((row) => userAllowsAfterHours(row)).map((row) => String(row.id)),
        );
      },
      () => {
        setLoadingStaff(false);
        toast.error("Failed to load staff list");
      },
    );
  }, [facilityId]);

  useEffect(() => {
    setEnabled(Boolean(activeBusiness?.login_hours_enabled));
    setOpeningTime(normalizeTimeInput(activeBusiness?.login_opening_time, "08:00"));
    setClosingTime(normalizeTimeInput(activeBusiness?.login_closing_time, "17:00"));
    setTimezone(activeBusiness?.login_hours_timezone || "Africa/Lagos");
    setDirty(false);
  }, [
    facilityId,
    activeBusiness?.login_hours_enabled,
    activeBusiness?.login_opening_time,
    activeBusiness?.login_closing_time,
    activeBusiness?.login_hours_timezone,
  ]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const filteredStaff = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return staff;
    return staff.filter((row) => {
      const hay = [displayName(row), row.email, row.phone, row.role, row.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [staff, search]);

  const allChecked =
    staff.length > 0 && staff.every((row) => checkedIds.includes(String(row.id)));

  const selectAll = () => {
    setCheckedIds(staff.map((row) => String(row.id)));
    setDirty(true);
  };

  const clearAll = () => {
    setCheckedIds([]);
    setDirty(true);
  };

  const toggleUser = (id) => {
    const key = String(id);
    setCheckedIds((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
    setDirty(true);
  };

  const save = () => {
    if (!facilityId || !user?.id) {
      toast.error("No active business");
      return;
    }
    const opening = normalizeTimeInput(openingTime, "08:00");
    const closing = normalizeTimeInput(closingTime, "17:00");
    if (!/^\d{2}:\d{2}$/.test(opening) || !/^\d{2}:\d{2}$/.test(closing)) {
      toast.error("Opening and closing time must be HH:mm");
      return;
    }

    setSaving(true);
    _postApi(
      `/account/update-login-hours/${facilityId}/${user.id}`,
      {
        login_hours_enabled: Boolean(enabled),
        login_opening_time: opening,
        login_closing_time: closing,
        login_hours_timezone: timezone || "Africa/Lagos",
        after_hours_user_ids: checkedIds,
      },
      (resp) => {
        setSaving(false);
        if (resp?.success) {
          const business = resp.results || {
            ...activeBusiness,
            login_hours_enabled: Boolean(enabled),
            login_opening_time: opening,
            login_closing_time: closing,
            login_hours_timezone: timezone || "Africa/Lagos",
          };
          dispatch({
            type: "UPDATE_BUSINESS_SETTINGS",
            payload: { business },
          });
          window.dispatchEvent(new Event(LOGIN_HOURS_REFRESH_EVENT));
          setDirty(false);
          toast.success(
            enabled
              ? `Login hours saved (${opening}–${closing}). ${checkedIds.length} user(s) can sign in after closing.`
              : "Login hours saved. Restriction is off until you enable it.",
          );
        } else {
          toast.error(resp?.message || "Failed to save login hours");
        }
      },
      (err) => {
        setSaving(false);
        toast.error(err?.message || "Failed to save login hours");
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-[var(--aa-navy,#1a2d5e)]/10 p-2.5 text-[var(--aa-navy,#1a2d5e)]">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Opening and closing hours
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Set when staff may sign in. At closing time, unchecked users stay
            in the app with an expired session and must enter their password.
            If you extend the hours, they can continue from there. Checked
            users can keep working after close. Everyone is checked by default.
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">
            Restrict login and end sessions outside business hours
          </p>
          <p className="text-xs text-slate-500">
            Applies to {activeBusiness?.business_name || "this business"}
          </p>
        </div>
        <input
          type="checkbox"
          className="h-5 w-5 rounded border-slate-300 accent-[var(--aa-navy,#1a2d5e)]"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            setDirty(true);
          }}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="login-opening-time"
            className="text-xs font-medium text-slate-600"
          >
            Opening time
          </label>
              <input
                id="login-opening-time"
                type="time"
                value={openingTime}
                onChange={(e) => {
                  setOpeningTime(normalizeTimeInput(e.target.value, "08:00"));
                  setDirty(true);
                }}
            className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent,#2c7be5)] focus:ring-1 focus:ring-[var(--aa-accent,#2c7be5)]"
          />
        </div>
        <div>
          <label
            htmlFor="login-closing-time"
            className="text-xs font-medium text-slate-600"
          >
            Closing time
          </label>
              <input
                id="login-closing-time"
                type="time"
                value={closingTime}
                onChange={(e) => {
                  setClosingTime(normalizeTimeInput(e.target.value, "17:00"));
                  setDirty(true);
                }}
            className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent,#2c7be5)] focus:ring-1 focus:ring-[var(--aa-accent,#2c7be5)]"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="login-hours-timezone"
          className="text-xs font-medium text-slate-600"
        >
          Timezone
        </label>
        <select
          id="login-hours-timezone"
          value={timezone}
          onChange={(e) => {
            setTimezone(e.target.value);
            setDirty(true);
          }}
          className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent,#2c7be5)] focus:ring-1 focus:ring-[var(--aa-accent,#2c7be5)]"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-slate-900">
          After-hours login
        </p>
        <p className="mb-2 text-xs text-slate-500">
          Check a user to let them keep working after closing. Unchecked users
          get a password lock at closing time — they can continue if you extend
          the hours.
        </p>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs">
            <button
              type="button"
              onClick={selectAll}
              className="font-medium text-[var(--aa-accent)] hover:underline"
            >
              {allChecked ? "All selected" : "Select all"}
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="font-medium text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
          <div className="border-b border-slate-100 px-3 py-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users by name, email, or role…"
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[var(--aa-accent,#2c7be5)]"
            />
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto p-3">
            {loadingStaff ? (
              <p className="text-xs text-slate-500">Loading users…</p>
            ) : filteredStaff.length === 0 ? (
              <p className="text-xs text-slate-500">No users found.</p>
            ) : (
              filteredStaff.map((row) => {
                const id = String(row.id);
                const checked = checkedIds.includes(id);
                return (
                  <label
                    key={id}
                    className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-gray-300 text-[var(--aa-accent)] focus:ring-[var(--aa-accent)]"
                      checked={checked}
                      onChange={() => toggleUser(id)}
                    />
                    <span>
                      <span className="block font-medium">{displayName(row)}</span>
                      <span className="block text-xs text-slate-500">
                        {[row.role, row.email].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          {checkedIds.length} of {staff.length} user
          {staff.length === 1 ? "" : "s"} can log in after closing.
        </p>
      </div>

      <div className="flex justify-end pt-1">
        <Button
          type="button"
          disabled={!dirty || saving}
          onClick={save}
          className="bg-[var(--aa-navy,#1a2d5e)] text-white hover:opacity-90"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
