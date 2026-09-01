import { useEffect, useState } from "react";
import { ShieldCheck, BarChart3, Boxes, ChevronRight } from "lucide-react";
import logoDefault from "../../../assets/aa_erp-blue.png";

export const AUTH_BRAND = {
  name: "ALH ALI MUHAMMAD YAMMUSA",
  button: "#1A2D5E",
  primary: "#1A2D5E",
};

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

function withAlpha(hex, alpha = 0.88) {
  const h = String(hex || "#1A2D5E").replace("#", "");
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${h}${a}`;
}

export function authFieldClass(hasError) {
  return hasError
    ? "border-red-400 focus:border-red-400 focus:ring-red-100"
    : "border-slate-300 focus:border-[var(--login-accent)] focus:ring-[color-mix(in_srgb,var(--login-accent)_18%,transparent)]";
}

export default function AuthShell({ title, subtitle, children }) {
  const [slide, setSlide] = useState(0);
  const brand = AUTH_BRAND;

  useEffect(() => {
    const id = setInterval(() => {
      setSlide((s) => (s + 1) % FEATURE_SLIDES.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const activeSlide = FEATURE_SLIDES[slide];
  const SlideIcon = activeSlide.icon;

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
          <div className="flex flex-col px-8 py-9 sm:px-10 sm:py-10">
            <div className="mb-8">
              <img
                src={logoDefault}
                alt={`${brand.name} logo`}
                className="object-contain object-left"
                style={{ height: "2.75rem", width: "auto", maxWidth: "10.5rem" }}
              />
            </div>

            <h1 className="login-page__title text-[2rem] font-bold leading-tight tracking-tight text-slate-900">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-[15px] text-slate-500">{subtitle}</p>
            ) : null}

            <div className="mt-7 flex flex-1 flex-col">{children}</div>
          </div>

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
        © {new Date().getFullYear()}, {brand.name}. All Rights Reserved.
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
