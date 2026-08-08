import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  RotateCcw,
  Loader2,
  ShieldCheck,
  BarChart3,
  Boxes,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logoDefault from "../../../assets/aa_erp-blue.png";
import { Link, useParams } from "react-router-dom";
import useLogin from "./useLogin";
import { apiURL } from "@/redux/actions/api";

function normalizeHex(hex, fallback = "#1A2D5E") {
  const raw = String(hex || fallback).trim();
  if (/^#?[0-9a-fA-F]{3}$/.test(raw)) {
    const h = raw.startsWith("#") ? raw.slice(1) : raw;
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  if (/^#?[0-9a-fA-F]{6}$/.test(raw)) {
    return raw.startsWith("#") ? raw : `#${raw}`;
  }
  return fallback;
}

function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function isLightColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}

function darkenHex(hex, amount = 0.22) {
  const { r, g, b } = hexToRgb(hex);
  const f = 1 - amount;
  const to = (n) =>
    Math.max(0, Math.min(255, Math.round(n * f)))
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function withAlpha(hex, alpha = 0.88) {
  const h = normalizeHex(hex).slice(1);
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${h}${a}`;
}

function usableBrandColors(primaryRaw, secondaryRaw) {
  const primary = normalizeHex(primaryRaw || "#1A2D5E");
  const safePrimary = isLightColor(primary) ? "#1A2D5E" : primary;
  let secondary = normalizeHex(secondaryRaw || safePrimary, safePrimary);
  if (isLightColor(secondary)) {
    secondary = darkenHex(safePrimary, 0.2);
  }
  return { primary: safePrimary, secondary };
}

const FEATURE_SLIDES = [
  {
    icon: ShieldCheck,
    title: "Secure by design",
    body: "Role-based access, audit trails, and compliant data handling for your business records.",
  },
  {
    icon: Boxes,
    title: "Inventory that stays in sync",
    body: "Track stock, sales, and transfers in one place so every branch sees the same numbers.",
  },
  {
    icon: BarChart3,
    title: "Finance & reporting",
    body: "Invoices, ledgers, and live reports that help you close the books with confidence.",
  },
];

export default function Login() {
  const { businessSlug } = useParams();
  const {
    errors,
    values,
    handleChange,
    handleSubmit,
    resendMail,
    loading,
    error,
    resendData,
    resendLoading,
  } = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const [branding, setBranding] = useState(null);
  const [brandingLoading, setBrandingLoading] = useState(Boolean(businessSlug));
  const [brandingError, setBrandingError] = useState("");
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (!businessSlug) {
      setBranding(null);
      setBrandingLoading(false);
      setBrandingError("");
      return;
    }

    let cancelled = false;
    setBrandingLoading(true);
    setBrandingError("");

    const slug = encodeURIComponent(String(businessSlug).trim());
    fetch(`${apiURL}/api/catalog/login-branding/${slug}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Business login page not found");
        }
        if (!cancelled) setBranding(data.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setBranding(null);
          setBrandingError(err.message || "Could not load business branding");
        }
      })
      .finally(() => {
        if (!cancelled) setBrandingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [businessSlug]);

  useEffect(() => {
    const id = setInterval(() => {
      setSlide((s) => (s + 1) % FEATURE_SLIDES.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const brand = useMemo(() => {
    const { primary, secondary } = usableBrandColors(
      branding?.primary_color,
      branding?.secondary_color,
    );
    const name = branding?.business_name || "YAMMUSA GLOBAL FARMS & AGRO ALLIED SERVICES";
    const isBranded = Boolean(branding);
    return {
      name,
      logo: branding?.logo || logoDefault,
      primary,
      secondary,
      button: isLightColor(primary) ? "#2c7be5" : primary,
      description: isBranded
        ? branding?.description ||
          "Sign in to manage inventory, finances, and day-to-day operations."
        : "Your complete business management solution for inventory, finance, and growth.",
      isBranded,
    };
  }, [branding]);

  const activeSlide = FEATURE_SLIDES[slide];
  const SlideIcon = activeSlide.icon;

  const fieldClass = (field) =>
    errors[field]
      ? "border-red-400 focus:border-red-400 focus:ring-red-100"
      : "border-slate-300 focus:border-[var(--login-accent)] focus:ring-[color-mix(in_srgb,var(--login-accent)_18%,transparent)]";

  if (businessSlug && brandingLoading) {
    return (
      <div className="login-page min-h-screen flex items-center justify-center bg-[#eef1f4]">
        <div className="text-center space-y-3">
          <Loader2
            className="w-7 h-7 animate-spin mx-auto"
            style={{ color: "#2c7be5" }}
          />
          <p className="text-sm text-slate-500">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="login-page fixed inset-0 z-50 flex w-screen flex-col items-center justify-center overflow-y-auto px-4 py-10 sm:px-6"
      style={{
        ["--login-accent"]: brand.button,
        ["--login-navy"]: brand.primary,
      }}
    >
      <div className="login-page__bg" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-[920px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
        <div className="grid min-h-[520px] lg:grid-cols-2">
          {/* Left — sign in */}
          <div className="flex flex-col px-8 py-9 sm:px-10 sm:py-10">
            <div className="mb-8 flex items-start justify-between gap-3">
              <img
                src={brand.logo}
                alt={`${brand.name} logo`}
                className="object-contain object-left"
                style={{
                  height: brand.isBranded ? "3.25rem" : "2.75rem",
                  width: "auto",
                  maxWidth: "10.5rem",
                }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = logoDefault;
                }}
              />
            </div>

            <h1 className="login-page__title text-[2rem] font-bold leading-tight tracking-tight text-slate-900">
              Sign in
            </h1>
            <p className="mt-1 text-[15px] text-slate-500">
              to access{" "}
              <span className="font-medium text-slate-700">{brand.name}</span>
            </p>

            {brandingError ? (
              <p className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50 px-3.5 py-2.5 text-left text-sm text-amber-800">
                {brandingError}. Showing default YAMMUSA GLOBAL FARMS & AGRO ALLIED SERVICES login.{" "}
                <Link to="/login" className="font-medium underline">
                  Continue here
                </Link>
              </p>
            ) : null}

            <form className="mt-7 flex flex-1 flex-col" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <input
                    id="email"
                    required
                    type="email"
                    name="email"
                    onChange={handleChange}
                    value={values.email}
                    placeholder="Email address"
                    autoComplete="email"
                    className={`h-11 w-full rounded-md border bg-white px-3.5 text-[15px] text-slate-900 outline-none transition focus:ring-4 ${fieldClass("email")}`}
                  />
                  {errors.email && (
                    <p className="mt-1.5 text-sm text-red-500">{errors.email}</p>
                  )}
                </div>

                <div>
                  <div className="relative">
                    <input
                      id="password"
                      required
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={values.password}
                      onChange={handleChange}
                      placeholder="Password"
                      autoComplete="current-password"
                      className={`h-11 w-full rounded-md border bg-white px-3.5 pr-11 text-[15px] text-slate-900 outline-none transition focus:ring-4 ${fieldClass("password")}`}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowPassword((v) => !v);
                      }}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1.5 text-sm text-red-500">
                      {errors.password}
                    </p>
                  )}
                  <div className="mt-2 flex justify-end">
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium hover:underline"
                      style={{ color: brand.button }}
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>
              </div>

              {error.message && (
                <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3.5">
                  <p className="text-center text-sm text-red-600">
                    {error.message}
                  </p>
                  {error.message ===
                    "Your account is not yet verified, check mail for verification" && (
                    <div className="mt-3 flex justify-center">
                      <Button
                        className="border-0 text-white"
                        style={{ backgroundColor: brand.button }}
                        onClick={resendMail}
                        size="sm"
                        disabled={resendData > 0 || resendLoading}
                        type="button"
                      >
                        {resendLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            {resendData > 0
                              ? `Resend in ${resendData}s`
                              : "Resend Verification Email"}
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || resendData > 0}
                className="mt-5 flex h-11 w-full items-center justify-center rounded-md text-[15px] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: brand.button }}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>

              <p className="mt-auto pt-8 text-center text-[11px] tracking-wide text-slate-400">
                This solution is powered by Nexifour Limited
              </p>
            </form>
          </div>

          {/* Right — feature panel */}
          <div className="relative hidden flex-col items-center justify-center border-l border-slate-100 bg-[#fafbfc] px-10 py-12 text-center lg:flex">
            <div
              className="mb-8 flex h-36 w-36 items-center justify-center rounded-full"
              style={{
                background: `linear-gradient(145deg, ${withAlpha(brand.button, 0.14)}, ${withAlpha(brand.primary, 0.08)})`,
              }}
            >
              <div
                className="flex h-24 w-24 items-center justify-center rounded-2xl shadow-sm"
                style={{
                  backgroundColor: withAlpha(brand.button, 0.12),
                  color: brand.button,
                }}
              >
                <SlideIcon className="h-12 w-12" strokeWidth={1.5} />
              </div>
            </div>

            <h2 className="login-page__title max-w-xs text-xl font-bold tracking-tight text-slate-900">
              {activeSlide.title}
            </h2>
            <p className="mt-3 max-w-[280px] text-[14px] leading-relaxed text-slate-500">
              {activeSlide.body}
            </p>

            <a
              href="/signup"
              className="mt-5 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
              style={{ color: brand.button }}
            >
              Learn more
              <ChevronRight className="h-4 w-4" />
            </a>

            <div className="mt-10 flex items-center gap-2">
              {FEATURE_SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Show feature ${i + 1}`}
                  onClick={() => setSlide(i)}
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: i === slide ? 18 : 8,
                    backgroundColor:
                      i === slide ? brand.button : "rgb(203 213 225)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="relative z-10 mt-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()}, YAMMUSA GLOBAL FARMS & AGRO ALLIED SERVICES. All Rights Reserved.
      </p>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        .login-page {
          font-family: 'Plus Jakarta Sans', 'Open Sans', sans-serif;
          background: #eef1f4;
        }
        .login-page__title {
          font-family: 'Plus Jakarta Sans', 'Open Sans', sans-serif;
        }
        .login-page__bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          background-color: #eef1f4;
          background-image:
            linear-gradient(135deg, rgba(148, 163, 184, 0.07) 25%, transparent 25%),
            linear-gradient(225deg, rgba(148, 163, 184, 0.07) 25%, transparent 25%),
            linear-gradient(45deg, rgba(148, 163, 184, 0.07) 25%, transparent 25%),
            linear-gradient(315deg, rgba(148, 163, 184, 0.07) 25%, transparent 25%);
          background-position: 40px 0, 40px 0, 0 0, 0 0;
          background-size: 80px 80px;
          background-repeat: repeat;
        }
      `}</style>
    </div>
  );
}
