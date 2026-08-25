import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import moment from "moment";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { cn } from "@/lib/utils";

const POLL_MS = 45000;

function relativeTime(iso) {
  if (!iso) return "";
  return moment(iso).fromNow();
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const userId = user?.id || user?.userId;

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const refreshCount = useCallback(() => {
    if (!facilityId || !userId) return;
    _fetchApi(
      `/api/v1/notifications/unread-count?facilityId=${encodeURIComponent(
        facilityId,
      )}&userId=${encodeURIComponent(userId)}`,
      (res) => {
        if (res?.success) setUnread(Number(res.count) || 0);
      },
      () => {},
    );
  }, [facilityId, userId]);

  const refreshList = useCallback(() => {
    if (!facilityId || !userId) return;
    setLoading(true);
    _fetchApi(
      `/api/v1/notifications?facilityId=${encodeURIComponent(
        facilityId,
      )}&userId=${encodeURIComponent(userId)}&limit=30`,
      (res) => {
        setLoading(false);
        if (res?.success) {
          setItems(Array.isArray(res.results) ? res.results : []);
        }
      },
      () => setLoading(false),
    );
  }, [facilityId, userId]);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  useEffect(() => {
    if (open) {
      refreshList();
      refreshCount();
    }
  }, [open, refreshList, refreshCount]);

  const markOne = (id) => {
    if (!facilityId || !userId || !id) return;
    _postApi(
      `/api/v1/notifications/${id}/read`,
      { facilityId, userId },
      () => {
        setItems((prev) =>
          prev.map((n) =>
            Number(n.id) === Number(id)
              ? { ...n, read_at: n.read_at || new Date().toISOString() }
              : n,
          ),
        );
        setUnread((c) => Math.max(0, c - 1));
      },
      () => {},
    );
  };

  const markAll = () => {
    if (!facilityId || !userId) return;
    _postApi(
      "/api/v1/notifications/read-all",
      { facilityId, userId },
      () => {
        setItems((prev) =>
          prev.map((n) => ({
            ...n,
            read_at: n.read_at || new Date().toISOString(),
          })),
        );
        setUnread(0);
      },
      () => {},
    );
  };

  const onItemClick = (n) => {
    if (!n.read_at) markOne(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  if (!facilityId || !userId) {
    return (
      <button
        type="button"
        className="inline-flex size-8 items-center justify-center rounded-md text-white/90 hover:bg-white/10"
        aria-label="Notifications"
        disabled
      >
        <Bell className="size-4" />
      </button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex size-8 items-center justify-center rounded-md text-white/90 hover:bg-white/10"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">
            Notifications
          </DropdownMenuLabel>
          {unread > 0 ? (
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-800"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                markAll();
              }}
            >
              Mark all as read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-80 overflow-y-auto">
          {loading && items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              Loading…
            </p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              No notifications
            </p>
          ) : (
            items.map((n) => {
              const isUnread = !n.read_at;
              return (
                <DropdownMenuItem
                  key={n.id}
                  className={cn(
                    "cursor-pointer flex-col items-start gap-0.5 rounded-none px-3 py-2.5 focus:bg-slate-50",
                    isUnread && "bg-slate-50/80",
                  )}
                  onSelect={(e) => {
                    e.preventDefault();
                    onItemClick(n);
                  }}
                >
                  <div className="flex w-full items-start gap-2">
                    {isUnread ? (
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-600" />
                    ) : (
                      <span className="mt-1.5 size-1.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm",
                          isUnread
                            ? "font-semibold text-slate-900"
                            : "font-medium text-slate-700",
                        )}
                      >
                        {n.title}
                      </p>
                      {n.body ? (
                        <p className="line-clamp-2 text-xs text-slate-500">
                          {n.body}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {relativeTime(n.created_at)}
                      </p>
                    </div>
                  </div>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
