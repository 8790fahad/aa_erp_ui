import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  Circle,
  FileText,
  PlayCircle,
  Users,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SETUP_STEPS = [
  {
    id: "org",
    title: "Add organisation details",
    description:
      "Confirm your business profile, address, and tax information so documents look correct.",
    cta: "Open settings",
    href: "/app/admin/settings",
    secondary: [
      { label: "Add address", href: "/app/admin/settings" },
      { label: "Invite user", href: "/app/admin/settings#team-setup" },
    ],
    icon: Building2,
  },
  {
    id: "customers",
    title: "Add your first customer",
    description:
      "Create a customer record so you can invoice and track receivables.",
    cta: "Add customer",
    href: "/app/customers",
    secondary: [],
    icon: Users,
  },
  {
    id: "invoice",
    title: "Create your first invoice",
    description:
      "Raise a credit or cash sale invoice and get familiar with the sales workflow.",
    cta: "Create invoice",
    href: "/app/sales/sale?view=lines",
    secondary: [{ label: "View invoices", href: "/app/sales/invoices" }],
    icon: FileText,
  },
  {
    id: "coa",
    title: "Review chart of accounts",
    description:
      "Check that your ledger accounts are set up before posting more transactions.",
    cta: "Open chart of accounts",
    href: "/app/account/chart-of-account",
    secondary: [],
    icon: BookOpen,
  },
];

export default function Home() {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [tab, setTab] = useState("getting-started");
  const [activeStepId, setActiveStepId] = useState(SETUP_STEPS[0].id);
  const [completed] = useState(() => new Set());

  const displayName =
    (user?.firstname && user?.lastname
      ? `${user.firstname} ${user.lastname}`
      : null) ||
    user?.name ||
    user?.email ||
    "User";
  const businessName =
    activeBusiness?.business_name ||
    activeBusiness?.businessName ||
    user?.busName ||
    "";

  const activeStep =
    SETUP_STEPS.find((s) => s.id === activeStepId) || SETUP_STEPS[0];
  const progress = Math.round((completed.size / SETUP_STEPS.length) * 100);

  const tabs = useMemo(
    () => [
      { id: "dashboard", label: "Dashboard" },
      { id: "getting-started", label: "Getting Started" },
      { id: "recent", label: "Recent Updates" },
    ],
    [],
  );

  return (
    <div className="min-h-full bg-white">
      {/* Patterned greeting */}
      <div className="relative overflow-hidden border-b border-slate-200 bg-[#f7f8fb] px-4 py-6 sm:px-6">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.35]"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="aa-home-icons"
              width="48"
              height="48"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M12 14h8v8h-8zM28 16h10M28 22h7M14 34h20"
                fill="none"
                stroke="#c5c9d4"
                strokeWidth="1.2"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#aa-home-icons)" />
        </svg>
        <div className="relative">
          <h1 className="text-xl font-semibold text-slate-800 sm:text-2xl">
            Hello, {displayName}
          </h1>
          {businessName && (
            <p className="mt-1 text-sm text-slate-500">{businessName}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 px-4 sm:px-6">
        <nav className="-mb-px flex gap-6" aria-label="Home sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "border-b-2 py-3 text-sm font-medium transition-colors",
                tab === t.id
                  ? "border-[var(--aa-accent)] text-[var(--aa-accent)]"
                  : "border-transparent text-slate-500 hover:text-slate-700",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="px-4 py-5 sm:px-6">
        {tab === "dashboard" && (
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-800">Dashboard</h2>
            <p className="mt-2 text-sm text-slate-500">
              Use the sidebar to open modules, or finish setup under Getting
              Started.
            </p>
            <button
              type="button"
              onClick={() => setTab("getting-started")}
              className="mt-4 rounded-md px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "var(--aa-accent)" }}
            >
              Continue setup
            </button>
          </div>
        )}

        {tab === "recent" && (
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-800">
              Recent updates
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              No recent product updates to show yet.
            </p>
          </div>
        )}

        {tab === "getting-started" && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  Welcome to AA ERP
                </h2>
                <button
                  type="button"
                  className="mt-1 inline-flex items-center gap-1.5 text-sm text-[var(--aa-accent)] hover:underline"
                  onClick={() => navigate("/app/home")}
                >
                  <PlayCircle className="size-4" />
                  Overview of AA ERP
                </button>
              </div>
              <div className="w-full sm:w-48">
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>{progress}% Completed</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${progress}%`,
                      backgroundColor: "var(--aa-accent)",
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-[240px_1fr]">
              <ul className="border-b border-slate-200 md:border-b-0 md:border-r">
                {SETUP_STEPS.map((step) => {
                  const done = completed.has(step.id);
                  const active = step.id === activeStepId;
                  return (
                    <li key={step.id}>
                      <button
                        type="button"
                        onClick={() => setActiveStepId(step.id)}
                        className={cn(
                          "flex w-full items-start gap-2 border-l-[3px] px-4 py-3 text-left text-sm transition-colors",
                          active
                            ? "border-[var(--aa-accent)] bg-[#f5f9ff] text-slate-900"
                            : "border-transparent text-slate-600 hover:bg-slate-50",
                        )}
                      >
                        {done ? (
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                        ) : (
                          <Circle className="mt-0.5 size-4 shrink-0 text-slate-300" />
                        )}
                        <span className={cn(active && "font-medium")}>
                          {step.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="px-5 py-6">
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-[var(--aa-sidebar-active)] text-[var(--aa-accent)]">
                  <activeStep.icon className="size-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">
                  {activeStep.title}
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                  {activeStep.description}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(activeStep.href)}
                    className="rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm"
                    style={{ backgroundColor: "var(--aa-accent)" }}
                  >
                    {activeStep.cta}
                  </button>
                  {activeStep.secondary.map((link) => (
                    <button
                      key={link.href}
                      type="button"
                      onClick={() => navigate(link.href)}
                      className="text-sm font-medium text-[var(--aa-accent)] hover:underline"
                    >
                      {link.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
