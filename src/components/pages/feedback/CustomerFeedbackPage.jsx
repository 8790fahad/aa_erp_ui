import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { MapPin, Phone, Star, CheckCircle2 } from "lucide-react";
import { _postApi } from "@/redux/actions/api";
import { Button } from "@/components/ui/button";
import yammusaLogo from "@/assets/yammusa-logo.png";

const BRAND = {
  name: "ALH ALI MUHAMMAD YAMMUSA",
  address: "#52E Ado Bayero Road Singer Market, Kano.",
  phones: "08036032541, 07032144609, 07077222277, 08081634455",
};

/**
 * Public feedback form opened from QR on Goods Issue Note.
 * Mobile-first full-viewport layout (escapes app SidebarProvider flex gap).
 */
export default function CustomerFeedbackPage() {
  const [searchParams] = useSearchParams();
  const saleCode = String(searchParams.get("sale_code") || "").trim();
  const businessId = String(
    searchParams.get("businessId") ||
      searchParams.get("facilityId") ||
      "",
  ).trim();
  const customerNo = String(searchParams.get("customerNo") || "").trim();
  const customerName = String(searchParams.get("customerName") || "").trim();

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const subtitle = useMemo(() => {
    if (saleCode && customerName) return `${saleCode} · ${customerName}`;
    if (saleCode) return `Invoice ${saleCode}`;
    if (customerName) return customerName;
    return "We value your experience";
  }, [saleCode, customerName]);

  const submit = () => {
    if (!businessId) {
      toast.error("Missing business reference on this link");
      return;
    }
    if (!rating && !comment.trim()) {
      toast.error("Please select a rating or write a comment");
      return;
    }
    setSubmitting(true);
    _postApi(
      "/api/v1/customer-feedback",
      {
        businessId,
        facilityId: businessId,
        sale_code: saleCode || null,
        customer_no: customerNo || null,
        customer_name: customerName || null,
        rating: rating || null,
        comment: comment.trim() || null,
        phone: phone.trim() || null,
      },
      (res) => {
        setSubmitting(false);
        if (res?.success) {
          setDone(true);
          toast.success(res.message || "Thank you!");
        } else {
          toast.error(res?.message || "Could not submit feedback");
        }
      },
      (err) => {
        setSubmitting(false);
        toast.error(err?.message || "Could not submit feedback");
      },
    );
  };

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto overscroll-y-contain bg-[#eef2ee]">
      {/* Top brand band — stacks on mobile, full width */}
      <header className="w-full bg-[#1a4d2e] px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 sm:pb-20 sm:pt-8">
        <div className="mx-auto flex max-w-lg flex-col items-center text-center text-white">
          <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-white p-1 shadow-md ring-2 ring-[#d4af37]/90 sm:h-24 sm:w-24 sm:p-1.5">
            <img
              src={yammusaLogo}
              alt={BRAND.name}
              className="h-full w-full rounded-full object-contain"
            />
          </div>
          <h1 className="max-w-[18rem] text-base font-bold leading-snug tracking-wide sm:max-w-none sm:text-xl">
            {BRAND.name}
          </h1>
          <p className="mt-1 text-xs text-white/85 sm:text-sm">
            Customer feedback
          </p>
        </div>
      </header>

      {/* Form card — overlaps header, centered, full width on phone */}
      <main className="-mt-10 px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:-mt-12 sm:px-4">
        <div className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
            <p className="text-sm font-semibold text-slate-900 sm:text-base">
              {done ? "Thank you" : "How was your experience?"}
            </p>
            <p className="mt-0.5 break-words text-xs text-slate-500">
              {subtitle}
            </p>
          </div>

          <div className="px-4 py-5 sm:px-5">
            {done ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
                <p className="mt-3 text-lg font-semibold text-slate-900">
                  Feedback received
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Thank you for patronizing us. We look forward to your return.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    Your rating
                  </p>
                  <div className="flex justify-center gap-0.5 xs:gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = (hover || rating) >= n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onMouseEnter={() => setHover(n)}
                          onMouseLeave={() => setHover(0)}
                          onClick={() => setRating(n)}
                          className="touch-manipulation rounded-lg p-2 transition hover:bg-amber-50 active:scale-95"
                          aria-label={`${n} star`}
                        >
                          <Star
                            className={`h-8 w-8 sm:h-9 sm:w-9 ${
                              active
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-300"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Comment
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    placeholder="What went well? What can we improve?"
                    className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none transition focus:border-[#1a4d2e] focus:ring-2 focus:ring-[#1a4d2e]/20 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Phone{" "}
                    <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="080…"
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition focus:border-[#1a4d2e] focus:ring-2 focus:ring-[#1a4d2e]/20 sm:h-11 sm:text-sm"
                  />
                </div>

                <Button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="h-12 w-full touch-manipulation rounded-xl bg-[#1a4d2e] text-sm font-semibold text-white hover:bg-[#143d24] sm:h-11"
                >
                  {submitting ? "Sending…" : "Submit feedback"}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2.5 border-t border-slate-100 bg-slate-50 px-4 py-4 text-xs leading-relaxed text-slate-600 sm:px-5">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1a4d2e]" />
              <span className="min-w-0 break-words">{BRAND.address}</span>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1a4d2e]" />
              <a
                href={`tel:${BRAND.phones.split(",")[0].trim()}`}
                className="min-w-0 break-words hover:text-[#1a4d2e] hover:underline"
              >
                {BRAND.phones}
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
