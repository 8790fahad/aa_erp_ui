import { useState, useEffect } from "react";
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import useQuery from "@/common/Custom/Hook/useQuery";
import { _postApi, _fetchApi } from "@/redux/actions/api";
import AuthShell, { AUTH_BRAND, authFieldClass } from "./AuthShell";

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const query = useQuery();
  const resetToken = query.get("token");
  const resetEmail = query.get("email");
  const [verifiedEmail, setVerifiedEmail] = useState("");

  useEffect(() => {
    if (!resetToken) return;
    const params = new URLSearchParams({
      token: resetToken,
      type: "reset",
    });
    if (resetEmail) params.set("email", resetEmail);
    _fetchApi(
      `/api/auth/verify?${params.toString()}`,
      (resp) => {
        if (resp.success && resp.email) {
          setVerifiedEmail(resp.email);
        }
      },
      () => {},
    );
  }, [resetToken, resetEmail]);

  const passwordRules = [
    { rule: "At least 8 characters", valid: newPassword.length >= 8 },
    { rule: "Contains number", valid: /\d/.test(newPassword) },
  ];

  const isPasswordValid = passwordRules.every((rule) => rule.valid);
  const passwordsMatch =
    newPassword === confirmPassword && confirmPassword !== "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isPasswordValid) {
      setError("Please ensure your password meets all requirements");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    _postApi(
      `/api/auth/reset-password`,
      { password: newPassword, token: resetToken },
      (resp) => {
        if (resp.success) {
          toast.success(resp.message);
          setSuccess(true);
        } else {
          toast.error(resp.message || "Something went wrong.");
        }
        setIsSubmitting(false);
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while sending password reset.");
        setIsSubmitting(false);
      },
    );
  };

  if (!resetToken) {
    return (
      <AuthShell
        title="Link incomplete"
        subtitle="Open the reset link from your email, or request a new one."
      >
        <div className="flex flex-1 flex-col">
          <p className="text-[15px] text-slate-500">
            This page needs a valid reset token. Go back to login and use Forgot
            password to send a new email.
          </p>
          <Link
            to="/login"
            className="mt-5 flex h-11 w-full items-center justify-center rounded-md text-[15px] font-semibold text-white transition hover:brightness-105"
            style={{ backgroundColor: AUTH_BRAND.button }}
          >
            Back to Log In
          </Link>
          <p className="mt-auto pt-8 text-center text-[11px] tracking-wide text-slate-400">
            This solution is powered by Nexifour Limited
          </p>
        </div>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell
        title="Password updated"
        subtitle="You can now sign in with your new password."
      >
        <div className="flex flex-1 flex-col">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle className="h-7 w-7 text-emerald-600" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">
            Password Reset Successful!
          </h3>
          <p className="mt-1 text-[15px] text-slate-500">
            Your password has been updated. Continue to the login page to access{" "}
            {AUTH_BRAND.name}.
          </p>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-5 flex h-11 w-full items-center justify-center rounded-md text-[15px] font-semibold text-white transition hover:brightness-105"
            style={{ backgroundColor: AUTH_BRAND.button }}
          >
            Continue to Log In
          </button>
          <p className="mt-auto pt-8 text-center text-[11px] tracking-wide text-slate-400">
            This solution is powered by Nexifour Limited
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset Your Password"
      subtitle={
        verifiedEmail ? (
          <>
            Account: <span className="font-medium text-slate-700">{verifiedEmail}</span>
          </>
        ) : (
          "Enter a new password for your account."
        )
      }
    >
      <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
        {error ? (
          <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3.5">
            <p className="text-center text-sm text-red-600">{error}</p>
          </div>
        ) : null}

        <div className="space-y-4">
          <div>
            <div className="relative">
              <input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
                required
                className={`h-11 w-full rounded-md border bg-white px-3.5 pr-11 text-[15px] text-slate-900 outline-none transition focus:ring-4 ${authFieldClass(false)}`}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                onClick={() => setShowNewPassword((v) => !v)}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {newPassword ? (
              <ul className="mt-2 space-y-1">
                {passwordRules.map((rule) => (
                  <li
                    key={rule.rule}
                    className={`flex items-center gap-1.5 text-xs ${
                      rule.valid ? "text-emerald-700" : "text-slate-400"
                    }`}
                  >
                    {rule.valid ? (
                      <CheckCircle className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {rule.rule}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                required
                className={`h-11 w-full rounded-md border bg-white px-3.5 pr-11 text-[15px] text-slate-900 outline-none transition focus:ring-4 ${authFieldClass(
                  Boolean(confirmPassword && !passwordsMatch),
                )}`}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {confirmPassword && !passwordsMatch ? (
              <p className="mt-1.5 text-sm text-red-500">Passwords do not match</p>
            ) : null}
          </div>
        </div>

        <button
          type="submit"
          disabled={!isPasswordValid || !passwordsMatch || isSubmitting}
          className="mt-5 flex h-11 w-full items-center justify-center rounded-md text-[15px] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: AUTH_BRAND.button }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating…
            </>
          ) : (
            "Update Password"
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
