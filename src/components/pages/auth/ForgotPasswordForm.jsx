import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { _postApi } from "@/redux/actions/api";
import AuthShell, { AUTH_BRAND, authFieldClass } from "./AuthShell";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (emailError) setEmailError("");
  };

  const handleEmailBlur = () => {
    if (email && !validateEmail(email)) {
      setEmailError("Please enter a valid email address");
    }
  };

  const checkMail = () => {
    if (!email) {
      setEmailError("Email is required");
      return;
    }
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setEmailError("");

    _postApi(
      `/api/auth/check-mail`,
      { email },
      (resp) => {
        if (resp.success) {
          toast.success(resp.message);
          setEmail("");
        } else {
          toast.error(resp.message || "Failed to send reset email.");
        }
        setLoading(false);
      },
      (err) => {
        console.error("API Error:", err);
        toast.error(
          err?.message || "Something went wrong while sending reset email.",
        );
        setLoading(false);
      },
    );
  };

  return (
    <AuthShell
      title="Trouble logging in?"
      subtitle={
        <>
          Enter your email and we&apos;ll send a link to{" "}
          <span className="font-medium text-slate-700">{AUTH_BRAND.name}</span>
        </>
      }
    >
      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          checkMail();
        }}
      >
        <div>
          <input
            id="email"
            required
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={handleEmailChange}
            onBlur={handleEmailBlur}
            className={`h-11 w-full rounded-md border bg-white px-3.5 text-[15px] text-slate-900 outline-none transition focus:ring-4 ${authFieldClass(Boolean(emailError))}`}
          />
          {emailError ? (
            <p className="mt-1.5 text-sm text-red-500">{emailError}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={loading || !email || Boolean(emailError)}
          className="mt-5 flex h-11 w-full items-center justify-center rounded-md text-[15px] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: AUTH_BRAND.button }}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            "Send Code"
          )}
        </button>

        <Link
          to="/login"
          className="mt-4 text-center text-xs font-medium hover:underline"
          style={{ color: AUTH_BRAND.button }}
        >
          Back to Log In
        </Link>

        <p className="mt-auto pt-8 text-center text-[11px] tracking-wide text-slate-400">
          This solution is powered by Nexifour Limited
        </p>
      </form>
    </AuthShell>
  );
}
